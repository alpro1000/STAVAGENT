"""
САМЫЙ ПРОСТОЙ СЕРВИС - РАБОТАЕТ СРАЗУ!
Файл → Claude → Результат. Всё.
"""
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import anthropic
import os

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Claude API
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))

@app.get("/")
def home():
    return {"status": "работает!", "api_key": bool(os.getenv("ANTHROPIC_API_KEY"))}

@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    """Загрузить файл → получить анализ от Claude"""
    
    # 1. Прочитать файл
    content = await file.read()
    text = content.decode('utf-8', errors='ignore')[:10000]  # Первые 10К символов
    
    # 2. Отправить Claude
    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            messages=[{
                "role": "user",
                "content": f"Проанализируй этот строительный документ (výkaz výměr). Выдели позиции работ, объёмы, цены. Отметь проблемы.\n\nФайл: {file.filename}\n\n{text}"
            }]
        )
        
        return {
            "success": True,
            "file": file.filename,
            "analysis": response.content[0].text
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
