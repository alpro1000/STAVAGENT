# Klasifikace monolitů + rozklad katalogu na pozice — Requirements

> **Spec ID:** `monolith-classification`
> **Datum:** 2026-07-10
> **Status:** draft
> **Priority:** P1
> **Owner:** Alexander Prokopov
>
> **Dependencies:** — (staví na hotovém #1470 «monolit = vypočitatelný beton» + add-work gate)
> **Blocks:** budoucí ne-betonové kalkulátory (jiné obory) — až budou, poběží na téže klasifikační/skupinové vrstvě

---

## 1. Kontext

### 1.1 Co teď je

V aplikaci žijí **dva rozdílné světy klasifikace** «co je monolitická betonová práce». Cesta **«Nahrát Excel»** má silnou logiku (marka betonu C../.., vyloučení prefabrikátů, párování výztuž/bednění k rodičovskému betonu) a vypisuje **jen betonové práce**. Cesta **«Načíst z Rozpočtu»** používá slabší sdílený klasifikátor (klíčová slova + OTSKP-prefix), vyloží **celou tabulku** a část řádků chybně označí za monolit. Kvůli tomu vznikl přepínač «Jen monolity» a ruční ✓/✗ toggle. #1470 už zavedl pravidlo «monolit = jen vypočitatelný beton (má betonový řádek nebo m³)», ale to je jen frontend-vrstva a m³ je slabý signál.

### 1.2 Proč to měníme

Kalkulátor se má stát **univerzálním nástrojem**. K tomu potřebuje jeden spolehlivý úsudek: pro každý řádek smety odpovědět **(a) je to monolitická betonová práce?**, **(b) jaká sub-role** (beton / bednění montáž/demontáž / výztuž / ostatní), **(c) s jakou jistotou** — a to **stejně pro obě cesty importu** a **napříč katalogy** (OTSKP, ÚRS, mezinárodní). Zároveň se stejná konstrukce v různých katalozích rozepisuje jinak (OTSKP: bednění v ceně betonu + výztuž zvlášť; ÚRS: vše zvlášť + bednění dělené na montáž/demontáž). Přípravář nesmí bojovat s klasifikátorem a výstup kalkulátoru (pracnost vázání výztuže, montáže bednění, doba) se musí správně rozdělit zpět na smetní pozice.

### 1.3 Vztah ke steeringu

| Steering doc | Vztah |
|---|---|
| `product.md` | Univerzální stavební kalkulátor CZ/SK (+ mezinárodní výhled) — klasifikace je vstupní brána |
| `tech.md` | Determinism-first: katalog/regex/marka betonu PŘED jakýmkoli AI; sdílený TS engine |
| `structure.md` | Logika žije ve sdíleném balíku Monolit-Planneru + parserech backendu; obě cesty importu ji konzumují |
| `domain.md` | §1 Calculator philosophy (±10-15 %, technologická správnost); confidence ladder |
| `conventions.md` | §9 task discipline, §10 univerzalita po oborech (tento spec = obor beton/statika D.1.2, ale klasifikátor musí být katalog-agnostický) |

---

## 2. User stories

### 2.1 Story 1 — Přípravář (OTSKP smeta)

> **Jako** přípravář, který pracuje hlavně s OTSKP
> **chci** aby import z rozpočtu poznal betonové monolity stejně dobře jako import z Excelu (jen beton, bez balastu)
> **abych** nemusel ručně proklikávat ✓/✗ u desítek řádků.

### 2.2 Story 2 — Přípravář (ÚRS smeta)

> **Jako** přípravář s ÚRS smetou (beton + bednění montáž + bednění demontáž + výztuž = 4 řádky na jeden prvek)
> **chci** aby se tyto řádky seskupily do JEDNOHO vypočitatelného prvku
> **abych** viděl jednu konstrukci s jednou cenou Kč/m³, ne čtyři rozsypané položky.

### 2.3 Story 3 — Přípravář (výstup → pozice)

> **Jako** přípravář
> **chci** aby pracnost, kterou kalkulátor spočítá (vázání výztuže, montáž/demontáž bednění, betonáž), padla na odpovídající smetní pozici, a aby doba prvku byla kritická cesta (ne prostý součet)
> **abych** věděl, že dny na vázání výztuže JSOU v termínu betonáže a nedvojí se.

### 2.4 Story 4 — Mezinárodní uživatel (výhled)

> **Jako** uživatel mimo CZ/SK
> **chci** aby nástroj poznal beton i podle marek jiných norem (EN 206 / US / DIN) a jiných systémů kódů
> **abych** ho mohl použít na zahraniční smetu.

---

## 3. Acceptance criteria (EARS format)

### 3.1 Krit. 1 — Marka betonu jako silný signál

> **When** řádek obsahuje marku betonu (`C../.., LC../.., UHPC`) a NEobsahuje prefab-signál
> **then** system **shall** klasifikovat řádek jako betonovou práci (sub-role dle jednotky/kódu/klíčových slov).
> **Důkaz:** golden test na řádcích SO-202 / Žihle 2062-1 (marka → beton).

### 3.2 Krit. 2 — Prefabrikát NENÍ monolit

> **When** řádek obsahuje marku betonu i prefab-signál (`prefa`, `dílec`, `prefab`)
> **then** system **shall** klasifikovat řádek jako NE-monolit (hotový výrobek, nepočítá se).
> **Důkaz:** golden test — «PATKY Z DÍLCŮ BETON DO C16/20» → NE-monolit.

### 3.3 Krit. 3 — m³ sám o sobě je slabý signál

> **If** řádek má jednotku m³, ale NEmá marku betonu, betonový kód ani betonové klíčové slovo
> **then** system **shall** NEoznačit ho automaticky za monolit (spadne na ne-monolit / «jiné»; ruční override zůstává možný).
> **Důkaz:** golden test — «PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z KAMENIVA TĚŽENÉHO» (m³, kamenivo) → NE-monolit.

### 3.4 Krit. 4 — Obě cesty importu klasifikují stejně

> **When** týž řádek přijde přes «Nahrát Excel» i přes «Načíst z Rozpočtu»
> **then** system **shall** vrátit STEJNÝ výsledek klasifikace (monolit? + sub-role).
> **Důkaz:** parita test — stejný vstupní řádek, oba vstupní kanály, shodný `is_monolith` + sub-role.

### 3.5 Krit. 5 — Seskupení řádků do prvku (katalog-varianty)

> **When** smeta obsahuje beton a k němu patřící výztuž/bednění jako samostatné řádky (párovatelné podle názvu nebo prefixu kódu)
> **then** system **shall** seskupit je do jednoho prvku a označit, co je zahrnuto (`bednění v ceně betonu`, `výztuž zvlášť`).
> **Důkaz:** golden testy pro 4 rozvržení: (a) OTSKP beton-vč-bednění + výztuž zvlášť, (b) ÚRS vše zvlášť + bednění montáž/demontáž, (c) vše v jedné pozici, (d) vše samostatně bez děleného bednění.

### 3.6 Krit. 6 — Filtr «Jen monolity» = jen vypočitatelný beton

> **While** je aktivní filtr «Jen monolity»
> **the system shall** zobrazit pouze prvky, které jsou vypočitatelný betonový monolit (mají betonový řádek nebo jsou na něj povýšitelné), a skrýt kamenivo / prefab / zemní práce / cizí obory.
> **Důkaz:** UI — na smíšené smetě zůstanou po zapnutí filtru jen betonové prvky.

### 3.7 Krit. 7 — Ruční override je absolutní

> **When** uživatel ručně přepne prvek na MONOLIT / NE-MONOLIT
> **then** system **shall** respektovat override nade všemi automatickými signály a zachovat ho napříč reloady.
> **Důkaz:** toggle → reload → stav drží (metadata override).

### 3.8 Krit. 8 — Výstup kalkulátoru → správná pozice

> **When** kalkulátor spočítá pracnost sub-prací (vázání výztuže, montáž/demontáž bednění, betonáž)
> **then** system **shall** zapsat pracnost na odpovídající smetní pozici (výztuž → výztuž, bednění → bednění; při «bednění v ceně betonu» svinout do betonu) a dobu prvku vykázat jako kritickou cestu harmonogramu, ne prostý součet.
> **Důkaz:** po «Aplikovat» — dny na vázání výztuže jsou součástí termínu betonáže (kritická cesta), pracnost je na řádku výztuže, ne dvojena.

### 3.9 Krit. 9 — Ne-betonové skupiny: ruční přidání jen «jiných» prací

> **If** skupina není monolit
> **then** system **shall** v «Přidat práci» nabídnout jen volnou «Vlastní práci», ne betonářské práce (bednění/výztuž/zrání/podpěra/předpětí).
> **Důkaz:** hotovo v #1470 — regres-test, že se nezmění.

### 3.10 Krit. 10 — Nízká jistota → viditelný příznak, ne tiché rozhodnutí

> **If** klasifikace je nejednoznačná (žádný silný signál, konflikt signálů)
> **then** system **shall** přiřadit nízkou jistotu a nechat rozhodnutí na ručním toggle (nikdy tiše nezahodit řádek).
> **Důkaz:** řádek bez kódu/marky/klíčového slova → nízká confidence + dostupný toggle.

---

## 4. Doménová pravidla

- **Marka betonu** = silný signál: `C\d{1,3}/\d{1,3}`, `LC..`, UHPC `C110..C170` (EN 206). Mezinárodní marky = výhled (viz §5).
- **Prefab-vyloučení:** `prefa` / `dílec` / `prefab` v popisu → hotový výrobek, NE-monolit — i když má marku a m³.
- **Kamenivo/zásyp NENÍ beton:** `kameniv, drcen, těžen, štěrk, písek, zemina, recyklát` bez betonového signálu → NE-monolit.
- **Confidence ladder** (nejvyšší přebíjí nižší): ruční override 0.99 > marka betonu + ne-prefab > deterministický kód katalogu > klíčové slovo > jednotka (jen jako tie-break, nikdy sama).
- **OTSKP prefixy:** §27/28 základy, §31–35 svislé, §41–48 vodorovné betonové = monolit; §451+ podsypy/podkladní z kameniva, §11–18 zemní = NE-monolit. (Detaily v `domain.md` / sdíleném klasifikátoru.)
- **ÚRS specifikum:** bednění dělené na montáž a demontáž jako dvě pozice; vše rozepsané zvlášť.
- **Doba prvku = kritická cesta** (bednění-montáž → vázání výztuže → betonáž → zrání → distanc): sub-práce jsou sekvenované, dny se nedvojí a nesčítají naivně.

---

## 5. Out of scope (co toto **NENÍ**)

- ❌ Přepis výpočtového engine kalkulátoru (fáze, RCPSP, cenotvorba) — engine zůstává; měníme klasifikaci + skupinování + mapování výstupu.
- ❌ Plná podpora mezinárodních katalogových systémů kódů — Stage 5, jen připravit rozšiřitelnost (marky EN/US/DIN jako pluggable), ne implementovat všechny.
- ❌ Cenotvorba / KROS zaokrouhlení / TOV bridge — jiná vrstva (řešeno separátně #1466/#1471).
- ❌ Ne-betonové kalkulátory (silnoproud, ZTI, …) — až budou, poběží na téže vrstvě, ale nejsou součástí tohoto spec.
- ❌ Změna toho, že import z rozpočtu vykládá CELOU tabulku (rozhodnuto v #1454 — necháváme, jen líp klasifikujeme).

---

## 6. Open questions

> Rozhodnout v PRE-IMPLEMENTATION INTERVIEW (viz `tasks.md` Gate 0) PŘED prvním implementačním commitem.

- [ ] **Hranice «monolitu»:** stačí «marka betonu NEBO betonový kód, a ne prefab»? Nebo i «m³ + betonové klíčové slovo»? (m³ sám = ne.)
- [ ] **Podkladní beton (prostý beton C../.., kód §451x):** je to počítaný monolit, nebo «jiné»? (V UI teď červený ✗ — potvrdit záměr.)
- [ ] **Agresivita seskupení:** párovat automaticky vždy (název ≥2 slova / prefix kódu), nebo jen navrhnout a nechat potvrdit?
- [ ] **Import z rozpočtu — filtr:** vykládat celou tabulku (dnešní stav) a jen líp klasifikovat, nebo přidat volitelný režim «jen beton» jako u Excelu?
- [ ] Kdo je autorita pro OTSKP↔ÚRS prefixové mapy — existující sdílený klasifikátor rozšířit, nebo doplnit doménovou tabulku?

---

## 7. References

- Steering: `docs/steering/domain.md §1`, `docs/steering/conventions.md §9/§10`
- Existující kód k prozkoumání (Gate 0 audit): silný Excel-extraktor betonu (marka + prefab + párování) v backendu Monolit-Planneru; sdílený monolith-klasifikátor; frontend seskupení prvků ve «flat» tabulce pozic; cesta importu z rozpočtu (Registry→Portal→Monolit). **Nepředepisovat nová jména — rozšířit existující.**
- Golden reference projekty: `test-data/tz/SO-202*`, `test-data/most-2062-1-zihle/`
- Related: #1470 (monolit=vypočitatelný beton), #1454 (whole-table import), MCP `classify_construction_element`

---

## 8. Versioning

| Date | Version | Changes |
|---|---|---|
| 2026-07-10 | 0.1 | Draft z deep-debug session (Alexander «GO») |
