# Next-session handoff — 2026-06-26 — #7 composite-element-parts Gate 5

> Jak dokončit feature **#7** (složený prvek z částí — opěra/pilíř). Fáze 1 (Gate 0–3) na main; Fáze 2 Gate 4 hotový na FE-větvi; zbývá **Gate 5**. Kánon: `docs/soul.md §9` (entry 2026-06-26 #7) + spec `docs/specs/composite-element-parts/{requirements,design,tasks}.md`.

---

## 0. Jak začít (povinné pořadí čtení)

Per root `CLAUDE.md` „Mandatory reading at session start": `conventions.md` → `product.md` → `tech.md` → `structure.md` → `domain.md` → `docs/soul.md §9`.

Pak pro #7 konkrétně:
1. `docs/specs/composite-element-parts/design.md` — **celý** (zejm. §5 Decisions + nové **§5.6** metadata-encoding + Gate 5 input-note).
2. `docs/specs/composite-element-parts/tasks.md` — **Gate 5 (§1.6)** = co se píše.
3. `docs/specs/composite-element-parts/requirements.md` — AC 3.1 (editovatelnost) + 3.4 (frontend parity).
4. `docs/audits/calculator_field_map/2026-06-23_composite-parts-recon.md` — Gate 0 recon (rollup, množnost-berličky, MCP delegace).

**Session setup:** effort `high`/`max`; adaptive thinking OFF; PŘED kódem čti repo (Grep/Glob/Read), nefabrikuj cesty/SHA/jména.

---

## 1. Kde feature stojí

**Fáze 1 — HOTOVO, na `main`:**

| Gate | Co | Commit / PR |
|---|---|---|
| 0 | Audit recon + STOP + ratifikace | AUDIT commit |
| 1 | ADR (rozhodnutí v `design.md §5`) | DESIGN commit |
| 2 | Sdílená vrstva `composite-planner.ts` (`planComposite`, completeness-ladder, ODHAD-podíly) | `d71389d` |
| 3a | Backend `/api/calculate` composite-větev za flagem | `11a27ef` |
| 3b | MCP `calculate_concrete_works` forwarduje `parts[]` | `ba9c0f3` |
| — | **Fáze 1 merge** | **PR #1412 → `e6761d1`** |
| — | soul.md §9 post-merge | PR #1413 → `363b5ee` |

**Fáze 2 — Gate 4 HOTOVO, na FE-větvi `claude/composite-element-parts-fe-1dea1` (NEzmerged):**

| Commit | Co |
|---|---|
| `5ecd168` | shared `positions/position-part-grouping.ts` — `groupByStructuralPart()` čte `metadata.structural_part`, grupuje, počítá per-část m³ + Kč subtotals; untagged → jedna null-grupa (`has_parts=false`) |
| `19ebeed` | frontend `PositionsTable.tsx` — když `has_parts`, renderuje sub-úroveň „↳ část · m³ · Kč" nad druhy práce; `has_parts=false` ⇒ **byte-identický** s dneškem |
| `2c224a5` | `design.md §5.6` — metadata-encoding rozhodnutí ratifikováno (žádná DB migrace) |

Stav FE-větve: **1349 shared testů ✓**, `vite build ✓`. **Prod INERTNÍ** — `metadata.structural_part` zatím nikdo nepíše (Gate 5 to teprve začne psát) → vše renderuje flat = dnešní chování.

---

## 2. Gate 5 — co se píše (na TÉŽE FE-větvi)

> **Branch:** pokračuj na `claude/composite-element-parts-fe-1dea1`. **NEZAKLÁDAT novou** — Fáze 2 = **jeden PR** (Gate 4 + Gate 5 dohromady). Merge-gate = Alexander.

**Cíl (tasks.md §1.6):** kalkulátor počítá jednu část a vkládá ji pod rodiče; **odpojený příznak křídla** (`include_kridla`) a **tři mechanismy množnosti** mizí ve prospěch ručního seznamu částí.

**Vstup-UX (ratifikováno „po doporučení", design.md Gate 5 input-note):** **ruční seznam částí** = rec. (a). Uživatel přidá/odebere části (dřík + úložný práh + závěrná zídka + křídla = šablona opěry), každá má vlastní rozměry/bednění/takty/beton. NE auto-extrakce (out of scope).

**Řetěz dat (jeden směr):**
```
kalkulátor composite-vstup (ruční seznam částí)
   → engine planComposite(parts[])         [za flagem ENABLE_COMPOSITE_PARTS]
   → applyPlanToPositions zapíše metadata.structural_part na každý leaf-řádek
   → PositionsTable (Gate 4) už to renderuje jako sub-úroveň  ✓ hotovo
```

**Konkrétní práce:**
1. **Kalkulátor UI** (`Monolit-Planner/frontend/src/components/calculator/`) — composite-vstup: seznam částí (přidat/odebrat), reuse stávajícího formuláře pro jednu část. ODHAD badge viditelný na odhadnutých částech (AC 3.5/3.8).
2. **Engine call** — composite-vstup posílá `parts[]` na `/api/calculate` (composite-větev už existuje za flagem `ENABLE_COMPOSITE_PARTS`, Gate 3a). Ověř, že flag-OFF = jednoprvkové chování beze změny.
3. **`applyPlanToPositions.ts`** — píše `metadata.structural_part` na leaf-řádky (precedent: registry `classificationCodec` reused `sync_metadata`; tady additivní JSON-klíč, **bez migrace** — viz `design.md §5.6`).
4. **Odchod berliček** — `include_kridla` flag + tři mechanismy množnosti pryč, **bez tiché ztráty dat** (AC). Composite detection recon: `docs/audits/.../2026-06-23_composite-parts-recon.md`.

**Tests (tasks.md §1.6 DoD):** část má vlastní bednění/takty/beton; přidání/odebrání části = složení opěry; **živá kontrola na kalkulator.stavagent.cz po deploy**.

---

## 3. Load-bearing invarianty (NEPORUŠIT)

- **Rodič = čistý kontejner**, work-řádky jen na listech → flat-sum KPI sčítá listy, rodič 0 ⇒ **double-count vyloučen BEZ KPI-surgery** (Gate 0).
- **Completeness ladder:** přesné části se nechají; odhad rozdělí zbytek podle placeholder-podílů; poslední odhad pohltí zaokrouhlovací zbytek → **Σ == celkový objem přesně**; přesné bije odhad.
- **`PLACEHOLDER_PART_VOLUME_RATIOS` NEkalibrované** (driky_piliru 0.45 / práh 0.10 / závěrná zídka 0.10 / křídla 0.35) — data-swap follow-up (VP4/SO-250/Žihle), neblokuje Gate 5.
- **Feature-flag `ENABLE_COMPOSITE_PARTS` (backend env, OFF v prod)** — composite-cesta spí v prod, dokud Fáze 2 nehotová → **žádný tichý polo-stav** (AC 3.11). Jeden PR pro celou Fázi 2.
- **Jedna výpočetní cesta:** `/api/calculate` na **Monolit-Planner** backendu (Cloud Run `monolit-planner-api-…europe-west3`), NE concrete-agent. MCP (concrete-agent) deleguje přes `MONOLIT_API_URL`.
- **Goldeny drží bez re-snapshotu** (KV/Žalmanov/normy). Jednoprvkový vstup = beze změny chování.

---

## 4. Discipline (osvědčeno #7)

- **Audit-first → STOP-before-code → ratifikace load-bearing rozhodnutí → merge-gate = Alexander.**
- **Fáze 2 = jeden PR** (Gate 4 + Gate 5). Žádné parallel structures.
- **Pattern 12:** merge-commit, ne squash (per `docs/STAVAGENT_PATTERNS.md`).
- **Amazon Q bot** dal na #1412 false-positive (composite-planner.ts:177) — ověřeno chybný, nezměněno. Bot-návrhy ověřuj, neimplementuj slepě.
- **Po merge ověř, že změna přistála na `origin/main`** (`git log`/`grep`) — squash umí tiše dropnout commit (lekce #1285→#1295).
- **MCP-compat CI = explicitní allow-list** v `test-mcp-compatibility.yml` (push + pull_request bloky) — nový golden tam MUSÍ přibýt, jinak v CI neběží.

---

## 5. Follow-up (po Gate 5, mimo tuto feature)

- Pilíř jako **druhý composite-typ** (kalibrace částí pilíře) — samostatná spec.
- **Kalibrace `PLACEHOLDER_PART_VOLUME_RATIOS`** z reálných projektů (VP4/SO-250/Žihle) — data-swap.
- Automatická extrakce složení z výkresů/PDF — out of scope #7.
