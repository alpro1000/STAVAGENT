"""
Position Enrichment Service
Обогащение позиций данными из чертежей, норм и материалов
"""
import json
import logging
from typing import Any, Dict, List, Optional

from app.core.claude_client import ClaudeClient
from app.core.kb_loader import get_knowledge_base
from app.utils.datetime_utils import get_utc_timestamp_iso

logger = logging.getLogger(__name__)


class PositionEnricher:
    """Сервис для обогащения позиций дополнительной информацией."""

    def __init__(self) -> None:
        self.claude = ClaudeClient()
        self.kb = get_knowledge_base()
        logger.info("✅ PositionEnricher initialized")

    async def enrich_position(
        self,
        position: Dict[str, Any],
        project_id: str,
        drawing_specs: Optional[Dict[str, Any]] = None,
        enable_claude: bool = True,
    ) -> Dict[str, Any]:
        """Обогатить одну позицию полной информацией."""

        logger.info("🧬 Enriching position: %s", position.get("code", position.get("id")))

        enriched = dict(position)

        # ===== ШАГИ ОБОГАЩЕНИЯ =====

        # 1️⃣ STEP 1: Найти базовые данные из Knowledge Base
        enriched = await self._enrich_from_kb(enriched)

        # 2️⃣ STEP 2: Найти материалы и характеристики
        enriched = await self._enrich_materials(enriched)

        # 3️⃣ STEP 3: Найти нормы и стандарты
        enriched = await self._enrich_norms(enriched)

        # 4️⃣ STEP 4: Найти поставщиков и цены
        enriched = await self._enrich_suppliers(enriched)

        # 5️⃣ STEP 5: Обогатить из чертежей (если есть)
        if drawing_specs:
            enriched = await self._enrich_from_drawings(enriched, drawing_specs)

        # 6️⃣ STEP 6: Рассчитать трудозатраты и ресурсы
        enriched = await self._enrich_resources(enriched)

        # 7️⃣ STEP 7: Claude анализ (опционально, для сложных позиций)
        if enable_claude and self._needs_claude_analysis(enriched):
            enriched = await self._enrich_with_claude(enriched, project_id)

        # ФИНАЛ: Добавить метаданные обогащения
        enriched["enrichment"] = {
            "enriched_at": get_utc_timestamp_iso(),
            "steps_completed": 7,
            "confidence": self._calculate_confidence(enriched),
            "warnings": self._collect_warnings(enriched),
        }

        logger.info(
            "✅ Position enriched: %s (confidence: %s%%)",
            enriched.get("code"),
            enriched["enrichment"]["confidence"],
        )
        return enriched

    async def _enrich_from_kb(self, position: Dict[str, Any]) -> Dict[str, Any]:
        """STEP 1: Найти в Knowledge Base основные данные по коду."""
        code = position.get("code")
        if not code:
            logger.warning("Position has no code, skipping KB lookup")
            return position

        logger.info("🔍 Searching KB for code: %s", code)

        kros_index = self.kb.get_kros_index()
        kb_data = kros_index.get(code)

        if kb_data:
            position.update(
                {
                    "kb_code": code,
                    "kb_name": kb_data.get("name"),
                    "kb_unit": kb_data.get("unit"),
                    "kb_category": kb_data.get("section"),  # Use 'section' instead of 'category'
                    "kb_source": "OTSKP_2024",
                }
            )
            logger.info("✅ Found in KB: %s", kb_data.get("name"))
        else:
            logger.warning("Code %s not found in KB", code)
            position["kb_source"] = "not_found"

        return position

    async def _enrich_materials(self, position: Dict[str, Any]) -> Dict[str, Any]:
        """STEP 2: Найти материалы и их характеристики."""
        description = position.get("description", "")
        description_lower = description.lower()  # Cache lowercased version

        logger.info("🧱 Analyzing materials in: %s", description[:50])

        materials: List[Dict[str, Any]] = []

        if "beton" in description_lower or "c30" in description_lower:
            beton_match = self.kb.search_material("beton", description)
            if beton_match:
                materials.append(
                    {
                        "type": "бетон",
                        "grade": beton_match.get("grade", "C30/37"),
                        "qty": position.get("quantity"),
                        "unit": position.get("unit"),
                        "density": beton_match.get("density", "2350 kg/m³"),
                        "strength": beton_match.get("strength", "30 MPa"),
                        "workability": beton_match.get("workability", "S4"),
                        "price_estimate": beton_match.get("price", 2100),
                    }
                )

        if "armatur" in description_lower or "b500" in description_lower:
            armor_match = self.kb.search_material("armatura", description)
            if armor_match:
                materials.append(
                    {
                        "type": "armatura",
                        "grade": armor_match.get("grade", "B500B"),
                        "qty": position.get("quantity"),
                        "unit": position.get("unit"),
                        "variants": armor_match.get("variants", []),
                        "price_estimate": armor_match.get("price", 8500),
                    }
                )

        if "oppalubk" in description_lower or "bedeni" in description_lower:
            form_match = self.kb.search_material("oppalubka", description)
            if form_match:
                materials.append(
                    {
                        "type": "oppalubka",
                        "material": form_match.get("material", "WBP"),
                        "qty": position.get("quantity"),
                        "unit": position.get("unit"),
                        "price_estimate": form_match.get("price", 450),
                    }
                )

        position["materials"] = materials
        if materials:
            logger.info("✅ Found %s material(s)", len(materials))
        return position

    async def _enrich_norms(self, position: Dict[str, Any]) -> Dict[str, Any]:
        """STEP 3: Найти применимые нормы и стандарты."""
        code = position.get("code")

        logger.info("📐 Finding applicable norms for %s", code)

        norms: List[str] = []

        for mat in position.get("materials", []):
            mat_type = (mat.get("type") or "").lower()

            if "beton" in mat_type:
                norms.extend([
                    "ČSN EN 206-1",
                    "ČSN 73 1201",
                    "TKP 18 Beton",
                ])
            elif "armatur" in mat_type:
                norms.extend([
                    "ČSN EN 10080",
                    "ČSN 73 1201",
                    "TKP 18 Armatura",
                ])
            elif "oppalubk" in mat_type:
                norms.extend([
                    "ČSN 73 1201",
                    "TKP 18 Bedení",
                ])

        position["applicable_norms"] = list(set(norms))
        if norms:
            logger.info("✅ Found %s applicable norm(s)", len(set(norms)))
        return position

    async def _enrich_suppliers(self, position: Dict[str, Any]) -> Dict[str, Any]:
        """STEP 4: Найти поставщиков и ориентировочные цены."""
        materials = position.get("materials", [])

        logger.info("🏢 Searching suppliers for %s material(s)", len(materials))

        suppliers: List[Dict[str, Any]] = []

        for mat in materials:
            mat_type = (mat.get("type") or "").lower()
            price_estimate = mat.get("price_estimate")
            has_price = price_estimate is not None
            price_status = "estimated" if has_price else "not_found"

            if "beton" in mat_type:
                suppliers.extend(
                    [
                        {
                            "type": "Бетон",
                            "name": "Betonářský závod Brno",
                            "distance": "45 km",
                            "price": price_estimate,
                            "price_status": price_status,
                            "last_updated": "2025-10",
                            "source": "KB",
                            "delivery": "Po-Pá",
                        },
                        {
                            "type": "Бетон",
                            "name": "Mix-Beton Moravský Krumlov",
                            "distance": "78 km",
                            "price": price_estimate,
                            "price_status": price_status,
                            "last_updated": "2025-10",
                            "source": "KB",
                            "delivery": "Po-Pá",
                        },
                    ]
                )

            elif "armatur" in mat_type:
                suppliers.extend(
                    [
                        {
                            "type": "Армиатура",
                            "name": "Ocel Servis s.r.o.",
                            "distance": "32 km",
                            "price": price_estimate,
                            "price_status": price_status,
                            "last_updated": "2025-10",
                            "source": "KB",
                            "delivery": "Expres 48h",
                        },
                        {
                            "type": "Армиатура",
                            "name": "Česká ocel a.s.",
                            "distance": "120 km",
                            "price": price_estimate,
                            "price_status": price_status,
                            "last_updated": "2025-10",
                            "source": "KB",
                            "delivery": "Po-Pá",
                        },
                    ]
                )

        if suppliers:
            position["suppliers"] = suppliers
            logger.info("✅ Found %s supplier option(s)", len(suppliers))
        else:
            position["suppliers"] = []

        return position

    async def _enrich_from_drawings(
        self,
        position: Dict[str, Any],
        drawing_specs: Dict[str, Any],
    ) -> Dict[str, Any]:
        """STEP 5: Обогатить данными из чертежей."""

        logger.info("📐 Enriching from drawing specs: %s spec(s)", len(drawing_specs))

        if drawing_specs.get("technical_specs"):
            position["technical_specs"] = drawing_specs["technical_specs"]

        if drawing_specs.get("dimensions"):
            position["dimensions"] = drawing_specs["dimensions"]

        if drawing_specs.get("special_requirements"):
            position["special_requirements"] = drawing_specs["special_requirements"]

        logger.info("✅ Enhanced with drawing specs")
        return position

    async def _enrich_resources(self, position: Dict[str, Any]) -> Dict[str, Any]:
        """STEP 6: Рассчитать трудозатраты и необходимые ресурсы."""

        logger.info("⚙️ Calculating resources for %s", position.get("code"))

        productivity_norms = {
            "oppalubka": {"productivity": 12, "unit": "m2/day", "workers": 2},
            "armatura": {"productivity": 0.6, "unit": "t/day", "workers": 1},
            "beton": {"productivity": 5, "unit": "m3/day", "workers": 2},
        }

        quantity = position.get("quantity", 0) or 0
        materials = position.get("materials", [])

        total_labor_hours = 0.0
        equipment_list: List[Dict[str, Any]] = []

        for mat in materials:
            mat_type = (mat.get("type") or "").lower()

            for key, norm in productivity_norms.items():
                if key in mat_type:
                    productivity = norm["productivity"] or 1
                    days_needed = quantity / productivity if productivity else 0
                    labor_hours = days_needed * 8 * norm["workers"]
                    total_labor_hours += labor_hours

                    if "oppalubka" in mat_type:
                        equipment_list.append(
                            {
                                "type": "Jeřáb mobilní 20t",
                                "hours": days_needed * 2,
                                "daily_rate": 4500,
                            }
                        )
                    elif "beton" in mat_type:
                        equipment_list.append(
                            {
                                "type": "Autobetonárna",
                                "hours": quantity / 5 if quantity else 0,
                                "daily_rate": 3500,
                            }
                        )

        labor_hours_int = int(total_labor_hours)
        position["labor"] = {
            "total_hours": labor_hours_int,
            "estimated_workers": 2,
            "estimated_days": int(labor_hours_int / 16) if labor_hours_int else 0,
            "cost_estimate": int(total_labor_hours * 300),
        }

        position["equipment"] = equipment_list

        logger.info(
            "✅ Calculated: %s labor hours, %s equipment item(s)",
            labor_hours_int,
            len(equipment_list),
        )
        return position

    async def _enrich_with_claude(
        self,
        position: Dict[str, Any],
        project_id: str,
    ) -> Dict[str, Any]:
        """STEP 7: Claude анализ для сложных позиций."""

        logger.info("🧠 Claude analysis for %s", position.get("code"))

        prompt = f"""
Анализируй строительную позицию и дай рекомендации:

Позиция: {position.get('code')} - {position.get('description')}
Количество: {position.get('quantity')} {position.get('unit')}

Текущие данные:
- Материалы: {[m.get('type') for m in position.get('materials', [])]}
- Нормы: {position.get('applicable_norms', [])}
- Трудозатраты: {position.get('labor', {}).get('total_hours')} часов

Предоставь JSON с дополнениями:
{{
    "analysis": "Твой анализ",
    "risks": ["риск 1", "риск 2"],
    "recommendations": ["рекомендация 1"],
    "additional_resources": {{}},
    "alternative_approaches": []
}}
"""

        try:
            response = await self.claude.analyze(prompt)
            analysis = json.loads(response)
            position["claude_analysis"] = analysis
            logger.info("✅ Claude analysis complete")
        except Exception as exc:  # pragma: no cover - network errors
            logger.warning("Claude analysis failed: %s", exc)

        return position

    def _needs_claude_analysis(self, position: Dict[str, Any]) -> bool:
        """Проверить нужен ли Claude анализ."""
        confidence = self._calculate_confidence(position)
        return confidence < 70

    def _calculate_confidence(self, position: Dict[str, Any]) -> int:
        """Рассчитать уровень уверенности в обогащении."""
        score = 0
        max_score = 100

        if position.get("kb_source") != "not_found":
            score += 20
        if position.get("materials"):
            score += 20
        if position.get("applicable_norms"):
            score += 15
        if position.get("suppliers"):
            if all(s.get("price") for s in position["suppliers"]):
                score += 15
            else:
                score += 5
        if position.get("labor"):
            score += 15
        if position.get("equipment"):
            score += 15

        return min(score, max_score)

    def _collect_warnings(self, position: Dict[str, Any]) -> List[str]:
        """Собрать предупреждения о качестве обогащения."""
        warnings: List[str] = []

        if not position.get("kb_source") or position.get("kb_source") == "not_found":
            warnings.append("Код позиции не найден в Knowledge Base")

        if not position.get("materials"):
            warnings.append("Материалы не определены")

        suppliers = position.get("suppliers", [])
        if not suppliers:
            warnings.append("Поставщики не найдены")
        elif not any(s.get("price") for s in suppliers):
            warnings.append("⚠️ Цены не найдены - требуется ручной ввод")

        if position.get("labor", {}).get("total_hours", 0) == 0:
            warnings.append("Трудозатраты не рассчитаны")

        return warnings


class BatchEnricher:
    """Batch-обработчик для обогащения множества позиций."""

    def __init__(self) -> None:
        self.enricher = PositionEnricher()
        logger.info("✅ BatchEnricher initialized")

    async def enrich_positions(
        self,
        positions: List[Dict[str, Any]],
        project_id: str,
        drawing_specs: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """Обогатить множество позиций."""

        logger.info("🧬 Enriching batch: %s position(s)", len(positions))

        enriched: List[Dict[str, Any]] = []
        for index, position in enumerate(positions, 1):
            logger.info("  [%s/%s] Processing: %s", index, len(positions), position.get("code"))

            try:
                result = await self.enricher.enrich_position(
                    position,
                    project_id,
                    drawing_specs,
                )
                enriched.append(result)
            except Exception as exc:  # pragma: no cover - defensive
                logger.error("Failed to enrich position: %s", exc)
                enriched.append(position)

        logger.info("✅ Batch enrichment complete: %s position(s)", len(enriched))
        return enriched
