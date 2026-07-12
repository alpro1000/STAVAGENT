# Složený prvek z částí (opěra/pilíř) — Design

> **Spec ID:** `composite-element-parts`
> **Datum:** 2026-06-23
> **Status:** draft
> **Owner:** Alexander Prokopov / Claude Code session
> **Prerequisites:** `requirements.md` approved

---

## 1. Přehled řešení

Složený prvek (opěra) se modeluje jako **dvouúrovňová hierarchie**: rodičovská položka (opěra = jeden smětní řádek) **nad** seznamem částí (dřík, úložný práh, závěrná zídka, křídla), kde každá část je běžný jednoprvkový vstup s vlastním bedněním, takty a geometrií. **Domov hierarchie = stávající tabulka pozic projektu** (varianta „b"), protože ta už je „seznam řádků, který se sčítá" — nestavíme druhý takový seznam (kánon: bez parallel structures). Výpočet jede přes **stávající jednoprvkovou cestu po jedné části** + **stávající projektový agregátor** sečte části do rodiče. Když chybí rozměry částí, objem se rozdělí podle **typových podílů z dat** s viditelným ODHAD a provenance. Stejná výpočetní cesta slouží frontendu i MCP — liší se jen úplnost vstupu, ne tvar.

---

## 2. Architectural fit

### 2.1 Které služby jsou dotčené

| Služba | Role v tomto designu |
|---|---|
| **Monolit-Planner** | Hlavní. Tabulka pozic dostává úroveň „část" nad druhy práce; kalkulátor počítá jednu část a vkládá pod rodiče; sdílená výpočetní/agregační vrstva dostává „rozklad složeného prvku na části" + „uzavření objemu na 100 %". |
| **concrete-agent** | MCP wrapper výpočtu betonáže forwarduje **seznam částí** do téže výpočetní cesty (žádná vlastní logika rozkladu). |
| stavagent-portal | Beze změny (přebírá svinutou položku jako dnes). |
| URS_MATCHER_SERVICE | Beze změny. |
| rozpocet-registry | Beze změny. |

### 2.2 Vztah ke stávajícím subsystémům

- **Projektový agregátor** (Fáze 5, sčítá více prvků do projektového součtu, one-element parita) — **přebírá se beze změny** jako sčítač částí do rodiče.
- **Jednoprvkový výpočet** — **netknutý**; část = jeden běžný vstup.
- **Tabulka pozic projektu** — dnes seskupuje řádky podle **druhu práce** (betonáž / bednění / zrání / odbednění). Přidává se úroveň **„část"** mezi položkou a druhy práce. *(Kapacita rollupu = Phase A recon.)*
- **Odpojený příznak „křídla"** + **tři mechanismy množnosti** (kopie téhož ⊥ dilatační úseky ⊥ ruční záběry) — **mizí**, nahrazeny seznamem částí (přítomnost křídel = existence řádku části „křídla"; takty = na každé části).

### 2.3 Tier strategy (determinismus / LLM)

- **Deterministický layer:** veškerý rozklad i sčítání. Typové podíly = data; přesné rozměry bijí podíl; uzavření na 100 % je aritmetika. **LLM se výpočtu částí NEúčastní.**
- **LLM fallback:** žádný v tomto designu. (Návrh složení z TZ-textu zůstává na stávajícím extraktoru/poradci — mimo tuto spec.)
- **Confidence scoring:** per část `původ rozdělení` ∈ {ruční/přesné, odhad z typového podílu}; přesné > data > odhad (ladder z `domain.md`).

---

## 3. Data flow

```
Vstup (rodič + seznam částí: typ + [rozměry | nic]; + celkový objem)
  → ROZKLAD: doplnit chybějící části z typových podílů,
             uzavřít součet na celkový objem (celek − přesné = zbytek mezi odhady),
             označit ODHAD + provenance per část
  → VÝPOČET po částech (stávající jednoprvková cesta, beze změny)
  → AGREGACE (stávající projektový agregátor) → rodičovský součet
  → Tabulka pozic (rodič + řádky částí) ; KPI projektu počítá rodiče jednou
  → EXPORT: rodič se svine do jedné smětní položky
```

### 3.1 Klíčové datové struktury (koncepčně, bez jmen)

- **Složený vstup:** identita rodiče (smětní kód/název) + seznam částí + volitelně celkový objem pro rozkladový fallback.
- **Část:** typ prvku + buď přesné rozměry/objem, **nebo** prázdno (objem se dopočte z podílu) + nesený **původ rozdělení** + **odhad-příznak**.
- **Rodičovský výstup:** svinutý součet + dostupný rozpad po částech (jako agregátorův seznam prvků + souhrn).

### 3.2 Persistence

- Části žijí jako **řádky pod rodičem** v tabulce pozic; u každé části se ukládá **původ rozdělení** (ruční/odhad) a **odhad-příznak**.
- **Migrace:** pouze pokud tabulka pozic neunese úroveň „část" nad druhy práce (rozhodne Phase A recon). Pokud ano → samostatný reverzibilní migrační gate; pokud stačí stávající seskupení → bez migrace.
- **Cache:** beze změny.

---

## 4. API contracts

> High-level. Bez jmen cest.

### 4.1 Nové endpointy
- Žádné nové. Reuse **stávající společné výpočetní cesty** (sdílí ji frontend i MCP).

### 4.2 Změny existujících endpointů
- Společná výpočetní cesta se učí přijmout **seznam částí** vedle jednoprvkového vstupu. **Zpětná kompatibilita povinná:** jednoprvkový vstup musí dál vracet dnešní výsledek (AC 3.10).

### 4.3 MCP wrapper
- MCP nástroj výpočtu betonáže (delegovaný na stávající výpočetní cestu) přidá možnost poslat **seznam částí** a forwardovat ho beze změny logiky. **MCP compatibility check povinný** (`tests/test_mcp_compatibility.py`).

---

## 5. Decisions & trade-offs

### 5.1 Domov seznamu částí = tabulka pozic (varianta „b")
- **Volba:** části jako řádky pod rodičem v tabulce pozic; úroveň „část" nad druhy práce.
- **Alternativy:** (a) nový seznam uvnitř kalkulátoru.
- **Důvod:** tabulka pozic už **je** „seznam, který se sčítá"; existující šev kalkulátor→pozice se přebírá; **kánon zakazuje druhou paralelní strukturu**.
- **Trade-off:** tabulka se musí naučit úroveň „část" + rollup přes ni (a možná zásah do KPI — viz open).

### 5.2 Chybějící rozměry → typové podíly z dat (ne z hlavy)
- **Volba:** rozdělit objem podle podílů pocházejících z reálných projektů; ODHAD badge; provenance; **přesné bije odhad**; smíšený součet se uzavírá na 100 %.
- **Alternativy:** ptát se uživatele na rozdělení pokaždé; nebo skrytě hádat 4 části.
- **Důvod:** poctivý default + ochrana proti tichému vranju ve smětě (stejná třída jako DWG/Monte-Carlo/katalog-čísla).
- **Trade-off:** vyžaduje **kalibraci podílů z dat**; bez dat raději méně částí.
- **Pozn.:** mechanismus rozkladu se staví s **placeholder-podíly**; reálná kalibrace (VP4/SO-250/Žihle) je **data-swap — NEblokuje** Gate 2–5.

### 5.3 Jedna výpočetní cesta pro MCP i frontend
- **Volba:** složený výpočet žije ve sdílené vrstvě za společnou cestou; obě plochy posílají části tamtéž.
- **Alternativy:** MCP počítá části sám.
- **Důvod:** **parita konstrukcí** — plochy se liší jen úplností, ne tvarem; MCP už výpočet na tu cestu deleguje.
- **Trade-off:** sdílená cesta musí znát tvar „seznam částí".

### 5.4 Inkrementální rollout — MCP-po-částech PŘED frontend-seznamem
- **Volba:** nejdřív sdílená vrstva + MCP forwarduje části (frontend zatím posílá jednu část = dnešek); pak dvouúrovňový seznam ve frontendu.
- **Alternativy:** velký bang naráz.
- **Důvod:** **odrizikování „velkého gateu"**; parita drží na každém kroku.
- **Trade-off:** frontend dočasně jednoprvkový.

### 5.5 Rodič = čistý kontejner (práce na listech), NE KPI-surgery — **NOSNÉ rozhodnutí**

- **Volba:** složená opěra je v tabulce **čistý rodič-kontejner bez vlastních work-řádků**; veškerá práce (betonáž/bednění/výztuž/…) žije na **listech (částech)**. Rodičovský součet = Σ listů (display roll-up).
- **Alternativy:** rodič drží vlastní work-řádky + naučit flat-rollup přeskakovat rodiče-s-dětmi.
- **Důvod:** KPI/rollup (`summarizeScheduleProjections`/`calculateHeaderKPI`; `planProject`) sčítá **ploše přes listové řádky** (beton jen z `subtype='beton'`, peníze ze všech, dny z projekcí). Když rodič nemá vlastní work-řádky a přispívá **0**, **double-count je vyloučen konstrukcí a KPI-panel se nemusí měnit**. Totéž nese **export-svinutí** (rodič = jedna smětní položka = Σ listů). Na tomto rozhodnutí závisí **rollup i export** — proto je nosné, ne implementační detail.
- **Trade-off:** „část" je nová grouping úroveň v tabulce (Gate 4) mezi `part_name` a `subtype`; dnešní jedno-opěra (jeden `part_name` s work-řádky) se převede na rodič+části (work-řádky se přesunou na části, rodič ztrácí vlastní beton-řádek).
- **Ratifikováno:** Alexander 2026-06-23 (Gate 0, recon `2026-06-23_composite-parts-recon.md`).

> **Gate 1 = design-of-record:** sekce §5 (Decisions) + §11 (resolved) + recon-dok JSOU ratifikovaný design. Samostatný `ADR-NNN` se **NEzakládá** (duplikát = parallel structure, kánon proti). Gate 1 je tím uzavřen uvnitř `design.md`, bez separátního kroku.

### 5.6 Strukturní část = `metadata.structural_part` (Gate 4, BEZ migrace)

- **Volba:** příslušnost řádku pozice ke strukturní části (dřík / úložný práh / závěrná zídka / křídla) se kóduje aditivním klíčem `structural_part` v existujícím flexibilním `Position.metadata` (JSON string). `part_name` zůstává = opěra (jedna smětní položka).
- **Alternativy:** (a) nové DB pole + migrace; (b) konvence v `part_name` (stringly-typed).
- **Důvod:** `metadata` už backend přijímá/vrací (`POST /api/positions`), `applyPlanToPositions` ho už zapisuje; aditivní klíč → **žádná migrace** (Gate 0: „M1 jen pokud perzistence neunese" → unese). Precedent: registry `classificationCodec` přebral `sync_metadata`. Export svine po `part_name` zdarma (opěra = jedna položka); KPI rollup beze změny (flat přes řádky); part-úroveň je jen **display** (shared `groupByStructuralPart`, helper `readStructuralPart` — malformed → null). Untagged řádky → flat jako dnes (back-compat).
- **Trade-off:** méně first-class než sloupec; čte se přes JSON-parse.
- **Ratifikováno:** Alexander 2026-06-26 (po Gate 4 reconu) — „pro čistotu a správnost".

> **Gate 5 vstup (ratifikováno „po doporučení", revisit na Gate 5 pre-impl interview):** části se v kalkulátoru zadávají **ručním seznamem „přidat část"** (typ + opc. objem) — univerzální, bez nové data-závislosti, mirror principu „engine = generic aggregator". yaml-šablona opěry = pozdější convenience (pre-fill), NE blokuje Gate 5.

### 5.7 Pilíř = druhý composite-typ (aditivní, engine netknutý) — ratifikováno 2026-07-12

Mechanismus `planComposite` je **plně generický** (rodič + `parts[]`, žádná znalost „opěry"). Pilíř se přidává jako **druhá šablona**, čistě aditivně, bez zásahu do sdílené výpočetní vrstvy. Interview 2026-07-12 (Gate 0 recon → AskUserQuestion):

- **Složení šablony pilíře = 2 části: dřík (`driky_piliru`) + hlavice (`rigel`).** Základ (`zaklady_piliru`) je **samostatná smětní položka**, NE část composite-prvku — symetricky s opěrou, jejíž šablona také vynechává základ (interview §0: „základ = samostatná položka"). Podložiskový blok pod ložiska taktéž mimo šablonu (samostatná položka).
- **Typové podíly = placeholder, nesené EXPLICITNÍM `volume_ratio` v šabloně** (ne přes sdílenou `PLACEHOLDER_PART_VOLUME_RATIOS` mapu). Důvod: `driky_piliru` je **sdílený** mezi opěrou (dřík) a pilířem (tělo) — kdyby pilíř bral podíl z mapy, jeho relativní váha by se svázala s opěrovým `driky_piliru: 0.45` a budoucí kalibrace jednoho by tiše hnula druhým. Explicitní `volume_ratio` v šabloně (pole `CompositePartInput.volume_ratio` už existuje, `planComposite.ratioFor` ho preferuje) **dekopluje** obě šablony. Placeholder: dřík ~0.75 / hlavice ~0.25 (dominantní vysoký dřík) — kalibrace VP4/SO-250/Žihle = data-swap follow-up, NEblokuje.
- **Výběr šablony „po typu rodiče":** nabízená šablona i panel se řídí `element_type` rodiče (aktuální formulář) — `opery_ulozne_prahy` → šablona opěry (4 části), `driky_piliru` → šablona pilíře (2 části). Copy panelu **zneutralizována** z „opěra"-specifické na „složený prvek" (Σ prvek, „pod prvkem", „Rozložte prvek"). Panel se auto-otevře pro obě rodičovské rodiny; jednou existující seznam částí ho drží otevřený (dnešní gate `compositeActive`).
- **Domov šablony = frontend const** (`compositeParts.ts`, mirror `ABUTMENT_PART_TEMPLATE`), NE `element_rules` yaml. ⚠️ **Poznámka k §5.6/§11:** ratifikovaná věta „single-source sady částí = aditivní blok v element_rules yaml + gen pipeline" se ve Fázi 2 **nakonec neimplementovala** — opěrová šablona shippla jako frontend const. Pilíř drží **konzistenci se shipnutou realitou** (const vedle opěry), ne s aspirační poznámkou; yaml-single-source zůstává otevřený follow-up pro OBĚ šablony, pokud přibude třetí konzument (MCP composite šablony).
- **Engine/parita:** `composite-planner.ts`, `planProject`, `PlannerInput` **netknuté** → všechny goldeny byte-identické; opěrová šablona beze změny chování (nové pole `volume_ratio` je optional, opěrové části ho nenesou → mapa-cesta jako dnes).

---

## 6. Failure modes

| Komponenta | Failure | Behavior | Recovery |
|---|---|---|---|
| Rodič | Chybí i celkový objem | **Honest-blank** — nepočítat, označit „nelze" | Doplnit objem |
| Rozklad | Σ zadaných částí ≠ celkový objem | **Viditelné varování**, neopravovat potichu | Uživatel srovná |
| Část | Neznámý typ / engine ji neumí | **Honest-blank na té části**, ostatní jedou, rodič dílčí | Označit nepočítané |
| Rollup tabulky | Neunese úroveň „část" | (recon-dependent) samostatný gate na KPI/rollup | Phase A rozhodne |
| Typové podíly | Sada dat chybí | **Méně částí / fallback „nedetailizováno"** — nevymýšlet procenta | Kalibrace dat |

---

## 7. Security & privacy

- **Auth/Authorization:** beze změny; ale data jsou **owned** (pozice projektu) → **cross-user isolation** se nesmí porušit přidáním úrovně „část". Review per `docs/security/isolation_model.md` (sub-agent `cross-user-isolation-reviewer`) u všech dotčených cest čtoucích/píšících pozice.
- **PII/GDPR:** žádné nové PII.
- **Audit trail:** původ rozdělení (ruční/odhad) + odhad-příznak per část = auditní stopa.

---

## 8. Performance & scaling

- **Load:** N částí na položku (typicky 2–4) = N jednoprvkových výpočtů + agregace; zanedbatelné.
- **Latency:** lineární v počtu částí; bez nového LLM volání.
- **Cost:** žádný LLM delta.
- **Cold start:** beze změny.

---

## 9. Testing strategy

- **Unit:** rozklad (přesné/odhad/smíšený, uzavření na 100 %, provenance, ODHAD-příznak); fallback „části nejsou".
- **Integration:** sdílená cesta přijme seznam částí; frontend i MCP přes ni dostanou shodný tvar.
- **Golden tests:** stávající KV/Žalmanov/normy **drží beze změny** (one-element parita); **nové goldeny** — opěra full (části s rozměry), partial-split (dřík přesný + křídla odhad, uzavření na 100 %), no-parts fallback, export-svinutí do jednoho řádku.
- **MCP compatibility check: Yes** — composite mění **výpočetní cestu wrapped MCP toolem** → `tests/test_mcp_compatibility.py` musí projít; nový golden přidat do **explicitního allow-listu** workflow (jinak v CI neběží — lekce kánonu).

---

## 10. Rollout plan

- [ ] Feature flag pro dvouúrovňový vstup (umožní vypnout, rollback bez revertu).
- [ ] **Invariant: žádný tichý polo-stav** — MCP-Fáze 1 jde za feature-flagem; **složený vstup se NEdostane do prod-výdeje, dokud frontend-Fáze 2 není hotová** (AC 3.11).
- [ ] Fáze 1: sdílená vrstva + MCP-po-částech (frontend beze změny).
- [ ] Fáze 2: dvouúrovňový seznam ve frontendu + odchod příznaku křídla + sjednocení množnosti.
- [ ] **Živá kontrola na kalkulator.stavagent.cz po deploy** — netvrdit hotové bez prohlídky na webu (kánon).
- [ ] Sign-off do soul.md §9.

---

## 11. Open design questions

- [x] ~~Rollup tabulky / dvojí započtení~~ — **VYŘEŠENO + ratifikováno:** rodič = čistý kontejner, práce na listech ⇒ flat-sum sčítá listy, rodič 0, double-count vyloučen, **BEZ KPI-surgery**; „část" = grouping v tabulce (Gate 4). (recon 2026-06-23)
- [x] ~~Single-source sady částí~~ — **VYŘEŠENO + ratifikováno:** aditivní blok v `element_rules` yaml + gen pipeline (drift-guard), žádná parallel structure.
- [x] ~~Zdroj typových podílů~~ — **ROZHODNUTO: odložit** (placeholder; kalibrace = data-swap, neblokuje Gate 2–5).
- [x] ~~Fallback „části nejsou"~~ — **ROZHODNUTO: (a)** „nedetailizováno" default (Alexander 2026-06-23).
- [x] ~~Úložný práh samostatná část?~~ — **ROZHODNUTO: samostatná část** (často vlastní takt) (Alexander 2026-06-23).

---

## 12. References

- Requirements: `docs/specs/composite-element-parts/requirements.md`
- Steering: `tech.md` (tier), `domain.md` §1 (calculator philosophy, ODHAD), `conventions.md` (no parallel structures)
- Recon: `docs/audits/calculator_field_map/2026-06-13_recon.md`
- Kánon: `docs/handoff/STAVAGENT_CANON_Phase5.md §3`

---

## 13. Versioning

| Date | Version | Changes |
|---|---|---|
| 2026-06-23 | 0.1 | Initial design — varianta „b" + ODHAD ochrany + inkrementální rollout |
| 2026-07-12 | 0.2 | §5.7 přidán — pilíř jako druhý composite-typ (2 části dřík+hlavice, základ samostatně, explicitní `volume_ratio` v šabloně dekopluje sdílený `driky_piliru`, výběr šablony po typu rodiče). Engine netknutý, aditivní. |
