# CLAUDE.md — mineru_service

> **Stub** (knowledge-architecture audit, G4). Kanonický kontext: root [`../CLAUDE.md`](../CLAUDE.md)
> + [`../docs/steering/tech.md`](../docs/steering/tech.md) §3.2.

## Co to je
- **MinerU PDF/OCR parser** — Python FastAPI, Cloud Run **europe-west1** (port 8080).
- Účel: OCR pro PDF/obrázky, extrakce tabulek. Volá ho Core (concrete-agent), ne kiosky přímo.

## Pravidla
- Core ↔ service pattern: jednosměrný tok, žádný přímý kiosk → mineru.
- Naming/konvence dle existujícího kódu + `../docs/steering/conventions.md`.
