# TASK — UEP PR4 — MEP Matrices + IFC Diff Full + UI + Performance

> **STAVAGENT PR4.** Final UEP rollout PR. Adds MEP D.1.4 detailed 
> coverage matrices (7 subtypes), gbXML adapter, full IFC diff engine 
> (quantity deltas + narrative), UI visualization in Portal/Registry 
> kiosks, performance optimization pass.
> 
> **Reference document:** `docs/TASK_DocumentExtraction_Universal_Pipeline.md` 
> (v3 spec).
> 
> **Prerequisite:** PR3 merged. All five major project types (residential, 
> bridge, road, industrial, mep_only) work end-to-end.
> 
> **Note:** This task is more skeletal than PR2/PR3. Specifics depend 
> on learnings from PR1 verification + PR2 + PR3 — final calibration 
> happens at task refresh just before PR4 starts.

---

## MANTRA

> Read repo first (incl. all merged UEP code) → derive naming → confirm 
> interview answers → implement.

---

## §0. CONTEXT

After PR3, UEP works for residential + bridge + road + industrial 
project types with DXF + DWG + PDF + XML + IFC inputs. 

What remains:
- MEP-only projects need detailed sub-discipline matrices (silnoproud, 
  slaboproud, ZTI, VZT, ÚT, plyn, MaR — 7 subtypes)
- gbXML format (energy modeling exports)
- IFC diff engine currently only emits add/remove/modify GlobalId 
  lists — need quantity deltas, material change analysis, narrative
- All UEP outputs exist as JSON in GCS but no UI to view them — kiosks 
  need viewing components
- Performance optimization (PR1-3 prioritized correctness)

---

## §1. SCOPE

Per v3 task §10 PR4 line:

1. MEP D.1.4 detailed matrices (7 subtypes)
2. gbXML adapter (v3 §3.1.3)
3. Full IFC diff engine (v3 §15.3.4) — quantity deltas, material 
   changes, narrative summary, severity classification
4. UI visualization in Portal + Registry kiosks
5. Performance optimization

NOT in PR4 (deferred to future):
- Multi-region deployment
- Real-time streaming inputs
- Multi-user concurrency on same project
- IFC versioning incremental re-extraction (vs full)
- Custom DWG version reverse engineering
- Cross-author IFC merging

---

## §2. PRE-IMPLEMENTATION INTERVIEW

**Q16 — MEP matrix scope:**
- (A) 7 separate matrices, one per subtype (silnoproud / slaboproud / 
  ZTI / VZT / ÚT / plyn / MaR)
- (B) 1 shared `mep_common` matrix + 7 specialization deltas
- (C) Hierarchical: `mep_base` → `mep_d14_<subtype>` extending base

Recommend **C** (avoids duplication, allows shared categories like 
"rozvodnice locations" + subtype-specific deltas).

**Q17 — UI integration scope:**
- (A) Both Portal + Registry get coverage / reconciliation / IFC diff 
  viewers
- (B) Portal only (consumer-facing) — Registry as internal admin tool
- (C) Registry only (developer-facing dashboard) — Portal CTA links to it

Recommend **A** for completeness, with Portal as primary viewer and 
Registry as power-user view.

**Q18 — Performance optimization priority:**
- (A) Profile first, optimize hottest paths
- (B) Specific known bottlenecks (IFC streaming, DWG conversion, big 
  PDF tables)
- (C) Defer until production hits scaling issue

Recommend **B** (targeted, known issues from PR1-3 runs).

**Q19 — Full IFC diff complexity level:**
- (A) Implement everything (quantity deltas + material changes + narrative 
  + severity classification + visualization)
- (B) Phase 1 of full diff: quantity deltas + material changes. Narrative 
  + visualization as PR5.
- (C) Skip narrative AI generation (deterministic numeric diff only)

Recommend **B** (deterministic diff in PR4, AI narrative as opt-in PR5).

---

## §3. BUSINESS LOGIC

### 3.1 MEP detailed matrices

Per Q16=C hierarchical:

`coverage_matrix_mep_base.yaml` — shared categories:
- rozvaděč locations (D.1.4 общие)
- kabelové trasy
- referenced ČSN norms
- safety classifications
- coordination with other professions

`coverage_matrix_mep_d14_silnoproud.yaml` — extends base:
- celkový instalovaný výkon (kW, kVA)
- rozvaděče (count + typ)
- kabely (typy, sečení)
- střídače (pro FVE)
- ochrana proti přepětí
- ochrana proti zkratu

`coverage_matrix_mep_d14_slaboproud.yaml`:
- EPS (požární poplachová signalizace)
- kamerový systém
- UTP/FTP rozvody
- detektory CO / kouř

`coverage_matrix_mep_d14_zti.yaml`:
- DN potrubí (kanalizace, voda)
- průtoky l/s
- tlaky
- čerpadla
- typy potrubí (PE, PP, ocel)

`coverage_matrix_mep_d14_vzt.yaml`:
- průtoky m³/h
- tlakové ztráty Pa
- VZT jednotky (typy, výkony)
- rekuperace (účinnost)
- typy rozvodů

`coverage_matrix_mep_d14_ut.yaml`:
- tepelné výkony kW
- typy zdrojů (kotel / TČ / dálkové vytápění)
- radiátory (typy + výkony)
- podlahové vytápění
- otopná tělesa

`coverage_matrix_mep_d14_plyn.yaml`:
- DN potrubí
- tlak kPa
- HUP (hlavní uzávěr)
- spotřebiče

`coverage_matrix_mep_d14_mar.yaml`:
- čidla (teplota, vlhkost, CO₂, presence)
- regulátory
- BMS (Building Management System)
- typy komunikačních protokolů (KNX, BACnet, Modbus)

Each matrix ~15-25 categories.

Project type detection updated: detect MEP subtype from filename + TZ 
content. Multi-subtype project (D.1.4 silnoproud + slaboproud + ZTI in 
single package) → all relevant matrices applied, results aggregated.

### 3.2 gbXML adapter

Per v3 §3.1.3:

Parse:
- Root: `gbXML` in `http://www.gbxml.org/schema`
- Spaces (orientation, area)
- Surfaces (constructions, materials)
- HVAC zones

Relevant for D.1.4 ÚT/VZT integration. Maps to MEP facts.

Wrap existing lxml infrastructure from PR3 XML adapters.

### 3.3 Full IFC diff engine

Per Q19=B: deterministic diff complete, AI narrative as PR5.

Extend basic diff from PR3 with:

**Per-category counts:**
```yaml
diff_summary:
  spaces: { added: 3, removed: 0, modified: 2 }
  walls: { added: 12, removed: 1, modified: 8 }
  slabs: { added: 0, removed: 0, modified: 1 }
  doors: { added: 4, removed: 2, modified: 0 }
  windows: { added: 7, removed: 0, modified: 3 }
  beams: { added: 0, removed: 0, modified: 0 }
  columns: { added: 0, removed: 0, modified: 0 }
  ...
```

**Quantity deltas:**
```yaml
quantity_deltas:
  total_wall_area_m2: { from: 1450.2, to: 1485.7, delta: +35.5, pct: +2.4 }
  total_slab_area_m2: { from: 980.1, to: 982.4, delta: +2.3, pct: +0.2 }
  total_concrete_volume_m3: { from: 245.6, to: 251.2, delta: +5.6, pct: +2.3 }
  ...
```

**Material composition changes:**
Per entity, if `IfcMaterialLayerSet` changed → record layer-level diff.

**Property set changes:**
Per entity, if `IfcPropertySet` values changed → record property-level diff.

**Severity classification (rule-based, not AI):**
- `cosmetic`: only material colors / naming changed
- `minor`: <5% quantity delta, no structural changes
- `moderate`: 5-15% quantity delta, or property changes
- `major`: >15% quantity delta, or structural elements added/removed
- `scope_change`: >50% entity changes (triggers v3 §9 STOP condition #11)

Severity per-entity + aggregate per-project.

**Output format (PR4):**
```
ifc_diff_reports table:
  ... existing PR3 fields ...
  category_counts JSONB        -- v4
  quantity_deltas JSONB        -- v4
  material_changes JSONB       -- v4
  property_changes JSONB       -- v4
  severity_aggregate VARCHAR   -- v4
```

`uep_get_ifc_diff` MCP tool returns full diff.

PR5 (future): AI narrative generation via Claude Sonnet, severity-aware 
prose output.

### 3.4 UI visualization

Kiosk components (React in Portal + Registry):

**Coverage report viewer:**
- Per-category status (filled / partial / missing / N/A)
- Source attribution links (click → see raw fact + provenance)
- Filter by status
- Export to PDF for handoff

**Reconciliation report viewer:**
- Conflicts grouped by severity
- Confirmed multi-source agreements
- Side-by-side comparison for conflicts
- Resolution suggestions

**IFC diff viewer:**
- Side-by-side version timeline
- Category-level diff counts
- Click category → see entity-level adds/removes/modifications
- Quantity delta charts
- Severity badge per change

**Derivation audit viewer:**
- Per derived quantity: formula + inputs + sources + confidence
- Reverse-trace from quantity back to evidence

Implementation: existing kiosk patterns (Portal in stavagent.cz, 
Registry in registry.stavagent.cz). Use existing component library + 
shadcn/ui where applicable.

API: existing PR2 REST endpoints, no new ones needed.

### 3.5 Performance optimization

Q18=B targeted bottlenecks:

**IFC streaming optimization:**
- Profile multi-pass streaming on 1GB+ fixture
- If per-pass GC overhead >20% wall time → switch to pickle/joblib model 
  caching between passes
- Target: 30% reduction in 1GB+ IFC parse time

**DWG conversion parallelization:**
- If project has 5+ DWG files, currently serial ODA conversion
- Implement parallel conversion (up to 4 concurrent ODA subprocesses)
- Target: 60% reduction in DWG-heavy project Phase 1 time

**Big PDF table extraction:**
- pdfplumber `extract_tables()` on 100+ page PDFs is slow
- Profile, consider:
  - Pre-pass: identify pages likely containing tables (heuristic on text 
    density / table marker keywords)
  - Skip table extraction on pages with no table markers
- Target: 40% reduction in TZ-heavy project Phase 1 time

**Reconciliation engine batching:**
- Current: 1 rule × all fact pairs sequential
- Optimization: parallelize independent rules
- Target: linear scaling with rule count (currently quadratic)

Acceptance criterion: end-to-end times reduce by 25%+ on largest test 
fixtures (Žihle 2062 bridge corpus, multi-IFC fictional project).

---

## §4. ACCEPTANCE CRITERIA

### MEP matrices
1. 7 subtype matrices created (per Q16=C hierarchical)
2. `mep_base` shared base
3. Each subtype matrix ≥15 categories
4. Multi-subtype project aggregation works
5. Project type detection updated for MEP subtypes

### gbXML
6. gbXML adapter parses spaces / surfaces / HVAC zones
7. Integration with MEP D.1.4 ÚT/VZT matrices

### IFC diff full
8. Per-category counts computed
9. Quantity deltas computed (aggregated by entity type)
10. Material composition changes detected per-entity
11. Property set changes detected per-entity
12. Severity classification per-entity + aggregate
13. `ifc_diff_reports` table extended with new fields (Alembic migration)
14. `uep_get_ifc_diff` MCP tool returns full diff

### UI
15. Coverage report viewer in Portal + Registry
16. Reconciliation report viewer in Portal + Registry
17. IFC diff viewer in Portal + Registry
18. Derivation audit viewer in Portal + Registry
19. Export-to-PDF for coverage + reconciliation reports
20. All viewers responsive (desktop + tablet, mobile acceptable)

### Performance
21. IFC streaming on 1GB+ fixture: -30% time
22. DWG conversion parallel: -60% time on 5+ DWG projects
23. Big PDF TZ extraction: -40% time on 100+ page TZs
24. Reconciliation: linear scaling per rule count
25. End-to-end on Žihle bridge corpus: -25% total time

### Testing
26. MEP matrix tests per subtype
27. gbXML adapter tests
28. Full IFC diff tests (severity classification corner cases)
29. UI component tests (React Testing Library)
30. Performance regression tests in CI

### Documentation
31. `docs/architecture/mep_d14_coverage.md` documenting subtype matrices
32. `docs/architecture/ifc_diff_engine.md` documenting full diff algorithm
33. User-facing docs for UI viewers (help text in-app)

---

## §5. STOP CONDITIONS

1. MEP subtype categorization unclear (a project doesn't fit any of 
   the 7 subtypes cleanly) → STOP, ask user
2. gbXML reference samples not available in corpus → STOP, ask user for 
   sample upload before adapter writeup
3. UI integration breaks existing kiosk routes → ROLLBACK, STOP
4. Performance optimization causes correctness regression → ROLLBACK 
   optimization, keep correctness
5. IFC diff severity classification produces obviously-wrong results on 
   test fixtures → STOP, recalibrate thresholds before continuing

---

## §6. NAMING & PR

Branch: `claude/uep-pr4-mep-uidiff-perf`  
PR: open at end of session, request review.  
Title: `feat(uep): PR4 — MEP matrices + IFC diff full + UI + performance`

This is a large PR. Consider splitting into PR4a (MEP + gbXML), PR4b 
(IFC diff full), PR4c (UI), PR4d (perf) if scope feels overwhelming. 
Decide based on time budget at session start.

---

## §7. UEP MILESTONE

After PR4 merge, UEP is **production-ready** for the Cemex CSC submission 
(28.06.2026 deadline).

Remaining post-PR4 follow-ups (separate scope, not blocking Cemex):
- AI narrative for IFC diff (PR5)
- Multi-region deployment
- Real-time streaming inputs
- IFC versioning incremental re-extraction
- Custom DWG version handling
- Cross-author IFC merging
- Advanced derivation rules (Bayesian updating, sensitivity analysis, 
  symbolic regression) — per memory roadmap, gated on N=10+ corpus

---

**End of PR4 task.**

> Reminder: PR4 is rollout-completion + production-readiness. No new 
> architectural patterns — only fulfilling the v3 spec to completion.
