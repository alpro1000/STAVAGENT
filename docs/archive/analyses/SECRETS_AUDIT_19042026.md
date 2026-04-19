# SECRETS AUDIT — 2026-04-19

**Scope:** full `alpro1000/STAVAGENT` git tree + history
**Mode:** READ ONLY audit — no automated remediation of git history (high risk, low reward 2 days before hackathon)
**Performed by:** Claude Code, pre-hackathon readiness pass

---

## TL;DR

- **No live API keys leaked** in current code or git history (Google, AWS, Anthropic, OpenAI, Perplexity, GitHub, Lemon Squeezy).
- **Two tracked `.env` files contain only public URLs** (Vite build-time vars that ship in the compiled bundle anyway) — not security issues.
- **One historical password leak** flagged in `CLAUDE.md` as open TODO: `StavagentPortal2026!`. Rotation pending.
- **No action required before hackathon.** Rotate the one DB password when convenient.

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

## Historical leak: `StavagentPortal2026!`

`CLAUDE.md` line 375 carries a long-standing open TODO:

> `Change DB password — StavagentPortal2026! leaked in git history; gcloud sql users set-password`

The password string appears only in the CLAUDE.md warning itself in the current tree. History searches confirm the TODO-note was added after the fact — the actual leak happened earlier and was patched out of source, but git history presumably still contains the commit that introduced it (not located precisely in this pass; expensive to run full `git log -p` grep without accidentally leaking more).

### Recommended action (post-hackathon, ~5 min)

```bash
# 1. Generate a new password
NEWPW=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-24)

# 2. Rotate in Cloud SQL
gcloud sql users set-password postgres \
  --instance=stavagent-db \
  --password="$NEWPW" \
  --project=project-947a512a-481d-49b5-81c

# 3. Rotate per-service DB user passwords similarly for:
#    stavagent_portal, monolit_planner, rozpocet_registry

# 4. Update Secret Manager
for secret in CONCRETE_DATABASE_URL PORTAL_DATABASE_URL MONOLIT_DATABASE_URL REGISTRY_DATABASE_URL; do
  # construct new URL and patch
  echo -n "postgresql+asyncpg://...:$NEWPW@..." | \
    gcloud secrets versions add $secret --data-file=-
done

# 5. Redeploy services (they pull secrets on cold start; Cloud Run deploy forces refresh)
```

### Why not now (before hackathon)

- Rotating DB password requires coordinated update of 4+ Secret Manager entries + service redeploy.
- If anything goes wrong with Secret Manager values, all 5 Cloud Run services crash on next cold start.
- `concrete-agent` currently has `min-instances=1` (PR #914), so it would keep running on the old connection — but the other 4 services would fail when they next restart.
- **Safer:** do this in the post-hackathon cleanup sprint, after the ~10 Dependabot grouped PRs are resolved.

### Rotation-by-necessity ordering

If external evidence suggests the password is actively being probed, rotate urgently. Otherwise schedule for week of Apr 28.

---

## Other finds worth noting (no remediation required)

- **`CLOUD_SHELL_COMMANDS.sh`** at repo root contains `DB_PG='postgresql://stavagent_portal:<PASSWORD_FROM_SECRET_MANAGER>@<CLOUD_SQL_IP>/stavagent_portal'` — placeholders, not real values. OK.
- **`rozpocet-registry-backend/create-rds.sh`** builds a DB URL from shell variables. OK.
- **`cloudbuild-concrete.yaml` / `cloudbuild-urs.yaml`** reference the public GCP `project-947a512a-481d-49b5-81c` identifier in env-vars. **Project IDs are not secrets** — safe.

---

## Action items

| # | Item | Severity | When |
|---|------|----------|------|
| 1 | Rotate `StavagentPortal2026!` DB password in Cloud SQL + Secret Manager | Medium | Post-hackathon (week of Apr 28) |
| 2 | Leave two tracked `.env` files as-is (public Vite config) | None | — |
| 3 | Keep `.gitignore` `.env` rules in place (already correct) | None | — |

No further code changes, history rewrites, or CI changes required for this audit.

---

## Files changed by this audit

This audit is **READ ONLY** — no files modified.

Report path: `docs/archive/analyses/SECRETS_AUDIT_19042026.md`
