# upa_zatizitelnost_sanace_mostu

> **Source-of-truth pointer.** Source PDF lives in `B2_csn_standards/` (legacy
> bucket convention for ČSN-like + Eurocode + university material PDFs).
> Extracted YAML/MD lives here in `B6_research_papers/` per
> [`docs/KNOWLEDGE_PLACEMENT_GUIDE.md`](../../../../../../docs/KNOWLEDGE_PLACEMENT_GUIDE.md)
> (university lecture material).

- **Slug:** `upa_zatizitelnost_sanace_mostu`
- **Bucket:** `B6_research_papers`
- **PDF in repo:** `../../B2_csn_standards/09_zatizitelnost, sanace.pdf` (4.1 MB)
- **Title (cs):** Zatížitelnost a sanace mostů — UPa lecture (slide deck)
- **Origin:** Univerzita Pardubice, Fakulta dopravní (DFJP), Katedra dopravního stavitelství
- **Doc type:** `lecture_slides`
- **Language:** cs
- **Pages:** 31
- **Year:** approx. 2020-2024 (specific edition not stated on slides)

## Files in this entry

| File | Purpose |
|------|---------|
| `INDEX.yaml` | Machine-readable structured extraction (skupiny komunikací, stavební stavy, koeficienty zatížení, lifecycle, sanace metody) |
| `METADATA.md` | Source attribution + scope notes |
| `citations.md` | Page-by-slide citations for each fact in INDEX.yaml |
| `source_pointer.md` | This file |

## Why source PDF in B2 (not B6)

Convention `B2_csn_standards/` historically holds **all PDF binaries**
(ČSN normy, Eurocode PDFs, related materials). The 2 PDFs from this batch
were dropped to B2 by user. Per `KNOWLEDGE_PLACEMENT_GUIDE.md` and existing
B6 entries (e.g. `upa_pokorny_suchanek_betonove_mosty_ii/` keeps its KB.zip
in-bucket but separately), this entry is a **distillation** of teaching
content into structured data — extracted YAML+MD live here in B6.

## Fetching the source

```bash
ls concrete-agent/packages/core-backend/app/knowledge_base/B2_csn_standards/ | grep -i zatizit
```

## Cross-references

- **STAVAGENT element types:** `BR_FRAME`, `BR_DECK_SLAB`, all bridge subtypes
- **Related KB entries:**
  - `B7_regulations/csn_73_6222_zatizitelnost_mostu/` — paid-norm stub that cites this entry as primary extraction source
  - `B9_validation/lifecycle_durability/` — lifecycle table extracted from slide 19
- **Used by:** Žihle Phase B/C calculations (test-data/most-2062-1-zihle/)
