# Universal Work Decomposer (UWO) — Requirements

> **Spec ID:** `universal-work-decomposer`
> **Datum:** 2026-06-08
> **Status:** review
> **Priority:** P1
> **Owner:** Alexander Prokopov / Claude Code session (stoic-cerf)
>
> **Dependencies:** žádné tvrdé. Reuse: `element_rules/element_types.yaml`, `kb/urs_otskp_routing.yaml`, MCP `find_otskp_code` / `find_urs_code`.
> **Blocks:** budoucí implementační větve (interiér/PSV první; elektro/VZT/ÚT/MaR/statika další).
>
> **⚠️ Design-first.** Tento spec je recon + návrh. **Žádný kód.** Implementace = samostatné úkoly po schválení designu. **Nedotýká se větve SO202 Ingest.**

---

## 1. Kontext

### 1.1 Co teď je

Nástroj rozkladu prací (`create_work_breakdown` → `breakdown.py`) umí **jen monolitní větev** ontologie: každý prvek rozloží na `{bednění, odbednění, výztuž, beton, ošetřování}` (+ volitelně předpětí) z hardcoded `WORK_TEMPLATES` klíčovaných `element_type`. Klasifikátor zná 24 betonových typů + materiálový reject (masonry / shotcrete / izolace / zálivka spár / vozovka), ale **nemá scope-router** pro ne-betonné profese. Catalog-binding (`find_otskp_code` / `find_urs_code`) vrací confidence bez statusového rozlišení a **nezná režim zakázky** (privátní vs veřejná).

### 1.2 Proč to měníme

Pro nevhodný scope (rekonstrukce bytu / interiér) monolitní cesta **sebevědomě vrátí bednění/ošetřování na vinyl a elektriku** — „sebevědomě-špatně", což je horší než prázdno. Když monolit nesedí, nástroje i LLM-klient skĺzávají na **catalog-first** („najdi kód pro tuto položku") — to je inverze Pattern 15 a ztráta ontologie prací. Jedna položka mistra (`renovace koupelny`) **není jedna práce** — je to balík atomů (demontáže + hydroizolace + obklad + dlažba + montáž ZP + příp. ZTI). **Jednotný katalogový kód na `renovace koupelny` neexistuje.** Cíl: Universal Work Ontology, kde monolit je **jen jedna větev**, a vazba na katalog je **samostatný post-krok (adapter)** vracející kandidáty se statusem a confidence, ne falešný „kód nalezen".

### 1.3 Vztah ke steeringu

| Steering doc | Vztah |
|---|---|
| `product.md` | Rozšiřuje produkt z mostní/betonové domény na pozemní rekonstrukce (privátní trh — HK212, Libuše typ). |
| `tech.md` | Determinism-first: regex/šablona → katalog → LLM až jako 0.70 fallback. Žádný catalog-first. |
| `structure.md` | KB šablony žijí v `B5_tech_cards/technological_postupy/<trade>/`; ontologie v `element_rules/` (rozšíření, ne fork). |
| `domain.md` | Pattern 15 (Work-First, Catalog-Last), Pattern 16 (UWO + Market Adapters), „jedna položka ≠ jedna práce", honest-blank. |
| `conventions.md` | §10 univerzalita po profesích (silnoproud/slaboproud/ZTI/VZT/ÚT/plyn/MaR/statika/PBŘS); single-source, no fork. |

---

## 2. User stories

### 2.1 Story 1: Rozpočtář rekonstrukce bytu

> **Jako** přípravář rekonstrukce
> **chci** aby `renovace koupelny` rozložilo na reálné PSV atomy (demontáže + HI + obklad + dlažba + ZP + ZTI), ne na bednění/ošetřování
> **abych** dostal použitelný soupis místo sebevědomě-špatného monolitního výstupu.

### 2.2 Story 2: Příprava veřejné vs privátní zakázky

> **Jako** rozpočtář
> **chci** aby se katalog (ÚRS vs OTSKP) vybral podle režimu zakázky a aby vazba vrátila **status** (exact/candidate/group_only/not_verified)
> **abych** nikdy nedostal neoficiální kód vydávaný za oficiální a věděl, kde musí kód potvrdit člověk.

### 2.3 Story 3: Neznámý scope

> **Jako** uživatel s atypickou položkou
> **chci** čestné „nemám šablonu pro tuto sekci"
> **abych** dostal flag k doplnění, ne smyšlené monolitní atomy.

---

## 3. Acceptance criteria (EARS format)

### 3.1 Krit. 1 — Monolit = jedna větev

> **When** se navrhuje ontologie prací
> **then** návrh **shall** ukázat strukturu, kde monolitní šablony jsou jedna z N větví a **přidání sekce = přidání větve šablon**, ne přearchitektura jádra.
> **Důkaz:** §2 + §3 design.md — diagram + popis rozšiřitelnosti; monolitní `WORK_TEMPLATES` popsán jako jedna registrovaná větev.

### 3.2 Krit. 2 — Větev interiér/PSV konkrétně

> **When** vstup je rekonstrukční scope (`renovace koupelny`, `malba`, `štuk`, `SDK podhled`, `obklady/dlažba`, `demontáže`, `vinyl/parkety`, `ZTI rozvody`)
> **then** návrh **shall** vyjmenovat deterministické work-atomy, které každá z těchto položek porodí.
> **Důkaz:** §4 design.md — tabulka scope → atomy.

### 3.3 Krit. 3 — Catalog-binding se statusem

> **If** se work-atom váže na katalog
> **then** adapter **shall** vrátit kandidáta se statusem `exact | candidate | group_only | not_verified` + confidence + zvolený katalog dle režimu zakázky, a **nikdy** falešný „kód nalezen".
> **Důkaz:** §3.1 + §5 design.md — DTO + status-enum semantika + reuse `urs_otskp_routing.yaml`.

### 3.4 Krit. 4 — Routing + scope-guard

> **If** scope nemá vhodnou šablonu
> **then** systém **shall** čestně vrátit „nemám šablonu pro tuto sekci" (honest-blank), **ne** monolitní atomy.
> **Důkaz:** §3 + §6 design.md — scope-router + guard + failure mode.

### 3.5 Krit. 5 — Confidence ladder + LLM jen fallback

> **While** se rozhoduje o atomech a kódech
> **the system shall** držet žebřík: deterministická šablona = vysoká confidence; inference = nižší + flag; LLM **jen** jako 0.70 fallback na neznámý scope, s flagem; nic se nehádá kvůli zaplnění.
> **Důkaz:** §2.3 design.md — confidence tabulka + tier strategie.

### 3.6 Krit. 6 — Fázovaný plán

> **When** je design hotový
> **then** **shall** obsahovat fázovaný plán (interiér první, každá fáze samostatně dodatelný inkrement) + označit, co poputně uzavírá zlepšení ÚRS-hledání (status-enum).
> **Důkaz:** §10 design.md.

### 3.7 Krit. 7 — Single-source, no fork

> **While** se ontologie překrývá s existujícími slovníky (typy elementů, monolitní atomy, procurement routing)
> **the system shall** je reusovat a rozšiřovat **na jednom místě**, ne plodit druhou pravdu.
> **Důkaz:** §2.2 + §5 design.md — explicitní reuse `element_types.yaml` / `WORK_TEMPLATES` / `urs_otskp_routing.yaml`.

### 3.8 Krit. 8 — Žádný kód

> **When** se tento úkol uzavírá
> **then** **shall** existovat pouze recon + design + plán; žádná změna chování monolitního dekompozeru; jména nevnucena; větev SO202 Ingest netknutá.
> **Důkaz:** git diff = jen `docs/specs/universal-work-decomposer/**` + `docs/soul.md` §9 entry.

---

## 4. Doménová pravidla

- **Pattern 15 (Work-First, Catalog-Last):** nejdřív ontologie prací, vazba na katalog poslední a samostatný krok. Žádný catalog-first.
- **Pattern 16 (UWO + Market Adapters):** ontologie jazyk/katalog-agnostická; národní/katalogové adaptery se připojují/mění bez dotyku ontologie.
- **Jedna položka ≠ jedna práce.** `koupelna → demontáže + HI + obklad + dlažba + montáž ZP…`. (Stejný zákon jako `opěry + křídla bundled = jedna položka = nutná dekompozice` na mostě — jiná doména, stejný princip.)
- **Catalog-binding čestný.** Kandidát se statusem + confidence; ÚRS = HTTP klient k veřejnému katalogu + lokální fallback; KROS/plný ÚRS licencovaný → přesný kód váže člověk.
- **Výběr katalogu dle režimu zakázky.** privátní (rekonstrukce bytu, HK212, Libuše) → ÚRS primary, OTSKP netřeba; veřejná zakázka → OTSKP primary; D&B → obě kolony. (Reuse `urs_otskp_routing.yaml`: `privatni` / `verejna` / `design_build`.)
- **Honest-blank / confidence-žebřík.** Deterministická šablona → vysoká; inference → nízká + flag; nemám šablonu → čestný odmítnutí, ne smetí. LLM jen fallback 0.70.
- **Confidence se nepřepisuje nižší vyšší** (steering invariant).

---

## 5. Out of scope (co toto **NENÍ**)

- ❌ Psaní implementačního kódu — jen recon + design + plán.
- ❌ LLM jako univerzální dekompozer (LLM = jen fallback 0.70 s flagem).
- ❌ Catalog-first kdekoliv v designu/příkladech.
- ❌ Fork slovníků elementů/atomů — reuse, rozšiřovat na jednom místě.
- ❌ Změna chování monolitní rozbivky (jen ji popsat jako jednu větev budoucí ontologie).
- ❌ Návrh „všech sekcí naráz" — první inkrement interiér/PSV, zbytek větvemi.
- ❌ Jakýkoliv dotyk větve/práce SO202 Ingest.
- ❌ Přesný katalogový kód z licencovaného KROS/plného ÚRS (váže člověk).

---

## 6. Open questions

Vyřešeno v pre-design interview (AskUserQuestion, 2026-06-08):

- [x] První inkrement = **interiér/PSV první** (design univerzální, implementace interiér jako první větev).
- [x] Routing = **samostatný scope-router upstream** (element-classifier zůstává čistý).
- [x] Catalog-binding = **samostatný adapter-sloj** obalující existující `find_otskp` / `find_urs`, reuse `urs_otskp_routing.yaml`.
- [x] Quantities = **provenance-enum na atomu** (`needs_input | derived_from_scope | from_soupis` + confidence).
- [ ] Přesné keying ne-betonných šablon — navrženo `B5_tech_cards/technological_postupy/<trade>/` + `dictionaries.<section>` (k potvrzení při review designu).

---

## 7. References

- Steering: `docs/steering/{tech,domain,structure,conventions}.md`
- Patterns: `docs/STAVAGENT_PATTERNS.md` (15, 16, 29)
- Design: `docs/specs/universal-work-decomposer/design.md`
- Existující kód (recon): `concrete-agent/.../app/mcp/tools/{breakdown,classifier,otskp,urs}.py`, `app/classifiers/element_rules/element_types.yaml`, `Monolit-Planner/shared/src/{classifiers,calculators}/`, `scripts/gen-knowledge.mjs`, `kb/urs_otskp_routing.yaml`, `app/knowledge_base/B5_tech_cards/technological_postupy/`.

---

## 8. Versioning

| Date | Version | Changes |
|---|---|---|
| 2026-06-08 | 0.1 | Initial recon + requirements (design-first). |
