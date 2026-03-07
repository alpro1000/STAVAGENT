"""
Pydantic models for structured price list output.
Matches the JSON schema from the specification.
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


# ── Source metadata ──────────────────────────────────────────────────────────

class Source(BaseModel):
    company: Optional[str] = None
    provozovna: Optional[str] = None
    valid_from: Optional[str] = None
    valid_to: Optional[str] = None
    currency: str = "CZK"
    vat_rate: float = 21


# ── Betony (concrete mixes) ─────────────────────────────────────────────────

class BetonItem(BaseModel):
    name: str = Field(..., description="e.g. C 25/30")
    exposure_class: Optional[str] = Field(None, description="e.g. XC3-4, XF1")
    price_per_m3: Optional[float] = None
    price_per_m3_vat: Optional[float] = None
    notes: Optional[str] = None


# ── Malty / potěry ───────────────────────────────────────────────────────────

class MaltaPotěrItem(BaseModel):
    name: str
    type: Optional[str] = None
    price_per_m3: Optional[float] = None
    price_per_m3_vat: Optional[float] = None


# ── Doprava (delivery) ───────────────────────────────────────────────────────

class DopravaZona(BaseModel):
    km_from: int
    km_to: int
    price_per_m3: float


class Doprava(BaseModel):
    min_objem_m3: Optional[float] = None
    volny_cas_min: Optional[int] = None
    cekani_per_15min: Optional[float] = None
    zony: list[DopravaZona] = Field(default_factory=list)
    pristaveni_ks: Optional[float] = None


# ── Čerpadla (pumps) ────────────────────────────────────────────────────────

class CerpadloItem(BaseModel):
    type: str = Field(..., description="e.g. PUMI 21m")
    pristaveni: Optional[float] = None
    hodinova_sazba: Optional[float] = None
    cena_per_m3: Optional[float] = None
    km_sazba: Optional[float] = None


# ── Příplatky (surcharges) ───────────────────────────────────────────────────

class PriplatekCasovy(BaseModel):
    nazev: str
    typ: str = Field(..., description="% or Kč/m³")
    hodnota: float


class PriplatekZimni(BaseModel):
    teplota_from: float
    teplota_to: float
    price_per_m3: float


class PriplatekTechnologicky(BaseModel):
    nazev: str
    typ: str
    hodnota: float


class Priplatky(BaseModel):
    casove: list[PriplatekCasovy] = Field(default_factory=list)
    zimni: list[PriplatekZimni] = Field(default_factory=list)
    technologicke: list[PriplatekTechnologicky] = Field(default_factory=list)


# ── Laboratorní služby ───────────────────────────────────────────────────────

class LaboratorItem(BaseModel):
    nazev: str
    jednotka: Optional[str] = None
    cena: Optional[float] = None


# ── Top-level output ─────────────────────────────────────────────────────────

class PriceListResult(BaseModel):
    source: Source = Field(default_factory=Source)
    betony: list[BetonItem] = Field(default_factory=list)
    malty_potere: list[MaltaPotěrItem] = Field(default_factory=list)
    doprava: Doprava = Field(default_factory=Doprava)
    cerpadla: list[CerpadloItem] = Field(default_factory=list)
    priplatky: Priplatky = Field(default_factory=Priplatky)
    laborator: list[LaboratorItem] = Field(default_factory=list)
    ostatni: Optional[str] = Field(None, description="Unrecognized content for manual review")
