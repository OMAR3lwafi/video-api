#!/bin/bash

# Video Generation Platform - Container Shutdown Script
# This script orchestrates the graceful shutdown of all services

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="${PROJECT_ROOT}/logs/shutdown-$(date +%Y%m%d_%H%M%S).log"
PID_FILE="/tmp/video-generation-shutdown.pid"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
ENVIRONMENT="${ENVIRONMENT:-production}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
TIMEOUT="${TIMEOUT:-30}"
GRACEFUL_TIMEOUT="${GRACEFUL_TIMEOUT:-10}"
FORCE_SHUTDOWN="${FORCE_SHUTDOWN:-false}"
CLEANUP_VOLUMES="${CLEANUP_VOLUMES:-false}"
CLEANUP_NETWORKS="${CLEANUP_NETWORKS:-false}"
BACKUP_DATA="${BACKUP_DATA:-false}"

# Service shutdown order (reverse of startup)
MONITORING_SERVICES=("cadvisor" "node-exporter" "grafana" "prometheus")
OPTIONAL_SERVICES=("minio")
FRONTEND_SERVICES=("frontend")
BACKEND_SERVICES=("orchestrator" "backend")
CORE_SERVICES=("database" "redis")

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
    log "INFO" "Cleaning up shutdown process..."
    rm -f "$PID_FILE"

    if [ "${1:-}" = "error" ]; then
        log "ERROR" "Shutdown encountered errors. Some services may still be running."
        log "INFO" "Run with --force to forcefully stop all containers"
        exit 1
    fi
}

# Signal handlers
trap 'cleanup error' ERR
trap 'cleanup' EXIT INT TERM

# Help function
show_help() {
    cat << EOF
Video Generation Platform - Container Shutdown Script

Usage: $0 [OPTIONS]

OPTIONS:
    -e, --environment ENV       Environment (development|production) [default: production]
    -f, --compose-file FILE     Docker Compose file [default: docker-compose.yml]
    -t, --timeout SECONDS       Service shutdown timeout [default: 30]
    -g, --graceful-timeout SEC  Graceful shutdown timeout [default: 10]
    --force                     Force shutdown without graceful termination
    --cleanup-volumes          Remove named volumes (WARNING: Data loss!)
    --cleanup-networks         Remove custom networks
    --backup                   Backup database before shutdown
    --services SERVICES        Comma-separated list of specific services to stop
    --exclude SERVICES         Comma-separated list of services to exclude
    --dry-run                  Show what would be done without executing
    -q, --quiet                Minimize output
    -v, --verbose              Verbose output
    -h, --help                 Show this help message

ENVIRONMENT VARIABLES:
    ENVIRONMENT               Target environment
    COMPOSE_FILE             Docker Compose file path
    TIMEOUT                  Service shutdown timeout
    GRACEFUL_TIMEOUT         Graceful shutdown timeout
    FORCE_SHUTDOWN           Enable force shutdown
    CLEANUP_VOLUMES          Cleanup volumes after shutdown
    CLEANUP_NETWORKS         Cleanup networks after shutdown
    BACKUP_DATA              Backup data before shutdown

EXAMPLES:
    $0                        # Graceful shutdown of all services
    $0 --force                # Force shutdown all services
    $0 --cleanup-volumes      # Shutdown and remove all data
    $0 --services backend,redis  # Stop only specific services
    $0 --backup --cleanup-volumes  # Backup then clean shutdown
    $0 --dry-run              # Show shutdown plan without executing

WARNING:
    --cleanup-volumes will permanently delete all data!
    --force may cause data corruption in databases!

EOF
}

# Parse command line arguments
parse_args() {
    local services_filter=""
    local exclude_filter=""
    local dry_run=false
    local quiet=false
    local verbose=false

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
            -g|--graceful-timeout)
                GRACEFUL_TIMEOUT="$2"
                shift 2
                ;;
            --force)
                FORCE_SHUTDOWN=true
                shift
                ;;
            --cleanup-volumes)
                CLEANUP_VOLUMES=true
                shift
                ;;
            --cleanup-networks)
                CLEANUP_NETWORKS=true
                shift
                ;;
            --backup)
                BACKUP_DATA=true
                shift
                ;;
            --services)
                services_filter="$2"
                shift 2
                ;;
            --exclude)
                exclude_filter="$2"
                shift 2
                ;;
            --dry-run)
                dry_run=true
                shift
                ;;
            -q|--quiet)
                quiet=true
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

    # Set compose file based on environment if not explicitly provided
    if [ "$COMPOSE_FILE" = "docker-compose.yml" ] && [ "$ENVIRONMENT" = "development" ]; then
        COMPOSE_FILE="docker-compose.dev.yml"
    elif [ "$COMPOSE_FILE" = "docker-compose.yml" ] && [ "$ENVIRONMENT" = "production" ]; then
        COMPOSE_FILE="docker-compose.prod.yml"
    fi

    # Build service list based on filters
    ALL_SERVICES=()
    if [ -n "$services_filter" ]; then
        IFS=',' read -ra ADDR <<< "$services_filter"
        ALL_SERVICES=("${ADDR[@]}")
    else
        ALL_SERVICES=("${MONITORING_SERVICES[@]}" "${OPTIONAL_SERVICES[@]}" "${FRONTEND_SERVICES[@]}" "${BACKEND_SERVICES[@]}" "${CORE_SERVICES[@]}")

        # Remove excluded services
        if [ -n "$exclude_filter" ]; then
            IFS=',' read -ra EXCLUDED <<< "$exclude_filter"
            for exclude in "${EXCLUDED[@]}"; do
                ALL_SERVICES=(${ALL_SERVICES[@]/$exclude})
            done
        fi
    fi

    export DRY_RUN="$dry_run"
    export QUIET="$quiet"
    export VERBOSE="$verbose"
}

# Check running services
check_running_services() {
    log "INFO" "Checking running services..."

    if [ ! -f "$PROJECT_ROOT/$COMPOSE_FILE" ]; then
        log "ERROR" "Compose file not found: $PROJECT_ROOT/$COMPOSE_FILE"
        return 1
    fi

    cd "$PROJECT_ROOT"

    local running_services
    running_services=$(docker-compose -f "$COMPOSE_FILE" ps --services --filter "status=running" 2>/dev/null || echo "")

    if [ -z "$running_services" ]; then
        log "INFO" "No running services found"
        return 0
    fi

    log "INFO" "Running services detected:"
    echo "$running_services" | while read -r service; do
        [ -n "$service" ] && log "INFO" "  - $service"
    done

    export RUNNING_SERVICES="$running_services"
}

# Backup database
backup_database() {
    if [ "$BACKUP_DATA" != true ]; then
        return 0
    fi

    log "INFO" "Creating database backup..."

    if [ "$DRY_RUN" = true ]; then
        log "INFO" "[DRY RUN] Would create database backup"
        return 0
    fi

    local backup_dir="$PROJECT_ROOT/backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"

    # Check if database service is running
    if docker-compose -f "$COMPOSE_FILE" ps database | grep -q "Up"; then
        log "INFO" "Backing up PostgreSQL database..."

        docker-compose -f "$COMPOSE_FILE" exec -T database pg_dumpall -U "${DB_USER:-postgres}" > "$backup_dir/database_backup.sql" || {
            log "WARN" "Database backup failed, continuing with shutdown"
        }

        log "SUCCESS" "Database backup saved to: $backup_dir/database_backup.sql"
    fi

    # Backup Redis data
    if docker-compose -f "$COMPOSE_FILE" ps redis | grep -q "Up"; then
        log "INFO" "Backing up Redis data..."

        docker-compose -f "$COMPOSE_FILE" exec -T redis redis-cli BGSAVE || {
            log "WARN" "Redis backup failed, continuing with shutdown"
        }

        # Copy Redis dump
        local redis_container
        redis_container=$(docker-compose -f "$COMPOSE_FILE" ps -q redis)
        if [ -n "$redis_container" ]; then
            docker cp "$redis_container:/data/dump.rdb" "$backup_dir/redis_dump.rdb" || true
            log "SUCCESS" "Redis backup saved to: $backup_dir/redis_dump.rdb"
        fi
    fi

    log "SUCCESS" "Backup completed: $backup_dir"
}

# Graceful service shutdown
stop_service() {
    local service="$1"
    local timeout="${2:-$GRACEFUL_TIMEOUT}"

    if [ "$DRY_RUN" = true ]; then
        log "INFO" "[DRY RUN] Would stop service: $service"
        return 0
    fi

    # Check if service is running
    if ! docker-compose -f "$COMPOSE_FILE" ps "$service" | grep -q "Up"; then
        log "INFO" "$service is not running"
        return 0
    fi

    log "INFO" "Stopping $service (timeout: ${timeout}s)..."

    if [ "$FORCE_SHUTDOWN" = true ]; then
        # Force stop
        docker-compose -f "$COMPOSE_FILE" kill "$service"
        docker-compose -f "$COMPOSE_FILE" rm -f "$service"
        log "SUCCESS" "$service force stopped"
    else
        # Graceful stop
        if timeout "$timeout" docker-compose -f "$COMPOSE_FILE" stop "$service"; then
            log "SUCCESS" "$service stopped gracefully"
        else
            log "WARN" "$service did not stop gracefully, killing..."
            docker-compose -f "$COMPOSE_FILE" kill "$service"
            docker-compose -f "$COMPOSE_FILE" rm -f "$service"
            log "SUCCESS" "$service killed"
        fi
    fi

    # Verify service is stopped
    if docker-compose -f "$COMPOSE_FILE" ps "$service" | grep -q "Up"; then
        log "ERROR" "$service is still running"
        return 1
    fi
}

# Stop service group
stop_service_group() {
    local group_name="$1"
    shift
    local services=("$@")

    log "INFO" "Stopping $group_name services: ${services[*]}"

    for service in "${services[@]}"; do
        # Skip if service not in filter
        if [[ " ${ALL_SERVICES[*]} " =~ " ${service} " ]]; then
            stop_service "$service"
        else
            log "INFO" "Skipping $service (not in service filter)"
        fi
    done

    log "SUCCESS" "$group_name services stopped"
}

# Wait for service to stop
wait_for_service_stop() {
    local service="$1"
    local max_wait="${2:-30}"
    local waited=0

    while [ $waited -lt $max_wait ]; do
        if ! docker-compose -f "$COMPOSE_FILE" ps "$service" | grep -q "Up"; then
            return 0
        fi

        sleep 1
        waited=$((waited + 1))

        if [ $((waited % 5)) -eq 0 ]; then
            log "INFO" "Waiting for $service to stop... (${waited}s)"
        fi
    done

    log "WARN" "$service did not stop within ${max_wait}s"
    return 1
}

# Cleanup resources
cleanup_resources() {
    log "INFO" "Cleaning up Docker resources..."

    if [ "$DRY_RUN" = true ]; then
        log "INFO" "[DRY RUN] Would cleanup resources"
        return 0
    fi

    # Remove containers
    log "INFO" "Removing stopped containers..."
    docker-compose -f "$COMPOSE_FILE" rm -f || true

    # Remove volumes if requested
    if [ "$CLEANUP_VOLUMES" = true ]; then
        log "WARN" "Removing volumes - THIS WILL DELETE ALL DATA!"
        read -p "Are you sure you want to remove all volumes? (yes/no): " -r
        if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            docker-compose -f "$COMPOSE_FILE" down -v
            log "SUCCESS" "Volumes removed"
        else
            log "INFO" "Volume cleanup cancelled"
        fi
    fi

    # Remove networks if requested
    if [ "$CLEANUP_NETWORKS" = true ]; then
        log "INFO" "Removing custom networks..."
        docker-compose -f "$COMPOSE_FILE" down --remove-orphans

        # Remove additional networks
        local networks=("video-generation-network")
        for network in "${networks[@]}"; do
            if docker network ls | grep -q "$network"; then
                docker network rm "$network" 2>/dev/null || log "WARN" "Could not remove network: $network"
            fi
        done

        log "SUCCESS" "Networks cleaned up"
    fi

    # Clean up unused images
    log "INFO" "Cleaning up unused Docker images..."
    docker image prune -f || true

    log "SUCCESS" "Resource cleanup completed"
}

# Show final status
show_final_status() {
    log "INFO" "Final service status:"

    if [ "$DRY_RUN" != true ]; then
        cd "$PROJECT_ROOT"
        docker-compose -f "$COMPOSE_FILE" ps || true

        # Check for any still running containers
        local still_running
        still_running=$(docker-compose -f "$COMPOSE_FILE" ps --services --filter "status=running" 2>/dev/null || echo "")

        if [ -n "$still_running" ]; then
            log "WARN" "Some services are still running:"
            echo "$still_running" | while read -r service; do
                [ -n "$service" ] && log "WARN" "  - $service"
            done
        else
            log "SUCCESS" "All services stopped successfully"
        fi
    fi

    # Show resource usage
    log "INFO" "System resource usage:"
    docker system df 2>/dev/null || true
}

# Send shutdown signals to services
send_shutdown_signals() {
    log "INFO" "Sending shutdown signals to services..."

    if [ "$DRY_RUN" = true ]; then
        log "INFO" "[DRY RUN] Would send shutdown signals"
        return 0
    fi

    # Send SIGTERM to all containers
    local containers
    containers=$(docker-compose -f "$COMPOSE_FILE" ps -q 2>/dev/null || echo "")

    if [ -n "$containers" ]; then
        echo "$containers" | xargs -r docker kill --signal=SIGTERM 2>/dev/null || true
        log "INFO" "SIGTERM sent to all containers"

        # Wait a bit for graceful shutdown
        sleep 5

        # Send SIGKILL to any remaining containers if force shutdown
        if [ "$FORCE_SHUTDOWN" = true ]; then
            containers=$(docker-compose -f "$COMPOSE_FILE" ps -q 2>/dev/null || echo "")
            if [ -n "$containers" ]; then
                echo "$containers" | xargs -r docker kill --signal=SIGKILL 2>/dev/null || true
                log "INFO" "SIGKILL sent to remaining containers"
            fi
        fi
    fi
}

# Main shutdown sequence
main() {
    # Create PID file
    echo $$ > "$PID_FILE"

    log "INFO" "Starting Video Generation Platform shutdown..."
    log "INFO" "Environment: $ENVIRONMENT"
    log "INFO" "Compose file: $COMPOSE_FILE"
    log "INFO" "Log file: $LOG_FILE"
    log "INFO" "Force shutdown: $FORCE_SHUTDOWN"
    log "INFO" "Cleanup volumes: $CLEANUP_VOLUMES"
    log "INFO" "Backup data: $BACKUP_DATA"

    if [ "$DRY_RUN" = true ]; then
        log "INFO" "DRY RUN MODE - No actual changes will be made"
    fi

    # Change to project directory
    cd "$PROJECT_ROOT"

    # Check what's running
    check_running_services

    # Create backup if requested
    backup_database

    # Send initial shutdown signals
    send_shutdown_signals

    # Stop services in order (reverse of startup)
    stop_service_group "Monitoring" "${MONITORING_SERVICES[@]}"
    stop_service_group "Optional" "${OPTIONAL_SERVICES[@]}"
    stop_service_group "Frontend" "${FRONTEND_SERVICES[@]}"
    stop_service_group "Backend" "${BACKEND_SERVICES[@]}"
    stop_service_group "Core" "${CORE_SERVICES[@]}"

    # Final cleanup
    if [ "$DRY_RUN" != true ]; then
        log "INFO" "Performing final cleanup..."
        docker-compose -f "$COMPOSE_FILE" down --remove-orphans
    fi

    # Clean up resources if requested
    cleanup_resources

    # Show final status
    show_final_status

    log "SUCCESS" "Video Generation Platform shutdown completed!"
    log "INFO" "Shutdown completed in $SECONDS seconds"

    # Show next steps
    cat << EOF

=== SHUTDOWN COMPLETED ===
Services have been stopped successfully.

To restart the platform:
  ./scripts/start-containers.sh

To check for any remaining containers:
  docker ps -a

To clean up system resources:
  docker system prune

Logs saved to: $LOG_FILE
EOF
}

# Script entry point
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    parse_args "$@"
    main
fi
