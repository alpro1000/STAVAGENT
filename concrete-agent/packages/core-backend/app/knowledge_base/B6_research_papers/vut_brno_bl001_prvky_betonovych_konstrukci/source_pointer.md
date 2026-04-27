# vut_brno_bl001_prvky_betonovych_konstrukci

> **Source-of-truth pointer.** The actual PDF(s) live in Google Cloud Storage.
> This stub exists only so the bucket layout is discoverable from git.

- **Slug:** `vut_brno_bl001_prvky_betonovych_konstrukci`
- **Bucket:** `B6_research_papers`
- **GCS path:** `gs://stavagent-cenik-norms/B6_research_papers/vut_brno_bl001_prvky_betonovych_konstrukci/`
- **Vertex AI data store:** `urs-otskp-csn-norms-cenik` (region europe-west3)
- **Title (cs):** VUT Brno — BL001 Prvky betonových konstrukcí (výukové texty)
- **Title (en):** VUT Brno — BL001 Concrete structure elements (course notes)
- **Institution:** VUT Brno (FAST)
- **Course code:** BL001
- **Doc type:** `course_textbook`
- **Language:** cs
- **Files in folder (1):**
  - `source.pdf`

## Why this file exists

The PDFs are too large to track in git. The Vertex AI data store
`urs-otskp-csn-norms-cenik` ingests them directly from GCS. This stub keeps the
slug, bucket layout, and metadata visible inside
`concrete-agent/packages/core-backend/app/knowledge_base/` so:

1. the directory tree mirrors the bucket 1-to-1,
2. `git grep vut_brno_bl001_prvky_betonovych_konstrukci` finds the document, and
3. PR reviewers can see KB additions without reading the bucket.

## Fetching the source

```bash
gsutil cp gs://stavagent-cenik-norms/B6_research_papers/vut_brno_bl001_prvky_betonovych_konstrukci/source.pdf .
```

## Re-generating this layout

See `scripts/gcs_sort.sh` (Phase C moves) and `scripts/INDEX.json`
(canonical metadata, also uploaded to `gs://stavagent-cenik-norms/_index/INDEX.json`).
