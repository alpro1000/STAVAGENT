# STAVAGENT — Domain Steering

> **Účel dokumentu:** Doménová pravidla stavebnictví. Co je kanonické, co je terminologicky správné, kdy platí které normy. **Co je STAVAGENT moat, co je commodity.**
>
> Tento dokument je **autoritativní** pro doménová rozhodnutí. Konflikt v jakémkoliv jiném dokumentu — vyhrává tento.
>
> **Verze:** 1.0 — 19.05.2026

---

## 1. Calculator philosophy

### 1.1 Co kalkulátor je

> *Předрасčet, ne výpočet do posledního šroubu.*

**Точность:** ±10-15% (orientational). To je **explicitní design choice**, ne bug.

### 1.2 Co kalkulátor **není**

- ❌ Inženýrský výpočet úrovně DOKA software
- ❌ Statický výpočet konstrukce
- ❌ Konstrukční poradenství
- ❌ Replace přípraváře nebo statika

### 1.3 Hierarchie rozhodování

```
Statik / přípravář
       │
       │ má vždy poslední slovo
       ▼
STAVAGENT návrh (s confidence < 1.0)
       │
       │ je orientational
       ▼
User rozhodne (s confidence = 0.99 — human override)
```

**Pokud má statik námitku** — STAVAGENT respektuje jeho rozhodnutí. Nepokoušíme se přesvědčit statika.

### 1.4 Insight о критическом пути

> *Co je beton — to je harmonogram.*

При тендерировании монолитных мостных конструкций výpočet betonu = критическая cesta. Vše ostatní paralelní nebo následující. Proto správný výpočet betonu = správný harmonogram celého projektu.

---

## 2. Norms — co je kanonické

### 2.1 Použitelné v STAVAGENT (canonical)

| Norma | Pro co | Status |
|---|---|---|
| **DIN 18218** | Lateral pressure on formwork | Engine canonical (Formwork engine) |
| **ČSN EN 1992** | Eurocode 2, concrete structures | Reference v knowledge base |
| **ČSN EN 13670** | Provádění betonových konstrukcí | Maturity engine reference |
| **ČSN EN 206** | Concrete classes, exposure (XA, XC, XD, XF, XS) | Klasifikátor logic |
| **ČSN EN 12812** | Falsework — performance requirements | Skruž logic |
| **TKP** (ŘSD) | Technické kvalitativní podmínky | Bridge / road infrastructure |
| **TP** (ŘSD) | Technické podmínky | Bridge / road infrastructure |
| **VL** (ŘSD) | Vzorové listy | Bridge / road infrastructure |
| **PJPK portal** | `pjpk.rsd.cz` | Správný vstup pro TKP PK / VL ŘSD |

### 2.2 Saul / Nurse-Saul maturity model

- **Použití:** Strip time prediction (kdy odbedňovat)
- **Vstup:** Teplotní profil, čas
- **Výstup:** Maturity index → strength estimate → strip ready
- **Reference:** ČSN EN 13670

### 2.3 RCPSP (Resource-Constrained Project Scheduling)

- **Použití:** Element-scheduler (engine #5)
- **Universal physics + EU OR** — ne regionální
- **Adapter:** Pluggable resource calendar (CZ holidays, regional shifts)

### 2.4 PERT Monte Carlo

- **Použití:** Risk distribution na duration estimates
- **Engine #6**

---

## 3. Knowledge base — B0-B9 buckets

> **Princip "источник истины один".** Pokud v kódu kalkulátoru objevíš zahardcoded normu — to je **bug**, ne feature. Fix přesunutím do Core knowledge_base.

```
concrete-agent/app/knowledge_base/
├── B0_sources/           # Original PDFs, scans
├── B1_otskp/             # OTSKP price catalog (17 904 položek)
├── B2_csn_en_206/        # ČSN EN 206 (concrete classes)
├── B3_current_prices/    # Live market prices (vendor cenníky)
├── B4_productivity/      # Productivity rates (rebar, formwork, pour)
├── B5_tech_cards/        # TTK, technologické postupy
│   └── formwork_vendor/  # PERI, DOKA, ULMA manuals
├── B6_research_papers/   # Academic, university skripta, fib bulletiny
├── B7_regulations/       # ČSN, EN, TKP, DIN
├── B8_company_specific/  # Internal company knowledge
└── B9_validation/        # Cross-validation rules (YAML)
```

### 3.1 Rozhodovací tabulka — kam co dát

| Co přidáváš | Kam |
|---|---|
| Oficiální norma (ČSN EN 206, 13670, 1992) | `B7_regulations/csn_en_<XXX>/` |
| TKP / ZTKP (ŘSD, SŽDC) | `B7_regulations/tkp_<XX>/` |
| DIN (18218, EN 12812) | `B7_regulations/din_<XXX>/` |
| Univerzitní skriptum (ČVUT, VUT, VŠB, UPa) | `B6_research_papers/<univ>_<title>/` |
| fib Bulletin / CEB-FIP / Model Code | `B6_research_papers/fib_<NN>_<title>/` |
| TTK (RU / CZ Provádění) | `B5_tech_cards/<element>/<source>/` |
| Vendor manual (PERI, DOKA, ULMA) | `B5_tech_cards/formwork_vendor/<vendor>_<year>/` |
| Vendor cenník (DOKA, PERI Frami) | `B3_current_prices/<vendor>_<date>/` |
| Vlastní produktivita / kalibrace | `B4_productivity/<topic>/` |
| Kontrolní pravidlo | `B9_validation/<rule_id>.yaml` |
| Vlastní firemní šablona | `B8_company_specific/<topic>/` |

### 3.2 Standardní layout pro nový zdroj

```
<bucket>/<source_slug>/
├── source.pdf              # Original (max 32 MB; větší → B0_sources/)
├── METADATA.md             # Metadata template
├── extracted.yaml          # Strukturované extrakce
└── citations.md            # Konkrétní citace s čísly stran
```

---

## 4. Catalog routing — co kdy použít

### 4.1 OTSKP vs ÚRS — project-type dependent

| Project type | Primary catalog | Sekundární |
|---|---|---|
| **Veřejná zakázka** (public, ZZVZ) | OTSKP | — |
| **Privátní** (hk212, Libuše) | ÚRS | — (OTSKP irrelevant) |
| **D&B** (Žihle) | ÚRS + OTSKP columns | — |

### 4.2 OTSKP detaily

- **Status:** Государственный, бесплатный, публичный каталог. Confidence 1.0 для exact match.
- **Veřejnost:** Можно упоминать публично везде.
- **Engine moat:** **Není** competitive moat — codes are publicly available. Real moat = calculator engines + ÚRS pipeline + classifier.

### 4.3 ÚRS detaily

- **Status:** **Interní jen** — never branded `ÚRS` publicly.
- **Backend acronym** `URS_MATCHER_SERVICE` decoded as **"Unified Retrieval Service"** — defensible technical interpretation.
- **Pipeline:** HTTP client pro online `podminky.urs.cz`; `URS201801.csv` = local fallback only (catalog vintage gap: 2018 codes vs modern 2024).
- **P0 roadmap:** `catalogs/urs_local_cache.jsonl` — 6-8K stažených položek, 10× speedup vs HTTP.

### 4.4 OTSKP kódy — struktura

- **Digity 1-4:** Element prefix (typ konstrukce)
- **Digit 5:** Work type (provedení)

---

## 5. Construction terminology (Czech canonical)

### 5.1 Skruž vs stojky (DŮLEŽITÉ)

| Element | Co to je | Kapacita | Pro co |
|---|---|---|---|
| **Skruž** | Heavy shoring towers | 50-100+ ton | Mosty, bridge elements |
| **Stojky** | Light props | <50 kN | Buildings |

**Rozhodovací pravidla:**
- Bridge elementy → **VŽDY** skruž
- Height >5m → skruž
- Load >50 kN → skruž

**Příklady skruž:** Staxo 100, PERI UP Shoring, VARIOKIT VST
**Příklady stojky:** Staxo 40, MULTIPROP

### 5.2 Spáry

- **Dilatační spára** — permanent structural joint
- **Pracovní spára** — temporary construction joint
- **NEKONFUZIT** — это разные věci

### 5.3 Crew (četa)

- **Četa** = construction crew
- **NE** brigáda (brigáda = side job/moonlighting v ČR)

### 5.4 Pour terminology

- **Záběr** — pour section (řízeno pour-decision engine)
- **Takt** — pour rhythm/cycle
- **Doběrka** — additional set (formwork height >5.4m)

### 5.5 Bridge element types

Bridge elementy které kalkulátor pokrývá:

1. **Pilíř** — bridge pier
2. **Opěra** — bridge abutment
3. **Základ** — foundation
4. **Dřík** — pier shaft
5. **Závěrečná zídka** — closing wall
6. **Křídla** — wing walls
7. **Hlavice** — pier cap
8. **Mostovka** — bridge deck
9. **Římsa** — cornice / parapet

---

## 6. Rebar norms (h/t per element type × diameter)

> Primary source: **methvin.co** (scraped v repu)

### 6.1 Wall rebar (h/t)

| Diameter | h/t |
|---|---|
| D12 | 17.3 |
| D16 | 12.2 |
| D20 | 9.2 |
| D25 | 7.2 |

### 6.2 Slab rebar

| Diameter | h/t |
|---|---|
| D12 | 16.3 |

### 6.3 Beams/Columns rebar

| Diameter | h/t |
|---|---|
| D12 | 22.4 |

### 6.4 Stairs

- D12 = 20.4 h/t
- Stirrups D6-12 = 30 h/t

### 6.5 Element defaults

| Element | Default diameter |
|---|---|
| Opěrné zdi | D12 |
| Mostovky | D20 |
| Pilíře | D25 |
| Římsy | D10 |

---

## 7. Pour crew formula (v4.24, canonical)

### 7.1 Management

**REMOVED** (+3 řízení) — patří do ZS/VRN 3-5% per ČSN 73 0212. Není to part of pour crew.

### 7.2 Volume-scaled crew

| Objem | Crew composition |
|---|---|
| Podkladní <20m³ | 2 |
| Malé <20m³ | 3 |
| Střední 20-80m³ | 4-5 |
| Velké 80+m³ | `n_pump × 2 + ceil(n × 1.5) + ceil(n × 1.0)` |

### 7.3 MEGA pour formula

`n_pump × 2 (укладка) + ceil(n × 1.5) (vibrace) + ceil(n × 1.0) (finish)`

### 7.4 Pump count

`ceil(V / (output × window)) + 1 záložní при ≥500m³`

### 7.5 Night shift

`§116 ZP +10%` (zákoník práce)

---

## 8. Concrete classes — ČSN EN 206 exposure

| Exposure class | Min concrete class | Where |
|---|---|---|
| XA1 (chemical attack, slight) | C30/37 | Geologie XA1 detected |
| XA2 | C30/37 (+special cement) | |
| XA3 | C35/45 | |
| XC4 (carbonation, cyclic wet/dry) | C30/37 | Exteriér |
| XD3 (chlorides, non-marine) | C35/45 | Mosty s rozmrazovacími solemi |
| XF3 (freeze-thaw, high saturation) | C30/37 (air-entrained) | |
| XF4 (freeze-thaw + de-icing salt) | C30/37 (air-entrained) | Mosty |

**Cross-document validation rule:** Geologie XA1 → Statika musí mít min C30/37+. Tento check patří do B9_validation.

---

## 9. Critical KB facts (dont forget)

### 9.1 ÚRS API

- VZ endpoint = **403 без paid licence**
- Registr smluv + dumps = **works**
- Token: `a2053f381a87460f826f67e7654534e1`

### 9.2 Calculator key facts

- **VP4 FORESTINA geometry:** přewrapping T, objem 94.231 m³, opalubka 547.4 m²
- **Pile engine:** `pile-engine.ts` 376 řádků, Ø600/900/1200/1500 × 4 geologie × 3 metody
- **22-23 element types:** 9 mostních + 12 pozemních + prechodova_deska + zaklady_oper

### 9.3 Saul application

- Bez teplotního profilu = strip time conservative (worst case 28 days)
- S teplotním profilem (real-time logger) = optimized strip time

---

## 10. Cross-domain validation rules (B9)

Examples ze setu validačních pravidel:

| Rule ID | Logic |
|---|---|
| `geology_to_concrete_class` | Geologie XA1 → statika min C30/37 |
| `fve_load_on_roof` | TZ Elektro: FVE na střeše → statika přitížení střechy |
| `eps_requirement` | PBŘS: EPS požadavek → slaboproud položky EPS |
| `xc4_min_class` | Exteriér XC4 → min C30/37 |
| `bridge_xf4` | Mosty XF4 → C30/37 air-entrained + rozmrazovací sole |
| `skruz_for_bridge` | Bridge element → skruž (ne stojky) |

---

## 11. Co je STAVAGENT moat (vs commodity)

### 11.1 Moat (co konkurenti nemají)

- ✅ DIN 18218 formwork pressure engine
- ✅ Saul / Nurse-Saul maturity engine
- ✅ RCPSP element scheduler
- ✅ PERT Monte Carlo risk
- ✅ 25 formwork systems × 23 element types coverage
- ✅ Confidence scoring framework
- ✅ Triple access (UI + MCP + REST API)
- ✅ Deterministic-first principle

### 11.2 Commodity (mají to ostatní)

- ❌ OTSKP code lookup (publicly available)
- ❌ Excel parsing
- ❌ PDF extraction
- ❌ AI document classification (Aitenders, Togal)
- ❌ Czech language understanding (Gemini/Claude native)

### 11.3 Strategic insight

> **Real moat = calculator engines + ÚRS pipeline (Unified Retrieval Service) + classifier + work breakdown.**
>
> OTSKP codes are publicly available — to není moat. To, že jsme schopni z TZ vygenerovat **engineering-grounded** výkaz výměr s harmonogramem — to je moat.

---

## 12. Document versioning

| Date | Version | Notes |
|---|---|---|
| 19.05.2026 | 1.0 | Initial domain steering. Synthesized from KNOWLEDGE_PLACEMENT_GUIDE.md, CALCULATOR_PHILOSOPHY.md, SKRUZ_TERMINOLOGIE_KANONICKA.md, REBAR_NORMS_COMPREHENSIVE_AUDIT.md, Project_Knowledge_Snapshot §5-6 + userMemories. |
