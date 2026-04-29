# Registry ↔ Backend Sync Audit (2026-04-29)

> **Scope:** Diagnostic audit of the data round-trip between Registry frontend
> (`rozpocet-registry/`), Registry backend (`rozpocet-registry-backend/`), and
> Portal backend (`stavagent-portal/backend/`). Triggered by user reports of
> classification loss after import + duplicate projects appearing after
> Portal pulls.
>
> **Status of follow-ups:** Bug A + Bug D fixed in branch
> `feat/registry-classification-roundtrip` (this audit + the codec PR were
> produced in the same session). Bug B is documentation-only (misleading log,
> already noted in CLAUDE.md). Bug C requires GCP `min-instances` budget the
> user does not currently have.

---

## TL;DR

Four distinct issues surfaced under the same user-visible symptom
("project saves but re-appears in Registry without classified rows after
reload / Portal open"):

| # | Cause | Layer | Severity | Fix |
|---|-------|-------|----------|-----|
| **A** | Registry-backend round-trip drops 16 classifier fields | Frontend ↔ Registry backend | High | Pack into existing `sync_metadata` JSON column (this PR) |
| **B** | `(0 items)` log on every re-sync | Cosmetic | Low | None — `items_imported` is `new` only by design (CLAUDE.md, "Quick Debugging") |
| **C** | 30 s timeouts ("Portal may be sleeping") | Cloud Run cold-start | Med | `min-instances=1` on Portal + Registry backend (~$10–30/mo, deferred) |
| **D** | Cross-kiosk pull duplicates already-linked projects | Frontend `loadFromPortal` | High | Dedupe by `portalLink.portalProjectId`, not just by `id` (this PR) |

The user's primary complaint — **"saves project, but it's re-added to
Registry from Portal next to the original without classified rows"** — was
the conjunction of A + D. D produced the duplicate; A made the duplicate
look "demoted" (no row hierarchy, no `_rawCells`, no `popisDetail`).

The two earlier proposals (`PR-X2 Schema roundtrip` and `PR-X6 Cross-kiosk
tombstones`) overlap with this audit. PR-X2 is correct in spirit but
over-engineered: it specifies a schema migration with eight new columns,
when the existing `sync_metadata TEXT` column on `registry_items` (idle
since the 2026-04-15 schema) already accepts a JSON blob via the bulk
endpoint. PR-X6 is partially redundant: a tombstone store exists
(`rozpocet-registry/src/services/tombstoneStore.ts`) and is consulted by
`loadFromBackend` (backendSync.ts:131). The remaining gap is a
Portal-side tombstone table — separate from the duplicate bug fixed here.

---

## Bug A — Classification dropped on Registry-backend round-trip

### Symptoms
- Items imported with rowClassifierV2 carry rowRole / parentItemId /
  sectionId / `_rawCells` / popisDetail / originalTyp / classification
  confidence + source / source_format / source_row_index / por /
  cenovaSoustava / varianta / boqLineNumber / classificationWarnings /
  subordinateType (16 fields total per `rozpocet-registry/src/types/item.ts`).
- After a localStorage wipe / cross-device reload / cookie clear, every
  project pulled back from `rozpocet-registry-backend` rendered as a flat
  unclassified list. Subordinates disappeared (parent missing → not
  rendered as children → not visible at all). "Překlasifikovat" button
  no-op'd because `_rawCells` was undefined.

### Root cause
**Frontend push** (`rozpocet-registry/src/services/backendSync.ts:265`,
pre-fix) mapped only 8 BOQ-basic columns into the bulk payload:

```ts
const bulkItems = sheet.items.map((item, idx) => ({
  item_id, kod, popis, mnozstvi, mj,
  cena_jednotkova, cena_celkem, item_order, skupina,
}));
```

**Frontend pull** (`backendSync.ts:148`, pre-fix) reconstructed
`ParsedItem` with the same 8 fields plus literal defaults — the 16
classifier fields silently became `undefined`:

```ts
items: items.map((i, idx) => ({
  id, kod, popis,
  popisDetail: [],   // 🔴 always empty
  popisFull: i.popis || '',
  ...
  // no rowRole, no parentItemId, no _rawCells, no sectionId, …
})),
```

**Backend `registry_items` schema** (`rozpocet-registry-backend/schema.sql`)
already had an idle column for opaque payloads:

```sql
CREATE TABLE IF NOT EXISTS registry_items (
  ...
  sync_metadata TEXT,   -- present, accepted by INSERT, returned by GET, never written
  ...
);
```

The bulk INSERT handler (`server.js:371`) accepts `item.sync_metadata` and
runs `JSON.stringify(item.sync_metadata)` before storing. The GET
`/sheets/:id/items` returns `i.*` (server.js:447), so the column already
ships back to the client. The only missing piece was the codec on the
frontend.

### Fix
- New `services/classificationCodec.ts`: pack 16 fields into a versioned
  `ClassificationBlob` (`v: 1` schema marker for forward compatibility).
- `pushProjectToBackend` puts the blob (object, not stringified — the
  server already does that) into `sync_metadata` per item.
- `loadFromBackend` decodes `sync_metadata` and uses `applyClassificationBlob`
  to re-hydrate the `ParsedItem`.
- `popisFull` is rebuilt from `popis + popisDetail` when the latter exists,
  so the search index column matches what the UI renders.
- 16 vitest cases cover pack/unpack symmetry, JSON-stringify safety, legacy
  no-blob fallback, schema-version forward-compat, and (defensive) the
  pre-parsed-object path for a future JSONB migration.

No DB migration required — the column was provisioned in the original
schema and has been silently accepted-then-dropped by every push since the
backend was deployed. Existing rows have `sync_metadata IS NULL`; legacy
items will continue to render as flat lists until they are re-imported.

---

## Bug B — `Synced project … (0 items)` log

Not a bug. `portalAutoSync.ts:145` logs `data.items_imported`, which the
Portal handler computes as `newItems = totalItems - updatedItems`
(`integration.js:994`). On every re-sync of an existing Portal project,
all items take the UPDATE path, so `newItems` is 0. The data IS being
synced — `items_total` and `instance_mapping.length` confirm it. CLAUDE.md
already documents this in the "Quick Debugging" table.

A log-quality follow-up could pluralize the line as
`(N updated, M new)`, but that is cosmetic and orthogonal to this audit.
Not done in this PR.

---

## Bug C — Cloud Run cold-start timeouts

`portalAutoSync.ts` uses a 30 s `AbortController` per request
(`syncProjectToPortal` line 120). Live logs show `AbortError: signal is
aborted without reason` and `[PortalAutoSync] Sync timeout — Portal may be
sleeping` ×7 within a single page reload after the Portal Cloud Run service
had scaled to zero. The 30 s budget is enough for the warm path but does
not survive a cold start of `stavagent-portal-backend` plus a 700-item
bulk POST.

Two potential mitigations were discussed:

1. `gcloud run services update stavagent-portal-backend --min-instances=1`
   (and the same on `rozpocet-registry-backend`). Cost: ~$10–30/mo for two
   always-warm instances. Removes the cold-start class of failures
   entirely. **Deferred at user's request** (no budget).
2. Frontend retry-with-backoff on `AbortError` from the first request
   only. Cheap, handles cold-starts opportunistically. Not implemented in
   this PR; can be added later if the cold-start failures persist after
   the cookie / cookie-fallback path is verified end-to-end.

Until either mitigation lands, the symptom is real but cosmetic — the
push will succeed on the next debounced retry once the Cloud Run instance
is warm.

---

## Bug D — `loadFromPortal` creates a duplicate when project is already linked

### Symptoms
User clicks "Open in Registry" on a Portal project that was originally
imported from Excel into Registry and synced to Portal. Registry already
has the project locally with full classification. Instead of selecting it,
Registry creates a second copy of the project — same `projectName`,
different `id` — populated only with the minimal fields Portal exposes
(no popisDetail, no parentItemId, no `_rawCells`).

### Root cause
`App.tsx:521` (pre-fix) deduped only by direct id equality:

```ts
const existingProject = projects.find(p => p.id === portalProject.id);
```

But `portalProject.id` here is the `portal_project_id` returned by
`/api/integration/for-registry/:portal_project_id` (`integration.js:360`),
not the Registry-side project id. The Registry id is preserved separately
in `project.portalLink.portalProjectId`. Without checking that field, the
dedup never matched for projects whose Registry id was assigned at
Excel-import time (the common case).

Once the dedup missed, `addProject(newProject)` ran with the data Portal
returned via `for-registry`. That payload (`integration.js:326-348`) only
includes `kod, popis, mnozstvi, mj, cena_*, skupina, row_role,
monolith_payload, dov_payload, tovData, source` — none of the 16
classifier fields the local copy had. Result: duplicate next to original
without classified rows.

### Fix
`App.tsx:520` now matches either by id OR by an existing
`portalLink.portalProjectId`:

```ts
const existingProject = projects.find(p =>
  p.id === portalProject.id || p.portalLink?.portalProjectId === portalProjectId
);
```

The early-return path (re-select existing, refresh `linkToPortal`) is
unchanged. First-time imports (no existing project, no `portalLink`)
still create a new project as before.

---

## Files touched

- `rozpocet-registry/src/services/classificationCodec.ts` (new, 152 lines)
- `rozpocet-registry/src/services/classificationCodec.test.ts` (new, 195 lines, 16 tests)
- `rozpocet-registry/src/services/registryAPI.ts` (`+12 -1`: extend `RegistryItem` with `sync_metadata`)
- `rozpocet-registry/src/services/backendSync.ts` (`+22 -10`: pack on push, unpack on pull)
- `rozpocet-registry/src/App.tsx` (`+10 -1`: dedup by `portalLink`)
- `docs/SYNC_AUDIT_2026_04_29.md` (this file)

Test totals: 188 → 204 vitest passing (`+16`); `tsc -b` clean; `vite build`
clean (2.05 MB chunk, unchanged ±1 kB).

---

## Out of scope (deferred follow-ups)

- **Portal-side `for-registry` parity.** The Portal handler currently
  echoes only `row_role` from `portal_positions` — no `parent_position_id`,
  no `popis_detail`, no `_raw_cells`. A future `Portal → Registry` pull
  for a project that was *originally created in Portal* (Monolit-first
  flow) still won't reconstruct the row hierarchy because Portal never
  stored it. Out of scope here because the user's flow is
  Excel-import → Registry-classify → Portal-sync, not the inverse. If the
  inverse flow becomes a real path, the right fix is to extend
  `portal_positions` with the same JSON blob convention plus an `r2r_metadata`
  column, mirroring Bug A's pattern on the Portal side.
- **Bug C cold-start mitigation.** See above.
- **PR-X6 Portal tombstones.** The deferred PR is a separate concern: it
  prevents a project deleted in Registry from re-materializing via Monolit
  or Portal pulls. Independent of A/D and not regressed by this PR.
- **Misleading `(0 items)` log.** Cosmetic; documented in CLAUDE.md.
- **Legacy "ribbon vs classic" UI flag.** Browser-local, single deploy, no
  data layer impact. Removal scheduled after this PR stabilises.
