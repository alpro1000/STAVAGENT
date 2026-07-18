# Bug: Velká tabulka a kalkulátor počítají dny dvěma nezávislými aritmetikami

**Reported:** 2026-07-17 (Alexander, živý test velké tabulky Monolit Planner, hlasem z auta)
**Severity:** P1 — dva výsledky pro «Celkem dní» téhož elementu podle toho, kterou cestou uživatel šel
**Type:** SDD ticket — design-first, KÓD SE NEPÍŠE dokud Alexander neodpoví na interview (§Interview)

## Symptom (slovy Alexandra)

Dvě cesty žijí odděleně:

1. **Cesta A (kalkulátor):** Otevřu z pozice kalkulátor, dám «Vypočítat» → «Aplikovat».
   Do velké tabulky se zapíší práce (TOV) i DNY podle výpočtu kalkulátoru
   (zrání jako překrývající se vrstva, kritická cesta).

2. **Cesta B (ruční):** V té samé tabulce pak něco změním RUKOU bez kalkulátoru —
   např. dny zrání betonu. Tabulka «přičte tyto dny přímo k dnům prací»
   lineárně, a ostatní se nepřepočítá / nic konzistentně nezmění.

Dvě logiky velké tabulky a kalkulátoru žijí odděleně: co zapíše «Aplikovat»,
ruční editace nezná; co spočítá ruční editace, kalkulátorová projekce přebije.

## Expected (k ratifikaci v interview)

Jedna aritmetika dní pro tabulku / Gantt / export / KPI. Ruční editace ví o
kalkulátorové projekci a naopak — buď ji poctivě invaliduje (bez tichého
přebití), nebo je jasně definováno, kdo vyhrává a proč, VIDITELNĚ.
