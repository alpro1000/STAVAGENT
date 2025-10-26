"""
Nanonets Integration
Автоматическая обработка PDF/изображений через Nanonets API
"""

import requests
import logging
from pathlib import Path
from typing import Optional, Dict, Any
import json
import mimetypes

logger = logging.getLogger(__name__)


class NanonetsProcessor:
    """
    Обрабатывает файлы через Nanonets API
    
    Автоматически:
    - Определяет нужна ли обработка (скан vs searchable)
    - Отправляет в Nanonets
    - Извлекает текст/таблицы
    - Сохраняет результат
    """
    
    NANONETS_API_URL = "https://extraction-api.nanonets.com/extract"
    
    # Форматы которые НУЖНО обрабатывать
    PROCESSABLE_FORMATS = {
        '.pdf',      # PDF (любые - проверим searchable)
        '.png',      # Изображения
        '.jpg',
        '.jpeg',
        '.tiff',
        '.bmp'
    }
    
    # Форматы которые НЕ НУЖНО обрабатывать
    SKIP_FORMATS = {
        '.json',     # Уже структурированные
        '.csv',
        '.xlsx',
        '.xls',
        '.txt',
        '.md',
        '.docx'      # Word обрабатывается другими средствами
    }
    
    def __init__(self, api_key: str):
        """
        Args:
            api_key: Nanonets API key (из environment variables)
        """
        self.api_key = api_key
        self.headers = {
            "Authorization": f"Bearer {api_key}"
        }
    
    def should_process(self, file_path: Path) -> bool:
        """
        Определяет нужно ли обрабатывать файл через Nanonets
        
        Args:
            file_path: Путь к файлу
            
        Returns:
            True если нужна обработка, False если можно пропустить
        """
        ext = file_path.suffix.lower()
        
        # Точно пропускаем
        if ext in self.SKIP_FORMATS:
            logger.info(f"⏩ Skipping {file_path.name} - format doesn't need processing")
            return False
        
        # Точно обрабатываем
        if ext in self.PROCESSABLE_FORMATS:
            # Для PDF - проверим является ли он сканом
            if ext == '.pdf':
                is_scan = self._is_pdf_scan(file_path)
                if is_scan:
                    logger.info(f"📄 {file_path.name} is a scan - needs OCR")
                    return True
                else:
                    logger.info(f"✅ {file_path.name} is searchable - no OCR needed")
                    return False
            
            # Остальные (изображения) - всегда обрабатываем
            return True
        
        # Неизвестный формат - пропускаем
        logger.warning(f"⚠️ Unknown format: {ext} for {file_path.name}")
        return False
    
    def _is_pdf_scan(self, pdf_path: Path) -> bool:
        """
        Быстрая проверка: является ли PDF сканом
        
        Использует простую эвристику:
        - Пытаемся извлечь текст
        - Если текста мало/нет → скан
        """
        try:
            import pdfplumber
            
            with pdfplumber.open(pdf_path) as pdf:
                # Проверяем первые 3 страницы
                text_length = 0
                for i, page in enumerate(pdf.pages[:3]):
                    text = page.extract_text() or ""
                    text_length += len(text.strip())
                
                # Если меньше 100 символов на 3 страницы - скорее всего скан
                return text_length < 100
        
        except ImportError:
            logger.warning("pdfplumber not installed, assuming PDF is scan")
            return True
        except Exception as e:
            logger.error(f"Error checking PDF: {e}")
            return True  # На всякий случай обработаем
    
    def process_file(
        self, 
        file_path: Path,
        output_type: str = "markdown"
    ) -> Optional[Dict[str, Any]]:
        """
        Обрабатывает файл через Nanonets API
        
        Args:
            file_path: Путь к файлу
            output_type: markdown, json, или text
            
        Returns:
            {
                "content": "...",       # Извлеченный контент
                "format": "markdown",   # Формат
                "metadata": {...}       # Метаданные от Nanonets
            }
            Или None если обработка не удалась
        """
        
        if not self.should_process(file_path):
            return None
        
        logger.info(f"🤖 Processing {file_path.name} with Nanonets...")
        
        try:
            # Открываем файл
            with open(file_path, 'rb') as f:
                files = {"file": f}
                data = {"output_type": output_type}
                
                # Отправляем в Nanonets
                response = requests.post(
                    self.NANONETS_API_URL,
                    headers=self.headers,
                    files=files,
                    data=data,
                    timeout=300  # 5 минут на обработку
                )
            
            if response.status_code == 200:
                result = response.json()
                
                logger.info(f"✅ Successfully processed {file_path.name}")
                
                # Извлекаем контент
                content = self._extract_content(result, output_type)
                
                return {
                    "content": content,
                    "format": output_type,
                    "metadata": result.get("metadata", {}),
                    "original_file": file_path.name
                }
            
            else:
                logger.error(
                    f"❌ Nanonets API error for {file_path.name}: "
                    f"{response.status_code} - {response.text}"
                )
                return None
        
        except requests.exceptions.Timeout:
            logger.error(f"⏰ Timeout processing {file_path.name}")
            return None
        
        except Exception as e:
            logger.error(f"❌ Error processing {file_path.name}: {e}")
            return None
    
    def _extract_content(self, result: Dict, output_type: str) -> str:
        """Извлекает контент из ответа Nanonets"""
        
        if output_type == "markdown":
            return result.get("markdown", "")
        
        elif output_type == "json":
            return json.dumps(result.get("data", {}), indent=2, ensure_ascii=False)
        
        elif output_type == "text":
            return result.get("text", "")
        
        else:
            # Возвращаем всё как JSON
            return json.dumps(result, indent=2, ensure_ascii=False)
    
    def process_and_save(
        self,
        file_path: Path,
        output_dir: Optional[Path] = None
    ) -> Optional[Path]:
        """
        Обрабатывает файл и сохраняет результат рядом
        
        Args:
            file_path: Путь к оригинальному файлу
            output_dir: Куда сохранить (по умолчанию - рядом с оригиналом)
            
        Returns:
            Путь к обработанному файлу или None
            
        Example:
            input:  B2_csn_standards/CSN_EN_1992.pdf (скан)
            output: B2_csn_standards/CSN_EN_1992_processed.json
        """
        
        result = self.process_file(file_path, output_type="json")
        
        if not result:
            return None
        
        # Определяем имя выходного файла
        output_dir = output_dir or file_path.parent
        output_name = f"{file_path.stem}_processed.json"
        output_path = output_dir / output_name
        
        # Сохраняем
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(result["content"])
            
            logger.info(f"💾 Saved processed file: {output_path}")
            return output_path
        
        except Exception as e:
            logger.error(f"❌ Error saving processed file: {e}")
            return None
    
    def batch_process_directory(
        self,
        directory: Path,
        recursive: bool = True
    ) -> Dict[str, Any]:
        """
        Обрабатывает все файлы в директории
        
        Args:
            directory: Путь к папке
            recursive: Обрабатывать вложенные папки
            
        Returns:
            {
                "processed": 5,
                "skipped": 10,
                "failed": 1,
                "files": [...]
            }
        """
        
        logger.info(f"🔄 Batch processing directory: {directory}")
        
        stats = {
            "processed": 0,
            "skipped": 0,
            "failed": 0,
            "files": []
        }
        
        # Получаем список файлов
        if recursive:
            files = list(directory.rglob("*"))
        else:
            files = list(directory.glob("*"))
        
        files = [f for f in files if f.is_file()]
        
        logger.info(f"📊 Found {len(files)} files")
        
        for file_path in files:
            # Пропускаем уже обработанные
            if "_processed" in file_path.stem:
                continue
            
            # Пропускаем служебные
            if file_path.name in ["metadata.json", ".gitkeep"]:
                continue
            
            # Проверяем нужна ли обработка
            if not self.should_process(file_path):
                stats["skipped"] += 1
                continue
            
            # Обрабатываем
            output_path = self.process_and_save(file_path)
            
            if output_path:
                stats["processed"] += 1
                stats["files"].append({
                    "original": str(file_path),
                    "processed": str(output_path)
                })
            else:
                stats["failed"] += 1
        
        logger.info(
            f"✅ Batch processing complete: "
            f"{stats['processed']} processed, "
            f"{stats['skipped']} skipped, "
            f"{stats['failed']} failed"
        )
        
        return stats


# === ИСПОЛЬЗОВАНИЕ ===

def example_usage():
    """Примеры использования"""
    
    from app.core.config import settings
    
    # Создаем процессор
    processor = NanonetsProcessor(
        api_key=settings.NANONETS_API_KEY
    )
    
    # 1. Обработать один файл
    result = processor.process_file(
        Path("app/knowledge_base/B2_csn_standards/CSN_EN_1992.pdf")
    )
    
    if result:
        print("Extracted content:", result["content"][:500])
    
    # 2. Обработать и сохранить
    output_path = processor.process_and_save(
        Path("app/knowledge_base/B2_csn_standards/CSN_EN_1992.pdf")
    )
    
    if output_path:
        print(f"Saved to: {output_path}")
    
    # 3. Обработать всю папку
    stats = processor.batch_process_directory(
        Path("app/knowledge_base/B2_csn_standards"),
        recursive=True
    )
    
    print(f"Processed {stats['processed']} files")


if __name__ == "__main__":
    example_usage()
