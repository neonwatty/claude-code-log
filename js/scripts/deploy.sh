#!/bin/bash

# TypeScript Full-Stack Application Deployment Script
set -e

echo "🚀 Starting deployment process..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Parse command line arguments
ENVIRONMENT=${1:-production}
BUILD_ONLY=${2:-false}

echo "📋 Configuration:"
echo "   Environment: $ENVIRONMENT"
echo "   Build only: $BUILD_ONLY"

# Validate environment
if [ "$ENVIRONMENT" != "development" ] && [ "$ENVIRONMENT" != "staging" ] && [ "$ENVIRONMENT" != "production" ]; then
    echo "❌ Error: Invalid environment. Use 'development', 'staging', or 'production'"
    exit 1
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
npm run clean

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Run validation (linting, type checking, tests)
echo "✅ Running validation..."
npm run validate

# Build for production
echo "🔨 Building application..."
if [ "$ENVIRONMENT" = "production" ]; then
    npm run build:prod
else
    npm run build
fi

if [ "$BUILD_ONLY" = "true" ]; then
    echo "✅ Build completed successfully!"
    exit 0
fi

# Build Docker image
echo "🐳 Building Docker image..."
docker build -t typescript-fullstack-app:$ENVIRONMENT .

# Tag as latest if production
if [ "$ENVIRONMENT" = "production" ]; then
    docker tag typescript-fullstack-app:$ENVIRONMENT typescript-fullstack-app:latest
fi

echo "✅ Deployment build completed successfully!"
echo ""
echo "🔄 Next steps:"
echo "   • To run locally: docker-compose up"
echo "   • To push to registry: docker push typescript-fullstack-app:$ENVIRONMENT"
echo "   • To deploy to production: Update your deployment platform configuration"