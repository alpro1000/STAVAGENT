# Next-session handoff — 2026-06-22

> Jak začít příští session. Stručné, akční. Kánon je `docs/soul.md §9` (poslední 2 entry 2026-06-22) + `docs/handoff/STAVAGENT_STATUS_HANDOFF_2026-06-19.md` (T4/Fix-3/Fix-4 detaily).

---

## 0. Jak začít novou session (povinné pořadí čtení)

Per root `CLAUDE.md` „Mandatory reading at session start":
1. `docs/steering/conventions.md` — jak pracovat (mantra, naming, gates)
2. `docs/steering/product.md` · 3. `tech.md` · 4. `structure.md` · 5. `domain.md`
6. `docs/soul.md` — aktuální stav + **§9 session log** (poslední entry = tato fronta)

Pak: `docs/handoff/STAVAGENT_STATUS_HANDOFF_2026-06-19.md` (Fix-3/Fix-4/T4) + tento soubor.

**Session setup:** effort `high`/`max`; adaptive thinking OFF; PŘED kódem čti repo (Grep/Glob/Read), nefabrikuj cesty/SHA/jména.

---

## 1. Stav na main (vše merged)

| PR | Co | Stav |
|---|---|---|
| #1406 | T2 chunked TZ → quantified elements; T1 UWO seam ride-along | ✅ merged |
| #1407 | #1b — `breakdown.py` ctí explicitní `element_type` | ✅ merged + live-ověřeno |
| #1408 | T5 — `find_urs_code` carrier-shape parity | ✅ merged |
| #1409 | T4 — Fix-4 SQL diagnostika + oprava 17 940→**17 904** na main | ✅ merged (`0455ac13`) |

**Branch `claude/fix4-diag-t4` a `claude/find-urs-carrier-t5`** — po merge #1409 redundantní, lze smazat na remote.

**⚠️ 17 904 vs 17 940 — NEPLÉST (pro příští bota i člověka):**
- **17 904 / OTSKP 2025** = keyword-store `otskp.db` seed = co URS-matcher používá **DNES**. Toto je správná hodnota v `find_urs_code` docstringu **teď**.
- **17 940 / OTSKP 2026** = `otskp_embeddings` pgvector (čistý 2026). Lending stránka s 17 940 je fakticky správná (primary-retrieve už jede z embeddings).
- delta = 36, rozštěp je **MEZI sklady** (ne uvnitř). Sync 17904→17940 napříč docs/CLAUDE.md proběhne **AŽ PO** rebaku keyword-store (= T6 Fáze 3). Do té doby `find_urs_code` = 17 904.
- Amazon Q bot na #1409 chtěl revert na 17 940 — **byl chybný**, nezvracet.

---

## 2. Fronta (nezačato) — priorita shora

1. **T6 — vector migrace na gemini-embedding-001 / 3072-dim / halfvec.**
   - Blokery: (a) embedding-vidlice ADR (jak řešit dim≠3072 — manuální L2-norm), (b) odpovědi Google Q2/Q5 z callu (viz `GOOGLE_CALL_2026-06-19_FULL.md`).
   - Fakta z T4: pgvector **0.8.1** → halfvec(3072) ready, bez `ALTER EXTENSION`. HNSW `vector` cap 2000 dim → `halfvec` až 4000.
   - **Skládá dovnitř Fix-4**: jeden re-embed pass = rovnou rebake keyword-store `otskp.db` → 2026/17940. Po rebaku → canon-number sync 17904→17940 (tech.md/product.md/domain.md/root CLAUDE.md).
2. **T7 — kiosk cleanup** (odblokováno T2).
3. **T9 — URS Perplexity větev.**
4. **V1 — „šev"** · **V2 — Pattern 27.**

**Parking / nezapomenout:**
- Deck `/en/pitch`: Monte-Carlo „live today" claim — ověřit veřejnou přesnost (pitch už odešel Cemexu). Deck tahá React z unpkg CDN (ne standalone).
- DWG binárka (ODA/libredwg) v prod image — `.dwg` → `DWG_CONVERSION_FAILED`.
- „Gate C ingest" session recon.

---

## 3. Discipline (osvědčeno tuto session)

- **Merge-gate tiery:** feature = user gate; triviální/docs = Claude self-merge ride-along.
- **CI je částečný signál:** `test-mcp-compatibility.yml` spouští **explicitní allow-list**, ne celou suite. Nový golden MUSÍ přibýt do allow-listu (push + pull_request bloky), jinak v CI neběží. CI instaluje plný `requirements.txt`.
- **Independent venv test:** nové testy re-run v izolovaném venv (chybějící dep = artefakt prostředí, ne regrese — doinstalovat).
- **Rule 605:** každé číslo (norma/seed/verze) ověř u zdroje, nekopíruj od sousedního. (Tuto session: 17 940 zkopírováno omylem k URS.)
- **DSN/heslo NIKDY do chatu.** DB-access pro T4 šel přes Cloud Shell, jen výsledky dotazů do chatu.
- **Po merge ověř, že změna fakt přistála na `origin/main`** (`git log`/`grep`) — squash umí tiše dropnout commit (lekce #1285→#1295).
