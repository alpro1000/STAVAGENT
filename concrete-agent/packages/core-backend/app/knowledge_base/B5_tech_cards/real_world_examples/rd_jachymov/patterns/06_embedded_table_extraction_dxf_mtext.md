# Pattern 06 — Embedded table extraction from DXF MTEXT

**Source pilot:** RD Jáchymov (Path C Tier 2)
**Pipeline phase:** Phase 0b §3.3 / Path C
**Status:** validated

## Problem

Výpis oken + dveří v RD Jáchymov DSP **NEexistuje jako samostatný PDF** (typický DSP nedostatek). User-spec varianta B (per-položkový soupis) requiroval per-okno W×H pro:
- ETICS špalety obvod (perimeter `2×(W+H)`) per okno
- Okenní žaluzie kastlík tloušťka per typ
- Skleněné výplně ks per typ

**Ale** výpis tabulek existoval **embedded v DXF jako MTEXT** na layer `nabytek_VYPIS_OKEN` v souboru `RD Jachymov dum _ DPZ _ 10.dxf`. Cells separované `^I` literal caret-I (Czech CAD MTEXT tab encoding, NE ASCII `\t`).

## Solution

```python
import re

TAB_LITERAL_RE = re.compile(r'\^I')

def extract_embedded_table(msp, layer_pattern: str) -> list[dict]:
    """Pull MTEXT rows on layer, split cells on ^I literal tab."""
    rows = []
    for e in msp:
        if e.dxftype() != 'MTEXT':
            continue
        if not re.search(layer_pattern, e.dxf.layer, re.IGNORECASE):
            continue
        text = e.text
        # Czech CAD encoding fixups
        text = TAB_LITERAL_RE.sub('\t', text)
        text = text.replace('\\P', '\n')  # MTEXT paragraph marker
        for line in text.splitlines():
            cells = [c.strip() for c in line.split('\t') if c.strip()]
            if len(cells) >= 3:  # heuristic: real table row has ≥ 3 cells
                rows.append({'raw': line, 'cells': cells})
    return rows
```

## Validation

Per-okno W×H extracted z embedded table → cross-check proti DXF INSERT block bbox extents (`okno 1.NP`, `okno 2.NP`, …). Match napříč všech 16 oken ±5 mm → confidence 0.99.

```
extracted_okna_table = [['O1', '1.NP', '1500', '1500', 'plast bílý'], ...]
insert_bbox_okno_1   = (width=1.502 m, height=1.503 m)
→ match: True (diff < 5mm)
```

## Why MTEXT a NE TEXT

Czech CAD users (především AutoCAD CZ + Allplan) ukládají multi-line tabulky jako single MTEXT entity s `\P` paragraph markers + `^I` tab cells, **NE** jako multiple TEXT entities + LINE grid. Single MTEXT preserves Word-style formatting + auto-rewrap.

## Forbidden

- ❌ Tab split na `\t` — Czech CAD ukládá literal `^I` (caret-I), NE ASCII tab
- ❌ Treat každý MTEXT line jako separate row bez `\P` split
- ❌ Skip MTEXT entities pokud první cell není purely numeric — header rows + popis cells obsahují text
