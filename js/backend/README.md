# Backend

Express.js backend API server for Claude Code Log application.

## Structure

```
backend/
├── src/
│   ├── app.ts              # Express app configuration and middleware
│   ├── server.ts           # Server entry point
│   ├── routes/             # API route handlers
│   │   └── index.ts        # Main router
│   ├── middleware/         # Custom middleware functions
│   ├── services/           # Business logic and external services
│   └── types/              # TypeScript type definitions
│       ├── express.ts      # Express extensions
│       └── index.ts        # Exports
├── tsconfig.json           # TypeScript configuration
└── dist/                   # Compiled JavaScript output
```

## Features

- Express.js with TypeScript
- Security middleware (Helmet, CORS)
- Compression and request parsing
- Error handling and 404 responses
- Environment variable configuration
- Hot reload with ts-node-dev

## Usage

```bash
# Development
npm run dev:backend

# Build
npm run build:backend
```

## Environment Variables

See `.env.example` for required configuration.

## API Endpoints

- `GET /health` - Health check
- `GET /api` - API information
- `GET /api/*` - API routes (mounted from routes/index.ts)
