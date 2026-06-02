# RD Jáchymov — výkaz výměr · předání zhotoviteli (Karel Šmíd)

**Projekt:** Rekonstrukce + nástavba RD Fibichova 733, Jáchymov
**Objekty:** 260219 dům · 260217 zahradní sklad + přístupové schodiště
**Stupeň:** DSP / DPS podklad · **Datum předání:** 2026-06-02
**Zdroj pravdy:** `items_rd_jachymov_complete.json` (247 položek) — vše ostatní jsou projekce

---

## 1. Co je v balíčku (4 soubory)

| Soubor | Co to je | Pro co |
|---|---|---|
| **ATOMIC_FLAT_2026-06-02.xlsx** | 374 atomických operací, 1 řádek = 1 operace (montáž / materiál zvlášť) | hlavní audit-trail rozpočtu — každá položka má vzorec + zdroj + confidence |
| **VYMERY_SOUHRN_2026-06-02.xlsx** | 38 jednotek (všechny místnosti + prvky) s plochou / výškou / obvodem / skladbou | měřená báze — odkud se berou množství (Výměry-First) |
| **Vykaz_vymer_RD_Jachymov_KROS_format_2026-06-02_v3_final.xlsx** | KROS / UNIXML formát | import do tvého rozpočtového SW |
| **Otazky_pro_Karla_a_projektanty_2026-05-29.docx** | 37 vyjasnění (36 otevřených) | otázky na projektanta / investora před cenotvorbou |

---

## 2. Co je HOTOVO ✅

- **Kompletní výkaz výměr** dům + sklad — 247 položek, 374 atomických operací
- **Množství s geometrií** — každé `mnozstvi` má `mnozstvi_formula` nad měřenými vstupy (DXF / řezy / tabulky místností)
- **Zdroj u každé položky** (`source`) — dohledatelné v PD (TZ § / výkres / řez)
- **Montáž / materiál split** — práce a dodávka odděleně (Pattern: Full Decomposition), tam kde to dává smysl
- **Skladby S01–S12** rozlišeny na stávající (bourání) vs návrh (konstrukční) — dvě skupiny prací, nemíchat
- **Sklad ručně přeměřen** dle řezů A-A/B-B + půdorysů (patky 6, IPE 6, S03a 3.5 m, S01 23.6 m², H-BLOK 18 ks 1800×600, žlaby, trubky, vjezd, schodiště)
- **Confidence** u každé položky (0.6–0.95); pod 0.7 = odhad označený

## 3. Co ČEKÁ na tebe / projektanta ⏳

- **Vazba ÚRS leaf-kódů — TY.** Položky nesou rodinný 6-místný kód (montáž) + `urs_status: needs_production_lookup`. Konkrétní 9-místný leaf navážeš ve svém ÚRS dle reálných cen. Důvod: leaf závisí na ceníkové soustavě + roce, to je tvoje doména.
- **36 otevřených vyjasnění** (viz docx) — odpovědi projektanta/investora mohou změnit množství. Klíčové:
  - materiály neuvedené v legendě (zásyp za opěrnou stěnou, plot, zábradlí)
  - trubky u pasů — drenáž vs odvětrání radonu + Ø
  - sokl — rozpor TZ vs výkres (řešeno ve prospěch výkresu, potvrdit)
  - schodiště S05 — monolit na místě vs komplet prefa
  - H-BLOK — ks vs m³ dle ceníku Herkul

## 4. Jak číst confidence / status

- `measured` — změřeno z výkresu/řezu (nejvyšší jistota)
- `derived` — dopočteno vzorcem z měřených vstupů
- `estimate` + `OVĚŘIT` — odhad nad geometrií, čeká potvrzení
- `null` + vyjasnění — kde geometrie chybí, množství NEVYMÝŠLÍME (otázka v docx)

---

## 5. Pilotní poznámka

RD Jáchymov je **pilot hloubky** — kompletní ruční obmer 2 objektů z PD + řezů,
374 atomických operací s plným audit-trailem. Slouží jako referenční baseline
pro další zakázky (kopíruj skeleton `test-data/RD_Jachymov_dum/`).

**Kontakt zpět:** otázky k výměrám / vzorcům → odpovíme dohledáním v PD.
