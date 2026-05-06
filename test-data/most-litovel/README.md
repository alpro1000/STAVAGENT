# Most Litovel — DESKOVÝ (archive reference)

**Status:** `archive_reference` — third real-world bridge project for cross-coverage of
`BR_DECK_SLAB` element type. **NOT a sandbox**, **NOT a golden test**.

## Strategic context

| Project | Bridge type | Status | STAVAGENT element_type pokrytí |
|---------|-------------|--------|--------------------------------|
| Žihle 2062-1 | integrální rám (1 pole, malý) | sandbox done (Phase A-D) | `BR_FRAME` (`opery_ulozne_prahy` + `mostovkova_deska` rámového typu) |
| Kfely 20-005 | prefab estakáda (cca 815 m²) | XML reference (zadání) | `BR_BOX_GIRDER` / `BR_GIRDER_T` (spřažená mostovka) |
| **Most Litovel** | **deskový most** | **archive reference (this entry)** | **`BR_DECK_SLAB` (mostní nosné deskové konstrukce ŽB)** |

Pokrytí 3 hlavních bridge element types = gold pro classifier calibration + calculator
regression tests.

## Tree

```
test-data/most-litovel/
├── README.md          ← this file
├── metadata.yaml      ← strukturovaná karta projektu
└── inputs/
    └── source/
        └── 31697_Archive.pdf  (6.37 MB, 19 pages, SCANNED — no text layer)
```

## Constraints

- **PDF je scan** (PDF 1.4 image-only, žádná text vrstva). OCR pipeline vyžadována pro
  extrakci.
- **NOT pro sandbox workflow** v tomto tasku (per `TASK_KB_MajorIngest_BridgesV2.md` §2.4).
  Phase A→D pro Litovel = separátní budoucí task.

## Cross-references

- [`metadata.yaml`](metadata.yaml) — strukturovaná karta (status, type, sources, strategic value)
- [`../most-2062-1-zihle/`](../most-2062-1-zihle/) — first sandbox project (BR_FRAME)
- [`docs/audits/knowledge_audit/2026-05-06_b2_and_docs_bridge_ingest_audit.md`](../../docs/audits/knowledge_audit/2026-05-06_b2_and_docs_bridge_ingest_audit.md) — placement audit decision

## Future work (separate task)

1. **OCR pipeline** for `31697_Archive.pdf` — MinerU Cloud Run / Tesseract / vision API per page
2. **Identify structure** — TZ + výkresy + soupis sections
3. **Optional:** convert na sandbox project (Phase A→D) following Žihle pattern
4. **Optional:** convert finished workflow na golden test under `test-data/tz/`
