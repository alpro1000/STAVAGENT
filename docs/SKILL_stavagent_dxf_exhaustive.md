---
name: stavagent-dxf-exhaustive
description: >-
  Закодифицировать обязательную exhaustive DXF extraction в STAVAGENT pipeline.
  Использовать ВСЕГДА когда DXF/DWG файлы в context'е и работа касается:
  rozpočtu, výkazu výměr, soupisu prací, items.json generování, plocha/qty
  extraction, Phase 0b processing, validation pipeline, comprehensive extraction.
  Активировать при словах: DXF, DWG, výkres, půdorys, exhaustive extract,
  comprehensive extract, plocha místností, qty extraction, Phase 0b discipline,
  rozpočet, výkaz výměr, soupis, items.json. Гарантирует maximum extraction всех
  entity types (LWPOLYLINE, DIMENSION, INSERT, HATCH, MTEXT, LINE) с canonical
  output schema před Phase 1.
---

# STAVAGENT exhaustive DXF extraction

## Когда активировать

Skill **автоматически** активируется когда в session detected:
- DXF или DWG file references (.dxf, .dwg extensions)
- Работа в `test-data/*/inputs/vykresy_dxf/`
- Phase 0b §3.3 workflow
- Phase 1 items.json generation pre-step
- Comprehensive extraction language
- Слова "rozpočet", "výkaz výměr", "qty extraction", "plocha"

## CRITICAL POLICY

> **DXF файлы это deterministic goldmine. ALWAYS extract ALL entity types exhaustively. NIKDY partial extraction. NIKDY only-specific-vyjasneni extraction.**

Это lesson z N=5 RD Jáchymov pilot kde Phase 0b §3.3 extract'нул только specific dimensions потому что только tо bylo požadováno pro vyjasnění #18. Tо bylo wrong pattern. Fix v N=6+ через tento skill.

## Mandatorní algorithm

Per project (NE per file — merge všech DXF files v project's `inputs/vykresy_dxf/` directory):

### 1. Místnosti (LWPOLYLINE closed)

```python
for entity in dxf.modelspace().query("LWPOLYLINE"):
    if entity.is_closed:
        area_m2 = shoelace_area(entity.vertices) / 1_000_000  # mm² → m²
        nearest_mtext = find_nearest_mtext(entity.centroid, max_distance_mm=500)
        podlazi = infer_podlazi(entity, mtext, layer_name)
        # append to mistnosti[]
```

### 2. Otvory (INSERT blocks)

Pattern dictionary (extendable):
```python
PATTERNS = {
    "okno.*": "okna",
    "dvere.*": "dvere",
    "WC.*": "wc",
    "umyvadlo.*": "umyvadlo",
    "sprcha.*": "sprcha",
    "vana.*": "vana",
    "drez.*|kuchyne.*": "drez_kuchyne",
    "kamna.*": "kamna",
    "krb.*": "krb",
    "radiator.*|topeni.*": "radiator",
    "TC.*|jednotka.*TC.*": "vnitrni_jednotka_TC",
    "zasuvka.*": "zasuvka",
    "svitidlo.*": "svitidlo",
    "rozvadec.*": "rozvadec",
    "KR$|krokev.*": "krokev",
    "sloupek.*|jekl.*": "sloupek_jekl",
    "klestiny.*": "klestiny",
    "schod.*": "schodiste",
    "vikyr.*": "vikyr",
}
```

Per INSERT, match `entity.dxf.name` against patterns. Count per category. Split per-podlaží by Y-coordinate clustering nebo layer name.

### 3. Stěny délky (LINE + POLYLINE)

Per layer matching `stena|zdivo|pricka|obvod|wall`:
- Σ length všech LINE entities (`entity.dxf.start` → `entity.dxf.end` Euclidean)
- Σ length všech LWPOLYLINE entities (vertices Euclidean sum)
- Split per layer category (obvodové vs vnitřní nosné vs příčky)
- Split per podlaží by layer name clustering

### 4. HATCH per material

```python
hatch_groups = defaultdict(float)
for entity in dxf.modelspace().query("HATCH"):
    pattern_name = entity.dxf.pattern_name  # např. "ANSI31", "SOLID", "BRICK"
    area = compute_hatch_area(entity)
    hatch_groups[pattern_name] += area
```

Filter out wall hatching (typically magnitude < 5 m² OR specific patterns "BRICK"/"CONCRETE").

### 5. DIMENSION extraction

```python
dimensions = []
for entity in dxf.modelspace().query("DIMENSION"):
    try:
        value_mm = entity.get_measurement()
        dimensions.append({
            "value_mm": value_mm,
            "layer": entity.dxf.layer,
            "location_xy": entity.dxf.defpoint,
            "file": current_dxf_filename
        })
    except Exception:
        continue
```

### 6. MTEXT/TEXT semantic labels

```python
labels = []
for entity in dxf.modelspace().query("MTEXT TEXT"):
    text = entity.plain_text() if entity.dxftype() == "MTEXT" else entity.dxf.text
    labels.append({
        "text": text,
        "position": entity.dxf.insert,
        "layer": entity.dxf.layer,
    })
```

Classify labels:
- Room names ("obytná místnost", "kuchyně", "koupelna", atd.)
- Skladby identifiers (S-01, S-02, F-12)
- Material specs (vinyl, dlažba, dlažba 30×30)
- Room numbers (M.01, 2.04)

## Output canonical schema

Filename: `outputs/dxf_comprehensive_extract.json`

```json
{
  "_extraction_summary": {
    "dxf_files_processed": 4,
    "total_entities": N,
    "timestamp": "ISO8601",
    "ezdxf_version": "1.4.4"
  },
  "mistnosti": [
    {
      "label": "obytná místnost",
      "area_m2": 24.8,
      "perimeter_bm": 20.1,
      "podlazi": "1.NP",
      "confidence": 0.95,
      "source_file": "dum_DPZ.dxf",
      "lwpolyline_handle": "5A"
    }
  ],
  "otvory": {
    "okna": [
      {"block_name": "okno_2NP", "count": 4, "podlazi": "2.NP", "strana": "ulice", "width_mm": 1500}
    ],
    "dvere": [
      {"block_name": "dvere_vnitrni", "count": 12, "podlazi": "all"}
    ],
    "vstupni_dvere": [
      {"count": 2, "location": "Fibichova"}
    ]
  },
  "sanitarni": [
    {"prvek": "WC", "count": 3, "per_podlazi": {"1.NP": 1, "2.NP": 1, "3.NP": 1}}
  ],
  "vytapeni": [...],
  "eli": [
    {"prvek": "zasuvka", "count": 0, "_note": "not in DSP DXF, expected"}
  ],
  "konstrukce": {
    "krokve": {"count": 111, "avg_length_mm": 4200, "total_bm": 466},
    "sloupky_jekl": {"count": 6},
    "klestiny": {"count": 0, "_note": "check separate block"},
    "vikyre": {"count": 4}
  },
  "schodiste": [...],
  "steny": {
    "per_podlazi": [
      {"podlazi": "1.NP", "obvodove_bm": 38.4, "vnitrni_nosne_bm": 12.2, "pricky_bm": 28.6, "total_bm": 79.2}
    ],
    "total_bm_all_floors": N
  },
  "plochy_podlah_per_material": [
    {"material": "vinyl", "m2": 89.4, "source": "HATCH pattern 'vinyl_hatch'"}
  ],
  "obvody_objektu": [
    {"podlazi": "1.NP", "external_perimeter_m": 42.5}
  ],
  "strecha": {
    "pudorysna_plocha_m2": N,
    "plocha_krytiny_sklon_35deg_m2": N,
    "obvod_okapu_bm": N,
    "pocet_rohu_pro_svody": N
  },
  "dimensions_all": [...]
}
```

## Mandatorní items.json upgrade

Po extraction, **immediately** update items.json:

```python
for item in items_json:
    dxf_qty = find_dxf_match(item, dxf_extract)
    if dxf_qty and dxf_qty["confidence"] >= item.get("mnozstvi_confidence", 0):
        item["mnozstvi"] = dxf_qty["value"]
        item["mnozstvi_confidence"] = dxf_qty["confidence"]
        item["_source"] = f"DXF exhaustive extraction {today}"
        item["_dxf_upgrade"] = True
    else:
        item["_dxf_extraction_status"] = "not_in_dxf"
```

Commit message format:
```
feat: DXF exhaustive extraction — X items upgraded, avg conf change +0.Y
```

## Forbidden behaviors

- ❌ Extract only specific dimensions pro specific vyjasnění
- ❌ Skip HATCH analysis pro plochy podlah
- ❌ Not match INSERT blocks against patterns dictionary
- ❌ Report "could not extract X" without trying canonical algorithm
- ❌ Use TZ-derived qty (0.75) when DXF deterministic value (0.95) available
- ❌ Per-DXF-file output instead of merged single canonical JSON
- ❌ Silent fallback to TZ value without `_dxf_extraction_status` annotation

## Canonical script reference

Seed script: `test-data/RD_Jachymov_dum/tools/phase0b_dxf_extractor.py` (310 LOC, N=5 pilot baseline — only-vyjasneni-specific, **needs extension** pro exhaustive coverage).

Target migration: `concrete-agent/app/parsers/dxf_exhaustive_extractor.py` (canonical reusable, post-N=6+).

Mezitím per-pilot: rozšířit phase0b_dxf_extractor.py o všechny entity categories listed v "Mandatorní algorithm" section.

## Acceptance criteria pre phase1_gate_open

- `outputs/dxf_comprehensive_extract.json` exists s ≥ 10 categories filled
- ≥ 80% items v items.json have either DXF-derived qty OR explicit `_dxf_extraction_status: "not_in_dxf"`
- Commit message lists upgrade count + avg conf change
- No silent fallbacks
