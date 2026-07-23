# PZS P137 — Výstavba PZS na přejezdu P137 v km 13,250, trať Sokolov–Kraslice

**Golden objekt pro Zeleznice-Planner kiosk** (Příloha B TASKu — spec
`docs/specs/zeleznicni-svrsek-spodek/`, Gate 7 AC 17).

- **Stavebník:** Správa železnic, s. o. (Stavební správa západ) · **Projektant:** VIAMONT Projekt, s.r.o.
- **Stupeň:** Dokumentace pro společné povolení + PDPS · definitivní odevzdání 18.06.2025
- **Objekty:** SO 02-10-01 železniční svršek + SO 02-11-01 železniční spodek (část D.2.1.1 „Kolejový svršek a spodek", komplex SK 02-00-02)
- **Trať:** jednokolejná neelektrifikovaná regionální dráha Sokolov–Kraslice; úsek od km 12,940; k.ú. Hory u Oloví
- **Realizace dle soupisu:** 10/2025–11/2025 · cenová úroveň 2025 · ISPROFIN 3273514800

## Inventář → co která příloha krmí

| Soubor | Obsah | Krmí |
|---|---|---|
| `tz/SK020002_1_001_TZ.pdf` (14 str.) | Technická zpráva SO 02-10-01 + SO 02-11-01 (identifikace, stávající stav svršku, navržené řešení) | RailPlannerInput (sestava, úsek, rozdělení), budoucí TZ-extraction |
| `vykresy/SK020002_2_003_vzorove_pricne_rezy.pdf` (1 list, M 1:50) | Vzorové příčné řezy — profil kolejového lože a pláně | `ballast_profile` (plocha/parametry z řezu — Pattern 39: číst VISION, ne text-extractem) |
| `vykaz/SK020002_4_001_soupis_praci.pdf` (8 str.) | **Soupis prací / rozpočet SO 02-10-01** — FORMULÁŘ SO/PS (SOPS/PR/2022), klasifikace 824, slepý rozpočet s R-položkami a vzorci množství (např. dřevěné pražce „9*0.085=0.765 [A]") | **Zpětná kalibrace dekompozice** (úplnost výkazu, golden test AC 17) |
| `geotechnika/SK020002_3_001_geotechnika_zkpp.pdf` (35 str.) | Geotechnický průzkum + návrh ZKPP (konstrukce pražcového podloží; pokrývá i P135 km 11,257) | Spodek — fáze 2 (deterministika konstrukčních vrstev) |

## Honest gaps (k doplnění — Alexander: „это еще не все")

- situace + podélný profil s km staničením (Příloha B)
- soupis SO 02-11-01 (spodek) — pokud existuje samostatně
- skutečné nasazení strojů a časy realizace (pro kalibraci výkonů — až po stavbě)

> ⚠️ Výkres řezů číst multimodálně (Pattern 39) — text-extract vrací jen
> útržky kót (1,820 / 4,516 / 5,466). Číselné hodnoty profilu NEpřebírat
> z tohoto README — jen z výkresu.
