# TASK: Cemex Pre-flight — čistá půda před W2 (StageGating)

**Typ:** úklid + ověření, read/docs only. Žádná změna kódové logiky.
**Navazuje na:** audit `docs/audits/task_completion/2026-05-28_repo_wide.md` (PR #1244).
**Cíl:** odstranit tři překážky, které audit našel, aby W2 (StageGating MVP) startoval na jednom zdroji pravdy.

---

## Session Mantra
Nejdřív přečti celý repozitář a zmíněný audit. Nic nemaž a nepřejmenovávej naslepo —
nejdřív zjisti skutečný stav, pak navrhni změnu. Naming a strukturu drž podle stávajících
konvencí. Minimální chirurgické zásahy. Žádná změna výpočetní ani business logiky v tomto úkolu.

## Pre-implementation interview (POVINNÉ před jakoukoli změnou)
Spusť AskUserQuestion a počkej na odpovědi:
1. Který adresář task/spec souborů je kanonický — ten v `docs/` nebo ten v `docs/tasks/`? Do něj se vše sloučí.
2. Provenance gap: mají se viseté odkazy na neexistující `docs/audits/pre_cemex_2026_06_28/…` přesměrovat
   na existující audit (PR #1244), nebo se má dotyčný pre_cemex deliverable teprve vytvořit
   (a pokud ano, patří to sem, nebo do samostatného úkolu)?
3. Mají se byte-identické duplikáty odstranit rovnou (přes review PR), nebo jen vypsat k ruční volbě?

---

## Kontext
Audit přes 42 task/spec souborů našel tři věci, které brzdí čistý start W2:
- **Duplicita:** několik byte-identických párů a dva paralelní adresáře task souborů (`docs/` vs `docs/tasks/`).
  Sem patří i nadbytečný `TASK_WorkFirst_OntologyChain_Orchestrator` — duplikuje existující orchestrator rodinu
  (StageGating / SO250 / SO202 / KROS_Adapter) a má být odstraněn.
- **Provenance gap:** víc tasků cituje audit `docs/audits/pre_cemex_2026_06_28/…`, který neexistuje —
  nedoručený deliverable tasku `AUDIT_MCP_Isolation_Cemex_Sidelines`.
- **Nejasný stav work-first:** není ověřeno, zda sestavení výkazu už umí režim „nejdřív práce, bez katalogu"
  (klíčový předpoklad W2, AC#19 StageGating).

---

## Co udělat

### Blok 1 — Dedup korpusu tasků
1. Najdi všechny task/spec soubory napříč oběma adresáři a urči byte-identické duplikáty a obsahově překrývající se páry.
2. Byte-identické duplikáty sjednoť do kanonického adresáře (dle odpovědi z interview); zbytek odstraň přes review PR.
3. Obsahově překrývající (ne identické) páry **nemaž** — vypiš je s krátkým popisem rozdílu k ruční volbě uživatele.
4. Odstraň nadbytečný `TASK_WorkFirst_OntologyChain_Orchestrator` jako duplikát orchestrator rodiny.
5. Výsledek: jeden adresář = jeden zdroj pravdy pro tasky.

### Blok 2 — Provenance gap
1. Najdi všechna místa, která odkazují na neexistující `docs/audits/pre_cemex_2026_06_28/…`.
2. U každého odkazu urči, jaký obsah měl poskytnout.
3. Vyřeš dle odpovědi z interview: buď přesměruj na existující audit (#1244), nebo (pokud uživatel řekne)
   vytvoř minimální chybějící deliverable, nebo odkaz výslovně označ jako odložený s důvodem.
4. Po dokončení nesmí v repu zůstat žádný visetý odkaz na neexistující audit.

### Blok 3 — Ověření work-first sestavení výkazu (read-only)
1. Najdi v kódu sestavení výkazu a zjisti, zda existuje režim „nejdřív práce" (bez katalogových kódů a cen).
2. Ověř proti reálnému kódu/testům, ne podle dokumentace: existuje? funguje? je otestován?
3. Vrať verdikt DONE / PARTIAL / NOT_DONE s konkrétním důkazem (symbol + test), a co případně chybí pro W2.
4. **Nic v této logice neměň** — jen ověř a popiš.

---

## Doménová pravidla
- Mazání je destruktivní → odstraňuj jen byte-identické duplikáty, a vždy přes review PR, který uživatel mergne ručně.
- Obsahově odlišné soubory se nikdy neslučují automaticky — jen se hlásí k rozhodnutí.
- Žádná změna výpočetní/business logiky. Blok 3 je čistě read-only.
- Provenance se neřeší vymyšleným obsahem — buď přesměrování na reálný audit, nebo poctivá značka „odloženo".

---

## Acceptance criteria
1. Existuje jeden kanonický adresář task/spec souborů; byte-identické duplikáty odstraněny přes PR.
2. Obsahově překrývající páry vypsány k ruční volbě (ne smazány).
3. Nadbytečný work-first orchestrator duplikát odstraněn.
4. V repu nezůstal žádný odkaz na neexistující `pre_cemex_2026_06_28` audit — každý vyřešen (přesměrován / vytvořen / označen odložený).
5. Krátký pre-flight report (dle konvence audit dokumentů) shrnuje: co se sloučilo/smazalo, jak vyřešen provenance gap, a verdikt o work-first sestavení výkazu.
6. Verdikt o work-first režimu je doložen reálným symbolem a testem, ne dokumentací.
7. Žádná změna kódové logiky; diff obsahuje jen přesuny/mazání dokumentů, opravy odkazů a report.

---

## CO NEPATŘÍ do tohoto úkolu (ЧТО НЕ ВХОДИТ)
- Žádná implementace W2 (state machine, policy gateway, session, replay) — to je samostatný následující úkol.
- Žádná stavba MCP policy vrstvy.
- Žádná změna sestavení výkazu ani jiné výpočetní logiky — Blok 3 jen ověřuje.
- Žádné automatické mazání obsahově odlišných souborů.
- Žádný ADK.

---

## Naming rule
Naming a strukturu drž podle stávajících konvencí v repu (zejména konvence audit dokumentů).
Per-task PR: commit → push → uživatel merguje přes GitHub UI.
