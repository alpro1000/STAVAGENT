# Universal Work Decomposer (UWO) — Design

> **Spec ID:** `universal-work-decomposer`
> **Datum:** 2026-06-08
> **Status:** review
> **Owner:** Alexander Prokopov / Claude Code session (stoic-cerf)
> **Prerequisites:** `requirements.md` (review)
>
> **⚠️ Design-first. ŽÁDNÝ KÓD v tomto úkolu.** Tento dokument je návrh + fázovaný plán na review. Implementace = samostatné úkoly po schválení. **🛑 STOP po Phase C.** Větev SO202 Ingest se nedotýká.

---

## 0. Recon (Phase A) — karta současného stavu

> Read-only mapa, na které design staví. Faktické kotvy (file:concept), ne implementační detail.

### 0.1 Monolitní dekompozer — `concrete-agent/.../app/mcp/tools/breakdown.py`

- `create_work_breakdown(elements, project_type, catalog, mode)` **už nese Pattern 15 kontrakt**: `MODE_WORK_FIRST` (default, codeless, frozen work list) vs `MODE_WORK_WITH_CATALOG` (legacy, kódy inline). Binding je „separate stage behind STOP gate" (komentář v souboru).
- Work-atomy = **hardcoded** `WORK_TEMPLATES` dict, klíč = `element_type`. DEFAULT šablona: `Bednění / Odbednění / Výztuž B500B / Beton {třída} / Ošetřování betonu`. Spec šablony: `pilota` (bez bednění), `mostovkova_deska` (+ předpětí Y1860), `rimsa` (římsový vozík).
- Každý item: `work_description`, `unit`, `quantity`, `hsv_section` (HSV2/3/4), `element_type`, `_source` (grounding gate, Pattern 29). `qty ≤ 0` → silently dropped.
- Out-of-scope (`zdivo_obklad`, `izolacni_stena`, `sachta`, `tunel_rampa`) → **honest typed error** (`unsupported_element_type`), nikdy silent estimate.
- **Mezera:** žádná ne-betonná větev. Pro interiér/PSV by `breakdown.py` buď klasifikoval na `jine`/`other`, nebo (po průchodu klasifikátorem) vrátil monolitní DEFAULT šablonu na cokoliv — „sebevědomě-špatně".

### 0.2 Klasifikátor — `app/mcp/tools/classifier.py` + `Monolit-Planner/.../element-classifier.ts`

- 24 betonových typů (13 most + 11 pozemní), 3 konstrukční kontexty `bridge|retaining_wall|building`. Single-source `element_rules/element_types.yaml` → TS přes `gen-knowledge.mjs` (drift-guarded `gen:knowledge:check`).
- Reject path = **jen materiálový**: `masonry_cladding`, `shotcrete`, `insulation_layer`, `joint_grouting`, `road_surface` → `is_concrete_element=false` + `reject_reason`.
- Confidence/signal ladder: `1.0` OTSKP kód (pinned) · `≤0.9` keyword · `≤0.7` ambiguous + `candidates[]` · `0.3` fallback `other`. (Externí konvence: ÚRS 0.80, Perplexity 0.85, AI 0.70.)
- **Mezera:** žádný scope/discipline router. Klasifikátor je čistý structural-concrete typer; nezná interiér/PSV/elektro/ZTI.

### 0.3 Catalog-binding — `find_otskp_code` (`otskp.py`) + `find_urs_code` (`urs.py`)

- OTSKP: confidence vždy `1.0` (DB hit) nebo prázdný výsledek. URS: `0.80` (Perplexity) / `0.50+` (URS Matcher Service HTTP). URS umí i `code:"N/A"` raw-context.
- **Žádný unifikovaný status-enum** `exact|candidate|group_only|not_verified`. Existuje jen neformální `match: "exact"|"partial"|"none"` v `position_enricher.py` (string literály) a `CodeSystem` enum (`otskp|urs|rts|unknown`) v `item_schemas.py`.
- **Procurement-routing DATA UŽ EXISTUJÍ, ale nepřipojeny:** KB integrace `urs-otskp-routing` (`kb/urs_otskp_routing.yaml` → generovaný TS `getCatalogPriority()`) má větve `verejna / privatni / design_build` s `catalog_priority`. Tools je ignorují. → **reuse-bod, ne návrh od nuly.**

### 0.4 KB B-buckets — `app/knowledge_base/`

- 13–17 bucketů. `B5_tech_cards/technological_postupy/` už má stub `zemni_prace_bourani/` (METADATA + source_pointer) — **přirozený dům pro ne-betonné šablony**.
- `B10_coverage_matrices` už má D.1.4 matrice (`mep_d14_silnoproud/slaboproud/vzt/zti/ut/mar/plyn`). `B11_reconciliation_rules` (bridge/industrial/residential/road) rozšiřitelné per trade.
- `gen-knowledge.mjs`: 6 integrací (YAML→TS, validate→render→write, drift-check). Rozšiřitelné přidáním `{name, yaml, validate, render}` do `INTEGRATIONS`.

---

## 1. Přehled řešení

Zavádíme **Universal Work Ontology (UWO)**: třívrstvý deterministický pipeline, kde monolit je **jedna registrovaná větev** šablon a vazba na katalog je **samostatný post-krok**.

```
scope/název → [1] Scope-Router → section_code → [2] Branch Decomposer (registr větví) → work-atomy
                                                                                            ↓
                                                              [3] Catalog-Binding Adapter (post-krok, status+confidence)
```

- **[1] Scope-Router** (nový, upstream): rozhodne `section_code` (`monolit` | `interier_psv` | později `elektro`/`vzt`/`zti`/…). Element-classifier zůstává čistý — router ho volá jen pro `section_code=monolit`.
- **[2] Branch Decomposer**: registr větví; každá větev = sada deterministických work-atom šablon klíčovaných na section-specific slovník. Monolitní `WORK_TEMPLATES` = první registrovaná větev (beze změny chování). Interiér/PSV = druhá větev.
- **[3] Catalog-Binding Adapter** (nový, post-krok): work-atom → katalogový kandidát se statusem `exact|candidate|group_only|not_verified` + confidence; katalog volí podle režimu zakázky (reuse `urs_otskp_routing.yaml`). Obaluje existující `find_otskp_code`/`find_urs_code` bez jejich přepisu.

Přidání sekce = přidání **(a)** scope-router pravidla, **(b)** větve šablon v KB, **(c)** section slovníku — **bez** dotyku jádra, adapteru a ostatních větví.

---

## 2. Architectural fit

### 2.1 Které služby jsou dotčené

| Služba | Role v tomto designu |
|---|---|
| concrete-agent | Hostí UWO: scope-router + branch-decomposer (rozšíření `breakdown.py` o registr větví) + catalog-binding adapter (nový modul obalující `otskp.py`/`urs.py`). KB šablony v `B5_tech_cards/technological_postupy/`. |
| Monolit-Planner | Beze změny chování. Sdílí `element_types.yaml` (single-source) a `urs_otskp_routing.yaml` (procurement priority) přes `gen-knowledge.mjs`. Monolitní výpočet zůstává SSOT engine. |
| URS_MATCHER_SERVICE | Beze změny — zůstává HTTP backend pro `find_urs_code` candidate matching. Adapter jen normalizuje jeho výstup do status-enumu. |
| stavagent-portal / rozpocet-registry | Mimo scope tohoto designu (konzumují výstup později). |

### 2.2 Vztah ke stávajícím subsystémům (single-source, no fork)

- **`breakdown.py` `WORK_TEMPLATES`** → reuse jako **větev `monolit`** v registru. Nezdvojovat; zaregistrovat.
- **`element_rules/element_types.yaml`** → reuse pro `monolit` větev. Section-router pravidla a ne-betonné slovníky žijí v **paralelní** struktuře (`dictionaries.<section>` nebo sibling YAML), ne jako fork betonové ontologie.
- **`urs_otskp_routing.yaml`** → reuse pro výběr katalogu v adapteru. Žádné nové procurement pravidlo.
- **`position_enricher` `match` strings + `CodeSystem` enum** → povýšit/sjednotit do jednoho status-enumu, **na jednom místě**, sdíleného adapterem i enricherem (uzavírá nekonzistenci).

### 2.3 Tier strategy (LLM / determinism)

Per `tech.md` (determinism-first). Confidence žebřík pro UWO:

| Vrstva | Zdroj | Confidence | Flag |
|---|---|---|---|
| Section-router exact | section slovník / regex match | 0.95 | — |
| Work-atom šablona | deterministická KB šablona větve | 0.90 | — |
| Qty derived | odvozeno ze scope (rozměr × norma) | 0.70–0.85 | `derived_from_scope` |
| Qty needs input | atom potřebuje množství mimo scope | — | `needs_input` (confidence se netýká) |
| Catalog exact | OTSKP DB hit | 1.0 | status `exact` |
| Catalog candidate | URS/Perplexity match | 0.80–0.85 | status `candidate` |
| Catalog group-only | jen skupina/kapitola | 0.50–0.70 | status `group_only` |
| **LLM fallback** | **jen neznámý scope** | **0.70** | **`llm_fallback=true`, vždy s flagem** |

**Pravidlo:** LLM se nepoužije jako univerzální dekompozer. Volá se **jen** když scope-router nenajde žádnou větev a uživatel explicitně chce návrh — a i pak výstup nese `confidence=0.70` + flag. Confidence se nikdy nepřepisuje nižší vyšší.

---

## 3. Data flow

```
mistrova_polozka ("renovace koupelny")
   │
   ▼
[1] Scope-Router  ──(section slovník: koupelna→interier_psv)──►  section_code = "interier_psv"
   │                                                              router_confidence
   │   (pokud section_code = "monolit" → volá existující element-classifier)
   ▼
[2] Branch Decomposer  ──(registr.lookup("interier_psv"))──►  šablona "renovace_koupelny"
   │                                                            → [demontáž ZP, demontáž obkladů,
   │                                                               HI stěrka, obklad, dlažba,
   │                                                               montáž ZP, (ZTI rozvody)]
   │   každý atom: {work, unit, quantity?, quantity_provenance, section_code, _source, confidence}
   ▼
[3] Catalog-Binding Adapter  ──(procurement=privatni → urs_otskp_routing → ÚRS primary)──►
        pro každý atom: find_urs_code(...) → normalize → {code?, status, confidence, catalog}
                                                          status ∈ {exact|candidate|group_only|not_verified}
   ▼
WorkBreakdownResult { items[], section_code, scope_guard_status, unresolved[] }
```

Scope bez větve:

```
mistrova_polozka ("dodávka a montáž fotovoltaiky")
   ▼
[1] Scope-Router → section_code = null (žádné pravidlo)
   ▼
SCOPE-GUARD → honest-blank: { items: [], scope_guard_status: "no_template_for_section",
                              message: "Nemám šablonu pro tuto sekci (PV/elektro).",
                              suggestion: "interier_psv|monolit dostupné; ostatní větve TODO" }
   (žádné monolitní atomy; LLM fallback jen pokud uživatel explicitně požádá → 0.70 + flag)
```

### 3.1 Klíčové datové struktury (koncept, jména nevnucena)

- **`WorkAtom`** — `work_description`, `unit`, `quantity?: number|null`, `quantity_provenance: 'needs_input'|'derived_from_scope'|'from_soupis'`, `section_code`, `hsv_section?`, `_source`, `confidence`, `catalog_binding?: CatalogBinding`.
- **`CatalogBinding`** (výstup adapteru) — `catalog: 'otskp'|'urs'|'rts'`, `code?: string|null`, `status: 'exact'|'candidate'|'group_only'|'not_verified'`, `confidence`, `candidates?: []`, `procurement_mode: 'privatni'|'verejna'|'design_build'`.
- **`ScopeRouteResult`** — `section_code: string|null`, `router_confidence`, `matched_rule?`, `llm_fallback?: boolean`.
- **`WorkBreakdownResult`** — `items: WorkAtom[]`, `section_code`, `scope_guard_status: 'ok'|'no_template_for_section'`, `unresolved: WorkAtom[]` (atomy s `needs_input` nebo `not_verified`).

### 3.2 Persistence

- Žádná nová DB tabulka v této fázi. Šablony větví = KB YAML (verzované v gitu), generované do TS přes `gen-knowledge.mjs` (drift-guarded) tam, kde je sdílí TS engine.
- Status-enum + provenance-enum = nové konstanty v `item_schemas.py` (sdílené adapterem i enricherem).

---

## 4. Větev interiér / PSV — konkrétně (kazuistika rekonstrukce)

> Deterministické šablony, klíčované na section slovník `interier_psv`. Každá mistrova položka → balík atomů. **Žádný catalog-first** — kódy řeší adapter (§5) až po dekompozici.

| Mistrova položka (scope) | Deterministické work-atomy | Qty provenance (typicky) |
|---|---|---|
| `renovace koupelny` | demontáž zařizovacích předmětů · demontáž stáv. obkladů/dlažby · příprava podkladu · hydroizolační stěrka · obklad stěn · dlažba podlahy · spárování · montáž ZP (vana/WC/umyvadlo/baterie) · příp. ZTI rozvody (voda/odpad) · silikonování | needs_input (m² obkladu/dlažby není ve scope) |
| `malba` | příprava/penetrace podkladu · malba (2 vrstvy) · zakrytí/úklid | derived_from_scope (m² stěn/stropů z geometrie) nebo needs_input |
| `štuk` | příprava podkladu · štuková omítka · přebroušení | needs_input (m²) |
| `SDK podhled` | rošt (CD/UD profily) · opláštění SDK · tmelení/bandáž · příp. izolace do dutiny | needs_input (m²) |
| `obklady/dlažba` | příprava podkladu · lepení obkladu/dlažby · spárování · ukončovací lišty | needs_input nebo from_soupis (m²) |
| `demontáže` | demontáž (dle předmětu) · odvoz/likvidace suti · příp. ekologická likvidace | derived_from_scope (ks/m²) |
| `vinyl/parkety` | příprava/vyrovnání podkladu (nivelace) · podložka · pokládka vinyl/parket · soklové lišty | needs_input (m²) |
| `ZTI rozvody` | rozvod studené/teplé vody · odpadní potrubí · izolace potrubí · tlaková zkouška | needs_input (bm) |

**Poznámky k větvi:**
- Vstupní slovník `interier_psv` mapuje klíčová slova (`koupelna`, `malba`, `štuk`, `SDK`, `podhled`, `obklad`, `dlažba`, `vinyl`, `parket`, `demontáž`, `vodoinstalace`…) na šablonové klíče.
- Šablony žijí v `B5_tech_cards/technological_postupy/interier_psv/<polozka>.yaml` (sibling stávajícího `zemni_prace_bourani/`).
- Atom může spustit pod-balík (`renovace koupelny` → `ZTI rozvody` jako vnořený set) — stejný princip jako mostní `opěry + křídla bundled`.

---

## 5. Catalog-binding adapter (post-krok)

> **Samostatný modul** (per interview), obaluje existující `find_otskp_code`/`find_urs_code` **bez přepisu**. Normalizuje jejich heterogenní výstup do jednoho **status-enumu** a vybírá katalog dle režimu zakázky.

### 5.1 Status-enum semantika

| Status | Kdy | Confidence (typ.) | Pravidlo |
|---|---|---|---|
| `exact` | OTSKP DB hit (přesný kód, jednotka sedí) | 1.0 | Jediný status, který smí prezentovat „oficiální kód". |
| `candidate` | URS/Perplexity/Matcher našel ≥1 kód, ale ne deterministicky | 0.80–0.85 | Vrací `candidates[]`; člověk vybere/potvrdí. |
| `group_only` | nalezena jen skupina/kapitola (prefix), ne konkrétní položka | 0.50–0.70 | Honest „jen kategorie", ne falešný item-kód. |
| `not_verified` | žádná shoda / jen raw kontext / licencovaný plný ÚRS nutný | 0.0–0.5 | **Nikdy** nevydat za nalezený kód; flag pro lidský binding. |

**Invariant:** adapter **nikdy** nevrátí `exact` mimo deterministický DB hit. URS `code:"N/A"` raw-context → `not_verified`. Tím se uzavírá současný stav, kde `find_urs_code` vrací confidence bez statusu a klient si může splést kandidáta s oficiálním kódem.

### 5.2 Výběr katalogu dle režimu zakázky (reuse `urs_otskp_routing.yaml`)

| Režim zakázky | Primary | Secondary | Zdroj pravidla |
|---|---|---|---|
| `privatni` (rekonstrukce bytu, HK212, Libuše) | ÚRS | — (OTSKP netřeba) | `urs_otskp_routing.yaml: privatni` |
| `verejna` | OTSKP | ÚRS (cross) | `urs_otskp_routing.yaml: verejna` |
| `design_build` | OTSKP + ÚRS (obě kolony) | RTS | `urs_otskp_routing.yaml: design_build` |

Adapter čte prioritu z generovaného `getCatalogPriority(mode)` — **nezavádí nové procurement pravidlo**.

### 5.3 MCP wrapper

- Nový adapter je **interní** (volá existující MCP tools), ne nový top-level MCP tool v této fázi. Pokud se později vystaví jako tool, musí synchronizovat všechny countery (`_REGISTERED_TOOL_NAMES`, `TOOL_ORDER`, `TOOL_DESCRIPTIONS`, `TOOL_COSTS`, `ToolManifest`, `EXPECTED_TOOLS`) — per `concrete-agent/CLAUDE.md` authoring rules.
- `find_otskp_code`/`find_urs_code` kontrakty **nezměněny** → MCP compatibility zachována (adapter čte jejich výstup, nepřepisuje signatury).

---

## 6. Decisions & trade-offs

### 6.1 Decision 1: Samostatný scope-router upstream (ne rozšíření klasifikátoru)

- **Volba:** nový router PŘED element-classifierem: `scope → section_code`, pak gate.
- **Alternativy:** přidat scope-dimenzi do `element_types.yaml` + klasifikátoru.
- **Důvod:** element-classifier je čistý structural-concrete typer s W3-parity golden testy; přimíchání scope-routingu by rozbilo jeho single-responsibility a parity contract. Router je orthogonální.
- **Trade-off:** jedna vrstva navíc; ale větve se přidávají bez dotyku klasifikátoru.

### 6.2 Decision 2: Catalog-binding jako samostatný adapter (ne enum do tools)

- **Volba:** nový adapter obaluje `find_otskp_code`/`find_urs_code`.
- **Alternativy:** vestavět status-enum + procurement routing přímo do tools.
- **Důvod:** zachová kontrakty existujících MCP tools (žádný risk pro ChatGPT/Claude.ai klienty), single-source procurement pravidlo reuse, status-normalizace na jednom místě.
- **Trade-off:** dvojí hop (tool → adapter); zanedbatelné vs. stabilita kontraktu.

### 6.3 Decision 3: Quantity provenance-enum (ne nullable+flag)

- **Volba:** `quantity_provenance: needs_input | derived_from_scope | from_soupis` + confidence.
- **Alternativy:** `quantity?: number|null` + `requires_input: bool`.
- **Důvod:** rozlišuje „odvozeno z geometrie" vs „z výměr/soupisu" vs „nutno zadat" — zrcadlí existující `_source`/confidence pattern; čestné vůči uživateli (ví, čemu věřit).
- **Trade-off:** pole navíc na atomu; ale honest-by-construction.

### 6.4 Decision 4: Monolit = registrovaná větev (reuse `WORK_TEMPLATES`)

- **Volba:** existující `WORK_TEMPLATES` zaregistrovat jako větev `monolit`, beze změny chování.
- **Alternativy:** přepsat dekompozer na generický engine.
- **Důvod:** Pattern „přidání sekce = přidání větve, ne přearchitektura"; nulový regres na monolitu.
- **Trade-off:** registr-indirekce; ale monolitní cesta zůstává bit-identická.

---

## 7. Failure modes

| Komponenta | Failure | Behavior | Recovery |
|---|---|---|---|
| Scope-Router | žádné pravidlo pro scope | `scope_guard_status="no_template_for_section"`, honest-blank, **žádné monolitní atomy** | Nabídnout dostupné větve; LLM fallback jen na explicitní žádost (0.70 + flag) |
| Branch Decomposer | šablona existuje, ale atom nemá množství | atom s `quantity=null` + `quantity_provenance="needs_input"`, item NEzahozen (na rozdíl od dnešního `qty≤0` drop) | Surface v `unresolved[]` pro doplnění |
| Catalog Adapter | `find_otskp`/`find_urs` timeout/5xx | atom dostane `status="not_verified"` + důvod; dekompozice (work-first) **přežije** | Retry per existující tool semantika; binding lze spustit znovu (separate stage) |
| Catalog Adapter | URS vrátí `code:"N/A"` | normalizace → `not_verified`, **ne** `candidate` | Lidský binding flag |
| LLM fallback | provider down | žádný silent estimate; vrátí honest-blank + „nelze navrhnout" | Uživatel doplní ručně |

---

## 8. Security & privacy

- **Auth/authorization:** beze změny — UWO běží uvnitř concrete-agent za stávajícím MCP auth (API key / OAuth). Cross-user isolation se netýká (stateless dekompozice).
- **PII/GDPR:** scope popisy mohou nést adresy/jména projektů → logovat jen `section_code` + counts, ne raw scope text v auditních lozích.
- **Audit trail:** každý atom nese `_source` (grounding gate, Pattern 29) + `confidence` + `quantity_provenance`; každý binding nese `status` + `procurement_mode` → plná stopa „odkud co".

---

## 9. Testing strategy

- **Unit:** scope-router (scope → section_code, vč. `null` guard); branch-decomposer (interiér šablony → očekávané atomy); adapter status-normalizace (`exact|candidate|group_only|not_verified` z různých tool výstupů); provenance-enum.
- **Golden tests:** `renovace koupelny` → očekávaný balík atomů; `malba`/`SDK`/`vinyl` → atomy; neznámý scope (PV) → honest-blank; monolit regrese (stávající `WORK_TEMPLATES` výstup bit-identický).
- **MCP compatibility check: Yes** — adapter čte `find_otskp_code`/`find_urs_code`; ověřit `tests/test_mcp_compatibility.py`, že jejich kontrakty zůstaly nezměněné. Pokud se status-enum později vystaví jako tool, sync všech counterů + `EXPECTED_TOOLS`.
- **Integration:** branch-decomposer → adapter edge (work-first → catalog-last sekvence, STOP gate mezi nimi).

---

## 10. Fázovaný plán implementace (samostatné úkoly po schválení)

> Každá fáze = samostatně dodatelný inkrement. **Žádná fáze nemění monolitní chování.** Pořadí drží Work-First → Catalog-Last.

| Fáze | Inkrement | Dodává | Co poputně uzavírá |
|---|---|---|---|
| **F0** | Registr větví + monolit jako větev | `WORK_TEMPLATES` zaregistrován jako `monolit`; registr-indirekce; nula regrese | Základ pro N větví bez přearchitektury |
| **F1** | **Scope-Router + scope-guard** | `scope → section_code` (`monolit`/`interier_psv`/null); honest-blank na null; section slovník `interier_psv` | Lék na „sebevědomě-špatně" (monolit už nedostane interiér) |
| **F2** | **Větev interiér/PSV** (první implementovaná) | deterministické šablony pro koupelnu/malbu/štuk/SDK/obklady/demontáže/vinyl/ZTI v `technological_postupy/interier_psv/`; provenance-enum | První ne-monolitní use-case (rekonstrukce bytu) |
| **F3** | **Catalog-Binding Adapter** | status-enum (`exact|candidate|group_only|not_verified`) + reuse `urs_otskp_routing.yaml` pro výběr katalogu; normalizace `find_otskp`/`find_urs` | **Uzavírá zlepšení ÚRS-hledání** (status-enum) + sjednocuje `position_enricher` match strings |
| **F4+** | Další větve šablon | elektro/VZT/ZTI/ÚT/MaR/statika — každá = (router pravidlo + KB větev + slovník), 1 PR/větev | Univerzalita po profesích (`conventions.md §10`); B10/B11 matrice už staged |

**Závislosti:** F1 a F2 jdou po F0. F3 nezávislé na F2 (lze paralelně, ale demo-hodnota až s F2). F4+ čeká na review F1–F3.

**Co poputně zlepší ÚRS-hledání (status-enum):** F3 zavádí `exact|candidate|group_only|not_verified` — přesně to, co dnes `find_urs_code` postrádá (vrací confidence bez statusu). Tím se naplní dlouho otevřené zlepšení ÚRS bindingu „at no extra cost".

---

## 11. Open design questions

- [ ] Potvrdit keying ne-betonných šablon: `B5_tech_cards/technological_postupy/<section>/<polozka>.yaml` + `dictionaries.<section>` slovník (navrženo dle recon konvence; k odsouhlasení při review).
- [ ] Generuje se `interier_psv` slovník přes `gen-knowledge.mjs` (drift-guarded TS) nebo zůstává Python-only (čte ho jen concrete-agent)? — záleží, zda ho bude sdílet TS engine. Default: Python-only dokud TS nepotřebuje.
- [ ] Jak se `procurement_mode` dostane do volání (explicit param vs odvozeno z project metadata)? — F3 detail.

---

## 12. References

- Requirements: `docs/specs/universal-work-decomposer/requirements.md`
- Steering: `docs/steering/{tech,domain,structure,conventions}.md`
- Patterns: `docs/STAVAGENT_PATTERNS.md` (15 Work-First Catalog-Last, 16 UWO + Market Adapters, 29 grounding gate)
- Existující kód (recon): `concrete-agent/.../app/mcp/tools/{breakdown,classifier,otskp,urs}.py`, `app/mcp/tools/element_name_normalizer.py`, `app/classifiers/element_rules/element_types.yaml`, `app/services/position_enricher.py`, `app/models/item_schemas.py`, `Monolit-Planner/shared/src/classifiers/element-classifier.ts`, `scripts/gen-knowledge.mjs`, `kb/urs_otskp_routing.yaml`, `app/knowledge_base/B5_tech_cards/technological_postupy/`, `B10_coverage_matrices/`.

---

## 13. Versioning

| Date | Version | Changes |
|---|---|---|
| 2026-06-08 | 0.1 | Initial recon (Phase A) + design (Phase C) + fázovaný plán. Design-first, žádný kód. |
