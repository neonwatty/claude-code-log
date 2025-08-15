## Context

- git status: !`git status`
- Explicitly mentioned file to fix: "$ARGUMENTS"

## Your task

Analyze git changes and create temporary Playwright tests to verify new code works properly through browser automation.

Steps:
1. Focus primarily on files shown in git status output and any explicitly mentioned files
2. Run `git diff` on the emphasized files to see actual changes 
3. Analyze the changes to understand:
   - New UI components or pages added
   - Modified user interactions or behaviors
   - Form submissions and validations
   - Navigation and routing changes
   - Authentication flows
   - Dynamic content updates
   - API integration points visible to users
4. Create actual Playwright test files for the changes:
   - Generate temporary test files in `tests/temp/` or similar directory
   - Use proper @playwright/test syntax with `test()` and `expect()`
   - Include realistic selectors and user workflows
   - Add comprehensive assertions for expected behaviors
   - Include proper setup, navigation, and cleanup
5. Create test files that cover:
   - Page load and rendering verification
   - User interaction flows (clicks, form fills, navigation)
   - Form validation and submission
   - Authentication and authorization flows
   - Dynamic content updates and state changes
   - Error handling and edge cases
6. Provide instructions for:
   - Running the temporary tests: `npx playwright test tests/temp/`
   - Moving successful tests to permanent test suite
   - Cleaning up temporary test files
7. Create a summary file listing all generated tests and their purposes