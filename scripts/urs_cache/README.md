# URS Cache Builder + Enricher

Two-step pipeline that builds a local cache of the modern ÚRS catalog
(`podminky.urs.cz`) via its underlying Cloud Run REST API. Cache is the
prerequisite for downstream rematch of project items (e.g. `hk212`) whose
URS coverage was limited by the older 2018 catalog.

Run order, fresh machine:

```bash
pip install requests beautifulsoup4 tqdm
python scripts/urs_cache/urs_cache_builder.py
python scripts/urs_cache/urs_cache_enrich.py --parents-only --concurrency 5
```

Outputs (all gitignored — derived data, never committed):

| Path | Step | Size | Role |
|---|---|---|---|
| `data/urs_cache.db` | both | ~140 MB | SQLite + FTS5 (items, node_texts, enrich_state) |
| `data/urs_cache/<vintage>.json` | builder | ~2 MB × 11 | raw catalog tree per vintage |
| `data/urs_cache/items_flat.json` | builder | ~10 MB | flat list of all leaf items |

Step 1 (`urs_cache_builder.py`) — pulls 11 vintages of the full catalog tree
via `GET /v1/version?productId=<pid>` + `GET /v1/version/<vid>/catalog`.
~5 minutes total.

Step 2 (`urs_cache_enrich.py`) — pulls per-node long-form Czech HTML
(materiálové varianty, podmínky použití) via `GET /v1/version/<vid>/category/<nid>`.
`--parents-only` mode skips leaves (~1.5 hours @ concurrency 5).

The `--audit` flag on both scripts runs DB quality checks without network.

## Legal

ZZVZ (zákon o veřejných zakázkách) — public technical conditions only.
Never scrapes prices (paid data behind KROS license).
