# Deployment Guide

## Prerequisites

1. **Node.js** (v18 or higher)
2. **npm** (v9 or higher)
3. **Docker** (for containerized deployment)
4. **TypeScript** installed globally: `npm install -g typescript`

## Quick Start

### Development
```bash
# Install dependencies
npm install

# Start development servers
npm run dev
```

### Production Build
```bash
# Full validation and build
npm run deploy:build

# Or step by step
npm run validate      # Lint, type check, test
npm run build:prod    # Production build
```

## Build Scripts

### Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development servers (backend + frontend) |
| `npm run build` | Build all workspaces |
| `npm run build:prod` | Production build with optimizations |
| `npm run start` | Start production backend server |
| `npm run validate` | Run all checks (lint, type, test) |
| `npm run deploy:build` | Full validation + production build |

### Workspace-Specific Commands

| Command | Description |
|---------|-------------|
| `npm run dev:backend` | Start backend development server |
| `npm run dev:frontend` | Start frontend development server |
| `npm run build:shared` | Build shared types package |
| `npm run build:backend` | Build backend |
| `npm run build:frontend` | Build frontend |

## Docker Deployment

### Using Docker Compose (Recommended)
```bash
# Build and start
docker-compose up --build

# Production mode
docker-compose -f docker-compose.yml up --build
```

### Manual Docker Build
```bash
# Build image
docker build -t typescript-fullstack-app .

# Run container
docker run -p 3000:3000 typescript-fullstack-app
```

## Environment Configuration

### Environment Files

- `.env.development` - Development settings
- `.env.production` - Production settings
- `.env.example` - Template with all options

### Required Production Variables

```bash
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://yourdomain.com
JWT_SECRET=your-secure-jwt-secret
DATABASE_URL=postgresql://user:pass@host:5432/db
```

## Deployment Platforms

### Vercel (Frontend + Serverless Backend)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Railway
```bash
# Connect repository to Railway
# Set environment variables in Railway dashboard
# Deploy automatically on push to main
```

### AWS ECS/Fargate
```bash
# Build and push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com
docker build -t typescript-fullstack-app .
docker tag typescript-fullstack-app:latest <account>.dkr.ecr.us-east-1.amazonaws.com/typescript-fullstack-app:latest
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/typescript-fullstack-app:latest
```

### Google Cloud Run
```bash
# Build and deploy
gcloud builds submit --tag gcr.io/PROJECT_ID/typescript-fullstack-app
gcloud run deploy --image gcr.io/PROJECT_ID/typescript-fullstack-app --platform managed
```

## CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/ci.yml`) handles:

1. **Lint and Test** - Code quality checks
2. **Build** - Production builds with artifacts
3. **Docker Build** - Container image creation
4. **Deploy** - Deployment to production (configure based on platform)

### Required GitHub Secrets

- `DOCKER_USERNAME` - Docker Hub username
- `DOCKER_PASSWORD` - Docker Hub password
- Additional secrets based on deployment platform

## Monitoring and Health Checks

### Health Endpoint
- `GET /api/health` - Application health status
- Docker health check configured
- CI/CD pipeline includes health validation

### Logging
- Development: `LOG_LEVEL=debug`
- Production: `LOG_LEVEL=warn`
- Structured logging via middleware

## Troubleshooting

### Common Issues

1. **esbuild version conflicts**
   ```bash
   npm run clean:all
   npm install
   ```

2. **TypeScript not found**
   ```bash
   npm install -g typescript
   ```

3. **Build failures**
   ```bash
   npm run validate  # Check for issues
   npm run clean     # Clear builds
   npm run build     # Rebuild
   ```

### Build Artifacts

- `backend/dist/` - Compiled backend JavaScript
- `frontend/dist/` - Bundled frontend assets
- `shared/dist/` - Compiled shared types

## Performance Optimization

### Frontend
- Code splitting by chunks (lit, shared)
- Minification in production
- Source maps only in development

### Backend
- No source maps in production builds
- Express compression middleware
- Environment-specific configurations

## Security Considerations

- Environment variables for sensitive data
- CORS properly configured
- No secrets in source code
- Production-only validations
- Health checks for monitoring