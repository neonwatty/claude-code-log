# Getting Started with Claude Code Log

This guide will help you quickly set up and start using Claude Code Log to analyze your Claude conversations.

## Quick Setup

### Prerequisites

- Node.js 18+ 
- npm 7+
- Modern web browser

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd claude-code-log/js

# Install dependencies
npm install

# Start development servers
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## Basic Usage

1. **Import JSONL Files**: Place your Claude conversation JSONL files in the project directory
2. **Start the Server**: Run `npm run dev` to launch both frontend and backend
3. **Access the Interface**: Open http://localhost:5173 in your browser
4. **Analyze Sessions**: Browse and analyze your conversation history

## Next Steps

- [Project Architecture](./architecture.md) - Understand the system design
- [Configuration](./configuration.md) - Customize your setup
- [Troubleshooting](./troubleshooting.md) - Resolve common issues

## Need Help?

Check our [troubleshooting guide](./troubleshooting.md) or explore the [examples](../examples/) for common usage patterns.