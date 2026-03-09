"""
Vertex AI Embeddings для RAG
Использует Free Trial $300 (не GenAI кредит)
"""

import os
from typing import List
from vertexai.language_models import TextEmbeddingModel
import vertexai

class VertexEmbeddings:
    """
    Vertex AI Embeddings для семантического поиска.
    Использует Free Trial $300.
    
    Модель: textembedding-gecko@003 (768 dimensions)
    Бесплатно: в пределах квот Free Tier
    """
    
    def __init__(self):
        project_id = os.getenv("GOOGLE_PROJECT_ID")
        location = "us-central1"
        
        vertexai.init(project=project_id, location=location)
        self.model = TextEmbeddingModel.from_pretrained("textembedding-gecko@003")
    
    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """
        Получить embeddings для текстов.
        
        Args:
            texts: Список текстов (до 250 за раз)
        
        Returns:
            Список векторов (768 dimensions каждый)
        """
        
        # Batch до 250 текстов
        embeddings = self.model.get_embeddings(texts)
        return [emb.values for emb in embeddings]
    
    async def embed_query(self, query: str) -> List[float]:
        """
        Embedding для поискового запроса.
        """
        embeddings = await self.embed_texts([query])
        return embeddings[0]


# Singleton
_vertex_embeddings: VertexEmbeddings = None

def get_vertex_embeddings() -> VertexEmbeddings:
    """Get or create Vertex Embeddings client"""
    global _vertex_embeddings
    if _vertex_embeddings is None:
        _vertex_embeddings = VertexEmbeddings()
    return _vertex_embeddings
