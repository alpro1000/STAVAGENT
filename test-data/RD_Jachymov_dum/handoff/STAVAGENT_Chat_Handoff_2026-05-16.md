# STAVAGENT Chat Handoff — RD Jáchymov

**Datum:** 2026-05-16
**Předchozí session typ:** Chat (Claude Opus 4.7)
**Další session typ:** Claude Code — Phase 0b Validation + Phase 1 Generator
**Branch pro pokračování:** `claude/rd-jachymov-phase-0b-foundation`

---

## 1. Stav projektu

Nový sideline freelance projekt přiveden Karlem Šmídem (dnešní zaměstnavatel Alexandra). Investor Mgr. Jindřich Volný žije v Německu. Projektantské studio SMASH architekti (Marek Smolka) + statika TeAnau (Jan Tvardík) + PBŘ TUSPO. Stupeň dokumentace: **DSP, DPS plánována není.**

Cíl: cenová nabídka na zpracování rozpočtu (CN). Dvě stavební akce:
- **260219** — rekonstrukce + nástavba RD Fibichova 733 (104,4 m² zast., 219,3 m² podlahová, 987 m³ obest.)
- **260217** — zahradní sklad + parkovací stání + přístupové schodiště (lichoběžník 6,35×3,34 m)

**Předaná investiční hodnota odhadem:** ~6,0–8,5 M Kč bez DPH.

---

## 2. Co bylo uděláno v chat session 2026-05-16

V chat session (token budget použit pro extraction + skeleton):

### 2.1 Vstupy přijaté
- 6 PDF TZ od Karla Šmída přes OneDrive linky:
  - `B_Souhrnna_TZ_EAR.pdf` — souhrnná pro oba objekty (SMASH)
  - `D_1_1_01_TZ_ARS_dum_EAR.pdf` — ARS dům (SMASH)
  - `D_2_1_TZ_statika_dum_TeAnau.pdf` — statika dům (TeAnau)
  - `D_3_PBR_dum_TUSPO.pdf` — PBŘ dům (TUSPO)
  - `D_1_1_00_TZ_ARS_sklad_EAR.pdf` — ARS sklad/parking (SMASH)
  - `D_2_1_TZ_statika_sklad_TeAnau.pdf` — statika sklad/parking (TeAnau)

### 2.2 Struktura vytvořena
```
test-data/RD_Jachymov_dum/
├── inputs/
│   ├── tz/
│   │   ├── 260217_sklad/           ← 2 PDF
│   │   ├── 260219_dum/             ← 3 PDF
│   │   └── common/                 ← 1 PDF (B souhrnná)
│   ├── vykresy_pdf/                ← PRÁZDNÉ (čeká na audit UNSORTED)
│   ├── vykresy_dxf/                ← PRÁZDNÉ (čeká na audit UNSORTED)
│   ├── situace/                    ← PRÁZDNÉ (čeká na audit UNSORTED)
│   └── meta/
│       ├── project_header.json     ← confidence-tagged facts, 280+ řádků
│       ├── inventory.md            ← co máme / co chybí
│       ├── stupne_dokumentace.md   ← DSP only, no DPS
│       └── vyjasneni_queue.json    ← 12 ABMV items
├── outputs/
│   └── work_candidates_skeleton.json  ← skeleton po kapitolách
├── handoff/
│   └── STAVAGENT_Chat_Handoff_2026-05-16.md   ← tento soubor
└── deliverables/
    └── CN_draft_3_varianty_pro_Karela.md   ← navrh emailu Karlovi
```

### 2.3 Extrakce hotová
Z 6 TZ extrahováno do `project_header.json`:
- Identifikační údaje (4 firmy, 5 osob s ČKAIT)
- Geometrie obou objektů
- Stávající i navrhovaný stav konstrukcí dům (krov, stropy, podlahy, fasáda, schodiště, opěrná stěna bílá vana)
- Konstrukce sklad (gravitační opěrná stěna H-BLOK, IPE180 parking, dřevěné stropnice)
- TZB dům (kamna + elektrokotel + krb + multisplit TČ + bojler)
- Geologie (svor R5-R6, F4-CS, Rdt 300-350 kPa, XA1, sníh VII., vítr III.)
- Materiály (betony, ocel S235, výztuž, ETICS, EPS, krytina)
- PBŘ (P1.01/N3, pv=45.75, SPB II., odstupy)
- Bilance odpadů z TZ B
- 12 ABMV vyjasnění (3 critical, 7 important, 2 medium/low/info)

---

## 3. Co MUSÍ udělat Claude Code v Phase 0b (next session)

### 3.1 Pre-Phase 0b — audit UNSORTED

**KRITICKÉ:** Alexander v chatu uvedl že "ВСЕ ДОКУМЕНТЫ ВКЛЮЧАЯ DXF Я ВЛОЖИЛ В ПАПКУ НА ГИТ ХАБ test-data/RD_Jachymov_dum/UNSORTED". Před spuštěním Phase 0b agent musí:

1. `ls -la test-data/RD_Jachymov_dum/UNSORTED/` → výpis všech souborů
2. Identifikovat typy: výkresy PDF (D.1.1, D.1.2, C.x situace), DXF, případně PDF přílohy statiky/PBŘ
3. Přesunout do správných podsložek:
   - Půdorysy + řezy + pohledy → `inputs/vykresy_pdf/260219_dum/` nebo `/260217_sklad/`
   - DXF → `inputs/vykresy_dxf/<objekt>/`
   - C.1/C.2/C.3 → `inputs/situace/`
   - PBŘ pro sklad pokud existuje → `inputs/tz/260217_sklad/`
4. Aktualizovat `inputs/meta/inventory.md` s reálným stavem
5. **STOP** a vrátit kontrolu uživateli pokud něco kritického chybí.

### 3.2 Phase 0b — Validation (cross-check `project_header.json`)

Per hk212 pattern:

1. **Independent re-parse** všech 6 TZ PDF přes existující `pdfplumber` + `MinerU` fallback
2. **Regex extraction** z každého TZ:
   - Třídy betonu `C\d{1,2}/\d{1,2}`
   - Expozice `X[CFDSAB]\d?`
   - Třídy oceli `S\d{3}[JR]?\d?`
   - Klasifikace požární odolnosti `(EI|EW|R|REI)\s*\d+\s*DP[123]?`
   - Normy `ČSN(\s+EN)?\s+\d+(?:-\d+)?`
   - Rozměry `\d+\s*×\s*\d+\s*mm`
3. **DXF independent parse** pokud DXF dodány — `ezdxf` INSERT blocks count + DIMENSION extraction + MTEXT/TEXT labels per layer
4. **Cross-check** každý claim v `project_header.json`:
   - Match → `verified: true, confidence: 1.0`
   - Drift → `drift_detected`, lower confidence, generate VYJASNĚNÍ candidate
   - Missing → `missing_evidence`, confidence 0.30 hard-fail
5. **Output**: `outputs/validation_report.json` se sekcemi:
   - `validated_claims`
   - `silent_drifts`
   - `new_findings`
   - `recommended_vyjasneni`
6. Pokud > 5 silent drifts → STOP před Phase 1.

### 3.3 Phase 1 — Generator (work_candidates → items.json)

Po úspěchu Phase 0b:

1. **Použít existující pipeline**: NEPSAT nové parsing/classification/lookup logic
   - `app/parsers/pdf_*.py`
   - `app/parsers/dxf_*.py`
   - URS_MATCHER service (Cloud Run)
   - OTSKP database `otskp.db` (17904 položek)
   - Knowledge base B4_productivity (rebar rates Methvin.org)
2. **Generation per kapitola** podle skeleton v `outputs/work_candidates_skeleton.json`
3. **Confidence ladder** mandatory:
   - regex match URS/OTSKP code = 1.0
   - DXF INSERT block count = 0.95
   - regex on description in TZ = 0.85
   - URS_MATCHER fuzzy + Perplexity rerank = 0.85
   - AI Gemini Flash = 0.70
4. **Output**: `outputs/items_rd_jachymov_complete.json` se schema:
   - `kapitola`
   - `popis` (Czech)
   - `mj` (m, m², m³, kg, t, ks, bm, kpl, paušál)
   - `mnozstvi` (calculated)
   - `urs_code` (matched nebo null)
   - `urs_status` (matched_high / matched_medium / no_match / needs_review)
   - `urs_alternatives` (top 3 candidates pokud no_match)
   - `source` (TZ kapitola nebo DXF identifier)
   - `confidence`
   - `objekt` (260219_dum / 260217_sklad / shared_VRN)
   - `_vyjasneni_ref` (list of vyjasneni ids)

### 3.4 Phase 2 — Excel deliverable

Po Phase 1 + invariants gate:

1. Excel jako 2 listy (dům + sklad) + souhrn = 3 listy minimum
2. Sloupce: pol.č., URS kód, popis, MJ, množství, J.cena (NULL pro varianta A), Cena celkem (NULL), poznámka
3. Filename: `Vykaz_vymer_RD_Jachymov_<varianta>_<datum>.xlsx`

---

## 4. Důležitá pravidla (per memory + STAVAGENT principy)

### 4.1 Naming
- **NIKDY** nepřidávat nové názvy "ze vzduchu". Naming odvodit z existujících konvencí v repu (Libuše D, Žihle 2062, hk212_hala precedenty).
- Pokud agent nenajde existující konvenci pro nový případ → **STOP a AskUserQuestion**.

### 4.2 Determinismus
- Regex pro concrete grades, OTSKP/URS kódy, dimenze → conf 1.0
- LLM jen jako fallback když regex selhává nebo sémantická interpretace

### 4.3 Karpathy rules
- Don't assume
- Minimum code
- Surgical changes
- Goal-driven
- **Audit before plan**

### 4.4 Pre-implementation interview (mandatory)
Před prvním řádkem kódu agent **musí** spustit AskUserQuestion pro:
- A) Repo discovery — kde jsou existující parsers, jaký je URS_MATCHER signature, jak query OTSKP
- B) Output structure — JSON only / + Excel rovnou? Subdodavatel mapping?
- C) Scope — položkový vs. agregovaný (cíl uživatele!)
- D) Working approach — etapový/najednou; audit trail

### 4.5 PR discipline
- Branch: `claude/rd-jachymov-phase-0b-foundation`
- One branch per task, commits pushed
- **PR NEOTVÍRAT** dokud uživatel explicitly nepožádá

### 4.6 No-PR-unless-asked
Per user memory: "Sequential PR work, not parallel"

---

## 5. Otázky které jsou v queue pro Karla / projektanta

Viz `inputs/meta/vyjasneni_queue.json` — 12 items.

**Critical (blokující):**
- #1 — Potvrzení rozsahu rozpočtu (varianta A/B/C)

**Important:**
- #2 — Třetí objekt (parkování Dvořákova) — součást 260217?
- #3 — Dostupnost výkresů (DXF/PDF)
- #4 — Skladby podlah
- #5 — Výpisy oken/dveří/klempířiny
- #6 — Specifikace TZB (kW, ks)
- #7 — Rozsah ELI

**Před odesláním e-mailu** musí Karel potvrdit variantu CN. Bez toho je e-mail pojektantovi předčasný.

---

## 6. Deliverable pro Karla (priority 1)

`deliverables/CN_draft_3_varianty_pro_Karela.md` obsahuje:
- Stručný popis projektu rozsahu (2 objekty, DSP only)
- 3 varianty rozpočtu A/B/C s cenou a termínem
- Otázky pro Karla aby vybral variantu

Po výběru varianty:
- Agent připraví formální CN dokument (PDF/DOCX) s VOP a podmínkami
- Agent odešle ABMV email projektantovi se zbývajícími vyjasněními

---

## 7. Co tato pilot session přidá do STAVAGENT corpus

- **N=5 reálný projekt** v korpusu (po Libuše D, Žihle 2062-1, hk212_hala, SO-250 most)
- **DSP-only pipeline** — první ostrá zkušenost (předchozí projekty měli DPS nebo D&B)
- **Bílá vana ČBS 02** — první real-world aplikace technologie v STAVAGENT (předchozí jen z theory)
- **Krov ocelobeton hybridní** — IPE180 + HEA160 + dřevěné kleštiny + trapézový plech + nabetonávka
- **Malý RD scope** (~110-150 položek očekávaných) — kontrast vs. Libuše D (4090 items)

---

## 8. Připomenutí pro budoucí Claude Code session

Před prvním řádkem kódu:
1. ✅ Číst CELÝ `inputs/meta/project_header.json` (280+ řádků)
2. ✅ Číst `inputs/meta/inventory.md`
3. ✅ Číst `inputs/meta/stupne_dokumentace.md` (znát limity DSP)
4. ✅ Číst `inputs/meta/vyjasneni_queue.json`
5. ✅ Číst `outputs/work_candidates_skeleton.json` (skeleton po kapitolách)
6. ✅ `ls test-data/RD_Jachymov_dum/UNSORTED/` (audit nedoručeného)
7. ✅ Spustit AskUserQuestion pre-implementation interview
8. ✅ Vytvořit branch `claude/rd-jachymov-phase-0b-foundation`

**Až pak** psát kód.
