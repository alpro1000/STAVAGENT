# §13.2 — Precedent Pattern Analysis

**Date:** 2026-05-13
**Phase:** 0b RE-RUN · §13 addendum
**Scope:** 6 hala-typed precedent xlsx files in `test-data/hk212_hala/example_vv/`
**Privacy contract (§13.6):** zero prices, zero specific IČO/contacts. Investor names abstracted to public/private/sector class. Subdodavatel attribution only at chapter granularity ("byl použit subdodavatel pro X"), never as personal data.

---

## Inventarizace precedent korpusu

| Tag | Format | Listy | Položek | VRN polož. | Charakter | Investor class |
|---|---|---:|---:|---:|---|---|
| **ROZMITAL_salt_hala** (PRIMARY) | RTS_ROZPOCET | 7 | 552 | 12 | Demolice + novostavba sklad soli — **ocelová hala** | Veřejný (krajská správa silnic) |
| HALA_JHV_deponace | URS_KROS_KOMPLET | 26 | 4403 | 17 | Hala pro deponaci (depo strojů) | Veřejný (dopravní podnik města) |
| KRALOVICE_skolska | URS_KROS_KOMPLET | 21 | 2584 | 4 | Nová hala v dílnách školy | Veřejný (střední škola) |
| ANTRACIT_logistika | **CUSTOM_INVESTOR_FORMAT** | 2 | ~80 (alpha) | — | Novostavba logistické haly | Soukromý (logistic developer) |
| SKLAD_SKROBU_P001 | URS_KROS_KOMPLET | 13 | 792 | 3 | Sklad škrobu, slepý rozpočet | Soukromý (potravinářství) |
| TREMOSNA_KD | URS_KROS_KOMPLET | 12 | 1630 | 1 | Kulturní dům — multifunkce | Veřejný (obec) |

**Sektor rozdělení:** 4 z 6 = veřejný (URS), 2 z 6 = soukromý (1× URS, 1× custom).

**Format dominance:** **URS_KROS_KOMPLET** (4/6) > RTS_ROZPOCET (1/6) > CUSTOM (1/6). URS_KROS je defacto standard pro státní/veřejné zakázky a většinu DPS-stage prácí.

---

## §13.2 A — Struktura soupisu

### Top-level hierarchy

**RTS / URS Komplet sdílejí 3-úrovňový hierarchický model:**

```
Stavba (S)            — celá stavební akce
  └── Objekt (O / SO) — funkční celek (typicky 1 SO = 1 budova / 1 obor TZB)
       └── Rozpočet (R) — jeden položkový seznam
            └── Díl   — kapitola URS (1 / 21-M / 27 / 6x / 7xx / VRN)
                 └── Položka (POL) — jednotlivý řádek prací
                      ├── Poznámka (POP) — textový popis
                      └── Výkaz výměr (VV) — odkaz na měření / formule
```

### Listů (sheets) per typický projekt

| Typ projektu | Sheet pattern |
|---|---|
| Jednoduchá hala (Rožmitál, 552 pol.) | 7 (Pokyny + Stavba + VzorPolozky + SO01 Pol + SO02 01 Pol + SO02 02 Pol + SO03 VRN) |
| Středně-velká hala s TZB (Třemošná 1630, Sklad škrobu 792) | 12-13 (Rekapitulace stavby + 1 sheet per SO/profese) |
| Komplexní hala (Kralovice 2584, JHV 4403) | 21-26 (Rekapitulace + SO + sub-SO per profession + per stage VRN) |

### Recommendation: **1 sheet per profession** (not 1 sheet per item domain)

Subdodavatel split se NEDĚLÁ při generování — všechny profese jsou v jedné master soupisu. List Excel sheet **per profese** plní roli logického oddělovače pro estimátora, který vidí cenu po profesích a může jednotlivé sheety vyextrahovat pro různé subdodavatele.

---

## §13.2 B — Granularita položek

**Vzorek z Rožmitálu Díl 27 (železobetonové základové desky):**

| Kód | Název | MJ |
|---|---|---|
| `273321311` | Železobeton základových desek C 16/20 | m³ |
| `273351215` | Bednění stěn základových desek — zřízení | m² |
| `273351216` | Bednění stěn základových desek — odstranění | m² |
| `273361921` | Výztuž základových desek ze svařovaných sítí KH 30, drát d 6,0 mm | t |
| `998273102` | Přesun hmot pro základové desky | t |

**Granularita = 4-5 položek per konstrukční element**:
- 1× beton (m³)
- 1× bednění — zřízení (m²)
- 1× bednění — odstranění (m²)
- 1× výztuž (t)
- 1× přesun hmot per kapitola (t)

### Cross-element granularity table

| Element | Items per RTS/URS approach | Notes |
|---|---:|---|
| Železobetonová patka / pas / deska | 4-5 | beton + bednění zříz + bedn odstr + výztuž + přesun hmot |
| Ocelové sloupy / příčle / vaznice | 2-3 | Specifikace materiálu (`R`-prefix custom kg/m × t) + montáž (t) + nátěr/povrchová úprava (m²) + přesun hmot (t). |
| Kingspan opláštění stěny | 2 | Specifikace panelů (kus / m²) + montáž (m²) |
| Kingspan střecha | 2 | Specifikace panelů (m²) + montáž (m²) |
| Okna / vrata / dveře | 2 | Specifikace výrobku (kus) + montáž (kus) |
| Klempířské konstrukce (atika, oplechování, žlaby, svody) | 2-3 per typ | Material (m) + montáž (m) + Přesun hmot (Díl 998-764) |
| Hromosvod | 5-8 | Montáž vedení (m) + svorky 2-3 typy (kus) + jímač (kus) + uzemnění (m) + revize (kus) |
| Výkop / zásyp / přemístění | 2-3 per typ | Hloubení nezapaž jam (m³) + příplatek za lepivost (m³) + svislé přemístění (m³) + vodorovné přemístění (m³) |

### Custom položky (mimo katalog)

Pro nestandartní výrobky a technologii používá Rožmitál i KROS Komplet **prefix `Rpol`** nebo **`R` na konci kódu**:
- `Rpol10.078.068` Krabice 855 IP67 — non-catalog electrical part
- `Rpol741372063` D+M svítidla nad vrata — custom svítidlo
- `005241034Rpol` Informační tabule — VRN special item
- `5054241034R` (R-suffix variant)

**Implications for hk212:** technologie strojů (kotvící body, anchorage, požár.bezp. zařízení mimo standard) bude muset používat `Rpol*` codes per stejný pattern. Cena se uvádí jako "specifikace" (typ položky 3) místo "Práce" (typ 1).

---

## §13.2 C — Naming convention

### URS / RTS codes (numeric, primary)

- 9-mistné URS kódy (`113107222`, `273321311`, `741372062`) jsou industry standard
- První 1-2 cifry = kapitola (1 = Zemní práce, 2 = Základy, 27 = ŽB desky, 6 = Úpravy povrchů, 7x = PSV trades, 9 = Ostatní, 21-M / 22-M / 23-M = Montážní práce)
- Cesta: `XX-major | YY-medium | ZZZ-minor variant` — např. `273 | 32 | 1311` = ŽB | desky | C 16/20 sub-type

### Czech descriptive titles (popis)

Pattern: **`<Akce> <Konstrukce> <Materiál/specifikace>`**:
- "Železobeton základových desek C 16/20"
- "Bednění stěn základových desek - zřízení"
- "Hloubení nezapaž. jam hor.3 do 1000 m³"

**Length**: typicky 40-80 znaků. Diacritics ANO (Č/Š/Ř/Ž/Ý/Í/Á/Ě/Ů/Ú).

### Section markers in popisu

- "Díl: X — <název>" zahájuje novou kapitolu
- "Stavba: <kód>" / "Objekt: <kód>" / "Rozpočet: <kód>" — hierarchické krycí
- VRN položky často **upper-case** ("VRN", "Vedlejší náklady")

---

## §13.2 D — Subdodavatel split

### Konvence v RTS Rozpočet

Column 23 = **"Dodavatel"** s hodnotou `Vlastní` (interní práce generálního dodavatele) NEBO jméno subdodavatele.

V slepých rozpočtech (před výběrem subdodavatele) = vždy `Vlastní`. Investor / generální dodavatel pak po podpisu rozhoduje kdo dělá co.

### Typický split per kapitola (industry praxe, z hala precedentů)

| Kapitola | Typický subdodavatel | Counted instances v precedentech |
|---|---|---:|
| HSV-1 Zemní práce | GD (vlastními kapacitami) | Vlastní × 5/5 |
| HSV-2/27 Základy ŽB | Specialista beton (Skanska, OHL, Doka FT...) | GD typicky vlastní |
| HSV-3 Ocelová konstrukce | **Specialista OK** (např. VPS, EXCON, OK-Holding) | 5/5 outsourced |
| HSV-6 Podlahové konstrukce | GD nebo specialista hala (industriální podlaha s vetkávanými vlákny) | 50/50 |
| HSV-7 / PSV-7xx Sendvičové opláštění | **Specialista Kingspan** (autorizovaný montér) | 5/5 outsourced |
| PSV-73-74 ÚT | TZB-UT firma | 5/5 outsourced |
| PSV-75 Slaboproud | Specialista EZS/CCTV | optional, 3/5 |
| PSV-76 Zámečnické (vrata, okna, dveře) | TZB-Zámečníci | 5/5 |
| PSV-78 Dokončovací | GD | 5/5 vlastní |
| Hromosvod 210220xxx | TZB-Elektro | 5/5 |
| Elektroinstalace 21-M | TZB-Elektro (silnoproud) | 5/5 |
| VRN | GD | 5/5 |

**Pro hk212 hala očekávané subdod počet:** 6-8 trades (typicky):
1. GD (vlastními kapacitami) — HSV-1 zemní + HSV-2 základy + HSV-9 ostatní + VRN
2. Specialista ocelová konstrukce — HSV-3 OK (sloupy + vaznice + ztužidla)
3. Specialista Kingspan opláštění — HSV-7 / PSV-7xx panely stěn + střechy
4. TZB-UT — sálavé panely / VZT (kombinováno v jednom dodavateli typicky)
5. TZB-Elektro silnoproud + hromosvod
6. TZB-ZTI / kanalizace
7. Specialista vrata sekční (DOOR / Hörmann / TEPS) — typicky autorizovaný montér
8. Volitelně Specialista Technologie strojů (anchorage, kotvící body) — pokud projektant vyžaduje

Žádný z těchto kontaktů / IČO nebudou v outputu Phase 1 — pouze chapter-level reference "byl použit subdodavatel pro X".

---

## §13.2 E — VRN structure

### Rožmitál SO03 01 VRN (12 položek)

Item structure:
- `00511 R` — Geodetické práce (Soubor) — vytýčení stavby, geodetické zaměření
- `005121 R` — Zařízení staveniště (měsíc) — buňky, plot, oplocení, voda+el. na staveniště
- `00523 R` — Zkoušky a revize (Soubor) — revize elektro, hromosvod, tlakové zkoušky
- `005241034Rpol` — Informační tabule (Soubor) — povinný billboard stavby
- Další položky: dopravní značení, demolice provizorií, ostraha, projektová příprava (DSP/DPS/DRS poplatky)

### Common pattern across precedents

| Kategorie | Cnt /precedent | MJ | Granularita |
|---|---:|---|---|
| Geodetické práce | 1 | Soubor | paušál |
| Zařízení staveniště | 1 | měsíc | per měsíc × délka stavby |
| Doprava materiálu | 1-2 | Soubor / t·km | paušál (default) nebo per t·km (granularly) |
| Zkoušky a revize | 1-3 | Soubor / kus | paušál nebo per druh zkoušky |
| Atesty a doklady | 1 | Soubor | paušál |
| Dopravní značení (stavební) | 1 | Soubor | paušál |
| Pojištění stavby | 1 | Soubor / % | paušál nebo % z VV ceny |
| Hospodářský provoz (rezerva) | 1 | Soubor / % | typicky 3-5% z stavební ceny |

**Recommendation pro hk212:** 8-12 položek VRN v separate SO (SO-XX VRN). Použít stejný subset z URS kódů.

---

## §13.2 F — Sloupce v Excel layout

### RTS Rozpočet (Rožmitál) — 25 sloupců

```
1.  P.č.
2.  Číslo položky               ← URS code
3.  Název položky               ← popis
4.  MJ                          ← měrná jednotka
5.  Množství
6.  Cena / MJ
7.  Celkem
8.  Dodávka                     ← material price per MJ
9.  Dodávka celk.
10. Montáž                      ← labor price per MJ
11. Montáž celk.
12. DPH
13. Cena s DPH
14. Hmotnost / MJ
15. Hmotnost celk. (t)
16. Dem. hmotnost / MJ          ← demoliční (pro dopravu sutě)
17. Dem. hmotnost celk. (t)
18. Ceník                       ← RTS / URS / Vlastní / Indiv
19. Cen. soustava / platnost
20. Cenová úroveň
21. Nhod / MJ                   ← normohodiny per MJ
22. Nhod celk.
23. Dodavatel                   ← Vlastní / subdod name
24. Typ položky                 ← Práce / Specifikace / VRN
25. Stav položky                ← Běžná / OPEN
```

### URS KROS Komplet — má hidden columns

KROS export typicky má 18-22 viditelných sloupců + sloupce po pozici 11 jsou `>>> skryté sloupce <<<` (technické: DPH, hmotnost, normohodiny). Estimátoři je obvykle expand pro vlastní výpočty.

**Recommendation pro hk212 Phase 2 Excel build:** Použít **RTS 25-sloupcový layout** (úplnější). Hmotnost a Nhod jsou klíčové pro výpočet dopravy a člověko-hodin v VRN.

---

## §13.2 G — Cross-precedent format differences (notes)

- **Rožmitál (RTS)** vs **Komplet (URS)** se liší primárně v magickém header (`#RTSROZP#` vs `Export Komplet`) a v reprezentaci. Položkové kódy jsou identické — oba používají URS 9-mistné catalog. RTS layoutem podobnější skladbě 25 sloupců — vidíš všechno.
- **ANTRACIT** (custom investor format) je *fundamentálně jiný typ dokumentu* — to není soupis prací, ale **cenová nabídka pro investora** s vysoko-úrovňovou strukturou (V./P. codes). Investorské použití pro internal cost tracking, ne pro výběrové řízení. **NEPOUŽÍVEJ pro hk212 generator** — produced format by neprošel přes Tender / KROS proces.
- Třemošná je kulturní dům (ne čistá hala) — má ale stejnou URS strukturu jako hala-precedenty, takže metric struktury je platná.

---

## Summary tabulka pro Phase 1 generator

| Atribut | Doporučená hodnota pro hk212 |
|---|---|
| Format | **URS_KROS_KOMPLET** (preferred) nebo **RTS_ROZPOCET** (interchangeable) |
| Sheets per projekt | 7-10 (Rekapitulace + 1 sheet per SO/profese) |
| Hierarchy | S → O (SO) → R (Rozpočet) → Díl → Položka |
| Items target pro hk212 (495 m² hala) | ~250-400 položek (Rožmitál baseline 552 + technologie strojů + redukce demolic) |
| VRN položek | 8-12 |
| Granularity per ŽB element | 4-5 položek |
| Granularity per ocel element | 2-3 položek |
| Granularity per Kingspan element | 2 položek |
| Naming style | URS 9-mistné kódy + popis pattern `<Akce> <Konstrukce> <Materiál>` |
| Custom items (mimo katalog) | Prefix `Rpol*` nebo suffix `R` |
| Excel sloupce | 25 (RTS standard) |
| Subdodavatel | Sloupec "Dodavatel" = `Vlastní` (default), filling at contracting time |
| Typ položky | `Práce` (1) / `Specifikace` (3) / `VRN` |

**Done. §13.3 alignment to hk212 produced in separate report.**
