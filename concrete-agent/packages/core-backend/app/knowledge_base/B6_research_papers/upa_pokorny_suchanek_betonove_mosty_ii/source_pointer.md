# upa_pokorny_suchanek_betonove_mosty_ii

> **Source-of-truth pointer.** The actual PDF(s) live in Google Cloud Storage.
> This stub exists only so the bucket layout is discoverable from git.

- **Slug:** `upa_pokorny_suchanek_betonove_mosty_ii`
- **Bucket:** `B6_research_papers`
- **GCS path:** `gs://stavagent-cenik-norms/B6_research_papers/upa_pokorny_suchanek_betonove_mosty_ii/`
- **Vertex AI data store:** `urs-otskp-csn-norms-cenik` (region europe-west3)
- **Title (cs):** Betonové mosty II (Pokorný, Suchánek)
- **Title (en):** Concrete bridges II (Pokorný, Suchánek)
- **Authors:** Pokorný, Suchánek
- **Doc type:** `textbook`
- **Language:** cs
- **Files in folder (1):**
  - `source.pdf`

## Why this file exists

The PDFs are too large to track in git. The Vertex AI data store
`urs-otskp-csn-norms-cenik` ingests them directly from GCS. This stub keeps the
slug, bucket layout, and metadata visible inside
`concrete-agent/packages/core-backend/app/knowledge_base/` so:

1. the directory tree mirrors the bucket 1-to-1,
2. `git grep upa_pokorny_suchanek_betonove_mosty_ii` finds the document, and
3. PR reviewers can see KB additions without reading the bucket.

## Fetching the source

```bash
gsutil cp gs://stavagent-cenik-norms/B6_research_papers/upa_pokorny_suchanek_betonove_mosty_ii/source.pdf .
```

## Re-generating this layout

See `scripts/gcs_sort.sh` (Phase C moves) and `scripts/INDEX.json`
(canonical metadata, also uploaded to `gs://stavagent-cenik-norms/_index/INDEX.json`).
