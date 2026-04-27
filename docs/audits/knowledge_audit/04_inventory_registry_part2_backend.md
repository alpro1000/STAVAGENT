# Registry Inventory — Part 2: `rozpocet-registry-backend/`

**Scope:** `rozpocet-registry-backend/` (Vercel-deployed Express service backing the Registry frontend's Portal-sync needs).
**Source:** Gate 1+2 Explore agent C (other backends — registry-backend slice).
**File counts:** 9 knowledge-bearing files (~186 LOC + catalogs).

This is a small service. Its job is to receive UPSERTs from the Registry frontend, store sheets/items in PostgreSQL, and provide a stable read endpoint for cross-kiosk lookups.

---

## Inventory table

| path (rel to repo root) | size | content_type | theme | importers (top 3) | last_modified | dup_hint | category | justification |
|---|---|---|---|---|---|---|---|---|
| `rozpocet-registry-backend/schema.sql` | 69 lines | SQL schema | registry_classification, project_sheet_item, tov | `server.js` | 2026-04-19 | partial (`stavagent-portal` schema has overlapping bridges/positions tables) | keep_in_place | Project / sheet / item schema with `grupo` / `subgroup` + TOV (labor / material / equipment) |
| `rozpocet-registry-backend/services/tovProfessionMapper.js` | 59 lines | JS service | role_definitions, profession_rates | `server.js`, `test-mapper.js` | 2026-04-19 | yes (URS_MATCHER `tridnik.xml`, CORE `B4/berger_tarif_delnici_2026.json`) | **merge_with** | Monolit → Registry profession mapping. Hardcoded: `Betonář→398 Kč/h`, etc. **TRIPLE-SOURCED profession taxonomy** |
| `rozpocet-registry-backend/TOV_PROFESSION_MAPPING.md` | 100+ lines | markdown | role_definitions, mapping_doc | `README.md` | 2026-04-19 | partial (the doc is the spec for `tovProfessionMapper.js`) | keep_in_place | Profession taxonomy + hourly rates documentation |
| `rozpocet-registry-backend/server.js` | varies | JS service | sync_endpoints | none ext | 2026-04-19 | no | keep_in_place | Express server — receives UPSERTs from Registry frontend |
| `rozpocet-registry-backend/test-mapper.js` | varies | JS test | tov_test | none ext | 2026-04-19 | no | keep_in_place | Tests for tovProfessionMapper |
| `rozpocet-registry-backend/README.md` | varies | markdown | per_service_doc | team reference | 2026-04-19 | no | keep_in_place | Service overview |
| Other registry-backend files (auth helpers, Vercel config, package.json) | — | — | — | — | — | — | excluded | Not knowledge-bearing |

---

## Hotspot

**`tovProfessionMapper.js` profession-rate hardcoding** — single source for Monolit → Registry profession matching. The hourly rate (`Betonář → 398 Kč/h`) duplicates an entry from CORE `B4/berger_tarif_delnici_2026.json` (which has the full Berger 2026 rate table). URS_MATCHER `data/tridnik.xml` provides the broader Czech profession taxonomy (Třídník codes) but with no rates.

**Triangulation:**
- CORE `B4/berger_tarif_delnici_2026.json` — 469 lines, full rate table by profession (canonical for rates)
- URS_MATCHER `data/tridnik.xml` — 3.2 MB, profession codes + Třídník categories (canonical for taxonomy)
- Registry-backend `tovProfessionMapper.js` — 59 lines, ~10 hardcoded profession-rate pairs (operational subset)

Recommendation logged in `06_duplicates_conflicts.md` and `12_top_recommendations.md`.

---

## Counts (Registry total: frontend part 1 + backend part 2)

| Bucket | Count |
|--------|-------|
| Frontend files inventoried | 32 |
| Backend files inventoried | 4 (relevant) |
| Hardcoded-rules hotspots (frontend + backend) | 12 (11 frontend + 1 backend) |
| Critical dual-write risk | 1 (CLASSIFICATION_RULES) |
| Files marked `merge_with` | 2 (`api/agent/rules.ts`, `tovProfessionMapper.js`) |
| Files marked `mark_legacy` | 4 (rowClassificationService.ts, IMPLEMENTATION_GUIDE.md, MIGRATION_GUIDE.md, SESSION_2026-01-26_CLASSIFICATION_MIGRATION.md) |
| Files marked `unclear` | 1 (`concrete_prices.json` — no importers) |
| Cross-zone dup hints | 4 (formwork, pump, profession, classification rules) |

---

End of Registry inventory. Continued in `05_inventory_other_part1_urs.md`.
