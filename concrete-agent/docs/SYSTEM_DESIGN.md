# System Design - Concrete Agent

> Complete technical specification for the Concrete Agent construction cost estimation system

## Table of Contents

1. [System Overview](#system-overview)
2. [Workflow A: Import & Audit](#workflow-a-import--audit)
3. [Workflow B: Generate from Drawings](#workflow-b-generate-from-drawings)
4. [Multi-Role Expert System](#multi-role-expert-system)
5. [Data Models & Schemas](#data-models--schemas)
6. [API Contracts](#api-contracts)
7. [Knowledge Base Architecture](#knowledge-base-architecture)
8. [Parser Strategy & Fallbacks](#parser-strategy--fallbacks)
9. [Artifact Management](#artifact-management)
10. [Error Handling & Recovery](#error-handling--recovery)
11. [Testing Strategy](#testing-strategy)
12. [Performance & Scaling](#performance--scaling)

---

## System Overview

### Core Principles

1. **Modularity**: Clear separation between API, Service, Parser, and AI layers
2. **Robustness**: Multi-tier fallback chains for all critical operations
3. **Validation**: Schema-based validation at every layer boundary
4. **Traceability**: Full audit trail with detailed logging
5. **Extensibility**: Plugin architecture for parsers, KB modules, and validators

### System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                         Client Layer                          │
│  Web UI | Mobile App | API Clients | Claude Code Integration  │
└──────────────────────────────────────────────────────────────┘
                            │ HTTP/REST
┌──────────────────────────────────────────────────────────────┐
│                       API Layer (FastAPI)                     │
│  ┌───────────────┐  ┌───────────────┐  ┌──────────────────┐  │
│  │ routes_       │  │ routes_       │  │ routes.py        │  │
│  │ workflow_a.py │  │ workflow_b.py │  │ (utilities)      │  │
│  └───────────────┘  └───────────────┘  └──────────────────┘  │
│  • Request validation (Pydantic)                              │
│  • Response formatting (APIResponse)                          │
│  • Error handling & HTTP status codes                         │
└──────────────────────────────────────────────────────────────┘
                            │
┌──────────────────────────────────────────────────────────────┐
│                      Service Layer                            │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │ workflow_a  │  │ workflow_b   │  │ audit_service        │ │
│  └─────────────┘  └──────────────┘  └──────────────────────┘ │
│  ┌──────────────┐  ┌──────────────┐                          │
│  │ position_    │  │ project_     │                          │
│  │ enricher     │  │ cache        │                          │
│  └──────────────┘  └──────────────┘                          │
│  • Business logic orchestration                               │
│  • Workflow state management                                  │
│  • KB enrichment & validation                                 │
└──────────────────────────────────────────────────────────────┘
                            │
┌──────────────────────────────────────────────────────────────┐
│                      Parser Layer                             │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │ kros_parser │  │ pdf_parser   │  │ excel_parser         │ │
│  └─────────────┘  └──────────────┘  └──────────────────────┘ │
│  • Multi-format parsing (XML, Excel, PDF)                     │
│  • Fallback strategies (direct → API → AI)                    │
│  • Schema normalization                                       │
└──────────────────────────────────────────────────────────────┘
                            │
┌──────────────────────────────────────────────────────────────┐
│               AI Clients & Knowledge Base                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐│
│  │ claude_      │  │ gpt4_        │  │ perplexity_          ││
│  │ client       │  │ client       │  │ client               ││
│  └──────────────┘  └──────────────┘  └──────────────────────┘│
│  ┌──────────────┐  ┌──────────────┐                          │
│  │ kb_loader    │  │ rate_limiter │                          │
│  └──────────────┘  └──────────────┘                          │
│  • AI API integration with rate limiting                      │
│  • Knowledge base loading & indexing                          │
│  • Runtime KB enrichment                                      │
└──────────────────────────────────────────────────────────────┘
                            │
┌──────────────────────────────────────────────────────────────┐
│                    Data Storage Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐│
│  │ projects/    │  │ artifacts/   │  │ logs/                ││
│  │ {id}.json    │  │ (outputs)    │  │ (API calls)          ││
│  └──────────────┘  └──────────────┘  └──────────────────────┘│
│  • Project state persistence                                  │
│  • Artifact generation & caching                              │
│  • Audit trail & debugging logs                               │
└──────────────────────────────────────────────────────────────┘
```

---

## Workflow A: Import & Audit

### Overview

Workflow A processes existing cost estimates (Výkaz výměr/Rozpočet) from various sources, validates them against construction standards, and generates technical deliverables.

### Process Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. DOCUMENT UPLOAD                                              │
│    Client uploads: XML/Excel/PDF estimate + optional docs       │
│    ↓                                                             │
│ 2. FORMAT DETECTION                                             │
│    System detects: KROS XML | Excel | PDF                       │
│    ↓                                                             │
│ 3. PARSING (with fallback chain)                                │
│    Primary: Direct parser (KROS/Excel/PDF)                      │
│    Fallback 1: External API (Nanonets/MinerU)                   │
│    Fallback 2: AI-based (Claude Vision)                         │
│    ↓                                                             │
│ 4. SCHEMA VALIDATION & NORMALIZATION                            │
│    Validate fields, convert units, clean data                   │
│    Output: Standardized Position[] array                        │
│    ↓                                                             │
│ 5. PROJECT CACHE CREATION                                       │
│    Create /data/projects/{project_id}.json                      │
│    Status: "parsing_complete"                                   │
│    ↓                                                             │
│ 6. KB ENRICHMENT (position_enricher)                            │
│    Match positions against KB categories (B1-B9)                │
│    Add: relevant_norms, pricing_hints, tech_specs               │
│    ↓                                                             │
│ 7. MULTI-ROLE AUDIT (audit_service)                             │
│    Classification severity → role selection                     │
│    SME + ARCH + ENG + SUP (based on complexity)                 │
│    ↓                                                             │
│ 8. CLASSIFICATION (GREEN/AMBER/RED)                             │
│    GREEN (≥95%): Auto-approve                                   │
│    AMBER (75-95%): Review recommended                           │
│    RED (<75%): Requires human intervention (HITL)               │
│    ↓                                                             │
│ 9. ARTIFACT GENERATION                                          │
│    Tech Cards | Resource Sheets | Material Analysis             │
│    Excel Reports | Audit Summary                                │
│    ↓                                                             │
│ 10. COMPLETION                                                  │
│     Status: "audit_complete"                                    │
│     All artifacts cached in /data/projects/{id}/artifacts/      │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow Example

**Input** (KROS XML):
```xml
<UNIXML>
  <Polozky>
    <Polozka>
      <Cislo>1</Cislo>
      <Popis>Beton C30/37-XA2</Popis>
      <Mnozstvi>123.000</Mnozstvi>
      <MJ>m³</MJ>
      <Kod>121151113</Kod>
    </Polozka>
  </Polozky>
</UNIXML>
```

**After Parsing** (Normalized Position):
```json
{
  "position_number": 1,
  "code": "121151113",
  "description": "Beton C30/37-XA2",
  "quantity": 123.0,
  "unit": "m³",
  "unit_price": null,
  "total_price": null
}
```

**After Enrichment**:
```json
{
  "position_number": 1,
  "code": "121151113",
  "description": "Beton C30/37-XA2",
  "quantity": 123.0,
  "unit": "m³",
  "unit_price": 2850.0,
  "total_price": 350550.0,
  "enrichment": {
    "matched_kros_code": "121151113",
    "kros_name": "Beton konstrukční prostý",
    "relevant_norms": ["ČSN EN 206", "ČSN 73 2400"],
    "exposure_class": ["XA2"],
    "min_cover_mm": 50,
    "cement_type": "CEM III/B",
    "pricing_hint": {
      "source": "B3_current_prices",
      "avg_price_czk": 2850.0,
      "last_updated": "2024-10-15"
    }
  }
}
```

**After Audit**:
```json
{
  "position_number": 1,
  "code": "121151113",
  "description": "Beton C30/37-XA2",
  "quantity": 123.0,
  "unit": "m³",
  "classification": "GREEN",
  "confidence": 0.97,
  "audit": {
    "status": "approved",
    "classification": "GREEN",
    "confidence_score": 0.97,
    "evidence": [
      {
        "source": "kb_b1_urs_codes",
        "match_quality": "exact",
        "norm": "ČSN EN 206"
      }
    ],
    "expert_roles": ["SME"],
    "warnings": [],
    "recommendations": ["Consider XC2 exposure class for durability"],
    "hitl_required": false
  },
  "resources": {
    "labor": {
      "hours_per_unit": 0.5,
      "total_hours": 61.5,
      "crew_size": 4
    },
    "materials": [
      {
        "name": "Cement CEM III/B 42.5 R",
        "quantity": 36.9,
        "unit": "t",
        "unit_price": 3200.0
      },
      {
        "name": "Aggregate 0-22mm",
        "quantity": 221.4,
        "unit": "t",
        "unit_price": 450.0
      }
    ],
    "equipment": [
      {
        "name": "Concrete pump",
        "hours": 12.0,
        "rate": 1200.0
      }
    ]
  }
}
```

### API Endpoints (Workflow A)

#### 1. Upload Estimate

```http
POST /api/workflow/a/upload
Content-Type: multipart/form-data

Parameters:
  - estimate_file: File (required) - XML/Excel/PDF estimate
  - project_name: string (required) - Project name
  - project_description: string (optional) - Description
  - supporting_docs: File[] (optional) - Additional documents

Response 200 OK:
{
  "success": true,
  "project_id": "proj_abc123",
  "message": "Estimate uploaded and parsed successfully",
  "data": {
    "project_name": "My Project",
    "status": "parsing_complete",
    "total_positions": 45,
    "parsed_at": "2024-10-26T10:30:00Z",
    "format_detected": "kros_xml"
  }
}

Response 400 Bad Request:
{
  "success": false,
  "error": "Invalid file format. Supported: .xml, .xlsx, .xls, .pdf",
  "code": "INVALID_FORMAT"
}
```

#### 2. Get Project Status

```http
GET /api/workflow/a/{project_id}

Response 200 OK:
{
  "success": true,
  "data": {
    "project_id": "proj_abc123",
    "project_name": "My Project",
    "status": "audit_complete",
    "progress": {
      "parsing": "complete",
      "enrichment": "complete",
      "audit": "complete",
      "artifacts": "generating"
    },
    "summary": {
      "total_positions": 45,
      "green": 38,
      "amber": 5,
      "red": 2,
      "total_cost_czk": 15750000.0
    },
    "created_at": "2024-10-26T10:30:00Z",
    "updated_at": "2024-10-26T10:35:00Z"
  }
}
```

#### 3. Get Audit Results

```http
GET /api/workflow/a/{project_id}/audit

Response 200 OK:
{
  "success": true,
  "data": {
    "project_id": "proj_abc123",
    "audit_completed_at": "2024-10-26T10:35:00Z",
    "summary": {
      "total_positions": 45,
      "green_count": 38,
      "amber_count": 5,
      "red_count": 2,
      "average_confidence": 0.89
    },
    "positions": [
      {
        "position_id": "pos_001",
        "code": "121151113",
        "description": "Beton C30/37-XA2",
        "classification": "GREEN",
        "confidence": 0.97,
        "audit_details": { ... }
      }
    ],
    "recommendations": [
      "Review RED positions manually before approval",
      "Consider alternative suppliers for AMBER items"
    ]
  }
}
```

#### 4. Generate Tech Card

```http
GET /api/workflow/a/{project_id}/tech-card?position_id=pos_001

Response 200 OK:
{
  "success": true,
  "data": {
    "type": "tech_card",
    "position_id": "pos_001",
    "title": "Technologická karta - 121151113",
    "data": {
      "code": "121151113",
      "description": "Beton C30/37-XA2",
      "unit": "m³",
      "quantity": 123.0,
      "steps": [
        {
          "step_num": 1,
          "title": "Příprava",
          "description": "Příprava podkladu a bednění",
          "duration_minutes": 45,
          "workers": 2
        },
        {
          "step_num": 2,
          "title": "Betonáž",
          "description": "Ukládání a zhutňování betonu",
          "duration_minutes": 180,
          "workers": 4
        }
      ],
      "norms": ["ČSN EN 206", "ČSN 73 2400"],
      "materials": [ ... ],
      "safety_requirements": [
        "Ochranná přilba",
        "Ochranné rukavice",
        "Bezpečnostní obuv"
      ]
    },
    "metadata": {
      "generated_at": "2024-10-26T10:40:00Z",
      "source": "workflow_a_audit"
    }
  }
}
```

---

## Workflow B: Generate from Drawings

### Overview

Workflow B generates cost estimates from technical drawings using GPT-4 Vision to extract dimensions, materials, and specifications.

### Process Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. DRAWING UPLOAD                                               │
│    Client uploads: PDF/images of technical drawings             │
│    ↓                                                             │
│ 2. OCR & VISION ANALYSIS (GPT-4 Vision)                         │
│    Extract: dimensions, materials, annotations                  │
│    Identify: structural elements, specifications                │
│    ↓                                                             │
│ 3. QUANTITY CALCULATION                                         │
│    Calculate: volumes, areas, linear meters                     │
│    Apply: formulas for concrete, reinforcement, formwork        │
│    ↓                                                             │
│ 4. KROS CODE GENERATION (Claude)                                │
│    Match calculations → KROS codes from KB                      │
│    Generate position descriptions                               │
│    ↓                                                             │
│ 5. VALIDATION & ENRICHMENT                                      │
│    Validate generated positions against KB                      │
│    Add: norms, pricing, tech specs                              │
│    ↓                                                             │
│ 6. ESTIMATE GENERATION                                          │
│    Create: complete estimate with all positions                 │
│    Format: standardized output (Excel, JSON)                    │
│    ↓                                                             │
│ 7. TECH CARD GENERATION                                         │
│    Generate: technical cards for all positions                  │
│    Include: procedures, materials, safety                       │
└─────────────────────────────────────────────────────────────────┘
```

### GPT-4 Vision Extraction

**Input**: Technical drawing (PDF/Image)

**Prompt** (simplified):
```
Analyze this construction drawing and extract:
1. Structural elements (foundations, walls, slabs)
2. Dimensions (length, width, height, thickness)
3. Material specifications (concrete class, reinforcement)
4. Quantities (calculate volumes, areas)
5. Special requirements (exposure class, cover)

Return structured JSON with all extracted data.
```

**Output**:
```json
{
  "elements": [
    {
      "type": "foundation",
      "name": "Strip foundation",
      "dimensions": {
        "length_m": 24.0,
        "width_m": 0.8,
        "depth_m": 1.2
      },
      "concrete_spec": "C30/37-XA2",
      "reinforcement": {
        "main": "4ø12",
        "stirrups": "ø8/200mm"
      },
      "calculated_volume_m3": 23.04,
      "exposure_class": ["XA2", "XC2"],
      "cover_mm": 50
    }
  ]
}
```

### KROS Code Mapping

Claude AI maps extracted elements to KROS codes:

```json
{
  "generated_positions": [
    {
      "code": "121151113",
      "description": "Beton základových pásů C30/37-XA2",
      "unit": "m³",
      "quantity": 23.04,
      "source": "drawing_analysis",
      "confidence": 0.92,
      "calculation": {
        "formula": "length * width * depth",
        "values": {
          "length": 24.0,
          "width": 0.8,
          "depth": 1.2
        }
      }
    },
    {
      "code": "134341111",
      "description": "Výztuž základů z betonářské oceli B500B",
      "unit": "t",
      "quantity": 0.92,
      "source": "drawing_analysis",
      "confidence": 0.88,
      "calculation": {
        "formula": "reinforcement_area * length * density",
        "notes": "4ø12 main + ø8/200 stirrups"
      }
    }
  ]
}
```

### API Endpoints (Workflow B)

#### 1. Upload Drawings

```http
POST /api/workflow/b/upload
Content-Type: multipart/form-data

Parameters:
  - drawings: File[] (required) - PDF/images of drawings
  - project_name: string (required)
  - project_type: string (optional) - "residential" | "commercial" | "infrastructure"

Response 200 OK:
{
  "success": true,
  "project_id": "proj_xyz789",
  "message": "Drawings uploaded successfully",
  "data": {
    "project_name": "New Building",
    "status": "analyzing",
    "drawings_count": 3,
    "estimated_processing_time_seconds": 120
  }
}
```

#### 2. Get Analysis Results

```http
GET /api/workflow/b/{project_id}/results

Response 200 OK:
{
  "success": true,
  "data": {
    "project_id": "proj_xyz789",
    "status": "complete",
    "extraction": {
      "elements_found": 15,
      "total_concrete_m3": 156.8,
      "total_reinforcement_t": 6.3,
      "total_formwork_m2": 345.0
    },
    "generated_estimate": {
      "total_positions": 24,
      "estimated_cost_czk": 4500000.0,
      "positions": [ ... ]
    },
    "confidence_metrics": {
      "average_confidence": 0.87,
      "high_confidence_positions": 18,
      "review_recommended": 6
    }
  }
}
```

---

## Multi-Role Expert System

### Overview

The audit system uses multiple AI "expert" personas to validate positions from different perspectives, ensuring comprehensive evaluation.

### Expert Roles

| Role | Abbreviation | Focus | Triggered When |
|------|--------------|-------|----------------|
| **Subject Matter Expert** | SME | Technical accuracy, code compliance | All positions |
| **Architect** | ARCH | Design requirements, spatial constraints | Complex structures |
| **Engineer** | ENG | Structural integrity, calculations | Technical positions |
| **Supervisor** | SUP | Constructability, safety, sequencing | High-value items |

### Role Selection Logic

```python
def select_roles(position: Position, severity: str) -> List[str]:
    """Select expert roles based on position characteristics."""
    roles = ["SME"]  # SME always included

    # Classification severity
    if severity in ["critical", "high"]:
        roles.extend(["ARCH", "ENG", "SUP"])
    elif severity == "medium":
        roles.extend(["ENG"])

    # Position characteristics
    if position.quantity * position.unit_price > 500000:
        roles.append("SUP") if "SUP" not in roles else None

    if position.code.startswith("13"):  # Reinforcement
        roles.append("ENG") if "ENG" not in roles else None

    if position.code.startswith("11"):  # Earthworks
        roles.append("SUP") if "SUP" not in roles else None

    return list(set(roles))
```

### Expert Validation Flow

```
┌──────────────────────────────────────────────────────────────┐
│ Position: Beton C30/37-XA2, 123 m³                           │
│ Severity: HIGH (large quantity + complex spec)               │
└──────────────────────────────────────────────────────────────┘
                    ↓
        ┌───────────────────────┐
        │ Select Roles          │
        │ → SME, ARCH, ENG, SUP │
        └───────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ SME Validation                                              │
│ ✓ KROS code 121151113 correct for structural concrete      │
│ ✓ C30/37 appropriate for foundations                       │
│ ✓ XA2 exposure class matches environmental conditions      │
│ Score: 0.95                                                 │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ ARCH Validation                                             │
│ ✓ Quantity consistent with foundation dimensions           │
│ ⚠ Consider XC2 additional exposure for durability          │
│ Score: 0.92                                                 │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ ENG Validation                                              │
│ ✓ Structural requirements met (ČSN EN 206)                  │
│ ✓ Cover thickness 50mm adequate for XA2                    │
│ Score: 0.97                                                 │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ SUP Validation                                              │
│ ✓ Constructability confirmed                               │
│ ⚠ Recommend concrete pump for placement                    │
│ ✓ Safety requirements documented                           │
│ Score: 0.94                                                 │
└─────────────────────────────────────────────────────────────┘
                    ↓
        ┌───────────────────────┐
        │ Consensus Calculation │
        │ Average: 0.945        │
        │ Min: 0.92             │
        │ Consensus: YES        │
        └───────────────────────┘
                    ↓
        ┌───────────────────────┐
        │ Final Classification  │
        │ → AMBER (92%)         │
        │ Review recommended    │
        │ HITL: NO              │
        └───────────────────────┘
```

### Consensus Rules

```python
def calculate_consensus(role_scores: Dict[str, float]) -> Tuple[str, float, bool]:
    """Calculate final classification from multi-role scores."""
    avg_score = sum(role_scores.values()) / len(role_scores)
    min_score = min(role_scores.values())

    # Require consensus: min score must be within 10% of average
    consensus = (min_score >= avg_score * 0.9)

    # Classification
    if avg_score >= 0.95 and consensus:
        classification = "GREEN"
    elif avg_score >= 0.75 and consensus:
        classification = "AMBER"
    else:
        classification = "RED"

    # HITL (Human-in-the-Loop) required?
    hitl_required = (
        classification == "RED" or
        not consensus or
        any(score < 0.70 for score in role_scores.values())
    )

    return classification, avg_score, hitl_required
```

---

## Data Models & Schemas

### Position Schema

Core data structure for construction positions:

```python
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class Position(BaseModel):
    """Standardized construction position."""

    # Identification
    position_number: int = Field(..., description="Position number in estimate")
    code: str = Field(..., description="KROS/OTSKP/RTS code")
    description: str = Field(..., description="Position description")

    # Quantities
    quantity: float = Field(..., gt=0, description="Quantity")
    unit: str = Field(..., description="Measurement unit (m³, t, m², etc.)")

    # Pricing
    unit_price: Optional[float] = Field(None, ge=0, description="Unit price (CZK)")
    total_price: Optional[float] = Field(None, ge=0, description="Total price (CZK)")

    # Classification
    classification: Optional[str] = Field(None, pattern="^(GREEN|AMBER|RED)$")
    confidence: Optional[float] = Field(None, ge=0, le=1)

    # Enrichment data
    enrichment: Optional[Dict[str, Any]] = Field(None)

    # Audit data
    audit: Optional[PositionAudit] = Field(None)

    # Resources
    resources: Optional[PositionResources] = Field(None)

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class PositionAudit(BaseModel):
    """Audit information for a position."""

    status: str = Field(..., pattern="^(approved|review|rejected)$")
    classification: str = Field(..., pattern="^(GREEN|AMBER|RED)$")
    confidence_score: float = Field(..., ge=0, le=1)

    evidence: List[Evidence] = Field(default_factory=list)
    expert_roles: List[str] = Field(default_factory=list)
    role_scores: Dict[str, float] = Field(default_factory=dict)

    warnings: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)

    hitl_required: bool = Field(False)
    hitl_reason: Optional[str] = Field(None)

    audited_at: datetime = Field(default_factory=datetime.utcnow)

class Evidence(BaseModel):
    """Evidence supporting audit classification."""

    source: str = Field(..., description="KB category or external source")
    match_quality: str = Field(..., pattern="^(exact|high|medium|low)$")
    norm: Optional[str] = Field(None, description="Referenced norm/standard")
    description: Optional[str] = Field(None)
    confidence_impact: float = Field(..., ge=-1, le=1)

class PositionResources(BaseModel):
    """Resource requirements for a position."""

    labor: ResourceLabor
    materials: List[ResourceMaterial] = Field(default_factory=list)
    equipment: List[ResourceEquipment] = Field(default_factory=list)

class ResourceLabor(BaseModel):
    """Labor resource requirements."""

    hours_per_unit: float = Field(..., gt=0)
    total_hours: float = Field(..., gt=0)
    crew_size: int = Field(..., gt=0)
    trade: Optional[str] = Field(None)

class ResourceMaterial(BaseModel):
    """Material resource specification."""

    name: str
    quantity: float = Field(..., gt=0)
    unit: str
    unit_price: Optional[float] = Field(None, ge=0)
    total_price: Optional[float] = Field(None, ge=0)
    source: Optional[str] = Field(None)

class ResourceEquipment(BaseModel):
    """Equipment resource specification."""

    name: str
    hours: float = Field(..., gt=0)
    rate: Optional[float] = Field(None, ge=0, description="Hourly rate (CZK)")
    total_cost: Optional[float] = Field(None, ge=0)
```

### Project Schema

```python
class Project(BaseModel):
    """Project metadata and state."""

    # Identification
    project_id: str = Field(..., pattern="^proj_[a-z0-9]+$")
    project_name: str = Field(..., min_length=1, max_length=200)
    project_description: Optional[str] = Field(None, max_length=1000)

    # Status tracking
    status: str = Field(
        ...,
        pattern="^(uploading|parsing|enriching|auditing|complete|error)$"
    )

    # Progress
    progress: ProjectProgress

    # Data
    positions: List[Position] = Field(default_factory=list)
    audit_results: Optional[Dict[str, Any]] = Field(None)

    # Artifacts
    artifacts: Dict[str, ArtifactInfo] = Field(default_factory=dict)

    # Timestamps
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = Field(None)

class ProjectProgress(BaseModel):
    """Detailed progress tracking."""

    parsing: str = Field(..., pattern="^(pending|in_progress|complete|error)$")
    enrichment: str = Field(..., pattern="^(pending|in_progress|complete|error)$")
    audit: str = Field(..., pattern="^(pending|in_progress|complete|error)$")
    artifacts: str = Field(..., pattern="^(pending|in_progress|complete|error)$")

class ArtifactInfo(BaseModel):
    """Metadata for generated artifacts."""

    artifact_type: str = Field(..., pattern="^(tech_card|resource_sheet|material_analysis|report)$")
    position_id: Optional[str] = Field(None)
    file_path: str
    generated_at: datetime
    file_size_bytes: int = Field(..., ge=0)
```

---

## API Contracts

### Standard Response Format

All API responses follow this structure:

```typescript
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
  timestamp: string;  // ISO 8601
}
```

### Error Codes

| Code | HTTP Status | Description | Recovery |
|------|-------------|-------------|----------|
| `INVALID_FORMAT` | 400 | Unsupported file format | Use .xml, .xlsx, or .pdf |
| `PARSING_FAILED` | 500 | All parsers failed | Check file integrity, try hybrid mode |
| `PROJECT_NOT_FOUND` | 404 | Project ID not found | Verify project_id |
| `RATE_LIMIT_EXCEEDED` | 429 | API rate limit hit | Wait and retry |
| `INSUFFICIENT_CREDITS` | 402 | No API credits | Add credits to account |
| `VALIDATION_ERROR` | 400 | Schema validation failed | Check request body |
| `INTERNAL_ERROR` | 500 | Unexpected server error | Contact support |

### Rate Limiting

All endpoints respect rate limits:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1698321600
```

---

## Knowledge Base Architecture

### Categories (B1-B9)

```
knowledge_base/
├── B1_urs_codes/          # URS construction codes
│   ├── kros/              # KROS codes and specifications
│   ├── otskp/             # OTSKP classification
│   └── rts/               # RTS codes
├── B2_csn_standards/      # Czech national standards
│   ├── concrete/          # ČSN EN 206, etc.
│   └── steel/             # ČSN EN 10080, etc.
├── B3_current_prices/     # Market pricing
│   └── market_prices.json
├── B4_production_benchmarks/  # Productivity rates
│   └── labor_norms.json
├── B5_tech_cards/         # Technical cards
│   └── templates/
├── B6_research_papers/    # Research & best practices
├── B7_regulations/        # Building regulations
├── B8_company_specific/   # Company rules
└── B9_Equipment_Specs/    # Equipment specs
```

### KB Loading & Indexing

```python
# On startup, KB loader:
1. Scans all B1-B9 directories
2. Loads JSON/CSV/Excel files
3. Builds search indices:
   - Code index (exact match)
   - Description index (fuzzy search)
   - Norm reference index
4. Caches in memory for fast lookup

# Runtime enrichment:
1. Position arrives from parser
2. Lookup in KB indices
3. If not found → Perplexity API search
4. Update KB with new findings
5. Invalidate cache for real-time updates
```

---

## Parser Strategy & Fallbacks

### Fallback Chain

```
┌──────────────────────────────────────────────────┐
│ PRIMARY: Direct Parser                           │
│ - KROSParser for XML                             │
│ - ExcelParser for .xlsx/.xls                     │
│ - PDFPlumber for PDF                             │
│ Success rate: ~85%                               │
└──────────────────────────────────────────────────┘
             ↓ (if fails)
┌──────────────────────────────────────────────────┐
│ FALLBACK 1: External API                        │
│ - Nanonets Document AI (PDF)                    │
│ - MinerU Parser (PDF)                            │
│ Success rate: ~10%                               │
└──────────────────────────────────────────────────┘
             ↓ (if fails)
┌──────────────────────────────────────────────────┐
│ FALLBACK 2: AI-Based                            │
│ - Claude Vision (PDF/Images)                     │
│ - GPT-4 Vision (complex layouts)                 │
│ Success rate: ~95% (but slower/expensive)        │
└──────────────────────────────────────────────────┘
```

### Parser Selection Logic

```python
def select_parser(file_path: Path, config: dict) -> Parser:
    """Select appropriate parser based on file type and config."""

    suffix = file_path.suffix.lower()

    # XML files
    if suffix == '.xml':
        return KROSParser()

    # Excel files
    elif suffix in ['.xlsx', '.xls', '.csv']:
        if config.get('PREFER_MEMORY_EFFICIENT'):
            return MemoryEfficientExcelParser()
        return ExcelParser()

    # PDF files
    elif suffix == '.pdf':
        primary = config.get('PRIMARY_PARSER', 'pdfplumber')

        if primary == 'nanonets' and config.get('NANONETS_API_KEY'):
            return NanonetsParser()
        elif primary == 'mineru':
            return MinerUParser()
        else:
            return PDFParser()  # Uses pdfplumber

    else:
        raise ValueError(f"Unsupported format: {suffix}")
```

---

## Artifact Management

### Artifact Types

| Type | Description | Format | Generation Time |
|------|-------------|--------|----------------|
| **Tech Card** | Technical specification card | JSON, PDF | ~5s |
| **Resource Sheet** | Material/labor/equipment breakdown | JSON, Excel | ~3s |
| **Material Analysis** | Detailed material requirements | JSON, Excel | ~4s |
| **Audit Report** | Complete audit summary | JSON, PDF | ~10s |
| **Excel Export** | Full estimate in Excel format | .xlsx | ~15s |

### Caching Strategy

```python
# Artifact generation with cache-aside pattern:

def get_tech_card(project_id: str, position_id: str) -> Dict:
    """Get tech card with caching."""

    # Check cache
    cache_path = ArtifactPaths.tech_card(project_id, position_id)
    if cache_path.exists():
        cached = load_json(cache_path)
        if is_cache_valid(cached, max_age_minutes=60):
            return cached

    # Generate
    position = get_position(project_id, position_id)
    tech_card = generate_tech_card(position)

    # Save to cache
    save_json(cache_path, tech_card)

    return tech_card
```

---

## Error Handling & Recovery

### Error Handling Strategy

```python
class WorkflowError(Exception):
    """Base exception for workflow errors."""

    def __init__(self, message: str, code: str, recoverable: bool = False):
        self.message = message
        self.code = code
        self.recoverable = recoverable
        super().__init__(message)

# Usage example:
try:
    positions = parser.parse(file_path)
except ParsingError as e:
    if e.recoverable:
        # Try fallback
        logger.warning(f"Primary parser failed: {e}, trying fallback")
        positions = fallback_parser.parse(file_path)
    else:
        # Fatal error
        raise WorkflowError(
            message="Unable to parse document",
            code="PARSING_FAILED",
            recoverable=False
        )
```

### Recovery Strategies

| Error Type | Recovery | Example |
|------------|----------|---------|
| **Parsing Error** | Try fallback chain | XML → Claude Vision |
| **Rate Limit** | Exponential backoff + queue | Wait 60s, retry |
| **Invalid Schema** | Partial recovery | Skip invalid positions, continue |
| **API Timeout** | Retry with timeout increase | 30s → 60s → 120s |
| **KB Not Found** | Perplexity search | Unknown norm → web search |

---

## Testing Strategy

### Test Pyramid

```
        ┌─────────────┐
        │   E2E (5)   │  Full workflow tests
        └─────────────┘
      ┌─────────────────┐
      │ Integration (15) │  Service layer tests
      └─────────────────┘
    ┌───────────────────────┐
    │   Unit Tests (47)     │  Parser, util, model tests
    └───────────────────────┘
```

### E2E Test Scenarios

#### Scenario 1: Complete Workflow A

```python
def test_workflow_a_complete_e2e():
    """Test complete Workflow A: Upload → Parse → Enrich → Audit → Artifacts."""

    # 1. Upload KROS XML estimate
    response = client.post(
        "/api/workflow/a/upload",
        files={"estimate_file": open("tests/fixtures/estimate_kros.xml", "rb")},
        data={"project_name": "E2E Test Project"}
    )
    assert response.status_code == 200
    project_id = response.json()["project_id"]

    # 2. Wait for parsing
    wait_for_status(project_id, "parsing_complete", timeout=30)

    # 3. Trigger enrichment & audit
    response = client.post(f"/api/workflow/a/{project_id}/analyze")
    assert response.status_code == 200

    # 4. Wait for audit complete
    wait_for_status(project_id, "audit_complete", timeout=60)

    # 5. Verify audit results
    response = client.get(f"/api/workflow/a/{project_id}/audit")
    audit = response.json()["data"]
    assert audit["summary"]["total_positions"] > 0
    assert audit["summary"]["green_count"] + audit["summary"]["amber_count"] + audit["summary"]["red_count"] == audit["summary"]["total_positions"]

    # 6. Generate tech card
    position_id = audit["positions"][0]["position_id"]
    response = client.get(f"/api/workflow/a/{project_id}/tech-card?position_id={position_id}")
    assert response.status_code == 200
    assert response.json()["data"]["type"] == "tech_card"
```

#### Scenario 2: Parser Fallback Chain

```python
def test_parser_fallback_chain():
    """Test parser fallback chain for corrupted PDF."""

    # Use intentionally corrupted PDF
    corrupted_pdf = "tests/fixtures/corrupted.pdf"

    # Should automatically fall back through chain:
    # PDFPlumber (fail) → Nanonets (fail) → Claude Vision (success)

    response = client.post(
        "/api/parse/hybrid",
        files={"file": open(corrupted_pdf, "rb")},
        data={"use_fallback": True}
    )

    assert response.status_code == 200
    result = response.json()["data"]

    # Verify fallback was used
    assert result["parser_used"] == "claude_vision"
    assert result["fallback_count"] == 2

    # Verify positions were extracted
    assert len(result["positions"]) > 0
```

### Test Data Fixtures

```
tests/fixtures/
├── estimate_kros.xml          # Valid KROS UNIXML
├── estimate_excel.xlsx        # Valid Excel estimate
├── estimate_pdf.pdf           # Valid PDF estimate
├── corrupted.pdf              # Intentionally corrupted
├── missing_fields.xml         # Schema validation test
├── huge_estimate.xlsx         # Performance test (10k positions)
└── drawings/
    ├── floor_plan.pdf
    └── section.pdf
```

---

## Performance & Scaling

### Performance Targets

| Operation | Target | Current |
|-----------|--------|---------|
| Parse KROS XML (100 positions) | <5s | 3.2s |
| Parse PDF (10 pages) | <30s | 22s |
| Enrich position (KB lookup) | <100ms | 45ms |
| Audit single position (SME only) | <2s | 1.8s |
| Audit single position (all roles) | <8s | 6.5s |
| Generate tech card | <3s | 2.1s |
| Complete Workflow A (50 positions) | <2min | 85s |

### Scaling Strategies

#### Horizontal Scaling

```yaml
# docker-compose.yml
services:
  api:
    image: concrete-agent:latest
    replicas: 4
    environment:
      - REDIS_URL=redis://cache:6379
    depends_on:
      - cache
      - postgres

  cache:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  postgres:
    image: postgres:15-alpine
    volumes:
      - pg_data:/var/lib/postgresql/data
```

#### Async Processing

```python
# For long-running operations, use background tasks
from fastapi import BackgroundTasks

@router.post("/api/workflow/a/{project_id}/analyze")
async def analyze_project(
    project_id: str,
    background_tasks: BackgroundTasks
):
    """Trigger analysis in background."""

    # Validate project exists
    project = get_project(project_id)

    # Queue background task
    background_tasks.add_task(
        run_workflow_a_analysis,
        project_id=project_id
    )

    return APIResponse(
        success=True,
        message="Analysis started",
        data={"project_id": project_id, "status": "processing"}
    )
```

### Monitoring & Observability

```python
# Prometheus metrics
from prometheus_client import Counter, Histogram

parsing_duration = Histogram(
    'concrete_agent_parsing_duration_seconds',
    'Time spent parsing documents',
    ['format']
)

audit_classifications = Counter(
    'concrete_agent_audit_classifications_total',
    'Total audit classifications',
    ['classification']
)

# Usage
with parsing_duration.labels(format='kros_xml').time():
    positions = kros_parser.parse(file_path)

audit_classifications.labels(classification='GREEN').inc()
```

---

## Security & Compliance

### API Key Management

```python
# Never log API keys
logger.info(f"Using Claude API key: {settings.ANTHROPIC_API_KEY[:8]}...")  # ✓ Safe

# Rotate keys regularly
# Store in environment variables, never in code
# Use separate keys for dev/staging/production
```

### Data Privacy

- Project data stored locally in `/data/projects/`
- No data sent to third parties except AI APIs (Claude, GPT-4)
- API logs exclude sensitive information
- Support for data retention policies

### Audit Trail

All operations logged with:
- Timestamp
- User/API key
- Operation type
- Input/output summary
- Success/failure status

```json
{
  "timestamp": "2024-10-26T10:35:22Z",
  "operation": "workflow_a_audit",
  "project_id": "proj_abc123",
  "user_id": "user_xyz",
  "input": {
    "positions_count": 45,
    "total_value_czk": 15750000.0
  },
  "output": {
    "green": 38,
    "amber": 5,
    "red": 2
  },
  "duration_ms": 6542,
  "status": "success"
}
```

---

## Appendix: Example Workflows

### Example 1: Basic Audit

```bash
# 1. Upload estimate
curl -X POST "http://localhost:8000/api/workflow/a/upload" \
  -F "estimate_file=@my_estimate.xml" \
  -F "project_name=Residential Building"

# Response: {"project_id": "proj_abc123"}

# 2. Check status
curl "http://localhost:8000/api/workflow/a/proj_abc123"

# 3. Get audit results
curl "http://localhost:8000/api/workflow/a/proj_abc123/audit"

# 4. Download tech card for specific position
curl "http://localhost:8000/api/workflow/a/proj_abc123/tech-card?position_id=pos_001" \
  -o tech_card.json
```

### Example 2: Drawing Analysis

```bash
# 1. Upload drawings
curl -X POST "http://localhost:8000/api/workflow/b/upload" \
  -F "drawings=@floor_plan.pdf" \
  -F "drawings=@section.pdf" \
  -F "project_name=New Office Building"

# Response: {"project_id": "proj_xyz789"}

# 2. Wait for analysis (async)
sleep 120

# 3. Get generated estimate
curl "http://localhost:8000/api/workflow/b/proj_xyz789/results"
```

---

**Document Version**: 1.0
**Last Updated**: 2024-10-26
**Author**: Concrete Agent Team
