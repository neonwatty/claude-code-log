## Context

- git status: !`git status`
- Explicitly mentioned file to fix: "$ARGUMENTS"

## Your task

Run comprehensive pre-commit testing analysis by executing test status commands in parallel.

Steps:
1. Use the Task tool to launch two parallel agents:
   - TypeScript/Node.js testing analysis: Execute /test-status-js command
   - Manual testing analysis: Execute /test-status-manual command

2. Wait for both analyses to complete

3. Provide a succinct summary with:
   - **STATUS**: READY/NEEDS_WORK/BLOCKED
   - **TypeScript/Build Tests Needed**: Brief list of missing test coverage
   - **Manual Tests**: 3-5 key manual verification steps
   - **Blockers**: Critical issues preventing commit (if any)

DO NOT commit any code.