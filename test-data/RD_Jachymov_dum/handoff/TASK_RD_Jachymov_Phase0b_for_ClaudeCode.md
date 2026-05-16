# TASK: RD Jáchymov — Phase 0b Validation + Phase 1 Generator

**Project:** RD Fibichova č.p. 733 Jáchymov (sideline freelance přes Karel Šmíd)
**Setup commit:** TBD (až položíš tento adresář do repa)
**Branch pro tuto tasku:** `claude/rd-jachymov-phase-0b-foundation`
**Předpokládaná doba:** 2–4 hodiny (menší než hk212 — DSP-only, nemá D.1.4)

---

## §0 МАНТРА (povinné číst před každým krokem)

1. **Než začneš psát ANY kód:** přečti CELÝ relevantní úsek repa STAVAGENT — parsers (`app/parsers/`), AI reasoner (`app/ai/`), URS matcher service, knowledge base (`app/knowledge_base/B1`–`B9`), předchozí projekty (`test-data/libuse/`, `test-data/zihle/`, `test-data/hk212_hala/`).
2. **Naming, file structure, class names, table names** odvozuj POUZE z existujících konvencí repa. NIKDY nevytvářej nové názvy "ze vzduchu". Pokud nemůžeš najít existující konvenci pro nějaký případ — STOP a zeptej se uživatele.
3. **Use existing tools, NOT new ones.** Máš parsers (pdfplumber, MinerU, ezdxf), classifiers, knowledge base, URS matcher, multi-provider AI. NEPSAT vlastní DXF parsing logic — `ezdxf` wrapper už pravděpodobně existuje.
4. **Confidence ladder mandatory** (viz §5).
5. **Determinism před AI.** Regex pro concrete grades, dimenze, OTSKP/URS kódy → confidence 1.0. LLM používej JEN jako fallback když regex selhává nebo když je potřeba sémantická interpretace.
6. **Pre-implementation interview povinný** — viz §2. Žádný kód před dokončením interview.

---

## §1 KONTEXT

### Co je v repu k dispozici (po chat session 2026-05-16)

Projekt `RD_Jachymov_dum` byl inicializován v chat sessions Alexander × Opus 4.7 dne 2026-05-16. Setup přinesl:

**6 PDF TZ v `test-data/RD_Jachymov_dum/inputs/tz/`:**
- `common/B_Souhrnna_TZ_EAR.pdf` — souhrnná TZ pro oba objekty (SMASH, M. Smolka)
- `260219_dum/D_1_1_01_TZ_ARS_dum_EAR.pdf` — ARS dům
- `260219_dum/D_2_1_TZ_statika_dum_TeAnau.pdf` — statika dům (Tvardík, Bendík)
- `260219_dum/D_3_PBR_dum_TUSPO.pdf` — PBŘ dům (Kirschbaum, Tuček)
- `260217_sklad/D_1_1_00_TZ_ARS_sklad_EAR.pdf` — ARS sklad+parking
- `260217_sklad/D_2_1_TZ_statika_sklad_TeAnau.pdf` — statika sklad+parking

**Výkresy v `inputs/vykresy_pdf/` a `inputs/vykresy_dxf/`:**
- Alexander v chatu uvedl že vše uložil do `test-data/RD_Jachymov_dum/UNSORTED/` v repu, vč. DXF
- **Phase 0b první akce:** audit `UNSORTED/` a přesun do správných podsložek (viz §3.1)

**Meta soubory (pre-baked, k verifikaci):**
- `inputs/meta/project_header.json` — confidence-tagged facts z chat session (~280 řádků). ⚠️ **NESMÍ být použit jako ground truth.** Phase 0b musí independently re-parse.
- `inputs/meta/inventory.md` — co máme, co chybí
- `inputs/meta/stupne_dokumentace.md` — DSP only, DPS neplánována
- `inputs/meta/vyjasneni_queue.json` — 12 open items pro projektanta

**Outputs (zatím skeleton):**
- `outputs/work_candidates_skeleton.json` — caркас rozpočtu po kapitolách (~140 položek očekávaných)

---

## §2 PRE-IMPLEMENTATION INTERVIEW (povinné před zápisem kódu)

Agent **musí** použít AskUserQuestion tool před každou z těchto skupin otázek. **Žádný kód před vyřízením interview.**

### A) Repo discovery
- Jaké parsers existují v `app/parsers/` pro PDF / DXF? Jejich vstupy a výstupy?
- Kde běží URS_MATCHER service (Cloud Run URL nebo lokální endpoint)? Jak je signature volání?
- Jaká je struktura `app/knowledge_base/B1`–`B9`? Která je relevantní pro tuto stavbu (RD rekonstrukce + nástavba + bílá vana opěrné stěny)?
- Jaký je canonical schema items.json v existujících projektech (Libuše D, Žihle 2062-1, hk212_hala)?
- Kde je `subdodavatel_mapping.json` v1.1+ s granular schema?
- Jaká je struktura `otskp.db` a `URS201801.csv`? Jak je query API?
- Existuje již `regen_all_lists.py` orchestrator nebo musí být vytvořen?

### B) Output structure confirmation
- Vzhledem k velikosti projektu (~140 položek pro variantu B, ~30 pro A) — generovat `items_rd_jachymov_complete.json` a Excel rovnou, nebo jen JSON a Excel až po review uživatelem?
- Subdodavatel split — použít granular `_kapitola_popis_granular` schema z Libuše? Pro RD bude trades subset (mostly malíř, zedník, sádrokartonář, podlahář, klempíř, zámečník, tesař, krytinář, vodaři, elektroinstalatér; bez VZT, bez specialty trades hk212).
- Confidence threshold pro hard-fail — výchozí 0.30 OK?

### C) Scope confirmation (KRITICKÉ)
- Která **varianta rozpočtu** je cílem? A (agregovaný ~30 položek), B (položkový ÚRS ~140), C (hybrid ~80)? **Toto blokuje Phase 1 generator.** Alexander musí předem získat odpověď od Karla.
- DSP-only — agent **musí akceptovat omezení**, že u PSV výplní otvorů a TZB profesí budou výměry odhadem z geometrie + počtu místností, NE z výpisů prvků.
- Bílá vana opěrné stěny — agent extrahuje rozměry z TZ statika a vypočítá m³ + bedná m² + výztuž kg empiricky (120 kg/m³ Methvin norms). Confidence 0.85 (TZ regex) + 0.85 (empirická sazba).
- Krov hybrid (IPE180 + HEA160 + dřevěné kleštiny) — agent extrahuje rozměry profilů z TZ statika, NEPOČÍTÁ delky bez půdorysu střechy.
- VRN — použít empirický koeficient 5–7% z přímých nákladů, ne vypisovat detailně dokud nemá data.

### D) Working approach
- Etapový přístup — Phase 1 generuje **per kapitola po sobě** (nejdřív HSV-1, pak HSV-2, ...) s STOP gate mezi kapitolami? Nebo všechno najednou?
- Audit trail — DEPRECATED prefix pattern pro updates (jak v Libuše PROBE 14a), OK?
- VYJASNĚNÍ queue — agent může přidávat nová vyjasnění během Phase 1 do `vyjasneni_queue.json`, OK?
- Pokud DXF v UNSORTED **chybí** — STOP a vrátit kontrolu, nebo pokračovat s odhady z TZ?

**Pokud agent jakoukoli otázku skip nebo "rozhodne sám" — STOP a vrátí kontrolu uživateli s konkrétním dotazem.**

---

## §3 BUSINESS LOGIC — Phase 0b Validation

### 3.1 UNSORTED audit (PRVNÍ AKCE PŘED Phase 0b)

1. `ls -la test-data/RD_Jachymov_dum/UNSORTED/` → výpis všech souborů
2. Pro každý soubor identifikovat typ:
   - PDF výkres D.1.1.X — půdorys / řez / pohled → `inputs/vykresy_pdf/<objekt>/`
   - PDF výkres D.1.2.X — statika → `inputs/vykresy_pdf/<objekt>/`
   - DXF/DWG → `inputs/vykresy_dxf/<objekt>/`
   - C.X situace → `inputs/situace/`
   - PBŘ sklad pokud existuje → `inputs/tz/260217_sklad/`
   - Jiný typ → `inputs/unknown/` + flag
3. Aktualizovat `inputs/meta/inventory.md` se skutečným stavem souborů
4. Pokud chybí **kritické** (žádný půdorys, žádný řez) → STOP, vrátit kontrolu

### 3.2 Independent re-parse 6 TZ PDF

Per TZ PDF:
- Použít existující PDF parser (pdfplumber → MinerU fallback)
- Extract všechny regex-matchable tokens (viz §3.4 patterns)
- Pro nestrukturované odstavce → AI fallback (Gemini Flash, confidence 0.70)

### 3.3 DXF independent parse (pokud DXF k dispozici)

Per DXF soubor:
- Spočítat INSERT blocks per block name → unique blocks count
- Spočítat DIMENSION objects → extract `actual_measurement` values
- Extract všechny MTEXT/TEXT labels per layer
- Extract HATCH patterns
- Spočítat **plochu fasády po fasáde** (pro ETICS m²)
- Spočítat **plochu střechy** (pro krytinu m²)

### 3.4 Regex patterns pro extraction

```python
patterns = {
    "concrete_grade": r"C(\d{1,2})/(\d{1,2})",
    "exposure_class": r"X[CFDSAB]\d?",
    "consistency": r"S\d",
    "dmax": r"Dmax[.\s]*(\d+)",
    "cl_class": r"CL\s*(\d[.,]\d+)",
    "steel_grade": r"S\d{3}[JR]?\d?",
    "rebar_grade": r"B\d{3}[AB]?",
    "fire_class": r"(EI|EW|R|REI)\s*(\d+)\s*(DP[123])?",
    "csn_norm": r"ČSN(\s+EN)?\s+\d+(?:-\d+)?",
    "dimension_3d": r"(\d+)\s*[×x]\s*(\d+)\s*[×x]\s*(\d+)\s*mm",
    "dimension_2d": r"(\d+)\s*[×x]\s*(\d+)\s*mm",
    "thickness": r"(?:tl[.,]?|tloušť\w+)\s*(\d+(?:[,.]\d+)?)\s*mm",
    "area_m2": r"(\d+[,.]?\d*)\s*m[²2]",
    "volume_m3": r"(\d+[,.]?\d*)\s*m[³3]",
    "lambda_value": r"λ\s*=?\s*(\d[,.]\d+)\s*W/m[K]",
    "u_value": r"U[wnf]?\s*=?\s*(\d[,.]\d+)\s*W/m[²2]K",
    "Rdt_kPa": r"Rdt\s*=?\s*(\d+)\s*kPa",
    "tridy_zatizeni": r"VII\.?\s*sněhové|III\.?\s*větrové",
}
```

### 3.5 Cross-check vs `project_header.json`

Pro každý pre-baked claim:
1. Najít odpovídající evidence v independent parse
2. Pokud match → confirm s confidence 1.0, mark `verified: true`
3. Pokud nesoulad → flag jako `drift_detected`, lower confidence, generate VYJASNĚNÍ candidate
4. Pokud missing → flag jako `missing_evidence`, confidence 0.30 hard-fail

### 3.6 Output Phase 0b

Soubor `outputs/validation_report_rd_jachymov.json`:
```json
{
  "validated_claims": [...],
  "silent_drifts": [...],
  "new_findings": [...],
  "recommended_vyjasneni": [...]
}
```

Pokud > 5 silent drifts nebo jakýkoli claim s confidence < 0.30 → **STOP před Phase 1** a vrátí uživateli.

---

## §4 BUSINESS LOGIC — Phase 1 Generator

### 4.1 Cíl

Generate items per kapitola pro celý projekt podle `outputs/work_candidates_skeleton.json`. Output: `outputs/items_rd_jachymov_complete.json` s ~140 položkami (varianta B) nebo ~30 (varianta A).

### 4.2 Use existing pipeline

NEVYTVÁŘEJ nové parsing/classification/lookup logic. Použij:
- DXF parsing → existující wrapper okolo `ezdxf`
- PDF parsing → existující pdfplumber + MinerU fallback
- OTSKP database lookup
- URS_MATCHER service (2-stage: catalog + LLM rerank přes Perplexity)
- Knowledge base query do B4_productivity (rebar rates), B7_regulations (normy)
- AI reasoner pro semantic interpretation

### 4.3 Generation per kapitola

Použít skeleton z `outputs/work_candidates_skeleton.json` jako mandatorní seznam položek. Per kapitola:
1. Extract relevant data from TZ + výkresy
2. Calculate qty (priorita: DXF > regex z TZ > odhad z geometrie + count)
3. URS match (2-stage)
4. Confidence tag
5. Subdodavatel assign

### 4.4 Mandatory fields per item

- `kapitola`
- `popis` (Czech, normativní)
- `mj`
- `mnozstvi`
- `urs_code`
- `urs_status`
- `urs_alternatives` (top 3 pokud no_match)
- `source` (TZ kapitola nebo DXF identifier)
- `confidence`
- `objekt` (`260219_dum` / `260217_sklad` / `shared`)
- `subdodavatel`
- `_vyjasneni_ref` (list of vyjasneni ids)
- `_status_flag` (např. `working_assumption`, `pending_drawings`, `qty_from_estimate`)

---

## §5 Confidence ladder (mandatory)

| Source | Confidence |
|---|---|
| Regex match na URS/OTSKP code | 1.0 |
| DXF INSERT block count | 0.95 |
| DXF dimension extracted | 0.95 |
| Regex na description in TZ | 0.85 |
| URS_MATCHER fuzzy match (Perplexity rerank) | 0.85 |
| OTSKP exact match | 1.0 |
| OTSKP fuzzy match | 0.85 |
| URS_MATCHER catalog_only match | 0.80 |
| AI Gemini Flash | 0.70 |
| AI Claude Sonnet | 0.75 |
| Empirical productivity rates (Methvin norms) | 0.80 |
| Geometry-derived qty z TZ | 0.75 |
| Manual judgement | 0.99 |

**HARD RULE:** Nepřepisovat higher-confidence data lower-confidence.

---

## §6 Naming a struktura

Per memory of user — strict naming policy:
- Žádné konkrétní názvy souborů / proměnných / tříd v této tasku
- Naming odvozuj z existujících konvencí v repu
- Pokud neexistuje precedent — STOP a AskUserQuestion

Branch name již stanoven: `claude/rd-jachymov-phase-0b-foundation`

---

## §7 PR discipline

- One branch per task: `claude/rd-jachymov-phase-0b-foundation`
- Commits pushed na origin
- PR NE-otevírat, pokud uživatel explicitly nepožádá (no-PR-unless-asked policy)

---

## §8 Návrat kontroly uživateli

Po dokončení Phase 0b agent **vrátí kontrolu uživateli** s:
- Souhrnem silent drifts
- Confirmed vyjasnění (kolik z 12 vyřešeno samostatnou re-parse)
- Recommendation: pokračovat na Phase 1 nebo nejdříve vyřešit drifts

Po dokončení Phase 1 agent **vrátí kontrolu uživateli** s:
- Count summary per kapitola
- Total počet položek
- URS match rate (%)
- Top 10 položek bez URS match
- Recommendation pro Phase 2 (Excel)

---

**End of task. Před zápisem kódu spusť Pre-implementation Interview (§2).**
