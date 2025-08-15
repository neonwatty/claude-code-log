## Context

- Test directory: "$ARGUMENTS"
- Current directory: !`pwd`

## Your task

Run comprehensive build and test suite for the Node.js/TypeScript monorepo, then provide a consolidated summary.

Steps:
1. Execute Node.js/TypeScript testing: Run /test-all-js command with any provided arguments

2. Wait for build and test processes to complete

3. Provide a succinct summary with:
   - **OVERALL STATUS**: PASS/FAIL
   - **TypeScript Build**: SUCCESS/FAIL (list compilation errors briefly if any)
   - **Backend Build**: SUCCESS/FAIL (Express server compilation)
   - **Frontend Build**: SUCCESS/FAIL (Vite build process)
   - **Commit Ready**: YES/NO
   - **Action Required**: Next steps if builds failed

DO NOT commit any code.
DO NOT change the version number.