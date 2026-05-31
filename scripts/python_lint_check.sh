#!/bin/sh
# R2 — Python format/lint gate for concrete-agent (ruff + black). NO mypy.
#
# Runs from .husky/pre-commit. Checks ONLY the staged Python files under
# concrete-agent/ that are part of this commit — it never reformats files and
# never touches code outside the commit. Blocks the commit if a staged file is
# not black-formatted or trips a real-bug ruff check.
#
# Scope rationale:
#   black  --check   → formatting consistency on the files you are committing.
#   ruff   --select=E9,F63,F7,F82
#                    → syntax errors, undefined names, broken f-strings/compares.
#                      Deliberately NOT the full style ruleset: the core-backend
#                      was never linted, so style rules would block every commit
#                      and fight the "don't touch unrelated code" convention.
#
# Bypass (use sparingly): git commit --no-verify

REPO_ROOT="$(git rev-parse --show-toplevel)"

# Staged (added/copied/modified) Python files under concrete-agent/.
files=$(git diff --cached --name-only --diff-filter=ACM -- concrete-agent | grep -E '\.py$')
[ -z "$files" ] && exit 0

have() { command -v "$1" >/dev/null 2>&1; }

if ! have black && ! have ruff; then
  echo "⚠️  R2: neither black nor ruff installed — skipping Python gate."
  echo "    pip install black ruff   (see concrete-agent/packages/core-backend/requirements.txt)"
  exit 0
fi

status=0

if have black; then
  if ! printf '%s\n' "$files" | xargs black --check --quiet 2>/dev/null; then
    echo "❌ R2 black: staged Python is not formatted."
    echo "   Fix: black $(printf '%s ' $files)"
    status=1
  fi
else
  echo "⚠️  R2: black not installed — formatting check skipped."
fi

if have ruff; then
  if ! printf '%s\n' "$files" | xargs ruff check --select=E9,F63,F7,F82 2>/dev/null; then
    echo "❌ R2 ruff: real-bug check failed (syntax / undefined name / f-string)."
    echo "   Fix: ruff check --select=E9,F63,F7,F82 $(printf '%s ' $files)"
    status=1
  fi
else
  echo "⚠️  R2: ruff not installed — lint check skipped."
fi

if [ $status -ne 0 ]; then
  echo ""
  echo "To bypass (use sparingly): git commit --no-verify"
fi

exit $status
