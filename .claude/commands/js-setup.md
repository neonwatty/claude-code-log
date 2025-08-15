## Context

- Current directory: !`pwd`
- Arguments: "$ARGUMENTS"

## Your task

Initialize and set up the JavaScript development environment with all necessary dependencies and configurations.

Steps:
1. Navigate to the JavaScript project directory: `cd js/`
2. Install all dependencies: `npm install`
3. Install Playwright browsers if Playwright is installed: `npx playwright install`
4. Create necessary configuration files if missing:
   - Create `jest.config.js` for Jest testing configuration
   - Create `.eslintrc.js` for ESLint configuration
   - Create `.prettierrc` for Prettier configuration
   - Create `playwright.config.ts` for Playwright configuration
5. Create test directory structure if missing:
   - `mkdir -p backend/__tests__`
   - `mkdir -p frontend/__tests__`
   - `mkdir -p shared/__tests__`
   - `mkdir -p tests/e2e`
6. Verify all workspaces are properly configured
7. Run initial build to verify setup: `npm run build`
8. Report setup status and any issues found