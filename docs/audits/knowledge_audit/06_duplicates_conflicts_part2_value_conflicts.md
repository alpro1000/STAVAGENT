# Gate 3 — Value conflicts (part B)

**Goal:** find groups where two files encode the **same domain rule with different numbers** — the highest-risk class of duplication because the system can give two different answers depending on which path runs.

For each conflict: (i) what is encoded, (ii) which files, (iii) what differs, (iv) which is right (best guess), (v) action.

---

## B1. Frami Xlife formwork rental rate

| Field | Value | Source |
|-------|-------|--------|
| Vendor / system | DOKA Frami Xlife | — |
| **Conflict** | rental_czk_m2_month | — |
| Monolit `shared/src/constants-data/formwork-systems.ts:127` | **507.20** CZK/m²/mo | "DOKA 2024 catalog" comment |
| Registry `src/data/formwork_knowledge.json:20–40` | **531.52–730.60** CZK/m²/mo (range across 4 height variants) | "after 68 % discount from list price" comment |
| CORE `B3/doka_cennik_2025-01-01.json` | unverified — agent did not extract specific rate | DOKA 2025-01-01 list-price catalog |

**Probable explanation:** Monolit number is a single representative rate (likely ~h=1.5 m). Registry has 4 variants with stratified rates. Both omit the discount-context that matters for cost rollups.
**Action:** treat CORE 2025-01-01 catalog as authoritative; both Monolit and Registry should derive their working numbers from it. Capture in `12_top_recommendations.md` #3.

---

## B2. **CRITICAL — CLASSIFICATION_RULES dual-write**

| Field | Value |
|-------|-------|
| Topic | 11 BOQ skupiny rules (ZEMNÍ_PRACE, BETON_MONOLIT, BETON_PREFAB, VYZTUŽ, KOTVENÍ, BEDNENÍ, PILOTY, IZOLACE, KOMUNIKACE, DOPRAVA, LOŽISKA) — each with `include[]`, `exclude[]`, `boostUnits[]`, `priority`, `priorityOver[]` |
| File 1 | `rozpocet-registry/src/services/classification/classificationRules.ts:48–386` (frontend, 386 lines) |
| File 2 | `rozpocet-registry/api/agent/rules.ts:22–287` (serverless backend, 288 lines) |
| Conflict status | **Currently identical (verified 2026-04-19), but no enforcement keeps them in sync** |
| Risk | Frontend & server can diverge silently; classification UI vs. server outputs disagree |
| Action | Highest-priority finding of whole audit. Recommendation in `12_top_recommendations.md` #1. |

---

## B3. EXPOSURE_MIN_CURING_DAYS

| Field | Value | Source |
|-------|-------|--------|
| Monolit `maturity.ts:91–97` | XF1=5, XF2=5, XF3=7, XF4=7, XD2=5, XD3=7 days | TKP18 §7.8.3 inline comment |
| CORE `B2/csn_en_206.json` | exposure-class definitions present; numerical curing minima not extracted by audit agent | ČSN EN 206 |
| TKP source | `docs/normy/tkp/TKP18_2022_05.pdf` | raw PDF |

**Conflict status:** **value-conflict candidate, not yet verified.** Audit agent could not confirm CORE encodes the same minima or different ones.
**Action:** verify by inspection — if CORE has matching numbers, B3 collapses to A4 (topic-duplication). If they differ, escalate.

---

## B4. Pump catalogs — different vendor scopes

| Source | Vendor coverage | Date |
|--------|----------------|------|
| CORE `B9/pumps.json` (101 lines) | generic specs, vendor-agnostic | unknown |
| Monolit `pump-engine.ts` | m³/h + crew sizes (capacity-based) | 2026-04-19 |
| Registry `pump_knowledge.json` (171 lines) | Beton Union 10 specific models (28/24 → 56/52) | 2026-01-01 ceník |

**Conflict status:** not strict value-conflict — three different abstractions of the same domain. CORE is generic; Monolit is capacity-driven; Registry is supplier-specific.
**Action:** treat as legitimate division of concerns, but document hierarchy (vendor catalog → capacity model → generic specs) so updates flow predictably. Capture in `13_open_questions.md`.

---

## B5. Productivity rates — REBAR_RATES_MATRIX vs B4 norms

| Source | Granularity | Sample value |
|--------|-------------|--------------|
| Monolit `element-classifier.ts:1589` REBAR_RATES_MATRIX | by element category × diameter | slabs D12 = 16.3 h/t, walls D12 = 17.3 h/t, beams D12 = 22.4 h/t |
| CORE `B4/construction_productivity_norms.json` | broader productivity catalog (formwork, concrete, rebar) | 960 lines, rebar rates in different schema |

**Conflict status:** unverified at value level. Monolit uses methvin.co (April 2026) + RSMeans cross-validation per CLAUDE.md. CORE B4 sources unclear.
**Action:** verify on next code-touch. Likely Monolit is fresher.

---

## B6. Construction expert prompt — v1 vs v2

- `prompts/claude/assistant/construction_expert.txt` (193 lines, older)
- `prompts/claude/assistant/stav_expert_v2.txt` (380 lines, newer)

Both imported by `services/construction_assistant.py`. Probable behaviour: v2 wins, v1 dead. **Action:** verify which is actually used at runtime; merge into v3 or delete v1.

---

## B7. master_framework.txt — root vs sub-folder

- `prompts/master_framework.txt`
- `prompts/resource_calculation/master_framework.txt`

Audit agent reports importers point to the resource-calculation copy. Root copy may be dead. **Action:** confirm and delete the unused one.

---

## B8. STAVAGENT_CONTRACT.md — root vs Portal copy

Two copies, same name, both 18 KB. Verify byte-equality. Likely identical (mirrored).
**Action:** keep one copy at repo-root; symlink or delete the Portal copy.

---

## Summary table

| # | Conflict | Severity | Action item ref |
|---|----------|----------|-----------------|
| B1 | Frami Xlife rental rate (Monolit 507 vs Registry 531–730) | medium | rec #3 |
| B2 | CLASSIFICATION_RULES dual-write | **critical** | rec #1 |
| B3 | EXPOSURE_MIN_CURING_DAYS (unverified) | medium | rec #2 |
| B4 | Pump catalogs (3 abstractions) | low | open Q |
| B5 | Productivity rates (unverified) | medium | rec #4 |
| B6 | Construction expert v1 vs v2 | low | rec #6 |
| B7 | master_framework.txt 2 copies | low | rec #6 |
| B8 | STAVAGENT_CONTRACT.md 2 paths | low | rec #6 |

**One critical conflict (B2). Three medium (B1/B3/B5). Four low.** The medium-severity ones are unverified — value comparison left for next-session code-touch.

---

End of Gate 3. Continued in `07_dependencies.md` (Gate 4: dependency graph + dangling).
