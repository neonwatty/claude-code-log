## Context

- Test directory: "$ARGUMENTS"
- Current directory: !`pwd`

## Your task

Run Node.js/TypeScript build and tests for the monorepo workspace and resolve any resulting errors.
DO NOT commit any code.
DO NOT change the version number.

Steps:
1. If directory argument provided, navigate to that directory first
2. Run TypeScript compilation and build processes:
   - `npm run build` (builds both backend and frontend)
   - Or workspace-specific: `npm run build:backend` and `npm run build:frontend`
3. Check for TypeScript compilation errors
4. Run development server to verify functionality: `npm run dev`
5. Analyze any build failures or TypeScript errors
6. Fix the underlying issues causing build failures
7. Re-run build to verify fixes
8. Report final build and functionality status