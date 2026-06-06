# CLAUDE.md — rozpocet-registry (Registr, frontend)

> **Stub** (vznikl z knowledge-architecture auditu, G4). Kanonický kontext je v root
> [`../CLAUDE.md`](../CLAUDE.md) — sekce **Services → 5. Registr** + changelog.
> **Aktivní follow-ups / out-of-scope nálezy:** [`next-session.md`](next-session.md) (de-facto service governance).
> Před prací přečti root mandatory-reading blok + [`../docs/steering/`](../docs/steering/).

## Co to je
- **Registr** — React 19 + Vite + Vercel serverless, doména **registry.stavagent.cz**.
- Backend: [`../rozpocet-registry-backend/`](../rozpocet-registry-backend/) (Node + Cloud SQL Postgres, UPSERT sync).
- BOQ klasifikace (11 skupin), row classifier v1.1, AI Classification (Cache→Rules→Memory→Gemini), TOV Modal.

## Kde hledat
- Endpoint/architektura + flat-layout rollout: root `CLAUDE.md` §Services/5.
- Spec/algoritmus klasifikátoru: `docs/ROW_CLASSIFICATION_ALGORITHM.md` + `docs/ROW_CLASSIFICATION_SPEC.md`.
- Stack/state (Zustand/IndexedDB): `../docs/steering/tech.md`.

## Pravidla
- Naming/konvence dle existujícího kódu (`../docs/steering/conventions.md`).
- Ikony: `lucide-react` only, `size` prop vždy s Tailwind `w-[Npx] h-[Npx]` (cross-browser).
- Core ↔ Kiosk pattern: vlastní knowledge jen cache, ground truth přes Core/DB.
