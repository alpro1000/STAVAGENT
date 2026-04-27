# peri_variokit_vgk

> **Source-of-truth pointer.** The actual PDF(s) live in Google Cloud Storage.
> This stub exists only so the bucket layout is discoverable from git.

- **Slug:** `peri_variokit_vgk`
- **Bucket:** `B5_tech_cards`
- **GCS path:** `gs://stavagent-cenik-norms/B5_tech_cards/peri_variokit_vgk/`
- **Vertex AI data store:** `urs-otskp-csn-norms-cenik` (region europe-west3)
- **Title (cs):** PERI VARIOKIT VGK — vozík pro letmou betonáž
- **Title (en):** PERI VARIOKIT VGK — balanced cantilever traveller
- **Vendor:** PERI
- **Product:** VARIOKIT VGK
- **Doc type:** `tech_card`
- **Language:** cs
- **Files in folder (1):**
  - `source_navod.pdf`

> **Filename note.** Original bucket file misspelled as 'variokoit' — corrected to 'variokit' in slug.

## Why this file exists

The PDFs are too large to track in git. The Vertex AI data store
`urs-otskp-csn-norms-cenik` ingests them directly from GCS. This stub keeps the
slug, bucket layout, and metadata visible inside
`concrete-agent/packages/core-backend/app/knowledge_base/` so:

1. the directory tree mirrors the bucket 1-to-1,
2. `git grep peri_variokit_vgk` finds the document, and
3. PR reviewers can see KB additions without reading the bucket.

## Fetching the source

```bash
gsutil cp gs://stavagent-cenik-norms/B5_tech_cards/peri_variokit_vgk/source_navod.pdf .
```

## Re-generating this layout

See `scripts/gcs_sort.sh` (Phase C moves) and `scripts/INDEX.json`
(canonical metadata, also uploaded to `gs://stavagent-cenik-norms/_index/INDEX.json`).
