# peri_vyrobni_program_bedneni

> **Source-of-truth pointer.** The actual PDF(s) live in Google Cloud Storage.
> This stub exists only so the bucket layout is discoverable from git.

- **Slug:** `peri_vyrobni_program_bedneni`
- **Bucket:** `B5_tech_cards`
- **GCS path:** `gs://stavagent-cenik-norms/B5_tech_cards/peri_vyrobni_program_bedneni/`
- **Vertex AI data store:** `urs-otskp-csn-norms-cenik` (region europe-west3)
- **Title (cs):** PERI — výrobní program bednění (přehled sortimentu)
- **Title (en):** PERI — formwork product range overview
- **Vendor:** PERI
- **Product:** Catalogue
- **Doc type:** `vendor_catalogue`
- **Language:** cs
- **Files in folder (1):**
  - `source.pdf`

## Why this file exists

The PDFs are too large to track in git. The Vertex AI data store
`urs-otskp-csn-norms-cenik` ingests them directly from GCS. This stub keeps the
slug, bucket layout, and metadata visible inside
`concrete-agent/packages/core-backend/app/knowledge_base/` so:

1. the directory tree mirrors the bucket 1-to-1,
2. `git grep peri_vyrobni_program_bedneni` finds the document, and
3. PR reviewers can see KB additions without reading the bucket.

## Fetching the source

```bash
gsutil cp gs://stavagent-cenik-norms/B5_tech_cards/peri_vyrobni_program_bedneni/source.pdf .
```

## Re-generating this layout

See `scripts/gcs_sort.sh` (Phase C moves) and `scripts/INDEX.json`
(canonical metadata, also uploaded to `gs://stavagent-cenik-norms/_index/INDEX.json`).
