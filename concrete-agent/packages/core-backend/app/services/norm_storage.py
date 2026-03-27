"""
NKB Storage — JSON file-based registry and rules storage.

Layer 1: norms_registry.json — NormativeDocument catalog
Layer 2: norms_rules.json — NormativeRule extracted parameters

Uses atomic writes (write to .tmp, then rename) like learned_patterns.py.
Seeded with Czech construction norms on first access.

Author: STAVAGENT Team
Version: 1.0.0
Date: 2026-03-27
"""

import json
import logging
import threading
from pathlib import Path
from typing import Dict, List, Optional

from app.core.config import settings
from app.models.norm_schemas import (
    NormativeDocument,
    NormativeRule,
    NormCategory,
    NormScope,
    NormSearchQuery,
    RuleSearchQuery,
    RuleType,
)

logger = logging.getLogger(__name__)

_REGISTRY_FILE = "norms_registry.json"
_RULES_FILE = "norms_rules.json"


def _data_dir() -> Path:
    d = settings.DATA_DIR / "nkb"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _atomic_write(path: Path, data: dict) -> None:
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


# ---------------------------------------------------------------------------
# Seed data — Czech construction norms
# ---------------------------------------------------------------------------
def _seed_norms() -> List[NormativeDocument]:
    """Seed registry with core Czech construction norms."""
    return [
        NormativeDocument(
            norm_id="ZAKON_183_2006",
            category=NormCategory.ZAKON,
            designation="Zákon č. 183/2006 Sb.",
            title="Stavební zákon",
            scope=NormScope(construction_types=["pozemní", "dopravní", "železniční"], phases=["DUR", "DSP", "PDPS", "realizace"]),
            priority=100,
            tags=["stavební_zákon", "legislativa"],
        ),
        NormativeDocument(
            norm_id="VYHLASKA_146_2008",
            category=NormCategory.VYHLASKA,
            designation="Vyhláška č. 146/2008 Sb.",
            title="O rozsahu a obsahu projektové dokumentace dopravních staveb",
            scope=NormScope(construction_types=["dopravní"], phases=["DUR", "DSP", "PDPS"]),
            priority=90,
            tags=["projektová_dokumentace", "dopravní"],
        ),
        NormativeDocument(
            norm_id="CSN_73_6201",
            category=NormCategory.CSN,
            designation="ČSN 73 6201",
            title="Projektování mostních objektů",
            scope=NormScope(construction_types=["dopravní", "mostní"], objects=["most", "lávka"]),
            priority=70,
            tags=["mosty", "projektování"],
        ),
        NormativeDocument(
            norm_id="CSN_EN_206",
            category=NormCategory.CSN_EN,
            designation="ČSN EN 206+A2",
            title="Beton — Specifikace, vlastnosti, výroba a shoda",
            scope=NormScope(construction_types=["pozemní", "dopravní", "mostní"], objects=["beton"]),
            priority=70,
            tags=["beton", "specifikace", "kvalita"],
        ),
        NormativeDocument(
            norm_id="CSN_73_1201",
            category=NormCategory.CSN,
            designation="ČSN 73 1201",
            title="Navrhování betonových konstrukcí pozemních staveb",
            scope=NormScope(construction_types=["pozemní"], objects=["beton", "výztuž"]),
            priority=70,
            tags=["beton", "pozemní", "navrhování"],
        ),
        NormativeDocument(
            norm_id="TKP_18",
            category=NormCategory.TKP,
            designation="TKP 18",
            title="Betonové konstrukce a mosty — provádění",
            scope=NormScope(construction_types=["dopravní", "mostní"], objects=["beton", "bednění", "výztuž"], phases=["realizace"]),
            priority=60,
            tags=["beton", "mosty", "provádění"],
        ),
        NormativeDocument(
            norm_id="TKP_1",
            category=NormCategory.TKP,
            designation="TKP 1",
            title="Všeobecné požadavky na stavby pozemních komunikací",
            scope=NormScope(construction_types=["dopravní"], phases=["realizace"]),
            priority=60,
            tags=["komunikace", "obecné"],
        ),
        NormativeDocument(
            norm_id="VTP_SZ_2019",
            category=NormCategory.VTP,
            designation="VTP SŽ 2019",
            title="Vzorové technické podmínky SŽ — železniční spodek",
            scope=NormScope(construction_types=["železniční"], objects=["spodek", "podloží", "odvodnění"]),
            priority=50,
            tags=["železnice", "spodek"],
        ),
        NormativeDocument(
            norm_id="ZTP_SZ_3",
            category=NormCategory.ZTP,
            designation="ZTP SŽ 3",
            title="Zvláštní technické podmínky — železniční svršek",
            scope=NormScope(construction_types=["železniční"], objects=["svršek", "kolej", "výhybky"]),
            priority=55,
            tags=["železnice", "svršek"],
        ),
        NormativeDocument(
            norm_id="CSN_73_0420",
            category=NormCategory.CSN,
            designation="ČSN 73 0420-1",
            title="Přesnost vytyčování staveb — Část 1: Základní požadavky",
            scope=NormScope(construction_types=["pozemní", "dopravní"], phases=["realizace"]),
            priority=70,
            tags=["přesnost", "vytyčování", "geodézie"],
        ),
        NormativeDocument(
            norm_id="PPK_SFDI",
            category=NormCategory.PREDPIS,
            designation="PPK SFDI",
            title="Pravidla pro provádění kontroly na stavbách PK financovaných SFDI",
            scope=NormScope(construction_types=["dopravní"], phases=["realizace"]),
            priority=65,
            tags=["kontrola", "SFDI", "PPK"],
        ),
        NormativeDocument(
            norm_id="CSN_EN_13670",
            category=NormCategory.CSN_EN,
            designation="ČSN EN 13670",
            title="Provádění betonových konstrukcí",
            scope=NormScope(construction_types=["pozemní", "dopravní", "mostní"], objects=["beton", "bednění", "výztuž"], phases=["realizace"]),
            priority=70,
            tags=["beton", "provádění"],
        ),
        NormativeDocument(
            norm_id="CSN_73_6101",
            category=NormCategory.CSN,
            designation="ČSN 73 6101",
            title="Projektování silnic a dálnic",
            scope=NormScope(construction_types=["dopravní"], objects=["vozovka", "komunikace"]),
            priority=70,
            tags=["silnice", "dálnice", "projektování"],
        ),
        NormativeDocument(
            norm_id="CSN_73_0212",
            category=NormCategory.CSN,
            designation="ČSN 73 0212-3",
            title="Geometrická přesnost ve výstavbě — Kontrola přesnosti — Část 3: Pozemní stavební objekty",
            scope=NormScope(construction_types=["pozemní"], phases=["realizace"]),
            priority=70,
            tags=["přesnost", "kontrola", "pozemní"],
        ),
    ]


def _seed_rules() -> List[NormativeRule]:
    """Seed rules with real examples from PPK, TKP, ČSN."""
    return [
        # PPK SFDI — tolerances
        NormativeRule(
            rule_id="PPK_SFDI_R001",
            norm_id="PPK_SFDI",
            rule_type=RuleType.TOLERANCE,
            title="Tolerance tloušťky krycí vrstvy výztuže",
            description="Odchylka tloušťky krycí vrstvy betonářské výztuže nesmí překročit ±5 mm",
            applies_to=["výztuž", "beton", "krycí_vrstva"],
            parameter="tloušťka_krycí_vrstvy",
            min_value=-5.0,
            max_value=5.0,
            unit="mm",
            is_mandatory=True,
            priority=65,
            section_reference="PPK čl. 7.3.2",
            tags=["krycí_vrstva", "výztuž", "tolerance"],
        ),
        NormativeRule(
            rule_id="PPK_SFDI_R002",
            norm_id="PPK_SFDI",
            rule_type=RuleType.TOLERANCE,
            title="Tolerance polohy výztuže",
            description="Odchylka polohy výztužných prutů od projektu max ±10 mm",
            applies_to=["výztuž"],
            parameter="poloha_výztuže",
            min_value=-10.0,
            max_value=10.0,
            unit="mm",
            is_mandatory=True,
            priority=65,
            section_reference="PPK čl. 7.3.1",
            tags=["výztuž", "poloha", "tolerance"],
        ),
        NormativeRule(
            rule_id="PPK_SFDI_R003",
            norm_id="PPK_SFDI",
            rule_type=RuleType.DEADLINE,
            title="Lhůta pro zahájení ošetřování betonu",
            description="Ošetřování betonu musí začít nejpozději do 12 hodin po betonáži",
            applies_to=["beton"],
            parameter="zahájení_ošetřování",
            max_value=12.0,
            unit="hodin",
            is_mandatory=True,
            priority=65,
            section_reference="PPK čl. 6.4",
            tags=["beton", "ošetřování", "lhůta"],
        ),
        NormativeRule(
            rule_id="PPK_SFDI_R004",
            norm_id="PPK_SFDI",
            rule_type=RuleType.PROCEDURE,
            title="Postup kontroly hutnění betonu",
            description="Vibrování betonu: ponorný vibrátor ø50mm, vpich max 400mm, doba 15-30s, překrytí 1.5× radius účinnosti",
            applies_to=["beton", "hutnění"],
            is_mandatory=True,
            priority=65,
            section_reference="PPK čl. 6.2.3",
            tags=["beton", "hutnění", "vibrátor"],
        ),
        # TKP 18 — concrete structures
        NormativeRule(
            rule_id="TKP_18_R001",
            norm_id="TKP_18",
            rule_type=RuleType.REQUIREMENT,
            title="Minimální třída betonu pro mostní konstrukce",
            description="Pro nosné prvky mostů se požaduje min. beton C30/37, pro pilíře C25/30",
            applies_to=["beton", "most"],
            parameter="třída_betonu",
            value="C30/37",
            is_mandatory=True,
            priority=60,
            section_reference="TKP 18 čl. 4.2.1",
            tags=["beton", "mosty", "třída"],
        ),
        NormativeRule(
            rule_id="TKP_18_R002",
            norm_id="TKP_18",
            rule_type=RuleType.TOLERANCE,
            title="Tolerance rovinatosti bednění",
            description="Rovinatost bednění: odchylka max 5 mm na 2m lati pro pohledové plochy",
            applies_to=["bednění"],
            parameter="rovinatost",
            max_value=5.0,
            unit="mm/2m",
            is_mandatory=True,
            priority=60,
            section_reference="TKP 18 čl. 5.1.3",
            tags=["bednění", "rovinatost", "tolerance"],
        ),
        NormativeRule(
            rule_id="TKP_18_R003",
            norm_id="TKP_18",
            rule_type=RuleType.DEADLINE,
            title="Minimální doba ošetřování betonu v mostních konstrukcích",
            description="Beton nosných prvků mostů: min. 7 dní ošetřování, při teplotě <5°C prodloužit",
            applies_to=["beton", "most"],
            parameter="doba_ošetřování",
            min_value=7.0,
            unit="dní",
            is_mandatory=True,
            priority=60,
            section_reference="TKP 18 čl. 6.5.2",
            tags=["beton", "mosty", "ošetřování"],
        ),
        # ČSN EN 206 — concrete specification
        NormativeRule(
            rule_id="CSN_EN_206_R001",
            norm_id="CSN_EN_206",
            rule_type=RuleType.CLASSIFICATION,
            title="Stupně vlivu prostředí",
            description="Klasifikace: XC (karbonatace), XD (chloridy), XF (mráz), XA (chemie). Každá třída betonu musí odpovídat stupni vlivu prostředí.",
            applies_to=["beton"],
            parameter="stupeň_prostředí",
            value="XC1-XC4, XD1-XD3, XF1-XF4, XA1-XA3",
            is_mandatory=True,
            priority=70,
            section_reference="ČSN EN 206 tabulka F.1",
            tags=["beton", "prostředí", "klasifikace"],
        ),
        NormativeRule(
            rule_id="CSN_EN_206_R002",
            norm_id="CSN_EN_206",
            rule_type=RuleType.LIMIT,
            title="Maximální vodní součinitel w/c",
            description="Pro XC4: max w/c = 0.50, pro XD1: max w/c = 0.55, pro XF3: max w/c = 0.50",
            applies_to=["beton"],
            parameter="vodní_součinitel",
            max_value=0.55,
            is_mandatory=True,
            priority=70,
            section_reference="ČSN EN 206 tabulka F.2",
            tags=["beton", "w/c", "limit"],
        ),
        NormativeRule(
            rule_id="CSN_EN_206_R003",
            norm_id="CSN_EN_206",
            rule_type=RuleType.REQUIREMENT,
            title="Minimální obsah cementu",
            description="Pro XC4: min 300 kg/m³, pro XD1: min 300 kg/m³, pro XF3: min 320 kg/m³",
            applies_to=["beton"],
            parameter="obsah_cementu",
            min_value=300.0,
            unit="kg/m³",
            is_mandatory=True,
            priority=70,
            section_reference="ČSN EN 206 tabulka F.3",
            tags=["beton", "cement", "množství"],
        ),
        # ČSN 73 0420 — geometry / precision
        NormativeRule(
            rule_id="CSN_73_0420_R001",
            norm_id="CSN_73_0420",
            rule_type=RuleType.TOLERANCE,
            title="Tolerance vytyčení os sloupů",
            description="Mezní odchylka vytyčení os svislých konstrukcí: ±8 mm do výšky 3m, ±12 mm do 6m",
            applies_to=["sloupy", "stěny", "vytyčení"],
            parameter="odchylka_os",
            max_value=8.0,
            unit="mm",
            is_mandatory=True,
            priority=70,
            section_reference="ČSN 73 0420-1 tabulka 2",
            tags=["přesnost", "vytyčení", "sloupy"],
        ),
        # VTP SŽ — railway subgrade
        NormativeRule(
            rule_id="VTP_SZ_2019_R001",
            norm_id="VTP_SZ_2019",
            rule_type=RuleType.REQUIREMENT,
            title="Požadavek na únosnost zemní pláně",
            description="Statický modul přetvárnosti Edef2 na zemní pláni: min 40 MPa (traťové koleje), min 50 MPa (staniční koleje)",
            applies_to=["zemní_pláň", "spodek"],
            parameter="Edef2",
            min_value=40.0,
            unit="MPa",
            is_mandatory=True,
            priority=50,
            section_reference="VTP SŽ čl. 3.4.1",
            tags=["železnice", "spodek", "únosnost"],
        ),
        # ZTP SŽ 3 — railway superstructure
        NormativeRule(
            rule_id="ZTP_SZ_3_R001",
            norm_id="ZTP_SZ_3",
            rule_type=RuleType.REQUIREMENT,
            title="Typ kolejnice pro traťovou rychlost >120 km/h",
            description="Pro V > 120 km/h se vyžaduje kolejnice UIC 60 (60E2) nebo těžší",
            applies_to=["kolejnice", "svršek"],
            parameter="typ_kolejnice",
            value="60E2",
            is_mandatory=True,
            priority=55,
            section_reference="ZTP SŽ 3 čl. 2.1.3",
            tags=["železnice", "svršek", "kolejnice"],
        ),
    ]


# ---------------------------------------------------------------------------
# NormStore — thread-safe registry + rules storage
# ---------------------------------------------------------------------------
class NormStore:
    """JSON file-based storage for NKB norms and rules."""

    def __init__(self):
        self._lock = threading.Lock()
        self._registry: Dict[str, NormativeDocument] = {}
        self._rules: Dict[str, NormativeRule] = {}
        self._loaded = False

    def _ensure_loaded(self) -> None:
        if self._loaded:
            return
        with self._lock:
            if self._loaded:
                return
            self._load_or_seed()
            self._loaded = True

    def _load_or_seed(self) -> None:
        reg_path = _data_dir() / _REGISTRY_FILE
        rules_path = _data_dir() / _RULES_FILE

        if reg_path.exists():
            try:
                data = json.loads(reg_path.read_text(encoding="utf-8"))
                for item in data.get("norms", []):
                    doc = NormativeDocument(**item)
                    self._registry[doc.norm_id] = doc
                logger.info(f"[NKB] Loaded {len(self._registry)} norms from {reg_path}")
            except Exception as e:
                logger.warning(f"[NKB] Failed to load registry: {e}")

        if rules_path.exists():
            try:
                data = json.loads(rules_path.read_text(encoding="utf-8"))
                for item in data.get("rules", []):
                    rule = NormativeRule(**item)
                    self._rules[rule.rule_id] = rule
                logger.info(f"[NKB] Loaded {len(self._rules)} rules from {rules_path}")
            except Exception as e:
                logger.warning(f"[NKB] Failed to load rules: {e}")

        # Seed if empty
        if not self._registry:
            for doc in _seed_norms():
                self._registry[doc.norm_id] = doc
            self._save_registry()
            logger.info(f"[NKB] Seeded {len(self._registry)} norms")

        if not self._rules:
            for rule in _seed_rules():
                self._rules[rule.rule_id] = rule
            self._save_rules()
            logger.info(f"[NKB] Seeded {len(self._rules)} rules")

    def _save_registry(self) -> None:
        data = {"norms": [doc.model_dump() for doc in self._registry.values()]}
        _atomic_write(_data_dir() / _REGISTRY_FILE, data)

    def _save_rules(self) -> None:
        data = {"rules": [rule.model_dump() for rule in self._rules.values()]}
        _atomic_write(_data_dir() / _RULES_FILE, data)

    # -- Registry operations --

    def get_norm(self, norm_id: str) -> Optional[NormativeDocument]:
        self._ensure_loaded()
        return self._registry.get(norm_id)

    def add_norm(self, doc: NormativeDocument) -> None:
        self._ensure_loaded()
        with self._lock:
            self._registry[doc.norm_id] = doc
            self._save_registry()

    def search_norms(self, query: NormSearchQuery) -> List[NormativeDocument]:
        self._ensure_loaded()
        results = list(self._registry.values())

        if query.active_only:
            results = [n for n in results if n.is_valid]
        if query.category:
            results = [n for n in results if n.category == query.category]
        if query.construction_type:
            ct = query.construction_type.lower()
            results = [n for n in results if ct in [x.lower() for x in n.scope.construction_types]]
        if query.phase:
            ph = query.phase.lower()
            results = [n for n in results if ph in [x.lower() for x in n.scope.phases]]
        if query.object_type:
            ot = query.object_type.lower()
            results = [n for n in results if ot in [x.lower() for x in n.scope.objects]]
        if query.tags:
            query_tags = set(t.lower() for t in query.tags)
            results = [n for n in results if query_tags & set(t.lower() for t in n.tags)]
        if query.query:
            q = query.query.lower()
            results = [n for n in results if q in n.title.lower() or q in n.designation.lower() or q in " ".join(n.tags).lower()]

        results.sort(key=lambda n: n.priority, reverse=True)
        return results[:query.limit]

    def list_norms(self) -> List[NormativeDocument]:
        self._ensure_loaded()
        return sorted(self._registry.values(), key=lambda n: n.priority, reverse=True)

    # -- Rules operations --

    def get_rule(self, rule_id: str) -> Optional[NormativeRule]:
        self._ensure_loaded()
        return self._rules.get(rule_id)

    def add_rule(self, rule: NormativeRule) -> None:
        self._ensure_loaded()
        with self._lock:
            self._rules[rule.rule_id] = rule
            self._save_rules()

    def search_rules(self, query: RuleSearchQuery) -> List[NormativeRule]:
        self._ensure_loaded()
        results = list(self._rules.values())

        if query.norm_id:
            results = [r for r in results if r.norm_id == query.norm_id]
        if query.rule_type:
            results = [r for r in results if r.rule_type == query.rule_type]
        if query.mandatory_only:
            results = [r for r in results if r.is_mandatory]
        if query.construction_type:
            ct = query.construction_type.lower()
            results = [r for r in results if r.construction_type and ct in r.construction_type.lower()]
        if query.phase:
            ph = query.phase.lower()
            results = [r for r in results if r.phase and ph in r.phase.lower()]
        if query.applies_to:
            at = query.applies_to.lower()
            results = [r for r in results if at in [x.lower() for x in r.applies_to]]

        results.sort(key=lambda r: r.priority, reverse=True)
        return results[:query.limit]

    def get_rules_for_norm(self, norm_id: str) -> List[NormativeRule]:
        self._ensure_loaded()
        return [r for r in self._rules.values() if r.norm_id == norm_id]

    def list_rules(self) -> List[NormativeRule]:
        self._ensure_loaded()
        return sorted(self._rules.values(), key=lambda r: r.priority, reverse=True)

    # -- Stats --
    def stats(self) -> Dict:
        self._ensure_loaded()
        return {
            "total_norms": len(self._registry),
            "total_rules": len(self._rules),
            "categories": list(set(n.category.value for n in self._registry.values())),
            "rule_types": list(set(r.rule_type.value for r in self._rules.values())),
        }


# Global instance
_store: Optional[NormStore] = None
_store_lock = threading.Lock()


def get_norm_store() -> NormStore:
    global _store
    if _store is None:
        with _store_lock:
            if _store is None:
                _store = NormStore()
    return _store
