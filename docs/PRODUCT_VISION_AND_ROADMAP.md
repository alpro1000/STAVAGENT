# Product Vision & Architecture Roadmap

**Version:** 1.0.0
**Date:** 2026-03-06
**Status:** Approved (product boundary fixed)

---

## 1. Product Identity

**Monolit Planner** = upper-level planning tool for monolithic concrete cycle.

NOT:
- specialized formwork design software (Doka/PERI level)
- universal construction platform
- full engineering design tool
- bolt-level formwork projector

IS:
- approximate monolithic cycle calculator
- orientation on what systems to use
- timeline estimation
- data handoff to TOV / budget / scheduling

### One-liner

> Practical tool for preliminary production planning of monolithic concrete works.

---

## 2. What Monolit Planner Must Calculate

Full monolithic cycle, not just formwork:

1. **Formwork** (assembly / relocation / stripping)
2. **Rebar Lite** (mass, duration, crew estimate)
3. **Concreting as operation** (duration, window, pump flag)
4. **Technological pauses / curing**
5. **Stripping**
6. **Kit relocation to next capture**

Planner does NOT contain full commercial pump logistics.

---

## 3. Element Classifier

Planner needs a classifier that identifies the structure type first, then calculates.

### Recognized Elements

| Element | Typical Formwork | Notes |
|---------|-----------------|-------|
| zaklad / zakladova patka / pas | Simple side / small-panel | |
| zakladova deska | Edge formwork (on ground); slab system + supports (elevated) | |
| stena / operna stena | Wall formwork + ties, braces, platforms | |
| sloup / pilir | Column formwork; round = separate system | |
| opora | Wall-type + special supports | |
| mostovka / deska mostu | Panels + support system / skruz / tower | Auto-flag: supports needed |

### Per-Element Understanding

- Formwork type
- Support structures needed?
- Working platforms needed?
- Crane needed?
- Auxiliary systems?
- Special cycle features?

---

## 4. Formwork Calculation

### Three Phases (cannot be single line)

| Phase | Description | Labor differs |
|-------|-------------|---------------|
| Initial assembly | First cycle setup | Highest |
| Cycle relocation | Move kit to next capture | Medium |
| Final stripping | Last dismantling | Lowest |

### Capture Modes

**Mode A** — Number of captures given directly.

**Mode B** — Kit area given:
```
captures = ceil(total_m2 / kit_m2)
```

**Mode C** — Neither given, use normative productivity:
- assembly rate
- relocation rate
- stripping rate
- approximate duration

---

## 5. Rebar Lite

Simple reinforcement calculator inside Planner.

### What It Calculates
- Rebar mass (kg)
- Tying / installation duration
- Approximate crew requirement
- Basic labor costs

### When Exact Mass Unknown

Use specific reinforcement ratio by element type:
- foundation: ~80-120 kg/m3
- wall: ~60-100 kg/m3
- column: ~100-200 kg/m3
- bridge deck: ~120-180 kg/m3

Early stage = approximation is OK.

---

## 6. Concreting in Planner

### What Planner Provides
- Approximate pour duration
- Required time window
- Pump needed flag (yes/no)
- Approximate delivery rate

### What Planner Does NOT Do
- Detailed pump commercial breakdown
- Supplier selection
- Tariff comparison

---

## 7. Pump Calculator (Separate Module)

### Architecture Decision

**ONE Pump Engine + different shells:**
- Planner calls it in simplified mode
- TOV calls it in detailed mode
- Standalone UI can exist separately

### Two Modes

**Lite Mode** (for estimator / pripravak):
- Quick orientation
- Hours estimate
- Cost range
- Pump class range
- Warnings

**Detailed Mode** (for site manager / stavbyvedouci):
- Specific supplier
- Specific pump
- Date + time window
- Setup + washing + idle
- Overtime / weekend / holiday surcharges
- Full cost breakdown
- Risk flags

### Core Calculation Principle

Effective delivery = MIN of:
- Pump technical capacity
- Plant production rate
- Mixer truck delivery rate
- Site placement constraint
- Placement crew tempo

### Full Duration

```
total = setup + pour + waiting + cleaning + extra
```

### Cost Structure

```
total = base_rate + setup + transport + washing + idle + overtime + weekend + extra
```

### Three Layers

1. **Technical**: volume, structure type, concrete type, delivery constraint, site constraint, time window
2. **Commercial**: supplier, pump type, minimum order, rates, surcharges
3. **Calendar**: date, day of week, holiday, allowed hours, overflow handling

---

## 8. Supplier Registry

### Design Requirements
- Unlimited suppliers
- Multiple regions
- Multiple tariff profiles per supplier
- Tariff versioning (valid_from, valid_to)
- Verification tracking (last_verified_at, verified_by, source_type)
- Status: official / estimated / user-entered / contract-specific

### Two-Level Database
1. **Public base** — general market rates
2. **Company base** — contract-specific pricing (private)

### Tariff Entities
- Supplier registry
- Tariff profiles
- Pump classes
- Regional availability
- Calendar rules
- Client-specific overrides

---

## 9. System Architecture

```
UI Shells
  |- Monolit Planner UI
  |- TOV UI
  |- Standalone Pump UI
  |- Standalone Formwork UI
  |- Standalone Rebar UI

Application Layer
  |- Planner Orchestrator
  |- TOV Orchestrator
  |- Scenario / Risk Orchestrator
  |- Export / Report API

Domain Cores
  |- Monolit Planner Core
  |    |- Element Classifier
  |    |- Formwork Engine
  |    |- Rebar Lite Engine
  |    |- Pour Task Engine
  |    |- Graph Builder
  |    |- CPM Engine
  |    |- Resource Constraint Engine
  |
  |- TOV Core
  |    |- Resource breakdown
  |    |- Cost calculation
  |    |- Machinery
  |    |- Labor
  |    |- Materials
  |
  |- Shared Services
       |- Pump Engine
       |- Calendar Engine
       |- Norms / Catalog Lookup
       |- Monte Carlo Engine
       |- Provenance / Audit Log
```

---

## 10. Math Model Layers

### Layer 1: Deterministic Engineering Model
Lives in: Formwork Engine, Rebar Lite, Pour Task Engine

Calculates:
- Areas, volumes, masses
- Cycle counts
- Assembly / relocation / stripping duration
- Effective productivity
- Coefficients

### Layer 2: Graph Model
Lives in: Graph Builder, CPM Engine

DAG of operations:
- formwork -> rebar -> inspection -> pour -> curing -> strip -> move
- Capture-to-capture kit transfer modeled as graph edge

Calculates:
- Early / late start & finish
- Float
- Critical path

### Layer 3: Resource Model
Lives in: Resource Constraint Engine, Calendar Engine

Constraints:
- Kit availability
- Crew allocation
- Crane schedule
- Pump availability
- Pour windows
- Weekends & holidays

### Layer 4: Stochastic Model (Phase 3)
Lives in: Monte Carlo Engine

Random factors:
- Productivity variance
- Concrete delivery delays
- Equipment downtime
- Weather
- Organizational risks

Output: P50 / P80 / P90 probabilities, deadline risk, sensitivity analysis

---

## 11. MVP Roadmap

### Monolit Planner

**Phase 1 (Current + Next)**
- [x] Graph Builder (DAG, Kahn's topo sort)
- [x] CPM Engine (ES/EF/LS/LF/float)
- [x] RCPSP parallel scheduling (82 tests)
- [x] PERT 3-point estimation (20 tests)
- [x] Concrete maturity model CSN EN 13670 (21 tests)
- [x] Formwork calculator v3 (consolidation + curing)
- [ ] Element Classifier
- [ ] Formwork Engine (3-phase: assembly/relocation/stripping)
- [ ] Rebar Lite Engine
- [ ] Pour Task Engine
- [ ] Planner Orchestrator (combine all engines into cycle)

**Phase 2**
- [ ] Calendar Engine (weekends, holidays, work windows)
- [ ] Pump integration (Lite mode call)
- [ ] Resource leveling (crew/crane/kit constraints)

**Phase 3**
- [ ] Monte Carlo simulation
- [ ] Scenario comparison
- [ ] Optimization modes (min time / min cost / balanced)

### Pump Calculator

**MVP-1**
- [x] Multi-supplier pump calculator (3 billing models)
- [x] Practical performance data (25-40 m3/h)
- [x] Supplier comparison
- [ ] Lite mode UI (quick estimate)
- [ ] 5-10 suppliers with verified tariffs
- [ ] Holiday/weekend basic logic
- [ ] Basic comparison table

**MVP-2**
- [ ] Detailed mode UI (full breakdown)
- [ ] Overtime / weekend / holiday surcharges
- [ ] Per-line cost breakdown
- [ ] Export (Excel/PDF)
- [ ] TOV integration

**MVP-3**
- [ ] Calculation history
- [ ] Scenario saving
- [ ] API for Planner integration
- [ ] Risk estimates
- [ ] Company-specific tariff overrides

### Cross-System (Backlog)

- [ ] Breadcrumbs (Portal <- Kiosk back-navigation)
- [ ] Template application workflow testing
- [ ] Two-way sync Portal <-> Registry
- [ ] Deploy Portal Backend (user action: Render)
- [ ] Environment variables (PERPLEXITY_API_KEY, OPENAI_API_KEY)

---

## 12. Commercial Packaging

### Monolit Planner
Sell as: "preliminary production planning of monolithic works"
NOT as: "formwork design software" or "AI construction platform"

### Pump Calculator
Three tiers:
1. **Basic** (estimator): quick orientation, price range, pump class options
2. **Professional** (site manager): exact date, supplier, full breakdown, calendar surcharges
3. **Corporate** (company): own suppliers, own tariffs, own regions, TOV/Planner integration, audit trail

### Product Boundary Formula

```
Monolit Planner  = upper-level monolithic cycle planning
TOV              = resource breakdown (materials / machinery / labor / cost)
Pump Calculator  = detailed operational pump cost calculation
Graph            = sequencing and critical path
Math model       = duration, resource, constraint, and risk formulas
Product boundary = no bolts, no vendor-level engineering, practical value only
```

---

**Last Updated:** 2026-03-06
