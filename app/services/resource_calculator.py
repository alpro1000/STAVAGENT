"""
Resource Calculator Service
Автоматический расчет материалов, труда и механизмов для каждой позиции
"""

from typing import Dict, List, Any, Union
import json
from pathlib import Path


class ResourceCalculator:
    """
    Раскладывает каждую позицию на ресурсы:
    - Materials (материалы)
    - Labor (труд) 
    - Equipment (механизмы)
    """
    
    def __init__(self, knowledge_base_dir: Union[Path, str]):
        """
        Initialize ResourceCalculator with knowledge base directory.
        
        Args:
            knowledge_base_dir: Path to knowledge base directory (app/knowledge_base).
                               Must be a Path or str, never an AI client object.
        
        Raises:
            TypeError: If knowledge_base_dir is not a Path or str
            FileNotFoundError: If knowledge_base_dir doesn't exist
        """
        # Ensure kb_dir is always a Path object
        if isinstance(knowledge_base_dir, str):
            self.kb_dir = Path(knowledge_base_dir)
        elif isinstance(knowledge_base_dir, Path):
            self.kb_dir = knowledge_base_dir
        else:
            raise TypeError(
                f"knowledge_base_dir must be a Path or str, "
                f"got {type(knowledge_base_dir).__name__}. "
                f"Do not pass AI client objects directly."
            )
        
        self.benchmarks = self._load_benchmarks()
        self.prices = self._load_prices()
        
    def _load_benchmarks(self) -> Dict:
        """Загрузка B4: Production benchmarks"""
        path = self.kb_dir / "B4_production_benchmarks" / "productivity_rates.json"
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def _load_prices(self) -> Dict:
        """Загрузка B3: Current prices"""
        path = self.kb_dir / "B3_current_prices" / "market_prices.json"
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    async def calculate_resources(
        self, 
        position: Dict,
        project_context: Dict
    ) -> Dict[str, Any]:
        """
        Главный метод: раскладка позиции на ресурсы
        
        Args:
            position: Позиция из проекта (код, описание, объем...)
            project_context: Контекст проекта (чертежи, локация...)
            
        Returns:
            {
                "materials": {...},
                "labor": {...},
                "equipment": {...},
                "total_cost": 430500,
                "confidence": "HIGH"
            }
        """
        
        # 1. Классифицируем тип работы
        work_type = self._classify_work_type(position)
        
        # 2. Выбираем модуль расчета
        if work_type == "concrete":
            breakdown = await self._calculate_concrete_work(position, project_context)
        elif work_type == "masonry":
            breakdown = await self._calculate_masonry_work(position, project_context)
        elif work_type == "earthwork":
            breakdown = await self._calculate_earthwork(position, project_context)
        else:
            # Универсальный расчет для остальных
            breakdown = await self._calculate_generic_work(position, project_context)
        
        # 3. Валидация результатов
        breakdown["confidence"] = self._assess_confidence(breakdown, position)
        
        return breakdown
    
    def _classify_work_type(self, position: Dict) -> str:
        """
        Определяем тип работы по коду KROS или описанию
        
        Примеры:
        - 121-xx-xxx → Бетонные работы
        - 142-xx-xxx → Кладка
        - 162-xx-xxx → Земляные работы
        """
        code = position.get("code", "")
        description = position.get("description", "").lower()
        
        # По коду KROS
        if code.startswith("121"):
            return "concrete"
        elif code.startswith("142"):
            return "masonry"
        elif code.startswith("162"):
            return "earthwork"
        
        # По описанию (fallback)
        if "beton" in description or "betonu" in description:
            return "concrete"
        elif "zdivo" in description or "zdění" in description:
            return "masonry"
        
        return "generic"
    
    async def _calculate_concrete_work(
        self, 
        position: Dict, 
        context: Dict
    ) -> Dict:
        """
        Специализированный расчет для бетонных работ
        
        Учитывает:
        - Захватки (сегменты заливки)
        - Производительность опалубки
        - Логистику миксеров
        """
        volume_m3 = position.get("quantity", 0)
        
        # === МАТЕРИАЛЫ ===
        materials = self._calculate_concrete_materials(volume_m3, context)
        
        # === ТРУД ===
        # Используем benchmarks из B4
        concrete_productivity = self.benchmarks["concrete"]["betonazh"]  # m³/h
        crew_size = 6  # стандартная бригада
        hours_needed = volume_m3 / (concrete_productivity * crew_size)
        
        labor = {
            "crew_size": crew_size,
            "hours": round(hours_needed, 1),
            "rate_per_hour": 350,  # Kč
            "subtotal": round(crew_size * hours_needed * 350),
            "source": "B4: Production benchmarks (concrete work)"
        }
        
        # === МЕХАНИЗМЫ ===
        equipment = self._calculate_concrete_equipment(volume_m3, context)
        
        # === ИТОГО ===
        total_cost = (
            materials["subtotal"] + 
            labor["subtotal"] + 
            equipment["subtotal"]
        )
        
        return {
            "materials": materials,
            "labor": labor,
            "equipment": equipment,
            "total_cost": total_cost,
            "calculation_method": "B4 benchmarks + B3 prices"
        }
    
    def _calculate_concrete_materials(self, volume_m3: float, context: Dict) -> Dict:
        """
        Расчет материалов для бетона
        
        - Бетон (заказ с завода)
        - Транспорт (зависит от расстояния)
        - Возможно: добавки, присадки
        """
        concrete_grade = context.get("concrete_grade", "C20/25")
        
        # Цена из B3: Current prices
        unit_price = self.prices.get("beton", {}).get(concrete_grade, 2450)
        
        # Транспорт (оценка по расстоянию)
        distance_km = context.get("distance_to_plant", 25)
        transport_cost = self._estimate_transport_cost(volume_m3, distance_km)
        
        materials = {
            "items": [
                {
                    "name": f"Beton {concrete_grade}",
                    "quantity": volume_m3,
                    "unit": "m³",
                    "unit_price": unit_price,
                    "total": round(volume_m3 * unit_price),
                    "source": "B3: Current market prices (Q3 2024)"
                },
                {
                    "name": "Doprava betonu",
                    "distance_km": distance_km,
                    "total": transport_cost
                }
            ],
            "subtotal": round(volume_m3 * unit_price + transport_cost)
        }
        
        return materials
    
    def _calculate_concrete_equipment(self, volume_m3: float, context: Dict) -> Dict:
        """
        Расчет механизмов для бетонирования
        
        - Бетононасос (обязательно для объемов >50 m³)
        - Миксеры (7 m³ стандарт)
        - Вибраторы (мелкие, обычно есть у бригады)
        """
        
        # Нужен ли насос?
        needs_pump = volume_m3 > 50 or context.get("height_meters", 0) > 3
        
        equipment_items = []
        
        if needs_pump:
            # Сколько дней нужен насос?
            pump_capacity_m3_per_hour = 30
            hours_needed = volume_m3 / pump_capacity_m3_per_hour
            days_needed = max(1, round(hours_needed / 8))  # 8 часовая смена
            
            equipment_items.append({
                "name": "Čerpadlo betonu",
                "model": "Schwing S36X",
                "days": days_needed,
                "rate_per_day": 8500,
                "total": days_needed * 8500
            })
        
        # Миксеры
        mixer_capacity = 7  # m³
        total_trips = round(volume_m3 / mixer_capacity)
        
        equipment_items.append({
            "name": "Míchačky (doprava)",
            "capacity_m3": mixer_capacity,
            "trips": total_trips,
            "note": "Included in concrete price"
        })
        
        subtotal = sum(item.get("total", 0) for item in equipment_items)
        
        return {
            "items": equipment_items,
            "subtotal": subtotal
        }
    
    def _estimate_transport_cost(self, volume_m3: float, distance_km: int) -> float:
        """
        Оценка стоимости транспортировки бетона
        
        Формула: базовая цена + доплата за км
        """
        base_cost = 5000  # Базовая стоимость доставки
        cost_per_km = 50  # За каждый км
        
        # Для больших объемов - скидки
        if volume_m3 > 100:
            base_cost *= 0.9
        
        return base_cost + (distance_km * cost_per_km)
    
    def _assess_confidence(self, breakdown: Dict, position: Dict) -> str:
        """
        Оцениваем уверенность в расчетах
        
        HIGH - есть benchmarks и цены
        MEDIUM - частично используем аналогии
        LOW - много предположений
        """
        
        # Проверяем есть ли источники
        has_benchmark = "source" in breakdown.get("labor", {})
        has_price = "source" in breakdown.get("materials", {}).get("items", [{}])[0]
        
        if has_benchmark and has_price:
            return "HIGH"
        elif has_benchmark or has_price:
            return "MEDIUM"
        else:
            return "LOW"
    
    # === АНАЛИТИКА ПО МАТЕРИАЛАМ ===
    
    def analyze_material(
        self, 
        material_name: str, 
        all_positions: List[Dict]
    ) -> Dict[str, Any]:
        """
        "Вытягивает" все позиции где используется конкретный материал
        
        Args:
            material_name: Например "Beton C20/25", "Арматура Ø12"
            all_positions: Все позиции проекта (уже с breakdown)
            
        Returns:
            {
                "summary": {
                    "total_quantity": 347,
                    "unit": "m³",
                    "total_cost": 850650,
                    "positions_count": 8
                },
                "breakdown": [список позиций где используется],
                "logistics": {...},
                "alternative_sources": [...]
            }
        """
        
        matching_positions = []
        total_quantity = 0
        total_cost = 0
        
        # Ищем во всех позициях
        for pos in all_positions:
            materials = pos.get("breakdown", {}).get("materials", {})
            
            for item in materials.get("items", []):
                if material_name.lower() in item.get("name", "").lower():
                    matching_positions.append({
                        "position_code": pos["code"],
                        "description": pos["description"],
                        "quantity": item["quantity"],
                        "unit": item["unit"],
                        "unit_price": item["unit_price"],
                        "total": item["total"],
                        "parameters": pos.get("parameters", {})
                    })
                    
                    total_quantity += item["quantity"]
                    total_cost += item["total"]
        
        # Логистика (для бетона - сколько миксеров нужно)
        logistics = None
        if "beton" in material_name.lower():
            logistics = self._calculate_concrete_logistics(total_quantity)
        
        # Альтернативные поставщики
        alternatives = self._find_alternative_suppliers(
            material_name, 
            total_quantity
        )
        
        return {
            "query": material_name,
            "summary": {
                "total_quantity": round(total_quantity, 2),
                "unit": matching_positions[0]["unit"] if matching_positions else "",
                "total_cost": total_cost,
                "average_price": round(total_cost / total_quantity, 2) if total_quantity > 0 else 0,
                "positions_count": len(matching_positions)
            },
            "breakdown": matching_positions,
            "logistics": logistics,
            "alternative_sources": alternatives
        }
    
    def _calculate_concrete_logistics(self, total_volume_m3: float) -> Dict:
        """
        Логистика доставки бетона
        - Сколько миксеров
        - Сколько рейсов
        - На сколько дней растянется
        """
        mixer_capacity = 7  # m³
        trips_per_day = 8  # Реалистично для одного миксера
        
        total_trips = round(total_volume_m3 / mixer_capacity)
        days_needed = round(total_trips / trips_per_day)
        
        return {
            "total_mixers_needed": max(1, round(total_trips / trips_per_day)),
            "mixer_capacity": mixer_capacity,
            "total_trips": total_trips,
            "delivery_schedule": f"{days_needed} рабочих дней"
        }
    
    def _find_alternative_suppliers(
        self, 
        material_name: str, 
        quantity: float
    ) -> List[Dict]:
        """
        Ищет альтернативных поставщиков с лучшими ценами
        
        В реальности - это запрос к базе поставщиков (B5)
        """
        
        # Заглушка - в реальности загружать из B5
        if "beton" in material_name.lower():
            return [
                {
                    "supplier": "Betonárna Praha Jih",
                    "distance_km": 18,
                    "price_per_m3": 2380,
                    "savings": round((2450 - 2380) * quantity)
                },
                {
                    "supplier": "Holcim Czechia",
                    "distance_km": 32,
                    "price_per_m3": 2420,
                    "savings": round((2450 - 2420) * quantity)
                }
            ]
        
        return []


# === ПРИМЕР ИСПОЛЬЗОВАНИЯ ===

async def example_usage():
    """Пример как используется в системе"""
    
    calculator = ResourceCalculator(
        knowledge_base_dir=Path("app/knowledge_base")
    )
    
    # Позиция из проекта
    position = {
        "code": "121-01-001",
        "description": "Beton základů C20/25",
        "quantity": 142,
        "unit": "m³"
    }
    
    # Контекст проекта
    project_context = {
        "concrete_grade": "C20/25",
        "distance_to_plant": 25,  # km
        "height_meters": 2
    }
    
    # 1. РАСЧЕТ РЕСУРСОВ для одной позиции
    breakdown = await calculator.calculate_resources(position, project_context)
    
    print("=== BREAKDOWN ДЛЯ ПОЗИЦИИ ===")
    print(f"Материалы: {breakdown['materials']['subtotal']} Kč")
    print(f"Труд: {breakdown['labor']['subtotal']} Kč")
    print(f"Механизмы: {breakdown['equipment']['subtotal']} Kč")
    print(f"ИТОГО: {breakdown['total_cost']} Kč")
    
    # 2. АНАЛИЗ ПО МАТЕРИАЛУ для всего проекта
    all_positions = [
        # ... список всех позиций проекта с breakdown
    ]
    
    analysis = calculator.analyze_material("Beton C20/25", all_positions)
    
    print("\n=== АНАЛИЗ МАТЕРИАЛА ===")
    print(f"Всего: {analysis['summary']['total_quantity']} m³")
    print(f"Стоимость: {analysis['summary']['total_cost']} Kč")
    print(f"Используется в {analysis['summary']['positions_count']} позициях")
