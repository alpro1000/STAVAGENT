# STAVAGENT Product Patterns

<!--
Pattern numbering audit 2026-06-01 (RD Jáchymov skladby + sokl reconcile pass):
Sequential 1..45 validated (no duplicates, no gaps).
last_number: 45
next_pattern: 46  ← use this for any new additions.

Added 2026-06-01 (Výměry-First task): Pattern 45 (Výměry-First — measurement
register before the work list; every qty references a výměra). "Full Decomposition"
verified = existing Pattern 41 (NOT duplicated); Pattern 41 enriched with the
qty-traces-to-výměra + universal-unit corollary.
last_audit: 2026-06-01

Added 2026-06-01 (RD Jáchymov skladby/sokl session): Pattern 42 (Renovation
skladba = two work groups: STÁVAJÍCÍ→bourání + NÁVRH→konstrukční, never merge),
Pattern 43 (PD cross-source contradiction → reconcile, don't duplicate; the
double-count is the tell), Pattern 44 (Geometry-bounded estimate vs strict null).
The radon wrong-document citation (source said 'TZ statika §5.5'; radon was in
'Souhrnná TZ B.3.9') is a live instance of Pattern 29, not a new pattern.

Added 2026-06-01 (RD Jáchymov krov leaf-binding, PRs #1264 + #1265):
Pattern 41 (Montáž / materiál split — one work item → 1 labor leaf + N
material leaves; family 6-digit code resolves labor only; judgment
quantities flagged OVĚŘIT + exclusion list).

Added 2026-05-29 (RD Jáchymov terasa 762 miss): Pattern 39 (Vision-first
reading for drawings) + Pattern 40 (Host-delegated vision + MCP validation
gate). Pattern 9 enriched (re-read before DECIDING, not just generating;
periodic re-grounding). Pattern 29 enriched (citation present ≠ VERIFIED).

Expansion 2026-05-26: 20 new patterns 17..36 added from RD Jáchymov pilot
CEV session. Patterns 12 + 15 enriched (workflow + freeze-gate detail).
Pattern 37 added same day from parallel-session-sync incident (task spec
asked for "Pattern 17" against a stale memory of last_number=16; header
showed 36; reconciled by promoting to 37 per Pattern 37 itself — see its
Origin context).
Pilot-local case studies remain at
concrete-agent/packages/core-backend/app/knowledge_base/B5_tech_cards/
  real_world_examples/<pilot>/patterns_validated.md (separate namespace).

PROCESS (before adding a new pattern):
  1. Read this header — note current last_number.
  2. grep -nE '^## Pattern [0-9]+:' docs/STAVAGENT_PATTERNS.md  (last 5 lines)
  3. Confirm next_pattern == max(existing) + 1.
  4. Bump last_number + next_pattern in this header in the same commit.
Never assign a pattern number from chat / memory / "I think it's N". See
"Anti-pattern: Pattern number guessing" near the end of this file.
-->

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

## Pattern 9: Re-read TZ Before Generating New Položky

**Source:** HK212 hala (2026-05-22) — Kingspan opláštění P0 blocker resolution

### Problem
Při generování nových položek (kapitola chybí, P0 blocker) → tendence okamžitě sestavit položky
z paměti nebo z generic placeholders (audit doc says "~1500 Kč/m²", "TBD", "PSV-OPL-001..008").
Výsledek: positions s vague popisy, wrong confidence (0.50), missing TZ spec details.

### Solution
**VŽDY** před generováním nových položek:
1. Přečti TZ (nebo aktuální výseky TZ) pro danou kapitolu
2. Extrahuj konkrétní specifikace (tloušťka, materiál, RAL, norma, rozměry, kotvení)
3. Teprve pak piš položky s `confidence: 0.90` a `source: "TZ_ARS_DPZ"`

### HK212 Example
**Wrong (generic placeholder from audit doc):**
```json
{
  "id": "PSV-OPL-001",
  "popis": "Dodávka Kingspan K-roc střešní sendvičový panel tl. 150 mm, RAL šedá",
  "confidence": 0.50,
  "source": "audit_doc_placeholder"
}
```

**Right (TZ ARS DPZ read first):**
```json
{
  "id": "PSV-OPL-001",
  "popis": "Dodávka Kingspan KS1000 AWP obvodový sendvičový panel tl. 200 mm (alt. 150 mm), výplň MW (minerální vata), EW 15 DP1, RAL bílá + modrá — dle TZ ARS DPZ D.1.1",
  "confidence": 0.90,
  "source": "TZ_ARS_DPZ + Step3 areas + Step2 Lindab/MEARIN dossiers",
  "_price_source": "user_skipped_pricing"
}
```

### TZ details captured in HK212 (missed without re-read)
- Panel thickness: **200 mm** (not generic 150 mm) — alternativa 150 mm explicitly noted
- Fill: **MW = minerální vata** (not IPN/PIR — ABMV_13 confirmed K-roc = MW)
- Colour: **bílá + modrá** (not generic RAL šedá)
- Fire: **EW 15 DP1** (not DP3 — PBŘ wins over TZ B per ABMV_6)
- Fastening: **samořezné šrouby + EPDM těsnicí podložka**
- Roof thickness: explicitly **_review_thickness: true** (TZ ARS neuvádí)

### Invariant
- `confidence: 0.90` vyžaduje přímý TZ link v `source` nebo `audit_trail.reference`
- `_price_source: "user_skipped_pricing"` flag když investor řekl "ceny neřeš"
- Všechny geometrické qty vychází z Step 3 area metrics (ne z TZ textových "cca X m²")

### Related
- HK212 hala: `outputs/phase_1_etap1/items_hk212_etap1.json` PSV-OPL-001..008
- ABMV_13: KS FR/FF K-roc vs IPN → MW confirmed (never use IPN/PIR for HK212)
- `scripts/phase_1_etap1/stage_e_add_opl.py` — reference implementation

### Enrichment 2026-05-29 (terasa 762 miss — re-read before DECIDING, not just generating)
Pattern 9's "re-read TZ before **generating**" extends to re-read the source before any **fact decision** — mutating, reconciling, or **discarding** a code / composition / qty. Memory is not a source. Two triggers:
- **Event trigger** — before any decision that changes a fact (discard / overwrite / reclassify), re-verify the source document (vision for drawings, Pattern 39). Never decide from memory or a prior step's summary.
- **Cadence trigger (periodic re-grounding)** — during long generation/audit runs, re-read the source every N items / each skladba rather than trusting accumulated working memory.

**Anti-pattern:** deciding to discard/overwrite a fact because "I remember the source said X". The terasa reconciliation discarded the 762 wood layer from memory ("frozen popis said dlaždice na terče") without re-opening ŘEZ C-C — a vision re-read would have shown the wood. (Origin: RD Jáchymov terasa 762 discard.)

---

## Pattern 10: Vendor Datasheet ≠ Project Specification

**Source:** HK212 hala (2026-05-24) — Kingspan KS NF datasheet "izolační jádro: IPN" vs project MW spec

### Symptom
Vendor generic product family datasheet (e.g. Kingspan KS NF) describes default variant
(e.g. IPN core), which conflicts with project documentation specifying a custom variant
(e.g. MW core). Naïve reading triggers a new ABMV escalation.

### Anti-pattern
Escalate to new ABMV without first checking:
1. Previous session ABMV closures for same topic
2. Project-specific TZ documentation (architectural + structural + požární)
3. Vendor capability for custom variants

### Correct pattern
Vendor datasheet = product family description, NOT project specification. Project TZ
(3 design disciplines consistent) wins over vendor template.

### HK212 example
ABMV_13 closed (`closed_fabricated`) — MW won over IPN claim. Later session uploaded
KS NF datasheet showing "izolační jádro: IPN" — vendor template ≠ HK212 custom MW variant.
**No new ABMV created.** Project spec verified across:
- TZ ARS D.1.1 p4: "Plášť... Kingspan tl. 200 mm s výplní z minerální vaty"
- PBR §3: "sendvičové desky (Kingspan)" — no PUR/IPN/PIR mentions
- TZ statika D.1.2: "KS FF-ROC" + "KS NF" (both available with MW variants from Kingspan ČR Hradec Králové)

### Rule
Before escalating vendor-vs-project conflict, run:
```bash
grep -i "ABMV_.*kingspan\|ABMV_.*panel\|ABMV_.*opláštění" outputs/abmv_email_queue.json
```
for prior closures. If `closed_fabricated` exists with project-spec winner, vendor
datasheet is informational only — populate audit_trail reference but skip ABMV.

### Related
- ABMV_13 (HK212): K-roc MW vs IPN closed_fabricated 2026-05-13
- Pattern 9: Re-read TZ before generating new položky (TZ wins over vendor templates)

---

## Pattern 11: Catalog FTS5 Matching with MJ Equivalence Classes

**Source:** HK212 hala soupis_praci pipeline (2026-05-24) — KROS catalog matching plateau at 44.5 % → 61.7 % Tier 1.

### Problem
Direct fuzzy text match (TF-IDF / Levenshtein) of construction položek against KROS/URS catalog plateaus at ~45 % usable matches because:
1. **Czech text** is hard for naïve fuzzy (diacritics, declensions, slovesné tvary, abbreviations)
2. **Strict MJ matching** ignores semantic equivalence — `kg` vs `t` are same physical concept just scaled 1000×; `bm` vs `m` are both length

### Solution
1. **SQLite FTS5 index** on normalized popis column (already in `kros_catalog.db` as `kros_fts` table). Better than TF-IDF for Czech morphology. Use `bm25()` rank.
2. **MJ equivalence classes** instead of strict equality:
   ```python
   MJ_EQUIV_CLASS = {
       "kg": "mass", "t": "mass",
       "m": "length", "bm": "length",
       "m2": "area", "m3": "volume",
       "kus": "count", "ks": "count",
       "mesic": "time", "soubor": "lump",
   }
   ```
3. **Two-pass candidate selection** — prefer MJ-matching candidates even if not #1 by raw FTS rank, fall back to overall best only if no MJ match exists.
4. **Tiered confidence**:
   - exact code match → 0.95
   - FTS bm25 < −8 + MJ match + třída match → 0.85
   - MJ match + medium FTS → 0.75
   - weak FTS + MJ → 0.70
   - below threshold → Tier 2 (custom položka with nearest-KROS reference)

### HK212 results
- Iteration 1 (strict MJ): 44.5 % Tier 1 — below 60 % target ❌
- Iteration 2 (MJ-first selection): 57.0 %
- Iteration 3 (+ MJ equivalence classes): **61.7 %** ✅

### Invariant
Tier 1 threshold ≥ 0.70 confidence. Tier 2 = custom položka `{PROJECT}-{KAPITOLA}-{seq}` with `_reference_kros_code: <nearest>` for tender reviewer context.

### Related
- HK212: `test-data/hk212_hala/scripts/soupis_praci/phase_b_kros_match.py` — reference implementation
- `test-data/kros_catalog.db` — 9,173 items + FTS5 index ready

---

## Pattern 12: Squash Merge Orphans Source Branch Ref

**Source:** HK212 soupis_praci_final merge (PR #1208, 2026-05-24).

### Problem
After GitHub squash-merge, source branch shows "ahead of main by N commits" with persistent "Compare & pull request" banner — because individual commit SHAs from squashed branch are NOT present in `main` history. Looks like ghost-PR pending.

### Anti-pattern
- Re-opening another PR thinking work is missing
- Force-pushing the source branch to "fix" the ahead count
- Merging a second time

### Correct pattern
**After every successful squash-merge:**
1. Verify content is in main: `git diff origin/main origin/<branch> --stat` — branch should be **behind main** (because squash applied changes, main has additional commits since).
2. Delete the source branch on remote: GitHub UI → Branches → 🗑.
3. Local cleanup: `git branch -D <branch>` after confirming squash commit on main contains the work.

### HK212 evidence
- Branch `claude/hk212-dilenska-ok-ut-dps-integration` (16 commits) was rolled into `claude/hk212-soupis-praci-final` (superset, 20 commits)
- PR #1208 squash-merged soupis-praci-final → main as single commit `9493cdd7`
- dilenska branch retained ghost-banner until manual delete

### Rule
Branch is safe to delete when:
- `git diff origin/main origin/<branch>` shows source has only stale `next-session.md` or similar carry-forward files
- No new commits since the squash-merged tip
- PR shows status `Merged`

### Branch-lifecycle workflow (added 2026-05-26, RD Jáchymov enrichment, was Pattern S)

The ghost-banner symptom is the surface effect; the root cause is **squash-merge being enabled at the repo level + opening PRs before work is done**. Treat both:

**Repo configuration (one-time):**
```
GitHub repo → Settings → General → Pull Requests:
  ☐ Allow squash merging   (UNCHECK — critical)
  ☑ Allow merge commits    (keep checked)
  ☐ Allow rebase merging   (optional)

Default merge strategy: Merge commit
```

**Branch lifecycle:**
1. Open PR only when work is truly done (not mid-iteration).
2. Branch can live days/weeks. Long-running branches are fine if no parallel work touches the same files.
3. Merge via "Create a merge commit" (NOT squash) — preserves linear history + every commit SHA stays addressable from main.
4. Delete branch only after acknowledged delivery / shipment confirmation.

**Recurring cycle anti-pattern (RD Jáchymov evidence):**
Pilot encountered 4× false merge conflicts mid-work because a prior PR had been squash-merged from a snapshot of the same branch, then subsequent commits to the branch produced identical-content collisions on rebase. Each took 10-15 min agent time to resolve. Root cause: squash-merge enabled + PRs opened too early. Disabling squash at repo level + opening PRs only at delivery time fixed the recurring cycle.

---

## Pattern 13: Synthetic Acceptance Metrics Mask Correctness

**Source:** HK212 soupis_praci retrospective (2026-05-24, post PR #1208).

### Problem
Auto-match pipeline hit its synthetic acceptance gate (61.7 % Tier 1 above 60 % target) and was declared "tender-ready" — but a fresh-eyes read of the shipped XLSX found systematic false positives at Tier 1 confidence 0.85:
- `763158122` "Podlaha ze **sádrokartonových desek**" mapped to PSV-77x industrial floor (objekt has epoxy stěrka, no SDK floor exists)
- `127401401` "Hloubení rýh **pod vodou** pro nábřežní zdi" mapped to plain trench excavation (no water, no waterfront walls)
- `985121101` "Tryskání **degradovaného** betonu" (historical reconstruction code) mapped to surface prep on new hala
- `155132111` "Protierozní **geobuňky na svazích**" (roadwork) mapped to Kingspan cladding line
- `711331383` "Izolace **mostovek**" (bridge deck waterproofing) mapped to sokl HI
- `342191211` "Opláštění z **polyesterované fólie**" mapped to Kingspan PUR/PIR sandwich
- `311311971` "**Nadzákladové zdi** do ztraceného bednění C 8/10" mapped to floor slab 106 m³ (4× in same kapitola with different mnozstvi)

Each was matched on a single shared keyword (`podlaha`, `hloubení`, `beton`, `geo`, `izolace`, `opláštění`, `základ`) without validating that the KROS chapter (763 SDK ≠ 776 industrial floors; 127 water-trench ≠ 132 dry trench; 985 reno ≠ new build; 155 road slopes ≠ wall cladding; 711 bridge ≠ sokl; 342 foil ≠ 315 sandwich; 311 wall ≠ 313 slab) was even applicable.

### Anti-pattern
- Threshold-only acceptance: "X % at Tier 1 ≥ N" treats Tier 1 as ground truth.
- No sampling QA gate: nobody read N representative rows per kapitola before stamping "tender-ready".
- Trusting that the matcher's `confidence` field reflects domain correctness when matcher itself has no chapter / material / structural context filter.
- Iterating on the metric (44.5 % → 57 % → 61.7 %) without iterating on **what counts as a correct match**.

### Correct pattern
1. **Domain QA gate runs in parallel to synthetic threshold gate.** Sample ≥ N rows per kapitola (N = 3–5 for small kapitol, 5–10 for large), human spot-check chapter + material + structural fit. Tier 1 badge is allowed only when BOTH gates pass.
2. **Matcher itself filters by chapter context** before keyword scoring: negative-context skip (like CORE `_safe_search()` skipping stávající / demolice), positive-context whitelist (only allow KROS codes in the parent chapter buckets compatible with the target chapter).
3. **Sanity sentinels in QA set** — handful of obvious wrong codes (mostovky for non-bridge, sádrokarton for industrial, nábřežní zdi for non-water) that the matcher MUST NOT return at Tier 1 confidence. Pipeline fails if any sentinel comes back ≥ 0.70.
4. **Hard rule on duplicates** — same KROS code repeated in same kapitola with different mnozstvi is a flag, not a feature; needs explanation field or explicit allow-list (e.g. "patky × 2 stage" with separation rationale per Pattern 6).

### HK212 evidence
- 61.7 % Tier 1 acceptance hit — pipeline declared YELLOW (bid-stage usable), shipped to handoff
- Fresh-eyes audit (next session, same XLSX) found ≥ 7 systematic false positives at Tier 1 0.85
- soupis_praci/ retired, replaced by sequential_list/ — flat ordered list, no codes, manual fill
- Root cause flagged for matcher fix: chapter-context filter missing in `pricing/otskp_engine.py` + Monolit-Planner classifier

### Rule
A synthetic acceptance gate is a **necessary but not sufficient** condition for "tender-ready". Pair every threshold gate with:
- Human domain sampling (N rows per kapitola)
- Sanity sentinels (known-wrong codes that must not score Tier 1)
- Duplicate-detection gate (same code repeated in same kapitola → flag)

Without all three, the matcher's `confidence` field is uncalibrated and "Tier 1 X %" measures nothing.

### Generalization
Applies to ANY auto-match / auto-classify pipeline in STAVAGENT (KROS, URS, element classifier, exposure-class extractor, calculator-suggestions): a metric over its own confidence field is self-referential. The validation must come from outside the system (human spot-check, sanity sentinels, cross-source triangulation per Pattern 3).

---

## Pattern 14: Forward-Tracked `_analytical_journey` on Item Mutations

**Source:** HK212 Úprava dveří revision (PR #1213, 2026-05-22). Reinforced by SO-202 mostovka thickness rework (v4.27) and RD Jáchymov Phase 1 IGP recompute.

### Problem
When projektant ships a revision (new výkres, ABMV closure, geometry recompute, statika quote update), naive item updates **overwrite** the previous `mnozstvi` / `formula` / `popis`. Reviewer who opens the new soupis sees only the final number — has no way to verify:
- Where the previous value came from
- What evidence triggered the change
- Whether the change is consistent with prior reconciliation (Pattern 3)
- Whether the change reverts a previously-resolved ABMV

Result: each revision creates a fresh "tender-ready" snapshot whose history is invisible. Diff between snapshots requires git archaeology + cross-referencing audit_2026_*.md files. Backward fixes (e.g. F-3 patky over-fix correction) lose their rationale once squashed.

### Anti-pattern
- Naked `it["mnozstvi"] = new_value` without preserving the old value
- `audit_trail.formula = new_formula` replacing the old formula string
- Treating `items.json` as a snapshot, not a log
- Recomputing from raw inputs each time, losing the chain of reasoning that produced intermediate values
- Adding a one-off `audit_2026_MM_DD.md` per revision (drifts, gets forgotten, doesn't co-locate with the item)

### Correct pattern

1. **Per-item: append-only `_analytical_journey` array inside `audit_trail`.**
   ```jsonc
   "audit_trail": {
     "formula": "<current formula>",
     "computed_quantity": 510.81,
     "declared_quantity": 510.81,
     // ...
     "_analytical_journey": [
       {"date": "2026-05-14", "value": 536.4, "method": "Phase 1 placeholder", "status": "superseded"},
       {"date": "2026-05-22", "previous": {"mnozstvi": 528.5, "formula": "623.3 brutto − 94.82 m² otvory = 528.5", "popis": "KS NF 200 mm"},
                              "reason": "Úprava dveří revision — KS NF 200 → NF 120 + new FR 150 zone",
                              "source": "Úprava dveří drawings + user manual measurement"}
     ]
   }
   ```
   Each mutation pushes one entry. The current values live at the top level of `audit_trail`; the array is the immutable log of what came before.

2. **Per-file: `metadata.revisions[]` block** for cross-item forward audit.
   ```jsonc
   "metadata": {
     "revisions": [
       {"date": "2026-05-22", "source": "Hala HK_Úprava dveří drawings",
        "summary": "Window count 21→34, Kingspan wall NF200→NF120 + new FR150, …",
        "items_modified": ["PSV-76x-001", "PSV-76x-002", "PSV-OPL-001", "..."],
        "items_added":    ["PSV-76x-013", "PSV-OPL-009", "PSV-OPL-010", "..."],
        "items_removed":  []}
     ]
   }
   ```
   Lets a reviewer diff the file at the revision level without walking every item.

3. **Add new `reference` entry** when source changes — don't overwrite. Old refs stay (drawing A101 measurement was real once; Úprava dveří is the new authority but A101 history matters for traceability).

4. **Confidence may rise or fall** per revision. Update both `it["confidence"]` and `audit_trail["confidence"]` to the new value; the journey preserves the prior.

5. **Items added in a revision** get a `_analytical_journey: [{"status": "current", "method": "<revision> — first appearance"}]` initial entry so the timeline always starts somewhere.

### HK212 evidence — PSV-OPL-001 four-step journey

| # | Date | Value | Source | Status |
|---|---|---|---|---|
| 1 | 2026-05-04 | placeholder 536.4 m² | Phase 1 KS1000 AWP guess (Step3 brutto, no openings) | superseded |
| 2 | 2026-05-14 | 528.5 m² | Stage E ABMV_2 closure — vrata 3.5×4.0 per TZ ARS DPZ D.1.1 | superseded |
| 3 | 2026-05-14 | 528.5 m² (popis revised) | TZ statika D.1.2 quote ratified — KS NF 200 mm specs (vendor: Kingspan Hradec Králové) | superseded |
| 4 | 2026-05-22 | **510.81 m²** | Úprava dveří — KS 1000 NF **120 mm** + split off new PSV-OPL-009/010 KS 1000 FR 150 mm 82.25 m² | **current** |

Each step preserves prior. Reviewer opens `items.json` → walks the journey end-to-end → sees full forensic trail without ever leaving the file.

### Rule
**Never overwrite `mnozstvi`, `formula`, or `popis` without pushing the prior state onto `audit_trail._analytical_journey`. Never modify `audit_trail.reference[]` destructively — append.** Backward fixes (F-3 patky 14→10 correction, F-1 vrata stale dimension closure, ABMV_18 beton class reopen) stay permanently visible. The file is a log, not a snapshot.

### Generalization
Applies to ANY structured project memory in STAVAGENT (`items_*.json`, `master_soupis_*.yaml`, `area_aggregates.json`, `project.json` outputs from Phase B). The discipline is cheap (one array append + one metadata entry) and compounds: at revision N=10, a single `git log` + journey walk reconstructs the complete fact lineage without manual archaeology. Without this, every revision quietly erases the prior, and Pattern 3 triangulation collapses to "current value only."

Combines with:
- **Pattern 2 (Audit trail mandatory)** — `_analytical_journey` is the temporal dimension of audit trail
- **Pattern 3 (Triangulation)** — journey entries can carry alternate-source values from concurrent reconciliation
- **Pattern 13 (Synthetic acceptance metrics)** — confidence transitions in the journey expose when domain QA flipped a Tier-1 to a lower tier

---

## Pattern 15: Work-First, Catalog-Last — Sequential Výkaz Výměr Generation

**Source:** HK212 hala soupis_praci retrospective (2026-05-24/25). Pattern 13 ("Synthetic Acceptance Metrics") documented the failure mode that motivates this discipline.

### Problem
Premature catalog mapping — auto-matching KROS/URS codes during item generation — creates **false positives, duplicates, cross-context contamination** at fake high confidence (cf. Pattern 13 case studies: SDK floor mapped to industrial epoxy, mostovka HI mapped to sokl HI, atd.). The matcher cannot distinguish "right code, wrong context" from "right code, right context" because it has no domain reasoner. Confidence threshold ≥ 0.70 is meaningless when 47 % of Tier 1 matches are domain-wrong.

### Solution — 3-stage workflow

**Stage 1: Work atomization (catalog-blind)**
- Generate flat sequential list of all stavební works in logical construction order (HK212 = Fáze 1-11)
- Each item = **atomic work step** (not consolidated blob — split if multiple operations)
- **Required fields per item:** `id`, `popis`, `mj`, `mnozstvi`
- **Required audit per item** (per Pattern 2 + 14):
  - `_formula` — how mnozstvi was computed
  - `_source` — TZ/výkres reference (e.g. "TZ ARS p3 + A105 měřená geometrie")
  - `_audit_trail.journey` — Pattern 14 forward-tracked log of mutations
- **Optional fields:** `_review_flag`, `_vyjasneni_ref` (ABMV link), `_status_flag`

**Stage 2: Decomposition on demand**
- When item is consolidated and downstream needs granular catalog mapping → split into atomic kroks (`{parent_id}a`, `{parent_id}b`, …)
- Per krok: `parent_item` reference + `split_decision` rationale + ČSN/IGP/TZ source inheritance
- Pattern 14 forward audit trail **mandatory** through the split

**Stage 3: Catalog mapping (separate session, after Stages 1+2)**
- **Manual** code assignment per item — NOT auto-matching
- Domain expert (přípravář) maps to catalog using domain knowledge + targeted catalog search
- Catalogs interchangeable: KROS (CZ private) ↔ ÚRS (CZ public) ↔ OTSKP (CZ transport) ↔ BKI (DE) ↔ FIEBDC-3 (ES) ↔ Batiprix (FR) — see Pattern 16

### Standard XLSX output schema (Stage 1)

| # | Krok | Fáze | Kapitola | ID | Popis | MJ | Mnozstvi | Vzorec / Zdroj | Pozn. (review/ABMV) | (Code) | (Cena) |
|---|---|---|---|---|---|---|---:|---|---|---|---:|

**Code + Cena columns left EMPTY in Stage 1.** Filled only in Stage 3.

### HK212 reference implementation
- `test-data/hk212_hala/scripts/build_sequential_list.py` — Stage 1 generator
- `test-data/hk212_hala/scripts/split_hsv1_028.py` — Stage 2 atomization (HSV-1-028 → 028a–f, 6 kroks)
- `test-data/hk212_hala/outputs/sequential_list/` — XLSX + CSV + JSON output (~138 items po splittingu)
- 11 Fází (Příprava → Zemní práce → Základy → OK → Opláštění → Výplně → Klempířina → Podlahy → Vnitřní → Dokončovací → VRN)
- Pattern 14 forward audit trail per item through all stages

### Rule
**Never run auto-catalog-matcher on freshly generated items.** Always 3-stage workflow with manual catalog phase **last**. Tools that auto-match against KROS/URS are debugging aids, not authoring tools — their output is a suggestion, not a soupis.

### International rationale
Work atomization is **universal** (digging holes, pouring concrete, welding steel = same physical operation in CZ/DE/ES/FR). Catalogs are **local** (KROS/BKI/FIEBDC differ in code structure, naming granularity, pricing convention). Separating work generation from catalog mapping = the same work ontology powers all markets. See Pattern 16 for the adapter architecture.

### Related
- Pattern 2 (Audit trail mandatory) — fields per item
- Pattern 13 (Synthetic metrics) — failure mode this pattern prevents
- Pattern 14 (Forward-tracked _analytical_journey) — mandatory through Stages 1→2→3
- Pattern 16 (Universal Work Ontology) — downstream consequence for multi-market expansion
- Pattern 31 (CEV) — extends Stage 1+2 with 5-layer/4-matrix verification before Stage 3
- Pattern 32 (Two-file delivery) — File A audit (Stage 1+2 output) separate from File B production (Stage 3 output)

### CEV pre-match consolidation gate (added 2026-05-26, RD Jáchymov enrichment, was Pattern M)

HK212 established the 3-stage discipline. RD Jáchymov pilot extended it with **strict 6-phase sequencing + explicit STOP gates** because the 3-stage version still permitted catalog-matching to start before extraction was verified complete:

```
Phase 1: EXTRACT         — all documents (TZ + DXF + Excel + Word + MD + external)
Phase 2: CROSS-REFERENCE — matrices verify completeness
                           (Matrix A: source → items, B: entities → items,
                            C: items → sources, D: cross-doc consistency)
Phase 3: CONSOLIDATE     — finalize items list, FREEZE (single source of truth)
Phase 4: VALIDATE LIST   — File A audit deliverable with provenance (NO codes yet)
                           ▸ STOP GATE — explicit human confirmation required
Phase 5: MATCH CATALOG   — catalog matching against FROZEN list (per-market adapter)
Phase 6: PRODUCTION      — File B production deliverable with codes filled
```

Phase 5 cannot start until Phase 4 STOP gate confirms list FROZEN. Phase 6 cannot start until Phase 5 done. **No File B until File A complete.** Frozen-snapshot artefact (`items_consolidated_FROZEN_<date>.json` read-only copy) makes the freeze explicit.

**Why the extra phases:** RD Jáchymov first attempt jumped from Phase 1 to Phase 5 after Audit v2 passed, then CEV (Phase 2 matrices) caught 3 GAPs + 1 ENRICHMENT that would have shipped silently. Cost of CEV ~3-4 hours vs cost of re-deliver to Karel: not comparable.

**Two-file principle (now formalised — Pattern 32 enrichment of HK212 base):**
- **File A** — audit / worksheet: provenance per item (source, formula, data_quality, confidence, vyjasneni_ref). Multi-sheet (aggregated, detailed, per-podlaží, per-skladba, cross-verification). For investor + projektanti + internal QA.
- **File B** — production: clean catalog format (code | popis | MJ | qty | unit_price | total | flag). Single sheet per import system requirements. For execution partner direct import.

Both reference same items.json source-of-truth. Different rendering layers, different audiences.

---

## Pattern 16: Universal Work Ontology — Catalog-Agnostic Item Generation

**Source:** HK212 international expansion architectural decision (2026-05-25). Direct consequence of Pattern 15.

### Insight
Construction work itself is universal across European markets. Steel column installation, concrete pouring, Kingspan panel mounting = same physical operations whether in Czechia, Germany, Spain or France. **What differs is local catalog codes + pricing conventions + tender formats**, not the work.

### Universal work × local catalog matrix

| Concept | CZ | DE | ES | FR |
|---|---|---|---|---|
| Construction work ontology | universal | universal | universal | universal |
| Catalog format | KROS / ÚRS / OTSKP | BKI / Sirados | FIEBDC-3 / Código Estructural | Batiprix |
| Norms reference | ČSN EN | DIN EN | UNE-EN | NF EN |
| Pricing convention | Kč/m³ | €/m³ | €/m³ | €/m³ |
| Tender format | ZZVZ | VOB/B | LCSP | CCAG |

Materials and profiles already Eurocode-unified across markets:
- Concrete classes: C16/20 = C16/20 = C16/20 = C16/20
- Steel profiles: IPE 400 = IPE 400 = IPE 400 = IPE 400
- Sandwich panels: KS NF 200 mm = same product family EU-wide (vendor catalog with national pricing)

### Architectural decision
STAVAGENT item generation engine produces **catalog-agnostic items** (work + mnozstvi + formula + source). Catalog binding = separate **adapter layer per market**.

```
items.json (work ontology, universal)
    │
    ├─→ czech_kros_adapter.py     → KROS code
    ├─→ czech_urs_adapter.py      → ÚRS code
    ├─→ czech_otskp_adapter.py    → OTSKP code (transport)
    ├─→ german_bki_adapter.py     → BKI position
    ├─→ spanish_fiebdc_adapter.py → FIEBDC-3 code
    └─→ french_batiprix_adapter.py→ Batiprix code
```

Single work definition → N catalog mappings → N markets covered.

### Concrete example

**Work ontology entity:**
```json
{
  "id": "HSV-2-001",
  "popis": "Beton patek rámových dvoustupňové C16/20 XC0",
  "mj": "m³",
  "mnozstvi": 22.875,
  "_formula": "10 × (1.5²×0.6 + 1.25²×0.6)",
  "_source": "A105 + statika TZ D.1.2 p30"
}
```

**N market mappings:**
| Adapter | Code | Catalog popis |
|---|---|---|
| CZ KROS | 273313811 | Beton základových patek prostý C16/20 |
| DE BKI | 031.001 | Streifenfundamente Beton C16/20 |
| ES FIEBDC | E04CA010 | Hormigón armado en zapatas |
| FR Batiprix | 01.02.01 | Béton fondations isolées |

Same work definition. Single source of truth = work ontology, not catalog code.

### Domain knowledge transfer rule
Přípravář workflow learned in CZ market (HK212) directly applicable to DE/ES/FR after adapter layer translation. **Work generation phase = identical. Catalog phase = market-specific.** This is the core of STAVAGENT's international expansion strategy.

### Implementation roadmap
- ✅ **CZ work ontology established** — HK212 (138 items proof + sequential_list output)
- ⏳ **Universal work_ontology JSON schema** — extract canonical schema from current items.json (separate task)
- ⏳ **KROS adapter** — formal layer replacing ad-hoc Pattern 11 matching (Stage 3 of Pattern 15)
- 🔮 **BKI adapter** — German market entry
- 🔮 **FIEBDC adapter** — Spanish market entry
- 🔮 **Batiprix adapter** — French market entry

### Related
- Pattern 15 (Work-First, Catalog-Last) — upstream dependency; this pattern is the international corollary of the same discipline
- Pattern 11 (KROS FTS matching) — current ad-hoc CZ implementation, to be wrapped as formal `czech_kros_adapter.py`
- Pattern 13 (Synthetic metrics) — reinforces why adapter layer must be manual / human-reviewed, not auto-matched

---

## Pattern 17: Phase 0a Completeness Audit (mandatory pre-extraction gate)

**Source:** RD Jáchymov pilot (2026-05-18). Pilot-local case study at `concrete-agent/.../rd_jachymov/patterns/08_completeness_audit_mandatory.md`.

### Problem
Agent's default extraction behavior leans toward subset — extract what's obvious / asked, skip what isn't. For DPS-grade output (item-level rozpočet), mandatory completeness audit must inventory ALL data sources BEFORE selective extraction. Without it, generator works on a subset → silent drifts → items.json ships incomplete.

### Algorithm
**Layer 1 — PDF inventory:** enumerate ALL PDFs (`tz/` + `dokladova_cast/` + `vykresy_pdf/` + `situace/`), per PDF detect content type (text / drawing / scanned), extract text or flag for OCR.

**Layer 2 — DXF exhaustive layer probe:** enumerate ALL layers per DXF (NE subset), per layer record `entity_count + entity_types + sample_data + probe_status` (probed_extracted / probed_metadata_only / probed_empty / unprobed). Gate doesn't open until 0 `unprobed_actionable` layers.

**Layer 3 — Cross-document reference detection:** for each unique marker (S-codes, F-codes, materials), search across all docs, link legenda + uses.

### Acceptance gate
Phase 1 work BLOCKED until completeness audit shows:
- 0 PDFs without text-probe (or OCR-attempt logged)
- 0 DXF layers with `unprobed_actionable` status
- All cross-document markers have legenda + uses both found

### Anti-pattern
Starting Phase 1 generation without completeness audit done = guaranteed silent drift. "Completeness ≠ correctness" — 100 % correct extraction across 7 % source coverage still ships 93 % blind spots.

### Origin context
RD Jáchymov first pass probed 11 of 156 DXF layers (7 %), shipped 6 silent drifts (ETICS 200 → 160 mm, PIR 180 → 160 mm, klempířina 4-way DXF split, obklady per-koupelna výška, per-podlaží světlé výšky, špalety perimeter) — all user-caught. Cure: 156/156 layers probed via Path C 5-tier exhaustive sweep.

### Reusable code
- `tools/phase0a_completeness_audit.py` (~700 LOC reference)
- `tools/path_c_part1_ocr.py` + `path_c_tier{1,2,3,4_5}_*.py`

### Related
- Pattern 18 (Iterative deepening) — what catches the gap when Pattern 17 hasn't fired yet
- Pattern 22 (PDF noise filters) — needed in conjunction during text-probe step
- Pattern 31 (CEV) — follow-up verification across all source layers post-Phase-0a
- Pilot-local `rd_jachymov/patterns/08_completeness_audit_mandatory.md` (CRITICAL)
- Pilot-local `rd_jachymov/patterns/09_iterative_layer_probe_user_caught_gaps.md` (ANTI-PATTERN preserved as negative example)

---

## Pattern 18: Iterative deepening with human-as-QA-gate

**Source:** RD Jáchymov pilot (multi-session 2026-05-18 → 2026-05-26).

### Problem
Agentic execution optimizes for task completion, not exhaustive verification. Default behavior: stop when "task done" per asked spec. Without human stress-testing, gaps persist that the agent's own self-checks systematically miss.

### Algorithm
1. Agent completes task per spec.
2. Agent returns "done" signal.
3. **Human role (structural, NOT optional): stress-test specific aspects** — "but what about X?", "did you check Y?", "iterate on Z".
4. Agent finds previously-missed details → applies fix.
5. Repeat until 2 consecutive iterations find < 3 minor gaps (see Pattern 19).

### Acceptance
Pilot considered complete only when consecutive iterations converge to zero material gaps.

### Anti-pattern
Trust agent's "done" signal blindly. Single-pass deliverables consistently miss 5-15 % of scope.

### Origin context
RD Jáchymov pilot caught **6 categories of silent drifts** only iteratively after user prompting: file-swap (Rdt fingerprint), encoding (mojibake), S-codes (sklad namespace), missed layers (89 % unprobed), fabricated terms (Pattern 30 stems), per-drawing POZN refs (CEV Pattern 23). None would have surfaced from agent self-review.

### Why this matters
Stress-tester role is **structural**, not optional. Replaces traditional engineering review boards / multi-step approvals at the prototype-pilot stage. Conversational iteration is the QA mechanism.

### Related
- Pattern 17 (Phase 0a) — what to audit instead of relying on iteration
- Pattern 19 (Diminishing returns gate) — when to stop iterating
- Pilot-local `rd_jachymov/patterns/09_iterative_layer_probe_user_caught_gaps.md`

---

## Pattern 19: Diminishing returns gate

**Source:** RD Jáchymov pilot (2026-05-26 — closing-out the CEV iteration).

### Problem
Iterative audits eventually hit zero gaps. Past that point, additional passes find stylistic issues (terminology refinement, formatting) not material issues (missing scope, wrong qty). Without explicit stop signal, iteration continues unnecessarily — erodes confidence in already-complete deliverables and consumes session budget.

### Algorithm
1. After each audit pass, count actionable issues found.
2. If 2 consecutive passes find < 3 minor issues → STOP signal triggered.
3. Recognize transition: **material findings → stylistic findings**.
4. Ship and rest.

### Acceptance
Pilot delivery proceeds when diminishing returns gate triggers.

### Anti-pattern
Endless iteration past zero gaps wastes time and erodes confidence in already-complete deliverables.

### Origin context
RD Jáchymov pilot — Audit v2 found 8 actionable gaps → all fixed → Quality pass found 0 actionable → CEV per-drawing audit found 3 GAPs + 1 ENRICHMENT → Phase 3.5-3.7 verified canonical baseline. Stop signal triggered after the consolidate phase.

### Related
- Pattern 18 (Iterative deepening) — upstream loop this pattern terminates
- Pattern 31 (CEV) — typically the last substantive audit before this gate fires

---

## Pattern 20: Audit v2 — 10-section completeness methodology

**Source:** RD Jáchymov pilot (2026-05-19 — Audit v2 methodology codification).

### Problem
Phase 0a (Pattern 17) verifies that sources are probed. Need an orthogonal audit that verifies **works are present** in items.json. Simple TKP / subdodavatel coverage is insufficient — catches < 25 % of real gaps.

### Algorithm — 10 sections per pilot

| Section | Check |
|---|---|
| **A** | TKP family coverage (0-9, plus VRN) — each family has ≥ 1 item |
| **B** | Subdodavatel trade coverage — each mapped trade has ≥ 1 item |
| **C** | Domain anchor checklist — ~60 typical works per project type, each present |
| **D** | TZ verb-noun regex scan — "provedení X" / "instalace Y" / "montáž Z" → check items coverage |
| **E** | Per-podlaží completeness matrix — N podlaží × M elements per floor (typically 4 × 7 = 28 cells) |
| **F** | Per-room completeness matrix — rooms × attributes (typically 25 × 9 = 225 cells) |
| **G** | Cross-element consistency chains — e.g. windows ↔ parapets ↔ flashings ↔ jambs |
| **H** | Material balance check — Σ floor areas vs total floor area ± 5 %, Σ ETICS layers consistent, etc. |
| **I** | Cost ratio sanity — HSV/PSV/TZB/VRN proportion within typical range (informational, not gate) |
| **J** | TZ deep scan per critical section — ~18 anchors per project type |

### Acceptance
Audit v2 green = 0 critical + 0 important gaps.

### Anti-pattern
Shipping without Audit v2 — sections E-J catch ~80 % of gaps that earlier audits (Pattern 17 source-side + Pattern 21 catalog-side) miss.

### Reusable code
- `tools/completeness_check_v2.py` (~700 LOC reference)
- `tools/quality_audit.py` for the 5-dimension parallel quality pass

### Origin context
RD Jáchymov pilot's Audit v1 (4 sections A-D) caught 2 gaps. Audit v2 (10 sections A-J) caught 8 additional gaps that v1 missed.

### §C implicit-pomocné/VRN sub-class (enrichment 2026-05-29, RD Jáchymov)

The §C "domain anchor checklist" originally listed *visible construction* works (demolice, ŽB, krov, ETICS, sanita…). It MISSED a whole class: **implicit pomocné + VRN works that are rarely stated in TZ but are physically required for realizace.** These slip through every TZ-derived audit because they aren't in the TZ to be found.

Mandatory §C sub-class to check on every pilot:

| Anchor | Práce | Why often missing |
|---|---|---|
| **PM01** | Přesun hmot pro budovu | POVINNÁ in every rozpočet (998xxx); never in TZ — it's a costing convention |
| **PM02** | Lešení (fasádní/prostorové) | Required for any ETICS/fasáda/krov work; TZ describes the result, not the access means |
| **PM03** | Hromosvod / LPS | ČSN EN 62305 risk-driven; PBŘ may omit if not analysed |
| **PM04** | Slaboproud (data/TV/domofon) | TZ covers silnoproud; slaboproud assumed |
| **PM05** | Okapový chodník + obvodová drenáž | Detailing-level, below TZ resolution |
| **PM06** | Terénní + sadové úpravy finální | Often in a separate povolovaná akce / out-of-scope |

**Discipline:** for each, COVERED / GAP / N/A. PM01 + PM02 are near-always real GAPs if absent (add as technical necessities). PM03-PM06 require **TZ/scope verification before adding** (Pattern 9 + Pattern 26) — do NOT fabricate them into the rozpočet; if not in TZ, record as vyjasnění for projektant/investor.

**RD Jáchymov evidence:** Stage 1A anchor audit found all 47 standard construction anchors COVERED (prior CEV/audit was complete w.r.t. TZ) but 6 GAPs — ALL in this implicit class. PM01 přesun hmot + PM02 lešení (503 m², ETICS 276.7 m²) added as technical necessities (212→214); PM03/04/05/06 verified-not-in-TZ → vyjasnění #22-24, not fabricated.

### Related
- Pattern 17 (Phase 0a) — orthogonal source-side audit
- Pattern 18 (Iterative deepening) — Audit v2 results drive iteration
- Pattern 31 (CEV) — orthogonal cross-source consistency layer
- Pattern 33 (Project synthesis) — read after Audit v2 for holistic view
- Pattern 9 + 26 — verify-before-add discipline for PM03-PM06 (NE fabricate work not in TZ)

---

## Pattern 21: Multi-factor catalog candidate selection

**Source:** RD Jáchymov + HK212 catalog-matcher review (2026-05-23 → 2026-05-25).

### Problem
When external catalog matcher (KROS FTS, URS lookup, BKI search) emits 1-N candidates per item with confidence + source, naive "highest confidence wins" fails. Reality requires multi-factor scoring — confidence alone is uncalibrated (Pattern 13).

### Algorithm — composite score per candidate

```
score = 0.30 × raw_confidence
      + 0.25 × source_reliability     (trained matcher ≥ web LLM)
      + 0.20 × unit_match              (exact / compatible / mismatch penalty)
      + 0.15 × popis_jaccard           (token overlap source query vs candidate description)
      + 0.10 × note_hint               (explicit candidate mention in note field)
```

### Decision rules
- `score > 0.7` + clear gap to #2 → `clear_winner`
- top-2 Δ < 0.15 → `close_call_top_2` + flag alternative
- `score < 0.5` → `low_confidence` + flag
- no candidates → `no_candidates` + blank code + flag MANUAL LOOKUP (per Pattern 26)

### Acceptance
Output transparent per-item selection rationale (top-N candidates with computed score, selected highlighted, alternative if close call).

### Anti-pattern
Default candidate_1 always wins. Misses unit mismatches and explicit note hints.

### Origin context
RD Jáchymov pilot found agent's `note` field explicitly mentioned which candidate to use (operator hint) — naive top-by-confidence ignored this signal.

### Related
- Pattern 11 (KROS FTS matching) — upstream candidate generator
- Pattern 13 (Synthetic acceptance metrics) — failure mode this pattern mitigates
- Pattern 26 (Honest fallback hierarchy) — when scoring returns no acceptable winner

---

## Pattern 22: PDF noise filters mandatory in matrix builders

**Source:** RD Jáchymov pilot CEV Matrix A first-pass (2026-05-26). First pass returned 22 false-positive critical GAPs from extraction noise.

### Problem
PDF text extraction (pypdf, pdfplumber) introduces noise that triggers false-positive gaps in matrix verification:
- TOC lines (`1.2.3 Section Name......15`)
- "Nevyskytují se" / "Není relevantní" boilerplate
- Numeric coordinate dumps (causes regex catastrophic backtracking)
- Drawing title block stamps
- DPS-scope meta lines ("Tato dokumentace nenahrazuje realizační dokumentaci")

### Algorithm — pre-filter every TZ paragraph before matrix matching

```python
NOISE_FILTERS = [
    r'^\d+(\.\d+)*\s+\w+.*\.{3,}\d+$',           # TOC line
    r'^[\d\.\,\s]{20,}$',                        # Numeric coordinate dump
    r'(?i)nevyskytují se|není relevantní',       # Boilerplate negations
    r'(?i)tato dokumentace.*neslouží.*realizac', # DPS-scope meta
    r'^stránka\s+\d+\s+z\s+\d+$',                # Page numbering
    r'^\w+\s+architekti\s+s\.r\.o\.',            # Stamp variants
]
```

Numeric-dump detection should use a token-shape counter, NOT a quantified regex like `(?:\d{1,3}[.,]?\d{0,3}\s+){20,}` — that backtracks catastrophically on long coordinate strings.

### Acceptance
Matrix builder rejects noise lines before declaring "GAP detected".

### Anti-pattern
Without filters, every TOC line becomes a "critical gap" — wastes iteration cycles + erodes audit confidence.

### Origin context
Pilot's first Matrix A pass returned 22 false-positive critical GAPs from extraction noise. Final pass with filters returned 0 GAPs.

### Related
- Pattern 17 (Phase 0a) — caller of text-probe step
- Pattern 30 (Czech regex diacritic pitfall) — same regex-discipline class
- Pattern 31 (CEV) — uses Pattern 22 filters in Matrix A/C builders

---

## Pattern 23: Per-drawing extraction (beyond TZ-only)

**Source:** RD Jáchymov pilot CEV per-drawing audit (2026-05-26).

### Problem
Standard project-wide legendy appear at bottom of every drawing sheet (sections + plans + elevations + details). Legenda content is identical (project-wide reference). BUT each drawing sheet has **unique annotations + demolition markings + POZN references AROUND legendy**. Pipeline must iterate per-drawing for unique annotations, NOT just main reference drawing.

### Algorithm
1. Inventory all drawing PDFs per project (typically 10-30 sheets).
2. Per drawing: extract non-legenda annotations (POZN refs, "stávající" vs "návrh" callouts, demolition markings, local dimensions, material labels at element positions).
3. Cross-reference with extracted standard legenda — skip duplicates.
4. Compare unique annotations against items.json + central evidence index.
5. Flag gaps: drawing-specific POZN reference not mapped to any item.

### Reusable code — mojibake decoder for CZ architectural PDFs

Czech architectural PDFs frequently ship with a custom font with broken ToUnicode CMap — pypdf and pdfplumber both yield mojibake. When OCR isn't available, heuristic substitution recovers readable Czech:

```python
MOJIBAKE_CZ = {'ú':'í', 'č':'ý', 'ř':'ě', 'š':'ě', 'Ř':'č'}
# (cid:33) → ů, (cid:34) → š, (cid:35) → ž, (cid:36) → Ž, (cid:37) → ž
```

Use OCR when available (tesseract ces+eng @ 300 DPI via pdftoppm) — only fall back to mojibake heuristic when OCR tooling absent.

### Acceptance
Per-drawing audit completes with explicit "all sheets iterated" + gap list.

### Anti-pattern
Extract primary reference drawing in detail, assume other drawings duplicate. Misses sheet-specific POZN refs + demolition annotations.

### Origin context
RD Jáchymov pilot — primary řez A-A extracted thoroughly. Per-drawing audit later found POZN.1.02 (komín demolition), POZN.1.03 (opěrné zídky bourání), POZN.2.02 (drenáž za bílou vanou) — 3 real GAPs + 1 ENRICHMENT (mykologický + dřevokazný hmyz survey) missed in TZ-only extraction.

### Related
- Pattern 17 (Phase 0a) — Layer 1 PDF inventory must include vykresy_pdf, not just tz/
- Pattern 24 (Multi-namespace S-code/F-code) — drawings are where per-namespace S-code legendy live
- Pattern 31 (CEV) — per-drawing audit is a CEV addendum pass

---

## Pattern 24: Multi-namespace S-code / F-code handling

**Source:** RD Jáchymov pilot Phase 3.5 (2026-05-26 — sklad S-code namespace discovery).

### Problem
Multi-objekt projects (main building + sklad + garage + …) may have **separate skladba namespaces per stavební objekt**. Main building uses S01-S12b, secondary objekt uses its own S01-S05 with completely different layer compositions. Naive global numbering merges incorrectly.

### Algorithm
1. Detect per-SO skladba legendy separately (per Pattern 23 per-drawing audit).
2. Tag items with namespace-qualified reference: `realizuje_skladbu: "S01_dum"` vs `realizuje_skladbu: "S01_sklad"`. (Or use compound key `{objekt}/S0N` if the namespace is implicit in `objekt` field.)
3. Var_E (skladby vrstev sheet) lists per-namespace S-codes separately.
4. Cross-reference per-SO context, never assume global numbering.

### Acceptance
Each skladba-implementing item explicitly references namespace + S-code.

### Anti-pattern
Tag sklad items with dům S-code numbers ("S01 must mean obvodová stěna for everyone"). Mis-attributes layer compositions and silently mislabels which works are part of which skladba.

### Origin context
RD Jáchymov pilot — agent initially tagged only 38 dům items, missed that 27 sklad items have own S01-S05 namespace with different compositions:
- Sklad S01 = podlaha sklad (NOT obvodová stěna 1.NP/2.NP as in dům)
- Sklad S02 = stropní konstrukce (NOT společná stěna)
- Sklad S03a/b = obvodová stěna pod / nad terénem
- Sklad S04 = opěrná stěna (NOT obvodová stěna 3.NP)
- Sklad S05 = schodiště

### Related
- Pattern 23 (Per-drawing extraction) — source of per-namespace legendy
- Pattern 28 (Schema integrity globally-unique IDs) — same lesson, different field

---

## Pattern 25: Web search as catalog verification fallback

**Source:** RD Jáchymov + HK212 catalog matching (2026-05-23 onwards).

### Problem
Production catalog API (URS, KROS, BKI) may be blocked via WebFetch (403 / authentication). Direct catalog lookup fails.

### Workaround
Search engines (Google) index catalog content via public mirrors (government procurement portals, document hosting sites, catalog reseller pages). WebSearch returns snippets + LLM summary which extracts catalog description anchored on code/keyword.

### Algorithm
1. Query format: `<catalog_id> <code_or_family_digit> <key_noun_from_popis>`
2. Parse top 5-10 Google results, focus on known mirror domains
3. Extract catalog description from snippets
4. Compare item popis vs catalog popis: MATCH / WRONG_LEAF / WRONG_WORK_TYPE / UNCLEAR
5. Apply fallback hierarchy strictly per Pattern 26 (verified / wrong leaf alt / family only / blank + flag)

### Cost reality
~ $0.01 per WebSearch (Anthropic API pricing). Budget ~ $0.50-1.00 for 50-80 queries. See Pattern 34 for cost-transparency communication to user.

### Acceptance
Selective use (NE all items), targeting items already flagged uncertain by matcher (family mismatch, wrong_leaf, low confidence, close call per Pattern 21).

### Anti-pattern
Brute-force WebSearch on all items wastes budget. Or skip verification entirely → ship wrong codes (Pattern 13 failure mode).

### Forbidden
Never fabricate catalog code. If nothing found → blank cell + explicit "MANUAL LOOKUP" flag (Pattern 26). Never write "TBD" or fake codes like "999999999".

### Origin context
Pilot URS WebSearch verified 13 codes selectively, found 6 wrong leafs (family OK but leaf 9-digit wrong, ~63 % rate) + 4 correct replacements. Established generator heuristic accuracy: 6-digit family correct ~75 %, 9-digit leaf wrong ~63 %.

### Source priority ladder (enrichment 2026-05-29, RD Jáchymov)

WebSearch is the **fallback**, not the first resort. Explicit priority when verifying/finding a catalog code:

1. **Catalog API / MCP tool** (authoritative) — `find_urs_code` / `find_otskp_code` MCP tools query the real 17 904-code OTSKP + 39 000+-code ÚRS databases. A hit here returns the actual catalog leaf + popis — ground truth.
2. **WebSearch** (snippet inference) — only when the API is blocked/unavailable or returns nothing. Returns chapter-level context (e.g. cs-urs.cz `800-764 Klempířské`) confirming *family*, rarely the specific 9-digit leaf.
3. **Blank + MANUAL LOOKUP flag** (Pattern 26) — when neither yields a defensible code.

**Why the ladder matters:** RD Jáchymov Phase 5B used WebSearch for 60 queries and got mostly FAMILY_VERIFIED (chapter confirmed, leaf not) — because Google snippets of a paywalled catalog can't expose 9-digit leaves. The MCP `find_urs_code` tool, when available, would have returned actual leaves for many of those. Reach for the API tool first; drop to WebSearch only on miss. Never invert the order (WebSearch-first wastes the authoritative source).

### Related
- Pattern 11 (KROS FTS matching) — primary matcher; Pattern 25 is verification layer
- Pattern 21 (Multi-factor selection) — feeds candidates to verify
- Pattern 26 (Honest fallback hierarchy) — what to do with verification results
- Pattern 34 (Cost transparency) — explain $0.50-1.00 budget to user

---

## Pattern 26: Honest fallback hierarchy for missing data

**Source:** RD Jáchymov + HK212 catalog-matching iteration (2026-05-23 → 2026-05-26).

### Problem
When matcher or lookup fails, agent tendency is to fabricate value or use placeholder. Both lie to client.

### Algorithm — 8-level fallback hierarchy

| Case | Action | Visual flag |
|---|---|---|
| Exact match | Use confirmed | ✓ green VERIFIED |
| Better alternative found | Use alt, log original | ⚠ amber "WRONG_LEAF — was X, correct Y" |
| Family found, leaf unknown | Keep family + "???" leaf | ⚠ amber "FAMILY OK — leaf needs lookup" |
| Multiple candidates close | Keep top + flag close call | ? gray "VERIFY — close call, alt: Y" |
| Low confidence (< 0.5) | Keep top + flag | ? gray "REVIEW — low confidence" |
| Nothing found | **Blank cell** | ❌ red "MANUAL LOOKUP — popis only" |
| Not searched (high conf existing) | Use existing | (no flag) |
| Items.json-source-only | Use existing | (gray italic) |

### Forbidden
- Fabricated codes (random numbers, "999999999", "TBD")
- Hidden gaps (item silently dropped from rozpočet because no code found)
- Mismatched family code use (wrong family with note "close enough")

### Acceptance
Karel / client sees every gap explicitly. Blank cell + flag = honest signal. Fake code = lie.

### Anti-pattern
"999999999" placeholder, "TBD" text in code column, item silently dropped because no code found.

### Origin context
RD Jáchymov pilot fixed 9 items where heuristic generated wrong 9-digit leaf (kept 6-digit family + "???" leaf), 122 items left blank with "MANUAL LOOKUP" flag because no candidate found.

### Related
- Pattern 21 (Multi-factor selection) — upstream scoring
- Pattern 25 (Web search verification) — last-chance lookup before falling to MANUAL
- Pilot-local `rd_jachymov/patterns/07_honest_detail_fallback_dsp_scope.md` (DSP-scope variant of the same discipline)

---

## Pattern 27: External LLM cross-validation as Nth source layer

**Source:** RD Jáchymov pilot mid-CEV (2026-05-25 — ChatGPT independent analysis as cross-check).

### Problem
Internal extraction (TZ + DXF + Excel + Word) may have systematic blind spots. Without external cross-check, gaps persist that the agent's own pipeline systematically misses.

### Algorithm
1. Run independent external LLM (different model family — ChatGPT, Gemini, etc.) on same source documents.
2. Compare structural findings (rooms count, skladby count, work blocks count, missing docs identification).
3. Expected outcome:
   - ~80-90 % overlap with internal extraction → validates pipeline correctness
   - ~10-20 % new findings → uncovers gaps in internal extraction
4. Treat external LLM output as **validation cross-check**, NE replacement for detailed internal items.

### Acceptance
External LLM findings cross-referenced against internal output. Real gaps integrated, false positives dismissed with rationale.

### Anti-pattern
Replace internal detailed items with external LLM high-level abstractions (different abstraction levels). Or dismiss external findings without verification (defensive reflex).

### Origin context
RD Jáchymov pilot — ChatGPT independent analysis confirmed ~80 % of internal findings + flagged 2 real gaps (sklad-specific skladby namespace per Pattern 24, cell numbering anomaly). Both subsequently verified and addressed.

### Related
- Pattern 3 (Triangulation philosophy) — same principle at item level; Pattern 27 lifts to document level
- Pattern 31 (CEV) — external LLM is one of the CEV layers

---

## Pattern 28: Schema integrity — globally-unique entity IDs

**Source:** RD Jáchymov pilot Phase 3 (2026-05-26 — VRN.001 collision bug).

### Problem
Reused entity IDs across sub-namespaces (e.g., `VRN.001` exists in 9 different VRN sub-kapitolas of the same project) lead to first-match overwrite bugs during patch operations. Tooling that resolves an item by ID alone silently overwrites the wrong entry.

### Algorithm
1. Enforce globally-unique `item.id` at schema validation step.
2. OR document compound canonical key (e.g., `(id, kapitola, subkapitola)`) and require all patch tools to use it.
3. Patch tools use compound key for identity resolution, never first-match by partial ID.

### Acceptance
Schema validator runs before patch operations. Compound key resolution required.

### Anti-pattern
First-match patching by ID prefix overwrites wrong entry silently. Validator doesn't run → bug ships → caught only on next audit.

### Origin context
RD Jáchymov pilot patcher overwrote ZS WC popis when intending to update Průzkumy popis — both had ID `VRN.001` under different sub-kapitolas. Caught during re-audit (Pattern 20 Audit v2 re-run), fixed via compound key `(id, kapitola)`. Schema-level fix (globally-unique id) queued as separate refactor.

### Related
- Pattern 14 (Forward-tracked `_analytical_journey`) — provides audit trail to catch ID-collision bugs early
- Pattern 24 (Multi-namespace S-codes) — same lesson at a different schema field

---

## Pattern 29: Continuous source provenance per item

**Source:** RD Jáchymov pilot item-generation schema (2026-05-19 onwards).

### Problem
Items without source attribution become unverifiable. Catalog matching, qty disputes, audit trail, projektant questions — all require traceable origin per item. Patterns 2 (audit trail) + 14 (forward-tracked journey) cover mutation history; this pattern covers initial-creation provenance.

### Algorithm — required fields per item

```yaml
item_id: <globally unique — see Pattern 28>
popis: <Czech URS-standard terminology>
mj: <single canonical unit>
mnozstvi: <numeric value>
mnozstvi_formula: <human-readable derivation, e.g. "obvod 38.70 × výška 2.795 - okna 7.2 m²">
_source: <document reference, e.g. "TZ ARS § 5.5 + DXF dum_DPZ SM_kóty layer">
_data_quality: <enum: dxf_deterministic / tz_explicit / methvin_empirical / fallback_csn>
_mnozstvi_conf: <0.0-1.0>
_vyjasneni_ref: [Q3, Q8, ...]   # open questions affecting this item
_audit_gap_fixed: <gap ID if added during audit>   # optional
```

### Acceptance
Every item has fields populated. Quality pass checks `_source` claims actually verifiable in source documents (CEV Matrix C).

### Anti-pattern
Items without source ("magic" appearance), or `_source` pointing to non-existent reference.

### Origin context
RD Jáchymov pilot requires per-item provenance for File A audit deliverable. Matrix C (items → source verification, part of Pattern 31 CEV) validates this layer continuously.

### Related
- Pattern 2 (Audit trail mandatory) — sibling discipline for mutations
- Pattern 14 (`_analytical_journey`) — mutation-history sibling
- Pattern 31 (CEV) — Matrix C verifies _source claims
- Pattern 32 (Two-file delivery) — File A surfaces these fields as columns

### Enrichment 2026-05-29 (terasa 762 miss — citation present ≠ VERIFIED)
A populated `_source` field is **necessary but not sufficient** for VERIFIED status. The terasa item carried `_source: "PDF řez C-C explicit composition"` — a *real* reference — yet the extracted content (4 layers, wood dropped, dlaždice inverted) did **not** match the drawing (7 layers). VERIFIED requires the claim to **match the cited source on re-read** (vision for drawings, Pattern 39), not merely cite it.
- `_source` missing → **UNVERIFIED**.
- `_source` present but not confirmed-against-document → **UNVERIFIED until content-match confirmed**.
- CEV Matrix C (Pattern 31) verdict for a citation-present-but-content-mismatched item is `NOT_VERIFIABLE` / `PARTIAL`, never `VERIFIED`.

---

## Pattern 30: Czech regex diacritic boundary pitfall

**Source:** RD Jáchymov pilot Quality pass (2026-05-26 — caught 2 false negatives on `č` / `š` boundary).

### Problem
Python `\w+` matches Czech diakritiku in the matched portion, BUT prefix patterns with explicit Czech characters fail at char-boundary mismatch when the boundary lands on a multi-byte UTF-8 character.

**Example failure:**
- Pattern: `^Hydroizolac\w+`
- Target: `Hydroizolační`
- Failure: position 10 is `č` (U+010D Latin Extended-A), NOT `c` (U+0063)
- Regex fails despite expectation.

### Algorithm — workarounds

```python
# WRONG — fails on diacritic boundary
PATTERN = r'^Hydroizolac\w+'

# RIGHT — use shorter stem before boundary
PATTERN = r'^Hydroiz\w+'

# RIGHT — explicit alternative
PATTERN = r'^Hydroizolac[ií]'  # or
PATTERN = r'^Hydroizolač'      # specify exact char

# RIGHT — unicode-aware library (regex module instead of re)
import regex
PATTERN = regex.compile(r'^Hydroizolac\p{L}+')
```

### Reusable utility
`czech_regex_helpers.py` — tested patterns for common Czech construction terminology (target).

### Acceptance
All Czech regex patterns tested against actual terminology before deployment.

### Anti-pattern
Assume ASCII char-boundary semantics in Czech regex prefix. Bug silently fails extraction — no error, just zero matches where matches were expected.

### Origin context
RD Jáchymov pilot Quality pass caught 2 false negatives where regex failed on `č` / `š` boundary in stems.

### Related
- Pattern 22 (PDF noise filters) — same regex-discipline class
- Pattern 17 (Phase 0a) — text-probe step uses regexes that must follow this discipline

---

## Pattern 31: Comprehensive Extraction Verification (CEV) before catalog matching

**Source:** RD Jáchymov pilot (2026-05-26 — full CEV session).

### Problem
Extraction may complete per Phase 0a (Pattern 17) + Audit v2 (Pattern 20) + Quality pass, but **cross-source consistency** between TZ / DXF / Excel / Word / MD is not verified. Catalog matching against unverified baseline = matching against potentially-inconsistent data = wasted matching budget + delayed delivery if inconsistency surfaces post-match.

### Algorithm — 5 layers + 4 matrices

**Layers (extract):**
1. TZ texts — all PDFs in `tz/` + `dokladova_cast/` + `vykresy_pdf/`
2. DXF files — re-verify all layers + entities
3. Excel inputs — all batch / source files, all sheets
4. Word documents — questions, decisions, narratives
5. Markdown outputs — cross-consistency of summary docs

**Matrices (cross-reference):**
- **Matrix A** — TZ requirements → items (COVERED / N/A_DOCUMENTED / GAP / EXTRA)
- **Matrix B** — DXF entities → items (same verdicts)
- **Matrix C** — items → source verifiability (VERIFIED / PARTIAL / NOT_VERIFIABLE)
- **Matrix D** — cross-document consistency (same fact mentioned in 2+ docs → consistent?)

### Outcomes
- **Path A:** all matrices clean → resume catalog matching with confident baseline
- **Path B:** few gaps found → add items + re-audit subset → then catalog matching
- **Path C:** significant gaps → halt + escalate

### Acceptance
CEV final report with explicit Path A/B/C verdict before Phase 5 catalog matching (per Pattern 15 enriched sequence).

### Anti-pattern
Skip CEV, jump straight from extraction to catalog matching. Discover inconsistencies post-delivery.

### Origin context
RD Jáchymov pilot's CEV caught 3 GAPs + 1 ENRICHMENT after Audit v2 + Quality pass had already passed. Without CEV, these would have shipped.

### Reusable code (RD Jáchymov reference)
- `tools/cev_layers_extract.py` — 5-layer extraction
- `tools/cev_matrices.py` — Matrices A + B
- `tools/cev_matrices_cd.py` — Matrices C + D
- `tools/cev_per_drawing_audit.py` — Pattern 23 addendum

### Related
- Pattern 15 (Work-First, Catalog-Last) — Phase 2 of the strict sequence
- Pattern 17 (Phase 0a) — orthogonal source-side completeness
- Pattern 20 (Audit v2) — orthogonal works-side completeness
- Pattern 22 (PDF noise filters) — used by Matrix A/C builders
- Pattern 23 (Per-drawing extraction) — addendum pass within CEV
- Pattern 32 (Two-file delivery) — Phase 4 deliverable that depends on frozen CEV-verified baseline

---

## Pattern 32: Two-file delivery — audit + production separation

**Source:** RD Jáchymov pilot Phase 4 (2026-05-26 — File A audit Excel + Word docx) + HK212 base discipline.

### Problem
Single deliverable trying to serve both **audit transparency** + **production usage** gets compromised on both fronts. Audit columns clutter the production view; production codes pollute the audit narrative; both audiences end up reading the wrong file.

### Algorithm — two separate files

**File A — Audit / Worksheet** (audit Excel):
- Multiple sheets for different audience views (aggregated / detailed / per-floor / per-construction / verification trail)
- Per item: provenance columns (source / formula / data_quality / confidence / vyjasneni_ref / realizuje_skladbu / _audit_gap_fixed)
- For: investor (high-level), projektanti (technical), internal QA (provenance)
- Purpose: transparency, decision support, audit trail

**File B — Production** (catalog-system import):
- Standard catalog format (per system requirements — KROS, BKI, Batiprix, etc.)
- Clean: code | popis | MJ | qty | unit_price | total | flag
- Section dividers (chapter hierarchy) + items + formula breakdowns
- For: execution partner direct import
- Purpose: production usage, cenotvorba, system integration

**Both files reference same items.json source-of-truth.** Different rendering layers.

### Acceptance
Both files delivered separately. Different naming convention. Different sheet structures. Same `items.json` upstream.

### Anti-pattern
Mix provenance columns into production file (pollutes import). Or omit provenance from audit (no transparency).

### Origin context
RD Jáchymov pilot required both — File A (`Vykaz_vymer_VSE_VARIANTY_<date>.xlsx`) for investor + projektanti, File B (`Vykaz_vymer_KROS_format_<date>.xlsx`) for Karel KROS systém import.

### Related
- Pattern 15 (Work-First, Catalog-Last) — Phase 4 (File A) vs Phase 6 (File B) sequencing
- Pattern 16 (Universal work ontology) — same items.json drives N market-specific File B variants
- Pattern 29 (Continuous source provenance) — provides the columns File A renders
- Pattern 31 (CEV) — output drives the "Cross_verification" sheet of File A

---

## Pattern 33: Project synthesis before audit decisions

**Source:** RD Jáchymov pilot mid-iteration (2026-05-22 — first Project_Summary.md produced).

### Problem
Iterative audits find new gaps each pass because agent lacks **holistic project mental model**. Agent only sees individual items, individual TZ sections, individual DXF entities. Without project-level synthesis, decisions become reactive to individual findings → fix one item, audit, find next, fix, audit, …

### Algorithm
Before fixing / delivering, agent produces a structured project summary:

```
1. Investiční záměr — investor, lokalita, charakter zakázky, stupeň dokumentace
2. Stavební objekty — per SO: rozsah, geometrie, podlaží, jednotky
3. Klíčové konstrukce — per SO: skladby, materiály, specifika
4. Bourání — demolice m³, demontáže ks
5. Nové instalace — vytápění, voda, elektro, větrání
6. Cenové bloky — per kapitola item counts (HSV X / PSV Y / VRN Z)
7. Otevřené otázky — per projektant breakdown
8. Stav přípravy — audit chain status
```

**Two outputs:**
- Full summary (`Project_Summary.md`) — 8 sections, ~16 KB
- One-pager (`Project_OnePager.md`) — 1 A4 page for client quick orientation

### Acceptance
Holistic synthesis forces mental model. Subsequent decisions (fix vs ship, accept vs escalate) become informed instead of reactive.

### Anti-pattern
Jump from individual finding to immediate fix without project-level context. Pattern of "fix → re-audit → new finding → fix → re-audit" without synthesis.

### Origin context
RD Jáchymov pilot — after 4 audit layers caught gaps iteratively (Phase 0a + Audit v2 + Quality + per-drawing CEV), user requested project summary. Holistic synthesis enabled informed decision: Path C (hybrid delivery: audit Excel now, KROS file later).

### Related
- Pattern 18 (Iterative deepening) — Pattern 33 informs when to stop iterating
- Pattern 19 (Diminishing returns gate) — Pattern 33 is the basis for "is this material or stylistic?"

---

## Pattern 34: Honest cost transparency to user

**Source:** RD Jáchymov pilot mid-session (2026-05-24 — user panic over conflated bills).

### Problem
User panics seeing "AI used $10-15 budget" assuming separate billing. Agent should clarify cost model to avoid false alarm and to keep budget decisions informed.

### Algorithm — when discussing operational cost
1. State exact cost per operation (e.g. WebSearch ~ $0.01 per query at Anthropic pricing).
2. Total for typical task (~ $0.50-0.80 for 50-80 queries).
3. Billing model: bundled in user's subscription (NOT separate charge).
4. Compare to user's hesitation source (e.g. separate Google Cloud bill).
5. Explain unrelated charges separately if user conflates them.

### Acceptance
User understands real cost magnitude + billing model.

### Anti-pattern
Vague "budget concerns" without specifics. Or confuse user about which bill covers what.

### Origin context
RD Jáchymov pilot — user saw "$10-15 budget" in agent comment + received 1000 CZK Google Cloud bill same day. Conflated two separate things. Clarification: WebSearch real cost ~ $0.50, GCP bill = STAVAGENT infrastructure unrelated to AI usage.

### Related
- Pattern 25 (Web search verification) — primary cost source this pattern explains

---

## Pattern 35: Skill-of-the-pilot encoding for next iterations

**Source:** RD Jáchymov pilot retrospective (2026-05-26 — pattern library expansion session).

### Problem
Each pilot generates lessons learned. Without explicit codification, lessons evaporate. Future pilots repeat same mistakes. The session that just shipped doesn't have time / context to write up patterns; the next session doesn't know they existed.

### Algorithm
1. After pilot delivery, identify patterns caught during iteration.
2. Generalize each pattern (project-agnostic — strip the project-specific instance from the universal pattern).
3. Write `<NN>_<pattern_name>.md` to pilot-local case studies directory + add corresponding **universal** pattern to master registry (`docs/STAVAGENT_PATTERNS.md`).
4. Update agent-context files (root + per-area `CLAUDE.md`) with critical patterns as mandatory rules.
5. Update relevant skill descriptors (`SKILL.md`) where applicable.
6. Cross-reference pilot-local case study to master pattern (and vice-versa).

### Acceptance
Patterns codified in 3+ locations (per-pattern case study + master registry + agent context). Next pilot automatically inherits via CLAUDE.md mandatory rules.

### Anti-pattern
Mental note only. Hope to remember next time. Lessons lost between pilots.

### Origin context
RD Jáchymov pilot produced 22+ patterns. Each codified in this expansion pass: master registry sections 17-36 + pilot-local case studies in `concrete-agent/.../rd_jachymov/patterns/01..09` + `patterns_validated.md` cross-reference + CLAUDE.md mandatory-rule promotion (Patterns 17, 20, 31, 15, 12).

### Related
- Pattern 35 is the **meta-pattern** that produces every other pattern entry in this file
- Pilot-local `rd_jachymov/patterns_validated.md` — validation report sibling

---

## Pattern 36: File staging convention for processed vs canonical inputs

**Source:** RD Jáchymov pilot input handling (2026-05-18 → 2026-05-26).

### Problem
Source documents arrive in mixed states (versions, drafts, superseded). Without a staging convention, agent processes wrong versions or processes same content multiple times.

### Algorithm — input directory convention

```
inputs/
├── tz/                      # Canonical TZ texts (current versions)
├── dokladova_cast/          # Canonical dokladová část
├── vykresy_pdf/             # Canonical drawings (current)
├── situace/                 # Canonical site plans
├── _reference/              # Reference examples (e.g. other projects' formats)
├── _superseded/             # Older versions kept for audit trail
│   └── YYYY-MM-DD_<reason>/ # Per-date subdirs explaining supersedence
└── meta/                    # Metadata (vyjasnění queue, inventory)
```

**Per-document attributes:**
- Version tag in filename
- Date in supersession subdir
- Reason note in `meta/`

### Acceptance
Agent processes only canonical (current) inputs. Audit can re-verify by reviewing supersedence trail.

### Anti-pattern
Mix canonical + superseded in the same directory. Agent processes outdated version. Or duplicate-processes superseded version.

### Origin context
RD Jáchymov pilot inputs underwent multiple TZ revisions. Staging convention preserved audit trail while keeping canonical inputs clean.

### Related
- Pattern 17 (Phase 0a) — Layer 1 PDF inventory uses the canonical staging tree
- Pattern 28 (Schema integrity) — staging convention is a schema for the filesystem

---

## Pattern 37: Parallel session sync verification

**Source:** STAVAGENT 2026-05-26 — recurring duplicate-work incident across PATTERNS.md / soup.md / items.json. The task spec that produced THIS pattern entry is itself the fourth example below.

### Symptom
Multiple Claude Code sessions work on the same repo in parallel. Session A adds Pattern X to `main` while Session B has Pattern X already queued from an older snapshot of `origin/main`. Result: duplicate commits, duplicate branches, duplicate PRs, time wasted on already-done work, and — when both sessions touch the same numbered counter (Pattern N, item N, anchor N) — conflicts that aren't visible as `git merge` conflicts because both sessions touched different *bytes* of the file.

### Anti-pattern
Start a new task assuming the local working copy or your conversational memory reflects current `origin/main`. Skip `git fetch` because "I was just here". Trust task-spec numbers ("add Pattern N") without grepping the actual file. Branch off a stale `main`.

### Correct pattern
Before any task that touches shared resources — `docs/STAVAGENT_PATTERNS.md`, `docs/soul.md`, `docs/steering/*.md`, `test-data/<pilot>/outputs/.../items.json`, `concrete-agent/CLAUDE.md` — run a 30-second sync ritual:

```bash
git fetch origin
git log origin/main --oneline -10                           # what landed recently?
grep -n "Pattern X\b" docs/STAVAGENT_PATTERNS.md            # does target number exist?
grep -nE '^## Pattern [0-9]+:' docs/STAVAGENT_PATTERNS.md | tail -5   # current max
git ls-remote origin 'refs/heads/claude/*' | head -30       # work-in-flight elsewhere?
# Optional: list open PRs in same scope (via gh / GitHub MCP)
```

Check for:
1. **Recent commits** to shared files since last local fetch (PATTERNS.md, soul.md, structure.md, items.json, CLAUDE.md).
2. **Open PRs** touching the same scope (their head branches are still on remote — diff them against `origin/main`).
3. **Active `claude/*` branches** — work-in-flight by parallel sessions, not yet merged.
4. **Task-spec numbers vs. file reality** — the task says "Pattern N" or "item N", but the file might already be past N.

Only after verification → proceed. If conflict detected → reconcile **before** committing: bump the number to the next free slot, rename branch, update PR description. Do NOT silently overwrite, do NOT add a duplicate-numbered entry, do NOT renumber existing patterns (cross-references rot).

### Acceptance
- Every shared-file task starts with a `git fetch` + at least one `grep` against the actual file.
- Task spec numbers are treated as advisory — the file's `last_number` header wins.
- Conflict reconciliation is documented in the commit message (which number was requested, which was used, why).

### Origin context — four real incidents

1. **Pattern 8 / 13 numbering drift** — Section Engine session + RD Jáchymov session both added patterns concurrently. Discovered during a later audit; resolved retroactively in PR #1228 (numbering audit + `last_number` header).
2. **Pattern 15 + 16 duplicate effort** — main user session prepared a "draft Pattern 15 + 16" task while a parallel session shipped PR #1221 first. ~30 min of duplicated drafting; the user-side draft was then abandoned, not merged.
3. **Branch `dilenska-ok-ut-dps-integration` auto-deleted post-merge** — a follow-up session looked for this branch to continue work, didn't find it, and started fresh from `main` not realizing the work was already integrated. Several hours of "where did my work go?" before the audit.
4. **This entry itself** — task spec asked to *"add Pattern 17"* and verify *`last_number: 16`*. Header showed `last_number: 36` (PR #1231 had landed Patterns 17..36 between the task being written and the agent picking it up). Reconciled by promoting the entry to Pattern 37 and bumping the header — exactly what the pattern prescribes. The spec was written against a snapshot ~24 h stale.

### Implementation hint — pre-commit hook
Add a git pre-commit hook `check-shared-files.sh` that:
- Detects modifications to `docs/STAVAGENT_PATTERNS.md`, `docs/soul.md`, `docs/steering/*.md`, `concrete-agent/CLAUDE.md`, `**/items*.json` in the staged diff.
- Verifies `.git/FETCH_HEAD` is younger than 10 minutes (i.e. `git fetch` was run recently).
- If a shared file is modified AND fetch is stale → exit 1 with: *"Run `git fetch origin` and verify origin/main before committing changes to shared file <path>"*.
- Bypass via `--no-verify` only if the operator explicitly accepts the risk (logs to commit trailer).

A heavier variant uses GitHub MCP to list open PRs whose head branches touch the same paths and refuses to commit if any are not yet merged or closed. Reserve for the highest-traffic shared files (PATTERNS.md, soul.md).

### Anti-pattern
Treating "I just rebased an hour ago" as good enough. With 50+ active `claude/*` branches in this repo, the half-life of `origin/main` is measured in minutes for high-traffic shared files. Always re-fetch immediately before a shared-file edit.

### Related
- Pattern 12 (Squash Merge Orphans) — branches auto-delete post-merge, leaving stale local refs; mitigated by the same fetch-first discipline
- Anti-pattern **Pattern number guessing** (near end of file) — the failure mode that motivates the `last_number` header that motivates this pattern
- Pattern 14 (Forward-Tracked `_analytical_journey`) — same shape: explicit state-of-the-world check before mutation, instead of relying on memory

---

## Pattern 38: Single-source projection discipline

**Source:** RD Jáchymov pilot UWO restructure (2026-05-28/29). Distinct operational corollary of Patterns 16 + 32.

### Problem
A pilot produces many deliverable *views* of the same data — atomic worklist XLSX, audit File A (multi-sheet), File B production, completeness/quality audit reports, decomposition map. Once there are 5+ views, two failure modes appear:
1. **Drift** — someone hand-edits a quantity in the Excel; now the Excel disagrees with `items.json`. Next regeneration silently reverts the edit, or worse, the edit is treated as authoritative and `items.json` rots.
2. **Stale views** — `items.json` changes (e.g. +2 anchor-gap items 212→214) but only some views are regenerated. The atomic worklist says 240 ops, File A still says 212 items, the audit report cites the old count. Reviewer can't tell which number is true.

Pattern 16 establishes *what* the single source is (catalog-agnostic work ontology). Pattern 32 establishes *which* views exist (File A audit vs File B production). Neither codifies the **operational discipline** that keeps them in sync.

### Algorithm
1. **`items.json` is the ONLY editable artefact.** Every other deliverable is a *projection* — generated, never hand-edited.
2. **ONE regeneration orchestrator** (`regenerate_all_views.py`) runs the full view pipeline as a fail-fast subprocess chain. After ANY `items.json` change, run it — all views rebuild from the single source in dependency order.
3. **Never hand-edit a projection.** A correction goes into `items.json` (or its generator), then regenerate. If you find yourself opening the XLSX to "just fix one cell" — stop; fix the source.
4. **Version-supersede, don't overwrite.** Before a baseline change, snapshot the old `items.json` to `inputs/_superseded/<date>_<reason>/` + an `items_FROZEN_pre_<change>.json`. The frozen snapshot is the revert source and the audit trail.
5. **Post-regen sync assertion.** The orchestrator (or a follow-up check) asserts every view's item-count == `items.json` count. Mismatch = abort, not ship.

### Acceptance
- Single command regenerates all views; output is a per-step OK/FAIL table.
- A grep/assert confirms `items.json` count == atomic-map count == File A count after every change.
- No deliverable XLSX is ever in the diff without its generator also in the diff (a hand-edited projection shows as XLSX-only change → red flag).

### Anti-pattern
- Hand-editing the Excel "because it's faster than fixing the script". The edit is invisible to the next regeneration and to every other view.
- Regenerating only the view you happened to be looking at, leaving the other 4 stale.
- Overwriting the previous `items.json` in place with no dated snapshot — losing the ability to diff "what changed and why".

### Origin context
RD Jáchymov Stage 1B added 2 anchor-gap items (212 → 214 — přesun hmot + lešení). A single orchestrator `tools/regenerate_all_views.py` rebuilt all 7 views (atomic decomposition 240 ops → worklist XLSX → File A base + v2 + v2_final → completeness + quality audits) fail-fast; post-regen assertion confirmed `items.json 214 == atomic map frozen_total 214`. Old 212-item baseline superseded to `inputs/_superseded/2026-05-29_pre_anchor_gaps/`. No view was hand-edited; the only editable artefact was `items.json` (+ the `apply_anchor_gaps.py` generator).

### Reusable code
- `tools/regenerate_all_views.py` — orchestrator (7-step fail-fast chain)
- `inputs/_superseded/<date>_<reason>/` — version-supersede convention (extends Pattern 36 to baseline snapshots)

### Related
- Pattern 16 (Universal Work Ontology) — *what* the single source is (catalog-agnostic); Pattern 38 is *how* you keep projections in sync with it
- Pattern 32 (Two-file delivery) — *which* views exist; Pattern 38 governs their regeneration
- Pattern 36 (File staging convention) — `_superseded/` convention extended here to baseline snapshots
- Pattern 28 (Schema integrity) — the count-assertion is a schema-level invariant

---

## Pattern 39: Vision-first reading for drawings (skladby / řezy / detaily)

**Source:** RD Jáchymov terasa 762 miss (2026-05-29).

### Problem
Technical drawings carry critical information as **graphical** content — layered skladba tables, řezy with composition call-outs, dimension chains, hatched material legends. Text extraction (pypdf / pdfplumber) and even text-OCR (tesseract) flatten or drop the graphical structure: a multi-layer skladba table becomes a jumble of disordered tokens, **layer order is lost**, and the agent silently mis-reconstructs the composition.

### Algorithm
1. For any drawing whose value is **graphical** (skladby, řezy, detaily, composition tables, hatched legends): read the drawing **AS AN IMAGE** via multimodal vision (Gemini Vision / Claude vision), rendering the page → PNG @ ≥200 DPI.
2. Extract the composition with explicit structure: ordered `layers[]` (top→bottom as drawn), each with material + thickness + role.
3. Text extraction (pypdf) + text-OCR (tesseract, Pattern 23) are **fallback only** — for plain narrative text, never for graphical composition.
4. Cross-check the vision-extracted skladba against any TZ text mention (Pattern 31 Matrix D consistency).

### Acceptance
Every skladba/řez-derived item cites a vision-read source (e.g. `"ŘEZ C-C vision-read, 7 vrstev"`) and the layer order matches the drawing. A skladba reconstructed purely from text extraction is flagged UNVERIFIED until vision-confirmed.

### Anti-pattern
Running pypdf / pdfplumber / tesseract on a graphical řez and trusting the token output as the composition. Loses layer order + graphical-only content (hatching, leader lines, layer brackets).

### Origin context
RD Jáchymov — `ŘEZ C-C` was available but read as text; the 7-layer terasa skladba (prkna → dřevěný rošt → terče → betonové dlaždice *roznášecí* → štěrk → hrubý podsyp → geotextilie) collapsed to **4 ops** with wood (762) lost and "dlaždice na terče" inverted (tiles placed above terče instead of as the roznášecí layer below). A vision read would have captured all 7 layers in order.

### Related
- Pattern 23 (Per-drawing extraction) — *coverage* of all sheets; Pattern 39 is the *reading modality* for each
- Pattern 31 (CEV) — vision is the correct Layer-1/Layer-2 reading method for graphical sheets
- Pattern 9 (Re-read source before generating/deciding) — vision is *how* you re-read a drawing
- Pattern 40 (Host-delegated vision) — *who* does the vision in an MCP topology

---

## Pattern 40: Host-delegated vision + MCP deterministic validation gate

**Source:** RD Jáchymov terasa 762 miss (2026-05-29) — architecture corollary.

### Problem
The STAVAGENT MCP server exposes 9 deterministic-Python tools (incl. `analyze_construction_document`). A naive design tries to make the MCP server itself "do vision" (run pypdf / OCR server-side) — but it has no multimodal model, so its drawing reading degrades to text extraction (the terasa failure mode). Meanwhile the **host** chat (ChatGPT / Claude.ai / Gemini) already has native multimodal vision. Duplicating a weaker vision in the MCP server is both redundant and worse.

### Principle
Vision is the **host's** job; the MCP server's job is to **orchestrate + validate deterministically**. The MCP forces the host to do vision correctly via 4 mechanisms:
1. **Schema requires structured grounded fields** — `analyze_construction_document` must return ordered `layers[]` (material + thickness + role) + per-field `source`. A flat string is rejected.
2. **Description instructs vision-first** — the tool description tells the host to read the drawing AS AN IMAGE (Pattern 39) before calling.
3. **Validation gate rejects ungrounded output** — missing `source` / missing layer order / layer-count mismatch → the tool returns an error asking the host to re-read.
4. **Deterministic cross-reference** — MCP parses the TZ text deterministically and compares against the host-vision skladba; divergence (e.g. TZ says "garapa prkna", vision-skladba has no wood) → flag — catches hallucination.

The MCP cannot literally make the model "look", but schema + validation make the host **unable to submit accepted data** without having done vision properly.

### Acceptance
MCP document/skladba tools (a) require ordered `layers[]` + `source`, (b) reject ungrounded submissions, (c) emit a deterministic TZ↔vision cross-check verdict. Host output that fails the gate is bounced back, not silently stored.

### Anti-pattern
MCP server runs its own pypdf / OCR and returns a flat text blob as "the skladba" (re-creates the terasa miss server-side). Or accepts host output with no `source` / no layer structure (no gate).

### Origin context
The terasa miss happened in a Claude Code session reading the řez as text. Generalized: any host (incl. MCP clients ChatGPT / Claude.ai) reading drawings must do vision; the MCP server's value-add is deterministic validation (TZ parse, catalog, schema), **not** duplicating the host's vision.

### Related
- Pattern 27 (External LLM cross-validation) — sibling; Pattern 40 is the host↔MCP division of labor
- Pattern 39 (Vision-first) — *what* the host must do
- Pattern 31 (CEV) — MCP deterministic layers feed the cross-check
- Pattern 29 (Source provenance) — the grounded fields the gate requires

---

## Pattern 41: Montáž / materiál split — one work item → 1 labor leaf + N material leaves

**Source:** RD Jáchymov krov leaf-binding (2026-05-31 → 06-01, PRs #1264 krov members + #1265 svorníky tesařských spojů).

### Problem
The Czech ÚRS / KROS catalog prices **labor (montáž) separately from material**. A 6-digit *family* code resolves the **labor operation only**, priced per MJ of installed work:
- `762332` = montáž krovů (m / m² of member)
- `762085` = montáž svorníků/šroubů tesařských spojů (ks)

The material it consumes is a **separate catalog line with its own code, its own MJ, and its own quantity** (řezivo m³, tyč závitová m, matice/podložky `100 ks`). Folding material into the montáž quantity — or treating one family code as "the whole item" — double-distorts both the unit and the price and makes the tender line unauditable.

Second failure mode: quantities or specs that depend on **statika / tesařský detail** (svorník Ø M12, count 50) are *estimates*, but the labor code is *real*. Recording the code as "matched" while silently treating the estimate as fact hides the uncertainty — and a lone montáž line tends to **silently absorb adjacent scope** (kotvení pozednice, úhelníky, hřebíky) that has its own codes.

### Solution
1. **Decompose each physical work item into atomic operations** — exactly **one montáž (labor) leaf + N material leaves**, each carrying its own `urs_code` + `mj` + `qty` + `qty_formula`, stored as `atomic_decomposition` children. The parent items.json item keeps the headline montáž MJ + qty.
   - Krov svorníky `HSV5.017`: montáž `762085112` (ks, 50) + tyč závitová `31197004` (m, 14 = 50×0.25×1.10) + matice `3111006` (100 ks, 1) + podložka `31121004` (100 ks, 1).
   - Krov members `HSV5.001–006`: montáž `762332122/121` (m / m²) + řezivo `605…` (m³, with prořez %).
2. **MJ of montáž ≠ MJ of material.** Montáž is per-member (m / ks / m²); material is per-volume / length / selling-unit (`100 ks`). Never reuse one quantity for both.
3. **Material qty = engineering formula with explicit prořez / odpad** — řezivo ×1.10; závitová tyč = length × count × prořez; spojovací materiál = count × per-joint multiplier rounded to the selling unit (`100 ks`).
4. **Judgment-driven quantities flagged honestly** — when count / diameter / length depends on statika or a detail absent from the source, the labor code stays `matched_catalog` but the item gets `mnozstvi_confidence ≤ 0.6` + a `status: OVĚŘIT` note **naming exactly what to confirm** (M12/M16, length, count dle statiky).
5. **Explicit exclusion list** (`NEZAHRNUJE: …`) on the item so the montáž line cannot silently swallow adjacent scope that has its own codes (kotvení pozednice → samostatně, úhelníky `762086111` kg, hřebíky/vruty → pomocný materiál).

### Invariant
Every montáž leaf that consumes material has ≥ 1 sibling material leaf **with a different MJ**; no item's montáž qty equals its material qty unless the units are physically identical. Every OVĚŘIT item carries a **named verification target + an exclusion list** — never a bare estimate dressed as fact.

### Anti-pattern
One family code stands in for "the whole item" (labor + material merged into a single ks/m line). Or an estimated count (50 ks svorníků) recorded as `matched` with full confidence and no OVĚŘIT flag, letting the line quietly absorb kotvení / úhelníky / hřebíky scope.

### Related
- Pattern 11 (FTS5 + MJ equivalence) — matches each leaf to its catalog code; **this** pattern says *how many* leaves there are
- Pattern 15 / 16 (Work-First / Universal Work Ontology) — the montáž/materiál split is the catalog-phase refinement of one work-ontology item into N catalog lines
- Pattern 26 (Honest fallback) + Pattern 34 (Honest cost transparency) — OVĚŘIT-flagging applies the same honesty discipline to judgment quantities
- Pattern 2 (Audit trail) — each material leaf needs its own `qty_formula`
- Pattern 45 (Výměry-First) — the qty of **both** legs (montáž + each materiál) must trace to a row in the výměry register, not float; the universal unit of measure (room / prvek / úsek) is the granularity of that register

---

## Pattern 42: Renovation skladba = two work groups (bourání + nové)

**Source:** RD Jáchymov skladby workflow (S01–S12 in three states: stávající / bourání / návrh).

### Problem
A renovation project's skladby arrive in 2–3 states — **STÁVAJÍCÍ** (existing), **BOURÁNÍ** (demolition), **NÁVRH** (new). Treating one skladba as a single work item conflates demolition with new construction → either the bourání is missed (demolice not priced) or a new layer is billed where the old layer actually stays.

### Solution
One skladba → **two parallel work groups, never merged**:
- **STÁVAJÍCÍ vrstvy that are removed → BOURÁNÍ položky** (HSV-6 demolice: sejmutí / demontáž / otlučení)
- **NÁVRH vrstvy → KONSTRUKČNÍ položky** (new HSV/PSV; montáž/materiál split per Pattern 41)
- **Existing layers that are KEPT → no položka** (`ℹ️ stávající`: zdivo, cihelná klenba, trámy, záklop retained in a reconstruction)
- **Surface finishes** (vnitřní omítka, výmalba, nášlap, obklad) → global PSV položky, not per-skladba

Each item carries `realizuje_skladbu` + `_source="skladba S0X stávající|návrh"`.

### Invariant
Every removed STÁVAJÍCÍ layer has a bourání položka; every NÁVRH layer has a konstrukční položka (or is covered by a global PSV); KEPT layers have neither. Bourání-gaps and návrh-gaps are audited **separately**.

### Related
- Pattern 15 (Work-First, Catalog-Last) — upstream
- Pattern 41 (Montáž/materiál split) — applies to each NÁVRH konstrukční item
- Pattern 31 (CEV) — extraction completeness before grouping

---

## Pattern 43: PD cross-source contradiction → reconcile, don't duplicate

**Source:** RD Jáchymov sokl (TZ ARS text vs výkres S03 / Řez A-A vs pohledy material C).

### Problem
Different PD documents describe the **same physical element differently**:
- TZ ARS text: sokl = XPS + cihelný obklad
- výkres S03 + Řez A-A + pohledy (C): sokl = sanační Styrcon 200 + keramický obklad

If each source is faithfully turned into a položka, you get **parallel items for one physical element** → double-count. The tell: sub-quantities of one element **sum beyond its physical envelope** (cihelný 13.5 m² + keramický 23 m² = 36.5 m² of cladding on a ~23 m² sokl).

### Principle
Parallel items citing conflicting PD sources are the **symptom of PD self-contradiction**, not legitimate separate work. Do **not** silently keep both (double-count) and do **not** silently pick one (hidden assumption — Pattern 3). Instead:
1. **Detect** via envelope check — `Σ(sub-quantities of one element) ≤ physical envelope`; the excess is the duplicate.
2. **Surface the rozpor explicitly** with every citation (which document says what).
3. **Human / projektant decides** which source wins.
4. **Remove the superseded source's item(s)** — not keep both — and **cascade consequences** (e.g. omítka area drops when the sokl becomes keramický obklad, not omítka).
5. **Leave a vyjasnění trail** documenting the contradiction + the decision applied.

### Invariant
One physical element = one build-up in the soupis. `Σ sub-areas ≤ envelope`. Every resolved contradiction leaves a vyjasnění with all conflicting citations + the chosen source.

### Related
- Pattern 3 (Triangulation — no silent winner) — this is the intra-PD-document case
- Pattern 33 (Project synthesis before audit decisions)
- Pattern 29 (Source provenance) — a wrong-document citation is the sibling failure (radon: source said statika §5.5; radon was in Souhrnná TZ B.3.9)

---

## Pattern 44: Geometry-bounded estimate vs strict null

**Source:** RD Jáchymov — sokl 23 m² (estimate) vs S08 plocha (null) vs vjezd plocha (null).

### Problem
When PD gives no explicit quantity, the temptation is to invent a number. A fabricated quantity with no geometric basis is a hallucination that **looks like data** and silently inflates the soupis.

### Principle
Estimate a quantity **only when it derives from known physical geometry via a deterministic formula** — e.g. `sokl = obvod 38.7 m (DXF) × výška 0.6 × řadovka 0.7`. Record `mnozstvi_status` = the formula + `OVĚŘIT`. Where **no geometry exists** (S08 area never attributed in the řez/per-zone; vjezd plocha absent from the situace), use **strict `mnozstvi: null`** + `status: "neurčeno"` + a vyjasnění — **never a guessed number**.

**Test:** can you write the qty as a formula over *measured* inputs? **Yes → estimate + OVĚŘIT. No → null.**

### Invariant
Every numeric quantity not taken verbatim from PD has a geometric `qty_formula` over measured inputs; quantities with no derivable geometry are `null`, not estimated. "Estimate from known geometry ≠ hallucination; no geometry → null."

### Related
- Pattern 26 (Honest fallback hierarchy for missing data)
- Pattern 41 (OVĚŘIT-flagging of judgment quantities)
- Pattern 2 (Audit trail — formula mandatory)

---

## Pattern 45: Výměry-First — measurement register before the work list

**Source:** RD Jáchymov Výměry-First task (2026-06-01); anti-pattern caught live in the sklad audit (21.2 vs 17.6).

### Problem
When `mnozstvi` is attached ad-hoc to each work item, quantities **float**: the same physical element gets two different areas in two items (sklad floor: 21.2 m² footprint in štěrk/lože vs 17.6 m² DXF inner room in dlažba), and there is no single place that says "this element measures X". Mismatch is invisible until someone adds the numbers.

### Principle
Measure **first**, derive the work list **from** the measurements:
```
1. VÝMĚRY register  — every plocha/objem/délka/výška, tagged measured / derived / estimate / blank
2. Work list DERIVED from the výměry
3. Each work qty → REFERENCES a výměra row   (never an independently-invented number)
```
The register is the **single source** for quantities; a work item's `mnozstvi` is a *pointer* into it (+ a `qty_formula` if derived). Where no výměra exists, the qty is `null` (Pattern 44), not invented.

### Universal (Pattern 16 corollary, one layer earlier)
One pipeline for every object; only the **unit of measure** changes: room → `místnost` (plocha/výška); bridge → `prvek` (objem/bednění/výška); hala → `konstrukce` (plocha/rozpon); opěrná zeď → `úsek` (délka/výška/líce). The výměry-register schema is shared; only its rows differ.

### Invariant
Every numeric `mnozstvi` either references a single výměra row (one element = one area) or is `null`. No two work items carry conflicting quantities for the same physical element. The register tags each výměra `measured / derived / estimate / blank`.

### MCP corollary
Výměry-First is the missing deterministic MCP stage: `host-vision → VÝMĚRY register → validate → work breakdown derived from výměry → montáž/materiál split (Pattern 41)`. Makes qty come from measurements deterministically, not from the air.

### Anti-pattern
"podlaha 21 m²" as a single floating line; or the same element measured 21.2 in one item and 17.6 in another (sklad). Quantities invented per-item with no shared register.

### Related
- Pattern 41 (Full Decomposition / montáž-materiál split) — *downstream*: each derived work is decomposed; both legs' qty trace back here
- Pattern 44 (Geometry-bounded estimate vs strict null) — how a výměra is tagged estimate vs blank
- Pattern 16 (Universal Work Ontology) — same universality, one layer later (works); Pattern 45 is the measurement layer
- Pattern 40 (Host-delegated vision + MCP gate) — vision feeds the výměry register
- Pattern 31 (CEV) — extraction completeness feeds the register

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

### ❌ Pattern number guessing — assigning a pattern number from chat / memory
**Why:** Whoever (agent or human) "remembers" the next number is wrong sooner or later. Two sessions adding patterns in parallel both pick "the next one" → duplicate numbers. A session interrupted mid-add → gap. The numbering then drifts and every cross-reference in the file body silently rots.

Recurring HK212 / RD Jáchymov incidents that motivated this entry:
- "Add Pattern 8" requested twice in different sessions for unrelated content (Door-vs-Gate Classification + Re-read TZ Before Generating Položky) — recovered by promoting one to Pattern 9 after audit
- Patterns 15 + 16 (Work-First / Universal Work Ontology) initially recorded as 12 + 13 in a session that didn't read the file first — re-numbered during PR review
- General "I'll just call it Pattern N" without grepping the file → repeated each ~3 sessions

**Instead — mandatory ritual when adding a pattern:**
1. Read the header block at top of this file → note `last_number`.
2. `grep -nE '^## Pattern [0-9]+:' docs/STAVAGENT_PATTERNS.md | tail -5` to visually confirm.
3. Use `last_number + 1`. Bump the header in the same commit.
4. Never trust a pattern number quoted in chat / commit message / memory without re-grepping.

The numbering invariant — sequential 1..N, no duplicates, no gaps — is cheap to maintain and expensive to fix retroactively (every `see Pattern N` cross-reference has to be hand-walked).

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
- HK212 hala pilot: `test-data/hk212_hala/` — Pattern 8 source + full Phase 1 etap1 pipeline
