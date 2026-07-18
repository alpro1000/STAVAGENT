# Analyze — proč export nevidí ručně označené betony

**Method:** 8-anglová recon mapa (Explore agent, 2026-07-17) + verifikace čtením.

## Root cause

Backend-filtr exportu (`backend/src/routes/export.js` `filterMonolithicPositions`)
**nedůvěřoval** aktuálnímu `subtype`: pro každý part vzal beton-řádek a znovu ho
klasifikoval přes `isMonolithicElement({item_name, otskp_code, metadata})` — tj.
z PŮVODNÍHO importního textu/kódu. Ruční přeznačení mění `subtype` (a někdy
`metadata.is_monolith_override`), což filtr částečně ignoroval; part bez řádku
`subtype='beton'` zahodil celý.

## Compounding

- Frontend «Jen monolity» (`FlatPositionsTable.elementIsMonolith`) byl **jiný
  predikát** (rep-row + override + m³-gate + text re-klasifikace) → «v tabulce
  vidím, v exportu ne».
- KPI «Prvků» (`FlatKPIPanel`) = třetí chování (čistý subtype count).

## Verdict (Alexander, 2026-07-18)

Jediný predikát «co je monolit» — jedna funkce na jednom místě s testem,
používaná front-filtrem, backend-exportem i KPI. Ruční označení = pravda;
re-klasifikace původního textu při exportu umírá.
