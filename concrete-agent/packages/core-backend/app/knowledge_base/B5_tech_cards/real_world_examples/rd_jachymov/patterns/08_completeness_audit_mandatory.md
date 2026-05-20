# Pattern 08 — Phase 0a Completeness Audit (MANDATORY)

**Source pilot:** RD Jáchymov (post user-caught gap, 2026-05-18)
**Pipeline phase:** Phase 0a — runs BEFORE Phase 0b §3.1 UNSORTED audit
**Status:** validated, **CRITICAL**, mandatory pre-Phase-1 rule for ALL future pilots
**Counter-pattern:** `09_iterative_layer_probe_user_caught_gaps.md`

## The rule

```
Phase 1 gate CANNOT open until source_completeness_audit.json
returns gate_status: "OPEN" with 0 blockers.
```

Phase 1 = item generation. Without exhaustive Phase 0a, generator works on subset → silent drifts → items.json ships incomplete.

## Algorithm

`tools/phase0a_completeness_audit.py` produces `outputs/source_completeness_audit.json` s 3 sections:

### Section A — PDF inventory (ALL PDFs)

Pro every PDF v `inputs/` tree (NOT just TZ texts):

```python
{
  "path": "inputs/vykresy_pdf/.../D.2.3.01 - výkres tvaru 1.PP _ EAR.pdf",
  "size_bytes": 287123,
  "pages": 1,
  "chars_extracted": 0,            # ← drawing-heavy, pypdf failed
  "content_type": "drawing_heavy", # text_heavy | drawing_heavy | scanned
  "probe_status": "probed_extracted" | "_ocr_recommended" | "extraction_failed",
  "scodes_found": [...],
  "fcodes_found": [...],
  "material_markers_found": [...],
  "skladba_legend_lines": N,
  "useful_data_summary": [...]
}
```

Trigger OCR (pdftoppm 300 DPI + tesseract ces+eng `--psm 6`) pro každý PDF s `content_type ∈ {drawing_heavy, scanned}`. Output → `outputs/ocr_pdfs_extracted.json`.

### Section B — DXF all-layers inventory

Pro every DXF v `inputs/vykresy_dxf/`:

```python
{
  "file_key": "dum_DPZ",
  "n_layers_total": 47,
  "per_layer": [
    {
      "layer_name": "SM_kóty",
      "n_entities": 230,
      "entity_types": {"DIMENSION": 142, "TEXT": 88},
      "probed": True,
      "probe_status": "probed_extracted",
      "actionable": True
    },
    {
      "layer_name": "rozpiska",
      "probe_status": "probed_metadata_only_confirmed",
      "decision": "skip — title block"
    }
  ]
}
```

Per file: `actionable_count + skip_confirmed_count == n_layers_total`. Zero layers s `probe_status: unknown`.

### Section C — Cross-reference matrix

Sample 6-10 high-stakes data points (sklad rozměry, ETICS thickness, omítka per podlaží, počet oken, …) → matrix `source × value`:

```
                    TZ text   DXF DIM   DXF INSERT  Drift?
sklad délka         6.35 m    6350 mm   —           OK ±5mm
ETICS tloušťka      160 mm    —         160 mm      OK
omítka 2.NP výška   —         2865 mm   —           OK
```

Drift > 0.10 mm OR `data_missing` → flag pro Phase 0b §3.2 re-parse.

## Gate verdict

```python
gate_status = "BLOCKED" if (
    any(pdf.probe_status == "_ocr_recommended" for pdf in pdfs)
    OR any(layer.probe_status == "unknown" for layer in dxf_layers)
) else "OPEN"
```

Gate blocked → fix-it loop:
1. Run OCR pipeline na drawing-heavy PDFs
2. Run Path C Tier 1-5 na unprobed DXF layers
3. Re-run Phase 0a audit
4. Repeat until OPEN

## RD Jáchymov empirical evidence

Initial pre-Pattern-08 first-pass (Phase 0b §3.3 alone):
- **11/156 DXF layers probed (7 %)**
- 0/6 drawing-heavy PDFs OCR'd
- 18 items s `mnozstvi_confidence == 0.75` které měly DXF data ležící unprobed
- **6 silent drifts** which user caught manually (ETICS thickness 200→160, PIR 180→160, klempířina aggregate, obklady per koupelna, výšky podlaží, špalety perimeter)

Post-Pattern-08 Path C (this audit):
- **156/156 DXF layers probed**
- **6/6 drawing-heavy PDFs OCR'd**
- 11 items moved 0.75 → 0.90+ via DXF corroboration
- 0 silent drifts
- Confidence distribution shifted: 0.75 = 88 → 69 items, 0.99 = 5 → 17 items

## Forbidden

- ❌ **Open Phase 1 gate bez Phase 0a OPEN status.** No exceptions.
- ❌ Spot-check probing ("probed top-20 layers, ostatní jsou určitě metadata") — explicit per-layer probe_status required
- ❌ Skipping Section C cross-reference matrix "protože data jsou consistent" — only the matrix proves consistency
- ❌ Trusting filename / layer name keyword match to infer content (Pattern 01 file-swap counter-example)

## Tools

- `tools/phase0a_completeness_audit.py` (this pilot — generalize for next)
- `outputs/source_completeness_audit.json` (artifact)
- `outputs/ocr_pdfs_extracted.json` (artifact)
- `outputs/dxf_all_layers_inventory.json` (artifact)
