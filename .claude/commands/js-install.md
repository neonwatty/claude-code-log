## Context

- Current directory: !`pwd`
- Package to install: "$ARGUMENTS"

## Your task

Install or update dependencies for the JavaScript project.

Steps:
1. Navigate to the JavaScript project directory: `cd js/`
2. If $ARGUMENTS is provided:
   - Install specific package: `npm install $ARGUMENTS`
   - Or install as dev dependency: `npm install --save-dev $ARGUMENTS`
   - Ask user which type of dependency if unclear
3. If no $ARGUMENTS provided:
   - Update all dependencies: `npm install`
   - Check for outdated packages: `npm outdated`
4. Install Playwright browsers if @playwright/test was installed: `npx playwright install`
5. Verify installation by running:
   - `npm run build` (ensure build still works)
   - `npm audit` (check for security vulnerabilities)
6. Report:
   - **Packages Installed**: List new packages added
   - **Build Status**: SUCCESS/FAIL after installation
   - **Security Issues**: Any vulnerabilities found
   - **Action Required**: Fix any breaking changes or vulnerabilities