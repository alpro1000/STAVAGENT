# CLAUDE.md — rozpocet-registry-backend

> **Stub** (knowledge-architecture audit, G4). Kanonický kontext: root [`../CLAUDE.md`](../CLAUDE.md)
> §Services/5 (Registr) + frontend [`../rozpocet-registry/CLAUDE.md`](../rozpocet-registry/CLAUDE.md).

## Co to je
- Backend Registru — Node.js + **Cloud SQL Postgres**. Service `rozpocet-registry-backend-…europe-west3.run.app`.
- IndexedDB → Postgres UPSERT POST (no GET-first), classification round-trip přes `sync_metadata` (viz root changelog v4.26.0).

## Pravidla
- DB jméno: `rozpocet_registry` (viz `../docs/steering/tech.md` §4.1).
- Naming/konvence dle existujícího kódu + `../docs/steering/conventions.md`.
