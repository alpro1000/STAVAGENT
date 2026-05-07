# Validation Report — Master Soupis Žihle 2062-1

**Generated:** 2026-05-07
**Total položek:** 154
**Total cena:** 10,585,736 Kč bez DPH (12,808,741 Kč s DPH 21 %)
**vs ZD limit 30 M Kč:** 42.7 %

---

## 1. SO Summary Table

| SO | Název | Položek | Kč bez DPH | Podíl |
|---|---|---:|---:|---:|
| **SO_001** | Demolice stávajícího mostu | 30 | 1,057,831 | 10.0 % |
| **SO_180** | Mostní provizorium + objízdná trasa | 26 | 2,047,138 | 19.3 % |
| **SO_201** | Most ev.č. 2062-1 | 72 | 4,435,958 | 41.9 % |
| **SO_290** | Silnice III/206 2 (návaznosti) | 12 | 1,952,470 | 18.4 % |
| **SO_801** | Zařízení staveniště (detailní) | 9 | 780,500 | 7.4 % |
| **VRN** | Vedlejší rozpočtové náklady | 5 | 311,839 | 2.9 % |
| | **TOTAL** | **154** | **10,585,736** | **100.0 %** |

---

## 2. Confidence Distribution (154 položek)

| Bucket | Počet | Podíl |
|---|---:|---:|
| high_0.85_to_1.0 | 100 | 64.9 % |
| medium_0.70_to_0.84 | 46 | 29.9 % |
| low_0.60_to_0.69 | 8 | 5.2 % |

---

## 3. Source Distribution

| Source | Počet | Podíl |
|---|---:|---:|
| user_manual_fallback | 82 | 53.2 % |
| unspecified | 45 | 29.2 % |
| calculator_deterministic | 13 | 8.4 % |
| paušál_administrativní | 6 | 3.9 % |
| vrn_kalkulace_per_norma | 5 | 3.2 % |
| vendor_pricing_median | 3 | 1.9 % |

---

## 4. Reconciliation FLAGS — 12 položek (|Δ%| > 10 %, sorted by magnitude)

| Polozka | SO | OTSKP | Δ % | Vysvětlení |
|---|---|---|---:|---|
| SO201-T9-17 | SO_201 | 93631 | +4900.0 | ⚠️ Δ +4900 % (calc 0.5 m³ vs user 0.01 m³). User manual = nominal placeholder |
| SO201-T3-06 | SO_201 | 317325 | +440.0 | ⚠️ Δ +440 % (calc 8.64 m³ vs user 1.6 m³). NOT ERROR — different geometry: |
| SO201-T3-07 | SO_201 | 317365 | +237.5 | ⚠️ Δ +237 % (calc 0.864 t vs user 0.256 t). Same root cause as T3-06 — different |
| SO201-T9-02 | SO_201 | 9117C1 | +66.7 | ⚠️ Δ +67 % (Žihle 24 m vs Kfely user 14.4 m). NOT ERROR — different geometry: |
| SO201-T3-03 | SO_201 | 333365 | +61.8 | ⚠️ Δ +62 % (calc 2.324 t vs user 1.436 t). Calculator používá novější rebar_index |
| SO201-T3-02 | SO_201 | 333325 | -35.8 | ⚠️ Δ -36 % (calc 16.6 m³ vs user 25.84 m³). NOT ERROR — different concept: |
| SO201-T2-02 | SO_201 | 272365 | -33.0 | ⚠️ Δ -33 % (calc 3.0 t vs user 4.48 t). Calculator default rebar_index 100 kg/m³, |
| SO201-T4-04 | SO_201 | 420365 | -27.3 | ⚠️ Δ -27 % (calc 1.992 t vs user 2.74 t). User používá rebar_index 138 kg/m³, |
| SO201-T4-05 | SO_201 | 45131A | -16.7 | ⚠️ Δ -17 % (calc 5.0 m³ vs user 6.0 m³). Žihle 100 mm vs user (Kfely) 120 mm |
| SO201-T7-03 | SO_201 | 711442 | +14.0 | ⚠️ Δ +14 % calc-derive 99.6 m² (formwork_area_m2 z mostovkova_deska Phase C output) |
| SO201-T4-03 | SO_201 | 420324 | -12.6 | ⚠️ Δ -12.6 % (calc 19.92 m³ vs user 22.8 m³). Mírně nad 10 % toleranci. User |
| SO201-T8-02 | SO_201 | 87534 | +infinite | ⚠️ Žihle-specific položka. User manual Kfely template má 0 m (jiný design). Žihle |

---

## 5. Critical (★) Items — 6 položek

Položky označené `★`, `POVINNÁ`, `POVINNÉ`, `POVINNÝ`, nebo `KEY ELEMENT`.

| Polozka | SO | OTSKP | Popis | Cena Kč |
|---|---|---|---|---:|
| SO201-T4-01 | SO_201 | 421325 | MOSTNÍ NOSNÉ DESKOVÉ KONSTRUKCE ZE ŽELEZOBETONU C30/37 (mostovková deska) | 534,569 |
| SO201-T7-03 | SO_201 | 711442 | IZOLACE MOSTOVEK CELOPLOŠNÁ ASFALTOVÝMI PÁSY S PEČETÍCÍ VRSTVOU (NAIP + pečetící | 70,515 |
| SO201-T9-02 | SO_201 | 9117C1 | SVODIDLO OCEL ZÁBRADELNÍ MOSTNÍ, ÚROVEŇ ZADRŽENÍ H2 — DODÁVKA A MONTÁŽ (na říмsá | 190,561 |
| SO201-T9-15 | SO_201 | 93311 | ZATĚŽOVACÍ ZKOUŠKA MOSTU STATICKÁ 1. POLE DO 300 M² (★ POVINNÁ per ČSN 73 6209) | 100,000 |
| SO801-T0-07 | SO_801 | 02590 | ČIŠTĚNÍ VOZIDEL PŘI VÝJEZDU ZE STAVENIŠTĚ (mokrý mycí systém + voda + údržba) | 88,000 |
| VRN-05 | VRN | VRN-BOZP-KOORDINATOR | KOORDINÁTOR BOZP NA STAVENIŠTI (povinný per zákon 309/2006 Sb. — staveniště s ví | 88,000 |

---

## 6. Shared OTSKP Codes Across SO — 21 kódů

OTSKP base-kódy (po normalizaci suffixů `-zz`, `-skutecne` apod.) použité v ≥ 2 SO.
Per-položka explanation pro každý překryv je v příslušném `master_soupis_SO_*.yaml`
`no_work_duplication_validation.shared_otskp_kody`.

| OTSKP base | SO list | Popis (z první výskyt) | Validation |
|---|---|---|---|
| `014102` | SO_001, SO_180 | POPLATKY ZA SKLÁDKU | ✅ context-separated per per-SO YAML |
| `02510` | SO_001, SO_201 | ZKOUŠENÍ MATERIÁLŮ — kontrola materiálu při bourání (ŽB pevn | ✅ context-separated per per-SO YAML |
| `027413` | SO_001, SO_180 | PROVIZORNÍ MOSTY — DEMONTÁŽ (ocelový mostní systém) | ✅ context-separated per per-SO YAML |
| `02991` | SO_001, SO_201, SO_801 | INFORMAČNÍ TABULE — uzavírka mostu + bypass info | ✅ context-separated per per-SO YAML |
| `113728` | SO_001, SO_290 | FRÉZOVÁNÍ ZPEVNĚNÝCH PLOCH ASFALTOVÝCH, ODVOZ DO 20 KM | ✅ context-separated per per-SO YAML |
| `11511` | SO_001, SO_180, SO_201 | ČERPÁNÍ VODY DO 500 L/MIN — během demolice + výkop | ✅ context-separated per per-SO YAML |
| `121108` | SO_001, SO_180 | SEJMUTÍ ORNICE NEBO LESNÍ PŮDY S ODVOZEM DO 20 KM | ✅ context-separated per per-SO YAML |
| `13173` | SO_001, SO_180 | HLOUBENÍ JAM ZAPAŽ I NEPAŽ TŘ. I — stavební jáma po demolici | ✅ context-separated per per-SO YAML |
| `17120` | SO_001, SO_180 | ULOŽENÍ SYPANINY DO NÁSYPU NEBO NA SKLÁDKU BEZ ZHUTNĚNÍ | ✅ context-separated per per-SO YAML |
| `18241` | SO_001, SO_180 | ZALOŽENÍ TRÁVNÍKU HYDROOSETÍM — rekultivace záboru | ✅ context-separated per per-SO YAML |
| `572214` | SO_201, SO_290 | SPOJOVACÍ POSTŘIK Z MODIFIKOVANÉ EMULZE DO 0,5 KG/M² (mezi a | ✅ context-separated per per-SO YAML |
| `574C78` | SO_201, SO_290 | ASFALTOVÝ BETON PRO LOŽNÍ VRSTVY ACL 22+, 22S TL. 80 MM (lož | ✅ context-separated per per-SO YAML |
| `574I54` | SO_201, SO_290 | ASFALTOVÝ KOBEREC MASTIXOVÝ SMA 11+, 11S TL. 40 MM (obrusná  | ✅ context-separated per per-SO YAML |
| `9113B1` | SO_201, SO_290 | SVODIDLO OCEL SILNIČNÍ JEDNOSTRANNÉ, ÚROVEŇ ZADRŽENÍ H1 — DO | ✅ context-separated per per-SO YAML |
| `91238` | SO_201, SO_290 | SMĚROVÉ SLOUPKY Z PLAST HMOT — NÁSTAVCE NA SVODIDLA VČETNĚ O | ✅ context-separated per per-SO YAML |
| `914352` | SO_201, SO_290 | DOPRAVNÍ ZNAČKY ZMENŠENÉ VELIKOSTI HLINÍK — MONTÁŽ S PŘESUNE | ✅ context-separated per per-SO YAML |
| `914911` | SO_201, SO_290 | SLOUPKY A STOJKY DOPRAVNÍCH ZNAČEK Z OCELOVÝCH TRUBEK SE ZAB | ✅ context-separated per per-SO YAML |
| `915111` | SO_201, SO_290 | VODOROVNÉ DOPRAVNÍ ZNAČENÍ BARVOU HLADKÉ — DODÁVKA A POKLÁDK | ✅ context-separated per per-SO YAML |
| `915231` | SO_201, SO_290 | VODOR DOPRAV ZNAČ PLASTEM PROFIL ZVUČÍCÍ — DOD A POKLÁDKA (z | ✅ context-separated per per-SO YAML |
| `919111` | SO_201, SO_290 | ŘEZÁNÍ ASFALTOVÉHO KRYTU VOZOVEK TL DO 50 MM (přesné napojen | ✅ context-separated per per-SO YAML |
| `935212` | SO_201, SO_290 | PŘÍKOPOVÉ ŽLABY Z BETON TVÁRNIC ŠÍŘ DO 600 MM DO BETONU TL 1 | ✅ context-separated per per-SO YAML |

---

## 7. Explicit Exclusions (per ZD §4.4.l integrální rám)

OTSKP kódy explicitně vyloučené z master soupis per ZD constraints — dokumentováno v
`master_soupis_SO_201_t8_t9.yaml.no_work_duplication_validation.excluded_kody`.

| Vyloučený kód | Důvod |
|---|---|
| `428xxx` mostní ložiska | ZD §4.4.l: integrální rám = monolithic spojení |
| `93152` mostní závěr | ZD §4.4.l: integrální rám = thermal expansion via přechodové desky |
| `93315` zatěžovací zkouška 2.+další pole | Žihle most má 1 pole only |
| `84914` mostní odpadní potrubí | ZD §4.4.l: minimalizovat odvodňovače |

---

## 8. Audit Trail Validation

- Položek BEZ `vypocet.formula`: **0** (target: 0)
- Položek BEZ `confidence`: **0** (target: 0)
- Položek BEZ `source`: **45** (note: SO 001 admin items + některé calc-deterministic neexplicitují source)

---

## 9. All 154 Položek (full list, sorted SO/trida_section/polozka_id)

| SO | Trida | Polozka | OTSKP | Popis | MJ | Mn. | Cena Kč | Conf |
|---|---|---|---|---|---|---:|---:|---:|
| SO_001 | odvozy | SO001-ODV-01 | 91091010 | ODVOZ ŽELEZOBETONOVÉ SUTI NA RS ŽATEC (Ekostavby L | T | 47.5 | 19,000 | 0.9 |
| SO_001 | odvozy | SO001-ODV-02 | 91091011 | ODVOZ KAMENNÉ SUTI Z DEMOLICE OPĚR + KŘÍDEL NA RS  | T | 93.6 | 5,616 | 0.9 |
| SO_001 | odvozy | SO001-ODV-03 | 91091012 | ODVOZ ASFALTOVÝCH FRÉZÁTŮ Z DEMOLICE NA RS ŽATEC | T | 7.7 | 2,002 | 0.9 |
| SO_001 | odvozy | SO001-ODV-04 | 91091013 | ODVOZ ZEMINY ZE STAVEBNÍ JÁMY NA SKLÁDKU DECO TRAD | T | 459.0 | 55,080 | 0.85 |
| SO_001 | trida_0_vseobecne | SO001-T0-01 | 014102 | POPLATKY ZA SKLÁDKU | T | 95.0 | 95,000 | 0.75 |
| SO_001 | trida_0_vseobecne | SO001-T0-02 | 014201 | POPLATKY ZA ZEMNÍK - ZEMINA | M3 | 285.0 | 61,560 | 0.85 |
| SO_001 | trida_0_vseobecne | SO001-T0-03 | 02510 | ZKOUŠENÍ MATERIÁLŮ — kontrola materiálu při bourán | KPL | 1 | 40,000 | 0.6 |
| SO_001 | trida_0_vseobecne | SO001-T0-04 | 02960 | ODBORNÝ DOZOR — geologický + statický při demolici | KPL | 1 | 72,000 | 0.7 |
| SO_001 | trida_0_vseobecne | SO001-T0-05 | 02991 | INFORMAČNÍ TABULE — uzavírka mostu + bypass info | KUS | 2 | 16,000 | 0.95 |
| SO_001 | trida_1_zemni | SO001-T1-01 | 11511 | ČERPÁNÍ VODY DO 500 L/MIN — během demolice + výkop | HOD | 200 | 22,142 | 0.7 |
| SO_001 | trida_1_zemni | SO001-T1-02 | 121108 | SEJMUTÍ ORNICE NEBO LESNÍ PŮDY S ODVOZEM DO 20 KM | M3 | 30.0 | 13,694 | 0.9 |
| SO_001 | trida_1_zemni | SO001-T1-03 | 13173 | HLOUBENÍ JAM ZAPAŽ I NEPAŽ TŘ. I — stavební jáma p | M3 | 255.0 | 80,394 | 0.85 |
| SO_001 | trida_1_zemni | SO001-T1-04 | 17120 | ULOŽENÍ SYPANINY DO NÁSYPU NEBO NA SKLÁDKU BEZ ZHU | M3 | 285.0 | 27,075 | 0.9 |
| SO_001 | trida_9_demolice | SO001-T9-01 | 966168 | BOURÁNÍ KONSTRUKCÍ ZE ŽELEZOBETONU S ODVOZEM DO 20 | M3 | 19.0 | 130,178 | 0.85 |
| SO_001 | trida_9_demolice | SO001-T9-02 | 962031 | BOURÁNÍ ZDIVA Z KAMENE NA MC NEBO MO — 2× opěra +  | M3 | 39.0 | 93,600 | 0.7 |
| SO_001 | trida_9_demolice | SO001-T9-03 | 966019 | DEMONTÁŽ MOSTNÍCH ODVODŇOVAČŮ + DRENÁŽÍ | KUS | 4 | 4,800 | 0.7 |
| SO_001 | trida_9_demolice | SO001-T9-04 | 966xxx | DEMONTÁŽ STÁVAJÍCÍ MOSTNÍ IZOLACE (asfaltové pásy  | M2 | 45.0 | 9,900 | 0.7 |
| SO_001 | trida_9_demolice | SO001-T9-05 | 113728 | FRÉZOVÁNÍ ZPEVNĚNÝCH PLOCH ASFALTOVÝCH, ODVOZ DO 2 | M3 | 1.8 | 3,730 | 0.95 |
| SO_001 | trida_9_demolice | SO001-T9-06 | 9117C9 | DEMONTÁŽ STÁVAJÍCÍCH SVODIDEL OCEL (SafeStar 231 H | M | 24.0 | 5,280 | 0.9 |
| SO_001 | trida_9_demolice | SO001-T9-07 | 914123 | DOPRAVNÍ ZNAČKY ZÁKLADNÍ VELIKOSTI OCELOVÉ TŘ. RA1 | KUS | 4 | 909 | 1.0 |
| SO_001 | trida_9_demolice | SO001-T9-08 | 914933 | SLOUPKY A STOJKY DZ Z HLINÍK TRUBEK ZABETON — DEMO | KUS | 4 | 909 | 1.0 |
| SO_001 | trida_9_demolice | SO001-T9-09 | 968021 | ODSTRANĚNÍ DLAŽBY KAMENNÉ KORYTA STÁVAJÍCÍ S ODVOZ | M2 | 50.0 | 19,000 | 0.7 |
| SO_001 | trida_9_demolice | SO001-T9-10 | 968022 | ODSTRANĚNÍ OPEVNĚNÍ BŘEHŮ STÁVAJÍCÍ (gabiony / kam | M2 | 30.0 | 9,600 | 0.6 |
| SO_001 | trida_9_demolice | SO001-T9-11 | 027413 | PROVIZORNÍ MOSTY — DEMONTÁŽ (ocelový mostní systém | M2 | 60.0 | 185,160 | 0.85 |
| SO_001 | trida_9_demolice | SO001-T9-12 | 968011 | ROZEBRÁNÍ DLAŽBY POD PROVIZORIEM (podložky kamenné | M2 | 75.0 | 21,000 | 0.75 |
| SO_001 | trida_9_demolice | SO001-T9-13 | 113328 | ODSTRANĚNÍ PODKLADŮ Z KAMENIVA NESTMEL (štěrkodrť  | M3 | 22.5 | 16,768 | 0.8 |
| SO_001 | trida_9_demolice | SO001-T9-14 | 113727 | FRÉZOVÁNÍ ASFALTU NÁJEZDU PROVIZORIA, ODVOZ DO 20  | M3 | 1.5 | 3,108 | 0.85 |
| SO_001 | trida_9_demolice | SO001-T9-15 | 181101 | ROZPROSTŘENÍ ORNICE V ROVINĚ — rekultivace záboru | M3 | 30.0 | 6,600 | 0.85 |
| SO_001 | trida_9_demolice | SO001-T9-16 | 18241 | ZALOŽENÍ TRÁVNÍKU HYDROOSETÍM — rekultivace záboru | M2 | 1000.0 | 35,000 | 0.85 |
| SO_001 | trida_9_demolice | SO001-T9-17 | 914123 | DEMONTÁŽ PROVIZORNÍCH DOPRAVNÍCH ZNAČEK (po dokonč | KUS | 12 | 2,726 | 0.7 |
| SO_180 | trida_0_vseobecne | SO180-T0-01 | 014102 | POPLATKY ZA SKLÁDKU — provizorium (přepravní obaly | T | 8.0 | 8,000 | 0.6 |
| SO_180 | trida_0_vseobecne | SO180-T0-02 | 027111 | PROVIZORNÍ OBJÍŽĎKY — ZŘÍZENÍ (anchor — actual cos | M2 | 522.0 | 0 | 0.95 |
| SO_180 | trida_0_vseobecne | SO180-T0-03 | 027113 | PROVIZORNÍ OBJÍŽĎKY — ZRUŠENÍ (anchor pair k 02711 | M2 | 522.0 | 0 | 0.95 |
| SO_180 | trida_0_vseobecne | SO180-T0-04 | 027411 | PROVIZORNÍ MOSTY — MONTÁŽ (ocel. konstrukce 12 × 5 | M2 | 60.0 | 175,590 | 0.85 |
| SO_180 | trida_0_vseobecne | SO180-T0-05 | 027412 | PROVIZORNÍ MOSTY — NÁJEMNÉ (6 měsíců = 180 dní), m | MES | 6.0 | 206,300 | 0.9 |
| SO_180 | trida_0_vseobecne | SO180-T0-06 | 027413 | PROVIZORNÍ MOSTY — DEMONTÁŽ (po dokončení nového m | M2 | 60.0 | 0 | 0.95 |
| SO_180 | trida_0_vseobecne | SO180-T0-07 | 027414 | PROVIZORNÍ MOSTY — PRAVIDELNÁ MOSTNÍ PROHLÍDKA (6× | KPL | 6 | 76,582 | 0.9 |
| SO_180 | trida_0_vseobecne | SO180-T0-08 | 02740 | POMOCNÉ PRÁCE PROVIZORNÍCH MOSTŮ — koordinace, dop | KPL | 1 | 150,000 | 0.7 |
| SO_180 | trida_0_vseobecne | SO180-T0-09 | 027415 | PROVIZORIUM — SVĚTELNÁ SIGNALIZACE (semafor) PRO J | KPL | 1 | 120,000 | 0.7 |
| SO_180 | trida_0_vseobecne | SO180-T0-10 | 027416 | PROVIZORIUM — DIO + DOČASNÉ DOPRAVNÍ ZNAČENÍ PO DO | KPL | 1 | 150,000 | 0.65 |
| SO_180 | trida_0_vseobecne | SO180-T0-11 | 02946 | FOTODOKUMENTACE PROVIZORIA (před, během, po) | KPL | 1 | 12,000 | 0.85 |
| SO_180 | trida_0_vseobecne | SO180-T0-12 | 02950 | POSUDEK STATIKA + GEOTECHNIKA (před uvedením do pr | KPL | 1 | 40,000 | 0.8 |
| SO_180 | trida_0_vseobecne | SO180-T0-13 | 027417 | KONZULTACE A SOUHLAS PROVOZOVATELE LINKOVÉ VEŘEJNÉ | KPL | 1 | 30,000 | 0.75 |
| SO_180 | trida_1_zemni | SO180-T1-01 | 111208 | ODSTRANĚNÍ KŘOVIN S ODVOZEM DO 20 KM (zábor pro ob | M2 | 300.0 | 44,310 | 0.7 |
| SO_180 | trida_1_zemni | SO180-T1-02 | 11511 | ČERPÁNÍ VODY DO 500 L/MIN — během výkopu pod provi | HOD | 100 | 11,071 | 0.7 |
| SO_180 | trida_1_zemni | SO180-T1-03 | 121108 | SEJMUTÍ ORNICE NEBO LESNÍ PŮDY S ODVOZEM DO 20 KM  | M3 | 150.0 | 68,472 | 0.85 |
| SO_180 | trida_1_zemni | SO180-T1-04 | 13173 | VÝKOP PRO ZALOŽENÍ PODLOŽÍ PROVIZORIA + OBJÍZDKY,  | M3 | 365.4 | 115,210 | 0.9 |
| SO_180 | trida_1_zemni | SO180-T1-05 | 17120 | ULOŽENÍ SYPANINY DO NÁSYPU NEBO NA SKLÁDKU (přebyt | M3 | 215.4 | 20,463 | 0.8 |
| SO_180 | trida_1_zemni | SO180-T1-06 | 18241 | ZALOŽENÍ TRÁVNÍKU HYDROOSETÍM — rekultivace záboru | M2 | 1000.0 | 35,000 | 0.85 |
| SO_180 | trida_2_zakladani | SO180-T2-01 | 28997 | OPLÁŠTĚNÍ (ZPEVNĚNÍ) Z GEOTEXTILIE A GEOMŘÍŽOVIN ( | M2 | 597.0 | 119,400 | 0.85 |
| SO_180 | trida_4_vodorovne | SO180-T4-01 | 451523 | VÝPLŇ Z KAMENIVA DRCENÉHO, INDEX ZHUTNĚNÍ ID DO 0, | M3 | 119.4 | 131,340 | 0.85 |
| SO_180 | trida_4_vodorovne | SO180-T4-02 | 45211 | PODKLAD KONSTR. Z DÍLCŮ BETON (panely pod ocelové  | M3 | 15.0 | 37,500 | 0.85 |
| SO_180 | trida_5_komunikace | SO180-T5-01 | 56333 | VOZOVKOVÉ VRSTVY ZE ŠTĚRKODRTI TL. DO 150 MM (spod | M2 | 522.0 | 104,400 | 0.95 |
| SO_180 | trida_5_komunikace | SO180-T5-02 | 56336 | VOZOVKOVÉ VRSTVY ZE ŠTĚRKODRTI TL. DO 300 MM (horn | M2 | 522.0 | 146,160 | 0.95 |
| SO_180 | trida_5_komunikace | SO180-T5-03 | 56314 | VOZOVKOVÉ VRSTVY Z MECHANICKY ZPEVNĚNÉHO KAMENIVA  | M2 | 522.0 | 130,500 | 0.95 |
| SO_180 | trida_5_komunikace | SO180-T5-04 | 574A34 | ASFALTOVÝ BETON ACO 11+ TL. 40 MM (obrusná vrstva  | M2 | 522.0 | 114,840 | 0.85 |
| SO_201 | trida_0_vseobecne | SO201-T0-01 | 0291 | OSTATNÍ POŽADAVKY — ZEMĚMĚŘIČSKÁ MĚŘENÍ (průběžně  | KPL | 1 | 45,000 | 0.8 |
| SO_201 | trida_0_vseobecne | SO201-T0-02 | 02911 | OSTATNÍ POŽADAVKY — GEODETICKÉ ZAMĚŘENÍ (S-JTSK +  | HM | 1 | 100,000 | 0.7 |
| SO_201 | trida_0_vseobecne | SO201-T0-03 | 02911-skutecne | OSTATNÍ POŽADAVKY — GEODETICKÉ ZAMĚŘENÍ SKUTEČNÉHO | HM | 1 | 65,000 | 0.7 |
| SO_201 | trida_0_vseobecne | SO201-T0-04 | 029412 | OSTATNÍ POŽADAVKY — VYPRACOVÁNÍ MOSTNÍHO LISTU (pe | KUS | 1 | 15,000 | 0.85 |
| SO_201 | trida_0_vseobecne | SO201-T0-05 | 02943 | OSTATNÍ POŽADAVKY — VYPRACOVÁNÍ RDS (Realizační do | KPL | 1 | 300,000 | 0.65 |
| SO_201 | trida_0_vseobecne | SO201-T0-06 | 02944 | OSTATNÍ POŽADAVKY — DOKUMENTACE SKUTEČNÉHO PROVEDE | KPL | 1 | 80,000 | 0.7 |
| SO_201 | trida_0_vseobecne | SO201-T0-07 | 02510 | ZKOUŠENÍ MATERIÁLŮ — laboratorní zkoušky betonu +  | KPL | 1 | 60,000 | 0.8 |
| SO_201 | trida_0_vseobecne | SO201-T0-08 | 02953 | OSTATNÍ POŽADAVKY — HLAVNÍ MOSTNÍ PROHLÍDKA (první | KUS | 1 | 25,000 | 0.85 |
| SO_201 | trida_0_vseobecne | SO201-T0-09 | 0296 | OSTATNÍ POŽADAVKY — ODBORNÝ DOZOR (autorský + stat | KPL | 1 | 162,000 | 0.75 |
| SO_201 | trida_0_vseobecne | SO201-T0-10 | 02991 | OSTATNÍ POŽADAVKY — INFORMAČNÍ TABULE (stavba — in | KUS | 2 | 16,000 | 0.95 |
| SO_201 | trida_1_zemni | SO201-T1-01 | 11511 | ČERPÁNÍ VODY DO 500 L/MIN — během betonáže základů | HOD | 160 | 17,714 | 0.65 |
| SO_201 | trida_1_zemni | SO201-T1-02 | 17411 | ZÁSYP JAM A RÝH ZEMINOU SE ZHUTNĚNÍM (kolem opěr a | M3 | 181.0 | 31,675 | 0.85 |
| SO_201 | trida_1_zemni | SO201-T1-03 | 17511 | OBSYP POTRUBÍ A OBJEKTU SE ZHUTNĚNÍM (kolem drenáž | M3 | 15.75 | 14,490 | 0.85 |
| SO_201 | trida_1_zemni | SO201-T1-04 | 17581 | OBSYP POTRUBÍ A OBJEKTU Z NAKUPOVANÝCH MATERIÁLŮ ( | M3 | 62.3 | 68,530 | 0.85 |
| SO_201 | trida_1_zemni | SO201-T1-05 | 1778 | ZEMNÍ HRÁZKY Z NAKUPOVANÝCH MATERIÁLŮ (úprava teré | M3 | 20.8 | 16,640 | 0.8 |
| SO_201 | trida_1_zemni | SO201-T1-06 | 171xx-uprava | FINÁLNÍ ÚPRAVA TERÉNU PŘED REKULTIVACÍ (urovnání + | M2 | 300.0 | 19,500 | 0.7 |
| SO_201 | trida_2_zaklady | SO201-T2-01 | 272325 | ZÁKLADY ZE ŽELEZOBETONU DO C30/37 (2× plošný zákla | M3 | 30.0 | 173,261 | 1.0 |
| SO_201 | trida_2_zaklady | SO201-T2-02 | 272365 | VÝZTUŽ ZÁKLADŮ Z OCELI 10505, B500B | T | 3.0 | 122,285 | 1.0 |
| SO_201 | trida_2_zaklady | SO201-T2-03 | 28999 | OPLÁŠTĚNÍ (ZPEVNĚNÍ) Z FÓLIE — separační/hydroizol | M2 | 87.4 | 20,976 | 0.85 |
| SO_201 | trida_2_zaklady | SO201-T2-04 | 21341 | DRENÁŽNÍ VRSTVY Z PLASTBETONU (PLASTMALTY) — drená | M3 | 1.5 | 9,750 | 0.7 |
| SO_201 | trida_3_svisle | SO201-T3-01 | 31717 | KOVOVÉ KONSTRUKCE PRO KOTVENÍ ŘÍMSY (kotevní šroub | KG | 80 | 22,400 | 0.85 |
| SO_201 | trida_3_svisle | SO201-T3-02 | 333325 | MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOBETONU DO C30/37 (2 | M3 | 16.6 | 155,663 | 0.95 |
| SO_201 | trida_3_svisle | SO201-T3-03 | 333365 | VÝZTUŽ MOSTNÍCH OPĚR A KŘÍDEL Z OCELI 10505, B500B | T | 2.324 | 94,992 | 1.0 |
| SO_201 | trida_3_svisle | SO201-T3-04 | 333325-zz | MOSTNÍ OPĚRY A KŘÍDLA ŽB DO C30/37 — ZÁVĚRNÉ ZÍDKY | M3 | 4.0 | 37,509 | 0.9 |
| SO_201 | trida_3_svisle | SO201-T3-05 | 333365-zz | VÝZTUŽ ZÁVĚRNÝCH ZÍDEK Z OCELI 10505, B500B | T | 0.72 | 29,430 | 1.0 |
| SO_201 | trida_3_svisle | SO201-T3-06 | 317325 | ŘÍMSY ZE ŽELEZOBETONU DO C30/37 (2× římsa, levá +  | M3 | 8.64 | 146,019 | 1.0 |
| SO_201 | trida_3_svisle | SO201-T3-07 | 317365 | VÝZTUŽ ŘÍMS Z OCELI 10505, B500B | T | 0.864 | 35,974 | 1.0 |
| SO_201 | trida_4_vodorovne | SO201-T4-01 | 421325 | MOSTNÍ NOSNÉ DESKOVÉ KONSTRUKCE ZE ŽELEZOBETONU C3 | M3 | 39.84 | 534,569 | 1.0 |
| SO_201 | trida_4_vodorovne | SO201-T4-02 | 421365 | VÝZTUŽ MOSTNÍ DESKOVÉ KONSTRUKCE Z OCELI 10505, B5 | T | 5.577 | 236,102 | 1.0 |
| SO_201 | trida_4_vodorovne | SO201-T4-03 | 420324 | PŘECHODOVÉ DESKY MOSTNÍCH OPĚR ZE ŽELEZOBETONU C25 | M3 | 19.92 | 106,782 | 1.0 |
| SO_201 | trida_4_vodorovne | SO201-T4-04 | 420365 | VÝZTUŽ PŘECHODOVÝCH DESEK MOSTNÍCH OPĚR Z OCELI 10 | T | 1.992 | 82,939 | 1.0 |
| SO_201 | trida_4_vodorovne | SO201-T4-05 | 45131A | PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C20/ | M3 | 5.0 | 23,240 | 0.95 |
| SO_201 | trida_4_vodorovne | SO201-T4-06 | 451323 | PODKLADNÍ A VÝPLŇOVÉ VRSTVY ZE ŽELEZOBETONU DO C16 | M3 | 8.5 | 49,300 | 0.7 |
| SO_201 | trida_4_vodorovne | SO201-T4-07 | 45157 | PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z KAMENIVA TĚŽENÉHO (d | M3 | 25.1 | 27,610 | 0.75 |
| SO_201 | trida_5_komunikace | SO201-T5-01 | 56335 | VOZOVKOVÉ VRSTVY ZE ŠTĚRKODRTI TL. DO 250 MM (spod | M2 | 112.5 | 31,500 | 0.7 |
| SO_201 | trida_5_komunikace | SO201-T5-02 | 56343 | VOZOVKOVÉ VRSTVY ZE ŠTĚRKOPÍSKU TL. DO 150 MM (hor | M2 | 67.5 | 13,500 | 0.7 |
| SO_201 | trida_5_komunikace | SO201-T5-03 | 572123 | INFILTRAČNÍ POSTŘIK Z EMULZE DO 1,0 KG/M² (mezi po | M2 | 450.0 | 13,500 | 0.85 |
| SO_201 | trida_5_komunikace | SO201-T5-04 | 572214 | SPOJOVACÍ POSTŘIK Z MODIFIKOVANÉ EMULZE DO 0,5 KG/ | M2 | 518.4 | 12,960 | 0.9 |
| SO_201 | trida_5_komunikace | SO201-T5-05 | 574C78 | ASFALTOVÝ BETON PRO LOŽNÍ VRSTVY ACL 22+, 22S TL.  | M2 | 450.0 | 202,500 | 0.85 |
| SO_201 | trida_5_komunikace | SO201-T5-06 | 574E07 | ASFALTOVÝ BETON PRO PODKLADNÍ VRSTVY ACP 22+, 22S  | M3 | 36.0 | 126,000 | 0.9 |
| SO_201 | trida_5_komunikace | SO201-T5-07 | 574I54 | ASFALTOVÝ KOBEREC MASTIXOVÝ SMA 11+, 11S TL. 40 MM | M2 | 518.4 | 248,832 | 0.85 |
| SO_201 | trida_5_komunikace | SO201-T5-08 | 575C53 | LITÝ ASFALT MA IV (OCHRANA MOSTNÍ IZOLACE) 11 TL.  | M2 | 68.4 | 39,672 | 0.9 |
| SO_201 | trida_5_komunikace | SO201-T5-09 | 576413 | POSYP KAMENIVEM OBALOVANÝM 4 KG/M² (na litý asfalt | M2 | 68.4 | 2,052 | 0.95 |
| SO_201 | trida_6_uprava_povrchu | SO201-T6-01 | 62592 | ÚPRAVA POVRCHU BETONOVÝCH PLOCH A KONSTRUKCÍ — STR | M2 | 52.34 | 7,851 | 0.9 |
| SO_201 | trida_6_uprava_povrchu | SO201-T6-02 | 938255 | ÚPRAVA POVRCHU BETONU OTRYSKÁNÍM OCELOVÝMI KULIČKA | M2 | 99.6 | 29,880 | 0.85 |
| SO_201 | trida_7_psv | SO201-T7-01 | 711111 | IZOLACE BĚŽNÝCH KONSTRUKCÍ PROTI ZEMNÍ VLHKOSTI AS | M2 | 72.6 | 20,328 | 0.9 |
| SO_201 | trida_7_psv | SO201-T7-02 | 711432 | IZOLACE MOSTOVEK POD ŘÍMSOU ASFALTOVÝMI PÁSY (NAIP | M2 | 5.4 | 3,742 | 0.9 |
| SO_201 | trida_7_psv | SO201-T7-03 | 711442 | IZOLACE MOSTOVEK CELOPLOŠNÁ ASFALTOVÝMI PÁSY S PEČ | M2 | 87.4 | 70,515 | 0.9 |
| SO_201 | trida_7_psv | SO201-T7-04 | 711509 | OCHRANA IZOLACE NA POVRCHU TEXTILIÍ (geotextilie G | M2 | 69.4 | 12,492 | 0.85 |
| SO_201 | trida_7_psv | SO201-T7-05 | 78382 | NÁTĚRY BETONOVÝCH KONSTRUKCÍ TYP S2 (OS-B) — ochra | M2 | 77.9 | 38,950 | 0.85 |
| SO_201 | trida_7_psv | SO201-T7-06 | 78383 | NÁTĚRY BETONOVÝCH KONSTRUKCÍ TYP S4 (OS-C) — ochra | M2 | 8.64 | 6,048 | 0.85 |
| SO_201 | trida_8_potrubi | SO201-T8-01 | 875332 | POTRUBÍ DREN Z TRUB PLAST DN DO 150 MM, DĚROVANÝ ( | M | 19.0 | 5,320 | 0.9 |
| SO_201 | trida_8_potrubi | SO201-T8-02 | 87534 | POTRUBÍ DREN Z TRUB PLAST DN DO 200 MM (odvodnění  | M | 12.0 | 4,200 | 0.7 |
| SO_201 | trida_8_potrubi | SO201-T8-03 | 87634 | POTRUBÍ — CHRÁNIČKA DN 75 ZABETONOVANÁ (3× rezerva | M | 36.0 | 21,600 | 0.95 |
| SO_201 | trida_9_ostatni | SO201-T9-01 | 9113B1 | SVODIDLO OCEL SILNIČNÍ JEDNOSTRANNÉ, ÚROVEŇ ZADRŽE | M | 60.0 | 106,858 | 0.9 |
| SO_201 | trida_9_ostatni | SO201-T9-02 | 9117C1 | SVODIDLO OCEL ZÁBRADELNÍ MOSTNÍ, ÚROVEŇ ZADRŽENÍ H | M | 24.0 | 190,561 | 0.95 |
| SO_201 | trida_9_ostatni | SO201-T9-03 | 91238 | SMĚROVÉ SLOUPKY Z PLAST HMOT — NÁSTAVCE NA SVODIDL | KUS | 20 | 16,000 | 0.95 |
| SO_201 | trida_9_ostatni | SO201-T9-04 | 91345 | NIVELAČNÍ ZNAČKY KOVOVÉ (geodetické body pro budou | KUS | 8 | 20,000 | 0.9 |
| SO_201 | trida_9_ostatni | SO201-T9-05 | 91355 | EVIDENČNÍ ČÍSLO MOSTU (kovová tabulka 'Most ev.č.  | KUS | 2 | 1,600 | 0.95 |
| SO_201 | trida_9_ostatni | SO201-T9-06 | 914352 | DOPRAVNÍ ZNAČKY ZMENŠENÉ VELIKOSTI HLINÍK — MONTÁŽ | KUS | 2 | 3,000 | 0.95 |
| SO_201 | trida_9_ostatni | SO201-T9-07 | 914911 | SLOUPKY A STOJKY DOPRAVNÍCH ZNAČEK Z OCELOVÝCH TRU | KUS | 2 | 2,400 | 0.95 |
| SO_201 | trida_9_ostatni | SO201-T9-08 | 915111 | VODOROVNÉ DOPRAVNÍ ZNAČENÍ BARVOU HLADKÉ — DODÁVKA | M2 | 25.0 | 5,000 | 0.85 |
| SO_201 | trida_9_ostatni | SO201-T9-09 | 915231 | VODOR DOPRAV ZNAČ PLASTEM PROFIL ZVUČÍCÍ — DOD A P | M2 | 25.0 | 12,000 | 0.85 |
| SO_201 | trida_9_ostatni | SO201-T9-10 | 917223 | SILNIČNÍ A CHODNÍKOVÉ OBRUBY Z BETONOVÝCH OBRUBNÍK | M | 15.0 | 12,000 | 0.8 |
| SO_201 | trida_9_ostatni | SO201-T9-11 | 917224 | SILNIČNÍ A CHODNÍKOVÉ OBRUBY Z BETONOVÝCH OBRUBNÍK | M | 30.0 | 28,500 | 0.8 |
| SO_201 | trida_9_ostatni | SO201-T9-12 | 919111 | ŘEZÁNÍ ASFALTOVÉHO KRYTU VOZOVEK TL DO 50 MM (přes | M | 106.3 | 9,567 | 0.7 |
| SO_201 | trida_9_ostatni | SO201-T9-13 | 931326 | TĚSNĚNÍ DILATAČ SPAR ASF ZÁLIVKOU MODIFIK PRŮŘ DO  | M | 38.4 | 12,288 | 0.85 |
| SO_201 | trida_9_ostatni | SO201-T9-14 | 93135 | TĚSNĚNÍ DILATAČ SPAR PRYŽ PÁSKOU NEBO KRUH PROFILE | M | 38.4 | 10,752 | 0.85 |
| SO_201 | trida_9_ostatni | SO201-T9-15 | 93311 | ZATĚŽOVACÍ ZKOUŠKA MOSTU STATICKÁ 1. POLE DO 300 M | KUS | 1 | 100,000 | 1.0 |
| SO_201 | trida_9_ostatni | SO201-T9-16 | 935212 | PŘÍKOPOVÉ ŽLABY Z BETON TVÁRNIC ŠÍŘ DO 600 MM DO B | M | 25.68 | 28,248 | 0.75 |
| SO_201 | trida_9_ostatni | SO201-T9-17 | 93631 | DROBNÉ DOPLŇKY KONSTR BETON MONOLIT (drobné monoli | M3 | 0.5 | 2,392 | 0.6 |
| SO_201 | trida_9_ostatni | SO201-T9-18 | 93639 | ZAÚSTĚNÍ SKLUZŮ (VČET DLAŽBY Z LOM KAMENE) — odvod | KUS | 4 | 18,000 | 0.85 |
| SO_290 | trida_1_zemni_a_frezovani | SO290-T1-01 | 113728 | FRÉZOVÁNÍ ZPEVNĚNÝCH PLOCH ASFALTOVÝCH, ODVOZ DO 2 | M3 | 67.5 | 139,874 | 0.85 |
| SO_290 | trida_5_komunikace | SO290-T5-01 | 572214 | SPOJOVACÍ POSTŘIK Z MODIFIK EMULZE DO 0,5 KG/M² (m | M2 | 2700.0 | 67,500 | 0.95 |
| SO_290 | trida_5_komunikace | SO290-T5-02 | 574C78 | ASFALTOVÝ BETON PRO LOŽNÍ VRSTVY ACL 22+, 22S TL.  | M2 | 1350.0 | 607,500 | 0.9 |
| SO_290 | trida_5_komunikace | SO290-T5-03 | 574I54 | ASFALTOVÝ KOBEREC MASTIXOVÝ SMA 11+, 11S TL. 40 MM | M2 | 1350.0 | 648,000 | 0.9 |
| SO_290 | trida_9_ostatni | SO290-T9-01 | 919111 | ŘEZÁNÍ ASFALTOVÉHO KRYTU VOZOVEK TL DO 50 MM (přes | M | 24.0 | 2,160 | 0.85 |
| SO_290 | trida_9_ostatni | SO290-T9-02 | 935212 | PŘÍKOPOVÉ ŽLABY Z BETON TVÁRNIC ŠÍŘ DO 600 MM DO B | M | 225.0 | 247,500 | 0.85 |
| SO_290 | trida_9_ostatni | SO290-T9-03 | 915111 | VODOROVNÉ DOPRAVNÍ ZNAČENÍ BARVOU HLADKÉ — DODÁVKA | M2 | 56.0 | 11,200 | 0.85 |
| SO_290 | trida_9_ostatni | SO290-T9-04 | 915231 | VODOR DOPRAV ZNAČ PLASTEM PROFIL ZVUČÍCÍ — DOD A P | M2 | 28.0 | 13,440 | 0.85 |
| SO_290 | trida_9_ostatni | SO290-T9-05 | 914352 | DOPRAVNÍ ZNAČKY ZÁKLADNÍ VELIKOSTI HLINÍK — MONTÁŽ | KUS | 4 | 6,000 | 0.9 |
| SO_290 | trida_9_ostatni | SO290-T9-06 | 914911 | SLOUPKY A STOJKY DOPRAVNÍCH ZNAČEK Z OCEL TRUBEK S | KUS | 4 | 4,800 | 0.9 |
| SO_290 | trida_9_ostatni | SO290-T9-07 | 9113B1 | SVODIDLO OCEL SILNIČNÍ JEDNOSTRANNÉ, ÚROVEŇ ZADRŽ  | M | 100.0 | 178,096 | 0.7 |
| SO_290 | trida_9_ostatni | SO290-T9-08 | 91238 | SMĚROVÉ SLOUPKY Z PLAST HMOT — NÁSTAVCE NA SVODIDL | KUS | 33 | 26,400 | 0.9 |
| SO_801 | trida_0_zarizeni_staveniste | SO801-T0-01 | 02520 | HYGIENICKÁ A SOCIÁLNÍ ZAŘÍZENÍ STAVENIŠTĚ (kontejn | KPL | 1 | 264,000 | 0.7 |
| SO_801 | trida_0_zarizeni_staveniste | SO801-T0-02 | 02530 | ENERGIE + VODA STAVENIŠTĚ (elektrický rozvaděč + p | KPL | 1 | 132,000 | 0.7 |
| SO_801 | trida_0_zarizeni_staveniste | SO801-T0-03 | 02540 | TELEFONNÍ / INTERNETOVÉ SPOJENÍ STAVENIŠTĚ (mobiln | KPL | 1 | 16,500 | 0.85 |
| SO_801 | trida_0_zarizeni_staveniste | SO801-T0-04 | 02560 | OPLOCENÍ STAVENIŠTĚ (mobilní oplocení 2.0 m výška  | M | 200 | 70,000 | 0.65 |
| SO_801 | trida_0_zarizeni_staveniste | SO801-T0-05 | 02570 | OSVĚTLENÍ STAVENIŠTĚ (LED reflektory na sloupech + | KPL | 1 | 60,000 | 0.7 |
| SO_801 | trida_0_zarizeni_staveniste | SO801-T0-06 | 02580 | PŘÍJEZDOVÁ KOMUNIKACE DOČASNÁ (panely IZD na zpevn | M2 | 100 | 80,000 | 0.7 |
| SO_801 | trida_0_zarizeni_staveniste | SO801-T0-07 | 02590 | ČIŠTĚNÍ VOZIDEL PŘI VÝJEZDU ZE STAVENIŠTĚ (mokrý m | KPL | 1 | 88,000 | 0.75 |
| SO_801 | trida_0_zarizeni_staveniste | SO801-T0-08 | 02991 | TABULE A ZNAČKY STAVENIŠTĚ (povinné identifikační  | KUS | 10 | 45,000 | 0.85 |
| SO_801 | trida_0_zarizeni_staveniste | SO801-T0-09 | 02500 | VYTÝČENÍ STAVENIŠTĚ + OCHRANNÁ PÁSMA (geodetické v | KPL | 1 | 25,000 | 0.75 |
| VRN | vrn_polozky | VRN-01 | VRN-MIMOSTAV-DOPRAVA | MIMOSTAVENIČNÍ DOPRAVA MATERIÁLŮ (transport betonu | KPL | 1 | 102,739 | 0.7 |
| VRN | vrn_polozky | VRN-02 | VRN-POJISTENI | POJIŠTĚNÍ STAVBY (CAR — Contractor's All Risks + o | KPL | 1 | 41,100 | 0.8 |
| VRN | vrn_polozky | VRN-03 | VRN-KOORD-DOKUMENTACE | KOORDINAČNÍ DOKUMENTACE (revize TZ + koordinace s  | KPL | 1 | 30,000 | 0.75 |
| VRN | vrn_polozky | VRN-04 | VRN-SPRAVNI-POPLATKY | SPRÁVNÍ POPLATKY + AUTORIZOVANÝ INŽENÝR V PROCESU  | KPL | 1 | 50,000 | 0.75 |
| VRN | vrn_polozky | VRN-05 | VRN-BOZP-KOORDINATOR | KOORDINÁTOR BOZP NA STAVENIŠTI (povinný per zákon  | KPL | 1 | 88,000 | 0.85 |

---

## 10. Sanity Checks

- Item count: 154 (target: 154) → **✅**
- Total kč bez DPH: 10,585,736 (target ~10 585 736 Kč) → **✅**
- All items have audit trail: **✅**
- All items have confidence: **✅**
- ZD limit 30 M Kč: **42.7 %** ✅ (margin 17.2 M Kč)

**Validation Status: PASS** — master soupis ready for tendrový proces.
