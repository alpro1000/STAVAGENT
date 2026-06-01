# Position-by-position Quality Audit — RD Jáchymov

**Generated:** 2026-06-01
**Items checked:** 229 (active, excl. 4 deprecated)
**Issues flagged:** 78

> Pragmatic stylistic-quality worksheet. NOT auto-fixed — human review per row.
> Goal is to surface ~50-100 actionable issues, not exhaustive noise.
> Dimensions:
> 1. Popis terminology (RU loanwords, mixed Czech/RU, ellipsis placeholders)
> 2. MJ-qty sanity (mj must match work-type in popis: beton → m³, okno → ks, …)
> 3. URS family ↔ kapitola (URS code first digit ↔ chapter family)
> 4. Subdodavatel logical match (kapitola → expected trade set)
> 5. Confidence appropriate for source (DXF=0.95, regex=0.85, fallback=0.75, …)

## Summary

| Dimension | Issues |
|---|--:|
| subdodavatel_logical | 46 |
| urs_family_consistency | 32 |

**By severity:** informational=78


---

## urs_family_consistency (32 issues)

| item_id | severity | popis (truncated) | reason |
|---|---|---|---|
| `260219_dum.HSV1.004` | ⚪ informational | Anglický dvorek: betonová dlažba 50 mm + kladecí vrstva kame | URS kód 596811220 prvních digit '5' neodpovídá HSV-1 expected ['1'] — likely cross-category položka per Corpus Pattern 0 |
| `260219_dum.HSV1.005` | ⚪ informational | Terasa za opěrnou stěnou — PODKLADNÍ SKLADBA pod dřevěnou po | URS kód 564 prvních digit '5' neodpovídá HSV-1 expected ['1'] — likely cross-category položka per Corpus Pattern 04 (wor |
| `260217_sklad.HSV1.001` | ⚪ informational | Sejmutí ornice a demolice stávajících kamenných zídek a scho | URS kód 962031132 prvních digit '9' neodpovídá HSV-1 expected ['1'] — likely cross-category položka per Corpus Pattern 0 |
| `260219_dum.HSV2.005` | ⚪ informational | Separační PE fólie pod základovou patou bílé vany (povinná d | URS kód 711141 prvních digit '7' neodpovídá HSV-2 expected ['2', '3'] — likely cross-category položka per Corpus Pattern |
| `260217_sklad.HSV2.005` | ⚪ informational | Štěrkopískové lože pod podlahu skladu + pod schodišťovou des | URS kód 174101101 prvních digit '1' neodpovídá HSV-2 expected ['2', '3'] — likely cross-category položka per Corpus Patt |
| `260219_dum.HSV3.005` | ⚪ informational | Zesílení ostění úhelníky L100/10 dvojicí u otvoru u komínové | URS kód 767131120 prvních digit '7' neodpovídá HSV-3 expected ['3'] — likely cross-category položka per Corpus Pattern 0 |
| `260219_dum.HSV3.006` | ⚪ informational | Dočasné podstojkování stávajících přiléhajících stropů při o | URS kód 962081120 prvních digit '9' neodpovídá HSV-3 expected ['3'] — likely cross-category položka per Corpus Pattern 0 |
| `260217_sklad.HSV3.003` | ⚪ informational | Výztuž B500B do tvarovek ztraceného bednění (~30 kg/m² stěny | URS kód 273361821 prvních digit '2' neodpovídá HSV-3 expected ['3'] — likely cross-category položka per Corpus Pattern 0 |
| `260219_dum.HSV4.006` | ⚪ informational | Protipožární SDK podhled pod trapézovým plechem (EI 30 dle P | URS kód 342213131 prvních digit '3' neodpovídá HSV-4 expected ['4'] — likely cross-category položka per Corpus Pattern 0 |
| `260219_dum.HSV4.007` | ⚪ informational | Vyvezení původního zásypu z cihelné klenby 1.PP/1.NP — manuá | URS kód 974031150 prvních digit '9' neodpovídá HSV-4 expected ['4'] — likely cross-category položka per Corpus Pattern 0 |
| `260219_dum.HSV4.008` | ⚪ informational | Nový zásyp klenby 1.PP/1.NP — perlitbeton (lehký zásyp) tl.  | URS kód 271223111 prvních digit '2' neodpovídá HSV-4 expected ['4'] — likely cross-category položka per Corpus Pattern 0 |
| `260219_dum.HSV4.009` | ⚪ informational | Plastická perlitbetonová roznášecí vrstva tl. 50 mm nad zásy | URS kód 631321311 prvních digit '6' neodpovídá HSV-4 expected ['4'] — likely cross-category položka per Corpus Pattern 0 |
| `260219_dum.HSV4.010` | ⚪ informational | Strop trámový 1.NP/2.NP — sejmutí podlah, demontáž záklopu a | URS kód 974041141 prvních digit '9' neodpovídá HSV-4 expected ['4'] — likely cross-category položka per Corpus Pattern 0 |
| `260219_dum.HSV4.011` | ⚪ informational | Tepelná izolace minerální vata mezi trámy stropu 1.NP/2.NP,  | URS kód 713121121 prvních digit '7' neodpovídá HSV-4 expected ['4'] — likely cross-category položka per Corpus Pattern 0 |
| `260219_dum.HSV4.012` | ⚪ informational | Protipožární SDK podhled zespodu trámového stropu (EI 30 dle | URS kód 342213131 prvních digit '3' neodpovídá HSV-4 expected ['4'] — likely cross-category položka per Corpus Pattern 0 |
| `260219_dum.HSV4.013` | ⚪ informational | Suchá podlahová skladba 1.NP/2.NP — zásyp Liapor pro vyrovná | URS kód 631311114 prvních digit '6' neodpovídá HSV-4 expected ['4'] — likely cross-category položka per Corpus Pattern 0 |
| `260219_dum.HSV4.014` | ⚪ informational | Suchá podlahová skladba — sádrovláknité dílce Fermacell tl.  | URS kód 771421111 prvních digit '7' neodpovídá HSV-4 expected ['4'] — likely cross-category položka per Corpus Pattern 0 |
| `260217_sklad.HSV4.001` | ⚪ informational | Dřevěné stropnice 100/160 mm á 625 mm primární zastřešení sk | URS kód 762341110 prvních digit '7' neodpovídá HSV-4 expected ['4'] — likely cross-category položka per Corpus Pattern 0 |
| `260217_sklad.HSV4.002` | ⚪ informational | Prkenný záklop stropnic skladu tl. 20 mm + impregnace | URS kód 762331110 prvních digit '7' neodpovídá HSV-4 expected ['4'] — likely cross-category položka per Corpus Pattern 0 |
| `260217_sklad.HSV4.003` | ⚪ informational | Hydroizolační střešní souvrství skladu (modifikovaný asfalto | URS kód 712331101 prvních digit '7' neodpovídá HSV-4 expected ['4'] — likely cross-category položka per Corpus Pattern 0 |
| `260217_sklad.HSV4.006` | ⚪ informational | Žárově zinková povrchová úprava IPE180 + pororoštů dle ČSN E | URS kód 783201001 prvních digit '7' neodpovídá HSV-4 expected ['4'] — likely cross-category položka per Corpus Pattern 0 |
| `260219_dum.HSV5.005` | ⚪ informational | Ocelová středová vaznice HEA160 — 2 ks × cca 10 m délka | URS kód 411321414 prvních digit '4' neodpovídá HSV-5 expected ['5', '6', '7'] — likely cross-category položka per Corpus |
| `260219_dum.HSV5.006` | ⚪ informational | Ocelové sloupky uzavřený profil 100×100×4 mm pod vaznice HEA | URS kód 411321414 prvních digit '4' neodpovídá HSV-5 expected ['5', '6', '7'] — likely cross-category položka per Corpus |
| `260219_dum.HSV5.015` | ⚪ informational | Vikýře — zděná čela z Porotherm 30 (odhad 4 ks × ~3 m² stěna | URS kód 311321411 prvních digit '3' neodpovídá HSV-5 expected ['5', '6', '7'] — likely cross-category položka per Corpus |
| `260219_dum.PSV77.005` | ⚪ informational | Mokrá podlahová skladba — betonový potěr s kari síťkou 4/100 | URS kód 631321311 prvních digit '6' neodpovídá PSV-77 expected ['5', '7', '9'] — likely cross-category položka per Corpu |
| `260219_dum.PSV95.002` | ⚪ informational | Přenosný hasicí přístroj 34A dle PBŘ — min. 1 ks na společné | URS kód 966067121 prvních digit '9' neodpovídá PSV-95 expected ['0', '3'] — likely cross-category položka per Corpus Pat |
| `260219_dum.M21.007` | ⚪ informational | Výchozí revize elektrické instalace dle ČSN 33 2000-6 + revi | URS kód 996019011 prvních digit '9' neodpovídá M-21 expected ['0', '2', '7'] — likely cross-category položka per Corpus  |
| `260219_dum.HSV1.015` | ⚪ informational | Drenáž za opěrnou stěnou (bílou vanou) — drenážní trubka DN1 | URS kód 877315111 prvních digit '8' neodpovídá HSV-1 expected ['1'] — likely cross-category položka per Corpus Pattern 0 |
| `260217_sklad.HSV5.001` | ⚪ informational | Sklad mezipodesta schodiště — prefa betonové stupně (9 ks ×  | URS kód 121301101 prvních digit '1' neodpovídá HSV-5 expected ['5', '6', '7'] — likely cross-category položka per Corpus |
| `260219_dum.HSV4.015` | ⚪ informational | Desky kročejové izolace (Isover T-P) tl. 30 mm — trámový str | URS kód 713191 prvních digit '7' neodpovídá HSV-4 expected ['4'] — likely cross-category položka per Corpus Pattern 04 ( |
| `260219_dum.HSV4.017` | ⚪ informational | Tepelná/akustická izolace minerální vata výplň mezi ocelové  | URS kód 713121 prvních digit '7' neodpovídá HSV-4 expected ['4'] — likely cross-category položka per Corpus Pattern 04 ( |
| `260219_dum.HSV4.019` | ⚪ informational | Desky kročejové izolace (Isover T-P) tl. 30 mm — suchá sklad | URS kód 713191 prvních digit '7' neodpovídá HSV-4 expected ['4'] — likely cross-category položka per Corpus Pattern 04 ( |

---

## subdodavatel_logical (46 issues)

| item_id | severity | popis (truncated) | reason |
|---|---|---|---|
| `260219_dum.HSV1.004` | ⚪ informational | Anglický dvorek: betonová dlažba 50 mm + kladecí vrstva kame | Subdodavatel 'podlahar' neodpovídá HSV-1 default set — typically Pattern 04 cross-category (e.g. HSV-1 'Anglický dvorek  |
| `260219_dum.HSV1.005` | ⚪ informational | Terasa za opěrnou stěnou — PODKLADNÍ SKLADBA pod dřevěnou po | Subdodavatel 'podlahar' neodpovídá HSV-1 default set — typically Pattern 04 cross-category (e.g. HSV-1 'Anglický dvorek  |
| `260217_sklad.HSV1.001` | ⚪ informational | Sejmutí ornice a demolice stávajících kamenných zídek a scho | Subdodavatel 'bourani_demolice' neodpovídá HSV-1 default set — typically Pattern 04 cross-category (e.g. HSV-1 'Anglický |
| `260219_dum.HSV2.010` | ⚪ informational | Nabetonávka stropu 2.NP/3.NP — beton C25/30 XC1 tl. 60 mm na | Subdodavatel 'ocelobeton_strop_IPE_trapez' neodpovídá HSV-2 default set — typically Pattern 04 cross-category (e.g. HSV- |
| `260219_dum.HSV2.011` | ⚪ informational | Výztuž nabetonávky kari síť 5/100/100 (cca 4.4 kg/m²) | Subdodavatel 'ocelobeton_strop_IPE_trapez' neodpovídá HSV-2 default set — typically Pattern 04 cross-category (e.g. HSV- |
| `260217_sklad.HSV2.005` | ⚪ informational | Štěrkopískové lože pod podlahu skladu + pod schodišťovou des | Subdodavatel 'zemni_prace' neodpovídá HSV-2 default set — typically Pattern 04 cross-category (e.g. HSV-1 'Anglický dvor |
| `260219_dum.HSV3.006` | ⚪ informational | Dočasné podstojkování stávajících přiléhajících stropů při o | Subdodavatel 'zelezobetonarsky_specialny' neodpovídá HSV-3 default set — typically Pattern 04 cross-category (e.g. HSV-1 |
| `260217_sklad.HSV3.003` | ⚪ informational | Výztuž B500B do tvarovek ztraceného bednění (~30 kg/m² stěny | Subdodavatel 'zelezobetonarsky_specialny' neodpovídá HSV-3 default set — typically Pattern 04 cross-category (e.g. HSV-1 |
| `260219_dum.HSV4.006` | ⚪ informational | Protipožární SDK podhled pod trapézovým plechem (EI 30 dle P | Subdodavatel 'sadrokartonar' neodpovídá HSV-4 default set — typically Pattern 04 cross-category (e.g. HSV-1 'Anglický dv |
| `260219_dum.HSV4.007` | ⚪ informational | Vyvezení původního zásypu z cihelné klenby 1.PP/1.NP — manuá | Subdodavatel 'bourani_demolice' neodpovídá HSV-4 default set — typically Pattern 04 cross-category (e.g. HSV-1 'Anglický |
| `260219_dum.HSV4.010` | ⚪ informational | Strop trámový 1.NP/2.NP — sejmutí podlah, demontáž záklopu a | Subdodavatel 'bourani_demolice' neodpovídá HSV-4 default set — typically Pattern 04 cross-category (e.g. HSV-1 'Anglický |
| `260219_dum.HSV4.011` | ⚪ informational | Tepelná izolace minerální vata mezi trámy stropu 1.NP/2.NP,  | Subdodavatel 'izolater_TI' neodpovídá HSV-4 default set — typically Pattern 04 cross-category (e.g. HSV-1 'Anglický dvor |
| `260219_dum.HSV4.012` | ⚪ informational | Protipožární SDK podhled zespodu trámového stropu (EI 30 dle | Subdodavatel 'sadrokartonar' neodpovídá HSV-4 default set — typically Pattern 04 cross-category (e.g. HSV-1 'Anglický dv |
| `260217_sklad.HSV4.003` | ⚪ informational | Hydroizolační střešní souvrství skladu (modifikovaný asfalto | Subdodavatel 'izolater_HI' neodpovídá HSV-4 default set — typically Pattern 04 cross-category (e.g. HSV-1 'Anglický dvor |
| `260219_dum.HSV5.005` | ⚪ informational | Ocelová středová vaznice HEA160 — 2 ks × cca 10 m délka | Subdodavatel 'ocel_zamecnik_konstrukce' neodpovídá HSV-5 default set — typically Pattern 04 cross-category (e.g. HSV-1 ' |
| `260219_dum.HSV5.006` | ⚪ informational | Ocelové sloupky uzavřený profil 100×100×4 mm pod vaznice HEA | Subdodavatel 'ocel_zamecnik_konstrukce' neodpovídá HSV-5 default set — typically Pattern 04 cross-category (e.g. HSV-1 ' |
| `260219_dum.HSV5.008` | ⚪ informational | Parotěsná folie nad bedněním pod nadkrokevní PIR (např. Isov | Subdodavatel 'izolater_HI' neodpovídá HSV-5 default set — typically Pattern 04 cross-category (e.g. HSV-1 'Anglický dvor |
| `260219_dum.HSV5.010` | ⚪ informational | Doplňková hydroizolační difuzně otevřená folie nad PIR pod k | Subdodavatel 'izolater_HI' neodpovídá HSV-5 default set — typically Pattern 04 cross-category (e.g. HSV-1 'Anglický dvor |
| `260219_dum.HSV5.015` | ⚪ informational | Vikýře — zděná čela z Porotherm 30 (odhad 4 ks × ~3 m² stěna | Subdodavatel 'zednik' neodpovídá HSV-5 default set — typically Pattern 04 cross-category (e.g. HSV-1 'Anglický dvorek dl |
| `260219_dum.PSV77.004` | ⚪ informational | Nášlapná vrstva biodeska (smrk masiv) nebo OSB v 3.NP spací  | Subdodavatel 'biodeska_konstrukcni' neodpovídá PSV-77 default set — typically Pattern 04 cross-category (e.g. HSV-1 'Ang |
| `260219_dum.PSV95.002` | ⚪ informational | Přenosný hasicí přístroj 34A dle PBŘ — min. 1 ks na společné | Subdodavatel 'VRN_management' neodpovídá PSV-95 default set — typically Pattern 04 cross-category (e.g. HSV-1 'Anglický  |
| `260219_dum.M21.007` | ⚪ informational | Výchozí revize elektrické instalace dle ČSN 33 2000-6 + revi | Subdodavatel 'revize_specialista' neodpovídá M-21 default set — typically Pattern 04 cross-category (e.g. HSV-1 'Anglick |
| `260219_dum.VRN.101` | ⚪ informational | Kontejnery na suť tříděnou velkoobjemové (beton/cihly, dřevo | Subdodavatel 'bourani_demolice' neodpovídá VRN default set — typically Pattern 04 cross-category (e.g. HSV-1 'Anglický d |
| `260219_dum.VRN.103` | ⚪ informational | Likvidace stavební suti dle vyhl. 8/2021 Sb. — skládkovné +  | Subdodavatel 'bourani_demolice' neodpovídá VRN default set — typically Pattern 04 cross-category (e.g. HSV-1 'Anglický d |
| `260217_sklad.VRN.001` | ⚪ informational | Doprava prefa H-BLOK Standard z výrobny Herkul (Obrnice) aut | Subdodavatel 'prefa_bloky_specialista' neodpovídá VRN default set — typically Pattern 04 cross-category (e.g. HSV-1 'Ang |
| `260217_sklad.VRN.002` | ⚪ informational | Likvidace odpadu sklad — kameny ze zídek + výkop + dřevo (dr | Subdodavatel 'bourani_demolice' neodpovídá VRN default set — typically Pattern 04 cross-category (e.g. HSV-1 'Anglický d |
| `260219_dum.HSV1.015` | ⚪ informational | Drenáž za opěrnou stěnou (bílou vanou) — drenážní trubka DN1 | Subdodavatel 'izolater_HI' neodpovídá HSV-1 default set — typically Pattern 04 cross-category (e.g. HSV-1 'Anglický dvor |
| `260217_sklad.HSV5.001` | ⚪ informational | Sklad mezipodesta schodiště — prefa betonové stupně (9 ks ×  | Subdodavatel 'betonar' neodpovídá HSV-5 default set — typically Pattern 04 cross-category (e.g. HSV-1 'Anglický dvorek d |
| `260219_dum.HSV1.016` | ⚪ informational | Venkovní schody na terénu z betonových dílců do betonového l | Subdodavatel 'zednik' neodpovídá HSV-1 default set — typically Pattern 04 cross-category (e.g. HSV-1 'Anglický dvorek dl |
| `260219_dum.HSV5.017` | ⚪ informational | Montáž svorníků / šroubů tesařských spojů krovu délky přes 1 | Subdodavatel 'tesar' neodpovídá HSV-5 default set — typically Pattern 04 cross-category (e.g. HSV-1 'Anglický dvorek dla |
| `260219_dum.HSV4.015` | ⚪ informational | Desky kročejové izolace (Isover T-P) tl. 30 mm — trámový str | Subdodavatel 'izolater_TI' neodpovídá HSV-4 default set — typically Pattern 04 cross-category (e.g. HSV-1 'Anglický dvor |
| `260219_dum.HSV4.016` | ⚪ informational | Separační geotextilie pod suchý podsyp — trámový strop 1.NP/ | Subdodavatel 'izolater_TI' neodpovídá HSV-4 default set — typically Pattern 04 cross-category (e.g. HSV-1 'Anglický dvor |
| `260219_dum.HSV4.017` | ⚪ informational | Tepelná/akustická izolace minerální vata výplň mezi ocelové  | Subdodavatel 'izolater_TI' neodpovídá HSV-4 default set — typically Pattern 04 cross-category (e.g. HSV-1 'Anglický dvor |
| `260219_dum.HSV4.018` | ⚪ informational | Roznášecí sádrovláknité dílce Fermacell 2E22 tl. 25 mm — suc | Subdodavatel 'suchá_vystavba' neodpovídá HSV-4 default set — typically Pattern 04 cross-category (e.g. HSV-1 'Anglický d |
| `260219_dum.HSV4.019` | ⚪ informational | Desky kročejové izolace (Isover T-P) tl. 30 mm — suchá sklad | Subdodavatel 'izolater_TI' neodpovídá HSV-4 default set — typically Pattern 04 cross-category (e.g. HSV-1 'Anglický dvor |
| `260219_dum.HSV4.020` | ⚪ informational | Vyrovnávací suchý podsyp keramzit/liapor + dřevěný rošt tl.  | Subdodavatel 'suchá_vystavba' neodpovídá HSV-4 default set — typically Pattern 04 cross-category (e.g. HSV-1 'Anglický d |
| `260219_dum.HSV4.021` | ⚪ informational | Separační vrstva pod suchý podsyp — nad cihelnou klembou S08 | Subdodavatel 'suchá_vystavba' neodpovídá HSV-4 default set — typically Pattern 04 cross-category (e.g. HSV-1 'Anglický d |
| `260219_dum.HSV7.007` | ⚪ informational | Sanační zateplení soklu — sanační izolační deska Styrcon 200 | Subdodavatel 'fasader' neodpovídá HSV-7 default set — typically Pattern 04 cross-category (e.g. HSV-1 'Anglický dvorek d |
| `260219_dum.HSV7.008` | ⚪ informational | Drenážní vrstva — nopová folie tl. 20 mm na suterénní stěnu  | Subdodavatel 'izolater_HI' neodpovídá HSV-7 default set — typically Pattern 04 cross-category (e.g. HSV-1 'Anglický dvor |
| `260219_dum.HSV7.009` | ⚪ informational | Provětrávaná mezera s kotevním roštem 40 mm + keramický obkl | Subdodavatel 'obkladac' neodpovídá HSV-7 default set — typically Pattern 04 cross-category (e.g. HSV-1 'Anglický dvorek  |
| `260219_dum.HSV5.018` | ⚪ informational | Pojistná hydroizolační folie pod hliníkovou falcovanou kryti | Subdodavatel 'pokryvac' neodpovídá HSV-5 default set — typically Pattern 04 cross-category (e.g. HSV-1 'Anglický dvorek  |
| `260219_dum.HSV6.018` | ⚪ informational | Demontáž stávajícího vnějšího keramického obkladu suterénní  | Subdodavatel 'bourac' neodpovídá HSV-6 default set — typically Pattern 04 cross-category (e.g. HSV-1 'Anglický dvorek dl |
| `260217_sklad.HSV5.002` | ⚪ informational | Napojení vjezdu na ulici Dvořákova — vydláždění z betonových | Subdodavatel 'komunikace' neodpovídá HSV-5 default set — typically Pattern 04 cross-category (e.g. HSV-1 'Anglický dvore |
| `260217_sklad.PSV76.002` | ⚪ informational | Vjezdová brána na pozemku investora (ocelová) — dodávka + mo | Subdodavatel 'zamecnik' neodpovídá PSV-76 default set — typically Pattern 04 cross-category (e.g. HSV-1 'Anglický dvorek |
| `260219_dum.M21.008` | ⚪ informational | Hlavní vypínač elektrické energie TOTAL STOP + požární znače | Subdodavatel 'elektrikar' neodpovídá M-21 default set — typically Pattern 04 cross-category (e.g. HSV-1 'Anglický dvorek |
| `260219_dum.PSV95.003` | ⚪ informational | Předávací protokol krbu na tuhá paliva + kontrola bezpečných | Subdodavatel 'topenar' neodpovídá PSV-95 default set — typically Pattern 04 cross-category (e.g. HSV-1 'Anglický dvorek  |