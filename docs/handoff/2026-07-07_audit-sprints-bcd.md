# Handoff 2026-07-07 — Audit Sprints B+C+D executed; Sprint A armed, waiting for go

**Branch:** `claude/lucid-newton-0xuxf6` (7 commits on top of `a114180` = composite #7 merge)
**Merge-gate:** Alexander. PR z této větve zatím NEZALOŽEN (na povel).

## Co je hotovo (commity v pořadí)

1. `995fc4c` DOCS(backlog) — fantomní P0 cross-user-isolation uzavřen (fixed 31.05)
2. `02a70d0` FIX(engine) — Sprint B soft-degradation TŘÍDA: `UncalculatedError`
   NEPOČÍTÁNO (volume≤0) + rebar=0 honest zero + no-height selektor allow-list;
   backend 422 + MCP reason_cs passthrough. Shared 1349→1360.
3. `cf86dfc` FIX(core) — pasporty přežijí cold start (`passport_store.py`,
   6 testů) + logging v silent-except extraction hotspotech.
4. (v `995fc4c`-násl. DOCS) — B6 URS SQLite→PG descope ticket v BACKLOG.md.
5. `cde47fd` FEAT(calculator) — warnings_structured Phase 2 (severity mirror +
   red/orange/blue UI + AC3 critical gate «Pokračovat přesto»). 1360→1367.
6. (týž blok) FEAT — Resource Ceiling UI: «Stropy zdrojů (firma)» (lidí/čerpadla/
   jeřáby → `resource_ceiling`) + structured violations karta.
7. `85b44f5` FIX(portal) — `/register` route + honored `?redirect=` → org-invite
   flow round-trips (internal-only, no open redirect).
8. `27961f1` REFACTOR — dead-code sweep (CORE monolit_adapter+4 moduly+strays;
   Monolit legacy UI strom + clutter; URS catalog-import; AWS-éra). 1367→1366
   (−1 test smazaného deprecated wrapperu).
9. (tento commit) DOCS — docs-truth: version triangle (v4.38/1366), handoff
   single-point, CALCULATOR_PHILOSOPHY repointy, service CLAUDE.md pravda,
   root CLAUDE.md v4.38.0 changelog + TODO cleanup, soul.md §2+§9.

## Gates (vše zelené)

- Monolit shared **1366** vitest + tsc + vite build (frontend)
- Monolit backend Jest **62/62** (nový 422 kontrakt)
- URS **232/232** (2 flaky LLM-fallback padnutí bez API klíčů se nereprodukují)
- CORE pytest: passport_store 6/6 + mcp_ssot_delegation 18/18; integrations
  barrel import OK
- Portal frontend `tsc && vite build` + prerender OK

## Deliberátně NEuděláno

- **Sprint A (security)** — na explicitní povel Alexandra («последним когда я
  скажу»). Plán = audit-report §6 Спринт A; honest stav v soul.md §2.2.
- **api-access page** — blokováno Lemon Squeezy manual TODOs (webhook secret,
  product IDs). Nešít UI na nezapojený billing.
- **URS SQLite→PG** — vlastní ticket v BACKLOG.md (potřebuje Cloud SQL DB +
  secret + 18 souborů + test port).
- Registry `api/sync.ts` (ověřit Vercel logs) a `classifyRows` (živý) — drženo.

## Next session priorities

1. Alexander: merge-gate této větve (PR na povel; merge-commit, ne squash).
2. Sprint A na povel — začít Portal fail-open (serviceAuth/JWT/billing) +
   Monolit positions/planner-variants ownership, pak URS API-key gate.
3. LIVE-DoD composite #7 na kalkulator.stavagent.cz (z minulé fáze).
4. Zbytky lístků: warnings items 5-7, Resource Ceiling per-profession forma.

## Open questions

- Sprint A rozsah pro URS: API-key gate stačí, nebo rovnou Portal-JWT?
- `api/sync.ts`: má někdo přístup k Vercel logs Registry projektu?
