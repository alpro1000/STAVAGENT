# Analyze

**Method:** recon mapa (Explore agent, 2026-07-17).

## Root cause (dvě skládající se fakta)

1. **Generace prací je import/kalkulátor-only.** Sourozenecké work-řádky +
   TOV vznikají výhradně v `applyPlanToPositions` (kalkulátor «Aplikovat»);
   import je negeneruje. Přeznačení nikdy negeneruje nic.
2. **Subtype-flip byl podmíněný a single-row.** `handleSetMonolithOverride`
   (`FlatPositionsTable.tsx`) flipnul `subtype='beton'` jen když rep-řádek měl
   jednotku m³. Ne-m³ řádek (t/ks/m²) dostal jen `is_monolith_override=true` →
   zelené ✓ bez beton-řádku → «Vypočítat» (gated na `betonPos`) se NIKDY
   neukázal → betonový rozpad nedosažitelný.

## Verdict (Alexander, 2026-07-18) — varianta (а)

Tlačítko staví `subtype='beton'` NEZÁVISLE na jednotce + otevírá «Vypočítat».
Práce — pouze z engine (kalkulátor); druhý generátor prací NEBUDE.
Podslučaj «rep-řádek není m³» = jmenovitý test.
