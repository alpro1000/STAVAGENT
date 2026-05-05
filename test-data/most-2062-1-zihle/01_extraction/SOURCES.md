# Phase A — Sources & Extraction Index

**Datum extrakce:** 2026-05-05
**Status:** `extraction_done` (Phase A dokončena, B + C deferred)

Tento dokument indexuje, **co bylo extrahováno**, **odkud**, a **co chybí** —
pro reprodukovatelnost a audit trail. Žádné nové faktoidy; jen index.

---

## Vstupní dokumenty (single source of truth)

| Soubor | Typ | Kdy | Klíčové info |
|--------|-----|-----|--------------|
| `inputs/pdf/2062-1 HMP.pdf` | HPM | 2025-09-24 | 6 stran, autor Komanec Petr (PONTEX). NK stav VI (havarijní), SS stav IV. |
| `inputs/pdf/ZD - Most ev.č. 2062-1 u obce Žihle - DaB.pdf` | ZD | 2026-04-01 | 26 stran, č.j. 3967/26/SÚSPK-P. D&B, max 30 mil. Kč, max 30 měsíců. |
| `inputs/pdf/Vysvětlení ZD č. 1 - Most u obce Žihle.pdf` | Q&A k ZD | 2026-04-24 | 2 strany, č.j. 10186/26/SÚSPK-P. Dvě klíčové odpovědi: (ad 1) zadavatel nemá originál PD; (ad 2) provizorium povinné, objízdná zamítnuta. |
| `inputs/photos/Příloha č. 1 - snímek mostního listu.png` | BMS rukopis | (nedat.) | Jediná dochovaná evidence stávajícího mostu kromě HPM. Klíčové: 16 trámů 20×50, šikmost 50°, zábradlí asymetrické (7.40 vs 8.30 BM). |
| `inputs/photos/20260421_*.jpg` (6×) | terénní foto | 2026-04-21 | Vizuální potvrzení HPM závad + odhad světlé výšky + foto reference pro provizorium-staveniště. |
| `inputs/docx/Příloha č. 2 - SOD.docx` | šablona SOD | — | Smlouva o dílo (forma) — nečteno v Phase A, materiál pro Phase B. |
| `inputs/docx/Příloha č. 3 - Prohlášení o ceně.docx` | formulář | — | Šablona pro vyplnění Nabídkové ceny — pro Phase C. |
| `inputs/reference/20 Rekonstrukce mostu Kfely (zadání).xml` | ext. vzor | — | UNIXML soupis Kfely (153 položek, 4 SO). Strukturální vzor, NE hodnoty. |
| `inputs/reference/4106639-A02 ZD GB.docx` | ext. vzor | — | ZD jiného mostu — porovnání struktury kapitol. Nečteno v Phase A. |
| `inputs/reference/4106641-A05 TKP GB.docx` | ext. vzor | — | TKP specifikace Kfely (kap. 1–31). Použito pro list aplikovatelných TKP. |

## NEDODÁNO (potvrzeno chybí)

- **Originál projektová dokumentace stávajícího mostu** — Vysvětlení ZD č.1 ad 1: zadavatel nedisponuje.
- **Geodetické zaměření** — povinnost zhotovitele (ZD §4.3.i + §4.4.a).
- **IGP** — povinnost zhotovitele (ZD §4.4.a).
- **Hydrologická data Mladotického potoka** — zhotovitel zajistí u správce toku (ZD §4.4.b/d).

---

## Výstupy Phase A (4 YAML + tento README)

| Soubor | Obsah | # facts | Avg. confidence |
|--------|-------|---------|-----------------|
| `stavajici_most.yaml` | Identifikace mostu + NK + SS + svršek + stav + zatížitelnost stávající | ~70 | 0.93 |
| `pozadavky_novy_most.yaml` | ZD §4.1–4.4 + provizorium + cena/doba + kvalifikace | ~65 | 1.00 |
| `site_conditions.yaml` | Foto-inventura + site conclusions + Vysvětlení ZD č.1 Q&A | ~30 | 0.65 |
| `aplikovatelne_normy.yaml` | TKP kapitoly + ČSN normy + KB cross-reference | ~30 | 0.90 |

**Celkem ~195 facts** s explicitní citací zdroje (PDF strana / foto soubor / KB cesta).

---

## Confidence distribution

| Confidence | Použití | Příklady |
|------------|---------|----------|
| **1.0** | explicit text v PDF, citace strany | Vn=32t (ZD §4.4.h); 16 trámů (HPM s.2 [2.1]); šikmost 50° (mostní list — rukopis 0.9, ne 1.0) |
| **0.9** | rukopisná hodnota v mostním listu, čitelně | trámy 20×50 cm, zábradlí 7.40/8.30 BM |
| **0.85** | odvozeno z dvou zdrojů + logická interpretace | profil I-280 (HPM "pravděpodobně"), pravděp. plošné základy |
| **0.7** | rukopis s nejasnou interpretací | rozpětí ~9.0 m (kóta "900" v půdorysu) |
| **0.5–0.6** | vizuální odhad z fotky | světlá výška ~1 m, prostor pro provizorium vpravo |
| **N/A flagged** | chybí v inputs, vyžaduje doplnění | tloušťka desky mostovky, IGP, hydrologie |

**Žádný fact bez audit trail.** Pokud nejde citovat → flag jako missing_data v daném YAMLu.

---

## Klíčová zjištění Phase A (executive summary)

### O stávajícím mostě (HPM + mostní list)
1. **Trámová deska 1 pole**, 16 ks ŽB trámů (20×50 cm) s ocelovými I-vložkami pravděpodobně I-280
2. **Šikmost 50°** k ose vozovky (potvrzeno mostním listem)
3. **Rozpětí ~9.0 m**, šířka vozovky stávající ~9.0 m mezi římsami (rukopisná interpretace)
4. **NK stav VI (havarijní)** — beton desky chybí v délce 1.5 m u opěry 2, levá strana se musí omezit Z-deskami
5. **SS stav IV (uspokojivý)** — kamenné opěry s rozvolněným spárováním, levé křídlo opěry 1 deformované
6. **Bez ložisek + bez mostních závěrů** (původní stav je již v podstatě integrální)
7. **Prostor pod mostem velmi nízký** (~1 m) — limituje technologii bednění/skruže
8. **Stávající zatížitelnost** Vn=20 / Vr=24 / Ve=29 t

### O požadavcích nového mostu (ZD)
1. **D&B režim** dle §92 odst. 2 ZZVZ, max 30 mil. Kč bez DPH, max 30 měsíců
2. **Hard zákazy** ZD §4.4.l: bez ložisek, bez dilatačních závěrů, bez složitého odvodnění → integrální rám = jediná technicky vhodná varianta
3. **Cílová zatížitelnost** Vn=32 / Vr=80 / Ve=180 t (1.6× / 3.3× / 6.2× zvýšení)
4. **Šířkové uspořádání** S 7,5 (vozovka 6.50 m mezi V4 0.125) — užší než stávající
5. **3× chránička DN 75 mm** v pravé římse + revizní schodiště
6. **Provizorium povinné** (Vysvětlení ZD č.1 ad 2) — alternativa objízdné zamítnuta
7. **Limity deformací**: sedání ≤ 12 mm, dlouhodobá deformace NK ≤ 3 mm
8. **Vozovka 3-vrstvá živičná** s 100 % obrusnou vrstvou bez tolerance (přísnější než TKP)
9. **Hodnocení** 80 % cena + 20 % doba realizace

### O site conditions (foto + Vysvětlení)
1. **Pevná skruž zdola NEMOŽNÁ** — světlá výška ~1 m → zhotovitel musí buď prkokopat, nebo budovat skruž po demolici
2. **Staveniště nejlépe vpravo** (orná půda + polní cesta na fotce 132429)
3. **Provizorium prostor** → také vpravo, ale vyžaduje souhlas vlastníka mimo silniční pozemek
4. **Single source of truth** = HPM + mostní list + 6 fotek; žádné CAD ani statický výpočet

### O aplikovatelných normách
1. **TKP kapitoly aplikovatelné**: 1, 2, 3, 4, 5, 7, 11, 16, 18, 21, 26, 31 (analogicky Kfely)
2. **TKP kapitoly vyloučené**: 22 (ložiska), 23 (závěry) — ZD §4.4.l zákaz
3. **KB coverage**: TKP 18 + TKP 03 + ČSN EN 206 + Pokorný-Suchánek dostupné. **Chybí**: ČSN 73 6222 (zatížitelnost), ČSN 73 6244 (přechodové desky), ČSN EN 1992-2 (mostní Eurokód 2), ČSN EN 1317 (zádržné systémy) → **Phase B bude muset citovat externí zdroje**

---

## Pre-Phase-B checklist (před návrhem nové NK)

Když začne Phase B, mít po ruce:

- [ ] `01_extraction/stavajici_most.yaml` — geometry constraints (rozpětí, šířka, prostor pod mostem)
- [ ] `01_extraction/pozadavky_novy_most.yaml` — všechna ZD omezení
- [ ] `01_extraction/site_conditions.yaml` — site limity (skruž zdola = nemožná)
- [ ] `01_extraction/aplikovatelne_normy.yaml` — list norem
- [ ] KB Pokorný-Suchánek INDEX.yaml — bridge classification + technology decision rules
- [ ] KB B2_csn_standards/tkp_18_betonove_mosty.json — pro detail betonáže
- [ ] KB B7_regulations/csn_en_206_pruvodce — pro třídy prostředí
- [ ] Externí PDF: ČSN 73 6222, ČSN EN 1992-2 (zhotovitel)

---

## Kdy zastavit a zeptat se

Per "Mantra" (mantra.md): pokud se v Phase B narazí na rozhodnutí, kde:

- KB ani vstupní dokumenty neposkytují přímý zdroj → STOP + AskUserQuestion
- ZD má ambivalentní formulaci → STOP + odkázat na Vysvětlení / dotaz zadavateli
- Hodnoty z mostního listu (rukopis) jsou pro rozhodnutí kritické a confidence < 0.8 → STOP + zaměření terénu

Nikdy nedělat „creative engineering" bez audit trail.
