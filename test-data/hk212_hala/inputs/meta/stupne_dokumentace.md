# Stupně dokumentace projektu

Projekt je v **smíšeném stupni** — to není chyba, ale typický fázovaný progress:

| Část | Stupeň | Zpracoval | Stav |
|---|---|---|---|
| ARS (D.1.1) | **DPZ** (Dokumentace pro povolení záměru) | Basepoint, Volka | 08/2025 hotovo |
| Statika (D.1.2) | **DSP** (Dokumentace pro stavební povolení) | Plachý, Doležal | 09/2025 hotovo |
| PBŘ (D.1.3) | bez explicitního stupně | externí (č. 2025/60-034) | hotovo |
| TZB profese (D.1.4) | nedoručeno | různé | **chybí** |
| Technologie strojů | externí (2966-1) | neznámá kancelář | **nedodán** |

## Co znamená DPZ vs DSP pro rozpočet

- **DPZ** je nižší stupeň PD — schéma + základní rozměry + materialitelnost, **bez tabulek elementů** (0020–0080).
- **DSP** má vyšší detail — tabulky dveří, oken, skladeb (typicky), ale ne kompletní detaily provádění.
- **DRS/DPS** (Dokumentace pro provádění stavby) — má všechny tabulky + detaily.

Pro tento projekt:
- ARS = DPZ → **tabulky elementů (0020/0030/0041/0042/0080) neexistují** (musíme spatial extraction z DXF + textovou analýzu TZ).
- Statika = DSP → **kompletní výpočet** dostupný, ale bez prováděcích výkresů armování.

## Pracovní přístup

Jelikož mezi částmi je rozdíl ve stupni, **přednost má vždy vyšší stupeň**:
- Statika (DSP) přebíjí ARS (DPZ) pro konstrukční otázky (např. třída betonu — ABMV #5).
- PBŘ přebíjí ARS pro požární klasifikace (DP1/DP3 — ABMV #6).
- ARS určuje rozměry a uspořádání kde neexistuje statický nebo PBŘ rozpor.

## Nekonzistence titulků

TZ A a TZ B (Basepoint) mají v hlavičce "Dokumentace pro povolení stavby (DPS)", ale obsah i razítka výkresové části říkají DPZ. Pracovní interpretace: **překlep v hlavičkách**, ARS = DPZ.

Viz ABMV #4 (žádost o oficiální sjednocení).
