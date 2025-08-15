## Context

- Test directory: "$ARGUMENTS"
- Current directory: !`pwd`

## Your task

Run comprehensive build and test suite for the JavaScript Node.js/TypeScript monorepo, then provide a consolidated summary.

Steps:
1. Navigate to the JavaScript project directory: `cd js/`
2. Execute Node.js/TypeScript testing: Run /test-all-js command with any provided arguments
3. Wait for build and test processes to complete
4. Provide a succinct summary with:
   - **OVERALL STATUS**: PASS/FAIL
   - **TypeScript Build**: SUCCESS/FAIL (list compilation errors briefly if any)
   - **Backend Build**: SUCCESS/FAIL (Express server compilation)
   - **Frontend Build**: SUCCESS/FAIL (Vite build process)
   - **Unit Tests**: PASS/FAIL (number of tests run/passed/failed)
   - **Commit Ready**: YES/NO
   - **Action Required**: Next steps if builds or tests failed

DO NOT commit any code.
DO NOT change the version number.