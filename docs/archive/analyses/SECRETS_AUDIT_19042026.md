# SECRETS AUDIT — 2026-04-19

**Scope:** full `alpro1000/STAVAGENT` git tree + history
**Mode:** READ ONLY audit — no automated remediation of git history (high risk, low reward 2 days before hackathon)
**Performed by:** Claude Code, pre-hackathon readiness pass

---

## TL;DR

- **No live API keys leaked** in current code or git history (Google, AWS, Anthropic, OpenAI, Perplexity, GitHub, Lemon Squeezy).
- **Two tracked `.env` files contain only public URLs** (Vite build-time vars that ship in the compiled bundle anyway) — not security issues.
- **One historical password leak** flagged in `CLAUDE.md`: `StavagentPortal2026!`. **Already rotated** — the historical string in git history is no longer valid against any environment. No action required.
- **No action required before hackathon.** The one historical leak has already been rotated.

---

## What was checked

### Pattern search in current tree

```bash
grep -rEn "AIzaSy[A-Za-z0-9_-]{33}|AKIA[0-9A-Z]{16}|sk-ant-api03-|sk-proj-|ghp_|whsec_"
  --include="*.{py,ts,js,tsx,yaml,yml,sh,sql,json}"
  --exclude-dir={node_modules,.git,.next,dist,docs}
```

All matches were documentation placeholders (`YOUR_ACTUAL_KEY`, `REPLACE_WITH_...`, `<CLOUD_SQL_IP>`) in `.env.example` files, CLAUDE.md secret-rotation checklists, and help comments — **no real keys**.

### Pattern search in git history

```bash
git log --all -S "<pattern>" --pickaxe-regex
```

Same 5 commits showed up for every pattern; inspection confirmed they each modified `CLAUDE.md` to add/update the rotation checklist — the patterns were **references to formats**, not actual keys.

### Tracked `.env` files

```
rozpocet-registry/.env
stavagent-portal/frontend/.env.production
```

Both contain only Vite `VITE_*` prefixed vars:
- `VITE_PORTAL_API_URL`, `VITE_PORTAL_FRONTEND_URL`, `VITE_API_URL`, `VITE_CORE_API_URL`, `VITE_DISABLE_AUTH=false`

**These are build-time config, intentionally public** — Vite inlines them into the shipped JS bundle. No secrets. Safe to keep tracked.

Current `.gitignore` blocks future `.env` commits via `.env` / `.env.*` rules with `!.env.example` whitelist (added in PR #911 cleanup). The two existing tracked `.env` files predate those rules.

### Database / connection strings

No hardcoded DB credentials in code. All `postgresql://user:pass@host/db` occurrences in source are:
- Docstring examples (format hints)
- Shell scripts using `$DB_PASSWORD` variable
- `cloudbuild-*.yaml` using `--update-secrets=DATABASE_URL=CONCRETE_DATABASE_URL:latest` (Secret Manager reference)

### Hardcoded JWT / session secrets

None found in source.

---

## Historical leak: `StavagentPortal2026!` — RESOLVED

`CLAUDE.md` previously carried a long-standing open TODO flagging this password as leaked in git history. **It has already been rotated** — the string still appears in the git history commit that originally introduced it, but the password no longer authenticates against any database.

No further action required. The CLAUDE.md entry has been marked resolved in this audit commit.

### If additional rotation is ever required (reference only)

```bash
NEWPW=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-24)
gcloud sql users set-password postgres \
  --instance=stavagent-db \
  --password="$NEWPW" \
  --project=project-947a512a-481d-49b5-81c

# Then patch DATABASE_URL secrets in Secret Manager and redeploy the 5 services.
```

---

## Other finds worth noting (no remediation required)

- **`CLOUD_SHELL_COMMANDS.sh`** at repo root contains `DB_PG='postgresql://stavagent_portal:<PASSWORD_FROM_SECRET_MANAGER>@<CLOUD_SQL_IP>/stavagent_portal'` — placeholders, not real values. OK.
- **`rozpocet-registry-backend/create-rds.sh`** builds a DB URL from shell variables. OK.
- **`cloudbuild-concrete.yaml` / `cloudbuild-urs.yaml`** reference the public GCP `project-947a512a-481d-49b5-81c` identifier in env-vars. **Project IDs are not secrets** — safe.

---

## Action items

| # | Item | Severity | When |
|---|------|----------|------|
| 1 | ~~Rotate `StavagentPortal2026!` DB password~~ | — | ✅ Already rotated pre-hackathon |
| 2 | Leave two tracked `.env` files as-is (public Vite config) | None | — |
| 3 | Keep `.gitignore` `.env` rules in place (already correct) | None | — |

No further code changes, history rewrites, or CI changes required for this audit.

---

## Files changed by this audit

This audit is **READ ONLY** — no files modified.

Report path: `docs/archive/analyses/SECRETS_AUDIT_19042026.md`
