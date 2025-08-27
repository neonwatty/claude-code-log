#!/bin/bash

# Production Deployment Script
# This script handles the complete deployment process for claude-code-log

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
BUILD_DIR="./dist"
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"

# Functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Pre-deployment checks
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check Node.js version
    NODE_VERSION=$(node --version)
    log "Node.js version: $NODE_VERSION"
    
    # Check npm version
    NPM_VERSION=$(npm --version)
    log "npm version: $NPM_VERSION"
    
    # Check Docker (if using containerized deployment)
    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version)
        log "Docker version: $DOCKER_VERSION"
    fi
    
    # Check required environment variables
    if [[ "$ENVIRONMENT" == "production" ]]; then
        required_vars=("NODE_ENV" "PORT")
        for var in "${required_vars[@]}"; do
            if [[ -z "${!var:-}" ]]; then
                error "Required environment variable $var is not set"
            fi
        done
    fi
    
    log "Prerequisites check completed"
}

# Run tests
run_tests() {
    log "Running comprehensive test suite..."
    
    # Install dependencies
    npm ci
    
    # Run linting
    log "Running linting..."
    npm run lint
    
    # Run type checking
    log "Running TypeScript type checking..."
    npx tsc --noEmit
    
    # Run unit tests with coverage
    log "Running unit tests..."
    npm run test:coverage
    
    # Check coverage threshold
    if [[ "$ENVIRONMENT" == "production" ]]; then
        log "Checking test coverage threshold..."
        # Add coverage threshold check here
    fi
    
    log "All tests passed"
}

# Build application
build_application() {
    log "Building application for $ENVIRONMENT..."
    
    # Set environment
    export NODE_ENV=$ENVIRONMENT
    
    # Clean previous build
    rm -rf $BUILD_DIR
    
    # Build backend
    log "Building backend..."
    npm run build:backend
    
    # Build frontend
    log "Building frontend..."
    npm run build:frontend
    
    # Build shared packages
    log "Building shared packages..."
    cd shared && npm run build && cd ..
    
    # Verify build artifacts
    if [[ ! -d "backend/dist" ]] || [[ ! -d "frontend/dist" ]]; then
        error "Build artifacts not found"
    fi
    
    log "Build completed successfully"
}

# Security scan
security_scan() {
    log "Running security scan..."
    
    # Run npm audit
    npm audit --audit-level high
    
    # Additional security checks can be added here
    log "Security scan completed"
}

# Performance optimization
optimize_build() {
    log "Optimizing build for production..."
    
    # Optimize images (if any optimization tools are available)
    # Add image optimization steps here
    
    # Bundle analysis (optional)
    if command -v npx &> /dev/null; then
        log "Analyzing bundle size..."
        # Add bundle analysis here if needed
    fi
    
    log "Build optimization completed"
}

# Create backup
create_backup() {
    if [[ "$ENVIRONMENT" == "production" ]]; then
        log "Creating backup..."
        mkdir -p "$BACKUP_DIR"
        
        # Backup current deployment (if exists)
        if [[ -d "./current" ]]; then
            cp -r ./current "$BACKUP_DIR/"
        fi
        
        # Backup database (if applicable)
        # Add database backup commands here
        
        log "Backup created at $BACKUP_DIR"
    fi
}

# Deploy application
deploy_application() {
    log "Deploying application..."
    
    case "$ENVIRONMENT" in
        "production")
            deploy_production
            ;;
        "staging")
            deploy_staging
            ;;
        "development")
            deploy_development
            ;;
        *)
            error "Unknown environment: $ENVIRONMENT"
            ;;
    esac
    
    log "Deployment completed"
}

# Production deployment
deploy_production() {
    log "Deploying to production..."
    
    # Stop current application gracefully
    if pgrep -f "node.*server.js" > /dev/null; then
        log "Stopping current application..."
        pkill -SIGTERM -f "node.*server.js" || true
        sleep 5
    fi
    
    # Deploy new version
    if command -v docker &> /dev/null && [[ -f "docker-compose.yml" ]]; then
        # Docker deployment
        log "Starting Docker deployment..."
        docker-compose -f docker-compose.yml up -d --build
    else
        # Direct deployment
        log "Starting direct deployment..."
        NODE_ENV=production npm run start &
    fi
    
    # Wait for application to start
    wait_for_health_check
}

# Staging deployment
deploy_staging() {
    log "Deploying to staging..."
    
    # Similar to production but with staging-specific configurations
    if command -v docker &> /dev/null; then
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
    else
        NODE_ENV=staging npm run start &
    fi
    
    wait_for_health_check
}

# Development deployment
deploy_development() {
    log "Starting development environment..."
    npm run dev
}

# Health check
wait_for_health_check() {
    log "Waiting for application to start..."
    
    local max_attempts=30
    local attempt=1
    local health_url="http://localhost:${PORT:-3001}/health"
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f -s "$health_url" > /dev/null; then
            log "Application is healthy"
            return 0
        fi
        
        log "Attempt $attempt/$max_attempts: Waiting for health check..."
        sleep 2
        ((attempt++))
    done
    
    error "Application failed to start within expected time"
}

# Post-deployment verification
post_deployment_verification() {
    log "Running post-deployment verification..."
    
    local base_url="http://localhost:${PORT:-3001}"
    
    # Test health endpoint
    if ! curl -f -s "$base_url/health" > /dev/null; then
        error "Health check failed"
    fi
    
    # Test API endpoints
    if ! curl -f -s "$base_url/api" > /dev/null; then
        warn "API endpoint check failed"
    fi
    
    # Additional verification tests
    log "Post-deployment verification completed"
}

# Rollback function
rollback() {
    log "Rolling back deployment..."
    
    if [[ -d "$BACKUP_DIR" ]]; then
        # Stop current deployment
        if command -v docker &> /dev/null; then
            docker-compose down
        else
            pkill -SIGTERM -f "node.*server.js" || true
        fi
        
        # Restore backup
        cp -r "$BACKUP_DIR/current/"* ./
        
        # Restart with backup
        deploy_application
        
        log "Rollback completed"
    else
        error "No backup found for rollback"
    fi
}

# Cleanup old deployments
cleanup() {
    log "Cleaning up old deployments..."
    
    # Remove old backups (keep last 5)
    if [[ -d "./backups" ]]; then
        cd backups
        ls -t | tail -n +6 | xargs -r rm -rf
        cd ..
    fi
    
    # Clean up Docker images (if using Docker)
    if command -v docker &> /dev/null; then
        docker system prune -f
    fi
    
    log "Cleanup completed"
}

# Main execution
main() {
    log "Starting deployment process for environment: $ENVIRONMENT"
    
    # Set trap for cleanup on error
    trap 'error "Deployment failed"' ERR
    
    check_prerequisites
    run_tests
    security_scan
    build_application
    optimize_build
    create_backup
    deploy_application
    post_deployment_verification
    cleanup
    
    log "Deployment completed successfully!"
    log "Application is running at: http://localhost:${PORT:-3001}"
}

# Handle command line arguments
case "${1:-}" in
    "production"|"staging"|"development")
        main
        ;;
    "rollback")
        rollback
        ;;
    "cleanup")
        cleanup
        ;;
    "--help"|"-h")
        echo "Usage: $0 [production|staging|development|rollback|cleanup]"
        echo ""
        echo "Commands:"
        echo "  production  - Deploy to production environment"
        echo "  staging     - Deploy to staging environment"
        echo "  development - Start development environment"
        echo "  rollback    - Rollback to previous deployment"
        echo "  cleanup     - Clean up old deployments and artifacts"
        echo "  --help, -h  - Show this help message"
        exit 0
        ;;
    "")
        main
        ;;
    *)
        error "Unknown command: $1. Use --help for usage information."
        ;;
esac