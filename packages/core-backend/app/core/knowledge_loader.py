# app/core/knowledge_loader.py
import os
import json
from typing import List, Dict, Any

KNOWLEDGE_PATH = "app/knowledge_base"

def load_knowledge() -> List[Dict[str, Any]]:
    """
    Загружает все JSON-файлы из базы знаний и возвращает список словарей.
    """
    knowledge_items: List[Dict[str, Any]] = []
    for root, _, files in os.walk(KNOWLEDGE_PATH):
        for f in files:
            if f.endswith(".json"):
                file_path = os.path.join(root, f)
                try:
                    with open(file_path, "r", encoding="utf-8") as fp:
                        data = json.load(fp)
                        knowledge_items.append(data)
                except (OSError, json.JSONDecodeError) as e:
                    print(f"⚠️ Ошибка загрузки {file_path}: {e}")
    print(f"📚 Загружено {len(knowledge_items)} документов из базы знаний")
    return knowledge_items
