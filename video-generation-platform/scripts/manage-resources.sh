#!/bin/bash

# Video Generation Platform - Resource Management Script
# This script manages scaling, optimization, and resource monitoring

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="${PROJECT_ROOT}/logs/resource-management-$(date +%Y%m%d_%H%M%S).log"
PID_FILE="/tmp/video-generation-resource-mgmt.pid"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default configuration
ENVIRONMENT="${ENVIRONMENT:-production}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
MONITORING_INTERVAL="${MONITORING_INTERVAL:-30}"
SCALE_THRESHOLD_CPU="${SCALE_THRESHOLD_CPU:-80}"
SCALE_THRESHOLD_MEMORY="${SCALE_THRESHOLD_MEMORY:-85}"
AUTO_SCALE="${AUTO_SCALE:-false}"
MAX_REPLICAS="${MAX_REPLICAS:-5}"
MIN_REPLICAS="${MIN_REPLICAS:-1}"

# Service categories
SCALABLE_SERVICES=("backend" "frontend" "orchestrator")
CORE_SERVICES=("database" "redis")
MONITORING_SERVICES=("prometheus" "grafana" "node-exporter" "cadvisor")

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
        "METRIC") echo -e "${CYAN}[$timestamp] [$level] $message${NC}" ;;
        *) echo "[$timestamp] [$level] $message" ;;
    esac
}

# Cleanup function
cleanup() {
    log "INFO" "Cleaning up resource management process..."
    rm -f "$PID_FILE"

    # Kill background monitoring if running
    if [ -f "/tmp/resource-monitor.pid" ]; then
        local monitor_pid
        monitor_pid=$(cat "/tmp/resource-monitor.pid" 2>/dev/null || echo "")
        if [ -n "$monitor_pid" ] && kill -0 "$monitor_pid" 2>/dev/null; then
            kill "$monitor_pid" 2>/dev/null || true
        fi
        rm -f "/tmp/resource-monitor.pid"
    fi

    if [ "${1:-}" = "error" ]; then
        log "ERROR" "Resource management failed"
        exit 1
    fi
}

# Signal handlers
trap 'cleanup error' ERR
trap 'cleanup' EXIT INT TERM

# Help function
show_help() {
    cat << EOF
Video Generation Platform - Resource Management Script

Usage: $0 [COMMAND] [OPTIONS]

COMMANDS:
    scale SERVICE REPLICAS    Scale a service to specified replicas
    auto-scale               Enable automatic scaling based on metrics
    monitor                  Real-time resource monitoring
    optimize                 Optimize resource allocation
    stats                    Show resource statistics
    report                   Generate resource usage report
    cleanup                  Clean up unused resources
    recommendations          Get scaling recommendations
    load-test               Run load test and scaling simulation

SCALE OPTIONS:
    --max-replicas N         Maximum replicas for auto-scaling [default: 5]
    --min-replicas N         Minimum replicas for auto-scaling [default: 1]
    --cpu-threshold PCT      CPU threshold for scaling [default: 80]
    --memory-threshold PCT   Memory threshold for scaling [default: 85]
    --scale-up-cooldown SEC  Cooldown period for scale up [default: 300]
    --scale-down-cooldown SEC Cooldown period for scale down [default: 600]

MONITOR OPTIONS:
    --interval SECONDS       Monitoring interval [default: 30]
    --duration SECONDS       Monitoring duration (0 = infinite) [default: 0]
    --alerts                 Enable alerting
    --export FORMAT          Export format (json|csv|prometheus) [default: json]

GENERAL OPTIONS:
    -e, --environment ENV    Environment [default: production]
    -f, --compose-file FILE  Docker Compose file [default: docker-compose.yml]
    --dry-run               Show what would be done
    -v, --verbose           Verbose output
    -h, --help              Show this help

EXAMPLES:
    $0 scale backend 3              # Scale backend to 3 replicas
    $0 auto-scale --max-replicas 5  # Enable auto-scaling with max 5 replicas
    $0 monitor --interval 10        # Monitor resources every 10 seconds
    $0 optimize                     # Optimize current resource allocation
    $0 stats                        # Show current resource usage
    $0 cleanup                      # Clean up unused Docker resources

EOF
}

# Parse command line arguments
parse_args() {
    local command=""
    local service=""
    local replicas=""
    local dry_run=false
    local verbose=false

    if [ $# -eq 0 ]; then
        show_help
        exit 0
    fi

    command="$1"
    shift

    case "$command" in
        scale)
            if [ $# -lt 2 ]; then
                log "ERROR" "Scale command requires service name and replica count"
                exit 1
            fi
            service="$1"
            replicas="$2"
            shift 2
            ;;
        auto-scale|monitor|optimize|stats|report|cleanup|recommendations|load-test)
            # Commands that don't require additional arguments
            ;;
        *)
            log "ERROR" "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac

    # Parse remaining options
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
            --max-replicas)
                MAX_REPLICAS="$2"
                shift 2
                ;;
            --min-replicas)
                MIN_REPLICAS="$2"
                shift 2
                ;;
            --cpu-threshold)
                SCALE_THRESHOLD_CPU="$2"
                shift 2
                ;;
            --memory-threshold)
                SCALE_THRESHOLD_MEMORY="$2"
                shift 2
                ;;
            --interval)
                MONITORING_INTERVAL="$2"
                shift 2
                ;;
            --dry-run)
                dry_run=true
                shift
                ;;
            -v|--verbose)
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

    export COMMAND="$command"
    export SERVICE="$service"
    export REPLICAS="$replicas"
    export DRY_RUN="$dry_run"
    export VERBOSE="$verbose"
}

# Get service resource usage
get_service_stats() {
    local service="$1"

    # Get container IDs for the service
    local containers
    containers=$(docker-compose -f "$COMPOSE_FILE" ps -q "$service" 2>/dev/null || echo "")

    if [ -z "$containers" ]; then
        echo "0,0,0,0" # CPU%, Memory%, Memory Usage, Memory Limit
        return
    fi

    local total_cpu=0
    local total_memory_usage=0
    local total_memory_limit=0
    local container_count=0

    echo "$containers" | while read -r container; do
        if [ -n "$container" ]; then
            local stats
            stats=$(docker stats --no-stream --format "{{.CPUPerc}},{{.MemPerc}},{{.MemUsage}}" "$container" 2>/dev/null || echo "0.00%,0.00%,0B / 0B")

            # Parse CPU percentage
            local cpu_pct
            cpu_pct=$(echo "$stats" | cut -d',' -f1 | sed 's/%//')

            # Parse Memory percentage
            local mem_pct
            mem_pct=$(echo "$stats" | cut -d',' -f2 | sed 's/%//')

            # Parse Memory usage (format: "used / limit")
            local mem_usage
            mem_usage=$(echo "$stats" | cut -d',' -f3)

            echo "$cpu_pct,$mem_pct,$mem_usage"
        fi
    done | head -1  # Return stats for first container as representative
}

# Get system resource overview
get_system_stats() {
    log "INFO" "Gathering system resource statistics..."

    # Docker system info
    local total_containers
    total_containers=$(docker ps -q | wc -l)

    local running_containers
    running_containers=$(docker ps -q --filter "status=running" | wc -l)

    # System resource usage
    local cpu_usage
    cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | sed 's/%us,//' || echo "0")

    local memory_info
    memory_info=$(free -m | awk 'NR==2{printf "%.1f,%.1f,%.1f", $3*100/$2, $3, $2 }')
    local memory_usage_pct=$(echo "$memory_info" | cut -d',' -f1)
    local memory_used=$(echo "$memory_info" | cut -d',' -f2)
    local memory_total=$(echo "$memory_info" | cut -d',' -f3)

    # Disk usage
    local disk_usage
    disk_usage=$(df "$PROJECT_ROOT" | awk 'NR==2 {print $(NF-1)}' | sed 's/%//')

    log "METRIC" "System Overview:"
    log "METRIC" "  Total Containers: $total_containers"
    log "METRIC" "  Running Containers: $running_containers"
    log "METRIC" "  System CPU Usage: ${cpu_usage}%"
    log "METRIC" "  System Memory Usage: ${memory_usage_pct}% (${memory_used}MB / ${memory_total}MB)"
    log "METRIC" "  Disk Usage: ${disk_usage}%"

    echo "$total_containers,$running_containers,$cpu_usage,$memory_usage_pct,$memory_used,$memory_total,$disk_usage"
}

# Scale service
scale_service() {
    local service="$1"
    local target_replicas="$2"

    log "INFO" "Scaling $service to $target_replicas replicas..."

    if [ "$DRY_RUN" = true ]; then
        log "INFO" "[DRY RUN] Would scale $service to $target_replicas replicas"
        return 0
    fi

    # Validate service exists
    if ! docker-compose -f "$COMPOSE_FILE" config --services | grep -q "^${service}$"; then
        log "ERROR" "Service '$service' not found in compose file"
        return 1
    fi

    # Check if service is scalable
    if [[ ! " ${SCALABLE_SERVICES[*]} " =~ " ${service} " ]]; then
        log "WARN" "Service '$service' is not typically scalable"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log "INFO" "Scaling cancelled"
            return 0
        fi
    fi

    # Get current replica count
    local current_replicas
    current_replicas=$(docker-compose -f "$COMPOSE_FILE" ps "$service" | grep -c "Up" || echo "0")

    if [ "$current_replicas" -eq "$target_replicas" ]; then
        log "INFO" "$service already has $target_replicas replicas"
        return 0
    fi

    # Scale the service
    if docker-compose -f "$COMPOSE_FILE" up -d --scale "$service=$target_replicas" "$service"; then
        log "SUCCESS" "$service scaled from $current_replicas to $target_replicas replicas"

        # Wait for health checks
        log "INFO" "Waiting for service health checks..."
        sleep 10

        # Verify scaling
        local new_count
        new_count=$(docker-compose -f "$COMPOSE_FILE" ps "$service" | grep -c "Up" || echo "0")

        if [ "$new_count" -eq "$target_replicas" ]; then
            log "SUCCESS" "Scaling verification successful: $new_count replicas running"
        else
            log "WARN" "Scaling verification failed: expected $target_replicas, got $new_count"
        fi
    else
        log "ERROR" "Failed to scale $service"
        return 1
    fi
}

# Auto-scaling logic
auto_scale_service() {
    local service="$1"
    local current_replicas
    current_replicas=$(docker-compose -f "$COMPOSE_FILE" ps "$service" | grep -c "Up" || echo "0")

    if [ "$current_replicas" -eq 0 ]; then
        log "WARN" "$service is not running, skipping auto-scale"
        return 0
    fi

    # Get service metrics
    local stats
    stats=$(get_service_stats "$service")
    local cpu_pct=$(echo "$stats" | cut -d',' -f1)
    local mem_pct=$(echo "$stats" | cut -d',' -f2)

    # Convert to integers for comparison
    cpu_pct=${cpu_pct%.*}
    mem_pct=${mem_pct%.*}

    local should_scale_up=false
    local should_scale_down=false

    # Scale up conditions
    if [ "$cpu_pct" -gt "$SCALE_THRESHOLD_CPU" ] || [ "$mem_pct" -gt "$SCALE_THRESHOLD_MEMORY" ]; then
        if [ "$current_replicas" -lt "$MAX_REPLICAS" ]; then
            should_scale_up=true
            log "INFO" "$service needs scaling up: CPU=${cpu_pct}%, Memory=${mem_pct}%"
        else
            log "WARN" "$service at maximum replicas but still under load: CPU=${cpu_pct}%, Memory=${mem_pct}%"
        fi
    fi

    # Scale down conditions (conservative thresholds)
    local scale_down_cpu_threshold=$((SCALE_THRESHOLD_CPU / 2))
    local scale_down_mem_threshold=$((SCALE_THRESHOLD_MEMORY / 2))

    if [ "$cpu_pct" -lt "$scale_down_cpu_threshold" ] && [ "$mem_pct" -lt "$scale_down_mem_threshold" ]; then
        if [ "$current_replicas" -gt "$MIN_REPLICAS" ]; then
            should_scale_down=true
            log "INFO" "$service can be scaled down: CPU=${cpu_pct}%, Memory=${mem_pct}%"
        fi
    fi

    # Execute scaling
    if [ "$should_scale_up" = true ]; then
        local new_replicas=$((current_replicas + 1))
        log "INFO" "Auto-scaling $service up: $current_replicas -> $new_replicas"
        scale_service "$service" "$new_replicas"
    elif [ "$should_scale_down" = true ]; then
        local new_replicas=$((current_replicas - 1))
        log "INFO" "Auto-scaling $service down: $current_replicas -> $new_replicas"
        scale_service "$service" "$new_replicas"
    fi
}

# Resource monitoring
monitor_resources() {
    log "INFO" "Starting resource monitoring (interval: ${MONITORING_INTERVAL}s)..."

    # Create monitoring PID file
    echo $$ > "/tmp/resource-monitor.pid"

    local iteration=0
    while true; do
        iteration=$((iteration + 1))
        log "INFO" "=== Monitoring Iteration $iteration ==="

        # System stats
        get_system_stats > /dev/null

        # Service stats
        for service in "${SCALABLE_SERVICES[@]}"; do
            if docker-compose -f "$COMPOSE_FILE" ps "$service" | grep -q "Up"; then
                local stats
                stats=$(get_service_stats "$service")
                local cpu_pct=$(echo "$stats" | cut -d',' -f1)
                local mem_pct=$(echo "$stats" | cut -d',' -f2)
                local mem_usage=$(echo "$stats" | cut -d',' -f3)

                local replicas
                replicas=$(docker-compose -f "$COMPOSE_FILE" ps "$service" | grep -c "Up" || echo "0")

                log "METRIC" "$service (${replicas} replicas): CPU=${cpu_pct}%, Memory=${mem_pct}%, Usage=${mem_usage}"

                # Auto-scaling if enabled
                if [ "$AUTO_SCALE" = true ]; then
                    auto_scale_service "$service"
                fi
            fi
        done

        echo "---"
        sleep "$MONITORING_INTERVAL"
    done
}

# Optimize resource allocation
optimize_resources() {
    log "INFO" "Analyzing current resource allocation for optimization..."

    local recommendations=()

    for service in "${SCALABLE_SERVICES[@]}"; do
        if docker-compose -f "$COMPOSE_FILE" ps "$service" | grep -q "Up"; then
            local stats
            stats=$(get_service_stats "$service")
            local cpu_pct=$(echo "$stats" | cut -d',' -f1)
            local mem_pct=$(echo "$stats" | cut -d',' -f2)
            local replicas
            replicas=$(docker-compose -f "$COMPOSE_FILE" ps "$service" | grep -c "Up" || echo "0")

            # Convert to integers
            cpu_pct=${cpu_pct%.*}
            mem_pct=${mem_pct%.*}

            # Generate recommendations
            if [ "$cpu_pct" -gt 90 ] || [ "$mem_pct" -gt 90 ]; then
                recommendations+=("CRITICAL: $service is overloaded (CPU: ${cpu_pct}%, Memory: ${mem_pct}%) - Consider scaling up")
            elif [ "$cpu_pct" -gt 80 ] || [ "$mem_pct" -gt 80 ]; then
                recommendations+=("WARNING: $service is under high load (CPU: ${cpu_pct}%, Memory: ${mem_pct}%) - Consider scaling up")
            elif [ "$cpu_pct" -lt 20 ] && [ "$mem_pct" -lt 20 ] && [ "$replicas" -gt 1 ]; then
                recommendations+=("INFO: $service is underutilized (CPU: ${cpu_pct}%, Memory: ${mem_pct}%) - Consider scaling down")
            else
                recommendations+=("OK: $service resource usage is optimal (CPU: ${cpu_pct}%, Memory: ${mem_pct}%)")
            fi
        fi
    done

    # Display recommendations
    log "INFO" "Resource Optimization Recommendations:"
    for recommendation in "${recommendations[@]}"; do
        if [[ $recommendation == CRITICAL* ]]; then
            log "ERROR" "$recommendation"
        elif [[ $recommendation == WARNING* ]]; then
            log "WARN" "$recommendation"
        elif [[ $recommendation == OK* ]]; then
            log "SUCCESS" "$recommendation"
        else
            log "INFO" "$recommendation"
        fi
    done

    # Auto-apply optimizations if not dry run
    if [ "$DRY_RUN" != true ]; then
        log "INFO" "Apply optimizations automatically? (y/N)"
        read -r -n 1 response
        echo
        if [[ $response =~ ^[Yy]$ ]]; then
            log "INFO" "Applying automatic optimizations..."
            AUTO_SCALE=true
            for service in "${SCALABLE_SERVICES[@]}"; do
                auto_scale_service "$service"
            done
        fi
    fi
}

# Generate resource report
generate_report() {
    log "INFO" "Generating resource usage report..."

    local report_file="$PROJECT_ROOT/reports/resource-report-$(date +%Y%m%d_%H%M%S).json"
    mkdir -p "$(dirname "$report_file")"

    # Start JSON report
    cat > "$report_file" << EOF
{
    "timestamp": "$(date -Iseconds)",
    "environment": "$ENVIRONMENT",
    "system": {
EOF

    # System stats
    local system_stats
    system_stats=$(get_system_stats)
    local total_containers=$(echo "$system_stats" | cut -d',' -f1)
    local running_containers=$(echo "$system_stats" | cut -d',' -f2)
    local cpu_usage=$(echo "$system_stats" | cut -d',' -f3)
    local memory_usage_pct=$(echo "$system_stats" | cut -d',' -f4)
    local memory_used=$(echo "$system_stats" | cut -d',' -f5)
    local memory_total=$(echo "$system_stats" | cut -d',' -f6)
    local disk_usage=$(echo "$system_stats" | cut -d',' -f7)

    cat >> "$report_file" << EOF
        "total_containers": $total_containers,
        "running_containers": $running_containers,
        "cpu_usage_percent": $cpu_usage,
        "memory_usage_percent": $memory_usage_pct,
        "memory_used_mb": $memory_used,
        "memory_total_mb": $memory_total,
        "disk_usage_percent": $disk_usage
    },
    "services": {
EOF

    # Service stats
    local first_service=true
    for service in "${SCALABLE_SERVICES[@]}"; do
        if docker-compose -f "$COMPOSE_FILE" ps "$service" | grep -q "Up"; then
            if [ "$first_service" = false ]; then
                echo "," >> "$report_file"
            fi
            first_service=false

            local stats
            stats=$(get_service_stats "$service")
            local cpu_pct=$(echo "$stats" | cut -d',' -f1)
            local mem_pct=$(echo "$stats" | cut -d',' -f2)
            local mem_usage=$(echo "$stats" | cut -d',' -f3)
            local replicas
            replicas=$(docker-compose -f "$COMPOSE_FILE" ps "$service" | grep -c "Up" || echo "0")

            cat >> "$report_file" << EOF
        "$service": {
            "replicas": $replicas,
            "cpu_usage_percent": $cpu_pct,
            "memory_usage_percent": $mem_pct,
            "memory_usage": "$mem_usage",
            "status": "running"
        }
EOF
        fi
    done

    cat >> "$report_file" << EOF
    }
}
EOF

    log "SUCCESS" "Report generated: $report_file"

    # Display summary
    log "INFO" "Report Summary:"
    log "INFO" "  System CPU: ${cpu_usage}%"
    log "INFO" "  System Memory: ${memory_usage_pct}%"
    log "INFO" "  Running Containers: ${running_containers}/${total_containers}"
    log "INFO" "  Full report: $report_file"
}

# Clean up unused resources
cleanup_resources() {
    log "INFO" "Cleaning up unused Docker resources..."

    if [ "$DRY_RUN" = true ]; then
        log "INFO" "[DRY RUN] Would clean up unused resources"
        return 0
    fi

    # Show current usage
    log "INFO" "Current Docker resource usage:"
    docker system df

    # Ask for confirmation
    log "WARN" "This will remove unused containers, networks, images, and build cache"
    read -p "Continue? (y/N): " -r
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "INFO" "Cleanup cancelled"
        return 0
    fi

    # Clean up
    log "INFO" "Removing stopped containers..."
    docker container prune -f

    log "INFO" "Removing unused networks..."
    docker network prune -f

    log "INFO" "Removing unused images..."
    docker image prune -f

    log "INFO" "Removing build cache..."
    docker builder prune -f

    log "INFO" "Removing unused volumes (be careful!)..."
    read -p "Remove unused volumes? This may delete data! (y/N): " -r
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker volume prune -f
        log "WARN" "Unused volumes removed"
    fi

    # Show final usage
    log "INFO" "Resource usage after cleanup:"
    docker system df

    log "SUCCESS" "Resource cleanup completed"
}

# Main function dispatcher
main() {
    # Create PID file
    echo $$ > "$PID_FILE"

    log "INFO" "Starting resource management command: $COMMAND"

    # Change to project directory
    cd "$PROJECT_ROOT"

    # Set compose file based on environment
    if [ "$COMPOSE_FILE" = "docker-compose.yml" ] && [ "$ENVIRONMENT" = "development" ]; then
        COMPOSE_FILE="docker-compose.dev.yml"
    elif [ "$COMPOSE_FILE" = "docker-compose.yml" ] && [ "$ENVIRONMENT" = "production" ]; then
        COMPOSE_FILE="docker-compose.prod.yml"
    fi

    # Check compose file exists
    if [ ! -f "$COMPOSE_FILE" ]; then
        log "ERROR" "Compose file not found: $COMPOSE_FILE"
        exit 1
    fi

    # Execute command
    case "$COMMAND" in
        scale)
            scale_service "$SERVICE" "$REPLICAS"
            ;;
        auto-scale)
            AUTO_SCALE=true
            monitor_resources
            ;;
        monitor)
            monitor_resources
            ;;
        optimize)
            optimize_resources
            ;;
        stats)
            get_system_stats > /dev/null
            for service in "${SCALABLE_SERVICES[@]}"; do
                if docker-compose -f "$COMPOSE_FILE" ps "$service" | grep -q "Up"; then
                    local stats
                    stats=$(get_service_stats "$service")
                    local replicas
                    replicas=$(docker-compose -f "$COMPOSE_FILE" ps "$service" | grep -c "Up" || echo "0")
                    log "METRIC" "$service: $stats (replicas: $replicas)"
                fi
            done
            ;;
        report)
            generate_report
            ;;
        cleanup)
            cleanup_resources
            ;;
        recommendations)
            optimize_resources
            ;;
        load-test)
            log "INFO" "Load testing functionality not implemented yet"
            log "INFO" "Consider using tools like Apache Bench or wrk for load testing"
            ;;
        *)
            log "ERROR" "Unknown command: $COMMAND"
            exit 1
            ;;
    esac

    log "SUCCESS" "Resource management command completed: $COMMAND"
}

# Script entry point
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    parse_args "$@"
    main
fi
