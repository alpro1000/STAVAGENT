# IGP ALTAGEO 526 026 — Podrobný inženýrskogeologický průzkum

**Source:** Originál PDF poskytnut uživatelem v session 2026-05-24. Text uložen zde
jako kanonická extrakce (PDF k dispozici u objednatele basepoint s.r.o.).

**Lokalizace:** `inputs/dokumentace/IGP_ALTAGEO_526026.md` (placement per user instruction)

---

## Hlavičkové údaje

| Pole | Hodnota |
|---|---|
| Zakázka | Hradec Králové – Slezské Předměstí, výstavba skladové haly |
| Číslo zakázky | 526 026 |
| Číslo dokumentu | 00.640.200 |
| Geofond | 1144/2026 |
| Archiv | 00.640.200 |
| Etapa | Podrobný inženýrskogeologický průzkum |
| Lokalita | Hradec Králové, p. č. 1939/1, k.ú. Slezské Předměstí (646971) |
| Objednatel | basepoint s.r.o., Květoslava Mašity 251, 252 31 Všenory, IČO 27646793 |
| Zhotovitel | ALTAGEO s.r.o., Mendelova 738, 149 00 Praha 11 – Háje, IČO 21055424 |
| Vypracoval | Mgr. Jan Beneda |
| Datum | 04/2026 (terénní práce 02.04.2026; podpis 13.04.2026) |

## Klíčové parametry pro VV (extract per kapitoly)

### §3.3 Geologické poměry — navážky GT1
- **Mocnost navážek 0,6 – 2,2 m** (recent antropogenní)
- Tvořeny převážně středně ulehlými písčitými štěrky, žlutošedé barvy
- V prostoru J-2 navážky tvořeny písčitými hlínami/jíly (pravděpodobně zpětný zásyp jímky na odpadní vodu)
- ČSN P 73 1005 třída Y — **nevhodný typ základové půdy**
- Kvartérní pokryv celková mocnost ~3 m

### §3.4 / §4.2 Hydrogeologie — HPV
- **Ustálená HPV 1,65 – 1,80 m p.t.** (úroveň 232,74 – 233,04 m n.m.)
- Naražená HPV 1,80 m (J-1) / 2,20 m (J-2)
- Studna HV-1 ustálená 1,74 m p.t.
- **Podzemní voda neovlivňuje základové poměry** (per §4.2 závěr a §5)
- Generální směr proudění k západu, k Piletickému potoku
- Mírné kolísání během roku dle srážek

### §4.1 Geotechnické typy podzákladí

| Typ | Popis | Třída ČSN P 73 1005 | Rdt | Edef | γn |
|---|---|---|---:|---:|---:|
| GT1 | navážky (písčité štěrky / hlíny / jíly) | **Y (nevhodná)** | — | — | — |
| GT2 | písčité štěrky, středně ulehlé, žlutohnědé | G3 G-F | **250 kPa** | 50–60 MPa | 19,0 kN/m³ |
| GT3 | písky jemnozrnné–středně zrnité | S3 S-F | 200 kPa | 16–18 MPa | 17,5 kN/m³ |
| GT4 | silně zvětralé slínovce, R5, šedé | R5 | 250 kPa | 40 MPa | 21 kN/m³ |

- Povrch skalního podkladu (GT4) v úrovni **3,50 – 3,80 m p.t.**

### §4.3 Základové poměry
- **Geotechnická kategorie: 1** (jednoduché poměry, nenáročná konstrukce)
- ČSN EN 1997-1 (Eurokód 7) + ČSN P 73 1005

#### §4.3.1 Plošné založení — PRIMÁRNÍ (per IGP recommendation)
- "Objekt skladové haly lze založit **plošně na základových patkách** do písčitých štěrků GT2"
- **Rdt = 250 kPa** (matches/exceeds statika D.1.2 conservative 200 kPa ✅)

#### §4.3.2 Hlubinné založení — ALTERNATIVA (fallback only)
- "**V případě hlubinného založení** na pilotách je možné piloty vetknout do silně zvětralých slínovců R5 (GT4)"
- Úroveň GT4 = 3,50 – 3,80 m p.t.
- Per IGP: piloty NEjsou primární řešení, jen alternativa

### §4.4 Zpevněné plochy — VÝMĚNA AKTIVNÍ ZÓNY
- Pláň zpevněných ploch tvoří GT1 navážky
- Per ČSN 6133: **zeminy pro zemní pláň nevhodné k přímému použití**
- Doporučení: "**částečně z aktivní zóny odstranit a nahradit je štěrkovitým materiálem, který je třeba hutnit po vrstvách**"
- **Edef2 ≥ 45 MPa, Edef2/Edef1 < 2,2** — návrhové parametry zhutnění (ČSN 72 1006)
- Mocnost hutněné vrstvy = dle účinnosti hutnícího stroje (typicky ~0,5 m doporučené)

### §4.5 Zemní práce — třídy těžitelnosti
- Výkopové práce: zeminy **třídy těžitelnosti I**
- Piloty: vrtatelnost I (navážky + kvartér), I–II (skalní podklad), nutné **pažit, pažnice předrážet**
- Výkopy do 1,0 m svislé OK; hlubší/pod HPV → pažení
- GT1 navážky: podmínečně vhodné až **nevhodné pro další použití**
- GT2/GT3 kvartérní sedimenty: **vhodné pro další použití**

### §5 Závěr (shrnutí pro VV)
- 1. geotechnická kategorie
- Plošné založení na patkách do GT2, Rdt = 250 kPa — **PRIMARY design**
- Hlubinné založení (piloty do GT4) — **alternativa only**
- Výkopové práce: třída těžitelnosti I
- HPV 1,7–1,8 m p.t., neovlivní základové poměry
- Doporučeno: přizvat geologa k převzetí základové spáry

## Vrtné práce
- **2× jádrový vrt: J-1 (4,0 m) + J-2 (4,0 m), celkem 8 m**
- Vrtmistr P. Tůma, souprava H13 VS/D
- Datum vrtů: 02.04.2026
- Vrt J-1: GT1 (0,00–0,60), GT2 (0,60–1,30), GT3 (1,30–3,80), GT4 (3,80–4,00). HPV 1,80 m.
- Vrt J-2: GT1 (0,00–1,70), GT3 (1,70–3,50), GT4 (3,50–4,00). HPV ustálená 1,65 m.

## Laboratorní analýzy (GEMATEST 540-01-2026)
- Vzorek 644 (J-1, hloubka 1,0–1,2 m): G3 G-F, neplastický
- Filtrační součinitel k ≈ 2,2 × 10⁻⁴ m/s
- Klasifikace vhodnosti pro pozemní komunikace: VHODNÁ (násyp), VHODNÁ (aktivní zóna)

---

**Cross-reference impact:**
- **ABMV_11** (IGP pending) → **CLOSE** (resolution: IGP delivered 04/2026)
- **ABMV_17** (výkopy 32 vs 530 m³) → **CLOSE** (IGP confirms navážky 0,6–2,2 m → figura recompute)
- **HSV-2-010..012** (pilota varianta) → flag `_status_flag: "alternative_variant_per_IGP_not_required"`, conf → 0,40
- **NEW HSV-1 item** — Výměna aktivní zóny pláně 540 m² × 0,5 m = 270 m³ odstr + 270 m³ nahraz
- **HSV-1-001** výkop figura 222,75 → 323 m³ (538,5 m² × 0,6 m sejmutí navážek)
- **project_header.json** — add `geotechnical_summary` block (Rdt, HPV, geotech kategorie, navážky range)
