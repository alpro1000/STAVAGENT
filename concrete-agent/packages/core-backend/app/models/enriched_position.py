"""
Enriched Position Models
Модели данных для позиций обогащенных техническими спецификациями
"""
from enum import Enum
from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field


class EnrichmentStatus(str, Enum):
    """Status of position enrichment"""
    MATCHED = "matched"           # Полное соответствие найдено
    PARTIAL = "partial"           # Частичное соответствие
    UNMATCHED = "unmatched"       # Соответствие не найдено
    ERROR = "error"               # Ошибка при обогащении


class ValidationStatus(str, Enum):
    """Status of specification validation"""
    PASSED = "passed"             # Все проверки пройдены
    WARNING = "warning"           # Есть предупреждения
    FAILED = "failed"             # Критические ошибки
    NO_SPECS = "no_specs"         # Нет спецификаций для проверки


class MaterialType(str, Enum):
    """Type of construction material"""
    CONCRETE = "concrete"
    REINFORCEMENT = "reinforcement"
    INSULATION = "insulation"
    MASONRY = "masonry"
    OTHER = "other"


class ConcreteSpecification(BaseModel):
    """Technical specifications for concrete"""
    concrete_class: str = Field(..., description="Class of concrete (e.g., C30/37)")
    exposure_classes: Optional[List[str]] = Field(None, description="Exposure classes (e.g., ['XA1', 'XC2'])")
    concrete_cover_mm: Optional[int] = Field(None, description="Concrete cover in mm")
    surface_finish: Optional[str] = Field(None, description="Surface finish type")
    water_cement_ratio: Optional[float] = Field(None, description="Max water/cement ratio")
    min_cement_content: Optional[int] = Field(None, description="Min cement content kg/m³")
    
    class Config:
        json_schema_extra = {
            "example": {
                "concrete_class": "C30/37",
                "exposure_classes": ["XA1", "XC2", "XF2"],
                "concrete_cover_mm": 50,
                "surface_finish": "hladká"
            }
        }


class ReinforcementSpecification(BaseModel):
    """Technical specifications for reinforcement"""
    steel_class: str = Field(..., description="Class of reinforcement steel (e.g., B500B)")
    diameter_mm: Optional[int] = Field(None, description="Bar diameter in mm")
    spacing_mm: Optional[int] = Field(None, description="Spacing between bars in mm")
    
    class Config:
        json_schema_extra = {
            "example": {
                "steel_class": "B500B",
                "diameter_mm": 12,
                "spacing_mm": 150
            }
        }


class InsulationSpecification(BaseModel):
    """Technical specifications for insulation"""
    insulation_type: str = Field(..., description="Type of insulation (EPS, XPS, etc.)")
    thickness_mm: int = Field(..., description="Thickness in mm")
    thermal_conductivity: Optional[float] = Field(None, description="Lambda value W/(m·K)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "insulation_type": "EPS",
                "thickness_mm": 100,
                "thermal_conductivity": 0.037
            }
        }


class DrawingSource(BaseModel):
    """Source reference to drawing"""
    drawing: str = Field(..., description="Drawing filename")
    page: int = Field(..., description="Page number")
    table: Optional[int] = Field(None, description="Table number on page")
    line: Optional[int] = Field(None, description="Line number (for text specs)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "drawing": "SO1-01_Základy.pdf",
                "page": 3,
                "table": 1
            }
        }


class ValidationResult(BaseModel):
    """Result of specification validation"""
    is_valid: bool = Field(..., description="Overall validation status")
    warnings: List[str] = Field(default_factory=list, description="Warning messages")
    errors: List[str] = Field(default_factory=list, description="Error messages")
    info: List[str] = Field(default_factory=list, description="Informational messages")
    
    class Config:
        json_schema_extra = {
            "example": {
                "is_valid": True,
                "warnings": [],
                "errors": [],
                "info": [
                    "Beton C30/37 vyhovuje pro expozici XA1",
                    "Krytí výztuže 50mm vyhovuje pro XC2"
                ]
            }
        }


class EnrichedPosition(BaseModel):
    """
    Position enriched with technical specifications from drawings
    
    Extends basic position with:
    - Technical specifications matched from drawings
    - Validation results
    - Source references
    """
    # Basic position fields (from original)
    position_number: str = Field(..., description="Position number")
    description: str = Field(..., description="Work description")
    quantity: float = Field(..., description="Quantity")
    unit: str = Field(..., description="Unit of measurement")
    code: Optional[str] = Field(None, description="KROS/ÚRS code")
    unit_price: Optional[float] = Field(None, description="Unit price")
    total_price: Optional[float] = Field(None, description="Total price")
    
    # Enrichment fields
    enrichment_status: EnrichmentStatus = Field(..., description="Status of enrichment")
    enrichment_confidence: float = Field(0.0, description="Confidence of matching (0.0-1.0)")
    enrichment_reason: Optional[str] = Field(None, description="Reason for enrichment status")
    
    # Technical specifications (flexible - can be concrete, reinforcement, etc.)
    technical_specs: Optional[Dict[str, Any]] = Field(None, description="Technical specifications")
    material_type: Optional[MaterialType] = Field(None, description="Type of material")
    
    # Drawing source reference
    drawing_source: Optional[DrawingSource] = Field(None, description="Source drawing reference")
    
    # Validation results
    validation_status: Optional[ValidationStatus] = Field(None, description="Validation status")
    validation_results: Optional[ValidationResult] = Field(None, description="Detailed validation results")
    
    # Compliance notes
    compliance_notes: Optional[List[str]] = Field(None, description="Notes about standards compliance")
    
    class Config:
        json_schema_extra = {
            "example": {
                "position_number": "1.1",
                "description": "základní deska C30/37",
                "quantity": 89.0,
                "unit": "m³",
                "code": "121-01-001",
                "enrichment_status": "matched",
                "enrichment_confidence": 0.95,
                "enrichment_reason": "Přesná shoda názvu a třídy betonu",
                "technical_specs": {
                    "concrete_class": "C30/37",
                    "exposure_classes": ["XA1", "XC2", "XF2"],
                    "concrete_cover_mm": 50,
                    "surface_finish": "hladká"
                },
                "material_type": "concrete",
                "drawing_source": {
                    "drawing": "SO1-01_Základy.pdf",
                    "page": 3,
                    "table": 1
                },
                "validation_status": "passed",
                "validation_results": {
                    "is_valid": True,
                    "warnings": [],
                    "errors": [],
                    "info": [
                        "Beton C30/37 vyhovuje pro expozici XA1",
                        "Krytí výztuže 50mm vyhovuje"
                    ]
                },
                "compliance_notes": [
                    "Odpovídá ČSN EN 206",
                    "Třída expozice vhodná pro prostředí"
                ]
            }
        }


class EnrichedAuditResult(BaseModel):
    """
    Complete audit result with enriched positions
    
    Extends basic audit result with:
    - Statistics about enrichment
    - Validation summary
    """
    project_id: str
    total_positions: int
    
    # Enrichment statistics
    enrichment_stats: Dict[str, int] = Field(
        ...,
        description="Statistics about enrichment (matched/partial/unmatched)"
    )
    
    # Validation statistics
    validation_stats: Dict[str, int] = Field(
        ...,
        description="Statistics about validation (passed/warning/failed/no_specs)"
    )
    
    # Classification (GREEN/AMBER/RED)
    classification_stats: Dict[str, int] = Field(
        ...,
        description="Audit classification statistics"
    )
    
    # Enriched positions
    positions: List[EnrichedPosition]
    
    class Config:
        json_schema_extra = {
            "example": {
                "project_id": "proj_abc123",
                "total_positions": 298,
                "enrichment_stats": {
                    "matched": 275,
                    "partial": 18,
                    "unmatched": 5
                },
                "validation_stats": {
                    "passed": 280,
                    "warning": 15,
                    "failed": 3
                },
                "classification_stats": {
                    "green": 280,
                    "amber": 15,
                    "red": 3
                },
                "positions": []
            }
        }


# ==============================================================================
# HELPER FUNCTIONS
# ==============================================================================

def create_enriched_position(
    base_position: Dict[str, Any],
    enrichment_data: Optional[Dict[str, Any]] = None
) -> EnrichedPosition:
    """
    Create EnrichedPosition from base position and enrichment data
    
    Args:
        base_position: Basic position dict
        enrichment_data: Optional enrichment data
        
    Returns:
        EnrichedPosition instance
    """
    # Merge base position with enrichment
    position_data = base_position.copy()
    
    if enrichment_data:
        position_data.update(enrichment_data)
    
    # Set defaults if not present
    if 'enrichment_status' not in position_data:
        position_data['enrichment_status'] = EnrichmentStatus.UNMATCHED
    
    return EnrichedPosition(**position_data)


def summarize_enrichment(positions: List[EnrichedPosition]) -> Dict[str, Any]:
    """
    Create summary statistics for enriched positions
    
    Args:
        positions: List of enriched positions
        
    Returns:
        Summary statistics dict
    """
    enrichment_stats = {
        'matched': 0,
        'partial': 0,
        'unmatched': 0,
        'error': 0
    }
    
    validation_stats = {
        'passed': 0,
        'warning': 0,
        'failed': 0,
        'no_specs': 0
    }
    
    for position in positions:
        # Count enrichment status
        status = position.enrichment_status
        enrichment_stats[status] = enrichment_stats.get(status, 0) + 1
        
        # Count validation status
        val_status = position.validation_status
        if val_status:
            validation_stats[val_status] = validation_stats.get(val_status, 0) + 1
    
    return {
        'total_positions': len(positions),
        'enrichment_stats': enrichment_stats,
        'validation_stats': validation_stats
    }


# ==============================================================================
# USAGE EXAMPLE
# ==============================================================================

if __name__ == "__main__":
    import json
    
    # Example enriched position
    position = EnrichedPosition(
        position_number="1.1",
        description="základní deska C30/37",
        quantity=89.0,
        unit="m³",
        code="121-01-001",
        enrichment_status=EnrichmentStatus.MATCHED,
        enrichment_confidence=0.95,
        enrichment_reason="Přesná shoda názvu a třídy betonu",
        technical_specs={
            "concrete_class": "C30/37",
            "exposure_classes": ["XA1", "XC2", "XF2"],
            "concrete_cover_mm": 50,
            "surface_finish": "hladká"
        },
        material_type=MaterialType.CONCRETE,
        drawing_source=DrawingSource(
            drawing="SO1-01_Základy.pdf",
            page=3,
            table=1
        ),
        validation_status=ValidationStatus.PASSED,
        validation_results=ValidationResult(
            is_valid=True,
            warnings=[],
            errors=[],
            info=["Beton C30/37 vyhovuje pro expozici XA1"]
        )
    )
    
    print(json.dumps(position.dict(), ensure_ascii=False, indent=2))
