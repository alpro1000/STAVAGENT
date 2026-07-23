# Zeleznice-Planner — Railway Track Calculator (svršek + spodek)

STAVAGENT kiosk for Czech railway construction estimation. Decomposes a track
section (length × superstructure assembly) into deterministic quantities,
a dependency-ordered technology sequence, machine-line deployment and crews.

- **Engine:** `shared/` — TypeScript, deterministic, data-driven from
  `kb/zeleznicni_*.yaml` (single-source, codegen via `scripts/gen-knowledge.mjs`).
  Every number carries formula + source + confidence; missing inputs/norms yield
  an honest `NEPOČÍTÁNO`, never an estimate.
- **Backend:** `backend/` — Express thin wrapper (`POST /api/rail/calculate`,
  `GET /api/rail/catalog`), compute fail-closed behind `X-Service-Key`.
- **Frontend:** `frontend/` — React + Vite single-page calculator, computes
  in-browser via the shared engine (Czech UI).
- **MCP:** `calculate_railway_works` tool in concrete-agent delegates here
  (SSOT — no divergent Python math).

See [`CLAUDE.md`](./CLAUDE.md) for architecture invariants and
[`../docs/specs/zeleznicni-svrsek-spodek/`](../docs/specs/zeleznicni-svrsek-spodek/)
for the full specification.

**License:** Proprietary.
