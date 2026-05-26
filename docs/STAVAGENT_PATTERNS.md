# STAVAGENT Product Patterns

<!--
Pattern numbering audit 2026-05-26:
Sequential 1..16 validated (no duplicates, no gaps).
last_number: 16
next_pattern: 17  ← use this for any new additions.

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
