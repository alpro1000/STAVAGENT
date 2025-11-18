"""
Pydantic models for Position (Pozice)
"""
from typing import Optional, List
from pydantic import BaseModel, Field
from enum import Enum

class PositionClassification(str, Enum):
    """Classification of audit result"""
    GREEN = "green"
    AMBER = "amber" 
    RED = "red"
    
class Position(BaseModel):
    """Pozice ze smetá (výkaz výměr)"""
    
    position_number: str = Field(..., description="Číslo pozice (1, 1.1, A.1, etc.)")
    description: str = Field(..., description="Popis práce")
    quantity: float = Field(..., gt=0, description="Množství")
    unit: str = Field(..., description="Jednotka (m³, m², kg, ks, etc.)")
    unit_price: Optional[float] = Field(None, description="Cena za jednotku v Kč")
    total_price: Optional[float] = Field(None, description="Celková cena v Kč")
    category: Optional[str] = Field(None, description="Kategorie (HSV, PSV, M, etc.)")
    notes: Optional[str] = Field(None, description="Poznámky")
    
    class Config:
        json_schema_extra = {
            "example": {
                "position_number": "1",
                "description": "Betonová deska C25/30, tl. 200mm",
                "quantity": 150.5,
                "unit": "m³",
                "unit_price": 2450.00,
                "total_price": 368725.00,
                "category": "HSV",
                "notes": ""
            }
        }


class PositionAudit(BaseModel):
    """Audit result for a position"""
    position: Position
    classification: PositionClassification
    confidence: float = Field(..., ge=0.0, le=1.0)
    issues_found: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    hitl_required: bool = False


class ResourceLabor(BaseModel):
    """Lidské zdroje"""
    type: str = Field(..., description="Typ práce (tesaři, zedníci, betonáři...)")
    count: int = Field(..., gt=0, description="Počet lidí")
    hours: Optional[float] = Field(None, description="Hodiny práce")
    days: Optional[float] = Field(None, description="Dny práce")
    rate_per_hour_czk: Optional[float] = Field(None, description="Sazba Kč/h")
    total_czk: float = Field(..., description="Celkové náklady")


class ResourceEquipment(BaseModel):
    """Technika"""
    type: str = Field(..., description="Typ techniky")
    model: Optional[str] = Field(None, description="Model (např. Schwing S36X)")
    capacity: Optional[str] = Field(None, description="Kapacita/výkon")
    count: int = Field(1, description="Počet kusů")
    days: Optional[float] = Field(None, description="Dny pronájmu")
    hours: Optional[float] = Field(None, description="Hodiny pronájmu")
    rate_per_day_czk: Optional[float] = Field(None, description="Sazba Kč/den")
    total_czk: float = Field(..., description="Celkové náklady")


class ResourceMaterial(BaseModel):
    """Materiály"""
    type: str = Field(..., description="Typ materiálu")
    quantity: float = Field(..., description="Množství")
    unit: str = Field(..., description="Jednotka")
    price_per_unit_czk: Optional[float] = Field(None, description="Cena za jednotku")
    total_czk: float = Field(..., description="Celkové náklady")


class ResourceTransport(BaseModel):
    """Doprava"""
    type: str = Field(..., description="Typ dopravy")
    distance_km: Optional[float] = Field(None, description="Vzdálenost")
    trips: Optional[int] = Field(None, description="Počet jízd")
    price_per_trip_czk: Optional[float] = Field(None, description="Cena за jízdu")
    total_czk: float = Field(..., description="Celkové náklady")


class Zachytka(BaseModel):
    """Zachytka (segment betonáže)"""
    id: int = Field(..., description="ID zachytky")
    popis: str = Field(..., description="Popis (např. 'Spodní část 0-6m')")
    objem_m3: Optional[float] = Field(None, description="Objem betonu")
    monoliticka: bool = Field(False, description="Musí být v jednom tahu?")


class PositionResources(BaseModel):
    """Kompletní zdroje pro pozici"""
    
    position_number: str
    work_type: str = Field(..., description="Typ práce (betonové, zednické, etc.)")
    module_used: Optional[str] = Field(None, description="Který modul použit")
    
    # Technology
    technology_steps: List[str] = Field(default_factory=list)
    zachytky: List[Zachytka] = Field(default_factory=list)
    critical_factors: List[str] = Field(default_factory=list)
    
    # Productivity rates
    productivity_rates: dict = Field(default_factory=dict)
    
    # Resources
    labor: List[ResourceLabor] = Field(default_factory=list)
    equipment: List[ResourceEquipment] = Field(default_factory=list)
    materials: List[ResourceMaterial] = Field(default_factory=list)
    transport: List[ResourceTransport] = Field(default_factory=list)
    
    # Summary
    total_cost_czk: float
    total_time_days: float
    breakdown_pct: Optional[dict] = Field(None, description="Rozložení nákladů %")
    
    # Flags
    confidence: str = Field(..., description="HIGH/MEDIUM/LOW")
    classification: str = Field(..., description="GREEN/AMBER/RED")
    hitl_required: bool = False
    notes: List[str] = Field(default_factory=list)
    
    class Config:
        json_schema_extra = {
            "example": {
                "position_number": "1",
                "work_type": "betonové_práce",
                "total_cost_czk": 616130,
                "total_time_days": 10,
                "confidence": "HIGH",
                "classification": "GREEN"
            }
        }
