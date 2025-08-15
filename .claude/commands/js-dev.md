## Context

- Current directory: !`pwd`
- Mode: "$ARGUMENTS" (backend, frontend, or both)

## Your task

Start the JavaScript development servers for local development.

Steps:
1. Navigate to the JavaScript project directory: `cd js/`
2. Check if dependencies are installed: `ls node_modules` (run `npm install` if missing)
3. Based on $ARGUMENTS or default behavior:
   - If "backend": `npm run dev:backend` (Express server only)
   - If "frontend": `npm run dev:frontend` (Vite dev server only)
   - If empty or "both": `npm run dev` (both servers concurrently)
4. Wait 5 seconds and verify servers are running:
   - Backend typically runs on http://localhost:3000
   - Frontend typically runs on http://localhost:5173
5. Use curl to check server health:
   - `curl -s http://localhost:3000/health` (backend health check)
   - `curl -s http://localhost:5173` (frontend index page)
6. Report server status:
   - **Backend Status**: RUNNING/FAILED (with port info)
   - **Frontend Status**: RUNNING/FAILED (with port info)
   - **URLs**: List accessible URLs for development
7. Note: Servers will continue running in background - use Ctrl+C to stop