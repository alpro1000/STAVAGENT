# TASK — Výměry-First → Full Decomposition (universal)

**Created:** 2026-06-01 · **Project:** STAVAGENT · **Scope:** RD Jáchymov NOW + rule for ALL future projects
**Status:** Part B = read-only audit (STOP gate before fix). Part C = library patterns.

---

## Core idea (the missing base)

Quantities must not "float" attached ad-hoc to each work item. The correct engineering pipeline is:

```
1. VÝMĚRY (measurement register)        ← the base / single source
2. Work list DERIVED from the výměry
3. Each work qty → REFERENCES a výměra   (measured / derived / blank — never invented)
```

**Consequence:** no mismatch (one area = one source), provenance is visible (measured vs derived vs blank), and the list is trivially extensible. This is what turns a soupis from "a list of works" into "works built on measurements".

---

## Part A — Universality (concept)

The principle is ONE for every object type; only the **unit of measure (jednotka obměru)** changes:

| Object | Unit of measure | What is measured |
|---|---|---|
| Místnost (room) | místnost | plocha, výška, stěny, skladby |
| Most (bridge) | prvek (pilíř / NK / opěra) | objem, bednění, výška, mostovka plocha |
| Hala | konstrukce | plocha, výška, rozpon |
| Opěrná zeď | úsek | délka, výška, líce, objem |
| Tunel | profil / metráž | profil, délka, ostění |

The **Výměry-First → Full Decomposition** pipeline is identical across all of them; the výměry register schema is shared, only its rows differ. This is the same insight as Pattern 16 (Universal Work Ontology) applied one layer earlier — to the *measurements*, not just the works.

---

## Part B — RD Jáchymov NOW (execute, read-only first)

1. Build a **VÝMĚRY register** (`outputs/vymery_register.md`) — every measured quantity (plocha/objem/délka/výška) per objekt + element, each tagged: `measured` (DXF/TZ) / `derived` (formula over measured) / `estimate` (OVĚŘIT) / `blank` (null).
2. **Decomposition audit** — for each work item, does its `mnozstvi` trace to a výměra row? Flag:
   - ✅ traces cleanly
   - ⚠️ inconsistent (two items, two areas for one element — e.g. **sklad 21.2 vs 17.6**)
   - 🟡 estimate without geometry (Pattern 44 → should be null)
3. **Merge with `sklad_audit.md`** (already done) — the sklad findings (lichoběžník, prefa bloky, depth) are a subset of this register.
4. **STOP gate** — present, then fix on GO. Snapshot first before any items.json change.

Acceptance: every numeric qty either references a výměra row or is null; no two items carry conflicting areas for one physical element.

---

## Part C — Library patterns (forever rule)

Add to `docs/STAVAGENT_PATTERNS.md` (verify-not-duplicate first):

- **Výměry-First** (measure before the work list; qty references a výměra; anti-pattern = sklad 21.2 vs 17.6 mismatch) → **NEW Pattern 45**.
- **Full Decomposition** (each work = atomic montáž/materiál split, qty of both) → **already Pattern 41** — do NOT duplicate; enrich 41 with the "qty of both legs traces to a výměra" + universal-unit framing.

---

## Part D — MCP stage (future autonomy)

Výměry-First is the **missing deterministic stage** in the MCP autonomy chain:

```
host-vision (drawings)  →  VÝMĚRY (measurement register)  →  validate
   →  work breakdown DERIVED from výměry  →  montáž/materiál split (auto)
```

This makes MCP reliable: **qty come from measurements deterministically, not from the air.** It upgrades MCP from "computes works" to "computes works on a measurement base" — a real decompose, not a list. Pairs with Pattern 40 (host-delegated vision + MCP validation gate): vision feeds the výměry register; the register feeds the work breakdown.

---

## Hand-off
- Part B: `outputs/vymery_register.md` + merge sklad_audit → STOP gate → fix on GO.
- Part C: Pattern 45 added + Pattern 41 enriched.
- Part A/D: context (universality + MCP roadmap).
