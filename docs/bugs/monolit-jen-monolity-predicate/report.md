# Bug: Export «Jen monolity» teryaet ručně označené betony

**Reported:** 2026-07-17 (Alexander, živý test velké tabulky Monolit Planner, hlasem z auta)
**Severity:** P1 — data user vidí v tabulce, ale export je tiše vynechá

## Symptom

1. Import Excelu → některé betonové řádky nejsou rozpoznány jako beton.
2. Uživatel je ručně označí jako beton (✓ toggle / subtype).
3. Tabulka je pod filtrem «Jen monolity» ukazuje.
4. **Export s «Jen monolity» je NEobsahuje** — objeví se až po vypnutí filtru.

## Expected

Ruční označení = pravda. Co filtr v tabulce ukazuje, to export exportuje —
jeden predikát pro tabulku, export i KPI.
