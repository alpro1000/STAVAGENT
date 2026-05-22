# GATE 8.4 — 11c_AVK_smeta polish summary

**Generated:** 1779377297.8924751

## Row counts

- Before: 6,790 data rows
- After: 7,181 data rows
- Delta: +391

## Step A — Added LOKACE for skip-status masters

Total new LOKACE: **446** across 21 MATERIÁL parent rows

| G-kód | Skip masters | Popis |
|---|---:|---|
| G001 | 8 | Malba disperzní — dodávka barvy |
| G002 | 47 | Penetrace pod potěr |
| G003 | 47 | Kari síť 150/150/4 mm pro potěr |
| G007 | 47 | Cementový potěr F5 tl. 50 mm |
| G053 | 8 | Penetrace podhledu pod malbu (CF20/F17) |
| G054 | 8 | Malba podhledu disperzní 1. nátěr (CF20/F17) |
| G055 | 8 | Malba podhledu disperzní 2. nátěr (CF20/F17) |
| G103 | 8 | SDK podhled Knauf D112 — systémové zavěšení 54mm + Pevné des |
| G118 | 5 | Kročejová izolace 25mm — minerální hydrofobizovaná vlna |
| G119 | 5 | Polystyrenbeton PSB 50 instalační vrstva 40mm (Liapor Mix) |
| G594 | 1 | Vyboření drážek pro elektroinstalace v stěnách |
| G596 | 1 | Vrtání prostupů pro potrubí ZTI/VZT (cca 30 prostupů) |

## Step B — Deleted G-groups

- **G039** Lepidlo flexibilní pod dlažbu (duplicates sub-item under another master)

## Step C — Rate deviation flags (>10 % off KB)

Total flagged: **17**

| Pol. č. | G | Vstup | Current | KB | Δ% |
|---|---|---|---:|---:|---:|
| G039.M1 | G039 | Lepidlo flexibilní pod dlažbu | 1.0 | 5.0 | 80.0% |
| G041.M1 | G041 | Spárovací hmota | 1.0 | 0.5 | 100.0% |
| G049.M1 | G049 | Lepidlo na vinyl | 1.0 | 5.0 | 80.0% |
| G077.M1 | G077 | Lepidlo flexibilní pod obklad | 1.0 | 5.0 | 80.0% |
| G078.M1 | G078 | Spárovací hmota epoxidová | 1.0 | 0.5 | 100.0% |
| G135.M1 | G135 | Lepidlo flexibilní pro cihelné pásky | 1.0 | 5.0 | 80.0% |
| G137.M1 | G137 | Spárovací hmota Polyblend S | 1.0 | 0.5 | 100.0% |
| G169.M1 | G169 | Latě 30×50 mm rozteč 330 mm pod bobrovku | 1.0 | 36.0 | 97.2% |
| G206.M1 | G206 | Tondach bobrovka — počet kusů | 1.0 | 36.0 | 97.2% |
| G207.M1 | G207 | Hřebenáče Tondach | 1.0 | 36.0 | 97.2% |
| G209.M1 | G209 | Prostupová taška Tondach OP50 | 1.0 | 36.0 | 97.2% |
| G358.M1 | G358 | OP50: Průchodka, oplechování a keramický | 1.0 | 36.0 | 97.2% |
| G359.M1 | G359 | OP51: Průchodka, oplechování a keramický | 1.0 | 36.0 | 97.2% |
| G400.M1 | G400 | Tmel akrylový ostění oken | 1.0 | 0.05 | 1900.0% |
| G417.M1 | G417 | Ochranné zábrany na okrajích atik + balk | 1.0 | 0.1 | 900.0% |
| G591.M1 | G591 | Odstranění samolepicích pásek + ochranný | 1.0 | 0.1 | 900.0% |
| G631.M1 | G631 | Montáž průchodky v krytině — Průchodka,  | 1.0 | 36.0 | 97.2% |

## Step D — Area completeness flags

Total flagged: **0**
