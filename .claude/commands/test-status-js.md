## Context

- git status: !`git status`
- Explicitly mentioned file to fix: "$ARGUMENTS"

## Your task

Analyze git changes in the JavaScript project and generate automated test ideas for Node.js/TypeScript/Lit code.

Steps:
1. Navigate to the JavaScript project directory: `cd js/`
2. Focus primarily on files shown in git status output and any explicitly mentioned files
3. Run `git diff` on the emphasized files to see actual changes 
4. Check existing test coverage by examining relevant test files in:
   - `backend/__tests__/`, `backend/src/**/*.test.ts`
   - `frontend/__tests__/`, `frontend/src/**/*.test.ts`
   - `shared/__tests__/`, `shared/src/**/*.test.ts`
5. Analyze the changes to understand:
   - New Lit components or custom elements added in frontend/
   - Modified component logic, properties, or methods
   - New TypeScript utility functions or services in shared/
   - Express API endpoint changes in backend/
   - Frontend/backend integration changes
   - State management or data flow changes
6. Generate specific automated test cases that cover gaps in existing coverage:
   - Lit component tests (rendering, properties, events, lifecycle)
   - TypeScript unit tests for utilities, services, or helper functions
   - Express API endpoint tests (request/response, middleware)
   - Integration tests (frontend/backend communication)
   - Build process and TypeScript compilation tests
   - Edge cases and error conditions
7. Write actual TypeScript test code using Jest and appropriate testing frameworks
8. Include test setup, mocks, assertions, and cleanup as needed
9. Consider both frontend (Lit) and backend (Express) testing strategies
10. Place test files in appropriate workspace directories