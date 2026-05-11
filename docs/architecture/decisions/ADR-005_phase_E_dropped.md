# ADR-005: Drop Phase E (Engineering Drawings) from STAVAGENT Output

**Status:** Accepted
**Date:** 2026-05-07
**Deciders:** Alexander (founder), Claude (technical analysis)
**Pilot project:** Žihle 2062-1 D&B tendr

---

## Context

Žihle pilot (April-May 2026) included experimental **Phase E** — auto-generate situace
M 1:500 SVG drawings from multimodal sources:

- **GPX trace** (Mapy.cz manual measurement, 116 m provizorium, 6 GPS points)
- **DXF kataster** (1986 entities, 36 layers, S-JTSK coordinate system)
- **Phase B parameters** (most 9.0 × 8.30 m, šikmost 50°)
- **Site photos** (orientation reference)

### What we built

`build_situace_v2.py` (Python svgwrite) generates technical drawing-style SVG:
- M 1:500 scale, A3 portrait
- Title block, scale bar, north arrow, legenda
- Bridge polygon (rotated by šikmost relative to road direction)
- Provizorium GPX trace overlay
- Mladotický potok schematic
- Záboru pozemku polygon

**Outputs:**
- `04_documentation/výkresy/C.2.1_situace_M1_500.svg`
- `04_documentation/výkresy/C.2.1_situace_M1_500.png`

### Quality assessment

✅ **Pipeline works** — multimodal extraction → vector drawing
✅ **Geometry accurate** — GPS within ±1-3 m, DXF coordinates exact
⚠️ **Visual quality "engineering schematic"** — not CAD-grade
⚠️ **Iterations needed** for orientation correction (provizorium side, bridge rotation)
❌ **Not production-grade** for DPS submission

---

## Decision

**STAVAGENT does NOT produce engineering CAD drawings as deliverable.**

Phase E experiments are **deprecated**. Capability retained for **internal validation
tooling only**.

---

## Reasoning

### 1. CAD is mature engineering domain (30+ years)

AutoCAD (1982), Revit (2002), MicroStation, ZWCAD, BricsCAD — these tools are:
- **Vector-native** with mathematical precision
- **Layer-based** for complex multi-discipline drawings
- **Standards-compliant** (ČSN ISO 128 for technical drawings, layers per VL 4)
- **Plotter-ready** with proper line weights, hatches, dimensions
- **Feedback loops** with engineering offices for decades

Competing as AI-generated SVG = **technically and economically infeasible**.

### 2. Real DPS requires authorized projektant signature

CZ legal requirement: výkresové dokumentace pro stavebné povolení musí být:
- **Signed by autorizovaný projektant** (ČKAIT certification)
- **Liability-bound** to that person
- **Reviewed by statik** for structural elements

AI-generated drawings:
- **Cannot be signed** (no ČKAIT certification)
- **Cannot bear liability** (legal entity required)
- **Will not be accepted** by stavebný úřad without overlay from real projektant

Even if AI drawing 100% accurate → real projektant must redraw in AutoCAD with their seal.
Our work = wasted effort.

### 3. STAVAGENT moat is in different domain

**Where STAVAGENT wins:**
- Text/data layer extraction (TZ, soupis prací)
- Multi-source intelligence (KB + calculator + vendor + manual)
- Audit trail generation (formula + vstupy + kroky + confidence)
- Reconciliation framework (3-source triangulation)
- TSKP hierarchical organization
- Vendor pricing integration

**Where STAVAGENT cannot win:**
- Vector drawing precision and tools
- Engineering domain expertise depth
- Legal/liability framework
- Specialized rendering (sections, details, isometrics)

**Strategic principle:** narrow scope, deeper moat. Don't dilute value proposition by
attempting tasks where mature tools dominate.

### 4. User feedback validates pivot

Direct user quote (2026-05-07):
> "не очень получилось но уже хоть со стороны наверное забьем это не важно
> наверно не надо так делать вообще"

Translation: not worth pursuing, drop it.

User experience confirms theoretical analysis.

---

## What we KEEP

### Capability for internal validation
The geometric extraction pipeline (GPX + DXF + Phase B params → coordinate system)
is **valuable** for:

1. **Sanity check** — Phase A/B dimensions consistent across sources?
2. **Cross-validation** — vendor situace vs our Phase B params match?
3. **Audit trail** — visual representation of "what we extracted"
4. **Internal QA workflow** — projektant reviews extraction visually before approval

### Optional marketing illustrations
For pitch decks, investor materials, marketing:
- **Nano Banana** (Gemini 2.5 image, ~$0.04/img)
- **GPT-4o image generation** for hero visuals
- **Clearly labeled "AI illustration, not engineering drawing"**

These have NO claim to engineering accuracy — purely visual.

---

## What we DROP

### Phase E as workflow stage
- ❌ No `Phase E` deliverable in workflow A→B→C→D→...
- ❌ No `výkresy/` directory mandatory in `04_documentation/`
- ❌ No SVG/PDF as "professional drawings"

### Pretense of CAD-grade quality
- ❌ Title blocks emulating ČSN ISO 7200
- ❌ Scale bar 1:500 implying engineering accuracy
- ❌ Legenda mimicking real výkresová dokumentace

These create false expectations. Either deliver real CAD or don't pretend.

### Žihle Phase E artifacts status
- `build_situace_v2.py` → moved to `tools/internal/geometry_extraction/`
- `C.2.1_situace_M1_500.svg` → kept v `04_documentation/výkresy/` with header comment:
  ```
  <!-- INTERNAL VALIDATION TOOL — NOT FOR TENDER SUBMISSION
       Real engineering drawings must be produced by authorized projektant in AutoCAD.
       This SVG is auto-extracted geometry for QA/sanity-check purposes only. -->
  ```

---

## Consequences

### Positive
1. **Sharper product positioning** — "AI for text/data, projektant for drawings"
2. **Reduced engineering complexity** — no CAD library maintenance, no layer standards
3. **Lower customer expectations** alignment — real customers know they need projektant
4. **Faster pilot iteration** — Phase A→D done in days, not weeks
5. **Clearer pricing model** — STAVAGENT data layer + 3rd party CAD = transparent

### Negative
1. **Deliverable looks "incomplete"** — TZ + soupis without drawings
2. **Customer education needed** — explain why we don't do drawings
3. **Marketing visuals require alternative** — Nano Banana / GPT-4o for pitch
4. **Some real projektants prefer integrated tool** — CAD + smety in one

### Mitigation
- **Customer communication:** "STAVAGENT generates 80% of D&B documentation
  (TZ + soupis prací). Drawings produced by your projektant in AutoCAD/Revit.
  We integrate via standard exports (DWG/DXF/PDF)."
- **Partnership opportunity:** referral pipeline with projekční kanceláře (mutual benefit)
- **Future re-evaluation:** if AI CAD tools mature significantly (5+ years), reconsider

---

## Validation criteria

ADR-005 considered **successful** if:
- ✅ STAVAGENT pilot Žihle complete without engineering drawings (achieved 2026-05-07)
- ✅ Customer feedback distinguishes STAVAGENT scope from CAD work
- ✅ No customer churn citing missing drawings as primary reason
- ✅ Reduced engineering load on STAVAGENT team

ADR-005 considered **needs revision** if:
- ⚠️ Multiple customers cite drawings as deal-breaker
- ⚠️ Mature open-source AI CAD tool emerges (e.g., AutoCAD with native AI)
- ⚠️ Legal framework changes allowing AI-signed drawings
- ⚠️ Direct competitor offers AI drawings successfully

---

## References

- **Pilot project:** Žihle 2062-1 (test-data/most-2062-1-zihle/)
- **Phase E artifacts:** commit `218f03a2` (initial), iteration `zihle_situace_v2.svg`
- **STAVAGENT patterns:** `docs/STAVAGENT_PATTERNS.md`
- **Related ADRs:** ADR-001 (audit trail mandatory), ADR-003 (calculator deterministic default)

---

## Appendix: Alternative considered — Generate DXF for projektant import

**Idea:** instead of "final" SVG, produce DXF with extracted geometry for projektant
to import into AutoCAD as starting layer.

**Why rejected:**
- Projektant already has tools to extract from GPX/DXF (their workflow)
- DXF generated by AI may have wrong layer conventions per office standards
- Liability concerns — projektant accepts liability only for own work
- Adds maintenance burden for marginal value

**Decision:** not worth implementing. Projektant workflow undisturbed.
