# Bug: Ruční «označit jako beton» nechá práce jako «jiné»

**Reported:** 2026-07-17 (Alexander, živý test velké tabulky, hlasem z auta)
**Severity:** P1 — přeznačený beton nemá betonový rozpad prací

## Symptom

Import nerozpoznal některé betonové řádky. Uživatel je označil ✓ toggle jako
monolit — ярлык se změnil, ale práce zůstaly «jiné»: betonový набор prací se
neobjevil a nebyla cesta ho získat.

## Expected

Označení = skupina se chová jako beton: má beton-řádek, tlačítko «Vypočítat»
je dostupné, práce vzniknou kalkulátorem (Aplikovat).
