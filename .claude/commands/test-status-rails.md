## Context

- git status: !`git status`
- Explicitly mentioned file to fix: "$ARGUMENTS"

## Your task

Analyze git changes and generate automated test ideas for Rails code.

Steps:
1. Focus primarily on files shown in git status output and any explicitly mentioned files
2. Run `git diff` on the emphasized files to see actual changes 
3. Check existing test coverage by examining relevant test files in `test/` directory
4. Analyze the changes to understand:
   - New models, controllers, or services added
   - Modified business logic or behavior
   - Database schema changes or migrations
   - API endpoints or routing changes
   - New helper methods or utilities
5. Generate specific automated test cases that cover gaps in existing coverage:
   - Model tests (validations, associations, scopes, methods)
   - Controller tests (actions, responses, authentication, authorization)
   - Integration tests (request/response flows, user workflows)
   - Unit tests for services, helpers, or utility classes
   - Edge cases and error conditions
6. Write actual Ruby test code using Rails minitest conventions
7. Include test setup, fixtures, assertions, and cleanup as needed
8.  DO NOT commit any code.