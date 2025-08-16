# Claude Code Log - JavaScript/TypeScript Implementation

TypeScript implementation of Claude Code Log with Express.js backend and Lit frontend.

## Project Structure

```
js/
├── backend/                # Express.js API server
├── frontend/               # Lit web components frontend  
├── shared/                 # Shared TypeScript interfaces
├── node_modules/           # Dependencies
├── package.json            # Workspace configuration
├── tsconfig.base.json      # Base TypeScript config
├── vite.config.ts          # Vite configuration
└── index.html              # Development entry point
```

## Quick Start

```bash
# Install dependencies
npm install

# Start development servers
npm run dev                 # Both frontend and backend
npm run dev:frontend        # Frontend only (Vite)
npm run dev:backend         # Backend only (Express)

# Build for production
npm run build               # Build both
npm run build:frontend      # Build frontend
npm run build:backend       # Build backend
```

## Features

### Backend (Express.js)
- TypeScript-first API server
- Security middleware (Helmet, CORS, compression)
- Environment-based configuration
- Error handling and logging
- Hot reload development

### Frontend (Lit)
- Modern web components with Lit
- TypeScript for type safety
- Vite for fast development
- HMR for component updates
- Shared type system

### Shared Module
- TypeScript interfaces matching Python models
- Session and transcript data structures
- Token usage tracking types
- API response formats
- Constants and enums

## Development Workflow

1. **Backend Development**: Edit files in `backend/src/`
2. **Frontend Development**: Edit files in `frontend/src/`
3. **Shared Types**: Edit interfaces in `shared/src/`
4. **Testing**: Use browser dev tools and API testing tools

## Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
# Server
PORT=3001
NODE_ENV=development

# Frontend
FRONTEND_URL=http://localhost:5173
```

## TypeScript Configuration

- **Base Config**: `tsconfig.base.json` with shared paths
- **Path Mapping**: `@shared` imports from shared module
- **Strict Mode**: Full TypeScript strict checking enabled
- **Decorators**: Enabled for Lit components

## API Integration

The frontend connects to the backend via:
- Vite proxy configuration (`/api` → `http://localhost:3001`)
- Shared TypeScript interfaces for type safety
- RESTful API design patterns

## Build Output

- **Frontend**: `frontend/dist/` (static files)
- **Backend**: `backend/dist/` (Node.js modules)
- **Shared**: `shared/dist/` (TypeScript declarations)

## Testing

```bash
# Lint and type check
npm run lint
npm run typecheck

# Test endpoints
curl http://localhost:3001/health
curl http://localhost:3001/api
```