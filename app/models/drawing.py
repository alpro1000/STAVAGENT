"""
Pydantic models for Construction Drawings (Stavební výkresy)
"""
from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime


class DrawingUpload(BaseModel):
    """Model for drawing upload request"""
    project_id: str = Field(..., description="ID projektu")
    drawing_type: str = Field(..., description="Typ výkresu (situace, půdorys, řez, detail)")
    file_format: str = Field(..., description="Formát souboru (PDF, PNG, JPG, DWG)")


class MaterialSpecification(BaseModel):
    """Specifikace materiálu z výkresu"""
    material_type: str = Field(..., description="Typ materiálu (BETON, OCEL, OPÁLUBKA)")
    specification: str = Field(..., description="Specifikace (např. C25/30, B500B)")
    quantity: Optional[float] = Field(None, description="Množství")
    unit: Optional[str] = Field(None, description="Jednotka")
    location: str = Field(..., description="Umístění ve výkresu")
    standard: Optional[str] = Field(None, description="Norma (např. ČSN EN 206+A2)")


class ConstructionElement(BaseModel):
    """Konstrukční prvek identifikovaný ve výkresu"""
    element_type: str = Field(..., description="Typ prvku (PILOTY, ZÁKLADY, PILÍŘE, OPĚRY)")
    dimensions: str = Field(..., description="Rozměry")
    material: str = Field(..., description="Materiál")
    position_mark: Optional[str] = Field(None, description="Označení pozice")
    quantity: Optional[int] = Field(None, description="Počet kusů")


class ExposureClass(BaseModel):
    """Třída prostředí podle ČSN"""
    code: str = Field(..., description="Kód třídy (např. XA2+XC2, XF3+XC2)")
    description: str = Field(..., description="Popis působení")
    requirements: List[str] = Field(default_factory=list, description="Požadavky")


class SurfaceCategory(BaseModel):
    """Kategorie povrchu betonu"""
    category: str = Field(..., description="Kategorie (Aa, C1a, C2d, Bd, E)")
    finish_requirements: str = Field(..., description="Požadavky na povrchovou úpravu")


class DrawingAnalysisResult(BaseModel):
    """Výsledek OCR/Vision analýzy výkresu"""
    drawing_id: str = Field(..., description="ID výkresu")
    project_id: str = Field(..., description="ID projektu")
    file_name: str = Field(..., description="Název souboru")
    analysis_timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # OCR Results
    text_extracted: List[str] = Field(default_factory=list, description="Extrahovaný text")
    
    # Construction elements
    elements: List[ConstructionElement] = Field(default_factory=list)
    
    # Material specifications
    materials: List[MaterialSpecification] = Field(default_factory=list)
    
    # Standards and classes
    standards: List[str] = Field(default_factory=list, description="Identifikované normy")
    exposure_classes: List[ExposureClass] = Field(default_factory=list)
    surface_categories: List[SurfaceCategory] = Field(default_factory=list)
    
    # Drawing metadata
    drawing_title: Optional[str] = Field(None, description="Název výkresu")
    drawing_number: Optional[str] = Field(None, description="Číslo výkresu")
    scale: Optional[str] = Field(None, description="Měřítko")
    date: Optional[str] = Field(None, description="Datum výkresu")
    
    # Summary
    confidence: str = Field(..., description="Spolehlivost analýzy (HIGH/MEDIUM/LOW)")
    notes: List[str] = Field(default_factory=list, description="Poznámky")
    
    class Config:
        json_schema_extra = {
            "example": {
                "drawing_id": "dwg_123",
                "project_id": "proj_456",
                "file_name": "pudorys_1np.pdf",
                "elements": [
                    {
                        "element_type": "ZÁKLADY",
                        "dimensions": "2000x500x400mm",
                        "material": "Beton C30/37",
                        "position_mark": "Z1",
                        "quantity": 12
                    }
                ],
                "materials": [
                    {
                        "material_type": "BETON",
                        "specification": "C30/37",
                        "quantity": 15.5,
                        "unit": "m³",
                        "location": "Základy Z1-Z12",
                        "standard": "ČSN EN 206+A2"
                    }
                ],
                "standards": ["ČSN EN 206+A2", "TKP KAP. 18"],
                "exposure_classes": [
                    {
                        "code": "XA2+XC2",
                        "description": "Chemická agrese + karbonatizace",
                        "requirements": ["Min. krycí vrstva 50mm", "Max. w/c 0.45"]
                    }
                ],
                "confidence": "HIGH"
            }
        }


class DrawingEstimateLink(BaseModel):
    """Propojení výkresu s pozicemi smetý"""
    drawing_id: str = Field(..., description="ID výkresu")
    position_number: str = Field(..., description="Číslo pozice ve smětě")
    element_type: str = Field(..., description="Typ prvku z výkresu")
    confidence: float = Field(..., description="Spolehlivost propojení (0-1)")
    notes: Optional[str] = Field(None, description="Poznámky k propojení")


class DrawingResponse(BaseModel):
    """Response po nahrání a analýze výkresu"""
    success: bool
    drawing_id: str
    project_id: str
    message: str
    analysis: Optional[DrawingAnalysisResult] = None
    error: Optional[str] = None
