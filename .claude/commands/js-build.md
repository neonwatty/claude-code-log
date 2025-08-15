## Context

- Current directory: !`pwd`
- Build target: "$ARGUMENTS" (backend, frontend, or both)

## Your task

Build the JavaScript project for production deployment.

Steps:
1. Navigate to the JavaScript project directory: `cd js/`
2. Clean any previous build artifacts:
   - `rm -rf backend/dist` (if exists)
   - `rm -rf frontend/dist` (if exists)
3. Based on $ARGUMENTS or build all:
   - If "backend": `npm run build:backend` (TypeScript compilation)
   - If "frontend": `npm run build:frontend` (Vite production build)
   - If empty or "both": `npm run build` (builds both)
4. Verify build outputs:
   - Check `backend/dist/` directory exists and contains compiled JS files
   - Check `frontend/dist/` directory exists and contains bundled assets
   - Verify main entry points exist
5. Run quick smoke test:
   - Test backend build: `node backend/dist/server.js` (kill after 3 seconds)
   - Check frontend bundle size and asset optimization
6. Report:
   - **Build Status**: SUCCESS/FAIL
   - **Backend Build**: File count and size in backend/dist/
   - **Frontend Build**: Bundle size and asset count in frontend/dist/
   - **TypeScript Errors**: List any compilation errors
   - **Build Time**: How long the build process took
   - **Production Ready**: YES/NO based on build success