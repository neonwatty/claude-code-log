# Claude Code Log - JavaScript/TypeScript Implementation

A comprehensive TypeScript implementation of Claude Code Log with Express.js backend and Lit frontend for analyzing Claude conversation transcripts.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development servers (recommended)
npm run dev                 # Both frontend and backend

# Or start individually
npm run dev:frontend        # Frontend only (Vite at :5173)
npm run dev:backend         # Backend only (Express at :3001)
```

**Access the application**: http://localhost:5173

## 📁 Project Structure

```
js/
├── backend/                # Express.js API server
│   ├── src/               # TypeScript source code
│   │   ├── routes/        # API endpoints
│   │   ├── services/      # Business logic
│   │   ├── middleware/    # Express middleware
│   │   └── websocket/     # WebSocket implementation
│   └── dist/              # Built JavaScript
├── frontend/               # Lit web components frontend
│   ├── src/               # TypeScript source code
│   │   ├── components/    # Lit web components
│   │   ├── services/      # Frontend services
│   │   ├── styles/        # CSS modules
│   │   └── utils/         # Utility functions
│   └── dist/              # Built static files
├── shared/                 # Shared TypeScript interfaces
│   └── src/               # Common types and schemas
├── docs/                   # Documentation (see below)
└── package.json            # Workspace configuration
```

## 📚 Documentation

Comprehensive documentation is available in the [`docs/`](./docs/) directory:

- **[Getting Started Guide](./docs/getting-started/)** - Setup and basic usage
- **[API Documentation](./docs/api/)** - Backend API reference
- **[Component Library](./docs/components/)** - Frontend components
- **[Deployment Guide](./docs/deployment/)** - Production deployment
- **[Examples](./docs/examples/)** - Usage patterns and code samples

## 🛠️ Development Commands

### Server Management
```bash
npm run dev                 # Start both frontend and backend
npm run dev:frontend        # Frontend only (Vite dev server)
npm run dev:backend         # Backend only (Express server)
```

### Building
```bash
npm run build               # Build both frontend and backend
npm run build:frontend      # Build frontend static files
npm run build:backend       # Build backend JavaScript
```

### Testing & Quality
```bash
npm run test                # Run all tests with Vitest
npm run test:watch          # Run tests in watch mode
npm run test:coverage       # Generate coverage report
npm run lint                # ESLint check
npm run lint:fix            # Auto-fix ESLint issues
npm run format              # Prettier format
npm run typecheck           # TypeScript type checking
```

## ✨ Features

### 🔧 Backend (Express.js)
- **TypeScript-first** API server with strict type checking
- **Security-hardened** with Helmet, CORS, compression, and rate limiting
- **WebSocket integration** for real-time session updates
- **Comprehensive caching** with intelligent invalidation
- **Session management** and Claude transcript parsing
- **Analytics & export** services for usage insights
- **Hot reload** development with nodemon

### 🎨 Frontend (Lit Web Components)
- **Modern web components** built with Lit framework
- **Reactive properties** and lifecycle management
- **TypeScript integration** with shared type system
- **Vite-powered** development with HMR
- **Component library** with consistent design patterns
- **WebSocket client** for real-time updates
- **Accessibility-focused** with ARIA support

### 🔄 Shared Module
- **Unified type system** matching Python implementation
- **Anthropic API adapters** for Claude integration
- **Schema validation** with comprehensive error handling
- **Export formats** (JSON, CSV, HTML) with type safety
- **Session data structures** for transcript analysis
- **Token usage tracking** and analytics types

## 🎯 Getting Started - User Onboarding

### Step 1: Installation & Setup
```bash
# Clone and setup
git clone <repository-url>
cd claude-code-log/js
npm install
```

### Step 2: Environment Configuration
```bash
# Copy example environment file
cp .env.example .env

# Configure your settings
# PORT=3001
# NODE_ENV=development
# FRONTEND_URL=http://localhost:5173
```

### Step 3: Start Your First Session
```bash
# Launch the application
npm run dev

# Open your browser to: http://localhost:5173
```

### Step 4: Import Your Data
1. **Prepare JSONL files**: Export your Claude conversations as JSONL
2. **Upload sessions**: Use the interface to import transcript files
3. **Explore analytics**: View token usage, session timelines, and insights

### 🎊 Welcome Tour
- **Session List**: Browse all your imported Claude conversations
- **Analytics Dashboard**: View token usage patterns and insights  
- **Timeline View**: See conversation flow and message progression
- **Export Tools**: Save analysis data in multiple formats
- **Real-time Updates**: Watch sessions update live via WebSocket

## 🛠️ Development Workflow

1. **Backend Development**: Edit files in `backend/src/`
2. **Frontend Development**: Edit files in `frontend/src/` 
3. **Shared Types**: Edit interfaces in `shared/src/`
4. **Testing**: Run `npm test` for comprehensive test suite
5. **Quality Checks**: Use `npm run lint` and `npm run typecheck`

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
