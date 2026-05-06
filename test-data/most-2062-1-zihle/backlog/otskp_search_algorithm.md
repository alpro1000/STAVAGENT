# Backlog Ticket #2 — OTSKP Search Algorithm

**Priority:** P1 (HIGH)
**Type:** Engineering / search infrastructure
**Origin:** Master Soupis Reconciliation, Žihle 2062-1, Session 1 audit (2026-05-06)
**Affects:** `concrete-agent/app/api/`, `concrete-agent/app/services/`, KB `B2_otskp/`
**Related gap:** G2 in `04_documentation/reconciliation_report.md`

---

## 1. Problem Statement

The current OTSKP integration in `concrete-agent` exposes a **lookup-by-exact-code** API
(`/api/otskp/code/{code}`) but **no semantic / fuzzy search** to translate "Manual rozpočtář
typed: VOZOVKOVÉ VRSTVY ZE ŠTĚRKODRTI TL. DO 250MM" into "OTSKP code 56335".

Žihle 2062-1 audit shows manual ground truth XLS uses **121 OTSKP codes**, but Phase D
soupis (`otskp_mapping.yaml`) was **manually populated by Claude Code session** — i.e.
literally one human-in-the-loop translation per element. There is **no automated path**:

```
Manual user input "ZÁKLADY ZE ŽELEZOBETONU C30/37"
     ↓ (current state: rozpočtář googluje OTSKP-SP, kopíruje 272325)
     ↓
Future state: API call /api/otskp/search?q=zaklady%20zelezobeton%20C30
     ↓ → returns [{code: 272325, conf: 0.95, ...}, {code: 272324, ...}]
```

This blocks:
1. **Calculator → Soupis** automation (Backlog #1 calculator extension delivers element_type;
   soupis still needs OTSKP code per element type).
2. **AI advisor** (`get_construction_advisor` MCP tool) — currently can't suggest specific
   OTSKP codes for non-template scenarios.
3. **Master soupis re-build** (Phase D) — currently 8 hours of human time per project for
   ~60 položek manual mapping.

---

## 2. Why This Matters Now

1. **MCP tool `find_otskp_code`** already exists but is anchor-based (matches by exact
   prefix or full text containment). Real Czech rozpočtář queries are **conjunctive +
   fuzzy** ("vozovka štěrkodrť 250 mm" → 56335 not 56333 nor 56336 — typology + parameter).

2. **17,904 OTSKP codes** in DB (per existing `otskp_engine.py`) — too many for manual
   browsing. Search is the only viable UX.

3. **Reconciliation evidence:** Žihle 2062-1 exposed 23 OTSKP codes in manual XLS that
   were **not** in Phase D Master Soupis (cross-check reconciliation_report § 2-3). All
   were missed because the human session focused on hlavní mostní položky.

---

## 3. Proposed Algorithm

### 3.1 4-Stage Pipeline (current → enhanced)

```
Query: "VÝZTUŽ MOSTNÍCH NOSNÝCH DESEK Z OCELI 10505 B500B"
     ↓
Stage 1: NORMALIZE
  - Lowercase, remove diacritics, strip filler ("z oceli", "do", "tl.")
  - Tokenize: ["vyztuz", "mostni", "nosna", "deska", "10505", "B500B"]
     ↓
Stage 2: TYPOLOGY DETECT (regex on TSKP class hints)
  - "deska" + "mostni" → třída 4 (vodorovné konstrukce)
  - "vyztuz" → suffix 365/366 patterns
  - Filter candidate set: třída 4 výztuž → ~12 codes
     ↓
Stage 3: PARAMETER MATCH
  - "10505" or "B500B" → ocelová třída → narrow to 421366 family
  - "C30/37" + "vyztuz" → no-op, výztuž neřeší beton class
  - Top 3 candidates: [421366, 421365, 420365]
     ↓
Stage 4: CONFIDENCE SCORE
  - Exact tokens (10505, B500B) found in 421366 popis: +0.50
  - třída + suffix match: +0.30
  - cross-validation against negative-context filter (skip "stávající"): +0.10
  - SCORE: 421366 conf=0.90, 421365 conf=0.65, 420365 conf=0.55
```

### 3.2 API Surface

```http
GET /api/otskp/search?q=...&context=...&top_k=5

Response:
{
  "query": "vyztuz mostnich nosnych desek 10505 B500B",
  "results": [
    {"code": "421366", "popis": "VÝZTUŽ MOSTNÍCH NOSNÝCH...", "mj": "T",
     "confidence": 0.90, "match_evidence": ["typology:t4", "param:10505",
     "param:B500B", "neg_filter:passed"]},
    {"code": "421365", "popis": "...", "confidence": 0.65, ...},
    ...
  ],
  "method": "4-stage pipeline",
  "elapsed_ms": 45
}
```

### 3.3 Tooling Stack

- **Tokenizer:** Python `unicodedata.normalize('NFD', ...)` + custom Czech stopword list
  ("z", "ze", "do", "tl.", "do tloušťky", "atd.")
- **TSKP class detector:** regex map `{r"\bzakla(d|dy)\b": "2"}, ...`
- **Parameter extractor:** regex pre-existing v `tz-text-extractor.ts` (Monolit-Planner) —
  reuse pattern logic
- **Storage:** `otskp_codes` table existing v `concrete-agent` DB (17904 rows). Add column
  `tokens_normalized TEXT[]` + GIN index pro full-text search.
- **Confidence rubric:** see `concrete-agent/app/services/calculator_suggestions.py`
  pattern (regex=1.0, OTSKP DB=1.0, drawing_note=0.90, …)

---

## 4. Acceptance Criteria

- [ ] `/api/otskp/search?q=...` endpoint returns top-K results with confidence ≥ 0.5
- [ ] **80 % top-1 accuracy** on Žihle SO_201 manual XLS query set (62/77 položek)
- [ ] **95 % top-3 accuracy** (recall@3 ≥ 73/77)
- [ ] Response time < 100 ms for queries up to 10 tokens
- [ ] `_safe_search` negative filter integration (skip stávající/odstraněno)
- [ ] MCP tool `find_otskp_code` upgraded to use `/search` endpoint instead of code-anchor
- [ ] Test fixture: `tests/fixtures/zihle_otskp_queries.json` s 77 query/expected pairs
- [ ] Optional: web UI in `stavagent-portal` `/otskp/search` page

---

## 5. Out of Scope

- ÚRS/RTS/RTSrozp catalog search (those are different code systems — separate ticket)
- LLM fallback path (OpenAI/Bedrock embedding search) — keep deterministic-first per
  CLAUDE.md "Determinism > AI" rule

---

## 6. Test Data

- Primary: `04_documentation/manual_reference_JS/SO_201_parsed.yaml` (77 položek s OTSKP
  + popis + mj + množství) → 77 query/expected pairs
- Secondary: `04_documentation/manual_reference_JS/SO_180_parsed.yaml` (30 položek) → 30
- Benchmark target: top-1 = 80 %, top-3 = 95 %
- Hold-out: Kfely SO 201 ground truth (different format, validate generalization)

---

## 7. Estimated Effort

- DB schema + GIN index migration: ~8 h
- 4-stage pipeline implementation: ~24 h
- Test fixtures (107 query/expected pairs from XLS): ~6 h
- API endpoint + MCP wrapper: ~8 h
- Performance tuning (target < 100 ms): ~6 h
- Web UI (optional): ~12 h
- **Total: ~52-64 h**

---

## 8. Future Extensions (Post-MVP)

1. **TSKP class auto-suggest:** when user types "vozovka", system suggests třída 5
   filter pre-applied
2. **Cross-language search:** EN ↔ CZ ("rebar" → "výztuž 10505")
3. **OTSKP-SP version awareness:** 2025 vs 2026 catalog diff handling
4. **Vendor-specific catalog:** map OTSKP code ↔ DOKA/PERI/ULMA part numbers

---

## 9. Cross-References

- Reconciliation gap matrix: `04_documentation/reconciliation_report.md` § 6 G2
- OTSKP mapping (current Žihle): `04_documentation/otskp_mapping.yaml`
- Existing OTSKP infra: `concrete-agent/packages/core-backend/app/api/otskp.py`
- MCP tool: `concrete-agent/app/mcp/tools/otskp.py` (find_otskp_code)
- KB B2 OTSKP: `concrete-agent/packages/core-backend/app/knowledge_base/B2_otskp/`
- Confidence rubric: see CLAUDE.md > Conventions > "Confidence: regex=1.0, …"
