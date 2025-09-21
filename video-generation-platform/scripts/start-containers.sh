#!/bin/bash

# Video Generation Platform - Container Startup Script
# This script orchestrates the startup of all services with proper dependency management

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="${PROJECT_ROOT}/logs/startup-$(date +%Y%m%d_%H%M%S).log"
PID_FILE="/tmp/video-generation-startup.pid"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
ENVIRONMENT="${ENVIRONMENT:-production}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
TIMEOUT="${TIMEOUT:-300}"
HEALTH_CHECK_INTERVAL="${HEALTH_CHECK_INTERVAL:-5}"
MAX_RETRIES="${MAX_RETRIES:-10}"
PARALLEL_START="${PARALLEL_START:-false}"

# Service startup order
CORE_SERVICES=("redis" "database")
BACKEND_SERVICES=("backend" "orchestrator")
FRONTEND_SERVICES=("frontend")
MONITORING_SERVICES=("prometheus" "grafana" "node-exporter" "cadvisor")
OPTIONAL_SERVICES=("minio")

# Logging functions
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    # Create logs directory if it doesn't exist
    mkdir -p "$(dirname "$LOG_FILE")"

    # Log to file and stdout
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"

    # Color output for terminal
    case "$level" in
        "ERROR") echo -e "${RED}[$timestamp] [$level] $message${NC}" >&2 ;;
        "WARN")  echo -e "${YELLOW}[$timestamp] [$level] $message${NC}" ;;
        "INFO")  echo -e "${BLUE}[$timestamp] [$level] $message${NC}" ;;
        "SUCCESS") echo -e "${GREEN}[$timestamp] [$level] $message${NC}" ;;
        *) echo "[$timestamp] [$level] $message" ;;
    esac
}

# Cleanup function
cleanup() {
    log "INFO" "Cleaning up startup process..."
    rm -f "$PID_FILE"

    if [ "${1:-}" = "error" ]; then
        log "ERROR" "Startup failed. Stopping any running containers..."
        docker-compose -f "$COMPOSE_FILE" down --remove-orphans
        exit 1
    fi
}

# Signal handlers
trap 'cleanup error' ERR
trap 'cleanup' EXIT INT TERM

# Help function
show_help() {
    cat << EOF
Video Generation Platform - Container Startup Script

Usage: $0 [OPTIONS]

OPTIONS:
    -e, --environment ENV       Environment (development|production) [default: production]
    -f, --compose-file FILE     Docker Compose file [default: docker-compose.yml]
    -t, --timeout SECONDS       Health check timeout [default: 300]
    -i, --interval SECONDS      Health check interval [default: 5]
    -r, --retries COUNT         Max retries for health checks [default: 10]
    -p, --parallel              Start services in parallel where possible
    -m, --monitoring            Include monitoring services
    -o, --optional              Include optional services (MinIO, etc.)
    --dry-run                   Show what would be done without executing
    -h, --help                  Show this help message

ENVIRONMENT VARIABLES:
    ENVIRONMENT                 Target environment
    COMPOSE_FILE               Docker Compose file path
    TIMEOUT                    Health check timeout
    HEALTH_CHECK_INTERVAL      Health check interval
    MAX_RETRIES               Maximum health check retries
    PARALLEL_START            Enable parallel startup

EXAMPLES:
    $0                         # Start production environment
    $0 -e development          # Start development environment
    $0 -f docker-compose.dev.yml -m -o  # Start dev with monitoring and optional services
    $0 --dry-run               # Show startup plan without executing

EOF
}

# Parse command line arguments
parse_args() {
    local include_monitoring=false
    local include_optional=false
    local dry_run=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -f|--compose-file)
                COMPOSE_FILE="$2"
                shift 2
                ;;
            -t|--timeout)
                TIMEOUT="$2"
                shift 2
                ;;
            -i|--interval)
                HEALTH_CHECK_INTERVAL="$2"
                shift 2
                ;;
            -r|--retries)
                MAX_RETRIES="$2"
                shift 2
                ;;
            -p|--parallel)
                PARALLEL_START=true
                shift
                ;;
            -m|--monitoring)
                include_monitoring=true
                shift
                ;;
            -o|--optional)
                include_optional=true
                shift
                ;;
            --dry-run)
                dry_run=true
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

    # Build service list based on options
    ALL_SERVICES=("${CORE_SERVICES[@]}" "${BACKEND_SERVICES[@]}" "${FRONTEND_SERVICES[@]}")

    if [ "$include_monitoring" = true ]; then
        ALL_SERVICES+=("${MONITORING_SERVICES[@]}")
    fi

    if [ "$include_optional" = true ]; then
        ALL_SERVICES+=("${OPTIONAL_SERVICES[@]}")
    fi

    # Set compose file based on environment if not explicitly provided
    if [ "$COMPOSE_FILE" = "docker-compose.yml" ] && [ "$ENVIRONMENT" = "development" ]; then
        COMPOSE_FILE="docker-compose.dev.yml"
    elif [ "$COMPOSE_FILE" = "docker-compose.yml" ] && [ "$ENVIRONMENT" = "production" ]; then
        COMPOSE_FILE="docker-compose.prod.yml"
    fi

    export DRY_RUN="$dry_run"
    export INCLUDE_MONITORING="$include_monitoring"
    export INCLUDE_OPTIONAL="$include_optional"
}

# Prerequisites check
check_prerequisites() {
    log "INFO" "Checking prerequisites..."

    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        log "ERROR" "Docker is not running or not accessible"
        return 1
    fi

    # Check Docker Compose
    if ! command -v docker-compose > /dev/null 2>&1; then
        log "ERROR" "Docker Compose is not installed"
        return 1
    fi

    # Check compose file exists
    if [ ! -f "$PROJECT_ROOT/$COMPOSE_FILE" ]; then
        log "ERROR" "Compose file not found: $PROJECT_ROOT/$COMPOSE_FILE"
        return 1
    fi

    # Check environment file
    local env_file="$PROJECT_ROOT/.env"
    if [ ! -f "$env_file" ]; then
        log "WARN" "Environment file not found: $env_file"
        log "WARN" "Using default environment variables"
    else
        log "INFO" "Loading environment from: $env_file"
        set -a
        # shellcheck source=/dev/null
        source "$env_file"
        set +a
    fi

    # Check required environment variables
    local required_vars=("AWS_S3_BUCKET" "JWT_SECRET")
    for var in "${required_vars[@]}"; do
        if [ -z "${!var:-}" ]; then
            log "WARN" "Required environment variable not set: $var"
        fi
    done

    # Check disk space
    local available_space
    available_space=$(df "$PROJECT_ROOT" | awk 'NR==2 {print $4}')
    local required_space=1048576 # 1GB in KB

    if [ "$available_space" -lt "$required_space" ]; then
        log "WARN" "Low disk space: $(($available_space / 1024))MB available, 1GB recommended"
    fi

    log "SUCCESS" "Prerequisites check completed"
}

# Service health check
wait_for_service_health() {
    local service="$1"
    local retries=0

    log "INFO" "Waiting for $service to become healthy..."

    while [ $retries -lt $MAX_RETRIES ]; do
        if docker-compose -f "$COMPOSE_FILE" ps "$service" | grep -q "healthy\|Up"; then
            # Additional health check using docker health status
            local health_status
            health_status=$(docker-compose -f "$COMPOSE_FILE" ps -q "$service" | xargs -I {} docker inspect --format='{{.State.Health.Status}}' {} 2>/dev/null || echo "unknown")

            if [ "$health_status" = "healthy" ] || [ "$health_status" = "unknown" ]; then
                log "SUCCESS" "$service is healthy"
                return 0
            fi
        fi

        retries=$((retries + 1))
        log "INFO" "Waiting for $service health check ($retries/$MAX_RETRIES)..."
        sleep $HEALTH_CHECK_INTERVAL
    done

    log "ERROR" "$service failed health check after $MAX_RETRIES attempts"

    # Show service logs for debugging
    log "INFO" "Last 20 lines of $service logs:"
    docker-compose -f "$COMPOSE_FILE" logs --tail=20 "$service" | tee -a "$LOG_FILE"

    return 1
}

# Start service group
start_service_group() {
    local group_name="$1"
    shift
    local services=("$@")

    log "INFO" "Starting $group_name services: ${services[*]}"

    if [ "$DRY_RUN" = true ]; then
        log "INFO" "[DRY RUN] Would start: ${services[*]}"
        return 0
    fi

    if [ "$PARALLEL_START" = true ]; then
        # Start services in parallel
        for service in "${services[@]}"; do
            (
                log "INFO" "Starting $service..."
                docker-compose -f "$COMPOSE_FILE" up -d "$service"
                wait_for_service_health "$service"
            ) &
        done

        # Wait for all background jobs to complete
        wait
    else
        # Start services sequentially
        for service in "${services[@]}"; do
            log "INFO" "Starting $service..."
            docker-compose -f "$COMPOSE_FILE" up -d "$service"
            wait_for_service_health "$service"
        done
    fi

    log "SUCCESS" "$group_name services started successfully"
}

# Network setup
setup_networks() {
    log "INFO" "Setting up Docker networks..."

    if [ "$DRY_RUN" = true ]; then
        log "INFO" "[DRY RUN] Would create networks"
        return 0
    fi

    # Create external networks if they don't exist
    local networks=("video-generation-network")

    for network in "${networks[@]}"; do
        if ! docker network ls | grep -q "$network"; then
            log "INFO" "Creating network: $network"
            docker network create "$network" || true
        fi
    done
}

# Volume setup
setup_volumes() {
    log "INFO" "Setting up Docker volumes..."

    if [ "$DRY_RUN" = true ]; then
        log "INFO" "[DRY RUN] Would create volumes"
        return 0
    fi

    # Pre-create volumes to set proper permissions
    local volumes=(
        "video-generation-redis-data"
        "video-generation-postgres-data"
        "video-generation-backend-logs"
        "video-generation-prometheus-data"
        "video-generation-grafana-data"
    )

    for volume in "${volumes[@]}"; do
        if ! docker volume ls | grep -q "$volume"; then
            log "INFO" "Creating volume: $volume"
            docker volume create "$volume" || true
        fi
    done
}

# Main startup sequence
main() {
    # Create PID file
    echo $$ > "$PID_FILE"

    log "INFO" "Starting Video Generation Platform containers..."
    log "INFO" "Environment: $ENVIRONMENT"
    log "INFO" "Compose file: $COMPOSE_FILE"
    log "INFO" "Log file: $LOG_FILE"

    if [ "$DRY_RUN" = true ]; then
        log "INFO" "DRY RUN MODE - No actual changes will be made"
    fi

    # Change to project directory
    cd "$PROJECT_ROOT"

    # Run checks
    check_prerequisites

    # Setup infrastructure
    setup_networks
    setup_volumes

    # Pull latest images
    if [ "$DRY_RUN" != true ]; then
        log "INFO" "Pulling latest Docker images..."
        docker-compose -f "$COMPOSE_FILE" pull --quiet
    fi

    # Start services in order
    start_service_group "Core" "${CORE_SERVICES[@]}"
    start_service_group "Backend" "${BACKEND_SERVICES[@]}"
    start_service_group "Frontend" "${FRONTEND_SERVICES[@]}"

    if [ "$INCLUDE_MONITORING" = true ]; then
        start_service_group "Monitoring" "${MONITORING_SERVICES[@]}"
    fi

    if [ "$INCLUDE_OPTIONAL" = true ]; then
        start_service_group "Optional" "${OPTIONAL_SERVICES[@]}"
    fi

    # Final health check
    log "INFO" "Running final system health check..."

    if [ "$DRY_RUN" != true ]; then
        sleep 10  # Allow services to fully initialize

        # Check all services are running
        local failed_services=()
        for service in "${ALL_SERVICES[@]}"; do
            if ! docker-compose -f "$COMPOSE_FILE" ps "$service" | grep -q "Up"; then
                failed_services+=("$service")
            fi
        done

        if [ ${#failed_services[@]} -gt 0 ]; then
            log "ERROR" "Some services failed to start: ${failed_services[*]}"
            return 1
        fi
    fi

    # Show service status
    log "INFO" "Service status:"
    if [ "$DRY_RUN" != true ]; then
        docker-compose -f "$COMPOSE_FILE" ps
    fi

    # Show access URLs
    log "INFO" "Service URLs:"
    log "INFO" "  Frontend: http://localhost:${FRONTEND_HTTP_PORT:-80}"
    log "INFO" "  Backend API: http://localhost:${BACKEND_PORT:-3000}"
    log "INFO" "  Orchestrator: http://localhost:${ORCHESTRATOR_PORT:-9000}"

    if [ "$INCLUDE_MONITORING" = true ]; then
        log "INFO" "  Prometheus: http://localhost:${PROMETHEUS_PORT:-9090}"
        log "INFO" "  Grafana: http://localhost:${GRAFANA_PORT:-3001}"
    fi

    if [ "$INCLUDE_OPTIONAL" = true ]; then
        log "INFO" "  MinIO Console: http://localhost:${MINIO_CONSOLE_PORT:-9002}"
    fi

    log "SUCCESS" "Video Generation Platform started successfully!"
    log "INFO" "Startup completed in $SECONDS seconds"

    # Show next steps
    cat << EOF

=== NEXT STEPS ===
1. Verify all services are healthy: docker-compose -f $COMPOSE_FILE ps
2. Check logs: docker-compose -f $COMPOSE_FILE logs -f
3. Run health checks: curl http://localhost:${BACKEND_PORT:-3000}/health
4. Monitor resources: docker stats

=== STOPPING SERVICES ===
To stop all services: docker-compose -f $COMPOSE_FILE down
To stop with volumes: docker-compose -f $COMPOSE_FILE down -v

Logs saved to: $LOG_FILE
EOF
}

# Script entry point
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    parse_args "$@"
    main
fi
