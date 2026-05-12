# STAVAGENT Product Patterns

**Status:** Validated через Žihle 2062-1 pilot (2026-05-07)
**Audience:** Core team, contributors, future Claude Code sessions
**Purpose:** Reusable patterns для каждого следующего D&B projektu

---

## Pattern 1: Per-SO Chunking pro Master Soupis

### Problem
Generовать `master_soupis.yaml` (>120 položek) v jednom Claude Code response → API stream
timeout, generation hangs, partial output lost. Žihle Session 2 2027 minutes идle затем timeout.

### Solution
Per-SO chunking. Каждый SO = separate file = separate session = separate commit:

```
master_soupis_SO_001.yaml      ← 30 položek
master_soupis_SO_180.yaml      ← 26 položek
master_soupis_SO_201_t0.yaml   ← 10 položek (per TSKP třída pokud SO velký)
master_soupis_SO_201_t1_t2.yaml
master_soupis_SO_201_t3_t4.yaml
master_soupis_SO_201_t5_t6_t7.yaml
master_soupis_SO_201_t8_t9.yaml
master_soupis_SO_290.yaml
master_soupis_SO_801.yaml
master_soupis_VRN.yaml
master_soupis.yaml             ← aggregation/index (final)
```

### Rules
- **Žádný položku v 2 SO files** (anchor pattern если cross-reference required)
- **Aggregation = simple concat + validation** — žádná new logic
- **Commit po každém SO** — checkpoint pattern, recover from timeouts
- **API timeout?** → split per TSKP třída (5-10 položek per session)

### Validated scale (Žihle)
- 154 položek total v 10 files
- 0 API timeouts after switching to per-SO
- ~30 min per SO session (vs hours for monolithic)

---

## Pattern 2: Audit Trail Mandatory

### Problem
Smetní položky bez audit trail jsou rejected projektantem nebo statikem. Legal requirement
v CZ smetní praxe — každý mnozstvi musí mít provenance.

### Solution
Každá položka MUSÍ mít:

```yaml
- otskp_kod: "421325"
  popis: MOSTNÍ NOSNÉ DESKOVÉ KONSTRUKCE C30/37
  mj: m3
  mnozstvi: 33.6
  vypocet:                                      # ← MANDATORY
    formula: "L × B × t"                        # math expression
    vstupy:                                      # input parameters
      L: {hodnota: 9.0, jednotka: m, popis: "rozpětí mostu", zdroj: "Phase A HPM"}
      B: {hodnota: 8.30, jednotka: m, popis: "celk. šířka", zdroj: "Phase B"}
      t: {hodnota: 0.45, jednotka: m, popis: "tloušťka desky", zdroj: "Pokorný-Suchánek tab. 15"}
    vypocet_kroky:                              # step-by-step
      - "9.0 × 8.30 = 74.7 m² (plocha desky)"
      - "74.7 × 0.45 = 33.6 m³"
  confidence: 0.85
  source: calculator_deterministic | user_manual_fallback | paušál_administrativní
```

### Rules
- **Žádný položku bez audit trail** — regardless of confidence
- **Source traceable** — KB norm citation, vendor quote, calculator output, expert manual
- **Confidence honest** — 0.5 = orientational, 0.7 = good, 0.85 = high, 1.0 = exact
- **NO fabrication** — pokud zdroj missing, flag explicitly nikoli "made up"

### Validation in Žihle
- 154/154 položek = 100% audit trail coverage
- 0 fabricated values
- Auto-validation v build_master_soupis.py

---

## Pattern 3: Triangulation Philosophy

### Problem
Multiple sources of truth disagree — který wins? Naive "expert wins" wrong because expert
intuition can be wrong. Naive "calculator wins" wrong because calculator misses edge cases.

### Solution
**No single winner. Compare 3 sources, document deltas, present ranges + flags.**

```
Source 1: User manual (expert intuition)         ← e.g. tloušťka 0.50 m guess
Source 2: Calculator deterministic (engineering) ← e.g. tloušťka 0.45 m per Pokorný
Source 3: KB norm (authoritative range)          ← e.g. 0.30-0.45 m per Pokorný tab. 15
        ↓
Reconciliation matrix (per element):
  - Match (Δ ≤ 5%)
  - Minor delta (5-15%)
  - Major delta (>15%)
  - Missing in source X (system gap)
        ↓
Master soupis output:
  - Calculator deterministic = primary value (per choice C — repeatable)
  - User manual delta flagged inline if > 10%
  - Range documented in audit trail
  - "Final value selection by projektant in DPS"
```

### Rules
- **No automatic "winner"** declaration
- **Reconciliation report** documents every delta s explanation
- **System gaps** documented as backlog (calculator improvements)
- **Confidence reflects** triangulation status (match=high, big delta=lower)

### Validated in Žihle
- 76 user manual + 11 calculator + KB ranges = 3 sources triangulated
- Mostovka deska: calc 33.6 m³ vs user 37.62 m³ (Δ +12%) → flag, calculator deterministic wins per choice C
- 4 system gaps G1-G4 documented for backlog (~196h calculator fixes)

---

## Pattern 4: Anchor Pattern для Cross-SO References

### Problem
Same OTSKP kód appears v multiple SO objektech. Naive duplication = double-counting v total.
Naive removal = lose visibility v context jednoho SO.

### Solution
**Anchor pattern:** položku include v obou SO, ale **cost only v jednom**.

```yaml
# SO 180 (provizorium ASSEMBLY)
- otskp_kod: "027413"
  popis: "PROVIZORNÍ MOSTY - DEMONTÁŽ"
  mj: m2
  mnozstvi: 60.0
  jedn_cena_kc: 0           # ← ANCHOR — cost 0 here
  cena_celkem_kc: 0
  poznamka: "Anchor pro visibility. Actual cost v SO 001 T9-11."

# SO 001 (DEMOLICE — actual cost)
- otskp_kod: "027413"
  popis: "PROVIZORNÍ MOSTY - DEMONTÁŽ (po dokončení nového)"
  mj: m2
  mnozstvi: 60.0
  jedn_cena_kc: 8000        # ← ACTUAL cost here
  cena_celkem_kc: 480000
  poznamka: "Demontáž provizoria po dokončení mostu (assembled v SO 180)"
```

### Rules
- **Položka visible v both contexts** — no information loss
- **Cost in only one** — no double-counting
- **Explicit reasoning** v poznámka — projektant understands why
- **Validation rule:** check totals — same kód cost should appear once

---

## Pattern 5: TSKP Hierarchical Structure (0-9)

### Problem
Flat list of OTSKP položek doesn't reflect Czech construction practice. Postup prací
emerge ad-hoc. Items missing because no checklist per category.

### Solution
**TSKP class hierarchy** baked into každý SO. Postup prací = sequence of třídy 0→1→2→...→9.

```
Třída 0 — Všeobecné konstrukce a práce (administrativa, geodézie, dokumentace, zkoušky)
Třída 1 — Zemní práce (výkopy, zásyp, ornice, čerpání vody)
Třída 2 — Základy (piloty, plošné, drenáže, geotextilie)
Třída 3 — Svislé konstrukce (opěry, dříky, římsy)
Třída 4 — Vodorovné konstrukce (mostovka, přechodové desky)
Třída 5 — Komunikace (vozovkové vrstvy, ACO/ACL/SMA, podsyp)
Třída 6 — Úpravy povrchů (striáž, otryskání)
Třída 7 — Přidružená stavební výroba (izolace, nátěry)
Třída 8 — Potrubí (drenáže, chráničky)
Třída 9 — Ostatní konstrukce a práce (svodidla, závěry, příkopy, zatěžovací zkouška)
```

### Rules
- **Each SO** organized по TSKP třídě (0-9, kde aplikovatelné)
- **Sequence within třída** = OTSKP code numerical order
- **Postup prací emergent** ze structury, ne separately specified
- **Per-třída checklist** prevents missing items (especially třídy 0/1/9)

### Validated in Žihle
- SO 201: full 0-9 spread (10+10+14+17+21 = 72 items across 9 sections)
- SO 001: třídy 0+1+9 (administrative + zemní + demolice properties)
- Calculator gap identified: třídy 0/1/9 missing → backlog ticket

---

## Pattern 6: No Work Duplication Rule

### Problem
Same work counted in multiple SO objektech inflates total cost. Hard to detect manually
across 100+ items.

### Solution
**5 separation strategies** for same OTSKP code in multiple SO:

```
Strategy 1: Geographic
  574I54 SMA 11+ obrusná
    → SO 201 (most + 60m nájezdy = 565 m²)
    → SO 290 (silnice navazující 225m × 6m = 1350 m²)
  
Strategy 2: Lifecycle
  914352 dopravní značky
    → SO 001 (demontáž stávajících = -10 ks)
    → SO 180 (dočasné provizorní = +10 ks)
    → SO 201 (trvalé nové = +12 ks)
  
Strategy 3: Spec
  574xxx vozovkové vrstvy
    → SO 180 (provizorní 6 měs ŠD+MZK+ACO 40mm = different OTSKP)
    → SO 201 (trvalé SMA+ACL+ACP 3-vrstvá long-term)
  
Strategy 4: Length
  935212 příkopové žlaby
    → SO 201 (most + nájezdy = 25.68 m)
    → SO 290 (silnice 225 m)
  
Strategy 5: Sum
  9113B1 silniční svodidlo H1
    → SO 201 (60 m nájezdy)
    → SO 290 (100 m silnice)
    Total instalace = 160 m
```

### Rules
- **Default:** každý OTSKP code v jednom SO maximum
- **Exception:** explicit separation per 5 strategií + reasoning v poznámce
- **Validation:** build script detects shared codes, flags v validation_report.md
- **Anchor pattern** (pattern 4) for cross-SO assembly/demolice

---

## Pattern 7: Vendor Pricing Integration

### Problem
Phase D estimates without vendor data = confidence 0.0 placeholder values. Real tender
needs real prices.

### Solution
**Median of 3+ vendors** + range documented inline.

```yaml
- otskp_kod: "027411"
  popis: PROVIZORNÍ MOSTY - MONTÁŽ (Mabey/Bailey type)
  mj: m2
  mnozstvi: 60.0
  jedn_cena_kc: 2926                    # ← median of 4 vendors
  vypocet: { ... formula ... }
  confidence: 0.85                       # ← raised from 0.0 by vendor data
  vendor_pricing:
    median_kc: 2926
    range_min_kc: 2400
    range_max_kc: 3500
    sources:
      - vendor: TMS
        date: 2026-04-21
        price_kc_per_m2: 2800
      - vendor: PONVIA MS
        date: 2026-04-22
        price_kc_per_m2: 3500
      - vendor: Mosty Záboří 4m
        date: 2026-04-25
        price_kc_per_m2: 2400
      - vendor: Mosty Záboří 3.5m
        date: 2026-04-25
        price_kc_per_m2: 3000
```

### Rules
- **3+ vendors minimum** for median
- **Range** (min/max) inline pro transparency
- **Vendors named** v test-data/projects/ (project-specific)
- **Anonymized** v B3_current_prices/ (KB enrichment)
- **Re-quote** every 6-12 months for market validity

### Validated in Žihle
- 4 provizorium vendors (TMS, PONVIA MS, Mosty Záboří 4m+3.5m)
- 1 zemina vendor (DECO TRADE 120 Kč/t)
- 1 recyklace vendor (RS Žatec ceník 2026)
- SO 180 confidence 0.0 → 0.85 after vendor integration

---

## Pattern 8: Door-vs-Gate Classification Hazard

### Problem
Tabulky dveří (Tabulka 0041, similar 0040–0049 series) list **ALL openings** as
"dveře" — including:

- **Garážová vrata** (sekční / rolovací / industriální)
- Roll-up doors pro sklady/dílny
- Technical room access hatches
- Fire access panels
- Loading-bay doors

Všechny share generic `D##` code prefix in tabulkách, ale require **completely
different work items** než standard dveře. Generator that blindly applies
interior-door template (rám + křídlo + obložky + EMZ + zámek) na garage gate
emits ~10 wrong items × ~5 000 Kč each = ~50 000 Kč nonsense + missing the
actual ~80 000 – 150 000 Kč gate scope = ~200 000 Kč cumulative error per gate.

### Detection signals
Cross-check each `D##` code proti these criteria — if **any** match, suspect
gate not door:

| Signal | Door pattern | Gate pattern |
|---|---|---|
| **Floor type linked** | F01–F09 (interior dlažba/vinyl) | F10 PU garáž / industrial floor |
| **Room type** | byt / chodba / WC | garáž / sklad / technická místnost |
| **Width** | 800–1100 mm | 2 500+ mm (often 3 000–6 000) |
| **Height** | 1 970–2 100 mm | 2 100–3 500 mm |
| **Tabulka poznámka** | (none) / interior spec | "sekční" / "rolovací" / "industriální" / vendor name (Hörmann / TRIDO / Lomax) |
| **Drawing block** | standard double-arc dveř block | distinct vrata block (parallel lines + motor symbol) |
| **Linked místa.objekt** | matches current generator scope | cross-scope (place v B/C while generator runs for D) |

### Resolution pattern
1. Generate door items **conservatively** for všech `D##` (default = standard
   interior door template).
2. Run pre-delivery cross-check phase: any `D##` linked k `garáž` room, F10
   floor, či wider than 2 500 mm?
3. If yes → **reclassify** k gate-specific items + **deprecate** door items.
4. Document reclassification in `carry_forward_findings` (audit trail).
5. Items remain visible v výkazu s `[DEPRECATED PROBE X]` prefix, `mnozstvi=0`
   (auditable that they were considered but rejected).

### Gate-specific items pro Π.1 V1
Per garage gate set, emit instead of door items:

```
HSV-642 / spec. kapitola: Sekční vrata Hörmann/TRIDO/Lomax kompletní set
                          (křídlo + vodítka + těsnění)             ~50–80k Kč
M-21x:                    Elektrický pohon (Marantec/Hörmann)      ~15–25k Kč
PSV-952:                  Montáž pohonu + ovládací jednotky        ~5–10k Kč
Bezpečnostní senzory:     fotobuňky + indukční smyčka + nárazové
                          lišty (pro zpětný provoz)                ~10–15k Kč
Ovládání:                 dálkové ovladače + nástěnné tlačítko +
                          komunikace s domácím systémem            ~5–10k Kč

NO zárubně, NO obložky, NO kliky/zámky (sekční vrata mají vlastní rám).
Reference cena per set: ~80 000 – 150 000 Kč.
Per objekt typically 1–2 sets.
```

### Validated in Libuše 185-01
- **D05** = sekční vrata pro S.C.02 / S.C.03 / S.B.02 garáže (objekty B + C).
- Generator initially used standard interior-door template → 11 items
  deprecated v Phase 0.19 (PROBE 6).
- **Cross-link s PROBE_14b** F10 PU garáž floors (~1 134 m² across same garáže).
- Closed pro objekt D (no garáže → all D05 items qty=0 + `[DEPRECATED PROBE 6]`
  prefix). Carry-forward `status=DEFERRED_TO_KOMPLEX_C_B`.

### Cross-project applicability
**HIGH** — most building projects have at least one garáž / industrial space
s sekční / rolovací vraty coded as `D##` in tabulkách. Bridge / D&B projects:
LOW (no buildings) — but applies to ZS sklady, technologické objekty s vraty.

### Code references
- `phase_6_2_reclassify_osazeni.py` — reclassification logic
- `phase_0_19_*` — deprecation marker (`[DEPRECATED PROBE X]` prefix)
- `items_objekt_D_complete.json` carry_forward `PROBE_6` next_action — gate
  items template pro budoucí generator

---

## Anti-patterns — what to AVOID

### ❌ Monolithic master_soupis.yaml generation
**Why:** API stream timeouts, lost work, hours wasted.
**Instead:** Pattern 1 per-SO chunking.

### ❌ "Calculator wins" or "Expert wins" winner declaration
**Why:** Both can be wrong. Hidden assumptions = silent errors.
**Instead:** Pattern 3 triangulation s explicit reconciliation.

### ❌ Položky bez audit trail
**Why:** Smeta rejected by projektant. No legal traceability.
**Instead:** Pattern 2 mandatory formula + vstupy + kroky + confidence.

### ❌ Same OTSKP code in 2+ SO bez explanation
**Why:** Double-counting inflates cost. Hard to detect later.
**Instead:** Pattern 6 with 5 separation strategies + Pattern 4 anchor.

### ❌ Generating engineering CAD drawings as STAVAGENT output
**Why:** CAD = mature engineering domain. AI cannot sign výkres. Liability mismatch.
**Instead:** ADR-005 — capability stays for validation, NOT deliverable.

### ❌ Skipping třídy 0/1/9 (administrativa, zemní detail, doprovodné práce)
**Why:** Missing 30-40% of položek. Calculator gap.
**Instead:** Pattern 5 TSKP hierarchical checklist + per-třída sessions.

### ❌ Single vendor quote
**Why:** No price validation. Confidence remains low.
**Instead:** Pattern 7 median of 3+ + range documented.

---

## Application checklist для next project

When starting nový D&B bridge tender:

- [ ] **Phase A (extraction)** — read TZ + ZD, parse facts, structure into project.json
- [ ] **Phase B (design)** — 6 deliverables (varianta + decomposition + concrete + formwork + provizorium + element_breakdown)
- [ ] **Phase C (calculator)** — run calculator on Phase B inputs, produce 11+ element JSONs
- [ ] **Phase D — Audit data sources** (Pattern 7)
  - [ ] Vendor RFQ na provizorium (3+ vendors)
  - [ ] Vendor pricing pro odvozy zemina/asfalt
  - [ ] Kadastr + souhlasy
  - [ ] User manual (expert benchmark) if available
- [ ] **Phase D — Reconciliation** (Pattern 3)
  - [ ] 3-source matrix
  - [ ] System gaps documented as backlog
- [ ] **Phase D — Master soupis** (Patterns 1, 2, 5, 6)
  - [ ] Per-SO chunking (don't try monolithic)
  - [ ] TSKP hierarchical structure 0-9
  - [ ] Audit trail per položku
  - [ ] No-work-duplication validation
  - [ ] Anchor pattern для cross-SO references
- [ ] **NOT Phase E** (per ADR-005)
  - [ ] Engineering drawings = projektant scope
  - [ ] Optional sketch capability for sanity check only
- [ ] **TZ pro DUR** — narrative document, KB-cited
- [ ] **Status tender_ready** — manual user actions remaining

---

## References

- Žihle 2062-1 pilot completion: commits 213a061d (master soupis), 218f03a2 (TZ + status), b5002206 (defensive programming)
- Architectural decisions: `docs/architecture/decisions/ADR-001` through `ADR-006`
- Backlog tickety: `backlog/calculator_prompt_extension.md`, `backlog/otskp_search_algorithm.md` + 4 new
- KB enrichment: `concrete-agent/.../knowledge_base/B5_tech_cards/real_world_examples/zihle_2062_1/` (template)
