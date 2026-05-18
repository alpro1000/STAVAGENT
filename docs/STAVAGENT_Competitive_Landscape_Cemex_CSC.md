# STAVAGENT — Competitive Landscape for Cemex CSC 2026
**Prepared for:** Cemex Construction Startup Competition pitch (deadline 28.06.2026)
**Category:** Preconstruction Tech
**Date:** 2026-05-15
**Status:** Research draft v1

---

## Executive summary

The Preconstruction Tech landscape splits into five tiers based on **who they serve** and **what part of the bid-to-execution chain they cover**. STAVAGENT sits in a gap none of them fully occupy: a **multi-vendor, neutral AI co-pilot** that takes a Czech/Slovak estimator from raw tender documents through bid pricing, crew sizing, formwork system selection, and RCPSP-grade execution scheduling — in one tool, without forcing the user into a single manufacturer's catalog or a $50k/seat enterprise platform.

Tiers covered below:

1. **Vendor-locked material calculators** — Rigips, PERI, DOKA, Hilti. Free leadgen. Single-catalog ceiling.
2. **AI tender/bid response tools** — AItenders, mytender.io, Trunk Tools (adjacent). Tender phase only, no production engineering.
3. **Estimating/BoQ software (regional standards)** — KROS 4, RTSrozp, Callida euroCALC, BKI (DE). Catalog-bound, no AI extraction, no crew/schedule.
4. **5D BIM enterprise platforms** — RIB iTWO 4.0 / iTWO costX (Schneider Electric), Kreo, Trimble. Heavyweight, BIM-required, enterprise pricing.
5. **AI field execution / construction data platforms** (adjacent) — Trunk Tools, Procore, Buildots. Post-tender, field-focused.

---

## Methodology

Each vendor profiled against six dimensions:
- **Tier & primary user** (estimator / project manager / field super / projektant)
- **Phase coverage** (tender → bid → execution → operate)
- **Catalog model** (single-vendor / national-standard / open)
- **AI capability** (none / extraction / classification / generative)
- **Geo & pricing tier** (DACH / CZ-SK / UK-US / EU-wide; free / SMB / enterprise)
- **Why STAVAGENT wins or loses against them**

---

## Tier 1 — Vendor-Locked Material Calculators

These tools exist as **leadgen channels for one manufacturer**. They are free, polished, and integrate with the vendor's ordering system. STAVAGENT is not competing with them — but they define what estimators expect in a UX (filter → parameters → BoM → CSV/XLS export).

### 1.1 Rigips Profikalkulátor (Saint-Gobain) — CZ/SK
- **What it does:** drywall (sádrokarton / SDK) partitions, ceilings, claddings. User picks construction type (příčka / předstěna / podhled), filters by acoustic / fire / mechanical properties, gets material list with unit consumption.
- **Output:** XLS / CSV / PDF; addable to a project of multiple constructions.
- **Catalog:** Rigips only. Bound to Saint-Gobain SKUs.
- **Why it's reference, not threat:** UX gold standard for "calculator inside an estimator's day" — but no concrete, no formwork, no crew, no schedule.
- Source: <https://www.rigips.cz/profikalkulacka/>, <https://www.saint-gobain.cz/pro-odborniky/technicka-podpora/ostatni-informace/jak-vytvorit-soupis-sdk-materialu-rigips>

### 1.2 DOKA Tipos 9 + DokaCAD + Easy Formwork Planner — AT/global
- **What it does:** formwork planning. Tipos 9 is the Windows app for full-system planning (Framax, Dokaflex, climbing forms). Easy Formwork Planner is a simpler online tool that calculates piece lists from building dimensions. DokaCAD plugs into AutoCAD/Revit.
- **Output:** piece list (CSV), 3D views, ordering integration with Doka Online Shop.
- **Catalog:** Doka only.
- **Notable:** Concremote (concrete strength sensors) + DokaXact (pouring monitoring) extend their footprint into execution. This is the closest a vendor calculator gets to STAVAGENT's Monolit-Planner — but still single-catalog.
- Source: <https://www.doka.com/en/solutions/services/dfds-planning-software/dfds-formwork-planning>, <https://www.doka.com/us/solutions/services/easy-formwork-planner>

### 1.3 PERI CAD + PERI Apps (Formwork Load Calculator, MULTIFLEX Configurator, ST 100 Configurator) — DE/global
- **What it does:** PERI CAD is the heavyweight AutoCAD-based planner for MAXIMO, TRIO, DOMINO, DUO, VARIO, SKYDECK, RUNDFLEX, PERI UP. Apps are web/mobile point tools (load calculations per DIN 18218, stacking tower configurations per DIBt type tests).
- **Output:** drawings, BoM, structural calculation outputs.
- **Catalog:** PERI only.
- **Notable:** PERI publishes their formwork calculations as approval-grade engineering (DIN 18218, DIBt). STAVAGENT's 7-engine pipeline competes here methodologically — we apply DIN 18218 + ČSN EN to whichever system the user picked, not just one vendor.
- Source: <https://www.peri-usa.com/products/products-overview/software-apps.html>, <https://www.peri-usa.com/products/peri-cad-software.html>

### 1.4 Hilti PROFIS Engineering — global
- Adjacent: anchor design, rebar, fire protection. Similar leadgen pattern. Mentioned for completeness.

### Tier 1 takeaway for Cemex pitch
> Vendor calculators have proven that estimators will adopt free, polished, single-purpose tools — but the ceiling is one catalog. The same estimator runs Rigips for drywall, Tipos for formwork, Hilti for anchors, then re-keys everything into KROS for the BoQ. **STAVAGENT replaces the re-keying.**

---

## Tier 2 — AI Tender/Bid Response Tools

These tools target the **bid response phase only** — RFP parsing, requirement extraction, proposal drafting, compliance matrix. They do not size crews, do not select formwork, do not produce a priced BoQ in the regional standard format.

### 2.1 AItenders (Aitenders) — FR
- **Founded:** 2018, bootstrap, Paris.
- **What it does:** SaaS that ingests tender documents (500+ pages typical), structures requirements, detects critical clauses, flags inconsistencies. Has a Microsoft Word add-in (Aitenders Smart Draft) for proposal writing.
- **Customers:** described as "major construction and industry players" in tender-based industries.
- **AI:** document understanding, clause classification, contract management throughout project lifecycle.
- **Limitation vs STAVAGENT:** stops at the proposal stage. No BoQ pricing in ÚRS/OTSKP. No production engineering. No execution planning.
- **Cemex relevance:** AItenders proves the document-AI thesis to large EPCs. STAVAGENT extends from document → priced bid → execution.
- Source: <https://aitenders.com/>, <https://www.linkedin.com/company/aitenders/>

### 2.2 mytender.io — UK
- **Stage:** Pre-seed led by Fuel Ventures; partnership with the largest UK public-sector tender portal claiming ~50,000 organizations.
- **What it does:** AI bid writing for public-sector tenders across construction, IT, FM, energy.
- **TAM cited:** £530B UK addressable (across four sectors combined).
- **Limitation:** bid writing only — no quantity surveying, no estimating.
- Source: <https://mytender.io/>, <https://futureworlds.com/mytender-io-ai-driven-bid-writing-platform/>

### 2.3 AI TENDERINGMANAGER (Administration Intelligence AG) — DE
- **What it does:** procurement-law-compliant tendering software for public sector covering preparation, bidding, and assessment phases.
- **Note:** more on the *awarding-authority* side than the contractor side; less directly comparable.
- Source: <https://vergabe.fraunhofer.de/tender-info/en/ai-tenderingmanager/>

### 2.4 Other named entrants
Brainial (NL), Document Crunch, Planera — surfaced in industry roundups (Neuroject 2025, Contravault 2026) as the AI-bid-response cohort. Same pattern: tender phase only.

### Tier 2 takeaway for Cemex pitch
> AI tender tools handle the front door (reading the RFP). They don't price the bid in a national standard, don't size a crew, don't plan a pour. STAVAGENT picks up where they hand off — and in CZ/SK markets, where ÚRS / OTSKP / TSKP discipline is mandatory, an English-language proposal-writer is not enough.

---

## Tier 3 — Estimating / BoQ Software (Regional Standards)

These are the **incumbents in every European country** — desktop or hybrid software bound to a national price catalog, used by every rozpočtář / Kalkulator / quantity surveyor. Strong moat from regulatory compliance, weak moat from technology.

### 3.1 KROS 4 — CZ/SK (the incumbent STAVAGENT must coexist with)
- **Vendor:** ÚRS CZ a.s. (owns both the software and the price catalog).
- **Footprint:** ~13,500 active commercial licenses + ~3,700 educational licenses in Czechia alone — i.e., **the de facto national standard**.
- **What it does:** položkový rozpočet + výkaz výměr in compliance with Act 134/2016 (ZZVZ) and decree 169/2016. Imports all rozpočet formats; exports XLS / uniXML. Integrates Cenová soustava ÚRS, OTSKP (Ministry of Transport), POLAR (damage assessment), RYRO (aggregated items).
- **2026 update:** online variant launched, removing the desktop-only constraint.
- **AI:** none meaningful. Workflow is manual item picking + variant comparison.
- **Limitation vs STAVAGENT:** zero document extraction, no crew sizing, no Monte Carlo, no RCPSP, no formwork engineering, no AI at all. KROS prices what the user types in.
- **Strategic implication:** STAVAGENT must export to KROS-compatible formats (XLS, uniXML) to coexist. We are a **layer above** KROS, not a replacement.
- Source: <https://www.urs.cz/software-a-data/kros-4-ocenovani-a-rizeni-stavebni-vyroby>, <https://www.urs.cz/software-a-data/kros-4-ocenovani-a-rizeni-stavebni-vyroby/kros-aplikace-a-doplnkove-moduly>

### 3.2 Callida euroCALC 3 — CZ
- Competing CZ rozpočet system with own database (SCI) and project/document management modules. Smaller market share than KROS.
- Source: <https://www.estav.cz/nomen/cinnost.asp?id=D123>

### 3.3 RTSrozp — CZ
- Already supported by STAVAGENT universal parser. Smaller competitor to KROS in the same category.

### 3.4 BKI Baukosteninformationszentrum (DE)
- German cost-data catalog standard; equivalent role to ÚRS in Germany. Critical to enter DACH.

### 3.5 STLB-Bau, DBD-KostenAnsätze (DE) / BEDEC (ES) / Batiprix (FR) / DPGF (FR)
- National catalog standards STAVAGENT must integrate to cross borders.

### Tier 3 takeaway for Cemex pitch
> KROS is a national institution with 13,500 paid licenses in CZ. STAVAGENT does **not** compete with KROS — STAVAGENT feeds KROS. The AI does the upstream work that estimators currently do by hand: extract elements from drawings, classify by type, propose ÚRS/OTSKP item codes with confidence scoring, then export to KROS in the format ÚRS already supports. We position as the AI layer ÚRS doesn't build.

---

## Tier 4 — 5D BIM Enterprise Platforms

These are the heavyweights. They require a BIM model as input and serve large GCs and EPCs running €100M+ projects.

### 4.1 RIB iTWO 4.0 / iTWO costX / MTWO / Candy — DE (Schneider Electric subsidiary since 2020)
- **Parent:** Schneider Electric (acquired RIB Software SE for €1.4B in 2020).
- **What it does:** end-to-end 5D BIM platform (3D geometry + 4D schedule + 5D cost). iTWO 5D drives model-based BoQ generation through "matchkey" element catalogs; iTWO costX is the 2D/3D takeoff and estimating tool; MTWO is the SaaS version on Azure; Candy is the legacy estimating + planning + project control product (from the South African CCS acquisition).
- **Customers:** VINCI Construction (DE), Herbosch-Kiere (BE/UK), WILDBAU (DE) — i.e., large infrastructure and high-rise GCs.
- **AI:** classical 5D linking, recent BIM/AI features through CostX; not generative-AI native.
- **Pricing:** enterprise; not published, typically 5- to 6-figure annual contracts per seat-pack.
- **Why STAVAGENT wins against it for SMB:** iTWO requires BIM-mature workflows. The Czech mid-market (přípraváři at 5–50-person contractors) does not have BIM models for every project. STAVAGENT operates from drawings + TZ + soupis — the documents that actually exist.
- Source: <https://www.rib-software.com/en/rib-4-0>, <https://www.rib-software.com/en/case-studies/wild-bau-wasserburg>, <https://en.wikipedia.org/wiki/RIB_Software>

### 4.2 Kreo Software — UK
- **Founded:** 2017. ~$2.4M revenue, 22 people. Acquisition offer received in 2025 (terms not public).
- **What it does:** cloud-native AI takeoff (2D drawings + BIM/IFC/RVT models). Auto-detection of rooms/walls/doors/windows; AI agentic workflow that generates items and assemblies from a project or prompt; reusable rate libraries; AES-256 + SAML/Okta enterprise security.
- **Customers:** GCs across UK / US / Canada / Australia / France (Building Dreams Contracting, K2 Consultancy named publicly).
- **AI:** cloud, ML for element detection; recent agentic features for assembly generation.
- **Limitation vs STAVAGENT:** no regional pricing catalog binding (KROS / ÚRS / OTSKP), no crew sizing, no formwork engineering, no Monte Carlo, no RCPSP. Strong on takeoff, weak on production engineering and CZ-specific compliance.
- Source: <https://www.kreo.net/>, <https://apps.autodesk.com/en/Publisher/PublisherHomepage?ID=JB7UNJ5V7JC9>, <https://datadrivenaec.com/tools/kreo-software>

### 4.3 Trimble (Quest, ProEst, WinEst) and Autodesk Construction Cloud — US
- Adjacent enterprise platforms. Not preconstruction-AI-native.

### Tier 4 takeaway for Cemex pitch
> 5D BIM is real and growing, but it's a 10-year transformation for SMB contractors and an enterprise sale for vendors. STAVAGENT runs on the documents SMBs *already have* (drawings, TZ, výkaz výměr in XLSX), classifies elements deterministically, prices in ÚRS/OTSKP, and exports to KROS. We meet the market where it is, not where iTWO wishes it were.

---

## Tier 5 (adjacent) — AI Field Execution / Construction Data Platforms

Not direct competitors, but they show what well-funded AI in construction looks like. Useful for Cemex deck "market validation" framing.

### 5.1 Trunk Tools — US
- **Founded:** 2021 by Dr. Sarah Buchner (carpenter → PhD → founder).
- **Funding:** $70M total ($20M Series A Aug 2024 Redpoint; $40M Series B Jul 2025 Insight Partners). Liberty Mutual Strategic Ventures, Innovation Endeavors, Stepstone, Prudence in cap table. Suffolk Technology, DPR's WND Ventures also invested.
- **Customers:** Gilbane, Suffolk Construction, DPR Construction. ~60 people. Microsoft partnership announced 2025.
- **What it does:** AI agents that ingest unstructured construction documents (drawings, specs, RFIs, schedules, submittals), structure them, answer natural-language questions ("does this door require electricity?"), and run autonomous workflows like scheduling.
- **Position:** post-tender, field-side. Not estimating, not bid pricing.
- **Why this matters for Cemex pitch:** Trunk Tools validates the "vertical AI for construction" thesis at $70M of investor conviction. STAVAGENT is the same thesis applied to the **preconstruction / estimator** workflow rather than the field/super workflow — which is where Cemex's CSC category sits.
- Source: <https://trunktools.com/resources/company-updates/trunk-tools-closes-40m-series-b-construction-ai-transformation/>, <https://www.enr.com/articles/61084-trunk-tools-nets-40m-in-funding-round-led-by-insight-partners-tech-firm-ceo-said>, <https://www.cnbc.com/2025/08/01/trunk-tools-ai-reduce-construction-error-waste.html>

### 5.2 Procore, Buildertrend, Autodesk Construction Cloud
- Mature PM platforms. Not preconstruction-AI competitors but ecosystem context.

### 5.3 Buildots, OpenSpace, Document Crunch, Planera, Brainial
- Each occupies a narrow AI niche (progress capture, doc compliance, scheduling). None operate the full preconstruction stack.

---

## STAVAGENT positioning matrix

| Capability | Rigips/PERI/DOKA | AItenders | KROS 4 | RIB iTWO | Kreo | Trunk Tools | **STAVAGENT** |
|---|---|---|---|---|---|---|---|
| Document extraction (TZ + drawings + soupis) | — | ✅ tender docs | — | partial | ✅ drawings | ✅ field docs | ✅ (TZ + drawings + soupis + statika) |
| BoQ priced in CZ/SK standard (ÚRS/OTSKP) | — | — | ✅ | — | — | — | ✅ |
| Multi-vendor formwork engineering (DOKA + PERI + ULMA + Místní) | single vendor | — | — | — | — | — | ✅ |
| DIN 18218 / ČSN EN concrete pressure calc | PERI only | — | — | — | — | — | ✅ |
| Crew sizing (v4.24 formulas, §116 ZP night-shift) | — | — | — | — | — | — | ✅ |
| Monte Carlo on cost/schedule | — | — | — | — | — | — | ✅ |
| RCPSP execution scheduling | — | — | — | partial (4D) | — | partial | ✅ |
| AI element classification (22→23 types, bridge + building) | — | — | — | — | partial | — | ✅ |
| Export to KROS / national format | — | — | native | — | — | — | ✅ |
| Pricing model | free leadgen | enterprise | €1k–3k/seat/yr | €10k+/seat/yr | SMB SaaS | enterprise | **SMB SaaS + credits** |

---

## Implications for the Cemex CSC pitch

**Three angles to test in the deck:**

1. **"Neutral aggregator" positioning.** Cemex CSC partners watch list (Ferrovial, VINCI Leonard, Hilti, Trimble) shows they care about partners who **distribute** producer catalogs without locking customers in. STAVAGENT can host Cemex's concrete grade catalog as a first-class citizen alongside ÚRS / OTSKP / formwork systems. Vendor calculators (Rigips, DOKA, PERI) cannot do this for Cemex by definition.

2. **"AI layer on top of regional incumbents."** STAVAGENT does not displace KROS in CZ, BKI in DE, BEDEC in ES — we feed them. This de-risks the sale: no estimator has to abandon their 13,500-license incumbent. Cemex's audience is GCs and ready-mix customers who use KROS-equivalents in every country.

3. **"SMB AI vs. enterprise BIM."** Trunk Tools raised $70M selling vertical AI to large GCs (Gilbane, Suffolk, DPR). RIB iTWO sold its platform to Schneider Electric for €1.4B as enterprise. The SMB segment — the 5- to 50-person přípraváři / Bauleiter / capi cantiere across DACH and CEE — is uncovered by both. STAVAGENT addresses that gap with a credit-pack pricing model.

**What to add in the deck (suggested slides):**
- Slide: "The estimator's day today" (5 tools, copy-paste hell) → "The estimator's day with STAVAGENT" (one pipeline)
- Slide: this competitive matrix, simplified to 5 capability rows
- Slide: Trunk Tools at $70M validates vertical AI — STAVAGENT does the same for preconstruction
- Slide: "Why Cemex" — concrete grade catalog as first-class citizen in the BoQ + Monte Carlo cost engine

---

## Source index

- Rigips Profikalkulátor: <https://www.rigips.cz/profikalkulacka/>
- Rigips kalkulačka (consumer): <https://www.rigips.cz/kalkulacka/>
- Saint-Gobain manual: <https://www.saint-gobain.cz/pro-odborniky/technicka-podpora/ostatni-informace/jak-vytvorit-soupis-sdk-materialu-rigips>
- DOKA Tipos 9: <https://www.doka.com/en/solutions/services/dfds/dfds-planning-software/tipos-software-formwork-planning>
- DOKA Easy Formwork Planner: <https://www.doka.com/us/solutions/services/easy-formwork-planner>
- DOKA digital solutions: <https://www.doka.com/en/solutions/digital-solutions>
- PERI Software & Apps: <https://www.peri-usa.com/products/products-overview/software-apps.html>
- PERI CAD 24: <https://www.peri-usa.com/products/peri-cad-software.html>
- AItenders: <https://aitenders.com/>, <https://www.linkedin.com/company/aitenders/>
- AI bidding roundup (Neuroject 2025): <https://neuroject.com/construction-tender-ai-tools/>
- 15 AI bidding tools (Contravault 2026): <https://www.contravault.com/blog/15-ai-construction-bidding-software-tools-in-2026>
- mytender.io: <https://mytender.io/>, <https://futureworlds.com/mytender-io-ai-driven-bid-writing-platform/>
- KROS 4 (ÚRS): <https://www.urs.cz/software-a-data/kros-4-ocenovani-a-rizeni-stavebni-vyroby>
- KROS modules: <https://www.urs.cz/software-a-data/kros-4-ocenovani-a-rizeni-stavebni-vyroby/kros-aplikace-a-doplnkove-moduly>
- KROS license stats (IVAR CS): <https://www.ivarcs.cz/clanky/nase-produkty-jsou-jiz-take-zahrnuty-v-rozpoctovych-programech-kros-4-cenkros-4-a-cenove-soustavy-urs-200/>
- Cenová soustava ÚRS: <https://www.urs.cz/software-a-data/cenova-soustava-urs>
- ESTAV rozpočet software catalog: <https://www.estav.cz/nomen/cinnost.asp?id=D123>
- RIB iTWO 4.0: <https://www.rib-software.com/en/rib-4-0>
- RIB iTWO 5D + civil: <https://www.rib-software.com/en/solutions/cad-civil-engineering/rib-itwo-5d-and-itwo-civil>
- RIB CostX: <https://www.rib-software.com/en/rib-costx/bim>
- RIB Wikipedia (Schneider Electric €1.4B acquisition): <https://en.wikipedia.org/wiki/RIB_Software>
- RIB iTWO 5D case study (WILDBAU): <https://www.rib-software.com/en/case-studies/wild-bau-wasserburg>
- Kreo Software main: <https://www.kreo.net/>
- Kreo BIM Takeoff: <https://www.kreo.net/solutions/bim-takeoff>
- Kreo pricing: <https://www.kreo.net/pricing>
- Kreo Autodesk listing: <https://apps.autodesk.com/en/Publisher/PublisherHomepage?ID=JB7UNJ5V7JC9>
- Kreo DataDrivenAEC profile: <https://datadrivenaec.com/tools/kreo-software>
- Trunk Tools Series B: <https://trunktools.com/resources/company-updates/trunk-tools-closes-40m-series-b-construction-ai-transformation/>
- Trunk Tools ENR: <https://www.enr.com/articles/61084-trunk-tools-nets-40m-in-funding-round-led-by-insight-partners-tech-firm-ceo-said>
- Trunk Tools CNBC: <https://www.cnbc.com/2025/08/01/trunk-tools-ai-reduce-construction-error-waste.html>
- Trunk Tools Series A: <https://trunktools.com/resources/in-the-news/trunk-tools-series-a/>
- AI TENDERINGMANAGER: <https://vergabe.fraunhofer.de/tender-info/en/ai-tenderingmanager/>

---

## Open questions to resolve before pitch finalization

1. **Cemex CSC category re-read** — confirm "Preconstruction Tech" scope (does it include the formwork/execution-planning bridge STAVAGENT covers, or strictly tender-bidding?).
2. **Cemex-specific angle** — concrete grade catalog integration: does Cemex have a structured digital catalog (SKU + technical specs) that STAVAGENT could ingest as a Tier-3-equivalent? If yes, this is the partnership ask.
3. **Trunk Tools comparison framing** — Trunk Tools is more "ChatGPT for jobsites" than estimator. Worth a side-by-side "different phase, same vertical-AI thesis" slide.
4. **Competitive moat slide** — what to publicly disclose: 22→23 element types, 7-engine pipeline, DIN 18218 + TKP18 enforcement, OTSKP/ÚRS catalog routing logic by ZZVZ vs. private vs. D&B.
