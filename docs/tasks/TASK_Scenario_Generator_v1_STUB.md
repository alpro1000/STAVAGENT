# TASK: Scenario Generator s Resource Constraints (STUB)

> **Verze:** v1-stub
> **Datum:** 2026-05-20
> **Priorita:** P2 (post-říms calibration)
> **Effort estimate:** ~3-5 dnů Claude Code session
> **Depends on:** `TASK_Rimsa_Calibration_FullStack_v1.md` (scheduler refactor + resource caps must land first)

---

## Účel

Calculator dnes vrátí 1 výpočet z 1 inputu. Tento task přidává **scenario generator**, který z 1 element inputu generuje **3 varianty** (min/balanced/fast) s různými alokacemi zdrojů, validuje proti resource caps a vrátí Pareto-optimální set.

---

## Příklad výstupu

```yaml
input:
  element_type: rimsa
  total_volume_m3: 22.562
  total_length_bm: 70
  num_rimsas: 2

scenarios:
  scenario_A_minimal:
    name: "Minimální tým"
    crew_total: 5  (1 mistr + 2 tesaři + 2 železáři)
    formwork_sets: 1
    shift_length_h: 8
    days: 70
    cost_czk: 850 000
    fits_winter_window: true
    constraints_ok: true

  scenario_B_balanced:
    name: "Vyrovnaný"
    crew_total: 12 (1+4+3+4)
    formwork_sets: 2
    shift_length_h: 10
    days: 45
    cost_czk: 950 000
    fits_winter_window: true
    constraints_ok: true

  scenario_C_fast_track:
    name: "Zrychlený"
    crew_total: 20 (1+6+5+8)
    formwork_sets: 3
    shift_length_h: 12 + 8h druhá směna
    days: 25
    cost_czk: 1 200 000
    fits_winter_window: true
    constraints_ok: false  ⚠️
    warnings:
      - "§93 ZP přesčas limit překročen pro 2 osoby"
      - "Crew=20 vazačů na 1 site je provozně náročné — koordinace"

pareto_optimal: [scenario_A, scenario_B]   # C má constraint violations
recommended: scenario_B                     # balanced cost vs time
```

---

## Klíčové požadavky

1. **Reuse existing engines** — žádný nový kalkulačný engine, jen orchestration vrstva
2. **Resource caps z předchozího tasku** — validate per scenario
3. **Pareto frontier** — automatically eliminate dominated scenarios
4. **3 default varianty:** Min crew (cost-optimized) / Balanced (recommended) / Fast (time-optimized)
5. **Custom scenarios:** uživatel může definovat vlastní (např. "co když 2 čety + 1 set bednění?")
6. **Constraint highlighting** — UI ukáže červeně warnings pro porušené resource caps

---

## Out of scope

- Multi-objective optimization (Pareto frontier víc než cost+time)
- Machine learning pro doporučení (post N≥5)
- Auto-scheduling proti zimní pauze (separate task)
- Crew composition optimization (jen total crew, ne split per profession)

---

## Acceptance criteria

1. UI button "Generuj 3 varianty" na element=rimsa page → vrátí 3 scenarios
2. Resource caps z `TASK_Rimsa_Calibration_FullStack_v1.md` se aplikují
3. Constraint violations zvýrazněné v UI
4. Pareto frontier automaticky filtruje dominated scenarios
5. Export scenarios do Excelu (porovnávací tabulka)
6. MCP tool `generate_scenarios` mirrors UI behavior

---

## Naming rule

> Naming a strukturu souborů určuj podle existujících konvencí v repo.
> Nevytvářej paralelní struktury. Rozšiřuj existující kód.

---

**Author:** STAVAGENT scenario generation gap analysis, 2026-05-20
