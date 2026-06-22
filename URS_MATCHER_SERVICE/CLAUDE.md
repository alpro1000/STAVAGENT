# CLAUDE.md — URS_MATCHER_SERVICE (Klasifikátor)

> **Stub** (vznikl z knowledge-architecture auditu, G4). Kanonický kontext je v root
> [`../CLAUDE.md`](../CLAUDE.md) — sekce **Services → 4. Klasifikátor** + changelog.
> Před prací přečti root mandatory-reading blok + [`../docs/steering/`](../docs/steering/).

## Co to je
- **Klasifikátor stavebních prací** — Node.js/Express + SQLite, doména **klasifikator.stavagent.cz**.
- 4-phase matching, dual search (seed + 17 904 OTSKP + Perplexity), VZ Scraper, multi-provider LLM.
- Interní jméno akronymu: "Unified Retrieval Service" (nikdy ne branded `ÚRS` publicly — viz `../docs/steering/tech.md` §3.3).

## Kde hledat
- Endpoint/architektura: root `CLAUDE.md` §Services/4. Stack: `../docs/steering/tech.md`.
- Confidence scoring (regex 1.0 / OTSKP 1.0 / URS 0.80 / AI 0.70): `../docs/steering/tech.md` §5.4.

## Pravidla
- LLM timeout 90s, AbortController per-provider. Determinismus před AI.
- Core ↔ Kiosk pattern: volá Core API; vlastní knowledge jen cache.
