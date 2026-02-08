# Session 2026-02-08: URS Matcher - Price Module + Norms KB

**Date:** 2026-02-08
**Branch:** `claude/continue-implementation-96tR9`
**Service:** URS_MATCHER_SERVICE

---

## Summary

Implemented Phase 3-5 of URS Matcher enhancement:
- **Phase 3:** 6 specialist roles for project analysis
- **Phase 4:** Norms knowledge base with web search (Brave + Tavily)
- **Phase 5:** Complete price module with DEK.cz and betonárny parsers

---

## Commits

```
bebd3dc FIX: Add named export for TRUSTED_SOURCES in webSearchClient
b7bceb8 FEAT: Add DEK.cz and concrete supplier parsers
d0a88a0 FEAT: Add price module with commercial offers and history tracking
54a1130 FEAT: Add norms knowledge base with web search integration
73c9de7 FEAT: Add project analysis with 6 specialist roles
57396fc FEAT: Apply runtime model selection to all LLM endpoints
```

---

## Phase 3: 6 Specialist Roles

### Files Created
- `services/projectAnalysis/roles.js` - Role definitions
- `services/projectAnalysis/orchestrator.js` - Multi-role coordination
- `api/routes/projectAnalysis.js` - API endpoints

### Roles
| ID | Name (CZ) | Name (RU) | Focus |
|----|-----------|-----------|-------|
| KONSTRUKTOR | Statik-konstruktér | Конструктор | Structural integrity, loads |
| BETONAR | Betonář-technolog | Бетонщик | Concrete mix, placement |
| ROZPOCTAR | Rozpočtář | Сметчик | Cost estimation, KROS |
| NORMOKONTROLER | Normokontrolér | Нормоконтролёр | Standards compliance |
| TECHNOLOG | Technolog výroby | Технолог | Production methods |
| KOORDINATOR | Koordinátor projektu | Координатор | Project management |

### API Endpoints
```
POST /api/project-analysis/analyze   - Full analysis with all roles
POST /api/project-analysis/role/:id  - Ask specific role
GET  /api/project-analysis/roles     - List all roles
```

---

## Phase 4: Norms Knowledge Base

### Files Created
- `services/norms/webSearchClient.js` - Brave + Tavily integration
- `services/norms/normParser.js` - ČSN/EN parsing and normalization
- `services/norms/knowledgeBase.js` - JSON file storage with indexing
- `services/norms/normsService.js` - Orchestrator
- `api/routes/norms.js` - API endpoints

### Norm Types Supported
- **ČSN** - Czech national standards (e.g., ČSN 73 2400)
- **ČSN EN** - European standards (e.g., ČSN EN 13670)
- **ČSN ISO** - International standards
- **Vyhláška** - Ministry decrees
- **Zákon** - Laws
- **TP/TKP** - Technical conditions

### Trusted Sources
```
csnonline.agentura-cas.cz   - ČSN online
unmz.cz                      - ÚNMZ (standardization office)
tzb-info.cz                  - Technical info portal
zakonyprolidi.cz             - Laws database
mmr.cz                       - Ministry for Regional Development
```

### Storage Structure
```
data/knowledge_base/
├── norms/
│   ├── csn/           - ČSN norms
│   ├── csn_en/        - ČSN EN norms
│   ├── csn_iso/       - ČSN ISO norms
│   ├── laws/          - Laws
│   ├── vyhlaska/      - Decrees
│   ├── tp/            - Technical conditions
│   └── tkp/           - Quality conditions
├── index/
│   └── main.json      - Search index
└── cache/             - Temporary cache
```

### API Endpoints
```
GET /api/norms/search              - Search norms
GET /api/norms/fetch/:code         - Fetch specific norm
GET /api/norms/laws                - Search building laws
GET /api/norms/relevant            - Get project-relevant norms
GET /api/norms/work/:description   - Get norms for work type
GET /api/norms/stats               - KB statistics
POST /api/norms/import             - Import norms
```

---

## Phase 5: Price Module

### Files Created
- `services/prices/priceSources.js` - Source definitions
- `services/prices/priceDatabase.js` - Storage + history
- `services/prices/priceService.js` - Orchestrator
- `services/prices/dekParser.js` - DEK.cz parser
- `services/prices/concreteSupplierParser.js` - Betonárny parser
- `api/routes/prices.js` - API endpoints

### Price Priority System
```
Priority 1: Commercial offer (project-linked)
Priority 2: Recent database price (< 7 days old)
Priority 2.5: Web search result (DEK.cz, betonárny)
Priority 4: Default/experience fallback
```

### DEK.cz Categories
| ID | Name | Products |
|----|------|----------|
| ZDIVO | Zdivo | Cihly, tvárnice, příčkovky |
| IZOLACE | Izolace | EPS, XPS, minerální vata |
| SUCHE_VYSTAVBA | Suchá výstavba | Sádrokarton, profily |
| STRECHY | Střechy | Krytiny, střešní okna |
| FASADY | Fasády | Omítky, ETICS systémy |
| PODLAHY | Podlahy | Dlažby, potěry |

### Concrete Suppliers
| ID | Company | Coverage |
|----|---------|----------|
| HOLCIM | Holcim Česko | Praha, Brno, Ostrava, Plzeň |
| CEMEX | CEMEX Czech Republic | Praha, Brno, Ostrava |
| TBG_METROSTAV | TBG METROSTAV | Praha, Střední Čechy |
| CESKOMORAVSKY_BETON | Českomoravský beton | Praha, Brno, Morava |
| ZAPA | ZAPA beton | Praha, Střední/Západní Čechy |
| FRISCHBETON | Frischbeton | Praha, Brno |

### Concrete Classes with Typical Prices
| Class | Description | Typical Price |
|-------|-------------|---------------|
| C8/10 | Podkladní beton | 2,200 Kč/m³ |
| C16/20 | Konstrukční beton | 2,600 Kč/m³ |
| C20/25 | Standardní | 2,800 Kč/m³ |
| C25/30 | Nosné konstrukce | 3,000 Kč/m³ |
| C30/37 | Náročnější konstrukce | 3,300 Kč/m³ |
| C35/45 | Vysokopevnostní | 3,600 Kč/m³ |
| C40/50 | Prefabrikáty | 4,000 Kč/m³ |
| SCC | Samozhutnitelný | 3,800 Kč/m³ |

### Storage Structure
```
data/prices/
├── prices/
│   ├── beton/         - Concrete prices
│   ├── armatura/      - Reinforcement
│   ├── zdivo/         - Masonry
│   └── izolace/       - Insulation
├── offers/
│   └── {projectId}/   - Commercial offers by project
├── history/
│   └── 2026-02/       - Monthly price history
└── cache/             - Temporary cache
```

### API Endpoints

#### General Prices
```
GET  /api/prices/find              - Find price by category/code
POST /api/prices/offer             - Upload commercial offer
GET  /api/prices/offers/:projectId - Get project offers
POST /api/prices/manual            - Manual price entry
POST /api/prices/import            - Bulk import
GET  /api/prices/analyze           - Price trend analysis
POST /api/prices/compare           - Compare sources
GET  /api/prices/sources           - List price sources
GET  /api/prices/categories        - List categories
```

#### DEK.cz
```
GET /api/prices/dek/find           - Search DEK product
GET /api/prices/dek/catalog/:cat   - Browse catalog
GET /api/prices/dek/product/:id    - Lookup by article number
GET /api/prices/dek/categories     - DEK categories
```

#### Concrete
```
GET  /api/prices/concrete/find         - Find concrete price
GET  /api/prices/concrete/compare      - Compare suppliers
GET  /api/prices/concrete/supplier/:id - Supplier price list
POST /api/prices/concrete/delivery     - Calculate delivery cost
GET  /api/prices/concrete/classes      - All concrete classes
GET  /api/prices/concrete/suppliers    - All suppliers
```

---

## Database Architecture Discussion

### Current State
The STAVAGENT system uses distributed databases:

| Service | Dev | Production | Link Key |
|---------|-----|------------|----------|
| Portal | SQLite | PostgreSQL | `portal_project_id` |
| Monolit | SQLite | PostgreSQL | `project_id` → kiosk_links |
| URS Matcher | SQLite | SQLite | `portal_project_id` in jobs |
| CORE | - | PostgreSQL | `core_project_id` |
| Registry | - | localStorage | No backend |

### New Modules Storage
- **Prices:** JSON files (not SQL) - `data/prices/`
- **Norms:** JSON files (not SQL) - `data/knowledge_base/`
- **Offers linked via:** `projectId` = `portal_project_id`

---

## Bug Fixed

### TRUSTED_SOURCES Export Error
**Error:** `SyntaxError: The requested module './webSearchClient.js' does not provide an export named 'TRUSTED_SOURCES'`

**Cause:** `TRUSTED_SOURCES` was only in default export, but `normsService.js` used named import.

**Fix:** Added named export:
```javascript
export { TRUSTED_SOURCES };
```

---

## Next Steps

### Phase 6: Technology Calculations
- [ ] Formwork area from concrete volume
- [ ] Reinforcement estimation (kg/m³)
- [ ] Work sections breakdown
- [ ] Integration with Monolit-Planner formulas

### Phase 7: Kiosk Integration
- [ ] Link prices to Monolit positions
- [ ] Share norms KB with concrete-agent
- [ ] Unified data flow via Portal

### Technical Debt
- [ ] Add tests for price/norms modules
- [ ] Add API documentation
- [ ] Consider SQLite instead of JSON files

---

## Environment Variables Required

```env
# Web Search APIs
BRAVE_API_KEY=...           # Brave Search (2000 free/month)
TAVILY_API_KEY=...          # Tavily API

# LLM for extraction
ANTHROPIC_API_KEY=...
GOOGLE_AI_KEY=...
OPENAI_API_KEY=...

# concrete-agent integration
STAVAGENT_API_URL=https://concrete-agent.onrender.com
```

---

*Session completed successfully. All tests passing (108/108).*
