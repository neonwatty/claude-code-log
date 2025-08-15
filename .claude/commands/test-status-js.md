## Context

- git status: !`git status`
- Explicitly mentioned file to fix: "$ARGUMENTS"

## Your task

Analyze git changes and generate automated test ideas for Node.js/TypeScript/Lit code.

Steps:
1. Focus primarily on files shown in git status output and any explicitly mentioned files
2. Run `git diff` on the emphasized files to see actual changes 
3. Check existing test coverage by examining relevant test files in `test/`, `__tests__/`, or `*.test.ts/js` files
4. Analyze the changes to understand:
   - New Lit components or custom elements added
   - Modified component logic, properties, or methods
   - New TypeScript utility functions or services
   - Express API endpoint changes
   - Frontend/backend integration changes
   - State management or data flow changes
5. Generate specific automated test cases that cover gaps in existing coverage:
   - Lit component tests (rendering, properties, events, lifecycle)
   - TypeScript unit tests for utilities, services, or helper functions
   - Express API endpoint tests (request/response, middleware)
   - Integration tests (frontend/backend communication)
   - Build process and TypeScript compilation tests
   - Edge cases and error conditions
6. Write actual TypeScript test code using appropriate testing frameworks
7. Include test setup, mocks, assertions, and cleanup as needed
8. Consider both frontend (Lit) and backend (Express) testing strategies