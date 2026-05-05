# TASK: Žihle Phase D — Soupis prací (OTSKP) + TZ pro DUR

**Priorita:** P2 (sandbox, ne pro odevzdání tendru — ale realistický pattern pro budoucí projekty)
**Trvání odhad:** 2-3 hodiny Claude Code
**Návaznost:** Žihle Phase A+B+C — DONE (commits b31bdf57 + ea43ee16, branch `claude/setup-bridge-test-project-X41DO`)
**Cíl:** dokončit kompletní D&B workflow — od TZ vstupů přes výpočet po výstupní dokumentaci

---

## Мантра

> Сначала ты читаешь весь репо. Аудитуешь URS_MATCHER service architecture
> + existující OTSKP DB strukturu + Kfely XML format konvenci.
> 
> Pro každou položku soupisu MUSÍ existovat:
>   1. OTSKP kód (deterministicky, ne LLM-fabricated)
>   2. Justifikace přes URS_MATCHER lookup nebo Kfely cross-reference
>   3. Citace zdroje pro množství (z Phase C calculator output)
> 
> Pokud OTSKP kód nelze najít deterministicky → STOP a AskUserQuestion.
> Лучше пауза чем fabricated kódy.

---

## ARCHITEKTONICKÉ ZÁVISLOSTI (číst PŘED implementací)

### 1. URS_MATCHER service

**Audit:**
- `URS_MATCHER_SERVICE/backend/` — local spin-up alternativa
- Cloud Run production endpoint (cred z user)
- Local catalog: `data/URS201801.csv` ~12K rows

**Klíčové otázky pro PRE-INTERVIEW:**
- Jak se volá URS_MATCHER z sandbox (HTTP / direct CSV / npm package)?
- Jaký je response format? (`{kod, popis, mj, jednotková_cena}` nebo jiné?)
- Existuje **OTSKP** lookup samostatně od **URS** (jiný catalog)? Per memory:
  - URS = univerzální klasifikace (12K položek, materiál + práce v jednom)
  - OTSKP = státní katalog pro PK (17904 položek, ŘSD)

### 2. OTSKP catalog v KB

**Audit:**
- `concrete-agent/packages/core-backend/app/knowledge_base/B1_otksp/` (per memory)
- Hledat: `otskp.db` SQLite, JSON, CSV?
- Jaká je struktura: kód / popis / MJ / kategorie / vendor cena?

**OTSKP code pattern** (per memory):
```
4-digit prefix (element) + 5th digit work type
1=výroba, 2=čerstvý beton, 3=transportní, 5=bednění, 6=výztuž, 7=předpětí
```

Příklady z Kfely SO 201:
- `224324` — piloty Ø900 C25/30 (2=základy, 24=piloty, 3=transport, 24=Ø900)
- `272325` — základy opěr C30/37 (27=základ opěr)
- `333325` — dříky, křídla C30/37 (33=svislé konstrukce, 3=transport, 25=C30/37)
- `317325` — římsy C30/37
- `420324` — přechodové desky C25/30
- `711442` — izolace NAIP

### 3. Kfely XML jako template

**Path:** `test-data/most-2062-1-zihle/inputs/reference/20_Rekonstrukce_mostu_Kfely__zadání_.xml`

**Format:** UNIXML 1.2 KROS export. Struktura:
```xml
<unixml>
  <stavba>
    <objekty>
      <objekt>
        <kod_objektu>SO 001</kod_objektu>
        ...
        <polozka>
          <typ_vety>K</typ_vety>
          <typ_polozky>HSV</typ_polozky>
          <kod_polozky>014102</kod_polozky>
          <cislo_polozky>1</cislo_polozky>
          <mnozstvi>5766,70</mnozstvi>
          <jednotkova_cena>0,00</jednotkova_cena>
          <poznamka_polozky>...</poznamka_polozky>
        </polozka>
        ...
```

153 položek total (4 SO objekty: 001 / 180 / 201 / ZS).

### 4. Phase B/C artefakty (vstup pro Phase D)

- `02_design/element_breakdown.yaml` — input parametry
- `02_design/concrete_classes.yaml` — exposure + krytí per element
- `03_calculation/outputs/*.json` — calculator PlannerOutput per element
- `03_calculation/cost_summary.xlsx` — agregace
- `02_design/decomposition_so.md` — SO struktura

---

## PRE-IMPLEMENTATION INTERVIEW (ответ ПЕРЕД kódom!)

1. **URS_MATCHER access:** local CSV nebo HTTP service? Jak ho volá `Monolit-Planner/`
   nebo `concrete-agent/packages/core-backend/app/api/`? Sleduj existing pattern.

2. **OTSKP DB structure:** kde přesně je catalog v repo? Format (SQLite / JSON / CSV)?
   Existuje search wrapper v Python/Node?

3. **Kfely XML parser:** existuje shared utility pro parsing UNIXML v repo?
   Pokud ne, napsat helper v `04_documentation/utils/` (NOT v shared/).

4. **TZ template existuje?** Audit `test-data/tz/bridges/SO-202_D6_most_golden_test.md`
   pro strukturu reálné TZ. Existuje generic TZ template někde v `docs/templates/`?

5. **Soupis prací format:** preferuje user UNIXML KROS export (.xml) nebo XLSX export
   nebo oba? Per memory: "KROS: screen-view only (no export)" pro Libuše project —
   ale reference Kfely XML existuje, takže formát je known.

6. **Provizorium OTSKP coding:** Kfely SO 180 = objížděná (jiný typ). Pro provizorium
   (Mabey/Bailey) jaká OTSKP položka? Audit zda existuje precedent v jiných golden testech
   (`test-data/tz/bridges/`) nebo v projektech `test-data/projects/`. Pokud ne — flag jako
   externí požadavek (dohledat v ŘSD ceník).

> Pokud na cokoli nelze odpovědět z auditu — STOP a AskUserQuestion. Лучше пауза.

---

## ČÁST 1: OTSKP MAPPING

**Cíl:** pro každý element Žihle najít odpovídající OTSKP položky (1 element může = několik položek: beton + bednění + výztuž + transport).

### 1.1 Postup

1. Načíst `02_design/element_breakdown.yaml` — list elementů
2. Načíst `03_calculation/outputs/*.json` — quantities per element
3. Pro každý element:
   - **Lookup v OTSKP DB** přes URS_MATCHER nebo přímý query (z Q1 audit)
   - **Cross-reference s Kfely SO 201** — pokud existuje analogický element s OTSKP kódem
   - **Volba kódu** podle pravidla:
     1. Exact match (element type + concrete class + exposure) — confidence 1.0
     2. Same element type + similar concrete (např. C30/37 vs C35/45) — confidence 0.85, flag
     3. Same element type, different sub-spec — confidence 0.7, flag warning
     4. No match → STOP, AskUserQuestion

### 1.2 Element-to-OTSKP mapping table (předběžný — finalizes agent)

| Žihle element | Kfely SO 201 reference | Žihle adaptation |
|---|---|---|
| podkladni_beton | (Kfely 451323 podkladní beton C16/20) | C12/15 → najít odpovídající kód |
| zaklad_oper | Kfely 272325 (C30/37 XF1+XA1) | Použít stejný kód, naše exposure XC2+XF1 |
| drik_oper | Kfely 333325 (dříky+křídla C30/37) | Stejný kód |
| zaverni_zidky | Kfely 333325 (závěrné zídky included) | Stejný kód, separately oddělit pokud možné |
| mostovka_deska | **Kfely 424A14 = prefab + spřahující** | ⚠️ NEPOUŽITELNÉ — najít OTSKP pro **monolitickou** deset rámového mostu |
| rimsy | Kfely 317325 (mostní římsy C30/37) | Stejný kód |
| prechodove_desky | Kfely 420324 (přechodové desky C25/30) | Stejný kód |
| ulozeni_prechodove_desky | Kfely 42838 (uložení přechodové desky kloub) | Stejný kód |
| izolace_NK | Kfely 711442 (izolace NAIP tl. 5 mm) | Stejný kód |
| ochrana_izolace | Kfely 711432 (ochrana izolace pod římsami) | Stejný kód |
| svodidlo_zabradelni | Kfely 9117C1 (mostní zábradelní svodidlo H2) | Stejný kód, ZD vyžaduje H2/W3 |
| svodidlo_silnicni | Kfely 9113B1 (silniční svodidlo před+za) | Stejný kód |
| dlazba_koryta | Kfely 465512 (dlažba lomový kámen tl. 200 mm) | Stejný kód |
| beton_lozni_dlazba | Kfely 45131A (lože C20/25) | Stejný kód |
| ... | ... | ... |

**Žihle-specifické (nemá v Kfely):**
- Provizorium SO 180 — nový lookup (Kfely má objížděnou, ne provizorium)
- Demolice 16 trámů s I-280 — Kfely SO 001 má prefab demolice; náš případ specifičtější

### 1.3 Output deliverable

**`04_documentation/otskp_mapping.yaml`** — strukturovaný:

```yaml
elements:
  podkladni_beton:
    otskp_kod: <vyplnit po URS_MATCHER lookup>
    nazev_polozky: <z URS_MATCHER>
    mj: m3
    mnozstvi: <z 03_calculation outputs>
    jednotkova_cena_orientacni_kc: <z URS_MATCHER vendor avg, flag if missing>
    confidence: 1.0  # nebo 0.85, 0.7
    source: "URS_MATCHER (kód xyz)" / "Kfely SO 201 row N analogie"
    note: ""

  drik_oper:
    otskp_kod: "333325"
    nazev_polozky: "dříky, křídla, podložiskové bloky a závěrné zídky z betonu C30/37"
    mj: m3
    mnozstvi: 25.4  # vyplnit z calculator output
    jednotkova_cena_orientacni_kc: <vyplnit>
    confidence: 1.0
    source: "Kfely SO 201 row 43, OTSKP kód 333325, exact match"
    note: "ZD §4.4.l (bez ložisek) — 'podložiskové bloky' v názvu OTSKP nepoužitelné, odůvodnit ve TZ že integrální rám tyto neobsahuje"
```

---

## ČÁST 2: SOUPIS PRACÍ XML (UNIXML KROS)

**Cíl:** vyrobit `04_documentation/soupis_praci_zihle_2062-1.xml` v UNIXML formátu identifikem k Kfely struktuře.

### 2.1 Struktura

4 SO objekty analogicky k Kfely:

```
SO 001 — Demolice stávajícího mostu (~25-30 položek)
SO 180 — Provizorium (~5-8 položek) — NE objízdná!
SO 201 — Most ev.č. 2062-1 (~80-90 položek)
ZS — Zařízení staveniště (1 položka — agregát z 3-5%)
```

### 2.2 Položky SO 001 — Demolice

Analogicky Kfely SO 001 (33 položek), škálováno pro Žihle:
- Skládka dle materiálu (014102, 014132)
- Odstranění porostu (111208) — pokud relevantní
- Odstranění vozovky (113328 štěrkodrť, 113728 frézování)
- Čerpání vody (11511) — kratší doba než Kfely
- Sejmutí ornice (121108)
- Výkop (13173)
- Demontáž značek (914123, 914933)
- **Bourání NK** — 96618x (specific pro náš případ: 16 trámů s I-280)
  - Pozor: Kfely 966118 = "bourání nosné konstrukce z předpjatých prefabrikovaných nosníků" — **nepoužitelné**, naše NK je litá ŽB s ocelovými I-vložkami
  - Najít OTSKP položku pro **bourání monolitické ŽB konstrukce s ocelovými profily**
- Bourání spodní stavby — 966168 (Kfely "bourání spodní stavby a ŽB desky") — applicable
- Odstranění mostní izolace (97817)

### 2.3 Položky SO 180 — Provizorium

**Žádný Kfely template** (Kfely je objížděná, jiný typ). Položky pro provizorium:
- Zřízení provizoria (Mabey C200 / Bailey / Acrow) — najít OTSKP code
- Pronájem za měsíc × 4-6 měsíců
- Demontáž
- Doprava
- Světelná signalizace (semafor)
- Dopravní značení DIO
- Převedení provozu

**TODO před implementací:** ověřit že OTSKP má položky pro provizorium. Pokud ne — flag jako "vendor RFQ pricing required, OTSKP coding unavailable, manual entries with custom codes 9xxxxx".

### 2.4 Položky SO 201 — Most

Analogicky Kfely SO 201 (112 položek), s následujícími adaptacemi:

**REMOVE (nepoužitelné pro integrální rám):**
- ❌ Piloty 224xxx (pokud plošné základy — TBD per IGP)
- ❌ Vrty pro piloty 264xxx (pokud žádné piloty)
- ❌ Pilíře 334xxx (žádné mezilehlé pilíře)
- ❌ Mostní ložiska 428xxx (řádky 51-55)
- ❌ Mostní závěr 93152
- ❌ Předtěsnění 93135 (pouze pro mostní závěry)
- ❌ Těsnění spáry mezi římsou a vozovkou 931326 (zachovat — římsa stále přiléhá k vozovce)
- ❌ Mostovka 424A14 (prefab — naše je monolitická)

**ADD (nové oproti Kfely):**
- ✅ Monolitická mostovková deska — najít OTSKP code (je v 333xxx? 320xxx?)
- ✅ Skruž z stojek (DOKA Multiprop / PERI Multiprop / IP) — pokud OTSKP rozlišuje typ
- ✅ Bednění desky — Top 50 / Multiflex
- ✅ Vodorovná hydroizolace pod přechodové deskou (per ČSN 73 6244)

**KEEP (analogicky Kfely):**
- ✅ Drobná zemní práce (zemina, ornice, výkopy, zásyp)
- ✅ Plošný základ opěr (pokud místo pilot — TBD per IGP)
- ✅ Dříky opěr (333325)
- ✅ Závěrné zídky (333325 nebo separate)
- ✅ Křídla — **flag — Žihle nemá křídla per varianta 01_integralni_ram**
- ✅ Římsy (317325) + výztuž (317365)
- ✅ Přechodové desky (420324) + výztuž (420365)
- ✅ Izolace NAIP (711442) + ochrana (711432)
- ✅ Vozovka (574xxx ACP/ACL/SMA + 575C53 ochrana mostovky + 576413 posyp)
- ✅ Svodidla mostní (9117C1) + silniční (9113B1)
- ✅ Dlažba koryta (465512) + lože (45131A) + pat. prahy (461314)
- ✅ Drenáže (875332, 87534, 87634)
- ✅ Odvodňovače (936532, 936542) — POZOR: ZD §4.4.l "bez složitého odvodnění" — minimalizovat
- ✅ Geodetická činnost (02911, 02912)
- ✅ Mostní list (029412)
- ✅ Realizační dokumentace (02943)
- ✅ Dokumentace skutečného provedení (02944)
- ✅ První HPM po dokončení (02953)
- ✅ Informační tabule (02991)
- ✅ Otryskání povrchu mostovky (938255)
- ✅ Letopočet vlisem (93631)

### 2.5 ZS

Standardní agregát 3-5% z hlavních prací (per ČSN 73 0212):
- 1 položka: kód `ZS`, mnozstvi `1.00`, jednotková cena = výpočet 4% × Σ(SO 001 + SO 180 + SO 201)

### 2.6 Output

**`04_documentation/soupis_praci_zihle_2062-1.xml`** — UNIXML KROS format
**`04_documentation/soupis_praci_zihle_2062-1.xlsx`** — XLSX duplicate pro screen view

---

## ČÁST 3: TZ PRO DUR (Technická zpráva)

**Cíl:** narrativní dokumentace pro **Dokumentaci pro územní rozhodnutí**.

> **Poznámka:** ZD vyžaduje DPS (Dokumentace pro provedení stavby) + DSPS, ale DUR
> je **vstupem** do DPS. Pro sandbox děláme zatím TZ pro DUR (kratší, executive level).
> DPS detailing je 50-100+ stran a vyžaduje statický výpočet — out of scope.

### 3.1 Struktura TZ pro DUR

Per vyhláška 499/2006 Sb. + běžná praxe v ČR:

```
A. Identifikační údaje
   A.1 Údaje o stavbě
   A.2 Údaje o stavebníkovi
   A.3 Údaje o zpracovateli dokumentace
   A.4 Údaje o stávajícím stavu

B. Souhrnná technická zpráva
   B.1 Popis území stavby
       - Charakteristika území
       - Vazba na ÚP, regulační plán
       - Soulad s územně plánovací dokumentací
   B.2 Celkový popis stavby
       - Účel, funkce, kapacita
       - Architektonické a urbanistické řešení
       - Konstrukční a technické řešení (HLAVNÍ část — odkaz na Phase B varianta_01)
       - Stavebně technické řešení a technické vlastnosti
   B.3 Připojení na technickou infrastrukturu
   B.4 Dopravní řešení
   B.5 Řešení vegetace a souvisejících terénních úprav
   B.6 Popis vlivů stavby na životní prostředí
   B.7 Ochrana obyvatelstva
   B.8 Zásady organizace výstavby
       - Provizorium (KRITICKÉ — Vysvětlení ZD č.1!)
       - Etapy výstavby
       - Doba realizace (z Phase C)
   
C. Situační výkresy (zde jen reference — výkresy mimo scope)

D. Dokumentace objektů (zde jen SO-list per Phase B decomposition)

E. Dokladová část (zde jen list dokumentů — HPM, ZD, Vysvětlení, ...)
```

### 3.2 Klíčové sekce s justifikací z KB

**B.2 Konstrukční a technické řešení — citace MUST:**

- "Most navržen jako monolitický integrální rámový most v jednom poli."
  → Pokorný-Suchánek kapitola 4 (rámové mosty pro malé pólová s rozpětím do ~30 m)
- "Volba integrálního rámu vychází z požadavku zadavatele na konstrukci bez ložisek a bez dilatačních závěrů."
  → ZD §4.4.l, čl. 4.4 odst. l — citovat
- "Tloušťka desky 0.45 m odpovídá poměru 1/20 L pro integrální rám s rozpětím L=9 m."
  → Pokorný-Suchánek tab. 15, str. 119
- "Beton třídy C30/37 dle EN 1992-2 §3.1.2 doporučení (Cmin=C30/37 pro mosty)."
  → SIST-EN-1992-2-2005.pdf §3.1.2
- "Krytí výztuže 40 mm (deska) / 50 mm (opěry, římsy) odpovídá EN 1992-2 §4.4 pro třídy prostředí XC4+XF2."
  → SIST-EN-1992-2-2005.pdf §4.4 + Annex E
- "Třída ošetřování 4 dle TKP18 §7.8.3 — minimální 9 dní ošetřování při 15-25°C."
  → TKP 18 §7.8.3 (B7_regulations/tkp_18*/)
- "Zatížitelnost nového mostu Vn=32t / Vr=80t / Ve=180t (skupina 1 dle ČSN 73 6222)."
  → ZD §4.4.h + UPa lecture slides slide 4 (B6_research_papers/upa_zatizitelnost_sanace_mostu/)
- "Návrhová životnost NK + spodní stavby ≥ 60 let."
  → UPa slides slide 19 (B9_validation/lifecycle_durability/)

**B.8 ZOV — povinné citace:**

- "Provizorium typu Mabey C200 / Bailey panel / Acrow umístěno vpravo od stávajícího mostu (foto site survey 2026-04-21)."
  → Phase A foto + Vysvětlení ZD č.1 (2026-04-24)
- "Skruž z stojek z dna stavební jámy — světlá výška pod stávajícím mostem (~1 m) neumožňuje skruž z přirozeného terénu."
  → Phase A foto + Pokorný-Suchánek kapitola 14 (pevná skruž stojkami)
- "Etapizace: provizorium → demolice → výkop → základy → opěry → bednění+výztuž→betonáž → ošetřování ≥9d → mostní svršek → izolace → vozovka → svodidla → demontáž provizoria → koryto+opevnění."
  → Phase B varianta_01_integralni_ram.md

### 3.3 Output

**`04_documentation/TZ_DUR_zihle_2062-1.md`** — markdown, ~15-25 stran

Struktura jako reálné TZ (např. SO-202 D6 reference s odkazem na podstrukturu).

---

## ČÁST 4: VALIDACE + SUMMARY UPDATE

### 4.1 Cross-validation

- **Σ(soupis položky × jednotková cena)** = directly calculator total z Phase C? (±5% tolerance)
- Pokud rozdíl >10% → **flag** v TZ jako "uncalibrated unit prices, requires zhotovitel quotes"

### 4.2 Update artefakty

- `00_PROJECT_SUMMARY.md` — добавить sekci "Phase D outputs"
- `metadata.yaml` — `status: documented` (z `calculated`)
- `README.md` — přidat odkazy na soupis + TZ

### 4.3 Snapshot pro budoucí golden test

V `00_PROJECT_SUMMARY.md` zaznamenat:
- 5 calculator workarounds z Phase C (per backlog)
- N OTSKP položek s confidence < 1.0 (per Phase D)
- Provizorium gap: chybí OTSKP precedent (pokud potvrzeno v Q6)

---

## ACCEPTANCE CRITERIA

### Část 1 (OTSKP mapping)
1. ✅ `otskp_mapping.yaml` obsahuje řádek pro každý element z Phase B
2. ✅ Každý řádek má OTSKP kód + zdroj (URS_MATCHER nebo Kfely cross-ref)
3. ✅ Confidence < 1.0 řádky jsou explicitně flagged
4. ✅ Provizorium handled (buď OTSKP nalezeno, nebo dokumentováno jako gap)

### Část 2 (Soupis prací)
5. ✅ `soupis_praci_zihle_2062-1.xml` je validní UNIXML 1.2
6. ✅ Struktura 4 SO (001 / 180 / 201 / ZS) per Phase B decomposition
7. ✅ Žádné položky pro mostní ložiska / mostní závěry / pilíře (integrální rám)
8. ✅ Σ množství × jednotková cena ±10% calculator total z Phase C
9. ✅ XLSX duplikát vytvořen pro screen view

### Část 3 (TZ pro DUR)
10. ✅ `TZ_DUR_zihle_2062-1.md` ~15+ stran, struktura per vyhláška 499/2006
11. ✅ Každé technické rozhodnutí má citaci KB (Pokorný / EN 1992-2 / UPa / ZD)
12. ✅ Sekce B.8 ZOV explicitně cituje Vysvětlení ZD č.1 (provizorium povinné)
13. ✅ Žádné "engineering judgment without source" — pokud chybí KB, flag

### Část 4 (Summary)
14. ✅ `metadata.yaml` status = `documented`
15. ✅ `00_PROJECT_SUMMARY.md` má sekci Phase D s findings
16. ✅ README odkazuje na TZ + soupis

### Cross-cutting
17. ✅ Žádný kód mimo `test-data/most-2062-1-zihle/04_documentation/` nebyl změněn
18. ✅ KB pouze čteme, neměníme
19. ✅ Existing CI projde bez regresí

---

## ČO NEPATRÍ DO TOHTO TASKU

- ❌ DPS (Dokumentace pro provedení stavby) — vyžaduje statický výpočet, ~50-100 stran
- ❌ DSPS (Dokumentace skutečného provedení) — pouze po realizaci
- ❌ Statický výpočet dle EN 1992-2 §5+6 (zhotovitel)
- ❌ Detailní výkresy (architecturní + konstrukční)
- ❌ Vendor RFQ na provizorium nebo materiály
- ❌ Geodézie / IGP / hydrologie
- ❌ Vyplnění Přílohy č. 3 ZD (Prohlášení o ceně) — to je pro reálnou nabídku, ne sandbox
- ❌ Konverze Žihle → golden test (`test-data/tz/bridges/`) — separate task po dokončení Phase D

---

## VÝSTUP DO CHATU PO DOKONČENÍ

1. **Soupis stats:** počet položek per SO, total bez DPH (orientačně), confidence distribution
2. **TZ stats:** počet stran, počet citací KB, sekce kde chybí source
3. **Calibration check:** Σ(soupis) vs Phase C calculator output (% odchylka)
4. **Provizorium gap status:** vyřešeno OTSKP nebo flagged?
5. **Strom artefaktů:** `tree -L 2 test-data/most-2062-1-zihle/04_documentation/`
6. **Co je třeba pro reálnou nabídku** — update work list (od Phase A list)

---

## Naming a strukturu určuj podle existujících konvencí v repu.
## Pokud existuje konflikt mezi Kfely (vendor reference) a OTSKP (autoritativní katalog)
## — vždy vítězí OTSKP. Kfely je structurnyм образцом, autoritu má katalog.
