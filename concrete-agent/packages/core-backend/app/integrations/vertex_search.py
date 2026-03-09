"""
Vertex AI Search Integration
Использует GenAI кредит $1000 для семантического поиска по нормам ÚRS/OTSKP/ČSN
"""

import os
from typing import List, Optional
from dataclasses import dataclass
from google.cloud import discoveryengine_v1 as discoveryengine
from google.oauth2 import service_account

@dataclass
class NormMatch:
    """Результат поиска нормы"""
    norm_code: str
    title: str
    description: str
    unit: str
    unit_price_czk: float
    labor_hours: float
    confidence: float
    source: str  # "URS" | "OTSKP" | "CSN"

class VertexSearchClient:
    """
    Vertex AI Search для поиска норм.
    Использует GenAI кредит $1000 (только для этого сервиса).
    """
    
    def __init__(self):
        self.project_id = os.getenv("GOOGLE_PROJECT_ID", "project-947a512a-481d-49b5-81c")
        self.location = "global"
        self.datastore_id = os.getenv("VERTEX_SEARCH_DATASTORE_ID")
        
        # Credentials
        creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if creds_path and os.path.exists(creds_path):
            self.credentials = service_account.Credentials.from_service_account_file(creds_path)
        else:
            self.credentials = None
        
        self.client = discoveryengine.SearchServiceClient(credentials=self.credentials)
    
    async def search_norms(
        self,
        work_description: str,
        top_k: int = 5,
        source_filter: Optional[str] = None
    ) -> List[NormMatch]:
        """
        Семантический поиск норм по описанию работы.
        
        Args:
            work_description: Описание работы (например, "Бетонирование фундамента C25/30")
            top_k: Количество результатов
            source_filter: Фильтр по источнику ("URS" | "OTSKP" | "CSN")
        
        Returns:
            Список совпадающих норм с ценами и трудозатратами
        
        Example:
            matches = await client.search_norms("Бетонирование стен толщиной 300мм")
            for match in matches:
                print(f"{match.norm_code}: {match.title} - {match.unit_price_czk} Kč")
        """
        
        if not self.datastore_id:
            raise ValueError("VERTEX_SEARCH_DATASTORE_ID not configured")
        
        # Build serving config path
        serving_config = (
            f"projects/{self.project_id}/locations/{self.location}/"
            f"collections/default_collection/dataStores/{self.datastore_id}/"
            f"servingConfigs/default_config"
        )
        
        # Build request
        request = discoveryengine.SearchRequest(
            serving_config=serving_config,
            query=work_description,
            page_size=top_k,
            query_expansion_spec=discoveryengine.SearchRequest.QueryExpansionSpec(
                condition=discoveryengine.SearchRequest.QueryExpansionSpec.Condition.AUTO,
            ),
            spell_correction_spec=discoveryengine.SearchRequest.SpellCorrectionSpec(
                mode=discoveryengine.SearchRequest.SpellCorrectionSpec.Mode.AUTO
            ),
        )
        
        # Add filter if specified
        if source_filter:
            request.filter = f'source: ANY("{source_filter}")'
        
        # Execute search
        response = self.client.search(request)
        
        # Parse results
        matches = []
        for result in response.results:
            doc = result.document.derived_struct_data
            
            matches.append(NormMatch(
                norm_code=doc.get("code", ""),
                title=doc.get("title", ""),
                description=doc.get("description", ""),
                unit=doc.get("unit", ""),
                unit_price_czk=float(doc.get("unit_price", 0)),
                labor_hours=float(doc.get("labor_hours", 0)),
                confidence=float(result.relevance_score or 0),
                source=doc.get("source", "UNKNOWN"),
            ))
        
        return matches
    
    async def search_similar_positions(
        self,
        position_description: str,
        position_code: Optional[str] = None
    ) -> List[NormMatch]:
        """
        Найти похожие позиции для сопоставления.
        Используется в аудите для проверки цен.
        """
        
        query = position_description
        if position_code:
            query = f"{position_code} {position_description}"
        
        return await self.search_norms(query, top_k=3)


# Singleton instance
_vertex_client: Optional[VertexSearchClient] = None

def get_vertex_client() -> VertexSearchClient:
    """Get or create Vertex AI Search client"""
    global _vertex_client
    if _vertex_client is None:
        _vertex_client = VertexSearchClient()
    return _vertex_client
