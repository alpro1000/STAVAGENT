# vut_novakova_2019_dalnicni_nadjezd_d1_150

> **Source-of-truth pointer.** The actual PDF(s) live in Google Cloud Storage.
> This stub exists only so the bucket layout is discoverable from git.

- **Slug:** `vut_novakova_2019_dalnicni_nadjezd_d1_150`
- **Bucket:** `B6_research_papers`
- **GCS path:** `gs://stavagent-cenik-norms/B6_research_papers/diplomky/vut_novakova_2019_dalnicni_nadjezd_d1_150/`
- **Vertex AI data store:** `urs-otskp-csn-norms-cenik` (region europe-west3)
- **Title (cs):** Diplomová práce — Projekt dálničního nadjezdu č. D1-150 (Nováková, VUT)
- **Title (en):** Master's thesis — Highway overpass D1-150 design (Nováková, VUT)
- **Institution:** VUT
- **Authors:** Nováková
- **Year:** 2019
- **Doc type:** `thesis`
- **Language:** cs
- **Files in folder (1):**
  - `source.pdf`

> **Duplicate note.** Identical CRC32C with bucket-root file 46324_Archive.pdf — that copy was archived to _archive/duplicates/.

## Why this file exists

The PDFs are too large to track in git. The Vertex AI data store
`urs-otskp-csn-norms-cenik` ingests them directly from GCS. This stub keeps the
slug, bucket layout, and metadata visible inside
`concrete-agent/packages/core-backend/app/knowledge_base/` so:

1. the directory tree mirrors the bucket 1-to-1,
2. `git grep vut_novakova_2019_dalnicni_nadjezd_d1_150` finds the document, and
3. PR reviewers can see KB additions without reading the bucket.

## Fetching the source

```bash
gsutil cp gs://stavagent-cenik-norms/B6_research_papers/diplomky/vut_novakova_2019_dalnicni_nadjezd_d1_150/source.pdf .
```

## Re-generating this layout

See `scripts/gcs_sort.sh` (Phase C moves) and `scripts/INDEX.json`
(canonical metadata, also uploaded to `gs://stavagent-cenik-norms/_index/INDEX.json`).
