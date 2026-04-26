# Portal Inventory — `stavagent-portal/`

**Scope:** `stavagent-portal/{backend,frontend,docs}/` excluding `node_modules`, `dist`, `build`.
**Source:** Gate 1+2 Explore agent C (other backends — Portal slice).
**File counts:** 66 knowledge-bearing files (~14.5K LOC).

Portal is a thin orchestration layer. Most "knowledge" here is **business rules** (credit pricing, role definitions, feature flags) rather than concrete-construction domain norms — but those rules are still domain-specific to STAVAGENT and should be inventoried.

---

## Inventory table

| path (rel to repo root) | size | content_type | theme | importers (top 3) | last_modified | dup_hint | category | justification |
|---|---|---|---|---|---|---|---|---|
| `stavagent-portal/backend/src/db/schema-postgres.sql` | 792 lines | SQL schema | role_definitions, credit_schema, project_structure | `init.js`, `migrations.js` | 2026-04-19 | no | keep_in_place | Master Portal schema: users, roles, credit_balance, bridges, positions, OTSKP codes |
| `backend/src/db/migrations/add-credit-system.sql` | 99 lines | SQL migration | credit_pricing | `creditService.js` | 2026-04-19 | no | keep_in_place | `operation_prices` table + 15 default operation prices (2–20 credits) |
| `backend/src/db/migrations/add-position-instance-architecture.sql` | 146 lines | SQL migration | position_instance_architecture | position routes | 2026-04-19 | partial (`docs/POSITION_INSTANCE_ARCHITECTURE.ts` is the design twin) | keep_in_place | `position_instance_id` UUID, crew assignments — central to Portal data model |
| `backend/src/db/migrations/add-pump-suppliers.sql` | 231 lines | SQL migration | supplier_catalog | `routes/pump.js` | 2026-04-19 | yes (Registry `pump_suppliers.json`, Monolit `pump-engine.ts`, CORE `B9/pumps.json`) | keep_in_place | Pump supplier integration — **pump catalog quadruple-sourced** |
| `backend/src/db/migrations/add-unified-project-structure.sql` | 49 lines | SQL migration | project_structure | `routes/portal-projects.js` | 2026-04-19 | no | keep_in_place | Unified project metadata schema |
| `backend/src/services/creditService.js` | 362 lines | JS module | credit_pricing, business_logic | `routes/credits.js`, `routes/auth.js` | 2026-04-19 | no | keep_in_place | Pay-as-you-go credit system: `getOperationCost()`, `canAfford()`, `deductCredits()`. 15 op prices live in `add-credit-system.sql` |
| `backend/src/services/featureFlags.js` | 195 lines | JS module | feature_control | `routes/admin.js` | 2026-04-19 | no | keep_in_place | Per-plan / per-org / per-user flags |
| `backend/src/services/usageTracker.js` | 301 lines | JS module | domain_logging | routes/* | 2026-04-19 | no | keep_in_place | Audit/usage tracking |
| `backend/src/services/universalParser.js` | 972 lines | JS module | file_parsing | `routes/parse-preview.js`, `portal-documents.js` | 2026-04-19 | partial (CORE has its own multi-format parsers) | keep_in_place | Multi-format document parser at Portal edge — light routing layer |
| `backend/src/services/concreteAgentClient.js` | 255 lines | JS module | inter_service_api | `routes/core-proxy.js` | 2026-04-19 | partial (Monolit `coreAPI.js` is parallel client) | keep_in_place | HTTP client to concrete-agent CORE — calls `add-document`, classifier, parser |
| `stavagent-portal/docs/PORTAL_ARCHITECTURE.md` | 21 KB | markdown | architecture_doc | `CONTRIBUTING.md` | 2026-04-19 | no | keep_in_place | Portal architecture: roles, credit system, project hierarchy |
| `stavagent-portal/docs/PORTAL_IMPLEMENTATION_SUMMARY.md` | 13 KB | markdown | implementation_doc | `README.md` | 2026-04-19 | no | keep_in_place | Feature summary + implementation notes |
| `stavagent-portal/docs/STAVAGENT_CONTRACT.md` | 18 KB | markdown | contract_doc | architecture | 2026-04-19 | partial (`docs/STAVAGENT_CONTRACT.md` at repo root has same name — verify content) | keep_in_place | Inter-service API contracts. **Possible duplicate with repo-root** — see `06_duplicates_conflicts.md` |
| `stavagent-portal/CLAUDE.md` | varies | markdown | per_service_doc | team reference | 2026-04-24 | no | keep_in_place | Per-service operational reference |
| `stavagent-portal/frontend/src/pages/LandingPage.tsx` | 622 lines | TSX | landing_copy, pricing_table | App router | 2026-04-19 | partial (credit prices echo `add-credit-system.sql` 15 op prices) | keep_in_place | Landing v2.0 — embeds 15-op credit pricing table; should derive from backend at build time |

Other Portal files (auth utilities, JWT, Stripe webhook handlers, route plumbing) are not knowledge-bearing per the audit definition.

---

## Hotspots (Portal)

1. **Credit pricing duplication risk** — `add-credit-system.sql` defines 15 operation prices (2–20 credits each). `LandingPage.tsx` re-displays them in marketing copy. If prices change, both must update. **Sync risk.**
2. **`STAVAGENT_CONTRACT.md` exists at two paths** — `stavagent-portal/docs/STAVAGENT_CONTRACT.md` (18 KB) and repo-root `docs/STAVAGENT_CONTRACT.md` (18 KB). Same name, comparable size. Either content-identical or two divergent forks. **Verify in `06_duplicates_conflicts.md`.**
3. **`concreteAgentClient.js` (Portal) ≈ `coreAPI.js` (Monolit)** — two separate HTTP clients to CORE, each with its own retry / timeout / auth wiring. Could converge to a shared SDK package.
4. **No domain norms in Portal** — concrete classes / exposure / formwork are not embedded in Portal. The audit confirms Portal correctly delegates to CORE / Monolit / Registry. ✅

---

## Counts (Portal)

| Bucket | Count |
|--------|-------|
| Files inventoried with full attributes | 15 |
| SQL migrations highlighted | 5 |
| Backend services highlighted | 5 |
| Frontend pages with embedded business knowledge | 1 |
| Portal-specific docs | 4 |
| Hardcoded-norm hotspots | 0 (Portal correctly delegates) |
| Cross-zone dup hints | 3 (pump catalog, STAVAGENT_CONTRACT.md, CORE-client duplication) |

---

End of Portal inventory. Continued in `04_inventory_registry_part1_frontend.md`.
