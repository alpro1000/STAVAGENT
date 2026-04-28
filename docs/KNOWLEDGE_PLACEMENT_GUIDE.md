# Knowledge Placement Guide — STAVAGENT

> **Účel / Назначение:** Pravidla pro umístění nových znalostí v repozitáři. Použij stávající strukturu, **bez migrace**. Když přidáváš nový zdroj — vždy najdi své místo v B0–B9.
>
> **Kdy číst tento dokument:** Před přidáním nového PDF, normy, učebnice, TTK, schemy, validačního pravidla nebo jakéhokoliv strukturovaného obsahu o betonu, zdivu, mostech a stavebních technologiích.

---

## 1. Hlavní princip / Главный принцип

**Centralizace v Core Engine.** Vše souvisí s předmětnou doménou (normy, učebnice, vzorce, koeficienty, validace) jde do `concrete-agent/app/knowledge_base/`. Kiosky (Monolit-Planner, Portal, Registry) **nemají vlastní knowledge** — pouze cache, vždy získané z Core API.

> Принцип "источник истины один". Если в коде калькулятора (Monolit) появляется захардкоженная норма — это **bug**, не feature. Чинить переносом в Core knowledge_base.

---

## 2. Stávající struktura B0–B9 / Существующая структура

```
concrete-agent/app/knowledge_base/
├── B0_sources/          ← original PDFs, scans, source files
├── B1_otksp/            ← OTSKP price catalog
├── B2_csn_en_206/       ← ČSN EN 206 (concrete classes, exposure)
├── B3_current_prices/   ← live market prices
├── B4_productivity/     ← productivity rates (rebar, formwork, pour)
├── B5_tech_cards/       ← technological cards (TTK, postupy)
├── B6_research_papers/  ← academic textbooks, university skripta
├── B7_regulations/      ← official norms (ČSN, EN, TKP, DIN)
├── B8_company_specific/ ← internal company knowledge
└── B9_validation/       ← cross-validation rules
```

> **B5–B8 теперь активные.** Раньше были пустыми stubs — теперь это рабочие категории по этому гайду.

---

## 3. Tabulka rozhodování / Таблица решений

| Co přidáváš / Что добавляешь | Kam / Куда |
|---|---|
| Oficiální norma (ČSN EN 206, ČSN EN 13670, ČSN EN 1992) | `B7_regulations/csn_en_<XXX>/` |
| TKP / ZTKP (ŘSD, SŽDC) | `B7_regulations/tkp_<XX>/` |
| DIN (DIN 18218, DIN EN 12812) | `B7_regulations/din_<XXX>/` |
| Univerzitní skriptum (ČVUT, VUT, VŠB, UPa) | `B6_research_papers/<univ>_<title>/` |
| fib Bulletin / CEB-FIP / Model Code | `B6_research_papers/fib_<NN>_<title>/` |
| ACI / CIRIA / mezinárodní | `B6_research_papers/<org>_<title>/` |
| Typová technologická karta (RU TTK, CZ Provádění) | `B5_tech_cards/<element>/<source>/` |
| Vendor manual (PERI, Doka, ULMA) | `B5_tech_cards/formwork_vendor/<vendor>_<year>/` |
| Vendor cenník (Doka cennik, PERI Frami) | `B3_current_prices/<vendor>_<date>/` |
| Vlastní produktivita / kalibrace | `B4_productivity/<topic>/` |
| Kontrolní pravidlo (cross-validation) | `B9_validation/<rule_id>.yaml` |
| Vlastní firemní šablona / postup | `B8_company_specific/<topic>/` |
| Kompletní původní PDF (zdroj všeho výše) | `B0_sources/<source_name>/` |

---

## 4. Standardní layout pro nový zdroj / Стандартный layout

Když přidáváš zdroj, **vždy** vytvoř složku se 4 souboru:

```
<bucket>/<source_slug>/
├── source.pdf              ← original (PDF, max. 32 MB; větší → samostatně v B0_sources/)
├── METADATA.md             ← metadata (template níže)
├── extracted.yaml          ← strukturované extrakce (jako TTK_walls_extracted.yaml)
└── citations.md            ← konkrétní citace s čísly stran
```

**Příklad pro fib Bulletin 48:**

```
B6_research_papers/fib_48_formwork_falsework/
├── source.pdf
├── METADATA.md
├── extracted.yaml
└── citations.md
```

**Příklad pro ČSN EN 13670:**

```
B7_regulations/csn_en_13670_provadeni/
├── source.pdf  (если есть копия, иначе пустая папка с pointer-ом)
├── METADATA.md
├── extracted.yaml
└── citations.md
```

---

## 5. METADATA.md template

Vždy stejný formát (pro AI Reasoner i pro lidskou navigaci):

```yaml
---
title: <plný název>
title_cz: <český překlad pokud relevantní>
authors:
  - <jméno> [(role)]
year_published: <YYYY>
edition: <číslo edice / verze normy>
publisher: <vydavatel>
isbn_or_code: <ISBN / norma kód>
language: <cs|en|de|ru|sk>
license:
  type: <open_access|paid|internal|public_domain>
  url: <URL pokud open access>
priority: <1-5>  # 1 = primární zdroj pro daný topic, 5 = pomocný
topics:
  - <téma 1>
  - <téma 2>
applies_to_elements:  # pokud relevantní
  - WALL_MONOLITHIC
  - SLAB_FLAT
  - BR_DECK_SLAB
relevance_for_stavagent: |
  <2-3 věty proč tento zdroj v repo>
known_conflicts_with:
  - <id_jiného_zdroje>: <stručný popis konfliktu>
---

# <název> — STAVAGENT notes

## Co tento zdroj pokrývá
<krátký popis, 5-10 řádků>

## Klíčové kapitoly pro STAVAGENT
- §X.Y — <topic>
- §A.B — <topic>

## Vztah k jiným zdrojům v repo
- Doplňuje: <id>
- Nahrazuje (legacy): <id>
- Konfliktní: <id> — viz `B9_validation/conflicts/<id>.yaml`
```

---

## 6. extracted.yaml — co tam být musí

Strukturovaný překlad obsahu do strojově čitelné formy. **Vzorem je `TTK_walls_extracted.yaml`** — pokud někdy budeš mít pochybnost o struktuře, otevři ho.

Minimum pro každý nový extrakt:

```yaml
source:
  metadata_ref: ./METADATA.md
  language: <cs|en|de|ru>
  jurisdiction: <CZ|EU|DE|RU|...>

# Sekce odpovídají strukturám zdroje, ale vždy obsahují:
<topic_name>:
  <parameter>:
    value: <číslo>
    unit: <jednotka>
    source_clause: "<§X.Y nebo strana>"
    quote_original: "<doslovná citace v originálním jazyce>"
    csn_compare:  # pokud je rozdíl od ČSN
      csn_value: <hodnota>
      csn_source: "<ČSN kód §X.Y>"
      verdict: "<použít ČSN | použít zdroj | obě platí v různých kontextech>"
```

---

## 7. citations.md — proč zvlášť

Každá hodnota v `extracted.yaml` má `quote_original` — krátká citace. **Citations.md** drží **dlouhé** výňatky (celé odstavce, tabulky, schémata) pro případ, kdy AI Reasoner potřebuje plný kontext.

**Pravidlo:** ne víc než 200 řádků na soubor. Když překračuje, rozděl na `citations_part1.md`, `citations_part2.md`.

---

## 8. Pravidla jména složky (slug)

Slug = ASCII, lowercase, oddělovač `_`:

```
✅ csn_en_13670_provadeni
✅ fib_48_formwork_falsework
✅ pokorny_suchanek_betonove_mosty_ii
✅ tkp_18_szdc_2022
❌ ČSN_EN_13670 (diakritika + UPPERCASE)
❌ pokorný-suchánek (diakritika + dash)
❌ fib bulletin 48 (mezery)
```

**Verze:** pokud existuje více verzí stejného zdroje, přidej rok nebo číslo edice:
- `tkp_18_rsd_2018` vs `tkp_18_rsd_2024`
- `csn_en_13670_2010` vs `csn_en_13670_2020`

---

## 9. Když si nejsi jistý kam dát

Rozhodovací strom:

```
Je to oficiální norma s kódem (ČSN, EN, DIN, TKP)?
├── ANO → B7_regulations/
└── NE
    │
    ├── Je to akademický zdroj (univerzitní skriptum, fib bulletin, kniha)?
    │   ├── ANO → B6_research_papers/
    │   └── NE
    │
    ├── Je to typová karta postupu / TTK / vendor manual?
    │   ├── ANO → B5_tech_cards/
    │   └── NE
    │
    ├── Jsou to ceny vendor (Doka, PERI, výztuž, beton)?
    │   ├── ANO → B3_current_prices/
    │   └── NE
    │
    ├── Jsou to produktivní normy (h/t, m³/směna)?
    │   ├── ANO → B4_productivity/
    │   └── NE
    │
    ├── Jsou to vlastní firemní data?
    │   ├── ANO → B8_company_specific/
    │   └── NE
    │
    └── Je to cross-validační pravidlo?
        ├── ANO → B9_validation/
        └── NE → zeptej se v PR review
```

---

## 10. Jak to vidí AI Reasoner

Při generování tech-card pro element AI hledá v tomto pořadí:

1. **Element-specific extracted.yaml** (např. `B5_tech_cards/walls/extracted_provadeni.yaml`)
2. **Norms** (B7) — pro hodnoty, krytí, třídy
3. **Research papers** (B6) — pro vzorce a kontext
4. **Tech cards** (B5) — pro postupy
5. **Productivity** (B4) — pro časové a materiálové normy
6. **Prices** (B3) — pro nákladovou stránku
7. **Validation** (B9) — pro kontrolu výsledků

> Если хочешь чтобы AI **обязательно** использовал твой новый источник — упомяни его v top-level promptu jako primární zdroj for daný topic.

---

## 11. Co dělat, když najdeš konflikt

Příklad: ČSN EN 13670 §8.4 říká "5,0 MPa pro odbednění bočních ploch", RU TTK říká "3,5 MPa".

1. Otevři `B9_validation/conflicts/`
2. Vytvoř soubor `<topic>_<sources>.yaml`:

```yaml
conflict_id: removal_strength_walls
sources:
  - id: csn_en_13670
    value: 5.0
    unit: MPa
    section: §8.4
  - id: ru_ttk_walls
    value: 3.5
    unit: MPa
    section: п.1.15
verdict:
  authoritative: csn_en_13670
  reason: "Pro CZ/SK projekty platí ČSN EN. RU TTK je legacy reference."
  use_case_alternative: null
```

3. AI Reasoner při tech-card pro stěny uvidí tento konflikt a použije ČSN.

---

## 12. Priority zdrojů (pořadí pravdy)

Při konfliktu mezi zdroji:

```
1. ČSN EN (Eurocode pro CZ)        ← nejvyšší priorita
2. TKP ŘSD / SŽDC (CZ státní)
3. ČSN národní (starší CZ)
4. CZ univerzitní skripta
5. DIN (DE Eurocode)
6. fib Model Code / Bulletins
7. ACI / CIRIA (mezinárodní)
8. RU GOST / SNiP                  ← pouze legacy reference
9. Vendor manuals                  ← informativní, ne autoritativní
```

---

## 13. Co nedělat

- ❌ Neukládej zdroje do `Monolit-Planner/`, `Portal/`, `Registry/` — to jsou kiosky bez knowledge.
- ❌ Nehardkóduj normativní hodnoty do engine kódu — vždy přes `B*` cestu.
- ❌ Neměň strukturu B0–B9 bez diskuze — stávající architektura je stabilní.
- ❌ Nevytvářej nové top-level kategorie (B10, B11) bez důvodu — pravděpodobně se vejde do B5–B8.
- ❌ Neposílej knowledge do `docs/` — to je pro architekturu projektu, ne pro normy.

---

## 14. Když přidáš zdroj — checklist

```
[ ] Vybral jsem správnou bucket (B5/B6/B7/B8)
[ ] Vytvořil jsem složku se slug ASCII lowercase
[ ] METADATA.md s plným template
[ ] source.pdf nebo pointer (pokud > 32 MB)
[ ] extracted.yaml s minimálně 5 sekcemi
[ ] citations.md s odkazy na §
[ ] Pokud je konflikt — soubor v B9_validation/conflicts/
[ ] Aktualizoval jsem index? (volitelně, ne nutně)
[ ] Push commit do main (knowledge bucket je read-only z runtime)
```

---

## 15. Příklady reálných zdrojů a kam jdou

| Zdroj | Bucket | Slug |
|---|---|---|
| ČSN EN 13670:2010 | B7 | `csn_en_13670_provadeni` |
| ČSN EN 206+A2:2021 | B7 | `csn_en_206_beton` |
| ČSN EN 1992-1-1:2006 | B7 | `csn_en_1992_1_1_pozemni` |
| ČSN EN 1992-2:2007 | B7 | `csn_en_1992_2_mosty` |
| TKP 18 ŘSD 2024 | B7 | `tkp_18_rsd_2024` |
| TKP 18 SŽDC 2022 | B7 | `tkp_18_szdc_2022` |
| DIN 18218:2010-01 | B7 | `din_18218_2010_frischbetondruck` |
| Pokorný + Suchánek — Betonové mosty II (UPa) | B6 | `upa_pokorny_suchanek_mosty_ii` |
| VUT Bílý — Příklady navrhování 2G EC2 | B6 | `vut_bily_priklady_2g_ec2` |
| Nečas — Betonové mosty II Modul M01 (VUT) | B6 | `vut_necas_mosty_ii_m01_technologie` |
| VŠB — Pozemní stavitelství: Základy | B6 | `vsb_pozemni_zaklady` |
| FA ČVUT — Beton 21. stol. — technologie | B6 | `cvut_beton_21st_technologie` |
| fib Bulletin 48 — Formwork | B6 | `fib_48_formwork_falsework` |
| fib Bulletin 51-54 — Structural Concrete | B6 | `fib_51_to_54_structural_concrete` |
| fib Model Code 2010 | B6 | `fib_model_code_2010` |
| ACI 347R — Formwork | B6 | `aci_347r_formwork` |
| RU TTK Бетонирование стен | B5 | `walls_ru_ttk_smetnoedelo` |
| Doka cennik 2025-01-01 | B3 | `doka_cennik_2025_01_01` |
| PERI Frami Xlife rates | B3 | `peri_frami_xlife_2025` |

---

## 16. Workflow zpracování učebnice / нового zdroje

> **Princip:** PDF originál se ukládá **vždy** (i bez extrakce). Strukturovaná extrakce do YAML se dělá **postupně, podle aktuální potřeby kalkulátoru**. Není nutné zpracovat celou knihu najednou.
>
> **Принцип:** PDF оригинал — всегда сразу. Извлечение в YAML — по мере нужды. Не обязательно обрабатывать всё сразу.

### 16.1 Tři scénáře podle velikosti zdroje

#### Scénář A — Malý zdroj (≤ 50 stran, ≤ 20 MB)

Příklady: ČSN EN 13670 (~50 str), TKP 18 (~30 str), jednotlivá kapitola fib Bulletin.

**Workflow:**

1. PDF položit do `<bucket>/<slug>/source.pdf` → commit
2. METADATA.md vyplnit ručně (~10 minut)
3. Celý PDF předat AI Reasoner k zpracování v jedné session
4. Dostaneš `extracted.yaml` + `citations.md` → commit

**Výsledek:** kompletní set 4 souborů, AI může používat hned.

#### Scénář B — Střední zdroj (50–500 stran, 20–100 MB)

Příklady: Pokorný-Suchánek "Betonové mosty II" (150 str), VUT Bílý "Příklady" (~200 str), Stahlbetonbau-Praxis (~600 str).

**Workflow:**

1. PDF položit do `<bucket>/<slug>/source.pdf` → commit
2. METADATA.md s **obsahem** (table of contents) vyplnit ručně
3. **Kapitoly zpracovat postupně podle priority:**

```
<bucket>/<slug>/
├── source.pdf
├── METADATA.md
├── extracted/
│   ├── ch01_geometrie.yaml         ← zpracováno (priorita)
│   ├── ch06_obloukove.yaml         ← zpracováno (priorita)
│   └── ch17_letma_betonaz.yaml     ← zpracováno (priorita)
└── citations/
    └── ch17_letma_betonaz.md
```

4. Když budeš pracovat na konkrétním elementu (např. `WALL_MONOLITHIC`) — extrahuj jen kapitoly o stěnách. Ostatní zůstanou v PDF nezpracované, čekají.

**Výsledek:** PDF v repozitáři je vždy. Extrakce roste organicky podle potřeby kalkulátoru.

#### Scénář C — Velký zdroj (500+ stran nebo > 100 MB)

Příklady: kompletní Eurocode 2, fib Model Code 2010 (~400 str), oba díly Stahlbetonbau Goris-Bender.

**Problém:** Git nemá rád velké soubory.

**Workflow:**

1. PDF **NE** do Gitu — drž lokálně (disk, Google Drive, Dropbox)
2. V repozitáři pouze:

```
<bucket>/<slug>/
├── METADATA.md
├── source_pointer.md          ← URL nebo cesta k originálu (NE v Git)
├── extracted/
│   └── §4_4_durability_cover.yaml  ← jen potřebné sekce
└── citations/
```

3. Když potřebuješ extrakci → vyrazíš příslušnou kapitolu jako samostatný PDF (Adobe Acrobat / pdftk / smallpdf.com) a dáš ji AI Reasoner

**Výsledek:** repozitář se nehromadí gigabajty.

---

### 16.2 Technické limity zpracování AI Reasoner

| Velikost PDF | Způsob | Co dostaneš |
|---|---|---|
| ≤ 32 MB | Nahraj přímo do chatu | Plné zpracování za 1-2 sessions |
| 32–100 MB | Rozřízni na části | Zpracujeme po částech |
| > 100 MB | Jen po kapitolách (každou jako samostatný PDF) | 1 kapitola = 1 session |
| Chráněný PDF (DRM) | Nelze extrahovat — sundat ochranu nejdřív | OCR program lokálně |

**Reálný limit na jednu session:** 80–150 stran textu. Pokud má kapitola 200 stran — rozdělit na 2 sessions.

---

### 16.3 Co dávat AI Reasoner přednostně

🔥 **Hned dát ke zpracování:**
- Kapitoly o elementech, na kterých se právě pracuje v kalkulátoru
- Kapitoly, které **konfliktují** s RU TTK (musí se rozhodnout, co je správně)
- Normativní dokumenty celé (ČSN EN 13670, TKP 18) — krátké a kritické

🟡 **Až bude čas:**
- Kapitoly o méně častých elementech (oblouky, pokud nemáš obloukové mosty v pipeline)
- Doplňkové materiály (DAfStb komentáře, ACI alternativy)
- Skripta o teorii, která duplikuje primární normy

🟢 **Vůbec nemusíš zpracovávat:**
- Historické úvody učebnic
- Kapitoly o programech (Atena, RFEM) — pro projektanta, ne pro sметčíka
- Aplikace s konkrétními výpočetními příklady (pokud jeden potřebuješ — vypíšeš ručně za 5 minut)

---

### 16.4 Pravidlo 80/20 pro STAVAGENT

**80 % užitku** dostaneš ze zpracování **20 % zdrojů**:

| # | Zdroj | Priorita | Bucket / slug |
|---|---|---|---|
| 1 | **ČSN EN 13670** — provádění betonových konstrukcí | 🔥 P0 | `B7_regulations/csn_en_13670_provadeni/` |
| 2 | **ČSN EN 206+A2** — beton, materiály | 🔥 P0 | `B7_regulations/csn_en_206_beton/` |
| 3 | **TKP 18 ŘSD** — silniční konstrukce | 🔥 P0 | `B7_regulations/tkp_18_rsd_2024/` |
| 4 | **fib Bulletin 48** — formwork & falsework | 🔥 P0 | `B6_research_papers/fib_48_formwork_falsework/` |
| 5 | **DIN 18218** — tlak čerstvého betonu na bednění | 🔥 P0 | `B7_regulations/din_18218_2010_frischbetondruck/` |

Tyto 5 zdrojů pokrývají ~80 % potřeb kalkulátoru. Zbylých 5–10 zdrojů z bibliography je hloubka a cross-reference.

---

### 16.5 Praktický workflow krok za krokem

```
┌─────────────────────────────────────────────────┐
│ 1. STÁHL PDF                                    │
│    (z univerzitního webu / od kolegy / z NTK)   │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ 2. OTEVŘEL, PROCHÁZEL OBSAH                     │
│    Pochopil jsem, které kapitoly jsou pro       │
│    STAVAGENT relevantní (podle elementu/témy)   │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ 3. VYTVOŘIL SLOŽKU                              │
│    B6_research_papers/<slug>/  (slug → §15)     │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ 4. UMÍSTIL ORIGINÁL                             │
│    Scenario A/B → source.pdf                    │
│    Scenario C → source_pointer.md               │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ 5. VYPLNIL METADATA.md (~10 min ručně)          │
│    title / authors / year / topics / priority   │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ 6. COMMIT — v repu je originál + metadata       │
│    AI Reasoner zatím zdroj nezná                │
│    (extrakce neexistuje)                        │
└──────────────────┬──────────────────────────────┘
                   ↓
        … (čeká na potřebu) …
                   ↓
┌─────────────────────────────────────────────────┐
│ 7. PŘIŠLA POTŘEBA — pracuji na elementu X       │
│    a kapitola N tohoto zdroje má relevantní     │
│    informace                                    │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ 8. PŘEDAL AI REASONER                           │
│    Scenario A: celý PDF do chatu                │
│    Scenario B: kapitolu N z PDF                 │
│    Scenario C: extrakt kapitoly jako samost. PDF│
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ 9. AI ZPRACOVAL                                 │
│    Vrátil extracted/<chN>.yaml + citations/<chN>.md│
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│ 10. COMMIT EXTRACTED                            │
│     AI Reasoner od této chvíle používá zdroj    │
│     pro element X                               │
└─────────────────────────────────────────────────┘
```

---

### 16.6 Když je zdroj sporný / kontroverzní

Některé zdroje obsahují **zastaralé hodnoty** nebo **národní specifika**, která **neplatí** pro CZ/SK projekty (typický příklad — RU TTK).

**Workflow:**

1. **Stejně dát ke zpracování** — extracted.yaml potřebujeme jako referenci
2. V METADATA.md přidat varování:

```yaml
warnings:
  - "RU GOST/SNiP — pro CZ/SK projekty NEUŽÍVAT jako primární zdroj"
  - "Hodnoty mohou být zastaralé (1987 origin)"
  - "Slouží pouze jako legacy reference pro porovnání"
```

3. AI Reasoner při generování tech-card uvidí varování a buď zdroj ignoruje, nebo použije s explicitní poznámkou "RU legacy".

**Příklad v repu:** `B5_tech_cards/walls_ru_ttk_smetnoedelo/` má 5 přímých konfliktů s ČSN EN, dokumentovaných v `B9_validation/conflicts/`.

---

### 16.7 Checklist před tím, než řeknu AI "zpracuj tento zdroj"

```
[ ] PDF je v repozitáři (Scenario A/B) nebo lokálně + pointer (Scenario C)
[ ] METADATA.md je vyplněna včetně priority a témat
[ ] Vybral jsem konkrétní kapitolu/y, ne celý zdroj (kromě malých zdrojů)
[ ] Vím, na který element / téma extrakci napojím
[ ] Mám přibližné očekávání: cca 30–50 hodnot s odkazy na §
[ ] Pokud je velký PDF — rozříznul jsem kapitolu jako samostatný soubor
[ ] Připravil jsem chat session pro extrakci (≤ 32 MB nahrávka)
```

---

### 16.8 Co dostaneš po zpracování AI

Standardní výstup pro každou kapitolu:

1. **`extracted/<chapter>.yaml`** — strojově čitelná data (~50–200 řádků)
   - Sekce odpovídající strukturám zdroje
   - Každá hodnota s `value`, `unit`, `source_clause`, `quote_original`
   - Cross-compare s ČSN, pokud je relevantní

2. **`citations/<chapter>.md`** — lidsky čitelné citace (~100–200 řádků)
   - Doslovné odstavce z originálu
   - Tabulky a schémata (jako markdown tables)
   - Přesné odkazy na § a strany

3. **Doporučení v chat session:**
   - Které hodnoty jsou v rozporu s jinými zdroji v repu (B9_validation kandidáti)
   - Které sekce vyžadují cross-reference s jiným zdrojem
   - Které části zdroje nezpracovány a proč

---

End of section 16. Continue with main guide above.

---

End of guide. Updates jdou do tohoto souboru jako PR commits.
