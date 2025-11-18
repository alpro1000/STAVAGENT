"""
Knowledge Base Enrichment Service
Автоматическое обогащение базы знаний из Perplexity результатов
"""
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List
from app.core.config import settings

logger = logging.getLogger(__name__)


class KBEnrichmentService:
    """
    Сервис для автоматического обогащения Knowledge Base B1-B9

    Сохраняет результаты Perplexity поиска в соответствующие категории:
    - B1_urs_codes: KROS/ÚRS/RTS коды
    - B2_csn_standards: ČSN нормы
    - B3_current_prices: Цены на материалы
    - B4_production_benchmarks: Производственные нормативы
    - B5_tech_cards: Технологические карты
    """

    def __init__(self):
        """Initialize enrichment service"""
        self.kb_dir = settings.KB_DIR

        # Category mapping
        self.categories = {
            "csn_standards": self.kb_dir / "B2_csn_standards",
            "kros_codes": self.kb_dir / "B1_urs_codes",
            "rts_codes": self.kb_dir / "B1_rts_codes",
            "otskp_codes": self.kb_dir / "B1_otkskp_codes",
            "prices": self.kb_dir / "B3_current_prices",
            "benchmarks": self.kb_dir / "B4_production_benchmarks",
            "tech_cards": self.kb_dir / "B5_tech_cards",
        }

        # Ensure directories exist
        for category_path in self.categories.values():
            category_path.mkdir(parents=True, exist_ok=True)

    def classify_perplexity_result(
        self,
        query: str,
        result: Dict[str, Any]
    ) -> str:
        """
        Классифицировать результат Perplexity по категории KB

        Args:
            query: Исходный запрос пользователя
            result: Результат поиска Perplexity

        Returns:
            Категория: "csn_standards", "kros_codes", "prices", etc.
        """
        query_lower = query.lower()
        standards = result.get("standards", [])

        # 1. ČSN Standards (B2)
        if any(kw in query_lower for kw in ["čsn", "norma", "standard", "norm"]):
            # Check if actual standards were found
            if standards and any("čsn" in str(s.get("code", "")).lower() for s in standards):
                return "csn_standards"

        # 2. KROS/ÚRS codes (B1)
        if any(kw in query_lower for kw in ["kros", "úrs", "urs", "kód", "code"]):
            return "kros_codes"

        # 3. RTS codes (B1)
        if "rts" in query_lower:
            return "rts_codes"

        # 4. OTSKP codes (B1)
        if "otskp" in query_lower or "tskp" in query_lower:
            return "otskp_codes"

        # 5. Prices (B3)
        if any(kw in query_lower for kw in ["cena", "price", "цена", "kolik stojí", "how much"]):
            return "prices"

        # 6. Production benchmarks (B4)
        if any(kw in query_lower for kw in ["výkonnost", "productivity", "norm", "normativ"]):
            return "benchmarks"

        # 7. Tech cards (B5)
        if any(kw in query_lower for kw in ["postup", "jak", "how to", "technolog", "procedure"]):
            return "tech_cards"

        # Default: ČSN standards if standards found
        if standards:
            return "csn_standards"

        # Ultimate fallback
        return "csn_standards"

    def save_perplexity_result(
        self,
        query: str,
        result: Dict[str, Any],
        category: Optional[str] = None
    ) -> Optional[Path]:
        """
        Сохранить результат Perplexity в Knowledge Base

        Args:
            query: Исходный запрос
            result: Результат Perplexity
            category: Категория (auto-detect if None)

        Returns:
            Path к сохранённому файлу или None при ошибке
        """
        try:
            # Auto-classify if not specified
            if category is None:
                category = self.classify_perplexity_result(query, result)

            logger.info(f"💾 Saving Perplexity result to category: {category}")

            # Get category directory
            category_dir = self.categories.get(category)
            if not category_dir:
                logger.warning(f"Unknown category: {category}")
                return None

            # Generate filename
            filename = self._generate_filename(query, result, category)
            filepath = category_dir / filename

            # Build JSON structure
            kb_entry = {
                "source": "perplexity",
                "query": query,
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "category": category,
                "data": result,
                "standards": result.get("standards", []),
                "citations": result.get("sources", []),
                "raw_response": result.get("raw_response", "")
            }

            # Save to file
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(kb_entry, f, ensure_ascii=False, indent=2)

            logger.info(f"✅ Saved to KB: {filepath.relative_to(self.kb_dir)}")

            # Update metadata
            self._update_metadata(category, filename)

            return filepath

        except Exception as e:
            logger.error(f"Failed to save Perplexity result: {e}", exc_info=True)
            return None

    def _generate_filename(
        self,
        query: str,
        result: Dict[str, Any],
        category: str
    ) -> str:
        """
        Генерировать имя файла из запроса и результата

        Returns:
            Имя файла, например: "csn_en_206_beton_2025_01_30.json"
        """
        # Extract key info
        standards = result.get("standards", [])

        # Try to extract standard code
        if standards and category == "csn_standards":
            code = standards[0].get("code", "")
            if code:
                # ČSN EN 206 → csn_en_206
                safe_code = code.lower().replace(" ", "_").replace("/", "_").replace("+", "_")
                safe_code = "".join(c for c in safe_code if c.isalnum() or c == "_")
                timestamp = datetime.utcnow().strftime("%Y_%m_%d")
                return f"{safe_code}_{timestamp}.json"

        # Fallback: sanitize query
        safe_query = query[:50].lower()
        safe_query = "".join(c if c.isalnum() or c == "_" else "_" for c in safe_query)
        safe_query = "_".join(safe_query.split())  # Remove multiple underscores
        timestamp = datetime.utcnow().strftime("%Y_%m_%d_%H%M%S")

        return f"perplexity_{safe_query}_{timestamp}.json"

    def _update_metadata(self, category: str, filename: str) -> None:
        """
        Обновить metadata.json для категории

        Args:
            category: Категория KB
            filename: Добавленный файл
        """
        try:
            category_dir = self.categories.get(category)
            if not category_dir:
                return

            metadata_file = category_dir / "metadata.json"

            # Load existing metadata
            if metadata_file.exists():
                with open(metadata_file, 'r', encoding='utf-8') as f:
                    metadata = json.load(f)
            else:
                metadata = {
                    "category": category,
                    "last_updated": "",
                    "version": "1.0",
                    "source": "Mixed",
                    "description": "",
                    "files": [],
                    "notes": ""
                }

            # Update
            metadata["last_updated"] = datetime.utcnow().strftime("%Y-%m-%d")
            if filename not in metadata.get("files", []):
                metadata.setdefault("files", []).append(filename)

            # Add enrichment note
            enrichment_note = f"Enriched from Perplexity on {datetime.utcnow().strftime('%Y-%m-%d')}"
            if "perplexity" not in metadata.get("notes", "").lower():
                metadata["notes"] = metadata.get("notes", "") + f"\n{enrichment_note}"

            # Save
            with open(metadata_file, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)

            logger.debug(f"Updated metadata for {category}")

        except Exception as e:
            logger.warning(f"Failed to update metadata: {e}")

    def search_local_kb(
        self,
        query: str,
        category: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Поиск в локальной Knowledge Base перед запросом Perplexity

        Args:
            query: Поисковый запрос
            category: Категория для поиска (None = все категории)

        Returns:
            Найденные данные или None
        """
        try:
            query_lower = query.lower()

            # Determine categories to search
            if category:
                categories_to_search = [category]
            else:
                # Auto-detect likely category
                detected_category = self.classify_perplexity_result(query, {})
                categories_to_search = [detected_category]

            # Search in each category
            for cat in categories_to_search:
                category_dir = self.categories.get(cat)
                if not category_dir or not category_dir.exists():
                    continue

                # Search JSON files
                for json_file in category_dir.glob("*.json"):
                    if json_file.name == "metadata.json":
                        continue

                    try:
                        with open(json_file, 'r', encoding='utf-8') as f:
                            data = json.load(f)

                        # Check if query matches
                        if self._matches_query(data, query_lower):
                            logger.info(f"✅ Found in local KB: {json_file.relative_to(self.kb_dir)}")
                            return data
                    except Exception as e:
                        logger.warning(f"Failed to read {json_file}: {e}")
                        continue

            logger.debug(f"No local KB match for: {query[:50]}...")
            return None

        except Exception as e:
            logger.error(f"Local KB search error: {e}", exc_info=True)
            return None

    def _matches_query(self, data: Dict[str, Any], query_lower: str) -> bool:
        """
        Проверить соответствует ли KB entry запросу

        Args:
            data: KB entry data
            query_lower: Запрос (lowercase)

        Returns:
            True if matches
        """
        # Check original query
        original_query = data.get("query", "").lower()
        if original_query and query_lower in original_query:
            return True

        # Check standards codes
        standards = data.get("standards", [])
        for std in standards:
            code = std.get("code", "").lower()
            name = std.get("name", "").lower()
            if any(term in code or term in name for term in query_lower.split()):
                return True

        # Check raw response
        raw_response = data.get("raw_response", "").lower()
        if raw_response and len(query_lower) > 10:
            # Check if significant part of query is in response
            query_words = [w for w in query_lower.split() if len(w) > 3]
            matches = sum(1 for word in query_words if word in raw_response)
            if matches >= len(query_words) * 0.6:  # 60% word match
                return True

        return False


# Global singleton
kb_enrichment_service = KBEnrichmentService()


__all__ = ["KBEnrichmentService", "kb_enrichment_service"]
