# TASK T0: Baseline audit logiky kalkulátoru (element po elementu)

> **Verze:** v1
> **Datum:** 2026-06-03
> **Priorita:** P0 — FUNDAMENT. Musí proběhnout PŘED jakoukoli implementací T1–T5.
> **Typ:** RECON / AUDIT — žádné změny kódu. Pouze čtení a report. STOP na review.
> **Affects (jen čte):** všech 7 calculator enginů, ELEMENT_TYPES, WORK_TEMPLATES, Monolit-Planner UI, KB B*, MCP calculator tools
> **Staví na:** PR #1145 (full UI walkthrough audit) — NEpřepisovat, navázat

-----

## Mantra

> Nejdřív přečti celý repo. Nic neměň. Nic nepiš. Najdi co už existuje a kde si to odporuje.
> Cíl: než přidáme cokoli nového (T1–T5), znát PŘESNÝ stav — aby nové nerozbilo a neodporovalo starému.

-----

## Proč tento task (od uživatele)

Uživatel chce před přidáváním nové logiky (mostní podpěry, záběry, bednění, dekompozice) **ověřit co už v kalkulátoru je**, aby se nic nerozbilo a nenapsalo nic protichůdného. Ve frontendu už **existují rozpory, které zatím nejsou opravené**. Proto: projít **všechny elementy jeden po druhém** a zmapovat skutečný stav logiky + soupis všech rozporů. Teprve s touto mapou se bezpečně implementuje cokoli dalšího.

-----

## Co přečíst nejdřív (priorita)

1. `CALCULATOR_PHILOSOPHY.md` — principy
2. `calculator_element_logic_v4_FINAL.md` + `calculator_complete_pipeline.md` — element logika + pipeline + GAP analýza
3. `docs/audits/calculator_field_audit/2026-05-14_full_ui_walkthrough.md` (PR #1145) — **už nalezené rozpory frontendu**
4. `docs/audits/calculator_resource_ceiling/` (PR #1110) — resource ceiling audit
5. `Monolit-Planner/shared/src/calculators/` — všech 7 enginů + `planner-orchestrator.ts` + `resource-ceiling.ts`
6. ELEMENT_TYPES (katalog 22+ typů) + WORK_TEMPLATES — definice
7. MCP calculator tools (classify, breakdown, calculate, pump, advisor) + Core Engine API
8. KB `B4_production_benchmarks/`, `B5_tech_cards/`, `B7_regulations/`, `B9_validation/conflicts/`

-----

## RECON — Část 1: Průchod po elementech (VŠECHNY, jeden po druhém)

Pro KAŽDÝ element v ELEMENT_TYPES (projít celý seznam, ne výběr) vrať řádek:

| Co zjistit | Detail |
|---|---|
| **Engine logika** | Která funkce/engine počítá tento element? Co počítá (objem, bednění, výztuž, harmonogram, četa)? |
| **WORK_TEMPLATE** | Má vlastní šablonu, nebo padá na generickou / žádnou? |
| **UI pole** | Která pole se v Monolit-Planner zobrazují pro tento element? |
| **Wired vs dead** | Která UI pole jsou napojená do engine a která jsou mrtvá (zobrazená, ale engine je ignoruje)? |
| **Normy** | Které normy/konstanty element používá (rebar ratio, curing, tlak betonu, produktivita) a odkud — KB `B*` nebo natvrdo v kódu? |
| **Rozpory** | Jakékoli rozpory pro tento element (viz Část 2) |

Cíl: **kompletní mapa** — žádný element nevynechán.

-----

## RECON — Část 2: Registr rozporů (sběr + klasifikace)

Sesbírej VŠECHNY rozpory do jednoho registru. Začni od už nalezených v #1145, doplň nové:

**Známé z #1145 (ověř, zda stále platí):**
- Osiřelá pole (`use_retarder`, `concrete_consistency`) — zobrazená, nenapojená
- Duplicitní pole Výška (D7 vs E1)
- Mrtvý kód smart-defaults (helpers nenapojené)
- Tabulka porovnání bednění ukazuje stropní systémy tam, kam nepatří (např. pro říms)
- Geometrie inputs ploché (bez hierarchie)

**Nové kategorie k prohledání:**
- **UI vs engine mismatch** — pole, jehož hodnota se v UI zadává jinak, než ji engine interpretuje
- **ELEMENT_TYPES ↔ WORK_TEMPLATES drift** — kolik typů, kolik šablon, které typy nemají šablonu (znám problém)
- **DRY / single source of truth** — kde se stejná hodnota (produktivita, rebar ratio, harmonogram) počítá na víc místech (UI vs MCP vs Core Engine) a mohou se rozejít
- **Hardcoded matice** — `REBAR_RATES_MATRIX`, `CURING_DAYS_TABLE`, tlakové/produktivita konstanty natvrdo v kódu místo v KB `B*`
- **Default-vs-default false INFEASIBLE** — kde resource-ceiling defaults nesedí s orchestrator/crew defaults (návaznost na #1300)
- **Bednění bez vazby na normu** — kde výběr/výpočet bednění ignoruje tlak čerstvého betonu (ČSN 73 0042 / DIN 18218)

Pro každý rozpor: **soubor:řádek**, popis, závažnost (P0 rozbíjí výpočet / P1 matoucí / P2 kosmetika), a zda blokuje implementaci T1–T5.

-----

## Výstup (co ukázat před review)

1. **Per-element baseline mapa** — tabulka přes všechny ELEMENT_TYPES (Část 1).
2. **Registr rozporů** — sjednocený seznam (#1145 + nové), s lokací, závažností, blokuje-T1–T5 ano/ne.
3. **Single-source-of-truth mapa** — kde je výpočetní logika duplikovaná (UI / MCP / Core Engine).
4. **Doporučení pořadí oprav** — co opravit PŘED přidáním nové logiky podpěr (T1+), aby nové nerozbilo staré. Seřazeno dle závažnosti a blokování.

**STOP. Žádné změny. Čekej na review. Teprve po review se rozhodne, co opravit jako první.**

-----

## Mimo rozsah (NEDĚLAT)

- Jakákoli oprava kódu — toto je čistě audit. Opravy jsou samostatné tasky po review.
- Implementace mostních podpěr (T1) — čeká na výsledek tohoto auditu.
- Refaktor scheduleru, UI úpravy — až po review baseline.

-----

## Acceptance (úplnost auditu, ne kód)

- Baseline mapa pokrývá **každý** element v ELEMENT_TYPES (žádný vynechán).
- Registr rozporů obsahuje všechny položky z #1145 (ověřené: platí/neplatí) + nové nálezy.
- Každý rozpor má lokaci (soubor:řádek), závažnost a flag „blokuje T1–T5".
- Doporučené pořadí oprav je jasné a odůvodněné.
- Žádná změna kódu v repu (čistý pracovní strom; jen report).

**Confidence:** 0.85 — staví na existujícím auditu #1145 a filozofii kalkulátoru; pokrytí všech elementů se potvrdí průchodem.
