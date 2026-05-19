# STAVAGENT — Soul (Living Memory)

> **Účel dokumentu:** Continuity memory mezi sessions. Tento soubor je **dopis od minulých sessions budoucím sessions**.
>
> **Read at start of every Claude session.** Online (claude.ai) přes Project Knowledge. Doma (Claude Code) přes Git pull.
>
> **Update na konci každé významné session** — viz `docs/steering/conventions.md` §11.3.
>
> **Verze:** Initialized 19.05.2026

---

## 1. Founder context

**Alexander Prokopov.** Solo founder STAVAGENT.

- **Day job:** přípravář/rozpočtář v Berger Bohemia (Bridge & Railway Division, Plzeň)
- **Evenings/weekends:** STAVAGENT
- **Languages:** Russian (native, communication), Czech (domain expertise, codebase terminology), English (code, technical writing)
- **Personality:** Decisive, action-oriented, override scope reductions, ALL CAPS = frustration signal

---

## 2. Current state snapshot (19.05.2026)

### 2.1 Production

- **v4.24** в продакшне (PR #983 deployed)
- **Gate 1** PR #1058 merged (29.04.2026)
- **Gate 2** PR #1064 merged (15 commits, branch `gate-2-element-classification`). Tests 1002 → 1036. Element types 22 → 23 (zaklady_oper added).
- **MCP v1.0** live с биллингом
- **3,693+** commits, 500+ deployments
- **$5,000** Perplexity credit aktivní

### 2.2 Active critical work

- **P0 BLOCKER před Cemex demo:** Cross-user data isolation. Nový users vidí všechny projekty v Monolit-Planner a Registru. Potential GDPR exposure. Musí se vyřešit před jakýmkoliv public marketing nebo Cemex demo.
- **Cemex CSC 2026 submission deadline:** 28.06.2026 — primary competition target
- **Realistic pitch day target:** Helsinki 16-19.11.2026

### 2.3 Active freelance

- **Libuše objekt D** (VELTON, akce 185-01) — branch `claude/libuse-delivery-continue-GEBr5`, 11 commits ahead. Phase 7a Part 2 + Phase 8 pending. Deadline 11.05 (passed) — uzavřít. Test data: `test-data/libuse/`.
- **hk212_hala** (Hradec Králové, SOLAR DISPOREC) — Phase 1 Etapa 1 complete, 141 items, 29.8% URS match (catalog vintage gap). Phase 2.1 audit trail extraction. Test data: `test-data/hk212_hala/`.
- **Žihle 2062-1** — pilot COMPLETE, 154 položek, 10.59M Kč. Phase E dropped (ADR-005). 7 product patterns documented. Test data: `test-data/most-2062-1-zihle/`.
- **RD Jáchymov dům** — N=5 corpus case COMPLETE (18.05.2026). Hybrid DSP/DPS (DPS-grade DXF в DSP-contracted). 189 items. Test data: `test-data/RD_Jachymov_dum/` (PR #1177 Phase 0b foundation). Path C: 89% → 100% DXF coverage. Dual catalog discovered: URS201801 (39741) + TSKP (11994). Subdod v1.2. **9 corpus patterns** dokumentovány (viz §5.1).
- **SO-250 D6 Žalmanov** — SmartExtractor probe case. Test data: `test-data/SO_250/`.

### 2.4 Knowledge corpus sources (NE freelance, study material pro KB)

- **Litovel bridge** — vlastní diplomová práce, používaná jako study material pro bridge KB build-out v2 (TKP 4 + ČSN 73 6244 + VL 4 + Litovel case study). Test data: `test-data/most-litovel/`. Material se integruje do `app/knowledge_base/B7_regulations/` (TKP, ČSN, VL) a `B6_research_papers/` (case study). NE klient, NE deadline — open-ended KB enrichment.

**Shared assets v `test-data/`:**
- `kros_catalog.db` — KROS catalog SQLite (working copy, parallel to OTSKP DB)
- `STAVAGENT_Drawings_to_VV_Rozpocet_Playbook.md` — dataset-bound playbook (drawings → výkaz výměr → rozpočet)

---

## 3. Key architectural decisions (and why)

### 3.1 Vertex AI primary (ne Bedrock)

**Decision date:** ~03.2026
**Why:**
- EU data residency v `europe-west3`
- Google Cloud for Startups credits applied
- Gemini Flash extremely cheap pro classification volume
- Bedrock = fallback, ne primary

### 3.2 Render NEPOUŽÍVÁ

**Decision date:** ~01.2026
**Why:**
- Migrace na Cloud Run + Vercel completed
- Lepší integrace s GCS, Cloud SQL, Vertex
- Konsistentní stack

### 3.3 Stripe odstraněn

**Decision date:** Gate 2 (28.04.2026)
**Why:**
- Dead code, nikdy commercially activated
- Lemon Squeezy je production billing
- Mít Stripe v repu = confusing pro nového developera

### 3.4 Confidence scoring framework

**Why:**
- OTSKP lookup je deterministic (db.match) → 1.00
- Regex extraction je interpretable → 0.85-0.95
- AI návrh je probabilistic → 0.70
- Human override je intentional → 0.99
- Pravidlo "high doesn't get overwritten by low" — chrání kvalitu dat

### 3.5 Core ↔ Kiosks pattern

**Why:**
- Každý kiosk může být rebuilt nezávisle
- Core API je business logic, kiosky jsou rendering
- DACH/Spain expansion = nový kiosk + nová language layer, NE rewrite Core

### 3.6 Triple access (UI + MCP + API)

**Why это competitive moat:**
- AI agents need engineering ground truth
- Konkurenti (Aitenders, Togal) jsou single-mode (jen UI nebo jen API)
- STAVAGENT je agent-ready by design
- MCP server je live, Lemon Squeezy billing live

### 3.7 Deterministic-first principle

**Why:**
- LLMs halucinate engineering calc
- Regex + lookup tables + formula engines jsou auditovatelné
- AI fallback only kde deterministic je beмocný (free text → categories)
- Aligns s GDPR / EU AI Act (limited risk, transparent)

### 3.8 URS → "Unified Retrieval Service"

**Decision date:** Gate 2
**Why:**
- ÚRS Praha legal exposure
- Backend acronym `URS_MATCHER_SERVICE` is defensible as "Unified Retrieval Service"
- Public UI labels neutralized
- OTSKP (státní, free) is publicly OK

---

## 4. Construction domain insights (accumulated)

### 4.1 "Co je beton — to je harmonogram"

При тендерировании монолитных мостных конструкций výpočet betonu = критическая cesta. Vše ostatní paralelní/následuje. Tento insight definuje **proč** kalkulátor je strategický, ne nice-to-have.

### 4.2 Skruž vs stojky (often confused)

- Bridge element → vždy **skruž** (50-100+ ton, heavy shoring towers)
- Building → **stojky** (<50 kN, light props)
- Height >5m → skruž
- Load >50 kN → skruž

### 4.3 Spáry — dilatační vs pracovní

- **Dilatační** — permanent structural joint
- **Pracovní** — temporary construction joint
- **NEKONFUZIT**

### 4.4 OTSKP routing vs ÚRS

- **Veřejná zakázka (ZZVZ)** → OTSKP primary
- **Privátní (hk212, Libuše)** → ÚRS primary, OTSKP irrelevant
- **D&B (Žihle)** → ÚRS + OTSKP columns

### 4.5 Rebar h/t — opravená matice (v4.24)

| Element | Default | h/t (D12) |
|---|---|---|
| Walls | D12 | 17.3 |
| Slabs | D12 | 16.3 |
| Beams/Cols | D12 | 22.4 |
| Stairs | D12 | 20.4 |
| Stirrups D6-12 | — | 30 |

### 4.6 Pour crew formula v4.24 — co bylo opraveno

- Management (+3 řízení) **REMOVED** — patří do ZS/VRN 3-5% per ČSN 73 0212
- Volume-scaled crew sizing
- Night shift §116 ZP +10%
- MEGA formula: `n_pump×2 + ceil(n×1.5) + ceil(n×1.0)`

---

## 5. Корпусные находки (N=5 corpus patterns)

### 5.1 N=5 RD JÁCHYMOV (18.05.2026)

Hybrid DSP/DPS (DPS-grade DXF v DSP-contracted). 189 items, **9 corpus patterns:**

1. `file_swap` — vendor podstrčil jiný soubor než avizoval
2. `tz_validator_iter` — iterativní validace TZ
3. `multi_view_items` — totéž v různých výkresech
4. `_gate ≠ kapitola` — gates v workflow != kapitoly v TZ
5. `exhaustive_dxf_5tier` — DXF parsing 5-tier strategy
6. `embedded_table_mtext` — `^I` encoding v MTEXT
7. `honest_fallback` — superseded by #8
8. `completeness_audit_mandatory` — Phase 0a v CLAUDE.md
9. `iterative_layer_probe_gaps` — **ANTI-PATTERN** (neopakovat)

Path C: 89% → 100% DXF coverage. Dual catalog discovered: URS201801 (39741) + TSKP (11994). Subdod v1.2.

### 5.2 N=5 corpus aggregate

5 cases:
1. VP4 FORESTINA (operná zeď)
2. SO-202 D6 (most)
3. SO-250 D6 Žalmanov
4. Bytový soubor Libuše
5. SO-220 biokoridor (+ RD Jáchymov hybrid)

Confirms: BOQ structure identical across CZ/DE/AT/ES/FR — only catalog codes + norms + doc formats differ. **4-layer KB viable** (Core universal → Regional CZ/SK/DE.yaml → Empirical → AI fallback).

### 5.3 Libuše cross-objekt detection

Check 'z místnosti č.' a 'do místnosti č.' columns ve všech Tabulkách s multi-objekt scope. Prefix mapping: S.A.\* → A, S.B.\* → B, S.C.\* → C, S.D.\* → D. Regen chain order: phase_7a → phase_6 → phase_8 → phase_0_20.

### 5.4 PROBE findings (Libuše)

- **PROBE 14f** — 8 PSV-768 vrata items deprecated (belong to objekt C, ~130-230k Kč mis-attributed)
- **PROBE 14g** — List 11 regenerated (3,128 → 4,845 rows, 579 → 754 groups)

### 5.5 hk212 critical discovery

**VYJASNĚNÍ #17:** TZ claims 32 m³ výkopů vs DXF-calculated **~341.8 m³** (~130k Kč impact). Cross-document validation rule needed.

---

## 6. Key learnings (process / meta)

### 6.1 Claude Code task writing rule (CRITICAL)

> **Nikdy nespecifikuj jména proměnných, souborů, tříd nebo tabulek.**
>
> Popisuj CO se má stát v termínech business logiky + architektury.
> Claude Code odvodí naming z existujících repo konvencí.

Violation = parallel structure = naming spaghetti. Viz `docs/steering/conventions.md` §9.

### 6.2 Data corpus is the bottleneck, not math

Priority **collect 5-10 real projects** before applying advanced statistical methods:
- Bayesian updating (~50h) — skip until corpus
- Sensitivity analysis PERT (~25h) — skip until corpus
- PySR symbolic regression (~40h) — skip until corpus
- Neural nets, RL, quantum — **not worth it** at current data volume

### 6.3 Branch protection workflow

- Branch protection **stays enabled** на main
- GitHub Action `prerender.yml` blocked by `protect-main` ruleset
- **Correct workflow:**
  1. Lokálně `npm run build`
  2. Zkopírovat 4 HTML soubory z `dist/` do `public/prerendered/`
  3. Include in same PR as source changes

### 6.4 Když Claude Code timeout na large file

Split na sub-tasks <170 řádků nebo by gate (Gate 0 scan-only → Gate 1 format findings). Output findings as plain chat text as fallback.

### 6.5 Scope expansion pattern

Александр consistently overrides scope reduction recommendations. Claude names pattern explicitly each time before complying.

### 6.6 Session structure (proven)

1. Drop task .md file into repo
2. Start Claude Code agent session with direct "read and execute" instruction
3. Audit task naming: `TASK_[DOMAIN]_[Scope].md`, nested under `docs/audit/` (now `docs/specs/`)

### 6.7 Decision style

- Quick decisions when options presented as numbered choices
- Sequential PRs preferred over parallel
- Russian primary, Czech terminology throughout codebase
- Voice-to-text artifacts common
- ALL CAPS = emphasis/frustration

---

## 7. External relationships (active)

### 7.1 Cemex CSC 2026

- **Deadline:** 28.06.2026 application
- **Pitch days:** APAC 02.09.2026 (Singapore), Top 30 announce 01.10.2026, Las Vegas 09-11.11, Helsinki 16-19.11
- **Target:** Helsinki (realistic, European pitch day)
- **Partners to watch:** Ferrovial, VINCI Leonard, Hilti (DACH formwork), Trimble (BIM)

### 7.2 Alice Technologies

- **Status:** Outreach к René Morkos drafted, ne sent yet
- **Strategy:** Complementary, ne competitive. STAVAGENT generates engineering inputs, Alice optimizes schedules across them.
- **Outcome regardless:** Strategic partnership v conversation slide v pitch deck

### 7.3 Google for Startups Cloud

- **Status:** Application submitted via postmaster@stavagent.cz (2026-05-13)
- **Waiting:** 3-5 business days response
- **Credits target:** Billing Account `01587B-BEBC6E-418C29`
- **Active constraint during review:** Don't touch production stavagent.cz, don't modify LinkedIn, check postmaster@ daily

### 7.4 VELTON (Libuše freelance)

- Confidentiality strict — VELTON name never mentioned externally
- Libuše geometry used as engine calibration only
- 4,090 items, 13 sheets, akce 185-01

### 7.5 Berger Bohemia (current employer)

- Personal-time disclaimer obligatorní na /team a v LinkedIn About
- Berger not mentioned by name on landing
- If asked: "tool for my own daily problem, personal time, no company resources"

---

## 8. Strategic context (ne lehkomyslně měnit)

### 8.1 International brand

- `stavagent.cz` = Czech/SK wedge brand
- International brand needed for DACH/EU expansion (separate registration)
- Candidates: PourPlan / TaktCast / MonoPlan / TBD
- **Insight:** DIN 18218 already canonical → DACH expansion = catalog + language, NOT engine rewrite

### 8.2 Pitch reframe (W3 deliverable)

**Old pitch:** "AI co-pilot for Czech construction estimators"
**New pitch:** "Engineering calculation layer for construction with triple access (UI / MCP / Agent API). DIN 18218, Saul, RCPSP. Konkurenti dělají document parsing (Aitenders), takeoff (Togal), scheduling optimization (Alice) — žádný nedělá engineering calculations."

### 8.3 EU AI Act compliance

- Risk classification: **Limited risk** (transparency only)
- NOT v Annex III high-risk categories
- STAVAGENT = **deployer of GPAI** (Vertex/Bedrock/Perplexity), NE provider
- TODO до konce května: transparency banner v UI, privacy policy update, AI literacy doc, human-in-the-loop, DPAs

---

## 9. Session log

> Each session adds a section here. Format:
> `## YYYY-MM-DD — Session: {topic}` + Rozhodnuto / Odmítnuto / Otevřené otázky / Co dál

---

### 2026-05-19 — Session: Landing CTA + CZ/EN terminology + prerender hash drift

**Topic:** Tři navazující landing-page PRs uzavřené v jedné session: #1136 (CTA route fix + manual prerender), #1138/#1183 (CZ/EN terminology audit + prerender hash drift fix). Začalo CTA "Vyzkoušet zdarma" → /register redirectem na /, skončilo production "buttons don't work" emergency po merge — root cause hash drift mezi committed snapshotem a vite-buildem.

**Rozhodnuto:**
- CTA "Vyzkoušet zdarma" routes unauthenticated users na `/login` (ne `/register`). `/register` redirectuje na `/` (separátní bug, P2, workaround logován v `BACKLOG.md` jako `register-route-redirect`). Login page má funkční odkaz "Nemáte účet? Zaregistrujte se" na registrační formulář.
- CZ terminologie cleanup v `LandingPage.tsx` + meta description: `smeta/smety/smetu/smety` → `rozpočet/rozpočtu/Rozpočet/Rozpočty` (Russian/Slovak loan); `bětonpumpa/bětonpumpy` → `čerpadlo betonu/čerpadla betonu`; `kran/kranu` → `jeřáb/jeřábu` (Germanism); `mechanizmy` → `stroje`. Aplikováno taky na strukturované `tov:` karty (unicode-escaped bloky).
- EN landing cleanup (`LandingPageEn.tsx`): odstraněny CZ glossary parentézy `(takty)` + `(betonáž)` v popiscích; module title `Klasifikátor stavebních prací` → `Klasifikátor — construction works classifier`; `Kalkulátor betonáže` → `Kalkulátor — concrete works calculator` (4 výskyty: module title + HowItWorks step 3 + FAQ entry + footer products list); bullety `Detail prvku` / `Plán objektu` → `Single-element detail` / `Whole-object plan`.
- **Prerender hash drift fix v `scripts/prerender.mjs`** — `applySnapshotIfPresent()` přepsáno: před copy snapshot → dist čte fresh `dist/index.html` vyrobený vite, extrahuje `/assets/*.{js,css}` list, a graft-replacuje stale references v snapshot HTML na fresh hashe match-by-name-prefix (`index-OLD.js` → `index-NEW.js`, `chunk-AAA-OLD.js` → `chunk-AAA-NEW.js`). No-op pokud hashe už shodné (happy local case). Verified injekce fake hashů + simulovaný build emituje rewrite log lines.
- Manual prerender regenerace (4 HTML soubory v `public/prerendered/`) zaházena do stejné PR jako source edits — workaround pro `prerender.yml` GitHub Action blokovaný `protect-main` branch protection (user preferuje nechat protection enabled).

**Odmítnuto:**
- Investigation root cause `/register` redirectu na `/` — separátní bug, workaround postačuje. Pravděpodobně auth-guard inverze v `App.tsx`, ale out of scope této session.
- Update `og:description` + `twitter:description` meta tagů ve `index.html` — pořád obsahují "přípraváře monolitů". Copy decision, ne technical, vyžaduje strategický kontext.
- Disable `SKIP_PRERENDER=1` na Vercelu pro forced full Puppeteer prerender — Vercel build container chybí GUI libs (libnss3, libxss1, libasound2) které Chromium dynamicky linkuje.
- Odstranění prerender snapshot systému úplně — ztratil by SEO prerender benefit (Google by viděl prázdný `<div id="root">`).
- Deterministic / stable filename mode v `vite.config.ts` (no content hash) — defeats cache busting.
- Rebuild brigády → čety přejmenování v `LandingPage.tsx:236` ("Brigada: 4 lidé + 2 čerpadla" v structured card) per CLAUDE.md "Čety, ne Brigády" rule — out of session scope.

**Otevřené otázky:**
- Měly by `og:description` + `twitter:description` být aktualizovány aby matchovaly nový "stavby" subtitle? Copy decision pro brand-konzistenci.
- Měl by `kalkulator.stavagent.cz` brand title (a footer list) napříč všemi 3 moduly přejít na `Kalkulátor` bez `betonáže` qualifier? Footer list už používá zjednodušený název post-cleanup, ale konzistence v jiných místech rozdrobená.
- Bude prerender hash drift fix ovlivněn pokud Vercel přidá `<link rel="preload" as="font">` nebo jiné non-asset references v budoucnu? Aktuální regex `\/assets\/([^"'\s>)]+\.(?:js|css))` je narrowly scoped na js/css — bezpečné.
- "Smeta" jako Russian loan acceptable v Czech construction context (běžně se používá)? Některé tooltips/comment by mohli zůstat s "smeta" pokud je to colloquial-OK. Konzervativně jsem nahradil všude.

**Co dál:**
- Sledovat next deploy main na Vercel — pokud hash drift opravdu nastává, build log by měl ukázat `[prerender] index.html: index-X.js → index-Y.js` lines.
- User verification v incognito: 6 kroků (hard refresh → subtitle "stavby" → klik "Vyzkoušet zdarma" → /login → "Zaregistrujte se" link → registrace). Po úspěchu → Google Cloud for Startups re-aplikace.
- Investigovat `/register` redirect root cause a optionally restore goCta na `/register` pro cleaner UX (separátní task).
- Rozhodnout o `Brigada` → `Četa` cleanup v landing structured cards.
- Audit pre-existing meta tagů (og/twitter description, twitter alt) pro coherentní subtitle messaging.

---

### 2026-05-19 — Session: CLAUDE.md SDD integration

**Topic:** Integrate `docs/steering/` + `docs/soul.md` workflow do root `CLAUDE.md` (handoff `docs/handoff/2026-05-19-claude-md-sdd.md`).

**Rozhodnuto:**
- Hlavička: `Version: 4.31.0 → 4.32.0`, `Last Updated: 2026-05-18 → 2026-05-19`.
- Přidána nová sekce `## 🚨 Mandatory reading at session start` mezi `**Repository:**` a `English TL;DR` blok — explicit pořadí 6 souborů (conventions → product → tech → structure → domain → soul) + povinný session-log template.
- Sekce `## 📐 Calculator Philosophy (POVINNÉ ČTENÍ)` — active reference přepnut z `docs/CALCULATOR_PHILOSOPHY.md` na `docs/steering/domain.md §1`. Starý path zůstává pouze v deprecation note s datem.
- Přidána nová sekce `## 📋 Workflow discipline (Spec-Driven Development)` mezi adaptive-thinking poznámku a `Key rules:` blok — hybridní model online/Code, životní cykly feature/bug, mapa "co update v jakém steering souboru", task-writing pravidla.
- Nový changelog entry v4.32.0 vložen na začátek seznamu (před v4.31.0). Všechny v4.24-v4.31 entries zachovány beze změny (Krit. 6 verified).
- 5 commits, jeden Gate = jeden commit, žádný rewrite, vše přes `Edit` str_replace.

**Odmítnuto:**
- Rewrite CLAUDE.md from scratch (per task §7).
- Cleanup historických changelog entries (per task §7).
- Trim CLAUDE.md k 300-line limitu (separátní follow-up taska).
- Update per-service CLAUDE.md souborů (`concrete-agent/CLAUDE.md`, `Monolit-Planner/CLAUDE.MD`).

**Otevřené otázky:**
- Žádné — všechny edits byly mechanické per task §3.

**Co dál:**
- Patch `docs/steering/conventions.md` s pravidlem "Před `git mv` vždy zkontroluj SHA-256 zda target neexistuje" (Alexandr explicitně přislíbil v G.1 odpovědi).
- Separátní taska: trim CLAUDE.md na 300 řádků (currently 700+, mimo vlastní limit).
- Per-service CLAUDE.md soubory (concrete-agent, Monolit-Planner) — případně i tam přidat SDD mandatory-reading block, ale separate scope.

---

### 2026-05-19 — Session: Orphaned files & data/ cleanup

**Topic:** Cleanup 13 orphaned souborů v root repa + `data/peri-pdfs/` reorganizace (handoff in-conversation).

**Rozhodnuto:**
- 9 RD Jáchymov PDF + 4 hk212 DXF v root = **byte-identické duplikáty** existujících souborů v `test-data/{project}/inputs/{dokladova_cast,vykresy_dxf}/` (SHA-256 verified). Smazány `git rm` místo `git mv` — task §6.1/§6.2 navrhoval move do nového subfolderu, ale kanonická destinace už existovala (move by vytvořil třetí kopii).
- 3 soubory z `data/peri-pdfs/` přesunuty `git mv` (historie zachována):
  - `formwork_catalog_PERI_DOKA_2025.md` → `docs/reference/formwork_catalog_2025.md` (sjednocení se steering cheat-sheet)
  - `parse_peri_pdfs.py` → `scripts/parse_peri_pdfs.py`
  - `rimsa_element_spec_v2_DOKA_PERI.md` → `docs/specs/element/rimsa-v2-doka-peri.md` (single file, ne split — polished doménová reference, ne implementační spec)
- `data/` složka odstraněna (`rmdir`).
- `docs/steering/structure.md` §5 doplněn o zákaz orphaned root souborů + ad-hoc `data/` (verze bump 1.0 → 1.1).
- Classification report: `docs/handoff/2026-05-19-orphaned-files-classification.md`.

**Odmítnuto:**
- Vytváření `test-data/RD_Jachymov_dum/stavebni_povoleni/` a `test-data/hk212_hala/dxf/` (per task §6.1/§6.2 návrh) — kanonická lokace `inputs/dokladova_cast/` a `inputs/vykresy_dxf/` už existuje.
- Split `rimsa_element_spec_v2_DOKA_PERI.md` do req/design/tasks (per task §6.3.1 fallback — split až při aktivním rozpracování).
- Update stale `data/peri-pdfs/` odkazů v 10 audit/inventory dokumentech (per task §8 out-of-scope — audit docs = snapshot in time).
- Gate 5 (`test-data/_orphaned/`) — žádné neidentifikovatelné soubory.

**Otevřené otázky:**
- Konfirmace deviace `git rm` vs `git mv` pro Gate 2/3 (G.1 z classification reportu).
- Stale markdown references na `data/peri-pdfs/` v audit dokumentech — ponechat snapshot, nebo follow-up `chore/docs-fix-stale-peri-paths`?

**Co dál:**
- TASK: `docs/normy/` → `app/knowledge_base/B7_regulations/` (66 MB doménová data, per docs-audit findings §D.6)
- TASK: `docs/bugs/aplikovat-timeout/` real content fill z Project Knowledge (per task §8 mimo scope)
- TASK: `docs/{architecture,audits,competitive}/` → `docs/reference/` (per docs-audit findings §D.7 migration map)
- TASK: vyřízení 5 open questions z předchozí audit session (docs-audit-findings §F)

---

### 2026-05-19 — Session: Docs structure audit

**Topic:** Inventory aktuální struktury `docs/` proti steering plánu (handoff `docs/docs/handoff/2026-05-19-docs-audit.md`).

**Rozhodnuto:**
- 5 chybějících šablon dovytvořeno: `_TEMPLATE_spec/{design,tasks}.md` (autorské, mirror requirements.md stylu) + `_TEMPLATE_bug/{analyze,fix,verify}.md` (kopie z `bugs/aplikovat-timeout/` které slouží jako kanonická šablona).
- 4 prázdné `1` placeholdery od GitHub web UI smazány (`docs/templates/1`, `docs/templates/_TEMPLATE_bug/1`, `docs/templates/_TEMPLATE_spec/1`, `docs/bugs/aplikovat-timeout/1`).
- Findings report uložen na `docs/handoff/2026-05-19-docs-audit-findings.md` (sekce A–F per task §6).
- Migration map pre-existing folders (architecture/, audits/, competitive/, normy/) navržena, ale **nic se nemigrovalo** — separátní taska.

**Odmítnuto:**
- Migrace `docs/architecture/`, `docs/audits/`, `docs/competitive/`, `docs/normy/` — out of scope (per task §4 a §8). Pouze inventory + doporučení do reportu §D.
- Audit obsahu `docs/bugs/aplikovat-timeout/` souborů (per task §3.6 — řeší samostatná taska).
- Otevírat PR (per task §8 no-PR-unless-asked policy).

**Otevřené otázky:**
- Misnested `docs/docs/handoff/2026-05-19-docs-audit.md` — přesunout do `docs/handoff/`?
- Duplikát `CALCULATOR_PHILOSOPHY.md` (root vs `normy/navody/`) — která je kanonická?
- Branch name mismatch: task říká `chore/docs-structure-audit`, session-level pinuje `claude/docs-audit-2026-05-19-0G3lF` — použit druhý.
- Kdy spustit migraci pre-existing folders (architecture/, audits/, normy/, competitive/) do nové struktury?
- Cleanup deadline 2026-07-29 (Gate 2 leftover) — vztah k novému workflow?

**Co dál:**
- Reakce Alexandra na otevřené otázky F.1–F.5 z findings reportu.
- Samostatná taska `chore/docs-migrate-pre-existing-folders` (per §D.7 mapy).
- Pilot specs (`cross-user-isolation/`, `mcp-policy-engine/`) teď mají kompletní šablony k použití.

---

### 2026-05-19 — Session: SDD workflow setup

**Topic:** Spec-Driven Development + persistent memory workflow для STAVAGENT, with constraint that work is online claude.ai (no terminal access at work, firewall blocks).

**Rozhodnuto:**
- Adopt SDD pattern: `docs/steering/` + `docs/specs/{name}/{req,design,tasks}.md` + `docs/bugs/{id}/{report,analyze,fix,verify}.md`
- Soul.md jako Project Knowledge artifact (ne MCP server) — fungue v claude.ai online
- Hybrid workflow: claude.ai = planning/specs/specs creation, Claude Code (doma) = implementation, Git = bridge
- 4 steering docs: product / tech / structure / domain (+ conventions as 5th)
- Templates pro spec (3 souboru) + bug (4 souboru)
- Audit existujících TASK_*.md → re-classify do `docs/specs/`, `docs/bugs/`, `docs/reference/`, `docs/handoff/`

**Odmítnuto:**
- Local MCP memory servers (mem0, Qdrant, Ollama) — nefungují přes firewall na práci
- Pimzino claude-code-spec-workflow npm package — vyžaduje terminal
- MemCP / claude-memory-mcp — local-only, ne použitelné na práci

**Otevřené otázky:**
- Kdy spustit migraci TASK_*.md → docs/specs/? (návrh: postupně, po PR)
- Soul.md velký vs malý — limit length nebo nech růst? (návrh: split po měsících, archive starší sekce do `docs/handoff/`)
- Cleanup deadline 2026-07-29 (Gate 2 leftover) — jak se to vztahuje k novému workflow?

**Co dál:**
1. User zacommit těchto 4 steering + soul + templates + audit do `docs/` přes GitHub web UI
2. První pilotní spec: `docs/specs/cross-user-isolation/` (P0, před Cemex)
3. Druhý pilotní spec: `docs/specs/mcp-policy-engine/` (Cemex)
4. Až bude pilot fungovat → batch migrace ostatních TASK_*.md

---

## 10. Document metadata

| Field | Value |
|---|---|
| Initialized | 19.05.2026 |
| Version | 1.0 (initial) |
| Maintained by | Alexander Prokopov + Claude sessions |
| Update frequency | After each significant session |
| Read at start of | Every Claude session (online + Claude Code) |
| Storage | Both: `docs/soul.md` in repo + Project Knowledge (synced manually) |

---

**End of soul.md.**
