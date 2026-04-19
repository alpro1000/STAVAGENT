# Hackathon Final Checklist

**Deadline:** April 21, 2026 — Built with Opus 4.7 hackathon start.

This file lists the manual actions that cannot be automated. Work top-to-bottom; each item should take 2–15 minutes.

---

## 1. GitHub profile (5 min)

Judges often click the maintainer's profile before they open the code.

- [ ] Pin `STAVAGENT` repo to the top of https://github.com/alpro1000
- [ ] Update profile bio (suggestion, edit to taste): *"Solo developer of STAVAGENT — AI for Czech civil construction. Construction estimator by profession."*
- [ ] Profile picture: professional headshot or STAVAGENT logo (avoid the default GitHub identicon)
- [ ] Confirm public email / location / website fields match `README.md` contact info

---

## 2. Repository polish (5 min)

- [ ] Repo description on GitHub: *"AI-powered construction cost estimation platform for Czech/Slovak markets — MCP Server with 9 domain tools."*
- [ ] Topics / tags: `mcp-server` `fastmcp` `construction` `czech` `claude` `cloud-run` `fastapi` `react`
- [ ] Uncheck "Releases", "Packages" sidebar items if empty (they draw attention to nothing)
- [ ] Verify the Security tab shows Dependabot configured and active

---

## 3. Screenshots for README (10–15 min)

`README.md` has one image placeholder (`docs/images/calculator.png`). Add real screenshots before the hackathon — the placeholder reads as incomplete.

Take and commit:

- [ ] `docs/images/calculator.png` — Monolit Planner Part B with a real calculation result (concrete + formwork + rebar + schedule KPI cards visible)
- [ ] `docs/images/project-view.png` — project overview with parsed positions list
- [ ] `docs/images/mcp-tools.png` — Claude Desktop showing the 9 STAVAGENT tools in its MCP manifest
- [ ] Optional: `docs/images/tz-upload.png` — the moment of uploading a 200-page TZ
- [ ] Update README image references if you change filenames
- [ ] Commit screenshots on a dedicated branch (`hackathon/readme-screenshots`) and merge so they land on `main` before 21.04

**Tip:** use a clean browser window (no dev tools, no password manager overlay), 1440×900 resolution, light mode for better JPEG compression.

---

## 4. Secrets — nothing urgent

Per `docs/archive/analyses/SECRETS_AUDIT_19042026.md`:

- ✅ No live API keys leaked anywhere in the tree or history.
- ✅ The historical `StavagentPortal2026!` password has **already been rotated** — nothing to do.
- ✅ The two tracked `.env` files contain only public Vite `VITE_*` URLs (build-time config, public by design).

No action required before hackathon.

---

## 5. Production smoke test (30–45 min)

Run through `docs/HACKATHON_DEMO_VERIFICATION.md` end-to-end. Cover:

- [ ] Section 1 — all 4 subdomains return 2xx in a fresh incognito window
- [ ] Section 2 — registration flow incl. welcome bonus 200 credits
- [ ] Section 3 — core demo on `kalkulator.stavagent.cz` (upload Excel → positions → calculator → OTSKP codes)
- [ ] Section 4 — MCP manifest returns the 9 tools
- [ ] Section 5 — state persistence after 15-minute idle (validates `min-instances=1` on `concrete-agent`)
- [ ] Section 6 — DB smoke test (validates Cloud SQL Auth Proxy still works after `authorized-networks` cleanup)

If anything fails, fix or document before the hackathon. Do not demo an untested flow.

---

## 6. Pre-warm services before demo (5 min, day-of)

Cloud Run can spin up slow on first request after idle. Warm everything before the demo:

- [ ] `curl -sI https://concrete-agent-1086027517695.europe-west3.run.app/docs`
- [ ] `curl -sI https://stavagent-portal-backend-1086027517695.europe-west3.run.app/health`
- [ ] `curl -sI https://monolit-planner-api-1086027517695.europe-west3.run.app/health`
- [ ] `curl -sI https://urs-matcher-service-1086027517695.europe-west3.run.app/health`
- [ ] `curl -sI https://rozpocet-registry-backend-1086027517695.europe-west3.run.app/health`
- [ ] Visit each Vercel frontend URL once (www, kalkulator, klasifikator, registry)
- [ ] Open one test project on `kalkulator.stavagent.cz` to pre-warm DB connection pool

---

## 7. Demo environment (day-of)

- [ ] Laptop fully charged; charger packed
- [ ] Stable WiFi confirmed (test bandwidth on the network you'll use)
- [ ] Mobile hotspot ready as backup
- [ ] Backup laptop available (if possible)
- [ ] Browser bookmarks ready: login page, calculator, MCP docs page
- [ ] Two test projects prepared in advance (one bridge TZ, one building rozpočet)
- [ ] Slack / email muted during demo
- [ ] Terminal open with `gcloud` signed in to `project-947a512a-481d-49b5-81c` in case of live fixes

---

## 8. Post-hackathon cleanup (do not do before 21.04)

Defer everything below until after the hackathon — these are for the week of April 28.

- [ ] Merge the ~10 grouped Dependabot PRs (minor/patch only; major bumps are ignored by the new config)
- [ ] Investigate URS Matcher test failure on axios 1.15 / lodash 4.18 (from BACKLOG follow-up)
- [ ] Migrate `project_store` from in-memory dict to PostgreSQL (BACKLOG #7)
- [ ] VPC connector for Cloud SQL private IP (BACKLOG #4)
- [ ] Integration endpoint auth — `X-Service-Key` header (BACKLOG #8)
- [ ] Node 18 → 20/22 migration for `stavagent-portal` and `URS_MATCHER_SERVICE/Dockerfile.backend` (BACKLOG #6)
- [ ] Refresh `concrete-agent/CLAUDE.md` from v2.5.0 (currently 5 months stale)
- [ ] Decide `Monolit-Planner/CLAUDE.MD` vs `Monolit-Planner/claude.md` duplication (two different files, both kept by the cleanup task per owner's direction)

---

## Progress log

Keep this at the bottom; strike through items as you complete them, or leave a short note.

```
Date:       __________
Completed:  __________
Blockers:   __________
Ready for hackathon?  [ ] yes   [ ] no — reason: _____________
```
