# SŽ (SŽDC) S8/3 — technologické listy kolejových mechanismů (přílohy předpisu)

Primární zdroj výkonových norem strojů pro Zeleznice-Planner kiosk
(TASK Příloha A: „přílohy S8/3 jsou nejcennější zdroj pro §3.7").
Confidence vrstvy 0.85 (technologický list / předpis správce) — nad
katalogovými 0.80, pod firemní normou 0.99.

| Soubor | Stroj | Klíčová data (ověřeno textem přílohy) |
|---|---|---|
| `priloha_III_15_svm_1000_cz.pdf` | **Obnovovací stroj SVM 1000 CZ** (Příloha III/15, účinnost 1.9.2016) | průměrná pracovní rychlost **400 m/hod**; technologický výkon **11 pražců/min**; nejmenší poloměr pro práci **300 m** (přejezd 150/100 m); **osádka 12** (vedoucí stroje + 1 kladení/vybírání pražců + 2 ramena kleští + 1 manipulátor + 2 podložky + 2 zalomené pražce + 1 řezání kolejnic + 2 proklady); **napěťová výluka a výluka koleje nutná**; vlivy na výkon: povolování upevňovadel, oblouky < 300 m, překážky, technologická kázeň doprovodných prací; návaznost S3/1 + Zam1 |

Nahráno Alexandrem 2026-07-23. Hodnoty promítnuty do
`kb/zeleznicni_mechanizace.yaml` (stroj `svm_1000_cz`) — single-source,
engine je čte z kb-generated artefaktu. Další přílohy S8/3 (ASP, čističky,
stabilizátory, pluhy…) doplňovat do této složky.
