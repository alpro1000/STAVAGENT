# csn_en_206_pruvodce

> **Source-of-truth pointer.** The actual PDF(s) live in Google Cloud Storage.
> This stub exists only so the bucket layout is discoverable from git.

- **Slug:** `csn_en_206_pruvodce`
- **Bucket:** `B7_regulations`
- **GCS path:** `gs://stavagent-cenik-norms/B7_regulations/csn_en_206_pruvodce/`
- **Vertex AI data store:** `urs-otskp-csn-norms-cenik` (region europe-west3)
- **Title (cs):** Průvodce normou ČSN EN 206+A2
- **Title (en):** Guide to the ČSN EN 206+A2 standard
- **Norm code:** ČSN EN 206+A2
- **Doc type:** `norm_guide`
- **Language:** cs
- **Files in folder (1):**
  - `source.pdf`

## Why this file exists

The PDFs are too large to track in git. The Vertex AI data store
`urs-otskp-csn-norms-cenik` ingests them directly from GCS. This stub keeps the
slug, bucket layout, and metadata visible inside
`concrete-agent/packages/core-backend/app/knowledge_base/` so:

1. the directory tree mirrors the bucket 1-to-1,
2. `git grep csn_en_206_pruvodce` finds the document, and
3. PR reviewers can see KB additions without reading the bucket.

## Fetching the source

```bash
gsutil cp gs://stavagent-cenik-norms/B7_regulations/csn_en_206_pruvodce/source.pdf .
```

## Re-generating this layout

See `scripts/gcs_sort.sh` (Phase C moves) and `scripts/INDEX.json`
(canonical metadata, also uploaded to `gs://stavagent-cenik-norms/_index/INDEX.json`).
