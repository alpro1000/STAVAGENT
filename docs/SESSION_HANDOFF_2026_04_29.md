# Session Handoff — 2026-04-29

**Cost-optimization sweep + 3 PRs (classification roundtrip, kill legacy ribbon flag, remove broken Portal pull) + Cloud SQL HA→ZONAL.**

Single-file handoff so a future Claude session (or you, fresh tomorrow) picks up the full context without re-deriving from logs / git history.

---

## 1. Production state at end of session

### Cloud Run

| Service | Region | Active revision | Min-instances | Notes |
|---|---|---|---|---|
| `concrete-agent` | europe-west3 | (latest) | **0** (was 1) | KB re-loads on cold start; in-memory cache lost — accepted trade-off |
| `stavagent-portal-backend` | europe-west3 | `00259-q28` (29.04 06:23 UTC) | 0 | Carries PR #1045 cookie fallback + #1051 splitter; verified live this session |
| `monolit-planner-api` | europe-west3 | (latest) | 0 | Untouched this session |
| `urs-matcher-service` | europe-west3 | (latest) | 0 | Untouched |
| `rozpocet-registry-backend` | europe-west3 | (latest) | 0 | Untouched |
| `mineru-service` | europe-west1 | (latest) | 0 | Untouched |

Phantom revision `stavagent-portal-backend-00258-nzh` (28.04 12:55 UTC, manual deploy by `alpro1000@gmail.com`, 0% traffic) still present — safe to delete:
```bash
gcloud run revisions delete stavagent-portal-backend-00258-nzh --region=europe-west3 --quiet
```

### Cloud SQL — `stavagent-db` (postgres 15)

- Tier: `db-f1-micro`
- **Availability type: ZONAL** (was REGIONAL — switched this session, 11:46 patch operation `dca328de-4c50-442d-a993-f1390000002e`, `STATUS: DONE`)
- Disk: 10 GB SSD, backups enabled
- Both backends (`stavagent_portal`, `rozpocet_registry`) reconnected automatically; live `curl /api/health` returned 200 within 60s of patch completion.

### Artifact Registry — `stavagent` (europe-west3)

- Cleanup policy applied: `keep-last-5` versions per image + `delete-older-than-30d`. Active (not dry-run).
- Pre-cleanup size: **663 GB** (1023 images across 6 repos).
- Expected post-cleanup: 30–80 GB after the background job finishes (~24h).

### Cloud Logging

- `_Default` bucket retention: **7 days** (was 30 days).
- `_Required` bucket: 400 days, locked (admin audit, mandatory).

### Vercel

| Project | Domain | Notes |
|---|---|---|
| stavagent-portal | www.stavagent.cz, kalkulator.stavagent.cz | **`VITE_DISABLE_AUTH=true` in production** — see §4 outstanding bug |
| stavagent-registry | registry.stavagent.cz | Auto-deploys on `main` push for `rozpocet-registry/**` paths |
| stavagent-kalkulator | kalkulator.stavagent.cz | Untouched |
| optimarket | optimarket.net | Unrelated to STAVAGENT |

---

## 2. Cost optimization sweep — 5 fixes deployed

User context: free-trial credit (Kč721.97) expires **2026-05-28**. Pre-sweep monthly burn ~Kč3,279 (~$155). Goal: cut burn below the runway so post-trial bills stay survivable.

| # | Fix | Cmd / artifact | Savings/mo |
|---|---|---|---|
| **A** | Cloud SQL `availabilityType` **REGIONAL → ZONAL** | `gcloud sql instances patch stavagent-db --availability-type=zonal` | ~$10 |
| **B** | concrete-agent `min-instances` **1 → 0** | `gcloud run services update concrete-agent --region=europe-west3 --min-instances=0` | $5–10 |
| **C** | Cloud Run old revisions cleanup (kept last 5 per service) | for-loop over 6 services with `gcloud run revisions delete` (active rev refused — by design) | <$1 |
| **D** | Artifact Registry cleanup policy (keep-last-5 + delete >30d) | `gcloud artifacts repositories set-cleanup-policies stavagent --policy=/tmp/cleanup-policy.json --no-dry-run` | **~$50–60** |
| **E** | Logging `_Default` retention 30 → 7 days | `gcloud logging buckets update _Default --location=global --retention-days=7` | $0–2 |

**Total estimated: ~$70–90/mo cut.** D dwarfs everything else (663 GB → ~30–80 GB). The original estimate before running the diagnostic put D at $1–5/mo — actual is ~10× larger because the registry had silently grown to 663 GB across 6 image streams.

### Caveats / things to watch
- **Bug C (cold-start timeouts)** *not* fixed — would have needed `min-instances=1` on Portal + Registry backends (~$10–30/mo extra). User explicitly declined for budget reasons. Symptoms in next session: "Sync timeout — Portal may be sleeping" warnings ×N on first reload after long idle. Resolves on its own once Cloud Run warms up. Not a real bug.
- **concrete-agent in-memory state**: CLAUDE.md noted the `min-instances=1` was there to preserve in-memory state. After fix B, first call after idle re-loads KB (~40 MB JSON) in 1–2s. Multi-role conversation state lost on cold start. Acceptable per user decision.
- **AR cleanup is a background job** — first invocation runs within ~24h, then daily. Verify shrink with:
  ```bash
  gcloud artifacts repositories describe stavagent --location=europe-west3 \
    --format='value(sizeBytes)' | awk '{ printf "%.2f GB\n", $1/1024/1024/1024 }'
  ```
- **Dry-run gotcha (D)**: `gcloud artifacts repositories set-cleanup-policies` keeps prior `--dry-run` setting if neither `--dry-run` nor `--no-dry-run` is passed. After accidentally applying with `--dry-run` first, **explicit `--no-dry-run`** was required to flip it. Look for `Dry run is disabled.` in the output to confirm.
- **Cloud SQL HA→ZONAL** took 11m46s (longer than the 10m gcloud client timeout, which surfaced as a misleading `gcloud crashed` error — operation completed correctly server-side; `gcloud sql operations describe <ID>` confirmed `STATUS: DONE`).

---

## 3. Three PRs created — pending merge

All three are independent and can merge in any order. None auto-merged. Push URL:
- https://github.com/alpro1000/STAVAGENT/pull/new/feat/registry-classification-roundtrip
- https://github.com/alpro1000/STAVAGENT/pull/new/chore/remove-ribbon-feature-flag
- https://github.com/alpro1000/STAVAGENT/pull/new/chore/portal-remove-broken-registry-pull

### PR-1: `feat/registry-classification-roundtrip` (commit `814f428`)

**Real bug fix.** Items pushed from Registry to `rozpocet-registry-backend` lost 16 classifier fields (rowRole, parentItemId, sectionId, popisDetail, `_rawCells`, originalTyp, classification confidence/source, source_format/row_index, por, cenovaSoustava, varianta, boqLineNumber, classificationWarnings, subordinateType) on every push and could not be reconstructed on pull. After a localStorage wipe / cross-device load, projects rendered as flat unclassified lists.

Backend already had idle column `registry_items.sync_metadata TEXT` accepted by bulk INSERT and returned by GET. New `services/classificationCodec.ts` packs the 16 fields into a versioned blob (v=1); `applyClassificationBlob` re-hydrates `ParsedItem` on load. **No DB migration** — col was provisioned in the original schema.

**Bonus (Bug D)**: `App.tsx loadFromPortal` dedupe now also matches by `portalLink.portalProjectId` (was direct id only) so opening a Portal-linked project no longer creates a duplicate without classification.

Files: 6 changed (+711 / −24). 16 new vitest cases. **188 → 204 vitest passing**, tsc clean, vite build clean.

Full audit: `docs/SYNC_AUDIT_2026_04_29.md` (also lives on this PR's branch).

### PR-2: `chore/remove-ribbon-feature-flag` (commit `786b802`)

User confirmed they want ribbon as the only UI. The `localStorage['registry-ribbon-enabled']` flag was per-browser, which left users with mismatched UI between devices.

Removed:
- `src/layout/ribbonFeatureFlag.ts` + `.test.ts`
- `src/layout/RibbonFlagToggle.tsx`
- ~150 lines legacy header in `App.tsx` (brand + search + actions)
- ~390 lines legacy main (welcome screen + features grid + card-list)
- `isExportMenuOpen` state + `handleOpenExportMenu` + 8 scroll helper-funcs + 2 refs + 5 unused component imports + lucide-react icon block
- All `{ribbonEnabled && ...}` / `{!ribbonEnabled && ...}` conditionals — `RibbonLayout` now mounts unconditionally

`App.tsx` shrunk **1517 → 871 lines** (−646). **184 vitest passing** (−4 from deleted flag test), tsc clean, vite build clean. **Production bundle −19 KB raw / −3 KB gzipped.**

Per-browser flag users land on ribbon automatically post-deploy. Old `registry-ribbon-enabled` localStorage key becomes harmless garbage.

### PR-3: `chore/portal-remove-broken-registry-pull` (commit `781ae02`)

Portal kiosk-row "Stáhnout z Registru" button was double-broken since landing:
- Frontend fetch sent no auth headers → 401 every click
- Even with auth fixed: body was `sheets: []` posted to `/import-from-registry` (a PUSH endpoint) — no-op on receive

Registry already auto-syncs every 3s on its own side, so a Portal-side "manual refresh" against the same endpoint was redundant by design.

Removed for `kiosk_type='registry'`: button visibility gate, handler `else if` branch, label ternary. **Bonus**: monolit's `POST /import-from-monolit` was missing `authHeader()` too — added (would have hit the same 401 wall).

File: 1 changed (+15 / −22). Build clean. Tests untouched.

### After-merge follow-ups (per PR)
| PR | Auto-deploy on merge? | Manual step |
|---|---|---|
| PR-1 | ✅ Vercel + Cloud Build (Registry frontend rebuilds on `main` push for `rozpocet-registry/**`) | Re-import any project that had classification — legacy items have `sync_metadata IS NULL` and stay flat until re-imported |
| PR-2 | ✅ Vercel | None — flag-on users auto-migrate |
| PR-3 | ✅ Vercel (Portal frontend) | None |

---

## 4. Diagnostic findings + outstanding bugs

### A. Cloud Build pipeline — verified healthy (was suspected broken)

Initial premise from a prior Claude proposal: "Cloud Build trigger isn't firing on merges." **False alarm.** Diagnostic showed:

- Trigger name is `stavagent-portal-deploy` (not `portal-deploy` — the prior proposal used the wrong name).
- Last SUCCESS build: 29.04 08:04 UTC → produced revision `00259-q28` deployed at 08:23 UTC, **100% traffic, latestRevision=true**.
- The `STATUS: FAILURE` entries in `gcloud builds list` are by-design `guard` step exits: when a commit only touches `docs/` or another service's directory, the per-service trigger fires (because GitHub push event matches `^main$`) but the `guard` step in `cloudbuild-portal.yaml:18` exits 1 to cancel the build. This is correct behavior.
- **Therefore: no need for a parallel GitHub Actions pipeline.** The proposed PR ("Setup automated backend deploy pipeline") was unnecessary and rejected.

### B. 401 root cause — `VITE_DISABLE_AUTH=true` in Portal Vercel ⚠️ STILL OPEN

Vercel project `stavagent-portal` (domains `www.stavagent.cz`, `kalkulator.stavagent.cz`) has `VITE_DISABLE_AUTH=true` in **Production** environment variables. CLAUDE.md notes this should be **local dev only**. The frontend therefore never prompts for login → no JWT cookie set → cross-origin Registry sync gets 401.

**Fix (manual, not yet applied):**
1. Vercel → stavagent-portal → Settings → Environment Variables
2. Find `VITE_DISABLE_AUTH = true`, **delete or set to `false` for Production** (keep `true` for Preview/Development if needed)
3. Redeploy via Vercel UI (Deployments → latest → Redeploy)
4. Login as real user on www.stavagent.cz → verify cookie attributes in DevTools Application:
   - `SameSite=None`, `Secure=true`, `Domain=.stavagent.cz` — all three required for cross-origin to Cloud Run backend
5. If cookie doesn't reach `stavagent-portal-backend-...run.app` after auth flip — different problem (Cloud Run TLD vs `stavagent.cz` TLD — cookies don't cross), needs Bearer header path via `portalAuthHeader()` (PR #1045 already added this for some endpoints).

**Side effect after flip**: existing users who used Portal anonymously will see login screen.

### C. Bug B — `(0 items)` in PortalAutoSync log = misleading, not a bug

Per CLAUDE.md "Quick Debugging" table:
> Portal sync 0 items | Log misleading — `items_imported = newItems = total - updated`. On re-sync all items are UPDATES, so 0 new. Data IS synced.

`integration.js:1002` returns `items_imported = newItems`. For re-syncs that's always 0. Real metric is `instance_mapping.length` (which is non-zero). No code change needed; if log noise becomes a complaint, change `portalAutoSync.ts:145` to log `${data.items_total || data.items_imported}` instead.

### D. Orphan Portal projects from past Registry deletes — needs manual cleanup

After this session's `Smazat vše` + reimport cycle, Portal accumulated 2 projects with the same name `E_Soupis__skupiny MOSTY +PHS_skupiny`:
- `proj_82f67d52-...` (361 pozice, **stale**)
- `proj_69a03014-...` (362 pozice, **active**)

Cause: Registry `Smazat vše` doesn't cascade to Portal. New import gets a new `registry_project_id` → Portal's `kiosk_links WHERE kiosk_project_id = ?` lookup misses the old link → creates a new portal_project with a fresh UUID. Old portal_project lingers with broken kiosk_link.

**Workaround now (per project, manual):** in Portal UI click 🗑️ trash icon on the stale project header.

**Proper fix (deferred, ~30–60 min):** PR-X6 simplified — when Registry DELETE handler runs, fire-and-forget `DELETE /api/integration/registry-link/{registry_id}` to Portal; new endpoint cascades `kiosk_links` removal + drops `portal_projects` if no other kiosks reference it. See §5 follow-ups.

### E. Cookie cross-domain limitation (informational)

`stavagent-portal-backend-1086027517695.europe-west3.run.app` is on the **`run.app`** TLD, not `stavagent.cz`. A cookie set with `Domain=.stavagent.cz` won't be sent there. PR #1045 added `portalAuthHeader()` (Bearer JWT from `localStorage.auth_token`) as the cross-origin path; Registry uses it correctly, Portal frontend uses it for some endpoints. Long-term fix is a custom domain like `api.stavagent.cz` for the Portal backend, mapped to the Cloud Run service — would let `Domain=.stavagent.cz` cookies flow naturally without the Bearer fallback.

---

## 5. Next session pickup checklist

### First 30 minutes
1. **Verify cost cuts landed**: `gcloud artifacts repositories describe stavagent --location=europe-west3 --format='value(sizeBytes)' | awk '{ printf "%.2f GB\n", $1/1024/1024/1024 }'` — should be 30–80 GB if cleanup ran (was 663 GB end of session 2026-04-29).
2. **Verify SQL still ZONAL**: `gcloud sql instances describe stavagent-db --format='value(settings.availabilityType)'` → expect `ZONAL`.
3. **Verify concrete-agent min=0**: `gcloud run services describe concrete-agent --region=europe-west3 --format='value(spec.template.metadata.annotations."autoscaling.knative.dev/minScale")'` → expect empty/`0`.
4. **Check if 3 PRs merged**: `gh pr list --state merged --search 'feat/registry-classification-roundtrip OR chore/remove-ribbon-feature-flag OR chore/portal-remove-broken-registry-pull'` (or just open https://github.com/alpro1000/STAVAGENT/pulls).
5. **Delete phantom revision** (one-shot): `gcloud run revisions delete stavagent-portal-backend-00258-nzh --region=europe-west3 --quiet`.

### Open work, prioritized

**P0 (blocker for normal Portal flow):**
- **Flip `VITE_DISABLE_AUTH=false` in Portal Vercel**, redeploy, login, verify cookie. See §4-B above. Until done, anonymous users keep landing on www.stavagent.cz with full app access — security hole + breaks cross-origin Registry sync auth.

**P1:**
- **PR-X6 Portal cascade-delete** (§4-D). Without it every `Smazat vše` cycle adds an orphan in Portal.
- **Manual cleanup of existing orphan**: `proj_82f67d52-d7c6-...` in Portal UI trash icon.
- **Re-import the active Registry project** so its items get the new `sync_metadata` blob (legacy items pre PR-1 stay flat).

**P2 (deferred, no budget):**
- `min-instances=1` on Portal + Registry backends (~$10–30/mo) — would kill cold-start "Sync timeout" warnings entirely.
- Cookie cross-domain proper fix: custom domain `api.stavagent.cz` → Cloud Run mapping → `Domain=.stavagent.cz` cookies flow.

### Files changed this session (3 branches)

| Branch | Files | Purpose |
|---|---|---|
| `feat/registry-classification-roundtrip` | rozpocet-registry/src/services/{classificationCodec.ts,classificationCodec.test.ts,registryAPI.ts,backendSync.ts}, src/App.tsx, docs/SYNC_AUDIT_2026_04_29.md | Roundtrip fix |
| `chore/remove-ribbon-feature-flag` | rozpocet-registry/src/{App.tsx,layout/{ribbonFeatureFlag.ts,ribbonFeatureFlag.test.ts,RibbonFlagToggle.tsx,RibbonLayout.tsx}} | Kill legacy UI |
| `chore/portal-remove-broken-registry-pull` | stavagent-portal/frontend/src/components/portal/KioskLinksPanel.tsx | Remove broken button |
| `claude/session-handoff-setup-i7HL6` (this) | docs/SESSION_HANDOFF_2026_04_29.md, CLAUDE.md | Handoff |

### What's already saved + survives this session
- `docs/SYNC_AUDIT_2026_04_29.md` — on `feat/registry-classification-roundtrip` branch (full bug analysis A–E)
- `docs/SESSION_HANDOFF_2026_04_29.md` — this file, on `claude/session-handoff-setup-i7HL6` branch
- CLAUDE.md updates — same branch as handoff (version bump v4.25.0 → v4.26.0 + changelog)
- 3 feature branches pushed with full history; commits carry all context

### Key invariants restored / enforced
- Cloud Build pipeline confirmed working (no parallel GitHub Actions deploy needed — would have been duplicate effort)
- Registry roundtrip preserves classification (PR-1)
- Portal duplicates from re-import still happen (Bug D unfixed at backend level — workaround manual)
- Cost burn projected to drop ~$70–90/mo after AR cleanup completes

### One-line "tomorrow morning" prompt
> Прочитай `docs/SESSION_HANDOFF_2026_04_29.md` (главный handoff), затем `docs/SYNC_AUDIT_2026_04_29.md` (на ветке `feat/registry-classification-roundtrip`). Доложи: какие из 3 PR смерджены, в каком состоянии Portal `VITE_DISABLE_AUTH`, и сколько GB в Artifact Registry осталось после cleanup.
