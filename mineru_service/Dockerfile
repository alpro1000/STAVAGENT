FROM python:3.11-slim

WORKDIR /app

# System deps for PaddleOCR (Debian Trixie: libgl1-mesa-glx → libgl1)
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0t64 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Heavy deps first (cached layer)
RUN pip install --no-cache-dir \
    "openai>=1.70.0,<3" \
    "mineru[all]>=2.7.0"

# FastAPI wrapper (small, after mineru)
RUN pip install --no-cache-dir fastapi uvicorn python-multipart

COPY main.py .

EXPOSE 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
