# CLAUDE.md — stavagent-portal (Portal / Dispatcher)

> **Stub** (vznikl z knowledge-architecture auditu, G4). Kanonický kontext je v root
> [`../CLAUDE.md`](../CLAUDE.md) — sekce **Services → 2. stavagent-portal** + changelog.
> Před prací přečti root mandatory-reading blok + [`../docs/steering/`](../docs/steering/).

## Co to je
- **Portal/Dispatcher** — Node.js/Express + React, doména **www.stavagent.cz**.
- Centrální `portal_project_id` linking; JWT auth (24h); Stripe odstraněn → Lemon Squeezy billing.
- CORE proxy (300s timeout, headersTimeout=310s). Landing v2, credit system.

## Kde hledat
- Architektura + endpoint detaily: root `CLAUDE.md` §Services/2 + §Architecture.
- Stack/infra: `../docs/steering/tech.md`. Repo layout: `../docs/steering/structure.md`.
- Multi-tenant izolace (owned tables): `../docs/security/isolation_model.md` + agent `cross-user-isolation-reviewer`.

## Pravidla
- Naming/konvence dle existujícího kódu (viz `../docs/steering/conventions.md`).
- Portal INSERTs: vždy explicitní `gen_random_uuid()` pro `position_instance_id`.
- Core ↔ Kiosk pattern: Portal volá Core API, ne naopak.
