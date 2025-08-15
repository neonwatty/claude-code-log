## Context

- Current directory: !`pwd`
- Fix specific files: "$ARGUMENTS"

## Your task

Run linting and formatting checks/fixes for the JavaScript project.

Steps:
1. Navigate to the JavaScript project directory: `cd js/`
2. Run ESLint to check for code issues:
   - `npm run lint` (check all files)
   - If specific files provided in $ARGUMENTS: `npx eslint $ARGUMENTS`
3. Run Prettier to check formatting:
   - `npm run format:check` (check all files)
   - If specific files provided: `npx prettier --check $ARGUMENTS`
4. If fixes are needed:
   - Run `npm run lint:fix` to auto-fix ESLint issues
   - Run `npm run format` to auto-format code
5. Report any remaining issues that require manual fixes
6. Verify TypeScript compilation still works: `npm run build`
7. Provide summary of:
   - ESLint issues found/fixed
   - Formatting issues found/fixed
   - Any remaining manual fixes needed