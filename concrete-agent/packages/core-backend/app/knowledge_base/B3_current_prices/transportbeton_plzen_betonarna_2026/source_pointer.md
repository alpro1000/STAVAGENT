# transportbeton_plzen_betonarna_2026

> **Source-of-truth pointer.** The actual PDF(s) live in Google Cloud Storage.
> This stub exists only so the bucket layout is discoverable from git.

- **Slug:** `transportbeton_plzen_betonarna_2026`
- **Bucket:** `B3_current_prices`
- **GCS path:** `gs://stavagent-cenik-norms/B3_current_prices/transportbeton_plzen_betonarna_2026/`
- **Vertex AI data store:** `urs-otskp-csn-norms-cenik` (region europe-west3)
- **Title (cs):** Ceník Transportbeton a značkové produkty — betonárna Plzeň 2026
- **Title (en):** Price list — ready-mix concrete & branded products — Plzeň plant 2026
- **Vendor:** Transportbeton (betonárna Plzeň)
- **Valid from:** 2026
- **Doc type:** `price_list`
- **Language:** cs
- **Files in folder (1):**
  - `source.pdf`

## Why this file exists

The PDFs are too large to track in git. The Vertex AI data store
`urs-otskp-csn-norms-cenik` ingests them directly from GCS. This stub keeps the
slug, bucket layout, and metadata visible inside
`concrete-agent/packages/core-backend/app/knowledge_base/` so:

1. the directory tree mirrors the bucket 1-to-1,
2. `git grep transportbeton_plzen_betonarna_2026` finds the document, and
3. PR reviewers can see KB additions without reading the bucket.

## Fetching the source

```bash
gsutil cp gs://stavagent-cenik-norms/B3_current_prices/transportbeton_plzen_betonarna_2026/source.pdf .
```

## Re-generating this layout

See `scripts/gcs_sort.sh` (Phase C moves) and `scripts/INDEX.json`
(canonical metadata, also uploaded to `gs://stavagent-cenik-norms/_index/INDEX.json`).
