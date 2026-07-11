# Klasifikace monolitů + rozklad katalogu na pozice — Design

> **Spec ID:** `monolith-classification`
> **Datum:** 2026-07-10
> **Status:** draft
> **Navazuje na:** `requirements.md`

---

## 1. Přehled řešení

Jeden **sdílený klasifikátor** a jedna **sdílená skupinová vrstva**, které konzumují **obě** cesty importu (Excel i rozpočet), plus explicitní kontrakt **«výstup kalkulátoru → smetní pozice»**. Silná logika, kterou dnes má jen Excel-extraktor (marka betonu, vyloučení prefabrikátů, párování výztuž/bednění k betonu), se povýší do sdíleného balíku a stane se jediným zdrojem pravdy. Klasifikace probíhá **deterministicky first** (marka/kód/klíčové slovo), jednotka je jen tie-break. Nad tím jede seskupení řádků do vypočitatelných prvků respektující 4 katalogová rozvržení.

---

## 2. Architectural fit

### 2.1 Které služby jsou dotčené

| Služba | Změna |
|---|---|
| Monolit-Planner (shared) | Nový domov sjednoceného klasifikátoru + skupinové logiky (rozšíření stávajícího sdíleného modulu, ne paralelní) |
| Monolit-Planner (backend) | Excel-parser přestane mít vlastní klasifikaci, volá sdílenou |
| Monolit-Planner (frontend) | Seskupení prvků + filtr «Jen monolity» + toggle čtou sdílenou vrstvu (částečně hotovo #1470) |
| stavagent-portal / rozpocet-registry | Cesta importu z rozpočtu do Monolitu prochází stejnou klasifikací (přes existující integrační seam) |
| concrete-agent (MCP) | `classify_construction_element` — parita, aby MCP-výstup odpovídal enginu (viz §4.3) |

### 2.2 Vztah ke stávajícím subsystémům

Staví na hotovém #1470 (frontend «monolit = vypočitatelný beton» + add-work gate). Rozšiřuje existující sdílený monolith-klasifikátor (dnes: override → klíčová slova/kamenivo → OTSKP-prefix → fallback) o **marku betonu** a **prefab-vyloučení** (dnes jen v Excel-extraktoru). Sjednocuje párovací logiku (dnes v Excel-extraktoru) do sdílené vrstvy.

**Gate 0 audit (2026-07-11) — reálný stav (file:line k datu auditu):**

*Sdílený boolean-gate* — `Monolit-Planner/shared/src/monolith-classifier.ts`: `isMonolithicElement()` (:137), žebříček override (`readMonolithOverride`, :117/:139) → kamenivo-vs-beton keywords (:146, `AGGREGATE_KEYWORDS` :26 / `CONCRETE_KEYWORDS` :48) → OTSKP prefixy (:152, non-mono `451–459, 11–18, 564–569, 57, 58` :59; mono `2/3/4` :75) → fallback **true** (:160). Vrací jen boolean — žádná confidence, žádná marka, žádný prefab. Testy existují (kamenivo/override/prefix edge-cases).

*Excel-cesta („silná", ale děravá)* — `backend/src/services/concreteExtractor.js`: PRIMÁRNÍ `extractConcreteOnlyM3` (:408) klasifikuje řádek jako beton čistě podle **marka-regexu** (:421 `[LC]?C\d{1,3}/\d{1,3}` + UHPC `C110–170`); fallback `extractAllConstructionItems` (:1004) podle kódu (:1021 `/^\d{5,6}(-R\d+)?$/`) + jednotky. **Prefab-filtr (`prefa|díl|prefab`, :241) žije JEN ve staré keyword-cestě `isConcreteWork`** — primární grade-search ani fallback ho NEaplikují → „PATKY Z DÍLCŮ C25/30" projde jako beton. Párování `findPairedRows` (:776): výztuž/bednění vzory (:790), rodič = shoda ≥2 slov >4 znaky NEBO 4-znakový prefix kódu (:883); zapisuje `metadata.linked_positions` na rodiče (:978) + **flagy `formwork_included`/`rebar_included` z textu „vč. bednění"/„nezahrnuje výztuž" (:940) — už existují**. `determineSubtype` (:249): unit-first, default **beton** (:270); m³ re-gate přes shared (:144).

*Import-z-rozpočtu („slabá")* — `backend/src/routes/import-from-registry.js`: vlastní `determineSubtype` (:50) — text (`výztuž|ocel|b500` :55, `bedn` :56) → unit-mapa → m³ přes shared gate (:60) → default **jiné** (:71). **Ignoruje bohatší signály, které Portal už vrací** (`row_role`, `skupina`, `monolith_payload` — integration.js:343). **Bulk-INSERT (`POSITION_INSERT_COLUMNS` :76) NEMÁ sloupec `metadata`** → override ani linked_positions na této cestě fyzicky nevzniknou (POST `/api/positions` metadata umí — positions.js:337). Celá tabulka se importuje (#1454 potvrzeno), jediný filtr `qty<=0` (:417).

*Třetí kopie* — `backend/src/services/coreAPI.js` `determineSubtype` (:419): nejslabší — unit-first, default **beton**, žádný monolith/prefab check. Tři kopie se **třemi různými defaulty** (beton/jiné/beton).

*Frontend* — `FlatPositionsTable.tsx`: `elementIsMonolith` (:124, #1470) = shared gate AND (skupina má beton-řádek OR rep unit m³); override zapisován na representative pozici jako JSON `metadata` (:353–385). **Seskupení = čistě `part_name`** (:195) — Registry-import tedy dnes = 1 řádek : 1 skupina, žádné párování. `AddWorkModal` gate `allowConcreteWorks` (:23/:58) hotov.

*Engine element-classifier* (parita-reference) — `shared/src/classifiers/element-classifier.ts`: plný žebříček kód 1.0 / keyword ≤0.9 / tie ≤0.7 + `candidates` (:955–984), DATA z KB-generated artefaktu (gen-knowledge z `element_types.yaml`). Jiná osa než monolith-gate (typ prvku vs je-to-beton) — nesdílejí ani kód, ani konstanty.

*MCP/W3* — `app/mcp/tools/classifier.py`: matcher TYPU předpokládající beton; úzké rejecty (gabion :417, zdivo_obklad :430 přes `family==reject`) s `is_concrete_element=False`+`reject_reason`; marka-regex jen REPORTUJE (`concrete_class_detected` :349), **žádný prefab slovník v YAML**, `reject_materials` v YAML (:281) je deklarován, ale classifier.py ho NEČTE (mrtvý). Výstup nemá `family`. Compat-testy pinují: `element_type, label_cs, confidence, difficulty_factor, rebar_ratio_kg_m3, orientation, recommended_formwork`.

**Důsledky pro Gate 2–4:** (a) domov sjednocení = rozšířit `monolith-classifier.ts` (výsledek přejde z boolean na strukturovaný objekt se sub-rolí + confidence + signals, boolean wrapper zůstane pro zpětnou kompatibilitu); (b) marka-regex a prefab-slovník povýšit tam a VŠECHNY tři `determineSubtype` kopie nahradit voláním; (c) prefab-vyloučení musí platit i při přítomné marce (dnešní hlavní díra); (d) import-z-rozpočtu musí začít číst Portal `row_role`/`skupina` a jeho bulk-INSERT dostat `metadata` sloupec; (e) párování povýšit z `findPairedRows` do shared vrstvy (flagy `formwork_included`/`rebar_included` už existují — zachovat tvar); (f) MCP parita = přidat monolith/prefab osu vědomě (nový aditivní výstup, ne změna stávajících polí).

### 2.3 Tier strategy (LLM / determinism)

**Čistě deterministické** — žádné LLM. Marka betonu (regex), katalogové prefixy (tabulka), klíčová slova, jednotka. To je v souladu s `domain.md §1` (determinism-first, katalog PŘED AI). Mezinárodní marky = další deterministické vzory.

---

## 3. Data flow

```
Surový řádek smety (Excel | rozpočet)
        │
        ▼
[1] KLASIFIKACE (sdílená, deterministická)
     → { is_monolith: bool, sub_role: beton|bednění(montáž/demontáž)|výztuž|jiné,
         confidence, signals: [marka|kód|klíč. slovo|jednotka], is_prefab }
        │
        ▼
[2] SESKUPENÍ (sdílené) — řádky → vypočitatelné prvky
     páruje výztuž/bednění k betonu (název ≥2 slova | prefix kódu),
     řeší 4 katalogová rozvržení, flags: formwork_included / rebar_included,
     bednění montáž+demontáž jako pár
        │
        ▼
[3] KALKULÁTOR (engine — beze změny) počítá pracnost + harmonogram per sub-práce
        │
        ▼
[4] MAPOVÁNÍ «Aplikovat» → smetní pozice
     pracnost sub-práce → odpovídající pozice (výztuž→výztuž, bednění→bednění;
     při formwork_included svinout do betonu); doba prvku = kritická cesta
```

### 3.1 Klíčové datové struktury (koncepčně, jména odvodí implementace z repo)

- **Klasifikační výsledek per řádek:** je-monolit + sub-role + confidence + seznam sekvenčních signálů + prefab-flag.
- **Vypočitatelný prvek:** rodičovský beton + navázané sub-role (bednění montáž/demontáž, výztuž, ostatní) + flags zahrnutí.

### 3.2 Persistence

Bez nové DB tabulky. Klasifikace + override žijí v `metadata` existujících pozic (jako dnes `is_monolith_override`). Seskupení je odvozené (per `part_name` / párování), ne persistované jako nová entita.

---

## 4. API contracts

### 4.1 Nové endpointy

Žádné nové REST endpointy nejsou nutné — klasifikace i seskupení jsou knihovní (sdílený balík), volané v import-parserech a ve frontendu.

### 4.2 Změny existujících endpointů

Import-cesty (Excel upload, import z rozpočtu) vracejí pozice s konzistentní sub-role a seskupením. Tvar odpovědi se rozšiřuje aditivně (nové signální/flag pole), ne breaking.

### 4.3 MCP wrapper (pokud relevant)

`classify_construction_element` má zůstat v paritě se sjednoceným klasifikátorem (rozdíl by způsobil, že MCP-výstup a UI-výstup se rozejdou). Po změně spustit `test_mcp_compatibility.py` a shodu ověřit (mapování na rodinu, ne na doslovný literál — viz historická konvergenční poznámka v root CLAUDE.md v4.34).

---

## 5. Decisions & trade-offs

### 5.1 Decision 1: Jeden zdroj klasifikace (konsolidace)

Silnou logiku z Excel-extraktoru (marka + prefab + párování) povýšit do sdíleného klasifikátoru a obě cesty importu ji volají. **Trade-off:** jednorázová refaktorizace + riziko regrese v Excel-cestě → kryto golden testy na existujících projektech (SO-202, Žihle). **Alternativa zamítnuta:** nechat dva světy a jen «vylepšit» ten slabý — vede k trvalému rozjezdu.

### 5.2 Decision 2: Monolit = vypočitatelný beton, m³ degradováno na tie-break

Silné signály = marka betonu / betonový kód / betonové klíčové slovo, **a ne prefab**. Jednotka m³ sama o sobě NEklasifikuje (Alexanderovo pozorování: m³ je slabé). **Trade-off:** m³-řádek bez dalšího signálu spadne na «jiné» → uživatel ho případně povýší ručně. Lepší než falešná zeleň bez tlačítka «Vypočítat» (#1470).

### 5.3 Decision 3: Import z rozpočtu vykládá CELOU tabulku (necháváme)

Per #1454 — pro budoucí ne-betonové kalkulátory se nic neztrácí; jen líp klasifikujeme + skryjeme filtrem. **Trade-off:** víc řádků na obrazovce než u Excelu; kryto filtrem «Jen monolity» + tichým toggle. (Volitelný «jen beton» režim = open question §6 requirements.)

### 5.4 Decision 4: Sdílená párovací heuristika + katalog-varianty

Párování výztuž/bednění k betonu (název ≥2 významná slova | shoda prefixu kódu) povýšit do sdílené vrstvy a naučit 4 rozvržení (OTSKP vč-bednění, ÚRS vše-zvlášť + montáž/demontáž, vše-v-jednom, vše-zvlášť). Flags `formwork_included` / `rebar_included` řídí, zda kalkulátor sub-práci generuje nebo jen zobrazí jako «v ceně».

### 5.5 Decision 5: Kontrakt výstup → pozice

Pracnost sub-práce padá na odpovídající smetní pozici; doba prvku = kritická cesta harmonogramu (sekvenované fáze), ne součet. Odpovídá otázce Alexandra «učitývá se vázání v termínu?» — ANO, jako fáze grafu, ne dvojený součet. Engine to už umí (labor-projection / scheduler); tento spec jen zajistí, že mapování na pozice je explicitní a katalog-varianty (svinuté bednění) respektuje.

---

## 6. Failure modes

| Situace | Chování |
|---|---|
| Žádný signál (kód/marka/klíč. slovo chybí) | Nízká confidence, NE-monolit default, dostupný ruční toggle (nikdy tiše zahodit) |
| Konflikt signálů (marka + prefab) | Prefab vyhrává → NE-monolit |
| Neznámý katalog / mezinárodní | Fallback na marku + klíčová slova; kód se nevyhodnocuje jako CZ-prefix |
| Nelze spárovat výztuž/bednění k betonu | Zůstane jako samostatný ne-monolit / «jiné» (nepřilepí se násilím) |
| ÚRS bednění bez páru demontáž | Montáž se přijme sama, demontáž se dopáruje pokud existuje; jinak jen montáž |

---

## 7. Security & privacy

Bez nových dat, bez nových endpointů, bez cross-tenant povrchu. Klasifikace je čistá funkce nad řádky. Beze změny izolace.

---

## 8. Performance & scaling

Deterministické, běží klientsky / v parseru nad řádky smety (jednotky až tisíce řádků). Regex marky + tabulka prefixů = O(n) přes řádky, zanedbatelné. Žádné síťové volání.

---

## 9. Testing strategy

- **Golden testy per katalog:** OTSKP (beton-vč-bednění + výztuž zvlášť), ÚRS (vše zvlášť + montáž/demontáž), vše-v-jednom, vše-zvlášť — na reálných řádcích ze `test-data/`.
- **Parita test** obou cest importu na témž řádku (Krit. 4).
- **Prefab / kamenivo / m³-sám** negativní testy (Krit. 2, 3).
- **Override** perzistence (Krit. 7).
- **MCP compat** (`test_mcp_compatibility.py`) po změně klasifikátoru.
- **Regres** #1470 (add-work gate, monolit=vypočitatelný) nesmí spadnout.

---

## 10. Rollout plan

Postupně, per Stage (viz `tasks.md`). Každý Stage = samostatný PR se zeleným CI, žádný big-bang. Frontend (Vercel) a backend (Cloud Run europe-west3) se deployují nezávisle; sdílený balík se buildí do obou.

---

## 11. Open design questions

- [ ] Kam přesně umístit sjednocený klasifikátor (rozšířit existující sdílený modul vs nový soubor ve stejném balíku) — rozhodne Claude Code dle konvencí repo v Gate 0, ne předepisovat.
- [ ] Reprezentace «bednění montáž/demontáž» jako dvě sub-role vs jedna sub-role s fází — rozhodnout v Gate 1.
- [ ] Mezinárodní marky: kolik norem hned (Stage 5) — minimálně EN 206, US, DIN jako pluggable vzory.

---

## 12. References

- `requirements.md` (tento spec)
- `docs/steering/domain.md §1`, `docs/steering/conventions.md §10`
- Existující kód (Gate 0): Excel-extraktor betonu (marka/prefab/párování), sdílený monolith-klasifikátor, frontend flat-tabulka seskupení, import-z-rozpočtu seam, MCP classify tool
- Golden: `test-data/tz/SO-202*`, `test-data/most-2062-1-zihle/`

---

## 13. Versioning

| Date | Version | Changes |
|---|---|---|
| 2026-07-10 | 0.1 | Draft z deep-debug session |
