# ADR-008 — tz-passport half-B: extraction → BridgePassport (placement, vocab map, vision, LLM)

> **Status:** ACCEPTED (B-interview ratifikováno Alexandrem 2026-07-11: «Согласен со всем»)
> **Kontext:** half-A (mapper + MCP `calculate_from_passport`) živě doказан na SO-202
> (+51 % aggregate catch); passport se dnes staví ručně. Half-B = dokumenty
> (TZ PDF + výkresy + soupis XLSX) → `BridgePassport` JSON.
> Gate 0 audit: `docs/specs/tz-passport-json/halfB-gate0-audit.md`.

---

## Rozhodnutí

### 1. Placement — sibling-assembler (interview Q2)

`app/services/bridge_passport_assembler.py` v concrete-agent Core, **vedle**
`recipe_runner._quantify_from_documents` seamu — NE uvnitř recipe_runneru
(passport nesmí být přivázán ke stage-gating session), NE paralelní struktura
(ingredience se REUSUJÍ: `extract_tz_fields`, `map_soupis_to_elements`,
`parse_construction_budget`, classifier). Konzumenti assembleru:
(a) nový MCP tool `build_bridge_passport`; (b) recipe_runner — později,
aditivně; (c) Portal UI — později. Modulová jména vždy `bridge_passport*`
(tři „passport" koncepty v kódu — `ProjectPassport` doc-analysis,
`BridgePassport` tz, UEP adapter; dvě `QuantityItem` třídy → import-path
disciplína povinná).

### 2. Slovníková mapa klíčů = sdílená DATA (interview Q4)

Osa CZ classifier vocab (`mostovkova_deska`, `driky_piliru`, …) ↔ EN passport
vocab (`superstructure_deck`, `pier_shafts`, `foundations_piers`, …) žije jako
**YAML v concrete-agent KB** → generuje se do TS (shared kb-generated) a čte
z Pythonu — vzor `element_types.yaml` + CI drift-guard. Jedna mapa, tři
konzumenti: assembler (B), mapper half-A (`ELEMENT_RULES` v bridge-passport.ts
se stane generovaným artefaktem místo ruční tabulky), budoucí frontend-manifest
(AI-vrstva formy kalkulátoru = pozdější konzument téže mapy — ŽÁDNÝ druhý
extraktor se nestaví).

### 3. Stage pořadí a extrakční pravidla (interview Q3, rámec z A-interview)

Pořadí výstavby: **stage 1 (TZ text) → stage 3 (soupis join) → stage 2
(výkresy)** — text a soupis jsou deterministické a levné; vision je největší
novum, staví se na hotové kostře.

- **Soupis = deterministický parser, nikdy LLM.** Join přes sdílenou mapu
  klíčů; rozšířit o `rebar_mass_kg` (t/kg), `prestress_strand_mass_kg`,
  `height_m`, `length_bm` (dnes jen m³).
- **TZ text = regex-first, LLM-fallback (Q3a: seam SKUTEČNĚ zapojit).**
  `_LLM` v `extract_tz_fields` se napojí na Vertex `gemini-2.5-flash`;
  invarianty: LLM vidí JEN jednu nerozparsovanou sekci (nikdy celý text),
  confidence LLM-polí = 0.70 (lestenka repa), deterministický výsledek se
  NIKDY nepřepisuje nižší confidence, každé pole `_source` anchor. Docstring
  přestane lhát («existing Vertex routing» dnes = None).
- **Výkresové poznámky = vision povinně, HOST-side (Q3b volba i).**
  Pattern 39/40 se drží: vision dělá hostitelský model (Claude/ChatGPT walking
  the drawing), server = deterministický grounding gate. `validate_drawing_element`
  dostane **notes-větev**: host submituje calculable-critical trio
  (`deck_pour_stages` + `deck_pour_stages_source` + `falsework_technology`),
  server graunduje proti TZ/passport kontextu a vrací verdikt + confidence.
  Server-side Vertex multimodal (bez hosta) = pozdější OPCE (batch), ne teď.

### 4. budget.py routing bug — opravit v Gate 2 (interview Q5)

Rozbité importy (`parse_komplet`/`parse_rts_rozpocet`/`UniversalParser().parse_file`
neexistují) jsou v kritické cestě stage 3 → SDD bug-ticket + fix PŘED stage-3
prací. Komplet/RTS-pojmenované soupisy dnes padají.

### 5. Honest-blank všude (AC 5 requirements)

Chybějící pole = chybí (žádná fabrikace); každé extrahované pole nese `_source`
(sekce+strana / výkres+poznámka / soupis pozice); konflikty TZ↔soupis →
`_meta.conflicts[]`, výpočet default = TZ (ratifikováno v A-interview).

## Gates

G1 tento ADR · G2 mapa klíčů + budget-fix + quantities-join rozšíření ·
G3 stage 1 use-keyed + assembler skeleton + schema-tagged store + LLM seam ·
G4 stage 2 notes-gate · G5 MCP tool `build_bridge_passport` (6 counter-souborů
synchronně) + E2E golden «dokumenty SO-202 → passport ≈ ruční
example_SO202_zalmanov.json» + transport test · G6 docs.

## Zamítnuté alternativy

- Assembler uvnitř recipe_runneru (vazba na session) / nová paralelní struktura
  (duplicitní ingredience).
- Mapa klíčů ručně ve dvou runtimech (drift — přesně to, co Gate 4
  monolith-classification právě uklidil u determineSubtype).
- Server-side vision jako primární režim (odklon od Pattern 40; host-vision
  už má hotový gate-vzor).
- LLM nad celým TZ textem (poison-riziko — SO-250 lekce «mostní objekt»
  v geologii; sekční pravidlo zůstává).
