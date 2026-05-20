# TASK: HK212 Phase 2.1 — Audit Trail Extraction (TZ + Výkresy → per-item formula + lokalizace + reference)

**Project:** STAVAGENT / HK212 hala
**Branch:** `claude/hk212-phase-2-1-audit-trail`
**Předchozí kroky:** Phase 1 etap 1 + URS cache rematch + Phase 2 KROS export (already done)
**Cíl:** Pro každý item v `items_hk212_etap1.json` extrahovat z PD dokumentace **lokalizaci, výpočet množství, vstupní rozměry, referenci na výkres a poznámku z TZ**. Output → rozšířený Excel s audit trail columns dle STAVAGENT canonical (formula + inputs + steps + confidence).
**Effort:** 4-6h coding session
**Coding:** Python; volá Gemini Flash (Vertex AI) pro TZ; ezdxf pro DXF parsing; offline po extraktion (kromě AI calls).

---

## §0 SITUACE

### Vstupy (vše v `test-data/hk212_hala/inputs/`)

**TZ folder (`tz/`):**
| Soubor | Obsah | Priorita |
|---|---|---|
| `01_ars_pruvodni_A.pdf` | Průvodní zpráva (A) | low — general info |
| `02_ars_souhrnna_B.pdf` | Souhrnná technická zpráva (B) | **high** — celkový popis stavby |
| `03_ars_d11_TZ.pdf` | D.1.1 Architektonicko-stavební řešení | **high** — architektura, místnosti, povrchy |
| `04_statika_d12_TZ_uplna.pdf` | D.1.2 Statika TZ | **CRITICAL** — ocelové prvky kg, výztuž, materiály |
| `05_konstrukce_titul.pdf` | D.1.3 Konstrukce — titulní | medium |
| `06_zaklady_titul.pdf` | D.1.6 Základy — titulní | **high** — patky, pasy, piloty |
| `07_pbr_kpl.pdf` | D.1.7 PBŘ (požární bezpečnost) | medium — pro PBŘ items |

**Situační výkresy (`situace/`):**
- `C1_sirsi_vztahy.pdf`, `C2_katastr.pdf`, `C3_situace_kaceni.pdf`

**Stavební výkresy (`vykresy_pdf/` + `vykresy_dxf/`):**
| Code | Obsah | Mapping na items |
|---|---|---|
| A100 úvod | Legenda, klíč | reference |
| **A101 půdorys 1NP** | Layout, místnosti, plocha | HSV-1 podlahy, PSV-77x stěrky, PSV-76x dveře/okna |
| A102 půdorys střechy | Střešní krytina, odvodnění | PSV-78x klempířské, krytina |
| A103 řez AB | Výška budovy, materiály vrstev | HSV-3 ocelové konstrukce výška, PSV-71x izolace |
| A104 pohledy | Fasáda, otvory | PSV-76x okna |
| **A105 základy** | Patky, pasy, piloty | HSV-2 základy (CRITICAL pro VARIANTA pilot vs patky) |
| A106 stroje | Mechanická zařízení | M (elektromontážní), VZT |
| A107 stroje_kotvící body | Kotvení strojů do základů | M, kotvy HSV-3 |
| A201 výkopy | Zemní práce | HSV-1 (skládkovné, doprava, nakládání) |

**DXF vs PDF priorita:**
- DXF — strojově čitelný text (rozměry jako TEXT entities, layery), použij **PRIMARY** pro extrakci rozměrů
- PDF — vizuální layout, použij Gemini Flash multimodal **FALLBACK** + cross-check pro DXF

**Items soubor:**
`test-data/hk212_hala/outputs/phase_1_etap1/items_hk212_etap1.json` — 141 items po Phase 2 merge.

### Cílový schema audit trail (per item)

Přidat do každého item nový blok:
```
"audit_trail": {
  "lokalizace": "Hala A, sloupy řady 1-A až 6-A, místnost 1.01",
  "formula": "6 sloupů × 1.5m × 1.5m × 4 strany bednění × 1.0m výška = 54.0 m²",
  "inputs": [
    {"rozmer": "rozteč sloupů", "value": "6m", "source": "A101 řez B-B"},
    {"rozmer": "rozměr patky", "value": "1.5×1.5×1.0m", "source": "A105 detail D1"}
  ],
  "reference": [
    {"document": "vykresy_pdf/A105_zaklady.pdf", "list": "1", "rez": "B-B", "page": 2},
    {"document": "tz/06_zaklady_titul.pdf", "section": "§3.2 Patky", "page": 5}
  ],
  "poznamka": "Patky vyztuženy B500B Ø12 á 150 mm v obou směrech; krytí výztuže 50 mm dle TZ §3.2.4",
  "computed_quantity": 54.0,
  "declared_quantity": 54.0,
  "match_delta_pct": 0.0,
  "confidence": 0.95,
  "extraction_method": "tz_dxf_cross_ref",
  "extracted_at": "2026-05-14T..."
}
```

---

## §1 MANTRA

1. **Než začneš ANY kód:** `view` na:
   - `items_hk212_etap1.json` — verify field names, schema
   - `meta/inventory.md` + `meta/project_header.json` — context (project name, scope, dimensions)
   - `app/services/` — najdi existující extractors (Vertex AI / Gemini wrappers, MinerU calls, PDF parsing helpers). **Встройся**, ne dupliciruj.
   - `app/api/perplexity_connector.py` — pattern jak repo volá AI providers
   - Sample `tz/04_statika_d12_TZ_uplna.pdf` + `vykresy_dxf/A105_zaklady.dxf` (PDF view, DXF text dump) aby viděl co reálně tam je
2. **Determinism > AI:**
   - DXF text parsing (deterministický) PŘED Gemini OCR
   - Regex pro standard formats (rozměry typu `1500x1500`, `Ø600`, `6×1.5m`) PŘED LLM
   - Gemini jen kde regex/DXF nestačí
3. **Confidence ladder per STAVAGENT canonical:**
   - DXF TEXT entity match → 0.95
   - PDF Gemini Flash extract + cross-check s DXF → 0.85
   - PDF Gemini Flash only → 0.70
   - TZ section reference only (no quantity verified) → 0.60
   - Reconstructed from URS code defaults (no PD source) → 0.40
4. **Pre-implementation interview povinný** (§3).
5. **Naming, file structure, deps — výhradně per existing repo conventions.**

---

## §2 ARCHITEKTURA

### Pipeline (3-stage, každý stage idempotent + cache)

```
Stage A: TZ Extraction
  tz/*.pdf → Gemini Flash multimodal → tz_extracted.json
  - per-document sectioning
  - per-section key facts: lokalizace, materiály, rozměry, kg/m³/m² totals
  - cite: page number + section number

Stage B: Výkres Extraction
  vykresy_dxf/*.dxf → ezdxf parser → drawing_geometry.json (deterministic)
    - TEXT entities (dimension callouts, labels)
    - DIMENSION entities (real measurements)
    - layers (e.g. "ZAKLADY", "OSY", "KOTY", "POPIS")
  vykresy_pdf/*.pdf → Gemini Flash multimodal → drawing_visual.json (OCR fallback)
    - visual layout interpretation
    - cross-reference with DXF dimensions
  Merge → drawings_extracted.json

Stage C: Item-to-Source Mapping
  Per item in items_hk212_etap1.json:
    1. Identify which TZ sections relevant (keyword search v tz_extracted)
    2. Identify which výkresy relevant (mapping table §0 + keyword match)
    3. Extract dimensional inputs from drawings_extracted
    4. Reconstruct formula
    5. Verify: computed quantity vs declared mnozstvi (±5% tolerance)
    6. Assemble audit_trail block
    7. Calculate confidence per ladder

Output: items_hk212_etap1.json updated in-place + backup
        + audit_trail_report.md (statistics)
        + Extended HK212_Soupis_praci.xlsx with audit columns M-Q
```

### AI usage budget

- TZ: 7 PDFs × Gemini Flash multimodal = ~7 API calls = $0.5-2 odhad
- Výkresy: 8 PDFs × Gemini Flash = ~8 API calls = $0.5-2
- Cross-mapping (Stage C): per-item, ~141 calls × Claude Sonnet (Bedrock) for reasoning = $5-15
- **Max budget: $25** per full run. Cache results → re-run cheap.

### Provider chain

Per STAVAGENT memory:
1. **Gemini Flash (Vertex AI)** primary — multimodal PDF read
2. **Claude Sonnet (Bedrock fallback)** — for complex reasoning steps in Stage C
3. **Perplexity** — only if external technical references needed (e.g. material density tables)

Use existing repo abstraction layer if exists (`app/ai/ai_reasoner.py` per memory).

---

## §3 PRE-IMPLEMENTATION INTERVIEW

Před první řádkou kódu zeptej Александra:

1. **AI provider config:**
   - Existing `app/ai/ai_reasoner.py` uses what? GCP credentials, AWS Bedrock keys etc.?
   - Where are credentials (`.env`, GCP service account JSON)? Existují already nebo treba setup?
2. **Run mode:**
   - **Full pipeline** all 3 stages (Stage A + B + C) — ~$25, full audit trail
   - **Stage A + C only** (skip DXF, use Gemini Flash on PDFs only) — $10, lower confidence ale rychlejší
   - **Dry-run** — print plan, no AI calls, no $
3. **Items scope:**
   - All 141 items
   - Only 80 matched_high + matched_medium (skip needs_review + custom — те už čekají na Александrův KROS top-up anyway)
   - Only specific kapitoly (HSV-2 + HSV-3 priority — největší kg/m² + nejvyšší cena)
4. **Match tolerance:**
   - Strict ±2% computed vs declared quantity → flag as mismatch
   - Loose ±10% → tolerate
   - Recommend: ±5% (catches real errors, allows for rounding/náběh)
5. **Output formats:**
   - Update Excel only (extend `HK212_Soupis_praci.xlsx`)
   - Update Excel + companion `HK212_audit_trail_review.xlsx` (only red/yellow rows for manual sprint)
   - Update Excel + JSON only (no companion)
6. **DXF dependency:**
   - Install `ezdxf` (recommend, ~5MB, pure Python)
   - Or skip DXF parsing entirely (Gemini Flash only) — lower confidence ale méně závislostí
7. **Stage A persistence:**
   - Save `tz_extracted.json` v `test-data/hk212_hala/outputs/phase_2_1/cache/` (recommend — re-run rematch atd. nepotřebuje znovu volat AI)
   - In-memory only, žádný cache

---

## §4 BUSINESS LOGIC — STAGE A: TZ EXTRACTION

### Per-document workflow

For each PDF in `tz/`:
1. Open PDF
2. Pošli Gemini Flash multimodal s prompt template (Czech):
   ```
   Toto je technická zpráva stavebního projektu HK212 hala (Rožmitál). 
   Extrahuj následující informace strukturovaně v JSON:
   - sections: pole sekcí s {section_number, section_title, content_summary, page_range}
   - lokalizace_facts: kde co je (místnosti, řady, osy, podlaží)
   - materialy: použité materiály s třídami (např. "B500B Ø12", "C30/37 XC4", "S235 J0")
   - rozmery: zmínky o rozměrech v textu (např. "patka 1500×1500×1000 mm")
   - kg_totaly: kg ocele, výztuže atd. pokud zmíněno
   - povrchove_upravy: nátěry, izolace, krytí
   - referenced_vykresy: zmínky o výkresech (A101, A105 atd.)
   Odpověz pouze validním JSON, žádný preamble nebo markdown.
   ```
3. Parse response → validate JSON shape
4. Append to global `tz_extracted` dict s `{filename: parsed_data}`
5. Save consolidated `tz_extracted.json`

### Error handling
- Gemini timeout → exponential backoff 3 retries
- Invalid JSON response → try once with `response_format: {"type": "json_object"}` flag
- Empty section → flag as `extraction_failed: true`, skip but continue

---

## §5 BUSINESS LOGIC — STAGE B: VÝKRES EXTRACTION

### B1: DXF parsing (deterministic)

For each `vykresy_dxf/*.dxf`:
1. `doc = ezdxf.readfile(path)`
2. `msp = doc.modelspace()`
3. Collect:
   - TEXT entities: `{text, position, layer, height, rotation}`
   - MTEXT entities (multiline): same
   - DIMENSION entities: `{measurement, dim_type (linear/aligned/radius), defpoints}`
   - INSERT entities (block references): `{block_name, position, attrs}` — often callouts/symbols
4. Group by layer (typical Czech layers: `KOTY`, `POPIS`, `OSY`, `ZAKLADY`, `OCEL`, `VYZTUZ`)
5. Build searchable index: regex patterns for dimension formats:
   - `\d{3,5}` (raw mm: 1500, 12000)
   - `\d{3,5}\s*[×x]\s*\d{3,5}` (1500×1500)
   - `Ø\s*\d{2,4}` (Ø600)
   - `\d{2,3}\s*[×x]\s*\d{1,2}\s*[×x]\s*\d{1,2}` (profil 200×10×8)
   - Czech labels: `P\d+` (P1, P2 = patky), `S\d+` (sloupy), `osa [A-Z]`, `řada \d`

### B2: PDF visual extraction (fallback for vykresy without DXF or for verification)

For each `vykresy_pdf/*.pdf`:
1. Send to Gemini Flash multimodal s prompt:
   ```
   Toto je stavební výkres {filename} z projektu HK212 hala.
   Identifikuj a vrať jako JSON:
   - drawing_type: pudorys/rez/pohled/detail
   - scale: měřítko (např. "1:50")
   - dimensions: pole rozměrů viditelných na výkresu s {value, unit, label_if_present, approx_location}
   - labels: identifikátory (P1, S1, osa A, řada 1)
   - cross_references: zmínky jiných výkresů ("viz A105", "detail D1")
   - title_block_info: list, datum, autor pokud čitelné
   ```
2. Parse + validate

### B3: Merge & cross-validate

For each drawing that has BOTH DXF + PDF:
- DXF dimensions = ground truth
- PDF dimensions = sanity check
- Conflicts → flag, prefer DXF
Save consolidated `drawings_extracted.json`.

---

## §6 BUSINESS LOGIC — STAGE C: ITEM-TO-SOURCE MAPPING

For each item in `items_hk212_etap1.json`:

### C1: Determine relevant výkresy + TZ sections

Use static mapping table (§0) + keyword search:
- Item.kapitola `HSV-1` → výkresy `A101, A105, A201` + TZ `02_souhrnna, 06_zaklady`
- Item.kapitola `HSV-2` → výkresy `A105` + TZ `04_statika, 06_zaklady`
- Item.kapitola `HSV-3` → výkresy `A103, A105` + TZ `04_statika, 05_konstrukce`
- ...
- Plus keyword fallback: search item.popis tokens in tz_extracted full-text → identify additional sections

### C2: Extract dimensional inputs

Based on item.popis + item.mj:
- Item `Bednění základů patek` + MJ `m²` → search drawings for patek rozměry × počet × 4 strany
- Item `Výztuž základové desky KARI síť Ø8 100×100 B500B horní vrstva` + MJ `kg`:
  - Extract: rozměry desky from A101 půdorys
  - Extract: hmotnost KARI sítě per m² (standardní hodnota = 5.0 kg/m² for Ø8 100×100) — from URS catalog norms via existing knowledge base if exists
  - Formula: `plocha × kg/m² × overlap_factor`

### C3: Reconstruct formula

Build formula string (Czech labels):
```
Bednění základů patek = 6 patek × (1.5 m + 1.5 m + 1.5 m + 1.5 m) × 1.0 m výška = 36.0 m²
```

Save inputs as structured array (per §0 audit_trail schema).

### C4: Verify computed vs declared

- `computed_quantity` from formula
- `declared_quantity` from item.mnozstvi
- `match_delta_pct = abs(computed - declared) / declared * 100`
- Match tier:
  - ≤ tolerance (§3 q4) → green, confidence boost
  - within 2× tolerance → yellow
  - > 2× tolerance → red, flag for manual review (likely error in declared OR in extraction)

### C5: Assemble audit_trail block

Build per-item dict per §0 schema. Use Claude Sonnet (Bedrock) for complex reasoning where regex/lookup fails:
- Item involves multiple drawings (cross-reference reasoning)
- Item has ambiguous popis (decide which source applies)
- Formula not obvious from inputs (e.g., výztuž piloty s třmínky)

Claude Sonnet prompt template:
```
Item: {item.popis} (MJ: {item.mj}, deklarované množství: {item.mnozstvi})
Relevantní TZ excerpts: {tz_sections}
Relevantní výkres rozměry: {drawing_dims}
Existující URS match: {item.urs_code} ({item.match_path})

Rekonstruuj výpočet množství tohoto item. Vrať JSON:
- lokalizace: string
- formula: čitelný matematický výraz s jednotkami
- inputs: pole {rozmer, value, source}
- reference: pole {document, list_section_or_page}
- poznamka: kontext z TZ
- computed_quantity: number
- confidence: 0.0-1.0 self-assessment
```

---

## §7 BUSINESS LOGIC — STAGE D: EXCEL EXTENSION

Extend existing `export_kros.py` (commit `3fc9ffa4`). NEpisat nový skript — modify existing.

### Add columns M-Q

| Col | Header | Source | Width |
|---|---|---|---|
| M | Lokalizace | `audit_trail.lokalizace` | 30 |
| N | Výpočet | `audit_trail.formula` | 50 |
| O | Vstupy | `audit_trail.inputs` (formatted as bulleted text) | 35 |
| P | Reference | `audit_trail.reference` (formatted "{doc} §{section}") | 25 |
| Q | Poznámka | `audit_trail.poznamka` | 40 |

Additional color coding rules:
- `match_delta_pct ≤ tolerance` AND `confidence ≥ 0.85` → green (#C6EFCE)
- `match_delta_pct ≤ 2×tolerance` OR `confidence 0.60-0.85` → yellow (#FFEB9C)
- Otherwise → red (#FFC7CE) — manual review needed

Companion file `HK212_audit_trail_review.xlsx` filters only yellow + red rows.

---

## §8 ACCEPTANCE CRITERIA

### Po session

1. Stage A produces valid `tz_extracted.json` with all 7 TZ docs parsed (or graceful failures logged)
2. Stage B produces valid `drawings_extracted.json` with all DXF + PDF parsed
3. Stage C: per-item audit_trail block exists for ≥90% items (custom_item items skipped expectedly)
4. Stage D: Extended Excel opens correctly in Excel 365 + LibreOffice
5. **At least 50 items have computed_quantity within tolerance of declared_quantity** — proves system works
6. Color coding visible
7. CLI per repo conventions:
   - `--stage A|B|C|D|all`
   - `--items-scope all|matched|kapitola`
   - `--dry-run`
   - `--tolerance 0.05`
   - `--use-cache` (default true)
8. Tests: each stage testable independently with fixture data, no real AI calls in tests
9. Cost tracking: print total API spent at end ("Gemini: $X.XX, Claude: $Y.YY")

### Po Александrově review

1. Open extended Excel — see formulas + lokalizace populated
2. Spot-check 10 random matched items: formula makes physical sense vs popis + výkres
3. Open companion review file — manageable list (~20-40 rows max for manual sprint)

---

## §9 STOP GATES

1. Existing AI provider abstraction nefunguje (no credentials, no key, network issues) → STOP, configure first
2. Stage A: > 30% TZ extractions fail → diagnose Gemini access vs PDF quality (some PDFs may be scanned, need MinerU OCR first)
3. Stage B: ezdxf install fails on Windows → fallback to PDF-only mode (flag user)
4. Stage C: > 50% items end with no audit_trail (extraction failures cascading) → diagnose mapping logic
5. Cost overrun: API spend > 2× budget → STOP, ask user before continuing
6. Computed quantity matches declared for < 20% items → systematic extraction bug, STOP investigate

---

## §10 OUT-OF-SCOPE

- Auto-generate prices (still KROS subscription only)
- Auto-fill needs_review URS codes (already manual sprint planned)
- DWG parsing (binary format, use DXF instead)
- 3D models / BIM IFC
- Cross-validation s donor projects (Žihle, Tremosna) — separate later task
- Auto-update PD docs (read-only extraction)

---

## §11 NAMING & PR DISCIPLINE

- **Branch:** `claude/hk212-phase-2-1-audit-trail`
- **Commits:** push origin po každé stage (A, B, C, D)
- **PR:** NE-otevírat
- **File naming:** existing `app/services/` patterns
- **Cache files:** `test-data/hk212_hala/outputs/phase_2_1/cache/` (gitignored if large)
- **Output files:** `test-data/hk212_hala/outputs/phase_2_1/` (committed)

---

## §12 HANDOFF MESSAGE (Claude Code → Александр)

Po session completion:

1. Branch + commits
2. Run commands per stage + full pipeline
3. Output files paths
4. **Match statistics:** % items with audit_trail, % within tolerance, % needs review
5. **Cost incurred:** Gemini $X, Claude $Y, total $Z (vs budget $25)
6. Top 5 highest-quantity items audit trail (sanity check for Александр)
7. Top 5 items where computed ≠ declared (suspicious, manual review)
8. Next steps:
   - Manual sprint in KROS for needs_review items (parallel work — separate task)
   - Final consolidation after manual sprint: `apply_manual_codes.py` re-export

---

**Naming, file structure, deps — výhradně z existujících konvencí v repu. Встройся.**

**END OF TASK.**
