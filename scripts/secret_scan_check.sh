#!/bin/sh
# R6 — secret-scan pre-commit gate. Blocks NEW secrets in staged changes.
#
# Motivation: a DB password (StavagentPortal2026!) was committed to history once.
# This scans ONLY added lines (git diff --cached) so it never blocks on a secret
# that already exists in a file you merely touched — it stops new ones landing.
#
# Bypass a single intentional line by appending the marker:  pragma: allowlist secret
# Bypass a whole commit (use sparingly):                     git commit --no-verify

# --- high-signal credential patterns (extended regex) ---
PATTERNS='-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16}|sk_live_[0-9A-Za-z]{16,}|rk_live_[0-9A-Za-z]{16,}|sk-stavagent-[0-9a-fA-F]{40,}|xox[baprs]-[0-9A-Za-z-]{10,}|gh[pousr]_[0-9A-Za-z]{36,}|AIza[0-9A-Za-z_-]{35}'

# credential = "literal" assignment (key : "value" or key = 'value')
ASSIGN='(pass(word|wd)?|pwd|secret|api[_-]?key|access[_-]?key|client[_-]?secret|auth[_-]?token|db[_-]?password)["'"'"']?[[:space:]]*[:=][[:space:]]*["'"'"'][^"'"'"']{6,}["'"'"']'

# values that are obviously NOT real secrets → ignored by the ASSIGN rule
PLACEHOLDER='\$\{|process\.env|os\.environ|getenv|<[^>]+>|xxxx|changeme|example|placeholder|your[_-]|redacted|\*\*\*|dummy|sample|test[_-]?(secret|token|key|password)'

tmp=$(mktemp)
current=""

git diff --cached --no-color -U0 --diff-filter=ACM | while IFS= read -r line; do
  case "$line" in
    '+++ '*)
      current=${line#+++ b/}
      ;;
    '+'*)
      content=${line#+}
      # respect an explicit allowlist marker on the line itself
      printf '%s' "$content" | grep -qiE 'pragma: allowlist secret' && continue
      hit=""
      if printf '%s' "$content" | grep -qE -e "$PATTERNS"; then
        hit="secret pattern"
      elif printf '%s' "$content" | grep -qiE "$ASSIGN" \
           && ! printf '%s' "$content" | grep -qiE "$PLACEHOLDER"; then
        hit="hardcoded credential"
      fi
      if [ -n "$hit" ]; then
        echo "❌ R6 $hit — $current"
        printf '     %.120s\n' "$(printf '%s' "$content" | sed 's/^[[:space:]]*//')"
        echo x >> "$tmp"
      fi
      ;;
  esac
done

if [ -s "$tmp" ]; then
  rm -f "$tmp"
  echo ""
  echo "Potential secret(s) in staged changes. Remove them, move to Secret Manager,"
  echo "or mark a false positive with:  pragma: allowlist secret"
  echo "Bypass (use sparingly): git commit --no-verify"
  exit 1
fi

rm -f "$tmp"
exit 0
