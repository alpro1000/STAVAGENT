# Phase Π.0a Foundation Extraction Layer — SPEC

**Status**: draft (Π.0 Part 2 deliverable — pending user approval)
**Branch target**: `claude/update-session-docs-Q4PwS` (or new feature branch per user)
**Estimated effort**: ~18 h across 7 phased steps
**Coverage**: A / B / C / D + shared (full komplex; 129 source files, 935 rooms)

---

## 1. Goal

Build a single source-of-truth extraction layer that:

1. Reads all DWG / PDF / XLSX directly from `sources/{A,B,C,D,shared}/`.
2. Outputs one canonical JSON per objekt: `master_extract_{A,B,C,D}.json`.
3. Has objekt-agnostic code from day 1 (`--objekt={A,B,C,D}` CLI flag).
4. Records every field with `source` (file + locator) + `confidence`
   (1.0 literal / 0.95 derived / 0.7 inferred).
5. Is idempotent: re-extraction yields byte-identical output.
6. Replaces the reactive Phase 0.x hot-fix sprawl (10 scripts, 0.10–0.20)
   with one orchestrated pipeline.
7. Surfaces literal source values where today's pipeline used heuristics
   (e.g. door RC/EMZ/ACS spec from Tabulka 0041, DXF DIMENSION heights).

Out of scope for Π.0a (deferred to later passes):
- Re-running Phase 1+ generators against Π.0 output (separate cut-over)
- Touching the existing PR #1066 D-deliverable (additive layer only)
- Section-drawing height parsing (G4) — deferred per priority order
- Drainage / hatch parsing (G7–G13) — deferred

---

## 2. master_extract_{objekt}.json schema

### 2.1 Top-level structure

```jsonc
{
  "$schema": "https://stavagent.cz/schemas/master_extract.v1.json",
  "metadata": {
    "objekt": "A|B|C|D",
    "extracted_at": "2026-05-07T08:42:00Z",  // ignored by idempotency check
    "extractor_version": "0.0.1",
    "source_files": [
      {"path": "sources/A/dwg/...", "sha256": "...", "kind": "dxf"},
      {"path": "sources/shared/xlsx/...0020...xlsx", "sha256": "...", "kind": "xlsx"},
      ...
    ],
    "schema_version": 1
  },

  "rooms": [...],              // §2.2
  "walls": [...],              // §2.3 (skladby per room — wall_segment_tags)
  "openings": [...],           // §2.4 (doors + windows + glass partitions)
  "skladby": {...},            // §2.5 (FF/F/CF/RF/WF/OP/LI/LP/TP catalogues)
  "doors": [...],              // §2.6 (Tabulka 0041 full rows)
  "windows": [...],            // §2.7 (Tabulka 0042 full rows — currently 0%)
  "glass_partitions": [...],   // §2.8 (Tabulka 0043)
  "locksmith": [...],          // §2.9 (Tabulka 0050)
  "sheet_metal_TP": [...],     // §2.10 (Tabulka 0060)
  "lintels": [...],            // §2.11 (Tabulka 0070)
  "others_OP": [...],          // §2.12 (Tabulka 0080)
  "segment_counts": {...},     // §2.13 (DXF tag census per drawing)
  "footprint_areas": {...},    // §2.14 (per-podlaží + façade + roof areas)
  "legacy_vv": {...},          // §2.15 (Vykaz_vymer_stary, scoped to objekt)

  "warnings": [...],           // §2.16 (extraction-time issues, non-fatal)
  "validation": {...}          // §2.17 (DXF↔Tabulka cross-check results)
}
```

### 2.2 `rooms[]` — per-room geometry + finish spec

```jsonc
{
  "code": "A.1.1.01",
  "objekt": "A",
  "podlazi": "1.NP",
  "byt_or_section": "1.1",
  "mistnost_num": "01",
  "nazev": {
    "value": "OBÝVACÍ POKOJ",
    "source": "XLSX|shared/xlsx/...0020...|tab_mistnosti|row=42,col=2",
    "confidence": 1.0
  },
  "plocha_m2": {
    "value": 19.31,
    "source": "XLSX|shared/xlsx/...0020...|tab_mistnosti|row=42,col=3",
    "confidence": 1.0
  },
  "svetla_vyska_mm": {
    "value": 2700,
    "source": "XLSX|shared/xlsx/...0020...|tab_mistnosti|row=42,col=4",
    "confidence": 1.0
  },
  "skladba_podlahy": {"value": "FF20", "source": "XLSX|...|col=5", "confidence": 1.0},
  "povrch_podlahy":  {"value": "F02",  "source": "XLSX|...|col=6", "confidence": 1.0},
  "povrch_sten":     {"value": "F04",  "source": "XLSX|...|col=7", "confidence": 1.0},
  "typ_podhledu":    {"value": null,   "source": "XLSX|...|col=8", "confidence": 1.0},
  "povrch_podhledu": {"value": "F05",  "source": "XLSX|...|col=9", "confidence": 1.0},

  "polygon_wkt": {
    "value": "POLYGON((10 10, 25 10, 25 22, 10 22, 10 10))",
    "source": "DXF|sources/A/dwg/..._4110_*.dwg|A-AREA-BNDY-OTLN",
    "confidence": 1.0
  },
  "perimeter_m": {"value": 18.0, "source": "DERIVED|polygon_wkt", "confidence": 0.95},
  "centroid": [17.5, 16.0],

  "wall_segment_tags": [
    {"code": "WF20", "source": "DXF|...|A-WALL-IDEN|pos=[12,15]", "confidence": 1.0},
    {"code": "WF50", "source": "DXF|...|A-WALL-IDEN|pos=[19,17]", "confidence": 1.0}
  ],

  "openings_in_room": ["A.1.1.01.D01", "A.1.1.01.W01"]  // refs to openings[]
}
```

### 2.3 `walls[]` — per-room derived wall list with skladba refs

```jsonc
{
  "room_code": "A.1.1.01",
  "wall_segment_tag": "WF20",
  "skladba_ref": "WF20",  // → skladby.WF20
  "kind": "obvodova",
  "specifikum": null,
  "tloustka_mm": {"value": 250, "source": "XLSX|0030|skladby_sten|WF20", "confidence": 1.0},
  "source": "DXF|sources/A/dwg/..._4110_*.dwg|A-WALL-IDEN"
}
```

### 2.4 `openings[]` — every door / window / glass-partition instance

```jsonc
{
  "id": "A.1.S.02.D10.001",
  "otvor_type": "door",                     // door | window | glass_partition
  "type_code": "D10",                       // type marker (D10/D21/W04/CW01)
  "from_room": "A.1.S.02",
  "to_room": "A.1.S.01",
  "is_garage_gate": false,                  // derived rule (D05 OR width>3000mm)

  "block_name": {
    "value": "HA_DR_Double_Swing_Solid_FrameButt - In_FAS_1600x2350_1000-1915407-DPS_1NP-A",
    "source": "DXF|sources/A/dwg/..._4110_*.dwg|A-DOOR-OTLN",
    "confidence": 1.0
  },
  "block_attrs": {                          // NEW — Π.0a G3 absorbs block-name regex
    "frame_type": {"value": "FrameButt", "source": "DERIVED|block_name", "confidence": 0.95},
    "swing_type": {"value": "Double_Swing_Solid", "source": "DERIVED|block_name", "confidence": 0.95},
    "install_context": {"value": "In_FAS", "source": "DERIVED|block_name", "confidence": 0.95},
    "subtype": {"value": null, "source": "DERIVED|block_name", "confidence": 0.95},
    "archicad_lib_id": {"value": "1915407", "source": "DERIVED|block_name", "confidence": 0.95}
  },

  // From DXF parser
  "position": [3.21, 67879.90],
  "width_mm": {"value": 1600, "source": "DXF|...|block_name", "confidence": 0.95},
  "height_mm": {"value": 2350, "source": "DXF|...|block_name", "confidence": 0.95},

  // From Tabulka 0041 (G1 absorption — door extras)
  "tabulka_dveri_row": 71,                  // for traceability
  "celkova_svetla_sirka_mm": {"value": 1600, "source": "XLSX|0041|tab_dvere|row=71,col=7", "confidence": 1.0},
  "sirka_aktivniho_kridla_mm": {"value": 1000, "source": "XLSX|...|col=8", "confidence": 1.0},
  "svetla_vyska_mm": {"value": 2350, "source": "XLSX|...|col=9", "confidence": 1.0},
  "ral_kridla": {"value": "7016", "source": "XLSX|...|col=11", "confidence": 1.0},
  "ral_zarubne": {"value": "7016", "source": "XLSX|...|col=15", "confidence": 1.0},
  "pozarni_odolnost": {"value": "EI 30 D3", "source": "XLSX|...|col=16", "confidence": 1.0},
  "rw_lab_db": {"value": 32, "source": "XLSX|...|col=17", "confidence": 1.0},
  "rw_site_db": {"value": null, "source": "XLSX|...|col=18", "confidence": 1.0},
  "bezpecn_odolnost": {"value": "RC3, ESG", "source": "XLSX|...|col=19", "confidence": 1.0},
  "tepelne_vlastnosti_u": {"value": null, "source": "XLSX|...|col=20", "confidence": 1.0},
  "typ_kovani": {"value": "KP1, MM", "source": "XLSX|...|col=21", "confidence": 1.0},
  "typ_samozaviraace": {"value": "SN2", "source": "XLSX|...|col=22", "confidence": 1.0},
  "zamek": {"value": "EMZ", "source": "XLSX|...|col=23", "confidence": 1.0},
  "doplnky": {"value": "Z2, KL", "source": "XLSX|...|col=24", "confidence": 1.0},
  "eps_fas": {"value": null, "source": "XLSX|...|col=25", "confidence": 1.0},
  "acs": {"value": "●", "source": "XLSX|...|col=26", "confidence": 1.0},
  "vzt": {"value": null, "source": "XLSX|...|col=27", "confidence": 1.0},
  "poznamka_door": {"value": null, "source": "XLSX|...|col=28", "confidence": 1.0}
}
```

> **PROBE 7 root cause closure**: `bezpecn_odolnost` + `zamek` + `acs` +
> `typ_samozaviraace` are exactly the columns dropped today. Π.0a lifts
> them. Downstream item-generator (separate from Π.0a) decides whether
> to apply RC3/EMZ/ACS spec to objekt-D D10 items.

### 2.5 `skladby` — full FF/F/CF/RF/WF/OP/LI/LP/TP catalogues

```jsonc
{
  "FF": {
    "FF20": {
      "kind": "podlaha_NP",
      "vrstvy": [
        {"order": 1, "tloustka_mm": 50, "label": "cementový potěr 50 mm", "produkt_ref": "..."},
        {"order": 2, "tloustka_mm": 25, "label": "kročejová izolace Isover N", "produkt_ref": "Isover N 25"},
        {"order": 3, "tloustka_mm": 40, "label": "polystyrenbeton PSB 50", "produkt_ref": "..."}
      ],
      "celkova_tloustka_mm": 115,
      "source": "XLSX|shared/xlsx/...0030...|skladby_podlah|FF20",
      "confidence": 1.0
    }
  },
  "WF": {
    "WF20": {
      "kind": "obvodova",        // re-extracted via Phase 0.8 logic — G6 absorption
      "specifikum": null,
      "vrstvy": [...],
      "celkova_tloustka_mm": 250,
      "source": "XLSX|shared/xlsx/...0030...|skladby_sten|WF20",
      "confidence": 1.0
    }
  },
  "CF": {...},      // G6: also kind+specifikum
  "RF": {...},      // G6: now extracted (was missed in current pipeline)
  "F":  {...},      // F00-F23 (povrchy)
  "OP": {...},      // Tabulka 0080 ostatní
  "LI": {...},      // klempířské lišty (cross-ref Tabulka 0060)
  "LP": {...},      // zábradlí (Tabulka 0050)
  "TP": {...}       // sheet metal (Tabulka 0060)
}
```

### 2.6–2.12 Tabulky pass-through

Each Tabulka becomes its own array section with full row coverage.
Schema mirrors Tabulka columns 1:1 with `source` per cell.

### 2.13 `segment_counts` — DXF tag census per drawing

```jsonc
{
  "method": "Reparses every DXF; classifies tag occurrences by drawing scope.",
  "drawings_classified": {
    "sources/A/dwg/..._4110_...": "objekt_A",
    "sources/shared/dwg/..._4030_...": "spol_1.PP",
    ...
  },
  "by_prefix_and_objekt": {
    "OP": {"objekt_A": {"OP01": 12, "OP05": 3, ...}},
    "WF": {"objekt_A": {"WF20": 18, "WF40": 22, ...}},
    "D":  {"objekt_A": {"D04": 21, "D21": 11, ...}},
    "W":  {"objekt_A": {"W01": 4, "W03": 12, ...}}
  }
}
```

### 2.14 `footprint_areas` — derived geometry aggregates

```jsonc
{
  "per_podlazi": {
    "1.NP": {"value": 92.4, "source": "DERIVED|sum(rooms[podlazi=1.NP].plocha_m2)", "confidence": 0.95},
    "2.NP": {"value": 104.2, "source": "...", "confidence": 0.95},
    ...
  },
  "facade_area_m2_per_orientation": {...},
  "roof_area_m2": {...},
  "total_height_m": {...}
}
```

### 2.15 `legacy_vv` — Vykaz_vymer_stary scoped to this objekt

```jsonc
{
  "items": [
    {
      "code": "611311441",
      "popis_normalized": "Penetrace pod omítku vápenocementová",
      "MJ": "m2",
      "mnozstvi": 76.71,
      "jednotkova_cena": 35.0,
      "celkova_cena": 2685.0,
      "section_code": "100",
      "objekt_filter": "A",   // derived from popis_normalized + room codes
      "source": "XLSX|shared/xlsx/Vykaz_vymer_stary.xlsx|sheet=100|row=42",
      "confidence": 0.95   // 0.95 because objekt_filter is derived
    }
  ],
  "filter_method": "split per popis_normalized A.*/B.*/C.*/D.* room references; 0.95 conf default"
}
```

### 2.16 `warnings[]` — non-fatal extraction issues

```jsonc
[
  {
    "level": "info|warning|critical",
    "category": "missing_file|format_drift|cross_reference_mismatch|...",
    "message": "Tabulka 0041 cislo=128 has D-rooms (D.3.2.01 → D.3.S.01) but B-range cislo numbering",
    "source_evidence": "XLSX|0041|row=128"
  }
]
```

### 2.17 `validation` — DWG↔Tabulka cross-checks (S5)

```jsonc
{
  "door_count_check": [
    {"type_code": "D10", "tabl_count": 0, "fakt_count": 1, "delta": 1, "level": "warning"},
    ...
  ],
  "window_count_check": [...],
  "rooms_xlsx_vs_dxf": {
    "xlsx_only": ["A.1.S.99"],   // in 0020 but not in DXF polygons
    "dxf_only":  []               // in DXF but not in 0020
  }
}
```

---

## 3. Extraction script architecture

### 3.1 Layout

```
concrete-agent/packages/core-backend/scripts/pi_0/
├── __init__.py
├── extract.py                    # main entry: `python -m pi_0.extract --objekt=A`
├── schema.py                     # dataclasses + JSON schema + validators
├── extractors/
│   ├── __init__.py
│   ├── dxf_geometry.py           # rooms, polygons, perimeters
│   ├── dxf_openings.py           # doors, windows, glass partitions (block-name attrs)
│   ├── dxf_segment_tags.py       # WF/CF/F/OP/LI/LP/TP/D/W/RF text annotations
│   ├── dxf_dimensions.py         # G5 — DIMENSION layer (Phase 6 step)
│   ├── dxf_facade_roof.py        # footprint + façade + roof area
│   ├── xlsx_mistnosti.py         # Tabulka 0020 (full row, all 10 cols)
│   ├── xlsx_skladby.py           # Tabulka 0030 (5 sheets — povrchy, podlah, sten, strech, podhledy)
│   ├── xlsx_dvere.py             # Tabulka 0041 (full 28-col schema, G1)
│   ├── xlsx_okna.py              # Tabulka 0042 (NEW — G2)
│   ├── xlsx_prosklene.py         # Tabulka 0043 (40% → 100%, G7)
│   ├── xlsx_zamecnicke.py        # Tabulka 0050
│   ├── xlsx_klempirske.py        # Tabulka 0060
│   ├── xlsx_preklady.py          # Tabulka 0070
│   ├── xlsx_ostatni.py           # Tabulka 0080 (62% → 100%, G8)
│   └── legacy_vv.py              # Vykaz_vymer_stary, per-objekt filter
├── validation/
│   ├── __init__.py
│   ├── cross_reference.py        # DXF↔Tabulka counts, room-presence checks
│   ├── idempotency.py            # sorted JSON, rounded floats, deterministic order
│   └── schema_check.py           # JSON schema enforcement
├── joiners/
│   ├── __init__.py
│   ├── room_to_skladby.py        # link rooms → wall/floor/ceiling skladby
│   ├── opening_to_room.py        # link openings → owner room (proximity + Tabulka 0041 ownership)
│   └── opening_to_tabulka.py     # join DXF openings with Tabulka 0041 by cislo
└── tests/
    ├── test_extract_d_idempotent.py
    ├── test_extract_a_minimal.py
    ├── test_validation_d_vs_legacy.py
    └── test_schema_v1.py
```

### 3.2 CLI entry

```bash
python -m pi_0.extract --objekt=A
python -m pi_0.extract --objekt=B
python -m pi_0.extract --objekt=C
python -m pi_0.extract --objekt=D --validate-vs-legacy
python -m pi_0.extract --all              # A+B+C+D in one go
```

Outputs:
- `test-data/libuse/outputs/master_extract_{objekt}.json`
- `test-data/libuse/outputs/extraction_log_{objekt}.md`
- `test-data/libuse/outputs/validation_report_{objekt}.md` (if `--validate-vs-legacy`)

### 3.3 Source path resolution

```python
SOURCES = Path("test-data/libuse/sources")

def files_for_objekt(objekt: str) -> Iterable[Path]:
    yield from (SOURCES / objekt / "dwg").glob("*.dwg")
    yield from (SOURCES / objekt / "pdf").glob("*.pdf")
    yield from (SOURCES / "shared" / "xlsx").glob("*.xlsx")
    yield from (SOURCES / "shared" / "dwg").glob("*.dwg")  # 1.PP komplex
```

Each extractor does its own `is_objekt_X(room_kod)` filter when reading
shared XLSX (Tabulka 0020 has 935 rows — only 80 belong to A, etc.).

### 3.4 Idempotency contract

```python
# All JSON output goes through this
def write_canonical(path: Path, data: dict):
    text = json.dumps(
        data,
        indent=2,
        ensure_ascii=False,
        sort_keys=True,                    # deterministic ordering
        default=_round_floats               # 6 decimals max
    )
    path.write_text(text + "\n", encoding="utf-8")

def _round_floats(obj):
    if isinstance(obj, float):
        return round(obj, 6)
    raise TypeError
```

Plus: `metadata.extracted_at` excluded from idempotency check (only
content fields counted).

Test:
```python
def test_extract_d_idempotent():
    out1 = extract(objekt="D")
    out2 = extract(objekt="D")
    assert canonical_hash(out1) == canonical_hash(out2)
```

### 3.5 Confidence convention

| Confidence | Meaning |
|---|---|
| 1.00 | Literal value from source file (no transform) |
| 0.95 | Derived: arithmetic on literals (perimeter from polygon, garage_gate flag from cislo+width) |
| 0.85 | Cross-validated: same value confirmed in 2 sources (e.g. door W from block_name AND Tabulka 0041) |
| 0.70 | Inferred: heuristic (e.g. fasádní/vnitřní opening classification by distance-to-perimeter) |
| 0.50 | Fallback: project-average (e.g. WF tloušťka when room has no WF tag) — flagged warning |

---

## 4. Backfill validation strategy for D

### 4.1 Sources to compare

When running `--objekt=D --validate-vs-legacy`, Π.0a opens:

| File | Compare against `master_extract_D.json` section |
|------|--------------------------------------------------|
| `objekt_D_per_podlazi_aggregates.json` | `rooms[]`, `footprint_areas` |
| `tabulky_loaded.json` | `skladby`, `rooms` (mistnosti subset) |
| `objekt_D_geometric_dataset.json` | `walls[]`, `rooms[].wall_segment_tags` |
| `objekt_D_doors_ownership.json` | `doors[]`, `openings[]` |
| `objekt_D_fasada_strecha.json` | `footprint_areas` |
| `dxf_segment_counts_per_objekt_d.json` | `segment_counts` |
| `stary_vv_normalized.json` | `legacy_vv` |

### 4.2 Diff categorisation

Per matched field path, classify the diff as:

| Category | Definition | Default decision |
|----------|-----------|------------------|
| **NEW** | Present in Π.0, absent in legacy | Keep Π.0 (current pipeline missed it) |
| **CHANGED** | Different value | Investigate; default = keep current until reviewed |
| **MISSING** | Present in legacy, absent in Π.0 | **BUG in Π.0 — fix before cut-over** |
| **EQUAL** | Same value | Confirm equivalence; quick win |

Output: `validation_report_D.md` with table per section per field.

### 4.3 Sign-off criteria

D backfill is approved for cut-over when:
- 0 MISSING entries (Π.0 doesn't lose data)
- All CHANGED entries have explicit user decision (replace / keep / merge)
- Idempotency test passes: 3 consecutive runs produce byte-identical output

---

## 5. Phased implementation (~18 h, 7 steps)

Steps are ordered for early-validation: each step has a measurable
checkpoint (compare Π.0 output vs current outputs) before moving on.

| # | Step | Effort | Gap addressed | Validation gate |
|--:|------|-------:|---------------|-----------------|
| 1 | Skeleton: schema + CLI + sources resolution + idempotency wrapper | 2 h | (architecture S1) | Empty `master_extract_D.json` produced; idempotent re-run |
| 2 | DXF block-name attrs (frame_type, install_context, lib_id) | 1 h | G3 | A/B/C/D all have `block_attrs.*` populated for ≥90 % of openings |
| 3 | Tabulka 0041 full-row absorption (cols 5–28) | 4 h | G1 + PROBE 7 | D — door RC3/EMZ/ACS/SN2 visible in `doors[]`; spot-check D10/D11 |
| 4 | Tabulka 0030 RF + CF skladby (kind + specifikum) | 1 h | G6 | All 70 skladby entries have non-null `kind`; WF22 = obvodova (cross-check audit) |
| 5 | Per-objekt scope param + sources/{objekt}/ wiring | 2 h | S4 | A/B/C/D each produce non-empty `rooms[]` with correct prefix filter |
| 6 | Canonical `master_extract.json` consolidation (replaces 7 legacy JSONs) | 4 h | S1 | D backfill validation: 0 MISSING, ≤5 CHANGED entries |
| 7 | Tabulka 0042 OKEN full extraction + validation report | 4 h | G2 | D windows now have Uw, Rw, RC, RAL, glazing — fields populated |

**Deferred to post-Π.0a**:
- G4 ŘEZY section heights (~6–8 h)
- G5 DIMENSION layer (~3 h) — added in Π.0b if needed
- G7 0043 cols 9–20 (~2 h)
- G8 0080 cols 6–8 (~1 h)
- G9 wall hatches (~3 h)
- G14 Phase 0.x hot-fix consolidation (~4 h) — proves out via validation
- G15 validation JSON formalisation (~1 h)

### 5.1 Post-step commit cadence

One commit per step (7 commits). Each commit:
- Adds/extends extractor module
- Updates `tests/`
- Refreshes `validation_report_D.md` to show progress
- No regression on idempotency

---

## 6. Coupling with current pipeline (cut-over plan)

### 6.1 Π.0a is additive — current pipeline keeps running

`master_extract_{objekt}.json` is a NEW output. No existing JSON is
deleted, no existing script is modified. Phase 0.x scripts continue to
read from `inputs/` symlinks → `sources/`.

### 6.2 Cut-over (separate task, post-Π.0a)

After D validation passes:
1. Phase 1+ generators rewired to read `master_extract_D.json` instead
   of legacy JSONs — one rewire commit per generator.
2. After all generators cut over, delete legacy JSONs from `outputs/`.
3. Delete `inputs/` symlinks (no longer needed if generators read
   directly from `sources/`).
4. Hot-fix scripts (Phase 0.10–0.20) deprecated — their domain
   knowledge encoded in Π.0a or Π.1 transform layer.

### 6.3 Π.0a doesn't regenerate Excel deliverable

PR #1066's `Vykaz_vymer_Libuse_objekt_D_dokoncovaci_prace.xlsx` stays
as-is. Re-generation only on user approval after cut-over (separate
task).

---

## 7. Risks & mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **R1 Idempotency drift** — re-run yields different output | Validation by diff impossible | Sorted JSON + 6-decimal floats + deterministic dict ordering enforced in `write_canonical`; test gate per step |
| **R2 Hidden hot-fix domain knowledge** — Phase 0.10–0.20 carry rules not visible in Phase 1 (e.g. WF22 reclass, F20 typo, FF01 mismap) | Π.0a output drops these hot-fix rules | Each hot-fix audited in step 6 (validation gate). Rule encoded in Π.0a or moved to Π.1 transform layer. Document in `validation_report_D.md` per rule. |
| **R3 DXF block-name format drift A→D** | Π.0a regex misses block attrs for some objekt | Validation: count `block_attrs.frame_type != null` per objekt. Threshold 90 %. |
| **R4 Tabulka column-order drift A→D** | Wrong column index = wrong data | Locate columns by header text, not index. Test with header-string lookup not col-index. |
| **R5 A — ARS desky missing** (ABMV #9) | Skipped file → empty section | Fail soft: log warning to `warnings[]`, continue. Don't fail extraction. |
| **R6 Π.0a effort overrun** | 18 h underestimate; deadline 19.5 + ABMV 4–5 d pause | Steps 1–5 (~10 h) cover PROBE 7 + scope param — even partial Π.0a delivers value. Skip steps 6–7 if needed. |

---

## 8. Acceptance criteria

Π.0a Part 3 (implementation) is approved when:

1. `python -m pi_0.extract --all` produces `master_extract_{A,B,C,D}.json`
   for all 4 objekty without errors.
2. Each output passes JSON schema v1 validation.
3. Re-running 3× produces byte-identical content (idempotency).
4. `--validate-vs-legacy --objekt=D` reports:
   - 0 MISSING entries (no data loss)
   - All CHANGED entries documented with severity
   - Equality on `rooms[].plocha_m2` for all 111 D-rooms
   - Equality on `doors[]` count vs `objekt_D_doors_ownership.json`
   - PROBE 7 fields (RC3 / EMZ / ACS / SN2) populated for D10 + D11 (was 0 before)
5. Each step's commit passes its specific gate (§5 table).
6. Test suite: ≥10 unit tests + ≥4 integration tests; all green.

---

## 9. Open decisions (need user input before Part 3)

1. **Branch strategy** — keep working on `claude/update-session-docs-Q4PwS`
   or fork a new branch for Π.0a implementation? (current branch already
   has 8 commits ahead of main.)
2. **Step granularity** — 7 commits per spec, or merge consecutive small
   steps (e.g. 1+2 = "skeleton + block attrs")?
3. **Validation report format** — markdown (human review) or JSON (machine
   diff)? Default = both, MD primary.
4. **A ARS desky** — fail soft (warning) or hard (refuse to produce
   `master_extract_A.json` until ABMV #9 resolved)? Default = soft.
5. **Pre-existing PROBE 7 D-deliverable** — Π.0a will surface RC3/EMZ/ACS
   for D10. Do we re-generate D Excel after cut-over, or freeze at
   PR #1066 state? (User had earlier said "no item changes without
   approval".)
6. **CI** — add a GitHub Actions workflow to run Π.0a + idempotency check
   on every push, or local-only test for now?

---

## 10. Files to be created (Π.0a Part 3)

```
concrete-agent/packages/core-backend/scripts/pi_0/
├── __init__.py
├── extract.py
├── schema.py
└── extractors/, validation/, joiners/, tests/
    (~1,500 lines total est.)

test-data/libuse/outputs/
├── master_extract_A.json    (~500 KB est.)
├── master_extract_B.json
├── master_extract_C.json
├── master_extract_D.json
├── extraction_log_{A,B,C,D}.md
└── validation_report_D.md
```

`sources/` and `inputs/` unchanged.

---

_Generated by Claude Code Π.0a Part 2 SPEC writing, 2026-05-07._
