## Context

- Test directory: "$ARGUMENTS"
- Current directory: !`pwd`

## Your task

Run Node.js/TypeScript build and tests for the JavaScript monorepo workspace and resolve any resulting errors.
DO NOT commit any code.
DO NOT change the version number.

Steps:
1. Navigate to the JavaScript project directory: `cd js/`
2. Install dependencies if needed: `npm install`
3. Run TypeScript compilation and build processes:
   - `npm run build` (builds both backend and frontend)
   - Or workspace-specific: `npm run build:backend` and `npm run build:frontend`
4. Run unit tests: `npm test`
5. Check for TypeScript compilation errors and test failures
6. Run development server to verify functionality: `timeout 10s npm run dev` (auto-kill after 10s)
7. Analyze any build failures, TypeScript errors, or test failures
8. Fix the underlying issues causing failures
9. Re-run build and tests to verify fixes
10. Report final build, test, and functionality status