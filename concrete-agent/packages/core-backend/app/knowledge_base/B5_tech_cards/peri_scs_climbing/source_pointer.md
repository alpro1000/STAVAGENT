# peri_scs_climbing

> **Source-of-truth pointer.** The actual PDF(s) live in Google Cloud Storage.
> This stub exists only so the bucket layout is discoverable from git.

- **Slug:** `peri_scs_climbing`
- **Bucket:** `B5_tech_cards`
- **GCS path:** `gs://stavagent-cenik-norms/B5_tech_cards/peri_scs_climbing/`
- **Vertex AI data store:** `urs-otskp-csn-norms-cenik` (region europe-west3)
- **Title (cs):** PERI SCS — jednostranné šplhavé bednění
- **Title (en):** PERI SCS — single-sided climbing formwork
- **Vendor:** PERI
- **Product:** SCS
- **Doc type:** `tech_card`
- **Language:** cs
- **Files in folder (1):**
  - `source_navod.pdf`

## Why this file exists

The PDFs are too large to track in git. The Vertex AI data store
`urs-otskp-csn-norms-cenik` ingests them directly from GCS. This stub keeps the
slug, bucket layout, and metadata visible inside
`concrete-agent/packages/core-backend/app/knowledge_base/` so:

1. the directory tree mirrors the bucket 1-to-1,
2. `git grep peri_scs_climbing` finds the document, and
3. PR reviewers can see KB additions without reading the bucket.

## Fetching the source

```bash
gsutil cp gs://stavagent-cenik-norms/B5_tech_cards/peri_scs_climbing/source_navod.pdf .
```

## Re-generating this layout

See `scripts/gcs_sort.sh` (Phase C moves) and `scripts/INDEX.json`
(canonical metadata, also uploaded to `gs://stavagent-cenik-norms/_index/INDEX.json`).
