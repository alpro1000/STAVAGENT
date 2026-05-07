# AUDIT_REPORT_landing_v3.md

**Audit phase:** Phase 0 (pre-implementation inventory) per `Landing Page v3.2` task spec, §0.
**Audit date:** 2026-05-07
**Audit branch:** `claude/landing-v3-audit-reposition-fUsiv`
**Audit author:** Claude Code (read-only, code-level analysis)
**Audit mode:** Manual approval (per pre-implementation interview answer §8 Q1) — no code changes will be made until you sign off on this report.

---

## 0. Audit metadata

### 0.1 Method

Five parallel read-only Explore subagents covered A.1–A.10 from the v3.2 spec §0. Findings were ground-truth-verified against the actual files for every line cited in §2 (Critical findings). Where two sub-audits returned conflicting claims, the conflict is reconciled inline in §11.

### 0.2 Limitations

- **No live browser walkthrough.** I have no live access to `klasifikator.stavagent.cz`, `registry.stavagent.cz`, `kalkulator.stavagent.cz`, or `www.stavagent.cz`. All "live UI audit" findings (A.2, A.3, A.4) are derived from the React/HTML source. Tooltips, runtime toasts, error states injected by the backend, and any text rendered conditionally from API responses are not visible to a code-level audit. **Recommendation:** before merging the v3.2 PR, do a one-pass manual click-through of each kiosk and amend this report.
- **No browser DevTools.** I cannot inspect the actual `<head>` of the production HTML (post-Vite build), so all SEO findings (A.6) are based on the source `index.html` files. If Vite or a Vercel header injects anything at build/edge time, it isn't captured here.
- **No GitHub.com surface.** Repository description and topics on github.com are not files in the repo and are not audited here. Add a separate item to the implementation plan to update them via the GitHub API after the PR ships.
- **No Lemon Squeezy / Stripe dashboard access.** Product names visible in those dashboards are out of scope.

### 0.3 What this audit produces

1. A **catalog of every place** an old/divergent module name appears (§3, §4, §5, §9).
2. A **classification per finding**: `rename` / `keep` / `investigate` / `infra-only`.
3. **Reconciliation** of three conflicts between sub-audits (§11).
4. **Spec-vs-reality divergences** (§12) — places where the v3.2 spec assumes something that the code doesn't actually do.
5. **Blast-radius warnings** for renames that touch API contracts, DB seeds, or shared services (§13).
6. **A list of open questions** that gate the implementation phase (§14).

---

## 1. Executive summary

### 1.1 Health check vs v3.2 spec

| v3.2 expectation | Reality | Gap severity |
|---|---|---|
| Landing has 5 modules; reduce to 4 + 1 "v přípravě" | Landing has 5 modules in `MODULES` array; Portal has **13** services (4 active + 9 coming_soon) | **Medium** — landing is straightforward; Portal sidebar needs a separate decision |
| Klasifikátor catalog dropdown shows "Online databáze / OTSKP / Oba katalogy" | Confirmed at `index.html:197–199` | **High legal risk** — confirmed |
| ÚRS not in user-facing UI | **Leaks in 8 places** in Klasifikátor `app.js` (column headers + export text) and 1 place in Portal (`VerifyEmailPage.tsx:149`) | **High legal risk** |
| og:image present | **Missing in all 4 frontends** | **Medium SEO** |
| Lemon Squeezy products | **Portal uses Stripe**, not Lemon Squeezy. CLAUDE.md mention is for an unbuilt MCP webhook | **Spec error** — re-scope §A.8 of v3.2 |
| DebugCollector instrumented | **Component does not exist** anywhere in the repo | **Spec error** — re-scope §12 of v3.2 |
| "Kalkulátor monolitu" canonical | Code uses `"Kalkulátor betonáže"` (CLAUDE.md:315 mandates it as the canonical name) | **Spec divergence** — needs your call (§14 Q-D) |
| Documentation aligned with canonical names | CLAUDE.md, README.md, and per-service emails diverge in ~12 places | **Low–Medium** |
| Modul 4 (Analýza dokumentace) "v přípravě" | `DocumentAnalysisPage.tsx` is **fully implemented and routable**, but `PortalPage.tsx:108` flags it `status: 'coming_soon'` | **Spec divergence** — needs your call (§14 Q-A) |
| Confidence "AI never 100%" enforced | **Not enforced** in any kiosk frontend; backend can return 1.0 and UI renders 100% | **Low–Medium** — bug, but separable from the landing PR |

### 1.2 Estimated implementation scope (post-audit)

After audit, the v3.2 implementation breaks down approximately as:

| Bucket | Files | Lines changed (est.) | Risk |
|---|---|---|---|
| Landing page rewrite (§6.1–6.12 of v3.2) | 1 (`LandingPage.tsx`) + 1 (`index.html` SEO) | ~400 lines edited, ~300 net new | Low |
| Klasifikátor public-facing rename (Gate 2) | 2 (`URS_MATCHER_SERVICE/frontend/public/index.html`, `app.js`) | ~12 string edits | Low |
| Portal `VerifyEmailPage.tsx` URS leakage fix | 1 file, 1 line | 1-line edit | Low |
| Portal services array consolidation (5 → 4) | 1 (`PortalPage.tsx`) | ~30 lines | **Medium** — drives Portal nav, may need DocumentAnalysisPage state decision |
| `schema-postgres.sql` service-registry seeds (Klasifikátor description rename) | 1 file, 2 rows | 2-row seed update + migration to update existing prod rows | **Medium** — DB migration |
| Email-template branding (Monolit-Planner own emailService.js) | 1 file (or delete if dead code) | TBD pending wiring check | **Low** if dead, **Medium** if live |
| Documentation (CLAUDE.md, README.md, per-service docs) | ~6 files | ~20 lines | Low |
| og:image creation (1200×630 PNG) | 1 new asset + index.html edit | 1 file + 8-line edit | Low (design effort lives outside repo) |
| Modul 4 lead-gen form (POST endpoint + storage) | 1 frontend component + 1 backend route + 1 DB column | ~120 LOC + 1 migration | **Medium** — new feature |
| Workflow diagram SVG (replaces `JAK TO FUNGUJE`) | 1 inline SVG component | ~80 LOC | Low |
| FORESTINA real example (replaces synthetic) | Inline edit in `LandingPage.tsx` | ~30 lines | Low |
| Prerender plugin (Gate 4) | `vite.config.ts` + plugin install | ~10 LOC + dependency | **Low–Medium** depending on Vercel build behavior |
| **Total** | **~12 files** | **~900 LOC edited** | Mixed; medium-risk hotspots are PortalPage consolidation + DB seed migration + lead-gen form |

**Out of scope for this PR (per pre-implementation interview):**
- `URS_MATCHER_SERVICE` rename to a neutral name — separate PR (Q3 answer).
- Deep visual QA / live browser walkthrough — needs human eyes.

---

## 2. Critical findings — must-do for this PR

These are the items that v3.2 Gate 0–9 acceptance criteria depend on, with verified file:line evidence.

### 2.1 Klasifikátor catalog dropdown (Gate 2 — legal risk)

`URS_MATCHER_SERVICE/frontend/public/index.html`:

```
196:                  <select id="batchCatalog">
197:                    <option value="urs" selected>Online databáze</option>
198:                    <option value="otskp">OTSKP (lokální)</option>
199:                    <option value="both">Oba katalogy</option>
```

**Action:**
- Line 197 label `"Online databáze"` → `"AI vyhledávání"` (keep `value="urs"` — internal API, no consumer impact).
- Line 198 label `"OTSKP (lokální)"` → keep as-is.
- Line 199 label `"Oba katalogy"` → `"OTSKP + AI vyhledávání"`.

The `value="urs"` attribute is internal — it submits to backend routes that haven't been renamed (separate PR per Q3 of interview).

### 2.2 Klasifikátor public-facing ÚRS leakage (Gate 2 — legal risk)

`URS_MATCHER_SERVICE/frontend/public/app.js`:

```
 658:        <th>Kód ÚRS</th>
 963:      html += '<th>Řádek</th><th>Vstupní text</th><th>Kód ÚRS</th>...';
1079:      csv += 'Typ;Kód ÚRS;Název;MJ;Jistota (%);Důvod\n';
1094:      csv += 'Blok;Řádek;Vstupní text;Kód ÚRS;Název;MJ\n';
1103:      csv += 'Řádek;Vstupní text;Kód ÚRS;Název;MJ;Množství;Jistota;Typ\n';
1133:    let text = 'Výsledky hledání ÚRS\n';
1142:      text += '🎯 DOPORUČENÉ POZICE ÚRS:\n';
```

**Action:** Replace `"ÚRS"` with neutral catalog terminology. Recommended substitutions:

| Old | New |
|---|---|
| `Kód ÚRS` (column header) | `Kód` (the surrounding context already establishes it's a code; or `Kód položky` if more disambiguation is wanted) |
| `Výsledky hledání ÚRS` (export title) | `Výsledky vyhledávání` |
| `🎯 DOPORUČENÉ POZICE ÚRS:` (export heading) | `🎯 Doporučené pozice` |

This is **8 string edits** in `app.js` plus the 2 in `index.html` from §2.1 — total **10 edits** to close the legal risk in Klasifikátor.

### 2.3 Portal email page URS leakage

`stavagent-portal/frontend/src/pages/VerifyEmailPage.tsx:149`:

```tsx
<span style={{ fontSize: 13, color: '#276749' }}>Kalkulátor betonáže, URS klasifikace</span>
```

This is rendered on the email-verification-success screen as a list of "what you can do now". `URS klasifikace` is public-facing.

**Action:** Replace `"Kalkulátor betonáže, URS klasifikace"` with the new canonical short list, e.g. `"Kalkulátor, Klasifikátor, Registr"` (or `"Kalkulátor, Klasifikátor, Registr, Analýza dokumentace"` if Modul 4 stays in scope).

### 2.4 Portal services array — consolidation (5 → 4)

`stavagent-portal/frontend/src/pages/PortalPage.tsx:65–183` defines 13 services. The 4 active ones today:

| Line | name | url | status |
|---|---|---|---|
| 67 | `'Monolit Planner'` | `https://kalkulator.stavagent.cz` | `active` |
| 76 | `'Kalkulátor betonáže'` | `https://kalkulator.stavagent.cz/planner` | `active` |
| 85 | `'Klasifikátor stavebních prací'` | `https://klasifikator.stavagent.cz` | `active` |
| 94 | `'Registr Rozpočtů'` | `https://registry.stavagent.cz` | `active` |
| 104 | `'Analýza dokumentů'` | `#document-analysis` | `coming_soon` |

Plus 8 more `coming_soon` services (Analýza výkresů, Objednávka betonu, Kalkulačka čerpadel, Ceníky dodavatelů, Generátor výkazu výměr, Kalkulačka bednění, Plánovač zemních prací, Optimalizátor výztuže) at lines 113–183.

**Issue:** v3.2 §2 says "**4 modules + 1 v přípravě**" (Registr / Klasifikátor / Kalkulátor / Analýza dokumentace). But Portal has:
1. Two separate Kalkulátor entries (`Monolit Planner` at `/` AND `Kalkulátor betonáže` at `/planner`) — v3.2 says merge.
2. `Analýza dokumentů` marked `coming_soon` even though `DocumentAnalysisPage.tsx` is implemented and routable at `/portal/analysis` (see §5.6).
3. Eight extra `coming_soon` services that aren't on the v3.2 roadmap at all.

**Action:** Open question Q-A in §14. The simplest reconciliation is:
- Merge the two Kalkulátor entries into one with two CTA buttons (`Detail prvku` → `/planner`, `Plán objektu` → `/`).
- Decide whether `Analýza dokumentů` is "live" (set `status: 'active'`, route to `/portal/analysis`) or "v přípravě" (keep `coming_soon`, route to a lead-gen form).
- Decide what to do with the 8 other coming_soon services — keep them as long-tail "v přípravě" cards, or hide them from the v3.2 layout entirely.

### 2.5 LandingPage MODULES array restructuring

`stavagent-portal/frontend/src/pages/LandingPage.tsx:90–123` — 5 module entries.

| # | LandingPage line | title (current) | v3.2 action |
|---|---|---|---|
| 1 | 92 | `'Registr rozpočtů'` | **Rewrite description** to emphasize TOV (lidé/mechanizmy/materiály) + Bětonpumpa/Doprava/Kran calculators; canonical H3 may be just `'Registr — pracovní rozbor smety'` per spec §3. |
| 2 | 98 | `'AI analýza stavební dokumentace'` | **Keep H3** (canonical match). Replace `note` text "Brzy k dispozici" → "V přípravě — early access list otevřený". Replace `cta: 'Brzy k dispozici'` → `'Přidat se do early access'` + lead-gen form. |
| 3 | 105 | `'Párování s kataložními kódy'` | **RENAME** to `'Klasifikátor stavebních prací'`. Remove `note` text "Aktuálně podporuje OTSKP databázi… Další katalogy připravujeme" (the "Další katalogy" hint is risky — could imply ÚRS roadmap). |
| 4 | 112 | `'Kalkulátor betonáže'` | **DECISION POINT**: keep `'Kalkulátor betonáže'` (current canonical per CLAUDE.md:315) OR rename to `'Kalkulátor monolitu'` (v3.2 spec §3). See Q-D in §14. Description must surface the **two modes** (Detail prvku / Plán objektu). |
| 5 | 118 | `'Monolit Planner — plánování monolitických prací'` | **DELETE this entire entry.** Per v3.2 §2, Modul 5 is folded into Modul 3 as the "Plán objektu" mode. |

After the change, the array has 4 entries (or 5 if you keep Modul 5 hidden but still count it for ordering — but the rendered count needs to be 4 or 4+1).

**Subtitle update** at line 284: `"Pět modulů, které pokrývají celý proces"` → `"Čtyři propojené nástroje pro celý workflow přípraváře"`.

### 2.6 LandingPage FAQ — KROS removal (Gate 2)

`stavagent-portal/frontend/src/pages/LandingPage.tsx:160`:

```tsx
{ q: 'Mohu exportovat do KROS?', a: 'Výstup je Excel (.xlsx) kompatibilní s KROS importem...' },
```

**Action:** Delete this FAQ entry. v3.2 spec §6.10 says replace with: *"Mohu výstup importovat zpět do své stávající aplikace?"* with a generic Excel-export answer.

### 2.7 LandingPage Footer module list

`stavagent-portal/frontend/src/pages/LandingPage.tsx:597`:

```tsx
{['Registr rozpočtů', 'Analýza dokumentů', 'Kataložní kódy', 'Kalkulátor', 'Monolit Planner'].map(...)}
```

5 entries with naming inconsistent with the MODULES array above. **Action:** sync with the (newly) 4-entry MODULES array, e.g. `['Registr', 'Klasifikátor', 'Kalkulátor', 'Analýza dokumentace (v přípravě)']`.

### 2.8 LandingPage Pricing table — operation names

`stavagent-portal/frontend/src/pages/LandingPage.tsx:137–153`:

| Line | name (current) | Action |
|---|---|---|
| 143 | `'Párování kataložních kódů'` | Rename to `'AI klasifikace pozic'` (matches new Klasifikátor module name + matches `schema-postgres.sql:747` op name once it's also renamed). |
| 144 | `'Klasifikace položek'` | Rename to `'Klasifikace do skupin (Registr)'` to disambiguate from #143. |
| 145 | `'Kalkulace monolitu'` | If we adopt `Kalkulátor monolitu` per v3.2 §3, this label is fine. If we keep `Kalkulátor betonáže`, rename to `'Kalkulace prvku'`. (Tied to Q-D.) |

Plus a related concern at the operation level: `schema-postgres.sql:747`:

```sql
(gen_random_uuid(), 'urs_match', 'URS párování', 'AI párování položek na URS kódy', 8, true, 7),
```

If this powers a credits/billing UI in the cabinet (likely), `'URS párování'` and `'…na URS kódy'` need to be renamed in DB seeds + a migration to update existing rows.

### 2.9 LandingPage SEO — `index.html` head

`stavagent-portal/frontend/index.html` (29 lines total):

| Tag | Status | Action |
|---|---|---|
| `<title>` (line 9) | "StavAgent — Stavební rozpočty a dokumentace pod kontrolou \| CZ" | Update to v3.2 H1 candidate (Q-B) |
| `<meta name="description">` (line 10) | Old positioning copy | Rewrite per v3.2 §7 |
| `<meta name="robots">` | **MISSING** | Add `"index, follow"` (or omit — default is index,follow) |
| `<link rel="canonical">` (line 11) | Set to `https://www.stavagent.cz` | OK |
| `<meta property="og:type">` (line 14) | `"website"` | OK |
| `<meta property="og:title">` (line 15) | Old | Update |
| `<meta property="og:description">` (line 16) | Old | Update |
| `<meta property="og:url">` (line 17) | OK | OK |
| `<meta property="og:locale">` (line 18) | `"cs_CZ"` | OK |
| **`<meta property="og:image">`** | **MISSING** | **Add 1200×630 PNG**, see Q-G |
| `<meta property="og:site_name">` | **MISSING** | Add `"StavAgent"` |
| `<meta name="twitter:card">` (line 21) | `"summary_large_image"` | OK |
| `<meta name="twitter:title">` (line 22) | Old | Update |
| `<meta name="twitter:description">` (line 23) | Old | Update |
| **`<meta name="twitter:image">`** | **MISSING** | Add (same URL as og:image) |

Also `stavagent-portal/frontend/public/assets/IMG_8967.png` exists at 3.6 MB / 2048×2048 — too large for og:image, wrong aspect ratio. Will be replaced by a fresh 1200×630 image (Q-G).

### 2.10 Modul 4 lead-gen form (Gate 0/3 acceptance)

Per pre-implementation interview Q5 ("Show 'V přípravě' + early-access lead-gen form"), the implementation needs:

- A simple form on the Modul 4 card: email field + "Přidat se do early access" CTA
- A POST endpoint (likely `stavagent-portal/backend/src/routes/early-access.js` or similar new file)
- Storage (a new DB table or a column appended to `users`/`mailing_list`)
- Honeypot or rate-limit (it's a public page)
- Confirmation toast after submission
- Optional confirmation email (but per A.8 we have no welcome-email infra — see Q-E)

This is an additive feature (~120 LOC including migration). Not destructive.

### 2.11 SPA prerender (Gate 4)

`stavagent-portal/frontend/index.html:26`: `<div id="root"></div>` — empty root div, hero text only loads after JS hydrates. `vite.config.ts` has no prerender plugin. Vercel doesn't inject one.

**Action:** Per Q8 of pre-implementation interview, add `vite-plugin-prerender-spa` (or equivalent) to render the public `/` route to static HTML at build time. This is the single biggest SEO improvement — Lighthouse SEO score will jump from "indexable but invisible" to >95.

---

## 3. A.1 — Module name inventory (full)

### 3.1 `Monolit-Planner` / `monolit-planner` / `Monolit Planner`

#### Infrastructure (KEEP — repo/service names)
| File:Line | Text | Reason to keep |
|---|---|---|
| `cloudbuild.yaml:96–123` | `monolit-planner-api` Cloud Run service name | Cloud Run naming is internal; renaming = infra PR |
| `triggers/monolit.yaml:10` | `Monolit-Planner/**` glob | Directory glob |
| `.github/workflows/monolit-planner-ci.yml:1` | `name: Monolit Planner CI` | CI workflow display name |
| `Monolit-Planner/` (directory itself) | — | Repository directory |
| `scripts/check_model_connections.sh:64,212,240` | `Monolit-Planner` paths | Internal monitoring script |
| Per-service env var docs in CLAUDE.md:366–368 | `monolit-planner-api…` URLs | Cloud Run domain |

#### User-facing — must rename
| File:Line | Current text | Action |
|---|---|---|
| `stavagent-portal/frontend/src/pages/LandingPage.tsx:118–122` | Modul 5 entry `'Monolit Planner — plánování monolitických prací'` | **DELETE entry** (merge into Modul 3) |
| `stavagent-portal/frontend/src/pages/LandingPage.tsx:597` (footer) | `'Monolit Planner'` in module list | **Remove** from list |
| `stavagent-portal/frontend/src/pages/PortalPage.tsx:67` | `name: 'Monolit Planner'` (services array) | **Merge** into one Kalkulátor entry with two-mode CTAs |
| `Monolit-Planner/frontend/index.html:13` | `<title>Monolit Planner | StavAgent</title>` | Rename to canonical (Q-D outcome) |
| `Monolit-Planner/frontend/src/pages/PlannerPage.tsx:186` | `<>Monolit Planner` (back-link text in non-portal mode) | Rename |
| `rozpocet-registry/src/components/tov/TOVModal.tsx:265,279` | `"Otevřít v Monolitu → ..."`, `"Otevřít kalkulátor Monolit"` | Rename to "Otevřít v Kalkulátoru" |
| `rozpocet-registry/src/components/tov/MaterialsTab.tsx:154` | `"Otevřít Monolit Planner"` | Rename |
| `rozpocet-registry/src/components/tov/FormworkRentalCalculator.tsx:65` | `"Kalkulátor nájmu bednění"` modal title (uses neutral name — OK) | Keep |
| `Monolit-Planner/backend/src/services/emailService.js:117,166,175` | Subject `"Ověřte svou e-mailovou adresu - Monolit-Planner"`, footer `"© 2025 Monolit-Planner"` | **INVESTIGATE** — see Q-E. If wired, rename. If dead code, delete file. |
| `stavagent-portal/backend/src/db/schema-postgres.sql:688` | Seed row `(gen_random_uuid(), 'monolit', 'Monolit Planner', 'Kalkulátor monolitických betonů', …)` | Rename `name` and `description` columns; add migration to update existing prod rows |

#### Documentation — rename in service descriptions, keep paths
| File:Line | Current | Action |
|---|---|---|
| `CLAUDE.md:82` | `├── Monolit-Planner/        ← Kiosk: Concrete Calculator (Node.js/React, port 3001/5173)` | Edit description: `← Kiosk: Kalkulátor (Node.js/React, port 3001/5173)` |
| `CLAUDE.md:99,160` | "Monolit frontend", "### 3. Monolit-Planner (Kiosk)" | Rename section to "Kalkulátor (Monolit-Planner repo)" — keep repo path reference |
| `CLAUDE.md:315` | `App 1 (root /) = "Monolit Planner", App 2 (/planner) = "Kalkulátor betonáže"` | **Update** to new canonical (Q-D outcome) |
| `README.md:35,38,64` | Service-table + ASCII diagram with repo names | Update labels to canonical marketing names |
| `URS_MATCHER_SERVICE/README.md:471` | `Monolit-Planner → URS Matcher Service` (architecture diagram) | Internal docs — KEEP |

### 3.2 `Párování s kataložními kódy` / `parovani`

| File:Line | Text | Action |
|---|---|---|
| `stavagent-portal/frontend/src/pages/LandingPage.tsx:84` | ROLES.Rozpočtář text mentions "párování kataložních kódů" | Rewrite to "klasifikace pozic" (or keep "párování" as a verb describing what Klasifikátor does — minor) |
| `stavagent-portal/frontend/src/pages/LandingPage.tsx:105` | `title: 'Párování s kataložními kódy'` (Modul 3) | **Rename** to `'Klasifikátor stavebních prací'` |
| `stavagent-portal/frontend/src/pages/LandingPage.tsx:143` | Pricing op `'Párování kataložních kódů'` | Rename to `'AI klasifikace pozic'` |
| `stavagent-portal/backend/src/db/schema-postgres.sql:690` | Seed row description `'Párování položek na URS kódy'` | Rename, migration to update prod |
| `stavagent-portal/backend/src/db/schema-postgres.sql:747` | `'URS párování'`, `'AI párování položek na URS kódy'` op_prices seed | Rename, migration |
| `URS_MATCHER_SERVICE/README.md:466–471` | Internal integration doc | Keep (internal) |

### 3.3 `Kalkulátor betonáže`

This is the **current** canonical product name per CLAUDE.md:315. v3.2 spec §3 wants to change it to `Kalkulátor monolitu`. **Open question Q-D.**

References to current name:
| File:Line | Note |
|---|---|
| `stavagent-portal/frontend/src/pages/CalculatorPage.tsx:55,138` | UI label |
| `stavagent-portal/frontend/src/pages/LandingPage.tsx:112` | Modul 4 title |
| `stavagent-portal/frontend/src/pages/PortalPage.tsx:76` | Services array entry name |
| `stavagent-portal/frontend/src/pages/VerifyEmailPage.tsx:149` | Email-verify success page (also has URS leakage — see §2.3) |
| `Monolit-Planner/frontend/src/pages/PlannerPage.tsx:2,190` | Page title comment + rendered |
| `Monolit-Planner/frontend/src/components/Sidebar.tsx:694–696` | Sidebar tab label + tooltip |
| `Monolit-Planner/frontend/src/components/calculator/useCalculator.ts:593` | `document.title = 'Kalkulátor betonáže \| StavAgent'` |
| `Monolit-Planner/frontend/src/components/calculator/HelpPanel.tsx:35` | Help-panel heading |
| `CLAUDE.md:315` | Canonical-name mandate |
| `docs/archive/analyses/*` | Archived audits (keep as historical) |

If Q-D is "Kalkulátor monolitu", these all need a one-shot find-and-replace. If "keep Kalkulátor betonáže", do nothing.

### 3.4 `concrete-calc` / `concrete-agent`

User-facing leakage check: **none found**. All references are backend/infrastructure (Cloud Run image names, Python package paths, Cloud Build steps). Safe.

### 3.5 `URS_MATCHER_SERVICE` / `urs-matcher-service`

User-facing leakage:
| File:Line | Text | Action |
|---|---|---|
| `stavagent-portal/frontend/src/components/portal/KioskLinksPanel.tsx:37` | `urs_matcher: { label: 'Klasifikátor stavebních prací', … }` | Already canonical — KEEP |
| `stavagent-portal/frontend/src/types/connection.ts:70` | `urs_matcher: 'Klasifikátor stavebních prací'` | Already canonical — KEEP |

Backend / infra (KEEP — separate PR per Q3):
- `cloudbuild-urs.yaml`, `triggers/urs.yaml`, `URS_MATCHER_SERVICE/backend/package.json`, `URS_MATCHER_SERVICE/backend/src/app.js:51` ("Initializing URS Matcher Service" log line), Cloud Run service URL.

### 3.6 `URS` / `ÚRS` (broader scan)

User-facing leakage (must remove):
| File:Line | Text | Note |
|---|---|---|
| `URS_MATCHER_SERVICE/frontend/public/app.js:658,963,1079,1094,1103,1133,1142` | "Kód ÚRS", "Výsledky hledání ÚRS", "DOPORUČENÉ POZICE ÚRS" | See §2.2 |
| `URS_MATCHER_SERVICE/frontend/public/index.html:197` | dropdown option `value="urs"` (label is "Online databáze") | Internal value, can keep; label is the user-facing problem |
| `stavagent-portal/frontend/src/pages/VerifyEmailPage.tsx:149` | "URS klasifikace" | See §2.3 |
| `stavagent-portal/backend/src/db/schema-postgres.sql:690,747` | "URS Matcher", "URS kódy", "URS párování" | Service registry + op_prices — drives Portal credits/billing UI |

Backend / internal (KEEP):
- `urs_codes`, `urs_items` table names — DB schema
- `urs_matcher` service-name string in `services` table — internal key, not displayed
- `URS_MATCHER_URL` env var in `core-proxy.js:223` — internal
- `import_kros_urs.mjs` script — backend tool
- ~1300 occurrences across the repo — 99%+ are internal Python/JS code

### 3.7 `KROS`

| File:Line | Text | Action |
|---|---|---|
| `stavagent-portal/frontend/src/pages/LandingPage.tsx:160` | FAQ "Mohu exportovat do KROS?" | **Delete entry** per Gate 2 |
| `stavagent-portal/frontend/src/pages/DocumentUploadPage.tsx:313` | Upload help text mentions "KROS files" | **Investigate** — if this means "Excel files exported from KROS", the wording is OK; if it means "KROS-format files", flag for rewording. (Spec §4 says don't sell "compatibility with KROS".) |
| `URS_MATCHER_SERVICE/backend/scripts/import_kros_urs.mjs` | KROS data-import script | KEEP — internal data ingestion |
| `concrete-agent/docs/ARCHITECTURE.md:196` | Internal docs | KEEP |
| `CLAUDE.md:384` | "KROS rounding `Math.ceil(x/50)*50`" — internal algorithm doc | KEEP (algorithmic note) |

### 3.8 Deprecated names ("Plánovač elementu", "Kalkulátor monolitních prací")

**0 occurrences anywhere.** Already compliant with CLAUDE.md:315 mandate.

---

## 4. A.2–A.4 — Kiosk live UI audit (code-level)

> **Limitation:** all findings are from React/HTML source code. No live browser walkthrough.

### 4.1 Klasifikátor (`URS_MATCHER_SERVICE/frontend/`)

`<title>` (`/public/index.html:6`): `"Klasifikátor stavebních prací"` ✅ canonical
`<h1>` (`/public/index.html:41`): `"Klasifikátor stavebních prací"` ✅ canonical
Footer (`/public/index.html:405`): `"Klasifikátor stavebních prací"` ✅ canonical
Top nav: theme toggle + AI-model dropdown (no traditional menu).

#### Catalog dropdown (CRITICAL — see §2.1)
- `/public/index.html:195–201` — `<select id="batchCatalog">` with 3 options
- Internal `value="urs"` is fine; label `"Online databáze"` is the user-visible problem.

#### Source-badge rendering
- `/public/app.js:805` — table header `<th>Zdroj</th>` ✅ neutral
- `/public/app.js:814` — `sourceLabel = item.source === 'otskp' ? 'OTSKP' : (item.source === 'perplexity' ? 'Perplexity' : (item.source || 'local'))` ✅ no "ÚRS" string
- `/public/app.js:819` — rendered as `.source-badge` span

**However** the column header / export text outside the badge does say "ÚRS" — see §2.2 / §3.6.

#### Confidence display
- `/public/app.js:691,823,1772` — confidence rendered as `${(item.confidence * 100).toFixed(0)}%`
- `/public/app.js:809` — class chosen by `confidence > 0.8 ? 'confidence-high' : 'confidence-medium'`
- `/public/app.js:1148` — plain-text export: `Jistota: ${confidence}%`
- **No 95% cap** for AI-only results. Backend can return 1.0 → UI shows 100%. **Bug per v3.2 philosophy**, but separable from this PR (see §14 Q-J).

#### Export to Registry button
- `/public/index.html:280–281` — button label `"📤 Export do Registry"` (initial state)
- `/public/app.js:1208–1350` — click handler, builds payload + POST
- `/public/app.js:1305–1306` — fetches `https://registry.stavagent.cz/api/sync?action=import-positions`, body includes `positions[]`, `sourceKiosk: 'urs-matcher'`, `projectName`
- `/public/app.js:1331–1333` — success state: button text becomes `"✓ Exportováno!"`, reverts after 2s
- ✅ **Implemented and live** (this contradicts the early A.5 inline draft — see §11.1)

#### Audit trail rendering
- `/public/index.html:338` — `<div id="auditTrail">`
- `/public/app.js:2291–2315` — `displayAuditTrail()` renders entries with `time / action / details` fields
- No hardcoded catalog mention in the rendering itself; trail strings come from backend.

#### Multi-Role analysis (Phase 3 Advanced)
- `/public/index.html:291` — heading `"🤖 Analýza Vícerolí (Phase 3 Advanced)"`
- `/public/app.js:2061–2068` — 6 role names: `Validátor Dokumentů, Stavbyvedoucí, Specialista Betonu, Kontrola Norem, Technologické Pravidla, Odhad Nákladů`. ✅ No catalog mentions.

#### Loading / errors
- `"Načítání výsledků..."` (`/public/index.html:270`), `"Nebyly nalezeny žádné pozice"` (`/public/app.js:631,843`)
- No catalog-specific loading text.

### 4.2 Registr (`rozpocet-registry/`)

`<title>` (`/index.html:6`): `"Registr Rozpočtů"` (not exactly canonical — spec says just `"Registr"` or `"Registr — pracovní rozbor smety"`)
`<h1>` is in `AppRibbon.tsx:86`: `"Registr rozpočtů"` (lowercase "rozpočtů")
Footer (`App.tsx:856`): `"STAVAGENT Ecosystem • Registr Rozpočtů v1.0 • {year}"`
OG title (`/index.html:8`): `"Registr Rozpočtů"`

#### TOV implementation
- TOV button in row actions: `src/components/tov/TOVButton.tsx`
- Modal: `src/components/tov/TOVModal.tsx`
  - Lines 265, 279: links labelled `"Otevřít v Monolitu → {part_name}"` and `"Otevřít kalkulátor Monolit"` — **both need rename** per §3.1
- Tabs inside modal: Pracovní síly / Mechanizace / Materiály
- Materials tab `MaterialsTab.tsx:154`: `"Otevřít Monolit Planner"` — **rename**

#### Calculator components inside TOV
- `src/components/tov/PumpRentalSection.tsx` — **fully implemented**, supplier knowledge base in `src/data/pump_knowledge.json`. Multi-supplier formulas confirmed.
- `src/components/tov/DeliveryCalcSection.tsx` — fully implemented, embedded in Pump section
- `src/components/tov/CraneRentalSection.tsx` — fully implemented (6 crane models: Liebherr, Potain, Terex)
- `src/components/tov/FormworkRentalSection.tsx` and `FormworkRentalCalculator.tsx` — fully implemented (DOKA pricing)

✅ The "vestavěné kalkulátory bětonpumpy / dopravy / kranu" claim in v3.2 spec §6.4 is accurate — these all really exist.

#### Confidence display in Registr
- Only shown in Import Modal column-mapping UI (`src/components/import/ImportModal.tsx:1219–1222`) as `✓ / ⚠ / ✗` icons, not in the main table.
- Per-item confidence on classified positions is **not displayed** in the main UI (data may exist but no rendering).

#### Skupiny management
- Inline in `ItemsTable.tsx` row → `SkupinaAutocomplete.tsx` / `SkupinaFilterDropdown.tsx`
- Not a dedicated modal.

#### Export buttons (`src/layout/ExportMenu.tsx`)
- 6 options at lines 85, 90, 98, 104, 110, 116:
  - Export list / Export projekt / Export list + TOV rozpis / Export projekt + TOV rozpis / Vrátit do původního (ceny) / Vrátit do původního (ceny + skupiny)
- Plus "Poptávka cen" button (`AppRibbon.tsx:116`) ✅ matches v3.2 §6.4 description.

### 4.3 Kalkulátor (`Monolit-Planner/frontend/`)

`<title>` (`/index.html:13`): `"Monolit Planner | StavAgent"` ❌ — old name
`<meta robots>` (`/index.html:12`): `"noindex, nofollow"` ✅ correct (working app, not a marketing page)

#### Routing — "Detail prvku" vs "Plán objektu"
- **Same route** (`/planner`), differentiated by URL params + state.
- Part A (root `/`) renders `FlatMainPage` with positions table. User clicks element → navigates to `/planner?bridge_id=X&part_name=Y`.
- Part B (`/planner`) renders `PlannerPage` with the calculator.
- "Plán objektu" mode is when the user loads a saved variant flagged `is_plan: true`.

There is **no clean tab/segmented-control toggle** between the two modes inside one URL. The marketing claim "Dva režimy: detail jednoho prvku, nebo plán celého objektu" in v3.2 §3 / §6.4 is **technically true but the UX is rough**. The landing copy is accurate enough; user sees a mode-distinct experience either way. Flagging as **observation, not blocker**.

#### Resource map output
- `PlannerOutput` (the calculator's output type) has fields: `gantt`, `formwork_plan`, `reinforcement_plan`, etc.
- **No `resource_map` field** named explicitly.
- However, `applyPlanToPositions.ts` (the "Aplikovat" button) DOES split the plan into 7 work types (Betonář, Tesař montáž/demontáž, Železář, Ošetřovatel, Specialista předpětí, Tesař podpěry) and creates positions. So a "resource map" exists in effect, just not as a single named export.
- v3.2 §2 claim "Plán objektu генерирует ресурсную карту" is **accurate in effect**, but if a user takes that literally and looks for a "resource map" tab/button, they won't find one.

#### AI advisor button
- `src/components/calculator/CalculatorSidebar.tsx:443–455` — `"✨ AI doporučení (postup, bednění, normy)"`
- Calls `POST {VITE_API_URL}/api/planner-advisor` (Monolit backend) which orchestrates 3 LLM calls + KB lookup.

#### Suggestion confidence
- `src/components/PositionRow.tsx:551` — `<strong>Jistota:</strong> {Math.round(suggestion.confidence * 100)}%`
- Same uncapped concern as Klasifikátor.

#### TZ-text-extractor
- Backend has `Monolit-Planner/shared/src/parsers/tz-text-extractor.ts` (per CLAUDE.md v4.18)
- Frontend has `TzTextInput.tsx` — collapsible textarea above AI panel
- ✅ Real feature; landing copy can mention it accurately if relevant.

---

## 5. A.5 — Integration audit

### 5.1 Klasifikátor → Registr ("Export do Registry")
**Status: implemented and live.** (See §4.1 / §11.1.)
- Endpoint: `POST https://registry.stavagent.cz/api/sync?action=import-positions`
- Payload: `{ positions: [{ code, description, unit, metadata: { inputText, confidence } }, …], sourceKiosk: 'urs-matcher', projectName }`
- UI: button at `URS_MATCHER_SERVICE/frontend/public/index.html:281`
- Receiving handler: in `rozpocet-registry-backend/` (specific file not deeply audited; takes the JSON into a project).

### 5.2 Kalkulátor (Plán objektu) → Registr/TOV
**Status: partially implemented**, but server-side wiring works.
- "Aplikovat plán" in Kalkulátor → `Monolit-Planner/frontend/src/components/calculator/applyPlanToPositions.ts`
- TOV pre-fill logic on Registr side: `rozpocet-registry/src/services/tovPrefill.ts:29` — `prefillTOVFromMonolit(MonolithPayload)` converts costs+resources to TOVData
- Profession mapping: Betonář / Tesař / Bednář / Železář (lines 36–73)
- Endpoint Monolit→Registr (via Portal): `POST /api/import-from-registry` (Monolit backend, `import-from-registry.js:149`)
- **Missing UX**: there is no explicit "Export to Registr/TOV" button in the Kalkulátor that the user would recognize — it goes through the Aplikovat → position-instance → Registry-lookup chain. The marketing claim "auto-import resources into TOV" is accurate, but the user-facing button labelled that way doesn't exist.

### 5.3 Portal → kiosks navigation
- `stavagent-portal/frontend/src/pages/PortalPage.tsx:65–183` — services array (13 entries, hardcoded)
- Tile rendering at `:559` "Dostupné služby"; sidebar at `:499–517`
- All 4 kiosk URLs hardcoded in this one file — easy to update.

### 5.4 Auth flow Portal ↔ kiosks
- `auth_token` in localStorage (`stavagent-portal/frontend/src/services/api.ts:68`)
- Cross-subdomain cookie `stavagent_jwt` set in `AuthContext.tsx:31–72`:
  - domain: `.stavagent.cz` (prod) or null (localhost)
  - secure: true (HTTPS only)
  - **sameSite: lax** (line 55)
  - max-age: 86400 (24 h)
  - httpOnly: false (kiosks need JS access)
- Axios interceptor adds `Authorization: Bearer ${token}` (`api.ts:67–75`)
- Registry reads `stavagent_jwt` via `getPortalJwt()` for `POST /api/integration/import-from-registry` (returns 401 if anonymous, per `portalAutoSync.ts`)
- ✅ Working; matches CLAUDE.md description.

### 5.5 Cross-kiosk linking via portal_project_id
- `monolith_projects.portal_project_id` added in migration 007 (`007_portal_integration.sql:24`)
- `registry_projects.portal_project_id` added in `rozpocet-registry-backend/schema.sql:9`
- Populated when a kiosk does its first export to Portal.

### 5.6 DocumentAnalysisPage status — **MISMATCH**
- `stavagent-portal/frontend/src/pages/DocumentAnalysisPage.tsx` exists and implements the full upload/analysis flow (Soupis, Passport, Audit, Summary, Compliance tabs)
- Routed via `App.tsx` to `/portal/analysis`
- Imports `ProjectAnalysis, SoupisTab, PassportTab, AuditTab, SummaryTab, ComplianceTab` components
- Calls `CORE_API_URL` for passport generation
- Supports PDF/XLSX/CSV/images
- **BUT** `PortalPage.tsx:108` has `status: 'coming_soon'` for this service entry

**Question Q-A** in §14 — is Modul 4 actually live, or is it a WIP that should stay "v přípravě" until a launch announcement? The code says live; the Portal flag says coming_soon. Can't be both on the new landing.

---

## 6. A.6 — SEO infrastructure

### 6.1 Per-frontend `<head>` summary

| Tag | Portal (landing) | Registr | Klasifikátor | Kalkulátor |
|---|---|---|---|---|
| `<title>` | ✅ (old positioning) | ⚠️ "Registr Rozpočtů" | ✅ canonical | ❌ "Monolit Planner \| StavAgent" |
| `<meta description>` | ✅ (old) | ❌ MISSING | ❌ MISSING | ❌ MISSING |
| `<meta robots>` | ❌ MISSING (default = index) | ❌ MISSING | ❌ MISSING | ✅ `noindex, nofollow` (correct) |
| `<link canonical>` | ✅ | ❌ MISSING | ❌ MISSING | ❌ MISSING |
| `og:type` | ✅ `website` | ❌ MISSING | ❌ MISSING | ❌ MISSING |
| `og:title` | ✅ (old) | ✅ (basic) | ❌ MISSING | ❌ MISSING |
| `og:description` | ✅ (old) | ✅ (basic) | ❌ MISSING | ❌ MISSING |
| `og:url` | ✅ | ❌ MISSING | ❌ MISSING | ❌ MISSING |
| `og:locale` | ✅ `cs_CZ` | ❌ MISSING | ❌ MISSING | ❌ MISSING |
| `og:image` | ❌ **MISSING** | ❌ MISSING | ❌ MISSING | ❌ MISSING |
| `og:site_name` | ❌ MISSING | ❌ MISSING | ❌ MISSING | ❌ MISSING |
| `twitter:card` | ✅ `summary_large_image` | ❌ MISSING | ❌ MISSING | ❌ MISSING |
| `twitter:title/desc` | ✅ (old) | ❌ MISSING | ❌ MISSING | ❌ MISSING |
| `twitter:image` | ❌ **MISSING** | ❌ MISSING | ❌ MISSING | ❌ MISSING |
| Favicon | `/favicon.svg` | `/favicon.svg` | `/assets/logo.svg` | `/favicon.svg` |

Portal needs the most SEO work for v3.2 (it's the landing page); the kiosks are working apps that should stay noindexed.

### 6.2 og:image existence
- **Portal**: 0 og:image meta tag, but a 3.6 MB / 2048×2048 PNG exists at `stavagent-portal/frontend/public/assets/IMG_8967.png` — **not suitable** as og:image (too big, wrong aspect ratio). New 1200×630 PNG must be created.
- All other frontends: no og:image file or tag.

### 6.3 sitemap.xml
- **None** of the 4 frontends has a sitemap.xml or generates one at build time.

### 6.4 robots.txt
- **None** of the 4 frontends has a robots.txt file.
- Only Kalkulátor has `<meta robots="noindex, nofollow">` in `index.html` head + `X-Robots-Tag` in `vercel.json`.

### 6.5 Vercel config
| Frontend | `vercel.json` notes |
|---|---|
| Portal | SPA rewrite only. No headers. |
| Registr | API proxy + CORS for `/api/*`. No headers on root. |
| Klasifikátor | API proxy `/api/:path*` + `/health` to Cloud Run. No headers. |
| Kalkulátor | SPA rewrite + `X-Robots-Tag: noindex, nofollow` (correct). |

### 6.6 Prerender / SSG
- **None.** All 4 frontends are Vite SPAs with no prerender plugin, no Astro/Next/Gatsby. Portal landing is currently a JS-only render: `curl https://www.stavagent.cz/` returns the empty `<div id="root"></div>`.

### 6.7 SEO subpages
- Public routes in Portal `App.tsx:75–144`: `/`, `/login`, `/register` (?), `/verify`, `/forgot-password`, `/reset-password` only.
- **No SEO subpages** for `/parovani-kodu`, `/monolit-planner`, `/klasifikator`, `/kalkulator`, `/registr-rozpoctu`. Good — no 301 redirects needed.

### 6.8 Analytics
- **No GA4 / Plausible / PostHog / Umami** detected in any of the 4 frontends. Adding analytics is out of scope for v3.2, but worth noting.

---

## 7. A.7 — URS leakage to public surfaces (separate from §3.6)

### 7.1 Klasifikátor catalog dropdown
**See §2.1.** This is the single most-visible legal-risk leakage.

### 7.2 Klasifikátor source badges
- `app.js:814` — `sourceLabel` produces `"OTSKP" / "Perplexity" / "local"`. **No "ÚRS" string in badge rendering itself.**
- Note: column headers + export text DO contain "ÚRS" — see §2.2 / §3.6.

### 7.3 DebugCollector
- **Component does not exist anywhere in the repo.** Verified with `grep -rn "DebugCollector|debugCollector|debug-collector|debug_collector"` — 0 matches.
- v3.2 spec §12 says: *"DebugCollector.tsx обязательно подключён на новой версии лендинга."* and *"DebugCollector 'Copy for Claude' output не содержит упоминаний 'URS'…"*.
- **Spec divergence Q-K** in §14.

### 7.4 Public API path leakage
- `URS_MATCHER_SERVICE/frontend/public/app.js:2337` — fetches `${portalApi}/api/portal-files/${portalFileId}/parsed-data/for-kiosk/urs_matcher` — `urs_matcher` appears in the path (Portal route)
- `stavagent-portal/frontend/middleware.js:9` — `URS_BACKEND` constant points to `urs-matcher-service-…run.app` (Edge config, not in browser HTML)
- Klasifikátor's own backend routes: `/api/jobs/*`, `/api/batch/*`, `/api/universal-match/*` — all neutral
- ✅ Public-facing path leakage is minimal; the `urs_matcher` slug in `for-kiosk/urs_matcher` is a Portal route key. Acceptable for now (will be cleaned up in the URS rename PR).

### 7.5 Cloud Run / deployment names
- `cloudbuild-urs.yaml:61` — service deployed as `urs-matcher-service`
- `URS_MATCHER_SERVICE/frontend/vercel.json:9,13` — proxies to `urs-matcher-service-…run.app`
- ✅ Internal infra. Browser sees only `klasifikator.stavagent.cz`. Out of scope for this PR.

### 7.6 Email templates
- `stavagent-portal/backend/src/services/emailService.js` — uses brand "StavAgent" only. ✅
- `Monolit-Planner/backend/src/services/emailService.js` — uses brand "Monolit-Planner" — **rename or delete** (Q-E).
- No catalog mentions in either.

### 7.7 Loading / errors / toasts in Klasifikátor
- No catalog-specific loading text. ✅

---

## 8. A.8 — Stripe + emails (re-scoped from "Lemon Squeezy")

### 8.1 Payment provider — IT'S STRIPE, NOT LEMON SQUEEZY
- `stavagent-portal/backend/src/routes/credits.js:2` — header comment: "Credits Routes — User-facing + Admin + **Stripe payments**"
- `credits.js:11–12` — `Stripe webhook (no auth — verified by signature): POST /api/credits/webhook`
- `server.js:160–162` — `if (req.path === '/api/credits/webhook') { ... express.raw() }` (Stripe-style raw-body webhook)
- `credits.js:196` — Stripe Checkout line item dynamically named `STAVAGENT: ${calc.credits} kreditů`

CLAUDE.md mentions Lemon Squeezy at line 147 — but that's the **MCP Server** (concrete-agent) billing webhook, which is in TODO state (TODO list line "P0: stavagent.cz/api-access page", "P1: Lemon Squeezy webhook IDs"). Not currently shipping.

**Implication for v3.2 spec §A.8:** the section asks for "Lemon Squeezy product IDs and email templates". Reality:
- Portal doesn't use Lemon Squeezy.
- Stripe Checkout dynamic names are clean (no module names to rename).
- No purchase-confirmation, low-credits-warning, or refund emails are sent at all.

### 8.2 Email templates inventory

| File | Purpose | Subject | Module names mentioned |
|---|---|---|---|
| `stavagent-portal/backend/src/services/emailService.js:117` | Verify email | `"Ověřte svou e-mailovou adresu - StavAgent"` | Brand "StavAgent" only |
| `stavagent-portal/backend/src/services/emailService.js:175` | Password reset | `"Resetovat heslo - StavAgent"` | Brand only |
| `Monolit-Planner/backend/src/services/emailService.js:117` | Verify email (DUPLICATE) | `"Ověřte svou e-mailovou adresu - Monolit-Planner"` | "Monolit-Planner" in subject + body + footer |
| `Monolit-Planner/backend/src/services/emailService.js:175` | Password reset (DUPLICATE) | `"Resetovat heslo - Monolit-Planner"` | "Monolit-Planner" |

The Monolit-Planner emailService.js is **likely dead code** — Monolit-Planner now uses Portal JWT auth so it shouldn't trigger its own emails, but the file is still in the repo and still wired to backend routes. **Q-E in §14**: investigate and either rename or delete.

### 8.3 Welcome / billing / low-credit emails
- **No welcome email exists.** User registers → verify email → 200 free credits added silently to the DB. No email about the bonus.
- **No billing receipt / purchase confirmation.** Stripe webhook adds credits silently.
- **No low-credits warning.** Not implemented.

Implication for v3.2 §6.10 FAQ "Co je kredit?" answer — keep generic; don't promise emails the system doesn't send.

### 8.4 GitHub repo metadata
- `.github/` contains `SECRETS_SETUP.md`, `pull_request_template.md`, `dependabot.yml`, `workflows/`. Repository description and topics are set on github.com (not in repo files) — out of scope for this audit.

---

## 9. A.9 — Documentation alignment

### 9.1 CLAUDE.md (root)
| Line | Current | Action |
|---|---|---|
| 82 | `├── Monolit-Planner/        ← Kiosk: Concrete Calculator` | Rephrase the description: `← Kiosk: Kalkulátor` (KEEP repo name) |
| 83 | `├── URS_MATCHER_SERVICE/    ← Kiosk: URS Matching` | `← Kiosk: Klasifikátor` |
| 84 | `├── rozpocet-registry/      ← Kiosk: BOQ Registry` | `← Kiosk: Registr` |
| 99–100 | "Monolit frontend", "URS Matcher" labels in services table | Rename labels to canonical |
| 122 | Architecture diagram | Update box labels |
| 160 | `### 3. Monolit-Planner (Kiosk)` | Section header → `### 3. Kalkulátor (Monolit-Planner repo)` |
| 220 | `### 4. URS_MATCHER_SERVICE (Kiosk)` | `### 4. Klasifikátor (URS_MATCHER_SERVICE repo)` |
| 315 | Product naming mandate | **Update** with new canonical (depends on Q-D) |
| 471 | `Per-service docs: Monolit-Planner/CLAUDE.MD` | Keep path reference |

CLAUDE.md is internal — it's there for Claude Code sessions, not the public — but consistency matters because it's the source of truth for "what is the canonical name". Update at the same time as the rest of the renames.

### 9.2 README.md (root, public)
| Line | Current | Action |
|---|---|---|
| 35 | `Monolit-Planner` frontend → "Calculator UI (*kalkulátor betonáže*)" | OK if Q-D = keep; rename italic if Q-D = monolitu |
| 36 | `URS_MATCHER_SERVICE` → "Construction code classifier" | Rename row label to "Klasifikátor (URS_MATCHER_SERVICE)" |
| 38 | `rozpocet-registry` → "BOQ registry UI" | Add "Registr (rozpocet-registry)" |
| 64 | ASCII diagram with repo names | Update box labels to canonical marketing names + small repo-name suffix |
| 165 | Test-coverage table with `Monolit-Planner/shared` | KEEP (repo name reference) |

### 9.3 docs/ alignment
- 28 files in `docs/`. Spot-checked `PRODUCT_VISION_AND_ROADMAP.md:11,31` — uses "Monolit Planner" as marketing name. Other 26 files not deeply scanned (low ROI for landing-page PR).
- **Recommendation:** out of scope for the v3.2 PR. Leave docs/ as-is, document in next-session.md that `docs/` will be updated in a follow-up doc-cleanup PR.

### 9.4 Per-service CLAUDE.md / README.md
| Service | CLAUDE.md | README.md | Note |
|---|---|---|---|
| concrete-agent | ✅ exists | ✅ exists | OK |
| stavagent-portal | ❌ | ❌ | Out of scope |
| Monolit-Planner | ❌ (lower) but ✅ as `CLAUDE.MD` (uppercase) | ✅ exists | **Filename case inconsistency** — CLAUDE.MD vs CLAUDE.md (Q-L) |
| URS_MATCHER_SERVICE | ❌ | ✅ exists | OK |
| rozpocet-registry | ❌ | ✅ exists | OK |

### 9.5 next-session.md
- Currently focused on Libuše DPS / DWG parsing pipeline. **Does not reference module names.** Out of scope for naming audit.

---

## 10. A.10 — Confidence display

| Kiosk | Where shown | Format | Capped at <100% for AI? |
|---|---|---|---|
| Klasifikátor | Candidate cards (`app.js:691,823,1772`) + plain-text export (`app.js:1148`) | `${(x*100).toFixed(0)}%` | ❌ NO |
| Registr | Import Modal column-mapping only (`ImportModal.tsx:1219–1222`) — `✓ / ⚠ / ✗` icons | Icon (no %) | N/A — not numeric |
| Kalkulátor | Suggestion popup (`PositionRow.tsx:551`) | `Math.round(x*100)%` | ❌ NO |

**Implication:** the v3.2 philosophy "*AI nikdy 100%, OTSKP exact = 100%*" is **policy-only** today, not enforced in the rendering code. Backend can return `confidence: 1.0` for an AI match and UI will display 100%.

**Q-J in §14:** does this PR fix the cap (clamp to 0.95 for AI sources in the rendering layer), or is it deferred to a separate "confidence rendering hardening" PR?

---

## 11. Reconciliation between sub-audits

### 11.1 "Export do Registry button" — A.5 (inline draft) said NOT IMPLEMENTED
- The first A.5 inline report (delivered before background-agent A.5 completed) claimed there was no button.
- A.2-4 audit + my own grep verification show the button exists at `URS_MATCHER_SERVICE/frontend/public/index.html:281` and the click handler at `app.js:1208–1350`.
- **Cause:** the inline A.5 agent searched only `URS_MATCHER_SERVICE/frontend/` (which is mostly empty/scaffold), not `URS_MATCHER_SERVICE/frontend/public/` (which is where the actual UI lives — the kiosk uses a flat HTML+JS structure under `/public/`, not a React tree).
- **Resolution:** button is **implemented and live**. v3.2 §6.5 workflow diagram is accurate.

### 11.2 ÚRS in source badges — A.7 said "no leakage", A.2-4 said "leaks in column headers"
- Both are correct, in different scopes.
- A.7.2 specifically checked the `<span class="source-badge">` element rendering (`app.js:814,819`) — and indeed only `OTSKP / Perplexity / local` strings appear there.
- A.2-4 checked the broader page (column headers, CSV exports, plain-text exports) and found "Kód ÚRS" / "Výsledky hledání ÚRS" / "DOPORUČENÉ POZICE ÚRS" at lines 658, 963, 1079, 1094, 1103, 1133, 1142.
- **Resolution:** badges are clean; column headers + exports leak. Both must be fixed (§2.2).

### 11.3 Email templates — A.7 said "none found", A.8 found two
- A.7.6 search may have missed them due to file-extension filter.
- A.8.2 found two emailService.js files with verify + reset templates.
- **Resolution:** A.8 is correct. Two `emailService.js` files exist (Portal canonical + Monolit-Planner duplicate).

---

## 12. Spec divergences (v3.2 vs reality)

### 12.1 v3.2 assumes Lemon Squeezy; reality is Stripe
- **Spec lines affected:** §A.8.1, §A.8.2 ("Email шаблоны от Lemon Squeezy"), §5 ("Lemon Squeezy products" rename row).
- **Action:** §A.8.1 / §A.8.2 of the audit deliverable are re-scoped (already done — see §8 above). §5 row "Lemon Squeezy products" is **removed** from the rename map (Stripe line items don't carry product names that need to change).

### 12.2 v3.2 assumes DebugCollector exists
- **Spec lines affected:** §12 handoff notes ("DebugCollector.tsx обязательно подключён", "DebugCollector output не содержит упоминаний 'URS'").
- **Reality:** component does not exist.
- **Action:** Q-K in §14. Either build it as part of this PR, defer to a separate PR, or drop the requirement.

### 12.3 v3.2 §3 says canonical is "Kalkulátor monolitu"; CLAUDE.md says "Kalkulátor betonáže"
- **Action:** Q-D in §14.

### 12.4 v3.2 §3 says Modul 4 is "v přípravě"; DocumentAnalysisPage is fully implemented
- **Action:** Q-A in §14.

### 12.5 v3.2 §1.3 says "В UI Klasifikátоrа есть dropdown 'Online databáze / OTSKP (lokální) / Oba katalogy'" — CONFIRMED at index.html:197–199.
- ✅ Spec accurate.

### 12.6 v3.2 §6.5 workflow diagram assumes Klasifikátor → Registr export works — CONFIRMED.
- ✅ Spec accurate.

### 12.7 v3.2 §6.4 Registr description claims TOV + Bětonpumpa/Doprava/Kran calculators are real — CONFIRMED.
- ✅ Spec accurate (Pump/Crane/Delivery/Formwork rental components all exist and are wired).

### 12.8 v3.2 §6.7 FORESTINA example with TOV decomposition
- TOV decomposition (lidé/mechanizmy/materiály) is realistic — the components exist.
- **However**, the v3.2 example uses placeholder `XX Kč` — the audit cannot produce a real benchmark without running an actual calculation. **Q-I in §14**.

### 12.9 v3.2 §10 "Реальные числа odchylky на FORESTINA" — placeholder vs benchmark
- **Q-I in §14** — needs benchmark or honest "approximate" wording.

### 12.10 Monolit-Planner has its own emailService.js
- Not anticipated by v3.2. Either active (and leaks "Monolit-Planner" branding) or dead code.
- **Q-E in §14.**

### 12.11 Portal has 9 extra `coming_soon` services beyond v3.2's 4-module structure
- v3.2 doesn't say what to do with them.
- **Q-F in §14.**

---

## 13. Dependencies that may break on rename

### 13.1 `schema-postgres.sql:686–690` service registry seeds
Renaming `'Monolit Planner'` → `'Kalkulátor'` in the seed file is one line. **But existing prod rows already have the old values** — a migration is needed to update existing `services` table rows. Specifically:

```sql
UPDATE services SET name='Kalkulátor', description='Kalkulátor monolitických betonů (detail prvku + plán objektu)' WHERE service_key='monolit';
UPDATE services SET name='Klasifikátor stavebních prací', description='AI klasifikace stavebních pozic' WHERE service_key='urs_matcher';
```

Migration file should be additive and idempotent.

### 13.2 `schema-postgres.sql:747` op_prices seed
Same situation — rename `'URS párování'` → `'AI klasifikace pozic'` in the seed + migration to update existing prod rows.

### 13.3 Klasifikátor `value="urs"` in dropdown
The internal value is consumed by backend. Renaming the LABEL doesn't break anything; renaming the VALUE would break the API client. **Don't change the value, only the label.** §2.1 spec respects this.

### 13.4 Stripe Checkout line items
`STAVAGENT: ${credits} kreditů` is dynamic — no rename needed.

### 13.5 Klasifikátor → Registry export payload
- Field `sourceKiosk: 'urs-matcher'` in the POST body is internal. Don't rename it (Registry receiver may switch on this).

### 13.6 Cookie name `stavagent_jwt`
Untouched — no rename in this PR.

### 13.7 `for-kiosk/urs_matcher` Portal route slug
Renaming this path would break Klasifikátor's `app.js:2337` fetch. **Out of scope** for this PR (URS rename is a separate PR).

### 13.8 `Monolit-Planner/backend/src/services/emailService.js`
If this file is wired (i.e., Monolit-Planner backend really sends its own emails), renaming branding is safe. If we delete the file, we need to confirm no `require/import` references it anywhere. **Q-E in §14.**

### 13.9 Existing Vercel deployments
Renaming `<title>` and meta tags doesn't break Vercel; adding `vite-plugin-prerender-spa` may need a rebuild and might fail on Vercel if the plugin needs a Puppeteer headless browser at build time. **Q-H in §14.**

### 13.10 Lead-gen form for Modul 4
- New endpoint `POST /api/early-access` (or similar) needs to be added to Portal backend
- New DB table or column to store emails
- No external API contract impact

---

## 14. Open questions (gating decisions)

> Numbered Q-A through Q-L. Bring me the answers (or hand-write them in this file) and I'll proceed to the implementation phase.

### Q-A. Modul 4 (Analýza dokumentace) status
The page (`DocumentAnalysisPage.tsx`) is fully implemented and routable, but `PortalPage.tsx:108` flags it `coming_soon`. The pre-implementation interview (§8 Q5) already chose "Show 'V přípravě' + early-access lead-gen form" — **so the marketing position is "v přípravě"**.

**Gating sub-question:** if Modul 4 is "v přípravě" on the landing, do we **also** keep `PortalPage.tsx:108` as `coming_soon` (logged-in users can't open it), OR do we keep the page accessible from `/portal/analysis` for a closed beta but just not advertise it on the public landing?

- Option A: Keep marketing + Portal both as "v přípravě" (page becomes inaccessible to public). Cleanest.
- Option B: Marketing "v přípravě" (lead-gen) but Portal flag flipped to `active` (logged-in users get early access without joining the list). Confusing two-track.
- Option C: Marketing "v přípravě" (lead-gen) AND Portal stays `coming_soon` BUT we whitelist the route for testers via env flag.

### Q-B. Hero H1 — 3 v3.2 candidates + open
- A. *"Z rozpočtu pracovní plán."*
- B. *"Od smety k harmonogramu. Klasifikace, TOV, takты, zdroje — v jedné tabulce."*
- C. *"Rozdělte sметu, naplánujte takты, spočítejte zdroje a mechanizmy."*

### Q-C. Persona-bundles in Ceník (v3.2 §6.9)
Use placeholder estimates (Rozpočtář ~150 Kč/měsíc, Přípravář ~80, Stavební firma ~500), or do you have real numbers from expected usage?

### Q-D. Kalkulátor canonical name
- "Kalkulátor monolitu" (v3.2 §3 spec)
- "Kalkulátor betonáže" (current code + CLAUDE.md:315 mandate)

If you choose monolitu, that's a one-shot find/replace across ~10 files. If you keep betonáže, no code change but the v3.2 spec text needs editing.

### Q-E. `Monolit-Planner/backend/src/services/emailService.js`
This file exists with "Monolit-Planner" branding. Three options:
- E1: Investigate whether it's wired. If yes → rename branding to "StavAgent" + canonical Kalkulátor. If no → delete.
- E2: Just rename branding (safe assumption it's wired).
- E3: Just delete (assume it's dead code).

I recommend E1 (investigate first).

### Q-F. Portal services array — 9 extra `coming_soon`
- F1: Hide them entirely (clean 4-module Portal sidebar matching the new landing).
- F2: Group them under "Připravujeme" / "V přípravě" sub-section.
- F3: Keep as-is (Portal is broader than landing).

### Q-G. og:image — generate now or wait?
- G1 (recommended): Generate a 1200×630 PNG mockup now using a screenshot of Registr+TOV (or a Figma mockup). I can produce a placeholder via a simple solid-color + heading SVG export, or you supply the asset.
- G2: Wait for a real product screenshot (delays Gate 3).

### Q-H. Prerender plugin
- H1: Add `vite-plugin-prerender-spa` (uses Puppeteer at build time — Vercel may need extra config). Recommended for Gate 4.
- H2: Defer to a follow-up PR, ship landing as SPA-only and accept Lighthouse SEO score < 95.
- H3: Migrate to Astro / Next.js — out of scope for this PR.

### Q-I. FORESTINA `příklad z praxe` — real numbers or placeholder?
- I1: Use the FORESTINA inputs (94.231 m³ / 547.4 m² / 5.654 t) with placeholder `XX Kč` totals + clear "Reálné objekty z portfolia, ceny závisí na lokálních dodavatelích" caveat.
- I2: Run an actual calculation with real Czech rates and use the output. Requires real data inputs (worker rates, current beton+rebar+formwork prices) — these probably exist in your usage.
- I3: Use a different, fully-numericky-correct example you provide.

### Q-J. AI confidence cap
- J1: Clamp AI-only confidence to 0.95 in the rendering layer of all 3 kiosks (Klasifikátor, Registr import modal, Kalkulátor suggestions). Small change (~3 file edits).
- J2: Defer to separate PR.

### Q-K. DebugCollector
- K1: Build it as part of this PR (component capturing module names, browser info, console errors → "Copy for Claude" button). ~80 LOC.
- K2: Defer to separate PR. The v3.2 §12 handoff requirement "DebugCollector подключён" gets dropped.
- K3: Drop the requirement entirely.

### Q-L. `Monolit-Planner/CLAUDE.MD` filename case
- L1: Rename to lowercase `CLAUDE.md` to match root + concrete-agent. Trivial 1-line `git mv`.
- L2: Leave as-is (functional difference is zero; case-sensitive filesystems may serve it differently).

---

## 15. Estimated implementation scope

After audit, the v3.2 PR is ~12 files, ~900 LOC edited. See §1.2 for the table. Breakdown by Gate:

| Gate | Effort estimate | Notes |
|---|---|---|
| Gate 0 (audit) | DONE | This document |
| Gate 1 (canonical names everywhere) | ~3 h | LandingPage.tsx + index.html + PortalPage.tsx + CLAUDE.md + README.md + email templates |
| Gate 2 (legal cleanup) | ~1 h | 10 string edits in Klasifikátor + 1 in VerifyEmailPage + KROS FAQ delete + DB seed migration |
| Gate 3 (Hero + SEO) | ~2 h + design effort for og:image | depends on Q-G |
| Gate 4 (Prerender) | ~1 h | vite-plugin-prerender-spa, depends on Q-H |
| Gate 5 (Workflow + FORESTINA example) | ~2 h | SVG diagram + example rewrite |
| Gate 6 (TOV/multi-supplier visibility) | ~1 h | bullet rewrite in Modul 1 |
| Gate 7 (Persona-bundles in Ceník) | ~1 h | 3 bundle entries above table |
| Gate 8 (Footer trust signals) | ~30 min | IČ/address/EU hosting/GitHub link |
| Gate 9 (Cross-kiosk consistency) | ~1.5 h | Registr title + Kalkulátor title + Modul 4 status |
| Lead-gen form (Q5 of interview) | ~3 h | new component + endpoint + migration + tests |
| **Total** | **~16 h** + design effort outside repo | Excluding URS_MATCHER_SERVICE rename (separate PR) |

---

## 16. What I'm NOT changing without your approval

Per pre-implementation interview Q1 = "Manual approval first":

- Zero code edits will be made until you sign off on this report.
- After sign-off, I will proceed Gate-by-Gate, committing in atomic commits per Gate so each is reviewable.
- If any of the Q-A through Q-L decisions change scope, I will pause and re-confirm.

---

## 17. Sign-off

When you're ready to proceed:
1. Read §14 and answer Q-A through Q-L (or tell me to default to recommendations).
2. Confirm any divergences in §12 you'd like to handle differently.
3. Then I'll start Gate 1.

Ready when you are.
