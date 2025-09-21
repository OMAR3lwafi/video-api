#!/bin/bash

# Video Generation Platform - Docker Setup Validation Script
# This script validates the entire Docker containerization setup

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="${PROJECT_ROOT}/logs/docker-validation-$(date +%Y%m%d_%H%M%S).log"
VALIDATION_REPORT="${PROJECT_ROOT}/logs/validation-report-$(date +%Y%m%d_%H%M%S).json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Test configuration
TIMEOUT="${TIMEOUT:-300}"
HEALTH_CHECK_TIMEOUT="${HEALTH_CHECK_TIMEOUT:-120}"
COMPOSE_FILES=("docker-compose.yml" "docker-compose.dev.yml" "docker-compose.prod.yml")
SERVICES=("backend" "frontend" "orchestrator" "redis" "database")
OPTIONAL_SERVICES=("prometheus" "grafana" "minio")

# Test results
declare -A TEST_RESULTS
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNINGS=0

# Logging functions
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    # Create logs directory if it doesn't exist
    mkdir -p "$(dirname "$LOG_FILE")"

    # Log to file
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"

    # Color output for terminal
    case "$level" in
        "ERROR") echo -e "${RED}✗ [$level] $message${NC}" ;;
        "WARN")  echo -e "${YELLOW}⚠ [$level] $message${NC}" ;;
        "INFO")  echo -e "${BLUE}ℹ [$level] $message${NC}" ;;
        "SUCCESS") echo -e "${GREEN}✓ [$level] $message${NC}" ;;
        "TEST") echo -e "${CYAN}→ [$level] $message${NC}" ;;
        "RESULT") echo -e "${PURPLE}★ [$level] $message${NC}" ;;
        *) echo "[$timestamp] [$level] $message" ;;
    esac
}

# Test result tracking
record_test_result() {
    local test_name="$1"
    local result="$2"
    local message="${3:-}"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    TEST_RESULTS["$test_name"]="$result"

    if [ "$result" = "PASS" ]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        log "SUCCESS" "$test_name: PASS ${message:+- $message}"
    elif [ "$result" = "FAIL" ]; then
        FAILED_TESTS=$((FAILED_TESTS + 1))
        log "ERROR" "$test_name: FAIL ${message:+- $message}"
    elif [ "$result" = "WARN" ]; then
        WARNINGS=$((WARNINGS + 1))
        log "WARN" "$test_name: WARNING ${message:+- $message}"
    fi
}

# Cleanup function
cleanup() {
    log "INFO" "Cleaning up validation environment..."

    # Stop test containers if running
    if docker-compose -f docker-compose.yml ps -q > /dev/null 2>&1; then
        log "INFO" "Stopping test containers..."
        docker-compose -f docker-compose.yml down --remove-orphans > /dev/null 2>&1 || true
    fi

    if [ "${1:-}" = "error" ]; then
        log "ERROR" "Validation failed with errors"
        exit 1
    fi
}

# Signal handlers
trap 'cleanup error' ERR
trap 'cleanup' EXIT INT TERM

# Help function
show_help() {
    cat << EOF
Video Generation Platform - Docker Setup Validation

Usage: $0 [OPTIONS]

OPTIONS:
    --quick                 Run quick validation (skip build tests)
    --full                  Run comprehensive validation including load tests
    --compose-file FILE     Test specific compose file [default: all]
    --services SERVICES     Test specific services (comma-separated)
    --skip-build           Skip Docker image build validation
    --skip-network         Skip network connectivity tests
    --skip-security        Skip security validation
    --report-format FORMAT Report format (json|html|text) [default: json]
    --cleanup              Clean up test environment after validation
    --verbose              Verbose output
    -h, --help             Show this help

EXAMPLES:
    $0                     # Full validation
    $0 --quick             # Quick validation
    $0 --compose-file docker-compose.dev.yml  # Test dev config only
    $0 --services backend,redis               # Test specific services

EOF
}

# Parse command line arguments
parse_args() {
    local quick_mode=false
    local full_mode=false
    local specific_compose=""
    local specific_services=""
    local skip_build=false
    local skip_network=false
    local skip_security=false
    local cleanup_after=false
    local verbose=false
    local report_format="json"

    while [[ $# -gt 0 ]]; do
        case $1 in
            --quick)
                quick_mode=true
                shift
                ;;
            --full)
                full_mode=true
                shift
                ;;
            --compose-file)
                specific_compose="$2"
                shift 2
                ;;
            --services)
                specific_services="$2"
                shift 2
                ;;
            --skip-build)
                skip_build=true
                shift
                ;;
            --skip-network)
                skip_network=true
                shift
                ;;
            --skip-security)
                skip_security=true
                shift
                ;;
            --report-format)
                report_format="$2"
                shift 2
                ;;
            --cleanup)
                cleanup_after=true
                shift
                ;;
            --verbose)
                verbose=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                log "ERROR" "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done

    export QUICK_MODE="$quick_mode"
    export FULL_MODE="$full_mode"
    export SPECIFIC_COMPOSE="$specific_compose"
    export SPECIFIC_SERVICES="$specific_services"
    export SKIP_BUILD="$skip_build"
    export SKIP_NETWORK="$skip_network"
    export SKIP_SECURITY="$skip_security"
    export CLEANUP_AFTER="$cleanup_after"
    export VERBOSE="$verbose"
    export REPORT_FORMAT="$report_format"
}

# Check Docker prerequisites
check_prerequisites() {
    log "INFO" "=== Checking Prerequisites ==="

    # Check Docker installation
    if command -v docker > /dev/null 2>&1; then
        local docker_version
        docker_version=$(docker --version | cut -d' ' -f3 | cut -d',' -f1)
        record_test_result "docker_installed" "PASS" "Docker version $docker_version"
    else
        record_test_result "docker_installed" "FAIL" "Docker not installed"
        return 1
    fi

    # Check Docker daemon
    if docker info > /dev/null 2>&1; then
        record_test_result "docker_daemon" "PASS" "Docker daemon is running"
    else
        record_test_result "docker_daemon" "FAIL" "Docker daemon not accessible"
        return 1
    fi

    # Check Docker Compose
    if command -v docker-compose > /dev/null 2>&1; then
        local compose_version
        compose_version=$(docker-compose --version | cut -d' ' -f3 | cut -d',' -f1)
        record_test_result "compose_installed" "PASS" "Docker Compose version $compose_version"
    else
        record_test_result "compose_installed" "FAIL" "Docker Compose not installed"
        return 1
    fi

    # Check available resources
    local available_memory
    available_memory=$(free -m | awk 'NR==2{printf "%.0f", $7}')

    if [ "$available_memory" -gt 2048 ]; then
        record_test_result "memory_available" "PASS" "${available_memory}MB available"
    elif [ "$available_memory" -gt 1024 ]; then
        record_test_result "memory_available" "WARN" "${available_memory}MB available (recommended: 4GB+)"
    else
        record_test_result "memory_available" "FAIL" "${available_memory}MB available (minimum: 1GB)"
    fi

    # Check disk space
    local available_space
    available_space=$(df "$PROJECT_ROOT" | awk 'NR==2 {print int($4/1024)}')

    if [ "$available_space" -gt 10240 ]; then
        record_test_result "disk_space" "PASS" "${available_space}MB available"
    elif [ "$available_space" -gt 5120 ]; then
        record_test_result "disk_space" "WARN" "${available_space}MB available (recommended: 10GB+)"
    else
        record_test_result "disk_space" "FAIL" "${available_space}MB available (minimum: 5GB)"
    fi
}

# Validate Dockerfiles
validate_dockerfiles() {
    log "INFO" "=== Validating Dockerfiles ==="

    local dockerfiles=("backend/Dockerfile" "frontend/Dockerfile" "orchestrator/Dockerfile")

    for dockerfile_path in "${dockerfiles[@]}"; do
        local service_name
        service_name=$(dirname "$dockerfile_path")

        log "TEST" "Validating $dockerfile_path"

        if [ -f "$PROJECT_ROOT/$dockerfile_path" ]; then
            # Check Dockerfile syntax
            if docker build -t "test-${service_name}" -f "$PROJECT_ROOT/$dockerfile_path" "$PROJECT_ROOT/$service_name" --target runtime > /dev/null 2>&1; then
                record_test_result "dockerfile_${service_name}_syntax" "PASS" "Dockerfile builds successfully"

                # Clean up test image
                docker rmi "test-${service_name}" > /dev/null 2>&1 || true
            else
                record_test_result "dockerfile_${service_name}_syntax" "FAIL" "Dockerfile build failed"
            fi

            # Check multi-stage builds
            if grep -q "FROM.*AS.*" "$PROJECT_ROOT/$dockerfile_path"; then
                record_test_result "dockerfile_${service_name}_multistage" "PASS" "Multi-stage build detected"
            else
                record_test_result "dockerfile_${service_name}_multistage" "WARN" "No multi-stage build found"
            fi

            # Check non-root user
            if grep -q "USER.*" "$PROJECT_ROOT/$dockerfile_path" && ! grep -q "USER root" "$PROJECT_ROOT/$dockerfile_path"; then
                record_test_result "dockerfile_${service_name}_nonroot" "PASS" "Non-root user configured"
            else
                record_test_result "dockerfile_${service_name}_nonroot" "WARN" "Running as root user"
            fi

            # Check health check
            if grep -q "HEALTHCHECK" "$PROJECT_ROOT/$dockerfile_path"; then
                record_test_result "dockerfile_${service_name}_healthcheck" "PASS" "Health check configured"
            else
                record_test_result "dockerfile_${service_name}_healthcheck" "WARN" "No health check found"
            fi

        else
            record_test_result "dockerfile_${service_name}_exists" "FAIL" "Dockerfile not found"
        fi
    done
}

# Validate Docker Compose files
validate_compose_files() {
    log "INFO" "=== Validating Docker Compose Files ==="

    local files_to_check=("${COMPOSE_FILES[@]}")

    if [ -n "$SPECIFIC_COMPOSE" ]; then
        files_to_check=("$SPECIFIC_COMPOSE")
    fi

    for compose_file in "${files_to_check[@]}"; do
        log "TEST" "Validating $compose_file"

        if [ -f "$PROJECT_ROOT/$compose_file" ]; then
            # Check syntax
            if docker-compose -f "$PROJECT_ROOT/$compose_file" config > /dev/null 2>&1; then
                record_test_result "compose_${compose_file}_syntax" "PASS" "Valid YAML syntax"
            else
                record_test_result "compose_${compose_file}_syntax" "FAIL" "Invalid YAML syntax"
                continue
            fi

            # Check required services
            local config_output
            config_output=$(docker-compose -f "$PROJECT_ROOT/$compose_file" config)

            for service in "${SERVICES[@]}"; do
                if echo "$config_output" | grep -q "^  $service:"; then
                    record_test_result "compose_${compose_file}_${service}" "PASS" "Service $service defined"
                else
                    record_test_result "compose_${compose_file}_${service}" "FAIL" "Service $service missing"
                fi
            done

            # Check networks
            if echo "$config_output" | grep -q "networks:"; then
                record_test_result "compose_${compose_file}_networks" "PASS" "Networks configured"
            else
                record_test_result "compose_${compose_file}_networks" "WARN" "No custom networks defined"
            fi

            # Check volumes
            if echo "$config_output" | grep -q "volumes:"; then
                record_test_result "compose_${compose_file}_volumes" "PASS" "Volumes configured"
            else
                record_test_result "compose_${compose_file}_volumes" "WARN" "No named volumes defined"
            fi

            # Check health checks
            local healthcheck_count
            healthcheck_count=$(echo "$config_output" | grep -c "healthcheck:" || echo "0")

            if [ "$healthcheck_count" -gt 0 ]; then
                record_test_result "compose_${compose_file}_healthchecks" "PASS" "$healthcheck_count services with health checks"
            else
                record_test_result "compose_${compose_file}_healthchecks" "WARN" "No health checks configured"
            fi

        else
            record_test_result "compose_${compose_file}_exists" "FAIL" "File not found"
        fi
    done
}

# Validate environment configuration
validate_environment() {
    log "INFO" "=== Validating Environment Configuration ==="

    # Check .env.example exists
    if [ -f "$PROJECT_ROOT/.env.example" ]; then
        record_test_result "env_example_exists" "PASS" ".env.example found"
    else
        record_test_result "env_example_exists" "FAIL" ".env.example not found"
    fi

    # Check .env exists
    if [ -f "$PROJECT_ROOT/.env" ]; then
        record_test_result "env_file_exists" "PASS" ".env file found"

        # Load .env for testing
        set -a
        source "$PROJECT_ROOT/.env" 2>/dev/null || true
        set +a

        # Check critical variables
        local critical_vars=("JWT_SECRET" "DB_PASSWORD" "AWS_S3_BUCKET")
        for var in "${critical_vars[@]}"; do
            if [ -n "${!var:-}" ]; then
                record_test_result "env_${var,,}" "PASS" "$var is set"
            else
                record_test_result "env_${var,,}" "FAIL" "$var is not set"
            fi
        done

        # Check password strength
        if [ ${#DB_PASSWORD:-} -gt 12 ]; then
            record_test_result "env_password_strength" "PASS" "Database password length OK"
        else
            record_test_result "env_password_strength" "WARN" "Database password should be longer"
        fi

    else
        record_test_result "env_file_exists" "WARN" ".env file not found (using defaults)"
    fi
}

# Test container builds
test_container_builds() {
    if [ "$SKIP_BUILD" = true ]; then
        log "INFO" "Skipping build tests (--skip-build)"
        return 0
    fi

    log "INFO" "=== Testing Container Builds ==="

    local services_to_test=("${SERVICES[@]}")

    if [ -n "$SPECIFIC_SERVICES" ]; then
        IFS=',' read -ra services_to_test <<< "$SPECIFIC_SERVICES"
    fi

    for service in "${services_to_test[@]}"; do
        log "TEST" "Building $service container"

        # Build with timeout
        if timeout "$TIMEOUT" docker-compose -f docker-compose.yml build "$service" > /dev/null 2>&1; then
            record_test_result "build_${service}" "PASS" "Container built successfully"
        else
            record_test_result "build_${service}" "FAIL" "Container build failed or timed out"
        fi
    done
}

# Test service startup
test_service_startup() {
    log "INFO" "=== Testing Service Startup ==="

    # Start core services first
    log "TEST" "Starting core services..."

    local core_services=("redis" "database")
    for service in "${core_services[@]}"; do
        if docker-compose -f docker-compose.yml up -d "$service" > /dev/null 2>&1; then
            record_test_result "startup_${service}" "PASS" "Service started"
        else
            record_test_result "startup_${service}" "FAIL" "Service failed to start"
        fi
    done

    # Wait for core services to be healthy
    sleep 10

    # Start application services
    log "TEST" "Starting application services..."

    local app_services=("backend" "frontend" "orchestrator")
    for service in "${app_services[@]}"; do
        if docker-compose -f docker-compose.yml up -d "$service" > /dev/null 2>&1; then
            record_test_result "startup_${service}" "PASS" "Service started"
        else
            record_test_result "startup_${service}" "FAIL" "Service failed to start"
        fi
    done
}

# Test health checks
test_health_checks() {
    log "INFO" "=== Testing Health Checks ==="

    local max_wait="$HEALTH_CHECK_TIMEOUT"
    local waited=0

    while [ $waited -lt $max_wait ]; do
        local all_healthy=true

        for service in "${SERVICES[@]}"; do
            local container_id
            container_id=$(docker-compose -f docker-compose.yml ps -q "$service" 2>/dev/null || echo "")

            if [ -n "$container_id" ]; then
                local health_status
                health_status=$(docker inspect --format='{{.State.Health.Status}}' "$container_id" 2>/dev/null || echo "unknown")

                if [ "$health_status" = "healthy" ]; then
                    if [ -z "${TEST_RESULTS[health_${service}]:-}" ]; then
                        record_test_result "health_${service}" "PASS" "Service is healthy"
                    fi
                elif [ "$health_status" = "starting" ]; then
                    all_healthy=false
                elif [ "$health_status" = "unhealthy" ]; then
                    record_test_result "health_${service}" "FAIL" "Service is unhealthy"
                    all_healthy=false
                else
                    # No health check defined, check if container is running
                    local container_status
                    container_status=$(docker inspect --format='{{.State.Status}}' "$container_id" 2>/dev/null || echo "unknown")

                    if [ "$container_status" = "running" ]; then
                        if [ -z "${TEST_RESULTS[health_${service}]:-}" ]; then
                            record_test_result "health_${service}" "WARN" "Running but no health check"
                        fi
                    else
                        record_test_result "health_${service}" "FAIL" "Container not running"
                        all_healthy=false
                    fi
                fi
            else
                record_test_result "health_${service}" "FAIL" "Container not found"
                all_healthy=false
            fi
        done

        if [ "$all_healthy" = true ]; then
            break
        fi

        sleep 5
        waited=$((waited + 5))

        if [ $((waited % 30)) -eq 0 ]; then
            log "INFO" "Waiting for services to become healthy... (${waited}s)"
        fi
    done

    if [ $waited -ge $max_wait ]; then
        log "WARN" "Health check timeout reached after ${max_wait}s"
    fi
}

# Test network connectivity
test_network_connectivity() {
    if [ "$SKIP_NETWORK" = true ]; then
        log "INFO" "Skipping network tests (--skip-network)"
        return 0
    fi

    log "INFO" "=== Testing Network Connectivity ==="

    # Test internal connectivity
    local connectivity_tests=(
        "backend:database:5432"
        "backend:redis:6379"
        "orchestrator:backend:3000"
        "orchestrator:redis:6379"
    )

    for test in "${connectivity_tests[@]}"; do
        local source service port
        source=$(echo "$test" | cut -d':' -f1)
        service=$(echo "$test" | cut -d':' -f2)
        port=$(echo "$test" | cut -d':' -f3)

        log "TEST" "Testing $source -> $service:$port"

        if docker-compose -f docker-compose.yml exec -T "$source" nc -z "$service" "$port" > /dev/null 2>&1; then
            record_test_result "network_${source}_${service}" "PASS" "Connection successful"
        else
            record_test_result "network_${source}_${service}" "FAIL" "Connection failed"
        fi
    done

    # Test external access
    local external_ports=("3000" "80")
    for port in "${external_ports[@]}"; do
        log "TEST" "Testing external access on port $port"

        if curl -f -s --max-time 10 "http://localhost:$port/health" > /dev/null 2>&1; then
            record_test_result "external_port_${port}" "PASS" "Port accessible"
        elif curl -f -s --max-time 10 "http://localhost:$port" > /dev/null 2>&1; then
            record_test_result "external_port_${port}" "PASS" "Port accessible (no health endpoint)"
        else
            record_test_result "external_port_${port}" "FAIL" "Port not accessible"
        fi
    done
}

# Test volume persistence
test_volume_persistence() {
    log "INFO" "=== Testing Volume Persistence ==="

    # Test database persistence
    log "TEST" "Testing database persistence"

    local test_data="docker_validation_test_$(date +%s)"

    if docker-compose -f docker-compose.yml exec -T database psql -U "${DB_USER:-postgres}" -d "${DB_NAME:-video_generation}" -c "CREATE TABLE IF NOT EXISTS test_table (data TEXT); INSERT INTO test_table VALUES ('$test_data');" > /dev/null 2>&1; then

        # Restart database service
        docker-compose -f docker-compose.yml restart database > /dev/null 2>&1
        sleep 10

        # Check if data persists
        if docker-compose -f docker-compose.yml exec -T database psql -U "${DB_USER:-postgres}" -d "${DB_NAME:-video_generation}" -c "SELECT data FROM test_table WHERE data='$test_data';" | grep -q "$test_data"; then
            record_test_result "persistence_database" "PASS" "Data persisted across restart"

            # Clean up test data
            docker-compose -f docker-compose.yml exec -T database psql -U "${DB_USER:-postgres}" -d "${DB_NAME:-video_generation}" -c "DROP TABLE IF EXISTS test_table;" > /dev/null 2>&1 || true
        else
            record_test_result "persistence_database" "FAIL" "Data not persisted"
        fi
    else
        record_test_result "persistence_database" "FAIL" "Could not create test data"
    fi

    # Test Redis persistence
    log "TEST" "Testing Redis persistence"

    if docker-compose -f docker-compose.yml exec -T redis redis-cli SET "test_key" "$test_data" > /dev/null 2>&1; then

        # Restart Redis service
        docker-compose -f docker-compose.yml restart redis > /dev/null 2>&1
        sleep 5

        # Check if data persists
        if docker-compose -f docker-compose.yml exec -T redis redis-cli GET "test_key" | grep -q "$test_data"; then
            record_test_result "persistence_redis" "PASS" "Data persisted across restart"
        else
            record_test_result "persistence_redis" "WARN" "Data not persisted (may be expected for cache)"
        fi

        # Clean up test data
        docker-compose -f docker-compose.yml exec -T redis redis-cli DEL "test_key" > /dev/null 2>&1 || true
    else
        record_test_result "persistence_redis" "FAIL" "Could not create test data"
    fi
}

# Test security configuration
test_security_configuration() {
    if [ "$SKIP_SECURITY" = true ]; then
        log "INFO" "Skipping security tests (--skip-security)"
        return 0
    fi

    log "INFO" "=== Testing Security Configuration ==="

    # Check if containers run as non-root
    for service in "${SERVICES[@]}"; do
        local container_id
        container_id=$(docker-compose -f docker-compose.yml ps -q "$service" 2>/dev/null || echo "")

        if [ -n "$container_id" ]; then
            local user_info
            user_info=$(docker exec "$container_id" id 2>/dev/null || echo "uid=0(root)")

            if echo "$user_info" | grep -q "uid=0(root)"; then
                record_test_result "security_nonroot_${service}" "WARN" "Running as root user"
            else
                record_test_result "security_nonroot_${service}" "PASS" "Running as non-root user"
            fi
        fi
    done

    # Check for exposed secrets in logs
    log "TEST" "Checking for exposed secrets in logs"

    local log_content
    log_content=$(docker-compose -f docker-compose.yml logs 2>/dev/null || echo "")

    local secret_patterns=("password" "secret" "key" "token")
    local secrets_found=false

    for pattern in "${secret_patterns[@]}"; do
        if echo "$log_content" | grep -i "$pattern" | grep -v "REDACTED\|HIDDEN\|\*\*\*" > /dev/null 2>&1; then
            secrets_found=true
            break
        fi
    done

    if [ "$secrets_found" = true ]; then
        record_test_result "security_log_secrets" "WARN" "Potential secrets in logs"
    else
        record_test_result "security_log_secrets" "PASS" "No obvious secrets in logs"
    fi

    # Check port exposure
    log "TEST" "Checking port exposure"

    local exposed_ports
    exposed_ports=$(docker-compose -f docker-compose.yml ps --format "table {{.Service}}\t{{.Ports}}" | grep -v "PORTS" || echo "")

    if echo "$exposed_ports" | grep -q "0.0.0.0"; then
        record_test_result "security_port_exposure" "WARN" "Services exposed on all interfaces"
    else
        record_test_result "security_port_exposure" "PASS" "Services not exposed on all interfaces"
    fi
}

# Test resource limits
test_resource_limits() {
    log "INFO" "=== Testing Resource Limits ==="

    # Check memory limits
    for service in "${SERVICES[@]}"; do
        local container_id
        container_id=$(docker-compose -f docker-compose.yml ps -q "$service" 2>/dev/null || echo "")

        if [ -n "$container_id" ]; then
            local memory_limit
            memory_limit=$(docker stats --no-stream --format "{{.MemPerc}}" "$container_id" 2>/dev/null || echo "N/A")

            if [ "$memory_limit" != "N/A" ]; then
                record_test_result "resources_${service}_memory" "PASS" "Memory usage: $memory_limit"
            else
                record_test_result "resources_${service}_memory" "WARN" "Memory usage not available"
            fi

            # Check if container has resource limits set
            local limits_info
            limits_info=$(docker inspect "$container_id" --format '{{.HostConfig.Memory}}' 2>/dev/null || echo "0")

            if [ "$limits_info" != "0" ]; then
                record_test_result "resources_${service}_limits" "PASS" "Resource limits configured"
            else
                record_test_result "resources_${service}_limits" "WARN" "No resource limits set"
            fi
        fi
    done
}

# Performance tests
test_performance() {
    if [ "$FULL_MODE" != true ]; then
        log "INFO" "Skipping performance tests (use --full for comprehensive testing)"
        return 0
    fi

    log "INFO" "=== Testing Performance ==="

    # Test API response time
    log "TEST" "Testing API response time"

    local start_time end_time response_time
    start_time=$(date +%s%3N)

    if curl -f -s --max-time 10 "http://localhost:3000/health" > /dev/null 2>&1; then
        end_time=$(date +%s%3N)
        response_time=$((end_time - start_time))

        if [ "$response_time" -lt 1000 ]; then
            record_test_result "performance_api_response" "PASS" "Response time: ${response_time}ms"
        if [ "$response_time" -lt 3000 ]; then
            record_test_result "performance_api_response" "WARN" "Response time: ${response_time}ms (slow)"
        else
            record_test_result "performance_api_response" "FAIL" "Response time: ${response_time}ms (too slow)"
        fi
    else
        record_test_result "performance_api_response" "FAIL" "API not responding"
    fi

    # Test concurrent requests
    log "TEST" "Testing concurrent request handling"

    local concurrent_success=0
    local concurrent_total=5

    for i in $(seq 1 $concurrent_total); do
        if curl -f -s --max-time 5 "http://localhost:3000/health" > /dev/null 2>&1 &
        then
            concurrent_success=$((concurrent_success + 1))
        fi
    done

    wait

    if [ "$concurrent_success" -eq "$concurrent_total" ]; then
        record_test_result "performance_concurrent" "PASS" "All $concurrent_total concurrent requests succeeded"
    elif [ "$concurrent_success" -gt 0 ]; then
        record_test_result "performance_concurrent" "WARN" "$concurrent_success/$concurrent_total concurrent requests succeeded"
    else
        record_test_result "performance_concurrent" "FAIL" "No concurrent requests succeeded"
    fi
}

# Generate validation report
generate_report() {
    log "INFO" "=== Generating Validation Report ==="

    mkdir -p "$(dirname "$VALIDATION_REPORT")"

    # Start JSON report
    cat > "$VALIDATION_REPORT" << EOF
{
    "validation_report": {
        "timestamp": "$(date -Iseconds)",
        "environment": {
            "docker_version": "$(docker --version 2>/dev/null || echo 'Not installed')",
            "compose_version": "$(docker-compose --version 2>/dev/null || echo 'Not installed')",
            "system_memory": "$(free -m | awk 'NR==2{printf "%dMB", $2}')",
            "available_memory": "$(free -m | awk 'NR==2{printf "%dMB", $7}')",
            "disk_space": "$(df -h $PROJECT_ROOT | awk 'NR==2 {print $4}')"
        },
        "summary": {
            "total_tests": $TOTAL_TESTS,
            "passed_tests": $PASSED_TESTS,
            "failed_tests": $FAILED_TESTS,
            "warnings": $WARNINGS,
            "success_rate": $(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc -l 2>/dev/null || echo "0")
        },
        "test_results": {
EOF

    # Add individual test results
    local first_test=true
    for test_name in "${!TEST_RESULTS[@]}"; do
        if [ "$first_test" = false ]; then
            echo "," >> "$VALIDATION_REPORT"
        fi
        first_test=false

        local result="${TEST_RESULTS[$test_name]}"
        echo "            \"$test_name\": \"$result\"" >> "$VALIDATION_REPORT"
    done

    # Close JSON
    cat >> "$VALIDATION_REPORT" << EOF
        },
        "recommendations": [
EOF

    # Generate recommendations
    local recommendations=()

    if [ "$FAILED_TESTS" -gt 0 ]; then
        recommendations+=("\"Fix $FAILED_TESTS failed tests before deploying to production\"")
    fi

    if [ "$WARNINGS" -gt 5 ]; then
        recommendations+=("\"Address $WARNINGS warnings to improve deployment quality\"")
    fi

    if [[ "${TEST_RESULTS[memory_available]:-}" == "WARN" ]]; then
        recommendations+=("\"Increase system memory for better performance\"")
    fi

    if [[ "${TEST_RESULTS[disk_space]:-}" == "WARN" ]]; then
        recommendations+=("\"Free up disk space before deployment\"")
    fi

    if [ ${#recommendations[@]} -eq 0 ]; then
        recommendations+=("\"Docker setup validation passed successfully\"")
    fi

    # Add recommendations to report
    local first_rec=true
    for rec in "${recommendations[@]}"; do
        if [ "$first_rec" = false ]; then
            echo "," >> "$VALIDATION_REPORT"
        fi
        first_rec=false
        echo "            $rec" >> "$VALIDATION_REPORT"
    done

    cat >> "$VALIDATION_REPORT" << EOF
        ]
    }
}
EOF

    log "SUCCESS" "Validation report generated: $VALIDATION_REPORT"
}

# Display final results
display_results() {
    log "RESULT" "=== DOCKER SETUP VALIDATION RESULTS ==="

    local success_rate
    success_rate=$(echo "scale=1; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc -l 2>/dev/null || echo "0")

    log "RESULT" "Total Tests: $TOTAL_TESTS"
    log "RESULT" "Passed: $PASSED_TESTS"
    log "RESULT" "Failed: $FAILED_TESTS"
    log "RESULT" "Warnings: $WARNINGS"
    log "RESULT" "Success Rate: ${success_rate}%"

    echo

    if [ "$FAILED_TESTS" -eq 0 ]; then
        log "SUCCESS" "✅ Docker setup validation PASSED!"
        log "SUCCESS" "Your containerized setup is ready for deployment"

        if [ "$WARNINGS" -gt 0 ]; then
            log "WARN" "⚠️  Consider addressing $WARNINGS warnings for optimal setup"
        fi
    else
        log "ERROR" "❌ Docker setup validation FAILED!"
        log "ERROR" "Please fix $FAILED_TESTS failed tests before proceeding"

        # Show critical failures
        log "ERROR" "Critical issues found:"
        for test_name in "${!TEST_RESULTS[@]}"; do
            if [ "${TEST_RESULTS[$test_name]}" = "FAIL" ]; then
                log "ERROR" "  - $test_name"
            fi
        done
    fi

    echo
    log "INFO" "Detailed results saved to:"
    log "INFO" "  Validation report: $VALIDATION_REPORT"
    log "INFO" "  Full logs: $LOG_FILE"

    if [ "$CLEANUP_AFTER" = true ]; then
        log "INFO" "Cleaning up test environment..."
        docker-compose -f docker-compose.yml down --remove-orphans > /dev/null 2>&1 || true
    else
        log "INFO" "Test environment left running for further inspection"
        log "INFO" "Use 'docker-compose -f docker-compose.yml down' to clean up"
    fi

    # Exit with appropriate code
    if [ "$FAILED_TESTS" -gt 0 ]; then
        exit 1
    else
        exit 0
    fi
}

# Main validation workflow
+main() {
    log "INFO" "Starting Docker Setup Validation..."
    log "INFO" "Project Root: $PROJECT_ROOT"
    log "INFO" "Quick Mode: $QUICK_MODE"
    log "INFO" "Full Mode: $FULL_MODE"

    if [ -n "$SPECIFIC_COMPOSE" ]; then
        log "INFO" "Testing specific compose file: $SPECIFIC_COMPOSE"
    fi

    if [ -n "$SPECIFIC_SERVICES" ]; then
        log "INFO" "Testing specific services: $SPECIFIC_SERVICES"
    fi

    echo

    # Change to project directory
    cd "$PROJECT_ROOT"

    # Run validation tests
    check_prerequisites

    if [ "$QUICK_MODE" != true ]; then
        validate_dockerfiles
        validate_compose_files
        validate_environment
        test_container_builds
        test_service_startup
        test_health_checks
        test_network_connectivity
        test_volume_persistence
        test_security_configuration
        test_resource_limits
        test_performance
    else
        log "INFO" "Quick mode - running essential tests only"
        validate_compose_files
        validate_environment
        test_service_startup
        test_health_checks
    fi

    # Generate report
    generate_report

    # Display results
    display_results
}

# Script entry point
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    parse_args "$@"
    main
fi
