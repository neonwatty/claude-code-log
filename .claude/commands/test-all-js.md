## Context

- Test directory: "$ARGUMENTS"
- Current directory: !`pwd`

## Your task

Run npm/JavaScript tests and resolve any resulting errors.
DO NOT commit any code.
DO NOT change the version number.

Steps:
1. If directory argument provided, navigate to that directory first
2. Run `npm test $ARGUMENTS` (or just `npm test` if no specific directory)
3. Analyze any test failures or errors
4. Fix the underlying issues causing test failures
5. Re-run tests to verify fixes
6. Report final test status