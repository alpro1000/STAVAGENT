# peri_variokit_engineering_kit

> **Source-of-truth pointer.** The actual PDF(s) live in Google Cloud Storage.
> This stub exists only so the bucket layout is discoverable from git.

- **Slug:** `peri_variokit_engineering_kit`
- **Bucket:** `B5_tech_cards`
- **GCS path:** `gs://stavagent-cenik-norms/B5_tech_cards/peri_variokit_engineering_kit/`
- **Vertex AI data store:** `urs-otskp-csn-norms-cenik` (region europe-west3)
- **Title (cs):** PERI VARIOKIT — modulární inženýrské bednění
- **Title (en):** PERI VARIOKIT — modular engineering construction kit
- **Vendor:** PERI
- **Product:** VARIOKIT
- **Doc type:** `tech_card`
- **Language:** cs
- **Files in folder (1):**
  - `source_prospekt.pdf`

## Why this file exists

The PDFs are too large to track in git. The Vertex AI data store
`urs-otskp-csn-norms-cenik` ingests them directly from GCS. This stub keeps the
slug, bucket layout, and metadata visible inside
`concrete-agent/packages/core-backend/app/knowledge_base/` so:

1. the directory tree mirrors the bucket 1-to-1,
2. `git grep peri_variokit_engineering_kit` finds the document, and
3. PR reviewers can see KB additions without reading the bucket.

## Fetching the source

```bash
gsutil cp gs://stavagent-cenik-norms/B5_tech_cards/peri_variokit_engineering_kit/source_prospekt.pdf .
```

## Re-generating this layout

See `scripts/gcs_sort.sh` (Phase C moves) and `scripts/INDEX.json`
(canonical metadata, also uploaded to `gs://stavagent-cenik-norms/_index/INDEX.json`).
