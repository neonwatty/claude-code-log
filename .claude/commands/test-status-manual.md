## Context

- git status: !`git status`
- Explicitly mentioned file to fix: "$ARGUMENTS"

## Your task

Analyze git changes and suggest manual testing ideas to verify new code works properly.

Steps:
1. Focus primarily on files shown in git status output and any explicitly mentioned files
2. Run `git diff` on the emphasized files to see actual changes 
3. Analyze the changes to understand:
   - New features or functionality added
   - Modified business logic or behavior
   - UI/UX changes
   - Database schema changes
   - API endpoints or routing changes
4. Propose specific manual test cases that cover:
   - Happy path scenarios for new features
   - Edge cases and error conditions
   - Integration points between components
   - User workflows that touch modified code
   - Data validation and security concerns
5. Format as actionable test steps a human can follow