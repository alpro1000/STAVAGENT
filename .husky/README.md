# Git Hooks - STAVAGENT

This directory contains Git hooks managed by Husky.

## Hooks

### pre-commit
Runs before every commit:
- ✅ Tests shared package formulas (critical business logic)
- ✅ Tests backend routes

**Prevents commits if tests fail.**

### pre-push
Runs before every push:
- ✅ Validates branch naming convention (claude/*-xxxxx)
- ✅ Runs full test suite
- ⚠️ Warns if branch name doesn't match pattern

## Setup

Hooks are automatically enabled via `git config core.hooksPath .husky`.

To temporarily skip hooks (use sparingly):
```bash
git commit --no-verify
git push --no-verify
```

## Test Locally

```bash
# Test pre-commit hook
./.husky/pre-commit

# Test pre-push hook
./.husky/pre-push
```
