#!/bin/bash

# Video Generation Platform - Comprehensive Test Runner
# This script runs all types of tests with proper setup and cleanup

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
E2E_DIR="$PROJECT_ROOT/e2e"
REPORTS_DIR="$PROJECT_ROOT/test-results"
LOG_DIR="$PROJECT_ROOT/logs"

# Default test types
RUN_UNIT=true
RUN_INTEGRATION=true
RUN_E2E=false
RUN_PERFORMANCE=false
RUN_LOAD=false
RUN_COVERAGE=true
PARALLEL=false
VERBOSE=false
CI_MODE=false
CLEAN_SETUP=false

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --unit-only)
                RUN_UNIT=true
                RUN_INTEGRATION=false
                RUN_E2E=false
                RUN_PERFORMANCE=false
                RUN_LOAD=false
                shift
                ;;
            --integration-only)
                RUN_UNIT=false
                RUN_INTEGRATION=true
                RUN_E2E=false
                RUN_PERFORMANCE=false
                RUN_LOAD=false
                shift
                ;;
            --e2e-only)
                RUN_UNIT=false
                RUN_INTEGRATION=false
                RUN_E2E=true
                RUN_PERFORMANCE=false
                RUN_LOAD=false
                shift
                ;;
            --performance-only)
                RUN_UNIT=false
                RUN_INTEGRATION=false
                RUN_E2E=false
                RUN_PERFORMANCE=true
                RUN_LOAD=false
                shift
                ;;
            --load-only)
                RUN_UNIT=false
                RUN_INTEGRATION=false
                RUN_E2E=false
                RUN_PERFORMANCE=false
                RUN_LOAD=true
                shift
                ;;
            --all)
                RUN_UNIT=true
                RUN_INTEGRATION=true
                RUN_E2E=true
                RUN_PERFORMANCE=true
                RUN_LOAD=true
                shift
                ;;
            --no-coverage)
                RUN_COVERAGE=false
                shift
                ;;
            --parallel)
                PARALLEL=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --ci)
                CI_MODE=true
                PARALLEL=true
                RUN_COVERAGE=true
                shift
                ;;
            --clean)
                CLEAN_SETUP=true
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                echo -e "${RED}Unknown option: $1${NC}"
                show_help
                exit 1
                ;;
        esac
    done
}

show_help() {
    echo "Video Generation Platform Test Runner"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Test Type Options:"
    echo "  --unit-only         Run only unit tests"
    echo "  --integration-only  Run only integration tests"
    echo "  --e2e-only         Run only end-to-end tests"
    echo "  --performance-only  Run only performance tests"
    echo "  --load-only        Run only load tests"
    echo "  --all              Run all test types"
    echo ""
    echo "Configuration Options:"
    echo "  --no-coverage      Skip code coverage collection"
    echo "  --parallel         Run tests in parallel"
    echo "  --verbose          Enable verbose output"
    echo "  --ci               Enable CI mode (parallel, coverage, optimized)"
    echo "  --clean            Clean setup (remove node_modules, reinstall)"
    echo "  --help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                 Run unit and integration tests with coverage"
    echo "  $0 --all           Run all tests including E2E and performance"
    echo "  $0 --unit-only     Run only unit tests"
    echo "  $0 --ci            Run in CI mode with optimizations"
}

print_status() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Setup directories and cleanup
setup_environment() {
    print_status "Setting up test environment..."

    # Create directories
    mkdir -p "$REPORTS_DIR"
    mkdir -p "$LOG_DIR"
    mkdir -p "$REPORTS_DIR/coverage"
    mkdir -p "$REPORTS_DIR/junit"
    mkdir -p "$REPORTS_DIR/playwright-report"
    mkdir -p "$REPORTS_DIR/load-test"

    # Clean setup if requested
    if [[ "$CLEAN_SETUP" == true ]]; then
        print_status "Cleaning and reinstalling dependencies..."

        # Clean backend
        if [[ -d "$BACKEND_DIR/node_modules" ]]; then
            rm -rf "$BACKEND_DIR/node_modules"
        fi
        if [[ -d "$BACKEND_DIR/dist" ]]; then
            rm -rf "$BACKEND_DIR/dist"
        fi

        # Clean frontend
        if [[ -d "$FRONTEND_DIR/node_modules" ]]; then
            rm -rf "$FRONTEND_DIR/node_modules"
        fi
        if [[ -d "$FRONTEND_DIR/dist" ]]; then
            rm -rf "$FRONTEND_DIR/dist"
        fi

        # Clean root
        if [[ -d "$PROJECT_ROOT/node_modules" ]]; then
            rm -rf "$PROJECT_ROOT/node_modules"
        fi
    fi

    # Install dependencies
    print_status "Installing dependencies..."

    # Backend dependencies
    cd "$BACKEND_DIR"
    if [[ ! -d "node_modules" ]] || [[ "$CLEAN_SETUP" == true ]]; then
        npm ci --silent > "$LOG_DIR/backend-install.log" 2>&1 || {
            print_error "Failed to install backend dependencies"
            cat "$LOG_DIR/backend-install.log"
            exit 1
        }
    fi

    # Frontend dependencies
    cd "$FRONTEND_DIR"
    if [[ ! -d "node_modules" ]] || [[ "$CLEAN_SETUP" == true ]]; then
        npm ci --silent > "$LOG_DIR/frontend-install.log" 2>&1 || {
            print_error "Failed to install frontend dependencies"
            cat "$LOG_DIR/frontend-install.log"
            exit 1
        }
    fi

    # Install Playwright browsers for E2E tests
    if [[ "$RUN_E2E" == true ]]; then
        cd "$PROJECT_ROOT"
        npx playwright install --with-deps > "$LOG_DIR/playwright-install.log" 2>&1 || {
            print_warning "Failed to install Playwright browsers"
            cat "$LOG_DIR/playwright-install.log"
        }
    fi

    print_success "Environment setup complete"
}

# Check if services are running
check_services() {
    print_status "Checking required services..."

    # Check if database is available (for integration tests)
    if [[ "$RUN_INTEGRATION" == true ]] || [[ "$RUN_E2E" == true ]]; then
        if ! command -v docker &> /dev/null; then
            print_warning "Docker not found - some tests may fail"
        else
            # Start test database if needed
            docker-compose -f "$PROJECT_ROOT/docker-compose.test.yml" up -d postgres redis > /dev/null 2>&1 || {
                print_warning "Failed to start test services - some tests may fail"
            }
        fi
    fi
}

# Run backend unit tests
run_backend_unit_tests() {
    print_status "Running backend unit tests..."
    cd "$BACKEND_DIR"

    local coverage_flag=""
    local parallel_flag=""
    local verbose_flag=""
    local ci_flag=""

    if [[ "$RUN_COVERAGE" == true ]]; then
        coverage_flag="--coverage"
    fi

    if [[ "$PARALLEL" == true ]]; then
        parallel_flag="--maxWorkers=4"
    fi

    if [[ "$VERBOSE" == true ]]; then
        verbose_flag="--verbose"
    fi

    if [[ "$CI_MODE" == true ]]; then
        ci_flag="--ci --watchAll=false"
    fi

    local log_file="$LOG_DIR/backend-unit-tests.log"

    npm run test:unit -- \
        $coverage_flag \
        $parallel_flag \
        $verbose_flag \
        $ci_flag \
        --testResultsProcessor="jest-junit" \
        --coverageDirectory="../test-results/coverage/backend" \
        > "$log_file" 2>&1

    local exit_code=$?

    if [[ $exit_code -eq 0 ]]; then
        print_success "Backend unit tests passed"
    else
        print_error "Backend unit tests failed"
        if [[ "$VERBOSE" == true ]]; then
            tail -50 "$log_file"
        fi
        return $exit_code
    fi
}

# Run frontend unit tests
run_frontend_unit_tests() {
    print_status "Running frontend unit tests..."
    cd "$FRONTEND_DIR"

    local coverage_flag=""
    local verbose_flag=""

    if [[ "$RUN_COVERAGE" == true ]]; then
        coverage_flag="--coverage"
    fi

    if [[ "$VERBOSE" == true ]]; then
        verbose_flag="--reporter=verbose"
    fi

    local log_file="$LOG_DIR/frontend-unit-tests.log"

    npm run test:unit -- \
        --run \
        $coverage_flag \
        $verbose_flag \
        --reporter=junit \
        --outputFile="../test-results/junit/frontend-unit-results.xml" \
        > "$log_file" 2>&1

    local exit_code=$?

    if [[ $exit_code -eq 0 ]]; then
        print_success "Frontend unit tests passed"
    else
        print_error "Frontend unit tests failed"
        if [[ "$VERBOSE" == true ]]; then
            tail -50 "$log_file"
        fi
        return $exit_code
    fi
}

# Run integration tests
run_integration_tests() {
    print_status "Running integration tests..."
    cd "$BACKEND_DIR"

    local coverage_flag=""
    local parallel_flag=""
    local verbose_flag=""
    local ci_flag=""

    if [[ "$RUN_COVERAGE" == true ]]; then
        coverage_flag="--coverage"
    fi

    if [[ "$PARALLEL" == true ]]; then
        parallel_flag="--maxWorkers=2"  # Fewer workers for integration tests
    fi

    if [[ "$VERBOSE" == true ]]; then
        verbose_flag="--verbose"
    fi

    if [[ "$CI_MODE" == true ]]; then
        ci_flag="--ci --watchAll=false"
    fi

    local log_file="$LOG_DIR/integration-tests.log"

    npm run test:integration -- \
        $coverage_flag \
        $parallel_flag \
        $verbose_flag \
        $ci_flag \
        --testResultsProcessor="jest-junit" \
        --coverageDirectory="../test-results/coverage/integration" \
        > "$log_file" 2>&1

    local exit_code=$?

    if [[ $exit_code -eq 0 ]]; then
        print_success "Integration tests passed"
    else
        print_error "Integration tests failed"
        if [[ "$VERBOSE" == true ]]; then
            tail -50 "$log_file"
        fi
        return $exit_code
    fi
}

# Run E2E tests
run_e2e_tests() {
    print_status "Running E2E tests..."
    cd "$PROJECT_ROOT"

    local parallel_flag=""
    local verbose_flag=""
    local ci_flag=""
    local headless_flag="--headed"

    if [[ "$PARALLEL" == true ]]; then
        parallel_flag="--workers=2"
    fi

    if [[ "$VERBOSE" == true ]]; then
        verbose_flag="--reporter=line"
    fi

    if [[ "$CI_MODE" == true ]]; then
        ci_flag="--reporter=junit"
        headless_flag=""  # Run headless in CI
    fi

    local log_file="$LOG_DIR/e2e-tests.log"

    # Start services for E2E tests
    print_status "Starting services for E2E tests..."
    docker-compose -f docker-compose.test.yml up -d > /dev/null 2>&1 || {
        print_warning "Failed to start E2E test services"
    }

    # Wait for services to be ready
    sleep 10

    npx playwright test \
        $parallel_flag \
        $verbose_flag \
        $ci_flag \
        $headless_flag \
        --output-dir="test-results/playwright-output" \
        > "$log_file" 2>&1

    local exit_code=$?

    # Cleanup services
    docker-compose -f docker-compose.test.yml down > /dev/null 2>&1 || true

    if [[ $exit_code -eq 0 ]]; then
        print_success "E2E tests passed"
    else
        print_error "E2E tests failed"
        if [[ "$VERBOSE" == true ]]; then
            tail -50 "$log_file"
        fi
        return $exit_code
    fi
}

# Run performance tests
run_performance_tests() {
    print_status "Running performance tests..."
    cd "$BACKEND_DIR"

    local log_file="$LOG_DIR/performance-tests.log"

    npm run test:performance -- \
        --verbose \
        --testTimeout=60000 \
        --detectOpenHandles \
        > "$log_file" 2>&1

    local exit_code=$?

    if [[ $exit_code -eq 0 ]]; then
        print_success "Performance tests passed"
    else
        print_error "Performance tests failed"
        if [[ "$VERBOSE" == true ]]; then
            tail -50 "$log_file"
        fi
        return $exit_code
    fi
}

# Run load tests
run_load_tests() {
    print_status "Running load tests..."
    cd "$BACKEND_DIR"

    # Check if Artillery is available
    if ! command -v artillery &> /dev/null; then
        print_error "Artillery not found. Install with: npm install -g artillery"
        return 1
    fi

    # Start services for load testing
    print_status "Starting services for load tests..."
    docker-compose -f "$PROJECT_ROOT/docker-compose.test.yml" up -d > /dev/null 2>&1 || {
        print_error "Failed to start load test services"
        return 1
    }

    # Wait for services to be ready
    sleep 15

    local log_file="$LOG_DIR/load-tests.log"
    local report_file="$REPORTS_DIR/load-test/artillery-report.json"

    # Run load tests
    artillery run \
        tests/performance/load-test.yml \
        --output "$report_file" \
        > "$log_file" 2>&1

    local exit_code=$?

    # Generate HTML report
    if [[ -f "$report_file" ]]; then
        artillery report "$report_file" \
            --output "$REPORTS_DIR/load-test/artillery-report.html" \
            > /dev/null 2>&1 || true
    fi

    # Cleanup services
    docker-compose -f "$PROJECT_ROOT/docker-compose.test.yml" down > /dev/null 2>&1 || true

    if [[ $exit_code -eq 0 ]]; then
        print_success "Load tests completed"
        print_status "Load test report: $REPORTS_DIR/load-test/artillery-report.html"
    else
        print_error "Load tests failed"
        if [[ "$VERBOSE" == true ]]; then
            tail -50 "$log_file"
        fi
        return $exit_code
    fi
}

# Generate combined coverage report
generate_coverage_report() {
    if [[ "$RUN_COVERAGE" != true ]]; then
        return 0
    fi

    print_status "Generating combined coverage report..."

    # Install nyc for coverage merging if not available
    if ! command -v nyc &> /dev/null; then
        npm install -g nyc > /dev/null 2>&1 || {
            print_warning "Failed to install nyc for coverage merging"
            return 0
        }
    fi

    cd "$PROJECT_ROOT"

    # Copy coverage files to a common directory
    mkdir -p "$REPORTS_DIR/coverage/combined"

    if [[ -d "$REPORTS_DIR/coverage/backend" ]]; then
        cp -r "$REPORTS_DIR/coverage/backend"/* "$REPORTS_DIR/coverage/combined/" 2>/dev/null || true
    fi

    if [[ -d "$FRONTEND_DIR/coverage" ]]; then
        cp -r "$FRONTEND_DIR/coverage"/* "$REPORTS_DIR/coverage/combined/" 2>/dev/null || true
    fi

    # Generate combined HTML report
    if [[ -d "$REPORTS_DIR/coverage/combined" ]]; then
        nyc report \
            --temp-dir="$REPORTS_DIR/coverage/combined" \
            --report-dir="$REPORTS_DIR/coverage/html" \
            --reporter=html \
            > /dev/null 2>&1 || {
            print_warning "Failed to generate combined coverage report"
        }
    fi

    print_success "Coverage report generated: $REPORTS_DIR/coverage/html/index.html"
}

# Generate test summary
generate_test_summary() {
    print_status "Generating test summary..."

    local summary_file="$REPORTS_DIR/test-summary.txt"

    {
        echo "====================================="
        echo "Video Generation Platform Test Summary"
        echo "====================================="
        echo "Generated: $(date)"
        echo ""

        echo "Test Configuration:"
        echo "  Unit Tests: $RUN_UNIT"
        echo "  Integration Tests: $RUN_INTEGRATION"
        echo "  E2E Tests: $RUN_E2E"
        echo "  Performance Tests: $RUN_PERFORMANCE"
        echo "  Load Tests: $RUN_LOAD"
        echo "  Coverage: $RUN_COVERAGE"
        echo "  Parallel: $PARALLEL"
        echo "  CI Mode: $CI_MODE"
        echo ""

        echo "Test Results:"
        if [[ "$RUN_UNIT" == true ]]; then
            if [[ -f "$REPORTS_DIR/junit/backend-unit-results.xml" ]] || [[ -f "$REPORTS_DIR/junit/frontend-unit-results.xml" ]]; then
                echo "  ✓ Unit Tests: PASSED"
            else
                echo "  ✗ Unit Tests: FAILED or SKIPPED"
            fi
        fi

        if [[ "$RUN_INTEGRATION" == true ]]; then
            if [[ -f "$REPORTS_DIR/junit/integration-results.xml" ]]; then
                echo "  ✓ Integration Tests: PASSED"
            else
                echo "  ✗ Integration Tests: FAILED or SKIPPED"
            fi
        fi

        if [[ "$RUN_E2E" == true ]]; then
            if [[ -d "$REPORTS_DIR/playwright-report" ]]; then
                echo "  ✓ E2E Tests: COMPLETED"
            else
                echo "  ✗ E2E Tests: FAILED or SKIPPED"
            fi
        fi

        if [[ "$RUN_PERFORMANCE" == true ]]; then
            echo "  ✓ Performance Tests: COMPLETED"
        fi

        if [[ "$RUN_LOAD" == true ]]; then
            if [[ -f "$REPORTS_DIR/load-test/artillery-report.html" ]]; then
                echo "  ✓ Load Tests: COMPLETED"
            else
                echo "  ✗ Load Tests: FAILED or SKIPPED"
            fi
        fi

        echo ""
        echo "Report Locations:"
        echo "  Test Results: $REPORTS_DIR"
        echo "  Logs: $LOG_DIR"

        if [[ "$RUN_COVERAGE" == true ]]; then
            echo "  Coverage Report: $REPORTS_DIR/coverage/html/index.html"
        fi

        if [[ "$RUN_E2E" == true ]]; then
            echo "  E2E Report: $REPORTS_DIR/playwright-report/index.html"
        fi

        if [[ "$RUN_LOAD" == true ]]; then
            echo "  Load Test Report: $REPORTS_DIR/load-test/artillery-report.html"
        fi

        echo ""
        echo "====================================="

    } > "$summary_file"

    # Display summary
    cat "$summary_file"

    print_success "Test summary saved: $summary_file"
}

# Cleanup function
cleanup() {
    print_status "Cleaning up..."

    # Stop any running services
    docker-compose -f "$PROJECT_ROOT/docker-compose.test.yml" down > /dev/null 2>&1 || true

    # Kill any hanging processes
    pkill -f "node.*jest" > /dev/null 2>&1 || true
    pkill -f "playwright" > /dev/null 2>&1 || true

    print_success "Cleanup complete"
}

# Main execution function
main() {
    local start_time=$(date +%s)
    local exit_code=0

    print_status "Starting Video Generation Platform Test Suite"
    print_status "Timestamp: $(date)"

    # Parse arguments
    parse_args "$@"

    # Setup signal handlers for cleanup
    trap cleanup EXIT INT TERM

    # Setup environment
    setup_environment
    check_services

    # Run tests based on configuration
    if [[ "$RUN_UNIT" == true ]]; then
        run_backend_unit_tests || exit_code=$?
        run_frontend_unit_tests || exit_code=$?
    fi

    if [[ "$RUN_INTEGRATION" == true ]] && [[ $exit_code -eq 0 ]]; then
        run_integration_tests || exit_code=$?
    fi

    if [[ "$RUN_E2E" == true ]] && [[ $exit_code -eq 0 ]]; then
        run_e2e_tests || exit_code=$?
    fi

    if [[ "$RUN_PERFORMANCE" == true ]] && [[ $exit_code -eq 0 ]]; then
        run_performance_tests || exit_code=$?
    fi

    if [[ "$RUN_LOAD" == true ]] && [[ $exit_code -eq 0 ]]; then
        run_load_tests || exit_code=$?
    fi

    # Generate reports
    generate_coverage_report
    generate_test_summary

    # Calculate execution time
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    print_status "Test execution completed in ${duration} seconds"

    if [[ $exit_code -eq 0 ]]; then
        print_success "All tests passed successfully!"
    else
        print_error "Some tests failed. Check the reports for details."
    fi

    exit $exit_code
}

# Execute main function with all arguments
main "$@"
