## Context

- Test directory: "$ARGUMENTS"
- Current directory: !`pwd`

## Your task

Run comprehensive test suite by executing both Rails and JavaScript tests in parallel, then provide a consolidated summary.

Steps:
1. Use the Task tool to launch two parallel agents:
   - Rails testing: Execute /test-all-rails command with any provided arguments
   - JavaScript testing: Execute /test-all-js command with any provided arguments

2. Wait for both test suites to complete

3. Provide a succinct summary with:
   - **OVERALL STATUS**: PASS/FAIL
   - **Rails**: X/Y tests passed (list failures briefly if any)
   - **JavaScript**: X/Y tests passed (list failures briefly if any)
   - **Commit Ready**: YES/NO
   - **Action Required**: Next steps if tests failed

DO NOT commit any code.
DO NOT change the version number.