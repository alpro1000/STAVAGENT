# Backlog Ticket #1 — Calculator Prompt/Scope Extension

**Priority:** P1 (HIGH)
**Type:** Product / engineering enhancement
**Origin:** Master Soupis Reconciliation, Žihle 2062-1, Session 1 audit (2026-05-06)
**Affects:** `Monolit-Planner/shared/`, `concrete-agent/app/services/`
**Related gap:** G1 in `04_documentation/reconciliation_report.md`

---

## 1. Problem Statement

The Monolit-Planner calculator currently covers **~10 % of a real BOQ** for a Czech bridge
tendr — only the betonářské elementy (beton, výztuž, bednění, podpěry, zrání, předpětí).

Concrete numbers from the Žihle 2062-1 reconciliation:
- Manual XLS ground truth (`SO 201 - Most ev.č. 20-005 - JŠ.xls`): **77 položky s množstvím > 0**
- Phase C calculator outputs (`03_calculation/outputs/*.json`): **11 elementů**
- Coverage: **~14 %** of manual BOQ scope

The remaining 86 % consists of položky that are **technologically necessary** for any
mostní DUR submission but lie outside the current calculator scope:

| TSKP třída | Typ položek | Coverage gap |
|---|---|---|
| 0 — Všeobecné | Poplatky za skládku, zařízení staveniště, doprava, geodezie | 100 % missing |
| 1 — Zemní práce | Sejmutí ornice, hloubení jam, čerpání vody, odstranění křovin | 100 % missing |
| 5 — Komunikace | Vozovkové vrstvy MZK + štěrkodrť + asfaltobeton 3-vrstvá | 100 % missing |
| 7 — PSV | Izolace mostovek (asfaltové pásy), izolace pod římsou | 100 % missing |
| 8 — Potrubí | Drenáže DN 150/200, odpadní potrubí mostovky | 100 % missing |
| 9 — Ostatní | Svodidla H1/H2, dilatační závěry, ložiska, schodiště, signalizace | 100 % missing |

For a real Czech bridge tendr (BERGER, SÚSPK, 30M Kč), the calculator must contribute to
**all 10 TSKP tříd**, not just 2-4. Currently the rozpočtář ručně dopílí ~50 položek per
SO objekt, což reduces calculator value to under 30 % of the actual deliverable.

---

## 2. Why This Matters Now

1. **Tendr-readiness goal:** STAVAGENT positions itself as "construction cost estimation
   SaaS for Czech market" (CLAUDE.md). Real Czech tendr submission requires full BOQ —
   not betonářský excerpt.
2. **Reconciliation evidence:** Žihle 2062-1 is a real D&B tendr with deadline 2026-07-02.
   Analyzing its structure exposes exactly where the calculator stops producing value.
3. **MCP-server marketing:** `calculate_concrete_works` MCP tool returns only betonářské
   čísla. ChatGPT users running real tendrové scenarios will hit this wall fast.

---

## 3. Proposed Scope

Extend calculator to cover **3 additional layers** beyond current betonářský core:

### Layer A — Zemní + Komunikace (TSKP 1 + 5)

| Element | New element_type | Inputs | Outputs |
|---|---|---|---|
| Zemník — sejmutí ornice | `sejmuti_ornice` | area_m², thickness, transport_km | objem, množství, cena |
| Hloubení jam pro základy | `hloubeni_jam` | width × length × depth, soil_class | objem, hodiny stroje, cena |
| Vozovka 3-vrstvá živičná | `vozovka_zivicna` | area_m², layer_thickness_table | objemy per vrstvu, cena |
| Štěrkodrť podkladní | `stkrkodrt_podklad` | area_m², thickness | objem, množství, cena |
| Mechanicky zpevněné kamenivo | `mzk_vozovka` | area_m², thickness | objem, množství, cena |

### Layer B — Mostní svršek + izolace (TSKP 6 + 7)

| Element | New element_type | Inputs | Outputs |
|---|---|---|---|
| Asfaltové pásy izolace mostovky | `asf_izolace_mostovka` | area_m², layers | množství, cena, hodiny |
| Izolace pod římsou | `asf_izolace_rimsa` | length_m, profile | množství, cena |
| Pečetící vrstva | `pecetici_vrstva` | area_m² | množství, cena |
| Striáž povrchu | `striaz_betonu` | area_m² | hodiny, cena |

### Layer C — Mostní vybavení (TSKP 9)

| Element | New element_type | Inputs | Outputs |
|---|---|---|---|
| Svodidlo silniční H1/H2 | `svodidlo_silnicni` | length_m, úroveň zadržení | množství kg, ks, hodiny, cena |
| Mostní zábradlí | `zabradle_mostni` | length_m, výška | množství kg, hodiny, cena |
| Dilatační závěr modulární | `dilatacni_zaver` | length_m, šířka spáry, druh | ks, cena |
| Mostní ložisko | `mostni_lozisko` | nosnost, druh (elastomer/hrncové) | ks, cena |
| Kamenná dlažba | `dlazba_kamen` | area_m², tloušťka | množství m³, cena |

---

## 4. Technical Approach

### 4.1 Element Catalog Expansion
- File: `Monolit-Planner/shared/src/calculators/element-classifier.ts`
- Action: extend `ELEMENT_CATALOG`, `ELEMENT_DEFAULTS`, `SANITY_RANGES`, `BRIDGE_ELEMENT_ORDER`
  per nových ~14 element_type
- Test: vitest fixtures pro každý nový type s real-world manual data (Kfely + Žihle XLS)

### 4.2 Engine Pipeline Reuse
- Pour-flow elements (vozovka, izolace) reuse existing `pour-decision.ts` + `scheduler.ts`
- Lineární elementy (svodidlo, zábradlí, dilatace) need new linear-engine path:
  productivity h/m × length, no formwork, no curing
- Materiálové elementy (ložisko, kamenná dlažba) ks-based with catalog price lookup

### 4.3 Calculator Suggestions Extension
- File: `concrete-agent/app/services/calculator_suggestions.py`
- Action: extend `_PROJECT_FACTS` write-through to include new element types
- Test: round-trip test parse XLSX → calculator inputs → soupis → patch existing soupis

### 4.4 MCP Wrapper
- File: `concrete-agent/app/mcp/tools/calculator.py`
- Action: extend `calculate_concrete_works` schema to accept new element types OR
  introduce new tool `calculate_full_boq` (with all 14 elements + concrete core)
- CI: `tests/test_mcp_compatibility.py` adds 14 new element coverage tests

---

## 5. Acceptance Criteria

- [ ] Calculator covers ≥ **80 %** of Žihle SO_201 manual XLS položek (target: 60+/77)
- [ ] Coverage matrix updated in `Monolit-Planner/docs/CALCULATOR_PHILOSOPHY.md`
- [ ] All 14 nových element types have ≥ 1 vitest fixture each (target: +14 tests)
- [ ] OTSKP code mapping per nový element type in `element-classifier.ts` regex/keyword rules
- [ ] MCP `calculate_concrete_works` (or new) returns full structure including non-betonářské
- [ ] E2E test: Žihle 2062-1 calculator output, after patch, hits **≥ 60 položek** vs current 11
- [ ] Documentation update: `next-session.md` per Monolit-Planner

---

## 6. Out of Scope

- Cenové databáze pro non-betonářské elementy (potřebuje URS + OTSKP-SP fuzzy lookup —
  → covered by **Backlog Ticket #2 — OTSKP search algorithm**)
- Schodiště mostní (low-volume use case, defer)
- Mostní revizní cesty (ne pro silniční mosty kromě dálnic)

---

## 7. Estimated Effort

- 14 nových element types × ~4 h spec + ~3 h impl + ~2 h test = **~120 h** (~3 weeks 1 dev)
- MCP wrapper + CI: ~16 h
- Documentation + integration with calculator-philosophy.md: ~8 h
- **Total: ~144 h**

---

## 8. Cross-References

- Reconciliation gap matrix: `04_documentation/reconciliation_report.md` § 6 G1
- Manual XLS reference: `04_documentation/manual_reference_JS/SO_201_parsed.yaml`
- Žihle calculator outputs: `03_calculation/outputs/_all_outputs.json`
- Master soupis (Phase D): `04_documentation/soupis_praci_zihle_2062-1.xml`
- Calculator philosophy: `docs/CALCULATOR_PHILOSOPHY.md` (target ±10–15 % accuracy)
