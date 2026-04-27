# unknown_belohradska_2020_vykres_tvar_1pp

> **Source-of-truth pointer.** The actual PDF(s) live in Google Cloud Storage.
> This stub exists only so the bucket layout is discoverable from git.

- **Slug:** `unknown_belohradska_2020_vykres_tvar_1pp`
- **Bucket:** `B6_research_papers`
- **GCS path:** `gs://stavagent-cenik-norms/B6_research_papers/diplomky/unknown_belohradska_2020_vykres_tvar_1pp/`
- **Vertex AI data store:** `urs-otskp-csn-norms-cenik` (region europe-west3)
- **Title (cs):** Diplomová práce — Bělohradská 2020 — výkres č. 3 — Tvar 1.PP
- **Title (en):** Master's thesis — Bělohradská 2020 — drawing №3 — Shape 1.PP
- **Authors:** Bělohradská, Lucie
- **Year:** 2020
- **Doc type:** `thesis_drawing`
- **Language:** cs
- **Files in folder (1):**
  - `source.pdf`

## Why this file exists

The PDFs are too large to track in git. The Vertex AI data store
`urs-otskp-csn-norms-cenik` ingests them directly from GCS. This stub keeps the
slug, bucket layout, and metadata visible inside
`concrete-agent/packages/core-backend/app/knowledge_base/` so:

1. the directory tree mirrors the bucket 1-to-1,
2. `git grep unknown_belohradska_2020_vykres_tvar_1pp` finds the document, and
3. PR reviewers can see KB additions without reading the bucket.

## Fetching the source

```bash
gsutil cp gs://stavagent-cenik-norms/B6_research_papers/diplomky/unknown_belohradska_2020_vykres_tvar_1pp/source.pdf .
```

## Re-generating this layout

See `scripts/gcs_sort.sh` (Phase C moves) and `scripts/INDEX.json`
(canonical metadata, also uploaded to `gs://stavagent-cenik-norms/_index/INDEX.json`).
