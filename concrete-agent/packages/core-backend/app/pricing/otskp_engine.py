"""
STAVAGENT — OTSKP Price Engine v4.4

Real OTSKP codes (1/2025) + mapping from XxxParams → SoupisPolozka with prices.
Database: otskp.db (SQLite, 17904 items, source: 2025_03_OTSKP.xml)

ARCHITECTURE:
  OTSKPDatabase  — SQLite wrapper, search and variant selector
  OTSKPSelector  — intelligent variant selection based on TZ parameters
  RailwayPriceEngine — final price calculation for SO 111/112

KEY INSIGHT:
  In OTSKP the track frame is a COMPOSITE item (528xxx) — includes rails +
  sleepers + fastening + ballast laying in one price per meter. Do NOT itemize separately!

Author: STAVAGENT Team
Version: 4.4.0
Date: 2026-03-26
"""

import sqlite3
import logging
from decimal import Decimal
from typing import Optional, List, Dict
from pathlib import Path
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# DATA TYPES
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class OTSKPItem:
    code: str
    nazev: str
    mj: str
    cena: float
    spec: str = ""


@dataclass
class PricedPolozka:
    item_id: str
    code_otskp: str
    nazev_otskp: str
    description_custom: str
    specification: str
    mj: str
    quantity: Optional[Decimal]
    unit_price: Decimal
    total_price: Optional[Decimal]
    quantity_status: str  # "OK" / "CHYBÍ_VSTUP" / "ODHADNUTO"
    confidence: float
    source_param: str
    quantity_formula: str
    price_source: str = "OTSKP 1/2025"

    @property
    def total(self) -> Optional[float]:
        if self.quantity and self.unit_price:
            return float(self.quantity * self.unit_price)
        return None


# ─────────────────────────────────────────────────────────────────────────────
# OTSKP DATABASE
# ─────────────────────────────────────────────────────────────────────────────

class OTSKPDatabase:
    """SQLite wrapper for OTSKP catalog 1/2025."""

    def __init__(self, db_path: str = "otskp.db"):
        self.db_path = db_path
        self._conn: Optional[sqlite3.Connection] = None

    def connect(self):
        self._conn = sqlite3.connect(self.db_path)
        self._conn.row_factory = sqlite3.Row

    def close(self):
        if self._conn:
            self._conn.close()

    def get(self, code: str) -> Optional[OTSKPItem]:
        """Direct lookup by code."""
        if not self._conn:
            return None
        row = self._conn.execute(
            "SELECT code, nazev, mj, cena, spec FROM otskp WHERE code=?", (code,)
        ).fetchone()
        if row:
            return OTSKPItem(**dict(row))
        return None

    def search(self, keyword: str, limit: int = 10) -> List[OTSKPItem]:
        """Fulltext search in names."""
        if not self._conn:
            return []
        rows = self._conn.execute(
            "SELECT code, nazev, mj, cena, spec FROM otskp "
            "WHERE nazev LIKE ? ORDER BY cena LIMIT ?",
            (f"%{keyword.upper()}%", limit)
        ).fetchall()
        return [OTSKPItem(**dict(r)) for r in rows]

    def get_many(self, codes: List[str]) -> Dict[str, OTSKPItem]:
        """Batch lookup."""
        result = {}
        for code in codes:
            item = self.get(code)
            if item:
                result[code] = item
        return result

    def __enter__(self):
        self.connect()
        return self

    def __exit__(self, *args):
        self.close()


# ─────────────────────────────────────────────────────────────────────────────
# OTSKP SELECTOR — variant selection based on TZ parameters
# ─────────────────────────────────────────────────────────────────────────────

class OTSKPSelector:
    """
    Intelligent OTSKP variant selection based on TZ parameters.

    Example: KOLEJ 49E1 has 96 variants — selector picks the right one
    based on: rail type + sleeper type + division + fastening type.
    """

    KOLEJ_49E1_MAP = {
        # (division, sleeper, fastening) → OTSKP code
        ("l", "ocelový Y", "pružné"): "5289E2",
        ("k", "ocelový Y", "pružné"): "528AE2",
        ("l", "ocelový Y", "pružné", "regen"): "52A9E2",
        ("k", "ocelový Y", "pružné", "regen"): "52AAE2",
        ("c", "bet. bezpodkl.", "pružné"): "528152",
        ("d", "bet. bezpodkl.", "pružné"): "528252",
        ("u", "bet. bezpodkl.", "pružné"): "528352",
        ("d", "bet. podkl.", "tuhé"): "528231",
        ("u", "bet. podkl.", "tuhé"): "528331",
        ("mos", "dřevěný", "pružné"): "5284D2",
    }

    @classmethod
    def select_kolej_49e1(
        cls,
        sleeper_division: str,
        sleeper_type: str,
        fastening_type: str,
        is_regenerated: bool = False,
    ) -> Optional[str]:
        """
        Return OTSKP code for composite track frame item 49E1.

        NOTE: This item includes EVERYTHING — rails + sleepers + fastening
        + ballast laying. Do NOT add separate items for sleepers and rails.
        """
        division = (sleeper_division or "").lower()

        fastening_norm = "pružné"
        if fastening_type and any(x in fastening_type.upper() for x in ["K ", "TUHÉ", "ZS"]):
            fastening_norm = "tuhé"

        sleeper_norm = sleeper_type.lower() if sleeper_type else ""
        if "y" in sleeper_norm or "ocel" in sleeper_norm:
            prazec_norm = "ocelový Y"
        elif "bezpodkl" in sleeper_norm or ("bet" in sleeper_norm and "bezpod" in sleeper_norm):
            prazec_norm = "bet. bezpodkl."
        elif "podkl" in sleeper_norm or "bet" in sleeper_norm:
            prazec_norm = "bet. podkl."
        else:
            prazec_norm = "dřevěný"

        key = (division, prazec_norm, fastening_norm)
        if is_regenerated:
            key_regen = (division, prazec_norm, fastening_norm, "regen")
            if key_regen in cls.KOLEJ_49E1_MAP:
                return cls.KOLEJ_49E1_MAP[key_regen]

        return cls.KOLEJ_49E1_MAP.get(key)

    @classmethod
    def select_lis(cls, lis_length_m: float, thermally_processed: bool = True) -> str:
        """Select LIS variant by length and thermal processing."""
        if lis_length_m is None:
            return "544311"

        if lis_length_m < 3.4:
            return "544221" if thermally_processed else "544222"
        elif lis_length_m <= 8.0:
            return "544311" if thermally_processed else "544322"
        else:
            return "544411" if thermally_processed else "544412"

    @classmethod
    def select_svar(cls, batch_welding: bool = True) -> str:
        """49E1 weld: batch = cheaper, individual = more expensive."""
        return "545122" if batch_welding else "545121"

    @classmethod
    def select_gabion(cls, wire_diameter_mm: float = 2.7) -> str:
        """Gabion: select by wire diameter."""
        if wire_diameter_mm <= 2.2:
            return "3272B1"
        elif wire_diameter_mm <= 2.7:
            return "3272B4"
        else:
            return "3272B7"


# ─────────────────────────────────────────────────────────────────────────────
# COMPOSITE DETECTION
# ─────────────────────────────────────────────────────────────────────────────

COMPOSITE_PREFIXES = [
    "528",  # Kolejový rošt (rails + sleepers + fastening)
    "529",  # Kolejový rošt variants
    "52A",  # Kolejový rošt regenerated
    "52B",  # Kolejový rošt long strips
    "536",  # Výhybkové konstrukce (whole)
    "537",  # Betonový žlab (whole)
]


def is_composite_item(code: str) -> bool:
    """Check if OTSKP code is a composite item (includes sub-components)."""
    code_upper = code.upper()
    return any(code_upper.startswith(prefix) for prefix in COMPOSITE_PREFIXES)


# ─────────────────────────────────────────────────────────────────────────────
# FIXED OTSKP CODES — static mapping
# ─────────────────────────────────────────────────────────────────────────────

FIXED_CODES = {
    # Demolition
    "demolice_beton": "965111",
    "demolice_beton_odvoz": "965115",
    "odtezeni_KL": "965010",
    "odvoz_KL_deponie": "965022",
    # New ballast
    "KL_nove_drcene": "512550",
    "KL_doplneni": "513550",
    "KL_procisteni": "514000",
    # Welds and LIS
    "svar_49E1_spojite": "545122",
    "svar_49E1_jednotlive": "545121",
    "lis_standard_neopr": "544322",
    "lis_standard_opr": "544311",
    # Walkways
    "stezka_drt_50plus": "925120",
    # Earthwork
    "nasypani_sypaniny": "171101",
    # Gabions
    "gabion_22": "3272B1",
    "gabion_27": "3272B4",
    "gabion_40": "3272B7",
}


# ─────────────────────────────────────────────────────────────────────────────
# TSKP ↔ OTSKP BRIDGE
# ─────────────────────────────────────────────────────────────────────────────

TSKP_TO_OTSKP_BRIDGE = {
    "5121": ["5289E2", "528152", "528252"],
    "5122": ["965141", "965111"],
    "5123": ["512550", "514000"],
    "5125": ["545121", "545122"],
    "5126": ["544311", "544322"],
    "3272": ["3272B1", "3272A1"],
    "1711": ["171101", "171102"],
}


# ─────────────────────────────────────────────────────────────────────────────
# RAILWAY PRICE ENGINE
# ─────────────────────────────────────────────────────────────────────────────

class RailwayPriceEngine:
    """
    Generates priced bill of quantities for SO 111 (track) + SO 112 (substructure).
    Inputs: ZelSvrsekParams + ZelSpodekParams from v4.3.
    Prices: OTSKP 1/2025 (SQLite).

    COMPOSITE PRINCIPLE:
    OTSKP 528xxx = rails + sleepers + fastening + KL laying = ONE price per meter.
    NEVER itemize rails, sleepers, fastening clips separately!
    """

    def __init__(self, db: OTSKPDatabase):
        self.db = db
        self._cache: Dict[str, OTSKPItem] = {}

    def price(self, code: str) -> Decimal:
        """Get item price from DB."""
        if code not in self._cache:
            item = self.db.get(code)
            self._cache[code] = item
        item = self._cache.get(code)
        return Decimal(str(item.cena)) if item else Decimal("0")

    def item(self, code: str) -> Optional[OTSKPItem]:
        if code not in self._cache:
            self._cache[code] = self.db.get(code)
        return self._cache[code]

    def generate_svrsek(self, p) -> List[PricedPolozka]:
        """
        Generate priced items for ZelSvrsekParams.
        NOTE: Kolejové lože (512xxx) is NOT auto-generated — manual resource breakdown.
        """
        items = []
        tf = getattr(p, "track_frame", None)
        cw = getattr(p, "continuous_welded", None)
        recon_len = Decimal(str(p.reconstruction_length_m or 0))

        if recon_len == 0:
            return items

        # 1.01 Demolition of existing track
        code_dem = FIXED_CODES["demolice_beton"]
        items.append(self._make_item(
            "1.01", code_dem,
            "Demontáž stávajícího kolejového roštu",
            f"stávající kolejnice + pražce, délka {p.reconstruction_length_m} m",
            "M", recon_len, "reconstruction_length_m",
        ))

        # 1.02 Removal of ballast
        code_kl = FIXED_CODES["odtezeni_KL"]
        ballast_mm = (tf.ballast_thickness_under_y_mm or 300) if tf else 300
        qty_kl = recon_len * Decimal("3.5") * Decimal(str((ballast_mm + 200) / 1000))
        items.append(self._make_item(
            "1.02", code_kl,
            "Odtěžení stávajícího kolejového lože",
            f"tl. {ballast_mm}mm + 200mm pod pražec, šířka 3.5m",
            "M3", qty_kl.quantize(Decimal("0.1")),
            "reconstruction_length_m + ballast_thickness",
            confidence=0.85,
        ))

        # 2.01 NEW TRACK — COMPOSITE ITEM (528xxx)
        code_kolej = "5289E2"  # default
        if tf:
            selected = OTSKPSelector.select_kolej_49e1(
                sleeper_division=tf.sleeper_division or "l",
                sleeper_type=tf.sleeper_type or "ocelový Y",
                fastening_type=tf.fastening_type or "S15",
            )
            if selected:
                code_kolej = selected

        spec = "49 E1 R260, ocelový Y, rozdělení l, S15 pružné"
        if tf:
            spec = (
                f"49 E1 {tf.rail_steel_class or 'R260'}, "
                f"{tf.sleeper_type or 'ocelový Y'} rozdělení \"{tf.sleeper_division or 'l'}\", "
                f"upevnění {tf.fastening_type or 'S15'} pružné"
            )

        items.append(self._make_item(
            "2.01", code_kolej,
            "Nový kolejový rošt — komplexní položka (kolejnice + pražce + upevnění + KL)",
            spec, "M", recon_len, "reconstruction_length_m",
        ))

        # NOTE: Kolejové lože (item 2.02) is NOT auto-generated
        # User adds it manually with resource breakdown

        # 2.03 Welds (BK)
        if cw and cw.is_new:
            code_svar = OTSKPSelector.select_svar(batch_welding=True)
            strip_len = cw.rail_strip_length_m or 75
            n_svary = round(float(recon_len) / strip_len) * 2
            items.append(self._make_item(
                "2.03", code_svar,
                "Svary kolejnic — závarové styky BK (spojitě)",
                f"49 E1, pásy délky {strip_len} m, 2 kolejnicové pásy",
                "KUS", Decimal(str(n_svary)),
                "reconstruction_length_m + rail_strip_length_m",
                confidence=0.90,
            ))

        # 2.04 LIS
        for tc in (p.track_circuits or []):
            code_lis = OTSKPSelector.select_lis(
                lis_length_m=tc.lis_length_m or 3.4,
                thermally_processed=False,
            )
            items.append(self._make_item(
                "2.04", code_lis,
                "Vvaření LIS — lepené izolované styky",
                f"tv. {tc.lis_type or '49E1'}, délka {tc.lis_length_m or 3.4} m, km {tc.location_km}",
                "KUS", Decimal("2"),
                "track_circuits[].lis_length_m",
            ))

        # 3.01 Walkways
        code_stezka = FIXED_CODES["stezka_drt_50plus"]
        qty_stezka = recon_len * Decimal(str(p.walkway_width_m or 0.55))
        items.append(self._make_item(
            "3.01", code_stezka,
            "Drážní stezky — obnova z drti",
            f"šířka min. {p.walkway_width_m or 0.55} m, tl. přes 50 mm",
            "M2", qty_stezka.quantize(Decimal("0.1")),
            "reconstruction_length_m + walkway_width_m",
            confidence=0.85,
        ))

        return items

    def generate_spodek(self, p) -> List[PricedPolozka]:
        """Generate priced items for ZelSpodekParams."""
        items = []

        # Gabions (MJ: M3 — must convert from length!)
        for i, wall in enumerate(p.gabion_walls or []):
            code_gab = OTSKPSelector.select_gabion(wire_diameter_mm=2.7)
            w = wall.element_width_m or 0.60
            h = wall.element_height_m or 0.50
            vol = Decimal(str(wall.length_m or 0)) * Decimal(str(w)) * Decimal(str(h))
            items.append(self._make_item(
                f"S3.0{i + 1}", code_gab,
                f"Gabionová zídka — {wall.side or 'vlevo'}, {wall.location_description or ''}",
                f"koše {wall.element_length_m}×{w}×{h} m, drát Ø2.7mm",
                "M3", vol.quantize(Decimal("0.1")),
                f"gabion_walls[{i}].length_m × width × height",
            ))

        return items

    def summarize(self, items: List[PricedPolozka]) -> dict:
        """Return summary with total prices."""
        total_ok = sum(i.total or 0 for i in items if i.quantity_status == "OK")
        total_est = sum(i.total or 0 for i in items if i.quantity_status == "ODHADNUTO")

        return {
            "items_count": len(items),
            "items_ok": sum(1 for i in items if i.quantity_status == "OK"),
            "items_estimated": sum(1 for i in items if i.quantity_status == "ODHADNUTO"),
            "items_missing": sum(1 for i in items if i.quantity_status == "CHYBÍ_VSTUP"),
            "total_ok_czk": round(total_ok, 0),
            "total_estimated_czk": round(total_est, 0),
            "total_all_czk": round(total_ok + total_est, 0),
            "price_level": "OTSKP 1/2025",
            "note": "Ceny bez DPH. KOLEJ: kompozitní položka zahrnuje kolejnice+pražce+upevnění.",
        }

    def _make_item(
        self, item_id: str, code: str, desc: str, spec: str,
        mj: str, qty: Decimal, source: str, confidence: float = 1.0,
    ) -> PricedPolozka:
        """Helper to create a PricedPolozka."""
        up = self.price(code)
        tp = qty * up if qty and up else None
        otskp = self.item(code)
        return PricedPolozka(
            item_id=item_id,
            code_otskp=code,
            nazev_otskp=otskp.nazev if otskp else "",
            description_custom=desc,
            specification=spec,
            mj=mj,
            quantity=qty,
            unit_price=up,
            total_price=tp,
            quantity_status="OK" if confidence >= 0.8 else "ODHADNUTO",
            confidence=confidence,
            source_param=source,
            quantity_formula=source,
        )
