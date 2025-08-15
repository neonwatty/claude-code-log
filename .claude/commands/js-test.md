## Context

- Current directory: !`pwd`
- Test pattern: "$ARGUMENTS"

## Your task

Run tests for the JavaScript project with optional filtering.

Steps:
1. Navigate to the JavaScript project directory: `cd js/`
2. Based on $ARGUMENTS or run all tests:
   - If "unit": `npm run test:unit` (unit tests only)
   - If "e2e": `npm run test:e2e` (Playwright tests only)
   - If "watch": `npm run test:watch` (watch mode)
   - If specific pattern: `npm test -- --testNamePattern="$ARGUMENTS"`
   - If empty: `npm test` (all Jest tests)
3. For e2e tests, ensure dev server is running first:
   - Start servers: `npm run dev` (in background)
   - Wait 5 seconds for startup
   - Run e2e tests: `npm run test:e2e`
4. Analyze test results:
   - Count passed/failed tests
   - Identify failing tests and error messages
   - Check test coverage if available
5. Report:
   - **Test Status**: PASS/FAIL
   - **Unit Tests**: X passed, Y failed
   - **E2E Tests**: X passed, Y failed (if run)
   - **Coverage**: Overall coverage percentage
   - **Failed Tests**: List failing test names and brief error descriptions
   - **Action Required**: Next steps for fixing failures