# Claude Code Log - TypeScript

A TypeScript full-stack application for converting Claude Code transcript JSONL files into readable HTML format.

## Project Structure

```
js/
├── src/
│   ├── client/          # Lit frontend components
│   ├── server/          # Express.js backend
│   └── shared/          # Shared TypeScript interfaces
├── dist/                # Build output
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── vite.config.ts       # Vite build configuration
└── jest.config.ts       # Testing configuration
```

## Features

- **Express.js Backend**: RESTful API with WebSocket support
- **Lit Frontend**: Modern web components with reactive properties
- **TypeScript**: Full type safety across the stack
- **Real-time Updates**: WebSocket-based live updates
- **File System Monitoring**: Real-time file system watching
- **JSONL Parsing**: Efficient parsing of Claude Code transcripts
- **Session Management**: Organize and browse Claude sessions
- **Token Usage Tracking**: Monitor API usage and costs

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
cd js
npm install
```

### Development

Start both frontend and backend in development mode:

```bash
npm run dev
```

This will start:

- Frontend dev server: http://localhost:3000
- Backend API server: http://localhost:3001
- WebSocket server: ws://localhost:3001

### Build

Build for production:

```bash
npm run build
```

### Start Production Server

```bash
npm start
```

## Development Scripts

- `npm run dev` - Start development servers
- `npm run dev:server` - Start backend only
- `npm run dev:client` - Start frontend only
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run type-check` - TypeScript type checking

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/sessions` - Get all sessions
- `GET /api/sessions/:id` - Get specific session
- `GET /api/projects` - Get all projects
- `GET /api/stats` - Get session statistics

## WebSocket Events

- `connection` - Client connected
- `disconnect` - Client disconnected
- `join-session` - Join session room for updates
- `session-updated` - Session data updated
- `file-changed` - File system change detected

## Architecture

### Backend (Express.js + Socket.io)

- **Controllers**: Handle HTTP requests
- **Services**: Business logic and data processing
- **Middleware**: Request processing and validation
- **WebSocket**: Real-time communication
- **File Watcher**: Monitor file system changes

### Frontend (Lit + Vite)

- **Components**: Reusable web components
- **Pages**: Page-level components
- **Services**: API communication and state management
- **Utils**: Helper functions and utilities

### Shared

- **Types**: TypeScript interfaces and types
- **Interfaces**: Common data structures
- **Utils**: Shared utility functions

## Testing

```bash
npm test              # Run all tests
npm run test:watch    # Run tests in watch mode
```

## Code Quality

```bash
npm run lint          # Check code with ESLint
npm run lint:fix      # Fix ESLint issues
npm run format        # Format code with Prettier
npm run type-check    # TypeScript type checking
```

## Environment Variables

- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (development/production)
- `CLAUDE_PROJECTS_PATH` - Path to Claude projects directory

## Contributing

1. Follow TypeScript best practices
2. Write tests for new features
3. Use ESLint and Prettier for code formatting
4. Follow the existing project structure

## License

MIT
