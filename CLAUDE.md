# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### JavaScript/TypeScript Development (js/)
```bash
# Development servers
npm run dev                    # Start both frontend and backend
npm run dev:frontend           # Start Vite dev server (port 5173)
npm run dev:backend           # Start Express dev server (port 3001)

# Building
npm run build                 # Build both frontend and backend
npm run build:frontend        # Build frontend only
npm run build:backend         # Build backend only

# Testing
npm run test                  # Run all tests with Vitest
npm run test:watch            # Run tests in watch mode
npm run test:coverage         # Run tests with coverage report
npm run test:unit             # Run backend unit tests only
npm run test:frontend         # Run frontend tests only
npm run test:components       # Run component tests only
npm run test:ui               # Run tests with UI interface

# Code quality
npm run lint                  # ESLint check
npm run lint:fix              # ESLint fix
npm run format                # Prettier format
npm run format:check          # Prettier check
```

### Python Development (python/)
```bash
# Basic commands
uv run claude-code-log        # Run CLI tool
uv run claude-code-log --tui  # Run with Terminal UI

# Testing (categorized to avoid async conflicts)
uv run pytest -m "not (tui or browser)"  # Unit tests only (fast)
uv run pytest -m tui                     # TUI tests (Textual)
uv run pytest -m browser                 # Browser tests (Playwright)

# All tests in sequence
uv run pytest -m "not tui and not browser"; uv run pytest -m tui; uv run pytest -m browser

# Coverage
uv run pytest --cov=claude_code_log --cov-report=html --cov-report=term

# Code quality
ruff format                   # Format code
ruff check --fix             # Lint and fix
uv run pyright              # Type checking
```

## Project Architecture

This is a dual-language project implementing Claude Code log processing and visualization:

### High-Level Structure
- **js/**: TypeScript/JavaScript implementation with Express backend and Lit frontend
- **python/**: Python CLI tool for JSONL-to-HTML conversion with Terminal UI
- Both implementations share similar data models and functionality

### JavaScript Implementation (js/)

**Workspace Structure**: Monorepo with three packages:
- `backend/`: Express.js API server with TypeScript
- `frontend/`: Lit web components with Vite
- `shared/`: Shared TypeScript interfaces and schemas

**Key Architectural Patterns**:
- **Shared Type System**: TypeScript interfaces in `shared/` used by both frontend and backend
- **Path Mapping**: `@shared` imports resolve to shared module via tsconfig paths
- **WebSocket Integration**: Real-time communication between frontend and backend
- **Component Architecture**: Lit web components with reactive properties and lifecycle management
- **Security Middleware**: Helmet, CORS, compression, rate limiting in Express

**API Design**: RESTful endpoints with TypeScript validation, WebSocket server for real-time updates

**Frontend Architecture**: 
- Lit components with TypeScript decorators
- Vite for development and building
- CSS modules with shared design tokens
- Event-driven architecture with custom EventEmitter

### Python Implementation (python/)

**Core Architecture**:
- **CLI Interface**: Click-based command line with project discovery
- **Data Models**: Pydantic models for transcript validation and parsing
- **Template System**: Jinja2 templates for HTML generation
- **Cache System**: Performance optimization with automatic invalidation
- **TUI Interface**: Textual-based Terminal User Interface for interactive session management

**Key Components**:
- `parser.py`: JSONL file parsing and data extraction
- `renderer.py`: HTML template rendering with token usage tracking
- `converter.py`: High-level conversion orchestration
- `tui.py`: Interactive Terminal UI with session navigation
- `cache.py`: Performance caching with timestamp-based invalidation

**Data Flow**: JSONL → Pydantic models → Template rendering → HTML output

## Development Guidelines

### Testing Strategy
- **JS**: Vitest with jsdom environment, comprehensive mocking for Lit components
- **Python**: Categorized tests to avoid async event loop conflicts (unit/TUI/browser)
- Both use coverage reporting with configurable thresholds

### Code Quality
- **TypeScript**: Strict mode enabled, ESLint + Prettier for consistency
- **Python**: Ruff for formatting/linting, Pyright for strict type checking
- Both enforce comprehensive type safety

### WebSocket Protocol
The JS implementation uses a custom WebSocket protocol for real-time updates with message types, connection state management, and error handling.

### Shared Concepts
Both implementations handle:
- Claude Code transcript parsing
- Token usage tracking and visualization
- Session navigation and management
- HTML generation with filtering capabilities
- Date range filtering and chronological ordering

## Key Files to Understand

### JavaScript
- `js/shared/src/schemas/`: TypeScript interfaces matching Python models
- `js/backend/src/websocket/`: WebSocket server implementation
- `js/frontend/src/components/`: Lit web components
- `js/vitest.config.ts`: Comprehensive test configuration with alias mapping

### Python
- `python/claude_code_log/models.py`: Core data structures
- `python/claude_code_log/tui.py`: Terminal interface implementation
- `python/claude_code_log/templates/`: HTML template system
- `python/pyproject.toml`: Project configuration with test categorization

## Environment Setup
- **JS**: Node.js with npm workspaces, TypeScript path mapping
- **Python**: Python 3.12+ with uv package management, strict type checking enabled