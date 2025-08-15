## Context

- git status: !`git status`
- Explicitly mentioned file to fix: "$ARGUMENTS"

## Your task

Analyze git changes in the JavaScript project and create temporary Playwright tests to verify new code works properly through browser automation.

Steps:
1. Navigate to the JavaScript project directory: `cd js/`
2. Check if Playwright is installed: `npx playwright --version` (install if missing)
3. Focus primarily on files shown in git status output and any explicitly mentioned files
4. Run `git diff` on the emphasized files to see actual changes 
5. Analyze the changes to understand:
   - New UI components or pages added in frontend/
   - Modified user interactions or behaviors
   - Form submissions and validations
   - Navigation and routing changes
   - Authentication flows
   - Dynamic content updates
   - API integration points visible to users
6. Create actual Playwright test files for the changes:
   - Generate temporary test files in `tests/temp/` directory
   - Use proper @playwright/test syntax with `test()` and `expect()`
   - Include realistic selectors and user workflows
   - Add comprehensive assertions for expected behaviors
   - Include proper setup, navigation, and cleanup
7. Create test files that cover:
   - Page load and rendering verification
   - User interaction flows (clicks, form fills, navigation)
   - Form validation and submission
   - Authentication and authorization flows
   - Dynamic content updates and state changes
   - Error handling and edge cases
8. Provide instructions for:
   - Starting the dev server: `npm run dev`
   - Running the temporary tests: `npm run test:e2e tests/temp/`
   - Moving successful tests to permanent test suite
   - Cleaning up temporary test files
9. Create a summary file listing all generated tests and their purposes