# STAVAGENT — Product Steering

> **Účel dokumentu:** Co stavíme, pro koho, jaký problém řešíme, jak vypadá úspěch.
> Tento dokument je **kanonický zdroj** pro positioning, pitch decks, marketing copy.
> Pokud něco mimo tento dokument říká něco jiného — buď doplň sem, nebo to oprav tam.
>
> **Aktualizace:** Při strategickém rozhodnutí (změna pozicování, nový segment, pivot).
> **Verze:** 1.0 — 19.05.2026

---

## 1. Mission

**Engineering calculation layer for construction with triple access (UI / MCP / Agent API).**

Превращаем строительную документацию (TZ, výkresy, výkaz výměr) в инженерные расчёты + рабочий план: opalubka, výztuž, beton, такты, harmonogram, cost breakdown. Детерминированно, по нормам (DIN 18218, ČSN EN, RCPSP, Saul), с цитируемыми источниками.

**Tagline (CZ):** *Z rozpočtu pracovní plán.*
**Tagline (EN):** *From estimate to working plan.*

**Принцип точности:** *Předрасчёт, не výpočet do posledního šroubu. Přibližný, ale velmi přesný a spolehlivý. Aby tendrér nepromáchl rozpočet a termíny.*

**Insight о критическом пути:** *Co je beton — to je harmonogram.* Bei monolitních mostních konstrukcí betonové práce — kritická cesta. Vše ostatní je paralelní nebo následující.

---

## 2. Target audience

### 2.1 Primary

**Přípravář a rozpočtář monolitních betonových prací (CZ/SK).**

- Pracuje pod tlakem tendrových termínů (часто 2-6 tý dní на bid)
- Ručně přepisuje pozice z TZ do výkazu výměr (časté chyby)
- Manual lookup OTSKP кódů
- Hand-calculation formworku, výztuže, taktů (Excel, tradice)
- Zodpovědný za "nepromáchnutí" rozpočtu i termínu — jeho jméno na bid'u

### 2.2 Secondary

**Stavební firmy a generální dodavatelé (приподготовка тендеров).**

- Hrubý odhad před hlubokým rozpočtováním
- Cross-check externího rozpočtáře
- Risk assessment (PERT Monte Carlo, sensitivity)

### 2.3 Tertiary

**Mosty a infrastruktura specialists.**

- Předpětí, ČSN EN, ŘSD předpisy (TKP, TP)
- Speciální technologie: MSS, ILM, vyspouvaná konstrukce
- Bridge-specific elements (pilíř, opěra, mostovka, římsa, závěrečná zídka, křídla)

### 2.4 Future (Q3+ 2026)

- **AI agents** přes MCP server (Claude Desktop, Custom GPT, Cursor agents)
- **Integration partners** přes REST API (Alice Technologies, BIM tools)
- **DACH expansion** (BKI catalog slot вместо ÚRS, DIN nativně)
- **Spain expansion** (Codigo Estructural RD 470/2021, FIEBDC-3 .bc3)

---

## 3. Problem & solution

### 3.1 Problem

| Stávající stav | Pain |
|---|---|
| Přípravář tráví 60-80% času manuálním přepisováním a lookupem | Time |
| AI tooly (Aitenders, Togal.AI) extrahují, ale **nevypočítávají** | Gap |
| LLM-only nástroje halucinují inženýrské výpočty | Risk |
| Inženýrský výpočet (DOKA, PERI software) je drahý, monolitický, není API | Cost |
| KROS (incumbent CZ) — desktop legacy bez AI, bez agentic interface | Pokolenie |

### 3.2 Solution

**Engineering calculation infrastructure exposed three ways:**

| Access | Audience | Status |
|---|---|---|
| **UI** (4 kiosky на Vercel) | Přípravář (humans) | v4.24 в продакшне |
| **MCP server** (9 tools) | AI agents | v1.0 live, Lemon Squeezy billing |
| **REST API** | Integration partners | Internal, expose pending |

### 3.3 Why we are not just another AI tool

| Capability | STAVAGENT | Aitenders | Togal.AI | Buildcheck | Alice |
|---|---|---|---|---|---|
| Document extraction | ✅ | ✅ | ✅ | partial | ❌ |
| Quantity takeoff | ✅ | ❌ | ✅ | ❌ | ❌ |
| Engineering calc (DIN 18218, Saul, RCPSP) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Catalog integration (OTSKP, ÚRS, BKI-ready) | ✅ | partial | ❌ | ❌ | ❌ |
| Triple access (UI + MCP + API) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Deterministic-first (confidence=1.00 over AI) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Concrete-specific depth (25 formwork, 23 elements) | ✅ | ❌ | ❌ | ❌ | ❌ |

**Alice Technologies je komplementární, ne konkurenční.** Alice optimizuje rozpis, který má scope breakdown + costs. STAVAGENT **generuje** ten scope breakdown z inženýrských prvních principů.

---

## 4. 4 produktové moduly (kanonická jména)

> Tato jména používáme všude — UI, marketing, dokumentace, pitch. Neměnit lehkomyslně.

### 4.1 Klasifikátor

- **Subdomain:** `klasifikator.stavagent.cz`
- **Co dělá:** AI klasifikace pozic z výkazu výměr. Multi-model (19 AI modelů). Multi-mode (rychlý / rozšířený). 3 input methods (file / text / dokumenty).
- **Integrace:** Export do Registru přes POST `registry.stavagent.cz/api/sync`.

### 4.2 Registr

- **Subdomain:** `registry.stavagent.cz`
- **Co dělá:** Workshop přípraváře. Klasifikace pozic do skupin pro poptávky. TOV (Technologicko-organizační rozbor) — lidé / mechanizmy / materiály. Vestavěné kalkulátory (bětonpumpa multi-supplier, doprava, kran).

### 4.3 Kalkulátor betonáže

- **Subdomain:** `kalkulator.stavagent.cz`
- **Co dělá:** Detailní výpočet monolitních prací. Dva režimy: **Detail prvku** (7 engines) a **Plán objektu** (tabulka prvků, takty, harmonogram, Kč/m³).
- **7 engines:** Formwork (DIN 18218) → Rebar-lite → Pour-decision → Maturity (Saul) → Element-scheduler (RCPSP) → PERT Monte Carlo → Pump.

### 4.4 Analýza dokumentace *(v přípravě, Q3 2026)*

- **Subdomain:** `stavagent.cz/portal/analysis`
- **Status:** Teaser na lendingu, lead-gen forma "Early access"
- **Budoucí scope:** TZ, statika, geologie. Cross-document kontrola (geologie XA1 → statika min C30/37).

---

## 5. Engineering depth (kompetitivní moat)

**7-engine pipeline (orchestrated, deterministic-first):**

1. **Formwork engine** — DIN 18218 lateral pressure, výběr systému (25 systémů: DOKA 6, PERI 13, ULMA 3, NOE 1, tradiční 1)
2. **Rebar-lite engine** — h/t matrix per element × diameter
3. **Pour-decision engine** — záběry, pracovní spáry, cycle time
4. **Maturity engine** — Saul/Nurse-Saul, ČSN EN 13670
5. **Element-scheduler** — RCPSP+DAG
6. **PERT Monte Carlo** — risk distribution
7. **Pump engine** — multi-supplier tarify, crew composition, §116 ZP noční

**Catalog & coverage:**
- 25 formwork systémů
- 23 typů konstrukčních prvků (9 mostních + 13 pozemních + transport)
- 921+ engineering tests → 1036+ po Gate 2
- OTSKP database 17 904 položek
- Pile engine: Ø600/900/1200/1500 × 4 geologie × 3 metody

**Точность:** ±10-15% (orientational). Finální rozhodnutí zůstává у přípraváře / statika.

---

## 6. Pozicování (3 vrstvy)

### 6.1 Layer 1 — what we are (technical)

> *Engineering calculation infrastructure for construction. 7 engines, 25 formwork systems, 23 element types, OTSKP database, exposed via UI / MCP / REST API.*

### 6.2 Layer 2 — why now (timing)

> *AI agents need engineering ground truth. LLMs hallucinate construction calculations. STAVAGENT is the deterministic layer agents call when they need formwork pressure or pour cycle, not text generation.*

### 6.3 Layer 3 — go-to-market (commercial)

> *Launching in Czech/Slovak market (underserved, no direct competitor, founder relationships). Engines are universal — DACH expansion = catalog + language layer, not engine rewrite. Spain Phase 2.*

---

## 7. Success criteria

### 7.1 Krátkodobé (Q2 2026)

- [ ] Cross-user data isolation P0 решен **до** Cemex demo
- [ ] Cemex CSC 2026 application submitted (deadline 28.06.2026)
- [ ] Pitch deck EN + 60s demo video готовы (W3)
- [ ] MCP server v ChatGPT/Claude Directory (W3-W4)
- [ ] Lemon Squeezy billing live (готово)
- [ ] 3-5 платных пилотов

### 7.2 Středně-dlouhodobé (Q3-Q4 2026)

- [ ] Helsinki Pitch Day (16-19.11.2026) — 6 finalistů
- [ ] Smart Parser (TZ extraction) v produkci
- [ ] Calendar-aware scheduling (CZ holidays)
- [ ] DACH expansion pilot (BKI + DIN UI)

### 7.3 Dlouhodobé (2027+)

- [ ] Spain expansion (Código Estructural + FIEBDC-3)
- [ ] BIM (IFC) ingest
- [ ] P6 / MS Project export
- [ ] Enterprise tier с SSO/audit/SLA

---

## 8. Co STAVAGENT **NENÍ**

> Tento seznam je stejně důležitý jako "co je". Drží scope.

- ❌ Není inženýrský výpočet úrovně DOKA software (do posledního šroubu)
- ❌ Není statický výpočet konstrukce (to dělá statik)
- ❌ Není konstrukční poradenství (statik má vždy poslední slovo)
- ❌ Není replace KROS frontally (coexist přes export/import)
- ❌ Není GeneralContractor's ERP (není projektová administrativa)
- ❌ Není BIM authoring tool (Q4 2026 — pouze IFC ingest)
- ❌ Není survey/geodézie nástroj
- ❌ Není finance/cashflow nástroj

---

## 9. Risk acknowledgements

### 9.1 Berger Bohemia (current employer) sees landing/LinkedIn

**Mitigation:**
- Lending nedotýká Berger by name
- LinkedIn — STAVAGENT Experience oddělený od Berger
- Personal-time disclaimer na `/team` a v LinkedIn About
- STAVAGENT je **tool for estimators**, mohl by Berger používat (positive framing)

If Berger asks: *"I built tool for my own daily problem in personal time, did not use company resources, would be happy to discuss if useful for Berger."*

### 9.2 ÚRS Praha legal exposure

**Mitigation:**
- ÚRS nikdy nevyslovuje publicly
- UI labels neutralizovány (Gate 2)
- Backend acronym `URS_MATCHER_SERVICE` decoded as **"Unified Retrieval Service"** — defensible technical interpretation
- OTSKP (státní, free) — публично vždy OK

### 9.3 VELTON Real Estate (Libuše freelance) — confidentiality

**Mitigation:**
- Libuše uváděna pouze v geometry/engineering kontextu
- VELTON name never mentioned
- No financial details leaked
- PROBE findings stay internal

---

## 10. Document versioning

| Date | Version | Notes |
|---|---|---|
| 19.05.2026 | 1.0 | Initial steering, synthesized from STAVAGENT_Master_Brief.md (04.05.2026) + STAVAGENT_Project_Knowledge_Snapshot.md (08.05.2026) |

**Maintained by:** Alexander Prokopov + Claude sessions
**Source of authority:** Tento dokument. Při konfliktu s jinými docs vyhrává tento.
