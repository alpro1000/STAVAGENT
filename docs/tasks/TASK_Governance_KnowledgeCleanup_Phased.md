# TASK — Governance / Knowledge Cleanup (Phased)

> **Účel:** Living backlog pro governance/rules/memory vrstvu. Vznikl z knowledge-architecture
> auditu (`docs/audits/knowledge_architecture/2026-06-06_governance_rules_memory_audit.md`).
> Backlog **patří do Gitu, ne do chatu.** Phase 0/1/2 hotové (shipped PR #1312); **Phase 3 = post-Cemex**.
>
> **Status:** Phase 0/1/2 ✅ DONE · Phase 3 ⏸ PARKED (post-Cemex)
> **Vznik:** 2026-06-06 · **Zdroj plánu:** schválený fázovaný plán (chat) + audit §6

---

## Globální pravidla (pro všechny fáze)

1. Vše na jedné `claude/...` větvi. Po každé fázi CI/testy zelené, jinak rollback.
2. Faktologické úpravy — **before→after před commitem.** Verifikovat proti **primárnímu zdroji** (gcloud / kód / živý endpoint), **ne proti jinému dokumentu** (lekce z C3).
3. Přesuny souborů — nejdřív „co→kam", opravit VŠECHNY odkazy, prohnat CI; když se něco rozbije → **STOP a zeptej se.** Archivovat, ne mazat.
4. **Nesahat na produktový kód** bez explicitního svolení.
5. PR neotvírat, dokud user nepožádá. Sekvenčně, ne paralelně.
6. Naming/struktura dle existujících konvencí repa.

---

## Phase 0 (P0) — ✅ DONE (PR #1312)

Aktivní dezinformace v always-read vrstvě.

- **C1** — `docs/steering/structure.md` (v2.0) + `tech.md` přepsány z fiktivního `app/`+`apps/`+`catalogs/`+`tests/` na **skutečný** monorepo layout (`concrete-agent/packages/core-backend/app/…` + per-service složky + `kb/`). 7-engine pipeline opraven na `Monolit-Planner/shared/src`.
- **C6** — Monolit dva case-kolidující "источник истины" → jeden canonical `Monolit-Planner/CLAUDE.md`; stale Render verze do `docs/archive/legacy/`.
- **C5** — rozlišen user-global `~/.claude/settings.json` (effort/env, doporučení) vs committed `.claude/settings.json` (jen permissions).

## Phase 1 (P1) — ✅ DONE (PR #1312)

Zastaralé/duplicitní fakty.

- **C2** DB jména (`rozpocet_registry`/`monolit_planner`) · **C3** MCP URL `…-3uxelthc4q-ey.a.run.app/mcp/` (gcloud-verified, trailing slash) · **C4** Bedrock model (viz Phase 3 bump) · **C7** patterns 40→49 · **C8** concrete-agent date · **C9** soul §2 v4.24→v4.34 · **C10** husky 34→61 · **D1** CALCULATOR_PHILOSOPHY ×3 → 1 canon `domain.md §1` + stuby.
- URL normalizace v 34 aktivních docs (project-number → gcloud-canonical).

## Phase 2 (P2) — ✅ DONE (PR #1312)

Čistka + struktura.

- Archiv 14 mrtvých SESSION_/WEEK_ logů → `docs/archive/completed-sessions/` (odkazy opraveny).
- Nový `docs/steering/context-index.md` (lehká 3-tier mapa) + link z root CLAUDE.md.
- Per-service CLAUDE stuby (portal/URS/registry/registry-backend/mineru).
- Supersede-banner na `STAVAGENT_PROJECT_KNOWLEDGE_2026_05_07.md`.

---

## Phase 3 — ⏸ POST-CEMEX (samostatný build, nemíchat s pravidlovými úpravami)

> Tohle je z větší části **kód + testy + deploy-affecting**, ne docs. Spustit až po podání Cemex CSC (deadline 2026-06-28), mimo production-freeze okno.

### 3.1 Drift-guard governance↔realita (kořen C1/C3)
- **Proč:** governance se rozešel s realitou (layout, URL, model), protože **chybí mechanická kontrola** — na rozdíl od KB, kde `gen:knowledge:check` drift hlídá.
- **Co:** CI krok, který spadne, když steering/governance tvrdí cesty/fakty, které neodpovídají realitě (neexistující path; URL ≠ `gcloud run services list`; deployed model ≠ doc).
- **Acceptance:** úmyslně vložená neexistující cesta / špatná URL → CI červené. Vzor: `gen:knowledge:check` filozofie aplikovaná na governance.

### 3.2 Trigger update steering / soul §2
- **Proč:** steering od 19.05.2026 nedotčen, přestože session-discipline rule #4 to vyžaduje; soul §2 snapshot hnil (C9).
- **Co:** pravidlo/hook nebo CI-check „steering last-synced vs CLAUDE.md verze" + cadence pro refresh soul §2.
- **Acceptance:** viditelný signál, když steering/soul §2 zaostává za CLAUDE.md verzí.

### 3.3 Bedrock bump: Haiku 3 → Haiku 4.5
- **Stav:** deployed = `anthropic.claude-3-haiku-20240307-v1:0` (Claude 3 Haiku, 2024 — nejstarší), konzistentně v `cloudbuild-concrete.yaml` + `cloudbuild-urs.yaml` + `bedrock_client.py:87` (default).
- **Cíl:** `claude-haiku-4-5-20251001` (na Bedrock ID typu `anthropic.claude-haiku-4-5-20251001-v1:0`, možná s `us.` cross-region prefixem).
- **⚠️ Sperva ověřit dostupnost v `us-east-1`** (Bedrock model availability) — teprve pak bump.
- **Charakter:** deploy-affecting (env var v cloudbuild). **Prod-impact nízký** — Bedrock je fallback-tier (primary = Vertex Gemini). Nedělat v pre-Cemex freeze okně.

### 3.4 NKB / RAG nad bucketem s opalubkou
- **Co:** retrieval vrstva (NKB/RAG) nad GCS bucketem s formwork/opalubka daty.
- **Kdy:** po summitu, **s hotovým doporučením od Vertex-inženýrů** (architektura: BM25 + pgvector + rerank + LLM judge — viz tech.md §14.3 roadmap P2).

### 3.5 Odložená URL normalizace v kódu/CI/cloudbuild
- **Stav:** 52 funkčních souborů (`.js/.ts/.py` fallback-defaulty, `.env*`, `.github/workflows`, `cloudbuild*.yaml`) drží project-number formu `…-1086027517695.europe-west3.run.app`. Docs už normalizovány (PR #1312); kód **vědomě ponechán** (obě formy resolvují, runtime běží na env-var, platí „nesahat na produktový kód").
- **Co (když/jestli vůbec):** sjednotit na gcloud-canonical `…-3uxelthc4q-ey.a.run.app` **až po `gcloud run services list --region europe-west3`** (ověřit, že project-number forma reálně resolvuje / nebo je mrtvá → pak je swap i oprava mrtvých fallbacků).
- **Priorita:** nízká, on-demand.

---

## Out of scope

- Těžký context-router/RAG nad docs (anti-bloat).
- Mazání souborů (jen archiv).
- Míchání Phase 3 (kód) s pravidlovými úpravami Phase 0–2.

## Reference

- Audit: `docs/audits/knowledge_architecture/2026-06-06_governance_rules_memory_audit.md`
- Living memory: `docs/soul.md §9` (2026-06-06)
- Context mapa: `docs/steering/context-index.md`

## Housekeeping (mimo repo)

- Cloudshell: smazat vnořený dubl-klon `~/STAVAGENT/STAVAGENT/...` (pletl grepy během auditu). Není v repu — pouze v uživatelově Cloud Shell. Příkaz: `rm -rf ~/STAVAGENT/STAVAGENT`.
