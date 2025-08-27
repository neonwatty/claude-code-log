# Shared

Shared TypeScript interfaces, types, and constants used across frontend and backend.

## Structure

```
shared/
├── src/
│   ├── index.ts            # Main exports
│   ├── interfaces/         # Core interface definitions
│   │   └── index.ts        # Session, message, and transcript interfaces
│   ├── types/              # Type utilities and aliases
│   │   └── index.ts        # Helper types and pagination
│   └── constants/          # Application constants
│       └── index.ts        # Enums, endpoints, defaults
├── types.ts                # Legacy types (for compatibility)
├── tsconfig.json           # TypeScript configuration
└── package.json            # Package configuration
```

## Features

- **TypeScript Interfaces**: Matching Python Pydantic models
- **Type Utilities**: Pagination, filtering, aggregation types
- **Constants**: API endpoints, enums, defaults
- **Legacy Support**: Backward compatibility with existing code

## Usage

### Import Specific Interfaces

```typescript
import { ISession, ITranscriptEntry, ITodoItem } from "@shared";
```

### Import Types and Constants

```typescript
import { MessageRole, TODO_STATUSES, API_ENDPOINTS } from "@shared";
```

### Import Everything

```typescript
import * as Shared from "@shared";
```

## Key Interfaces

- **ISession**: Claude Code session with transcripts and metadata
- **ITranscriptEntry**: Individual messages (user, assistant, system, summary)
- **IUsageInfo**: Token usage tracking
- **ITodoItem**: Todo list items
- **IContentItem**: Message content (text, tool use, images, etc.)

## Building

```bash
# Build shared module
cd shared
npm run build

# Watch mode
npm run dev
```

## Path Mapping

The shared module is available via TypeScript path mapping:

- `@shared` → `./shared/src/index`
- `@shared/*` → `./shared/src/*`
- `@shared/types` → `./shared/types` (legacy)
