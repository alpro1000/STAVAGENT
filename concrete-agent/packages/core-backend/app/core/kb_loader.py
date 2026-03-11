"""
Knowledge Base Loader
Автоматически загружает ВСЕ файлы из папок B1-B8
БЕЗ необходимости менять код при добавлении новых файлов
"""

import csv
import json
import logging
import re
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional
import xml.etree.ElementTree as ET

import pandas as pd

logger = logging.getLogger(__name__)


class KnowledgeBaseLoader:
    """
    Умный загрузчик базы знаний
    
    Автоматически:
    - Сканирует все папки B1-B8
    - Определяет формат файлов (JSON, CSV, XLSX, PDF)
    - Загружает данные в память
    - Индексирует для быстрого поиска
    """
    
    # Категории базы знаний (фиксированные)
    CATEGORIES = [
        "B1_otkskp_codes",
        "B1_rts_codes",
        "B1_urs_codes",
        "B2_csn_standards",
        "B3_current_prices",
        "B4_production_benchmarks",
        "B5_tech_cards",
        "B6_research_papers",
        "B7_regulations",
        "B8_company_specific",
        "B9_Equipment_Specs"
    ]
    
    def __init__(self, kb_dir: Path):
        """
        Args:
            kb_dir: Путь к app/knowledge_base/
        """
        self.kb_dir = kb_dir
        self.data = {}
        self.metadata = {}
        self.loaded_at = None
        self._kros_index: Dict[str, Dict[str, Any]] | None = None
        self._csn_index: Dict[str, List[Dict[str, str]]] | None = None
        self._code_bridge: Dict[str, List[str]] | None = None
        self.kb_b1: Dict[str, Dict[str, Dict[str, Any]]] = {
            "otskp": {},
            "rts": {},
            "urs": {},
        }
        
    def load_all(self) -> Dict[str, Any]:
        """
        Главный метод: загружает ВСЮ базу знаний
        
        Returns:
            {
                "B1_otkskp_codes": {...},
                "B1_rts_codes": {...},
                "B1_urs_codes": {...},
                "B2_csn_standards": {...},
                ...
            }
        """
        logger.info("🔄 Loading Knowledge Base...")
        start_time = datetime.now()
        
        for category in self.CATEGORIES:
            try:
                logger.info(f"📂 Processing category: {category}")
                category_path = self.kb_dir / category

                if not category_path.exists():
                    logger.warning(f"⚠️  Category not found: {category}")
                    continue

                # Загружаем категорию
                self.data[category] = self._load_category(category_path)

                # Загружаем metadata
                metadata_path = category_path / "metadata.json"
                if metadata_path.exists():
                    with open(metadata_path, "r", encoding="utf-8") as f:
                        self.metadata[category] = json.load(f)

                logger.info(f"✅ Loaded: {category}")
            except Exception as e:
                logger.error(f"❌ Failed to load category {category}: {e}", exc_info=True)
                # Continue loading other categories
                continue
        
        self.loaded_at = datetime.now()
        elapsed = (self.loaded_at - start_time).total_seconds()
        
        logger.info(f"✨ Knowledge Base loaded in {elapsed:.2f}s")
        
        try:
            self._print_summary()
        except Exception as e:
            logger.error(f"⚠️  Failed to print KB summary: {e}")
        
        return self.data
    
    def _load_category(self, path: Path) -> Dict[str, Any]:
        """
        Загружает все файлы из одной категории
        
        Поддерживает:
        - JSON
        - CSV
        - XLSX
        - PDF (текст извлекается)
        """
        data = {}
        
        # Рекурсивно ищем все файлы
        files = list(path.rglob("*"))
        logger.debug(f"Found {len(files)} files in {path.name}")
        
        for file_path in files:
            if not file_path.is_file():
                continue

            # Пропускаем metadata.json (загружается отдельно)
            if file_path.name == "metadata.json" or file_path.name == ".gitkeep":
                continue
            
            try:
                logger.debug(f"Loading file: {file_path.name}")
                
                # Определяем формат и загружаем
                file_data = self._load_file(file_path)
                
                # Сохраняем с относительным путем как ключом
                relative_path = str(file_path.relative_to(path))
                data[relative_path] = file_data
                
            except Exception as e:
                logger.error(f"❌ Failed to load {file_path.name}: {e}")
                # Continue loading other files
                continue
        
        return data
    
    def _load_file(self, file_path: Path) -> Any:
        """
        Умная загрузка файла - определяет формат автоматически
        """
        suffix = file_path.suffix.lower()
        
        if suffix == ".json":
            return self._load_json(file_path)
        
        elif suffix == ".csv":
            return self._load_csv(file_path)
        
        elif suffix in [".xlsx", ".xls"]:
            return self._load_excel(file_path)

        elif suffix == ".pdf":
            return self._load_pdf(file_path)

        elif suffix in [".txt", ".md"]:
            return self._load_text(file_path)

        elif suffix == ".xml":
            return self._load_xml(file_path)

        else:
            logger.warning(f"⚠️  Unsupported format: {file_path}")
            return None
    
    def _load_json(self, path: Path) -> Dict:
        """Загрузка JSON"""
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def _load_csv(self, path: Path) -> List[Dict]:
        """
        Загрузка CSV как список словарей
        
        Пример KROS экспорта:
        code,name,unit,base_price
        121-01-001,"Beton C20/25",m³,2450
        
        Возвращает:
        [
            {"code": "121-01-001", "name": "Beton C20/25", ...},
            ...
        ]
        """
        data = []
        with open(path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Убираем лишние пробелы из ключей
                cleaned_row = {k.strip(): v for k, v in row.items()}
                data.append(cleaned_row)
        return data
    
    def _load_excel(self, path: Path) -> Dict[str, Any]:
        """
        Загрузка Excel (может содержать несколько листов)
        
        Возвращает:
        {
            "Sheet1": [...],
            "Sheet2": [...],
            ...
        }
        """
        excel_file = pd.ExcelFile(path)
        data = {}
        
        for sheet_name in excel_file.sheet_names:
            df = pd.read_excel(path, sheet_name=sheet_name)
            # Конвертируем в список словарей
            data[sheet_name] = df.to_dict('records')
        
        return data
    
    def _load_pdf(self, path: Path) -> Dict[str, Any]:
        """
        Загрузка PDF - извлекает текст
        
        Для ČSN стандартов, технологических карт и т.д.
        """
        try:
            # Используем PyPDF2 или pdfplumber
            import pdfplumber
            
            # Skip if file is too large (>50MB) to prevent memory issues
            file_size_mb = path.stat().st_size / (1024 * 1024)
            if file_size_mb > 50:
                logger.warning(f"⚠️  Skipping large PDF ({file_size_mb:.1f}MB): {path.name}")
                return {
                    "filename": path.name,
                    "text": None,
                    "path": str(path),
                    "note": f"Skipped (file too large: {file_size_mb:.1f}MB)"
                }
            
            text = ""
            page_count = 0
            
            with pdfplumber.open(path) as pdf:
                page_count = len(pdf.pages)
                # Limit to first 50 pages to prevent hanging
                max_pages = min(50, page_count)
                
                for i, page in enumerate(pdf.pages[:max_pages]):
                    try:
                        page_text = page.extract_text()
                        if page_text:
                            text += page_text
                    except Exception as e:
                        logger.debug(f"Failed to extract page {i+1} from {path.name}: {e}")
                        continue
                
                if page_count > max_pages:
                    text += f"\n\n[... truncated {page_count - max_pages} pages ...]\n"
            
            return {
                "filename": path.name,
                "pages": page_count,
                "text": text,
                "path": str(path)
            }
        
        except ImportError:
            logger.warning("⚠️  pdfplumber not installed, skipping PDF")
            return {
                "filename": path.name,
                "text": None,
                "path": str(path),
                "note": "Install pdfplumber to extract text"
            }
        except Exception as e:
            logger.error(f"❌ Failed to parse PDF {path.name}: {e}")
            return {
                "filename": path.name,
                "text": None,
                "path": str(path),
                "note": f"PDF parsing failed: {str(e)}"
            }
    
    def _load_text(self, path: Path) -> str:
        """Загрузка текстовых файлов"""
        with open(path, 'r', encoding='utf-8') as f:
            return f.read()

    def _load_xml(self, path: Path) -> Any:
        """Load XML files. For OTSKP data convert to list of dicts."""

        try:
            tree = ET.parse(path)
        except ET.ParseError as exc:  # noqa: BLE001
            logger.error("❌ Failed to parse XML %s: %s", path, exc)
            return None

        root = tree.getroot()
        catalog_key = self._detect_b1_catalog(path)
        items: List[Dict[str, Any]] = []

        if catalog_key == "otskp":

            try:
                from app.parsers.kros_parser import KROSParser

                parser = KROSParser()
                explicit_items = parser._parse_xc4_price_lists(root, register_runtime=False)
                if explicit_items:
                    self._register_b1_items(explicit_items, path, catalog_key)
                    return explicit_items
            except Exception as exc:  # pragma: no cover - defensive
                logger.debug("Explicit XC4 parsing failed for %s: %s", path, exc)

            for item in root.findall(".//Polozka"):
                record = {
                    "code": (item.findtext("Znak") or item.findtext("znak") or item.findtext("znacka") or "").strip(),
                    "name": (item.findtext("Nazev") or item.findtext("nazev") or item.findtext("name") or "").strip(),
                    "description": (item.findtext("Popis") or item.findtext("description") or "").strip(),
                    "unit": (item.findtext("Mj") or item.findtext("MJ") or item.findtext("MJ") or "").strip(),
                    "section": (item.findtext("Skupina") or item.findtext("skupina") or "").strip(),
                    "tech_spec": (item.findtext("technicka_specifikace") or "").strip(),
                }
                if any(record.values()):
                    items.append(record)

            if items:
                self._register_b1_items(items, path, catalog_key)
                return items

            try:
                from app.parsers.kros_parser import KROSParser

                parser = KROSParser()
                payload = parser.parse(path)
                parsed_positions = payload.get("positions", [])
                extracted: List[Dict[str, Any]] = []
                for pos in parsed_positions:
                    if not isinstance(pos, dict):
                        continue
                    extracted.append(
                        {
                            "code": str(pos.get("code") or pos.get("Kod") or "").strip(),
                            "name": pos.get("name") or pos.get("description") or pos.get("Popis") or "",
                            "description": pos.get("description") or pos.get("Popis") or "",
                            "unit": pos.get("unit") or pos.get("MJ") or "",
                            "section": pos.get("section") or "",
                            "tech_spec": pos.get("tech_spec") or pos.get("technicka_specifikace") or "",
                            "system": pos.get("system") or "",
                        }
                    )
                if extracted:
                    self._register_b1_items(extracted, path, catalog_key)
                    return extracted
            except Exception as exc:  # pragma: no cover - defensive
                logger.debug("Fallback KROS parsing failed for %s: %s", path, exc)

        # OTSKP XML structure (Polozky/Polozka)
        items = []
        for item in root.findall(".//Polozka"):
            record = {
                "code": (item.findtext("znacka") or "").strip(),
                "name": (item.findtext("nazev") or "").strip(),
                "unit": (item.findtext("MJ") or "").strip(),
                "unit_price": (item.findtext("jedn_cena") or "").strip(),
                "technical_specification": (item.findtext("technicka_specifikace") or "").strip(),
            }
            if any(record.values()):
                items.append(record)

        if items and catalog_key == "otskp":
            self._register_b1_items(items, path, catalog_key)

        if catalog_key in {"rts", "urs"}:
            extracted: List[Dict[str, Any]] = []
            for item in root.findall(".//Polozka"):
                record = {
                    "code": (item.findtext("Znak") or item.findtext("znacka") or item.findtext("code") or "").strip(),
                    "name": (item.findtext("Nazev") or item.findtext("name") or "").strip(),
                    "description": (item.findtext("Popis") or item.findtext("description") or "").strip(),
                    "unit": (item.findtext("Mj") or item.findtext("MJ") or "").strip(),
                }
                if any(record.values()):
                    extracted.append(record)
            if extracted:
                self._register_b1_items(extracted, path, catalog_key)
            return extracted if extracted else {"xml": path.read_text(encoding="utf-8")}

        return items if items else {"xml": path.read_text(encoding="utf-8")}

    def _print_summary(self):
        """Выводит статистику загруженной KB"""
        logger.info("\n" + "="*60)
        logger.info("📊 Knowledge Base Summary")
        logger.info("="*60)
        
        for category in self.CATEGORIES:
            if category in self.data:
                files_count = len(self.data[category])
                
                # Информация из metadata
                meta = self.metadata.get(category, {})
                last_updated = meta.get("last_updated", "Unknown")
                version = meta.get("version", "N/A")
                
                logger.info(
                    f"{category:30} | {files_count:3} files | "
                    f"v{version} | Updated: {last_updated}"
                )
        
        logger.info("="*60 + "\n")

    # ------------------------------------------------------------------
    # Internal helpers for KB B1 registration
    # ------------------------------------------------------------------

    @staticmethod
    def _detect_b1_catalog(path: Path) -> Optional[str]:
        if "B1_otkskp_codes" in path.parts:
            return "otskp"
        if "B1_rts_codes" in path.parts:
            return "rts"
        if "B1_urs_codes" in path.parts:
            return "urs"
        return None

    def _register_b1_items(
        self,
        items: Iterable[Dict[str, Any]],
        path: Path,
        catalog_key: str = "otskp",
    ) -> None:
        catalog = self.kb_b1.setdefault(catalog_key, {})
        source = path.name

        for item in items:
            if not isinstance(item, dict):
                continue
            raw_code = str(item.get("code") or item.get("znacka") or "").strip()
            if not raw_code:
                continue
            name = item.get("name") or item.get("description") or item.get("nazev") or ""
            unit = item.get("unit") or item.get("MJ") or ""
            tech_spec = (
                item.get("tech_spec")
                or item.get("technicka_specifikace")
                or item.get("technical_specification")
                or ""
            )
            system = (item.get("system") or item.get("typ_CS") or item.get("typ_cs") or "").strip()
            normalized = re.sub(r"[^A-Z0-9]", "", raw_code.upper())

            catalog[raw_code] = {
                "code": raw_code,
                "normalized": normalized,
                "name": name,
                "unit": unit,
                "tech_spec": tech_spec,
                "system": system or catalog_key.upper(),
                "source": source,
            }

            if normalized and normalized not in catalog:
                catalog[normalized] = catalog[raw_code]

            stripped = normalized.lstrip("0")
            if stripped and stripped not in catalog:
                catalog[stripped] = catalog[raw_code]
    
    # === МЕТОДЫ ПОИСКА (для использования в промптах) ===
    
    def get_kros_codes(self) -> List[Dict]:
        """Return OTSKP code records from the knowledge base."""

        records: List[Dict[str, Any]] = []
        seen_codes: set[str] = set()

        for payload in self.data.get("B1_otkskp_codes", {}).values():
            if not isinstance(payload, list):
                continue
            for item in payload:
                if not isinstance(item, dict):
                    continue
                code = str(
                    item.get("code")
                    or item.get("Znak")
                    or item.get("znak")
                    or item.get("znacka")
                    or ""
                ).strip().upper()
                if not code or code in seen_codes:
                    continue
                seen_codes.add(code)
                records.append(
                    {
                        "code": code,
                        "name": item.get("name")
                        or item.get("Nazev")
                        or item.get("description")
                        or "",
                        "description": item.get("description")
                        or item.get("name")
                        or item.get("Nazev")
                        or "",
                        "unit": item.get("unit")
                        or item.get("Mj")
                        or item.get("MJ")
                        or "",
                        "section": item.get("section")
                        or item.get("Skupina")
                        or "",
                        "tech_spec": item.get("tech_spec")
                        or item.get("technicka_specifikace")
                        or item.get("technical_specification")
                        or "",
                        "system": item.get("system")
                        or item.get("typ_CS")
                        or item.get("typ_cs")
                        or "",
                    }
                )

        for entry in self.kb_b1.get("otskp", {}).values():
            if not isinstance(entry, dict):
                continue
            code = entry.get("code")
            if not code or code in seen_codes:
                continue
            seen_codes.add(code)
            records.append(
                {
                    "code": code,
                    "name": entry.get("name") or "",
                    "description": entry.get("name") or entry.get("description") or "",
                    "unit": entry.get("unit") or "",
                    "section": "",
                    "tech_spec": entry.get("tech_spec") or "",
                    "system": entry.get("system") or "",
                }
            )

        return records

    def get_kros_index(self) -> Dict[str, Dict[str, Any]]:
        """Return dictionary mapping code → metadata."""

        if self._kros_index is not None:
            return self._kros_index

        index: Dict[str, Dict[str, Any]] = {}
        for entry in self.get_kros_codes():
            code = entry.get("code")
            if not code:
                continue
            index[code] = {
                "code": code,
                "name": entry.get("name") or entry.get("description") or "",
                "description": entry.get("description") or "",
                "unit": entry.get("unit") or "",
                "section": entry.get("section") or "",
                "tech_spec": entry.get("tech_spec") or "",
                "system": entry.get("system") or "",
            }

        self._kros_index = index
        return index

    def invalidate_kros_index(self) -> None:
        """Invalidate the cached KROS index to force rebuild on next access."""
        self._kros_index = None
        logger.debug("KROS index cache invalidated")

    def get_current_prices(self, material_type: str = None) -> Dict:
        """
        Быстрый доступ к актуальным ценам

        Args:
            material_type: Опционально фильтр (beton, armatura, ...)
        
        Returns:
            {"beton": {...}, "armatura": {...}, ...}
        """
        b3_data = self.data.get("B3_current_prices", {})
        
        # Ищем файл с ценами (обычно market_prices_*.json)
        for filename, data in b3_data.items():
            if "market_prices" in filename.lower():
                materials = data.get("materials", {})
                
                if material_type:
                    return materials.get(material_type, {})
                
                return materials
        
        return {}

    def get_csn_index(self) -> Dict[str, List[Dict[str, str]]]:
        """Return mapping of normalised ČSN references to evidence metadata."""

        if self._csn_index is not None:
            return self._csn_index

        index: Dict[str, List[Dict[str, str]]] = {}
        b2_data = self.data.get("B2_csn_standards", {})
        pattern = re.compile(r"ČSN\s*[0-9]{2}[\s\-]?[0-9]{2,3}(?:[\s\-]?[0-9]{1,3})?")

        for filename, payload in b2_data.items():
            if not isinstance(payload, dict):
                continue
            text = ""
            if isinstance(payload.get("text"), str):
                text = payload["text"]
            elif isinstance(payload.get("content"), str):
                text = payload["content"]
            if not text:
                continue

            seen: set[str] = set()
            for match in pattern.findall(text):
                token = self._normalise_csn(match)
                if not token or token in seen:
                    continue
                seen.add(token)
                excerpt = self._extract_excerpt(text, match, context=120)
                index.setdefault(token, []).append(
                    {
                        "source": f"kb:B2:{filename}",
                        "snippet": excerpt.strip(),
                    }
                )

        self._csn_index = index
        return index
    
    def get_productivity_rates(self, work_type: str = None) -> Dict:
        """
        Быстрый доступ к нормативам производительности
        
        Args:
            work_type: concrete_work, masonry_work, etc.
        
        Returns:
            {"concrete_work": {...}, ...}
        """
        b4_data = self.data.get("B4_production_benchmarks", {})
        
        for filename, data in b4_data.items():
            if "productivity_rates" in filename.lower():
                if work_type:
                    return data.get(work_type, {})
                return data
        
        return {}
    
    def search_standards(self, query: str) -> List[Dict]:
        """
        Поиск по ČSN стандартам
        
        Args:
            query: "beton", "zdivo", "geometry", etc.
        
        Returns:
            [
                {"filename": "CSN_EN_1992.pdf", "text": "...", ...},
                ...
            ]
        """
        b2_data = self.data.get("B2_csn_standards", {})
        results = []
        
        query_lower = query.lower()
        
        for filename, data in b2_data.items():
            if isinstance(data, dict) and "text" in data:
                # Поиск в тексте PDF
                if query_lower in data.get("text", "").lower():
                    results.append({
                        "filename": filename,
                        "excerpt": self._extract_excerpt(
                            data["text"], 
                            query_lower
                        ),
                        "path": data.get("path")
                    })
        
        return results
    
    def _extract_excerpt(self, text: str, query: str, context: int = 200) -> str:
        """Извлекает фрагмент текста вокруг найденного запроса"""
        index = text.lower().find(query.lower())
        if index == -1:
            return ""

        start = max(0, index - context)
        end = min(len(text), index + len(query) + context)

        excerpt = text[start:end]
        return f"...{excerpt}..."

    @staticmethod
    def _normalise_csn(value: str) -> str:
        if not value:
            return ""
        ascii_value = (
            value.upper()
            .replace("Č", "C")
            .replace("Š", "S")
            .replace("Ř", "R")
        )
        digits = re.sub(r"[^0-9]", "", ascii_value)
        if not digits:
            return ""
        return f"CSN{digits}"


# === ГЛОБАЛЬНЫЙ ЭКЗЕМПЛЯР ===

_kb_instance = None

def get_knowledge_base() -> KnowledgeBaseLoader:
    """
    Singleton: возвращает единственный экземпляр KB
    
    Загружается один раз при старте приложения
    """
    global _kb_instance
    
    if _kb_instance is None:
        from app.core.config import settings
        _kb_instance = KnowledgeBaseLoader(settings.KB_DIR)
        _kb_instance.load_all()
    
    return _kb_instance
kb_loader = None  # Будет инициализирован при первом вызове

def init_kb_loader() -> KnowledgeBaseLoader:
    """Инициализация kb_loader"""
    global kb_loader
    if kb_loader is None:
        kb_loader = get_knowledge_base()
    return kb_loader

# === ИСПОЛЬЗОВАНИЕ В КОДЕ ===

def example_usage() -> None:
    """Примеры как использовать в других сервисах"""
    
    # 1. Получить KB
    kb = get_knowledge_base()
    
    # 2. Получить коды KROS
    kros_codes = kb.get_kros_codes()
    print(f"Loaded {len(kros_codes)} KROS codes")
    
    # 3. Получить цены на бетон
    concrete_prices = kb.get_current_prices("beton")
    print(f"Beton C20/25: {concrete_prices.get('C20/25', {}).get('price_per_m3')} Kč")
    
    # 4. Получить производительность
    concrete_rates = kb.get_productivity_rates("concrete_work")
    print(f"Formwork rate: {concrete_rates.get('formwork', {}).get('simple', {})}")
    
    # 5. Поиск в стандартах
    standards = kb.search_standards("beton")
    print(f"Found {len(standards)} standards mentioning 'beton'")


if __name__ == "__main__":
    example_usage()

