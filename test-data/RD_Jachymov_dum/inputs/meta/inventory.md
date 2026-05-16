# INVENTORY — RD Jáchymov Fibichova 733

**Datum prvotního auditu:** 2026-05-16
**Sběr:** Email cesta Volný → Jiří Šmíd → Karel Šmíd → Alexander; OneDrive linky 2× (sklad+parking + dům)
**Status:** **NEÚPLNÝ** — dodáno pouze 6 PDF TZ. Výkresy DXF a další PDF přílohy musí být před Phase 0b zkontrolovány v `test-data/RD_Jachymov_dum/UNSORTED` v repu.

---

## 1. Co máme (verified)

### 1.1 Společné pro oba objekty

| Soubor | Velikost | Stupeň | Datum | Zpracovatel |
|---|---:|---|---|---|
| `inputs/tz/common/B_Souhrnna_TZ_EAR.pdf` | 585 KB | DSP | 02/2026 | SMASH architekti (M. Smolka) |

Pokrývá: identifikační údaje, urbanismus, výpočet parkovacích stání, požadavky DOSS, odpady, bilance, vodohospodářské řešení, BOZP základní.

### 1.2 Objekt 260219 — Dům (rekonstrukce + nástavba)

| Soubor | Velikost | Stupeň | Datum | Zpracovatel |
|---|---:|---|---|---|
| `inputs/tz/260219_dum/D_1_1_01_TZ_ARS_dum_EAR.pdf` | 465 KB | DSP | 12/2025-01/2026 | SMASH architekti |
| `inputs/tz/260219_dum/D_2_1_TZ_statika_dum_TeAnau.pdf` | 2.1 MB | DSP | 09.02.2026 | TeAnau s.r.o. (Tvardík, Bendík) |
| `inputs/tz/260219_dum/D_3_PBR_dum_TUSPO.pdf` | 1.2 MB | DSP+DPS | 01/2026 | TUSPO (Kirschbaum, Tuček) |

### 1.3 Objekt 260217 — Zahradní sklad, parking, schodiště

| Soubor | Velikost | Stupeň | Datum | Zpracovatel |
|---|---:|---|---|---|
| `inputs/tz/260217_sklad/D_1_1_00_TZ_ARS_sklad_EAR.pdf` | 425 KB | DSP | 12/2025-01/2026 | SMASH architekti |
| `inputs/tz/260217_sklad/D_2_1_TZ_statika_sklad_TeAnau.pdf` | 2.2 MB | DSP | 06.02.2026 | TeAnau s.r.o. |

PBŘ pro sklad/parking SAMOSTATNÉ NENÍ — sklad spadá do volné stavby k bydlení a pravděpodobně bude pokryt obecným PBŘ domu, ale to je třeba ověřit.

---

## 2. Co ČEKÁME (zatím nedodáno přes chat)

**TODO Alexander:** ověřit obsah `test-data/RD_Jachymov_dum/UNSORTED/` v repu. Možná již existuje:

### 2.1 Výkresy

| Typ | Min. potřeba pro agregovaný rozpočet | Pro položkový rozpočet |
|---|---|---|
| **C — Situační výkresy** | C.3 koordinační situace | + C.1 širší vztahy, C.2 katastrální |
| **D.1.1 — ARS výkresy** | Půdorysy 1.PP, 1.NP, 2.NP, 3.NP + řez podélný + 4 pohledy | + řezy přes vikýře, půdorys střechy, detaily ETICS soklu |
| **D.1.1 výpisy** | — (z DSP obvykle není) | tab. místností, skladeb podlah/stěn/stropů/střechy, výpis oken, výpis dveří, klempířských prvků, zámečnických prvků, truhlářských prvků |
| **D.1.2 — statika výkresy** | Půdorys základů, výkresy ŽB věnců, schéma ocelobetonového stropu, schéma krovu | + výztužné výkresy bílé vany, výkresy spojů ocel. konstrukcí (zámečnické dodávky), výkres opěrné zdi |
| **D.1.4 — TZB** | Není v DSP. | Není v DSP — projektant se rozhodl neudělat DPS. |
| **D.3 — PBŘ** | Příloha B (situace s odstupy) ✓ má, příloha A (vzorový výpočet) ✓ má | — |
| **DXF / DWG** | u DPS běžné; u DSP **pravděpodobně chybí** | totéž |

### 2.2 Doplňující dokumenty

- [ ] IGP (inženýrsko-geologický průzkum) — **NEPROVEDEN**, statika použila archivní vrty
- [ ] Mykologický průzkum dřeva — **bude proveden při bourání** (TZ §3.2.3 dům)
- [ ] Azbestový průzkum — předběžné ohledání negativní, podrobný před bouráním
- [ ] PENB (energetický průkaz) — bude ke kolaudaci, není součástí DSP
- [ ] Statický výpočet v plném znění (RFEM 5.39 model) — text TZ statika obsahuje pouze závěry
- [ ] Polohopisné a výškopisné zaměření pozemku — pro architekta podklad, není přílohou
- [ ] Tabulka místností s plochami — **CHYBÍ** (typický nedostatek DSP, pro Libuše-style pipeline blocker)
- [ ] Výpis prvků (okna/dveře/klempířka/zámeč/truhl.) — **CHYBÍ** pro DSP-only projekt

---

## 3. Implikace pro rozpočet

### 3.1 Agregovaný rozpočet (varianta A — doporučená)
- ✅ Možný kompletně z dostupných TZ.
- Skeleton: 20–30 položek na dům, 10–15 na sklad+parking, plus VRN.
- Výměry odhad/extract z TZ (zastavěná, podlahová, m³ obestavěný).
- Časový odhad: 8–12 h práce rozpočtáře.

### 3.2 Položkový rozpočet (varianta B)
- ⚠️ Lze sestavit, ale s následujícími caveats:
  - Bourací práce — z popisu v TZ + odhad procent jednotlivých materiálových frakcí (TZ B m.10.e dává t-y odpadů)
  - HSV — z geometrie + statických detailů (počty IPE180, ks překladů IPN160, m² ETICS)
  - PSV výplně otvorů — **bez výpisu oken/dveří** položit obecně dle ploch fasád + počtu místností
  - Klempířina, zámečnictví, truhlářské prvky — odhad ks/m podle popisu
  - TZB — agregované sumy (kamna, elektrokotel, krb, multisplit TČ, ELI rozvody, ZTI revize, ŽB rozvody atd.) — bez detailních výkazů
- Časový odhad: 30–40 h.

### 3.3 Hybrid (varianta C)
- HSV položkově do ÚRS kódů, PSV+TZB agregovaně po kapitolách.
- Praktický kompromis.
- Časový odhad: 18–25 h.

---

## 4. Hodnocení úplnosti pro STAVAGENT pipeline

| Komponent pipeline | Status | Poznámka |
|---|---|---|
| TZ ARS | ✅ Kompletní | dům + sklad |
| TZ statika | ✅ Kompletní | dům + sklad |
| TZ B souhrnná | ✅ Kompletní | |
| TZ TZB profese (D.1.4) | ❌ N/A v DSP | projektant nepořizoval |
| PBŘ | ✅ Dům kompletní | sklad samostatné PBŘ — k ověření |
| Půdorysy | ⏳ Ověřit v repu UNSORTED | nezbytné pro výměry |
| Řezy | ⏳ Ověřit | nezbytné pro výšky |
| Pohledy | ⏳ Ověřit | nezbytné pro POP / fasádu |
| Situace C | ⏳ Ověřit | nezbytné pro VRN + odstupy |
| Tabulka místností 0020 | ❌ N/A v DSP | blocker pro Libuše-style Π.0a |
| Tabulka skladeb 0030 | ❌ N/A v DSP | blocker pro Libuše-style Π.0a |
| Tabulky 0041/0042/0080 | ❌ N/A v DSP | blocker pro Libuše-style |
| DXF | ⏳ Ověřit v UNSORTED | pokud k dispozici, lze extract výměry |

**Závěr:** Použít **hk212-style pipeline** (TZ + výkresy → Phase 0b + Phase 1), NE Libuše-style (chybí tabulky).

---

## 5. Akce před Phase 0b

1. **Inventarizovat `test-data/RD_Jachymov_dum/UNSORTED/`** — spočítat soubory, identifikovat typy, přesunout do správných podsložek.
2. **Pokud DXF chybí** — požádat Karla o pdf-export z DPS půdorysů (architekt má v CAD souboru), případně přijmout omezení na agregovaný odhad výměr ze zastavěné/podlahové plochy.
3. **Doplnit do `project_header.json`** výsledek tohoto auditu.
4. **Vytvořit `vyjasneni_queue.json`** (ABMV email queue) s otevřenými otázkami pro architekta.
