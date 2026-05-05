# en_1992_2_concrete_bridges

> **Source-of-truth pointer.** Source PDF lives in `B2_csn_standards/` (legacy
> bucket convention for ČSN-like + Eurocode PDFs). Extracted YAML/MD lives
> here per `docs/KNOWLEDGE_PLACEMENT_GUIDE.md` (authoritative norm).

- **Slug:** `en_1992_2_concrete_bridges`
- **Bucket:** `B7_regulations`
- **PDF in repo:** `../../B2_csn_standards/SIST-EN-1992-2-2005.pdf` (346 KB)
- **Title (en):** EN 1992-2: Eurocode 2 — Design of concrete structures, Part 2: Concrete bridges
- **Publisher:** CEN (Slovenian transposition SIST EN 1992-2:2005 used as accessible reference)
- **Year:** 2005
- **Doc type:** `eurocode_norm`
- **Language:** en
- **Status:** PARTIAL extraction (Žihle-relevant sections only — 3.1.2, 4.4, Annex E)

## Files in this entry

| File | Purpose |
|------|---------|
| `INDEX.yaml` | Machine-readable extraction of Žihle-relevant sections + Annex E exposure→C class table + Žihle element mapping |
| `METADATA.md` | Source attribution, scope, extraction limits |
| `source_pointer.md` | This file |

## Scope of extraction

Per task spec, extraction is **PARTIAL — only sections needed for Žihle Phase B**:
- §3.1.2 — Strength classes (recommended C_min for bridges = C30/37)
- §4.4 — Concrete cover (cover_min, cover_dur, cover_dev)
- Annex E — Indicative strength classes for durability (per exposure XC/XF/XD/XS/XA)
- §10 — Detailing (referenced but not extracted in detail)

For full Eurocode 2 mostní application use the original PDF.

## Cross-references

- **Companion ČSN national:** `csn_73_6222_zatizitelnost_mostu/` (stub)
- **University teaching reference:** `B6_research_papers/upa_zatizitelnost_sanace_mostu/`
- **Used by:** Žihle Phase B `02_design/concrete_classes.yaml`
