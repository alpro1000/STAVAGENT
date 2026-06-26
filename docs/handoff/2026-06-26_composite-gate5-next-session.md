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

**Řetěz dat (jeden směr) — POZOR: frontend počítá IN-PROCESS, NE přes HTTP:**
```
kalkulátor composite-vstup (ruční seznam částí)
   → planComposite(compositeInput)   [IN-PROCESS import z @stavagent/monolit-shared — NE POST /api/calculate]
   → applyPlanToPositions píše metadata.structural_part na řádky každé části (smyčka přes parts)
   → groupByStructuralPart → PositionsTable (Gate 4) renderuje sub-úroveň  ✓ hotovo
```

> **Klíčový recon-nález (2026-06-26, agent-ověřeno file:line):** frontend NEvolá `/api/calculate`. `runCalculation()` (`useCalculator.ts:963–981`) volá `planElement(input)` **synchronně in-process** (import z `@stavagent/monolit-shared`). Backend composite-větev (`engine.js:82–94`, za `ENABLE_COMPOSITE_PARTS`) slouží **jen MCP**. ⇒ Gate 5 přidá **in-process `planComposite` větev**, NE HTTP body-threading. (Toto opravuje dřívější verzi tohoto §, která chybně psala „posílá parts[] na /api/calculate".)

**Konkrétní práce (file:line ověřeno 2026-06-26):**

1. **Kalkulátor composite-vstup** (`Monolit-Planner/frontend/src/components/calculator/`) — seznam částí `parts: PartFormState[]` (nový state v `useCalculator`) + tlačítko „Přidat díl" + odebrání. Šablona opěry (4 části): **dřík** (`driky_piliru`) · **úložný práh** (`opery_ulozne_prahy`) · **závěrná zídka** (`mostni_zavirne_zidky`) · **křídla** (`kridla_opery`) = klíče `PLACEHOLDER_PART_VOLUME_RATIOS`. Reuse: `FormState` + `update(key,value)`; UI-primitivy `Section/Field/Card/KPICard/NumInput/CollapsibleSection` (`ui.tsx`); `getSmartDefaults(element_type)` (`useCalculator.ts:244–265`) doplní prázdná pole části. ⚠️ Reuse *render* seznamu variant (`CalculatorResult.tsx:220–318`) jako UX-vzor, **NE *mechanismus* variant** (varianty = alternativní scénáře; části = současné komponenty — jiná sémantika).

2. **Engine — in-process `planComposite`** (NE HTTP): v `runCalculation` (`useCalculator.ts:963–981`) přidat větev — je-li composite-režim (existuje seznam částí) → `planComposite(compositeInput)` (import z shared), jinak `planElement` jako dnes. Kontrakt (`shared/src/calculators/composite-planner.ts`): vstup `CompositeInput { parent: PlannerInput, parts?: CompositePartInput[], parent_label? }`; `CompositePartInput = Omit<PlannerInput,'volume_m3'> & { volume_m3?, part_label?, volume_ratio? }`; výstup `CompositeOutput { parts: CompositePartResult[], aggregate, is_detailed, volume_closed, warnings, total_volume_m3 }`. `CompositePartResult.volume_source ∈ {'exact','odhad_family_ratio'}` = **driver ODHAD-badge**. Uzavření na 100 % (AC 3.7) + `warnings` = engine **už řeší** (Gate 2). Frontend-flag = samotná existence nového UI (atomicky ve Fázi 2); env-flag frontendu netřeba (AC 3.11 splněn tím, že Fáze 1 frontend netkla).

3. **`applyPlanToPositions` píše `metadata.structural_part`** — `applyPlanToPositions(ctx: ApplyContext)` (`applyPlanToPositions.ts:427`; `ApplyContext` `40–68`). `meta` objekt se staví na **`496–505`**, stringify na **`524` (POST) / `535` (PUT)**. Rozšířit `ApplyContext` o `structural_part?: string`; před stringify: `if (ctx.structural_part) meta.structural_part = ctx.structural_part` (aditivní klíč, bez migrace — `design.md §5.6`). Pro composite: **smyčka přes `CompositeOutput.parts`**, jeden `applyPlanToPositions` na část s `plan: part.plan` (`CompositePartResult extends ProjectElementResult` nese `.plan`) + `structural_part: part.part_label`. Pak Gate-4 `groupByStructuralPart` (`shared/src/positions/position-part-grouping.ts`, čte `row.metadata`→`structural_part`) renderuje sub-úroveň **automaticky** (`PositionsTable.tsx`, `19ebeed`) — tím se cesta uzavírá. Rodič = čistý kontejner (work-řádky jen na částech, rodič 0 ⇒ žádné dvojí započtení).

4. **Odchod berliček (bez tiché ztráty dat):**
   - `include_kridla`/`kridla_height_m` (display-only, do enginu NEjdou): decl `types.ts:185–186`, default `414–415`; checkbox+input `CalculatorSidebar.tsx:554–584`; auto-set `useCalculator.ts:176`+`196–201`; memo `kridlaFormwork` `268–274`; prop+render `CalculatorResult.tsx:~85`. Smazat vše → křídla = řádek části „křídla".
   - Tři mechanismy množnosti (`2026-06-13_recon.md §2c+§3.3`): `num_identical_elements` (`buildInput` `useCalculator.ts:1189–1190`) ⊥ `num_dilatation_sections` (`1097/1107`, mutex-delete `1170`) ⊥ `manual_zabery` (sloučení do count+max `1161–1167`, ztrácí indiv. objemy) → sjednotit do seznamu částí.
   - **Riziko:** legacy tact-pole „aktivně matou" (advisor čte `~912–916`, WizardHints píše `CalculatorSidebar.tsx:930`, `buildInput` ignoruje) — odstranit čistě, nerozbít advisor/wizard.
   - 🚧 **SCOPE GUARD:** `price_crane_czk_shift`/`price_pump_czk_h` = **samostatný ticket** (root CLAUDE.md P1 „price_crane/pump → TOV-rozpad"), **NE Gate 5**. Nedotýkat. Nosná cenová pole (3 režimy, `Monolit-Planner/CLAUDE.md §0`) nedotýkat.

**ODHAD-badge (AC 3.8):** reuse `SuggestionBadge` / oranžový `KPICard` (`ui.tsx`); existující badge variant `CalculatorResult.tsx:258–290`. Driver: `part.volume_source === 'odhad_family_ratio'`.

**Otevřené rozhodnutí (ratifikovat na Gate-5 interview, NE teď):** **váha formuláře části.** (a) **KOMPAKTNÍ [doporučeno]** — část = typ + objem NEBO L×W×H + (volit.) override bednění; zbytek z `getSmartDefaults`. Sedí na ±10–15 % filozofii + Karpathy („50 řádků místo 200"). (b) PLNÁ — každá část reuse celý `CalculatorFormFields` (všechny vrstvy). Přesnější, ale těžké UI (N× formulář) + těžká stavba. Rozhodne příští session na svém gate-interview (SDD vzor: každý gate má své interview).

**Tests (tasks.md §1.6 DoD):** část má vlastní bednění/takty/beton (AC 3.1); přidání/odebrání části = složení opěry; ODHAD-badge na odhad-částech (AC 3.8); Σ částí = celkový objem (AC 3.7, engine garantuje); export = jeden řádek (AC 3.3); `tsc`+`vite build` čisté; `cross-user-isolation-reviewer` na zápis pozic (design §7); **živá kontrola na kalkulator.stavagent.cz po deploy**.

---

## 3. Load-bearing invarianty (NEPORUŠIT)

- **Rodič = čistý kontejner**, work-řádky jen na listech → flat-sum KPI sčítá listy, rodič 0 ⇒ **double-count vyloučen BEZ KPI-surgery** (Gate 0).
- **Completeness ladder:** přesné části se nechají; odhad rozdělí zbytek podle placeholder-podílů; poslední odhad pohltí zaokrouhlovací zbytek → **Σ == celkový objem přesně**; přesné bije odhad.
- **`PLACEHOLDER_PART_VOLUME_RATIOS` NEkalibrované** (driky_piliru 0.45 / práh 0.10 / závěrná zídka 0.10 / křídla 0.35) — data-swap follow-up (VP4/SO-250/Žihle), neblokuje Gate 5.
- **Feature-flag `ENABLE_COMPOSITE_PARTS` (backend env, OFF v prod) = MCP/backend cesta** — frontend ji NEpoužívá (počítá in-process). Frontend composite-režim je gate-nut **samotnou existencí nového UI** (atomicky ve Fázi 2 = jeden PR). Obě dohromady → **žádný tichý polo-stav** (AC 3.11).
- **Výpočetní cesty:** frontend počítá **in-process** přes shared (`planElement` / nově `planComposite`), **NE přes HTTP**. MCP (concrete-agent) deleguje na `/api/calculate` (Monolit Cloud Run `monolit-planner-api-…europe-west3`) přes `MONOLIT_API_URL`. Obě sdílí **tutéž shared logiku** → parita konstrukcí.
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
