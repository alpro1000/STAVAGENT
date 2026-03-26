FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Layer 1: Heavy deps (cached unless requirements change)
COPY concrete-agent/packages/core-backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Layer 2: Application code (changes frequently)
COPY concrete-agent/packages/core-backend/ .

EXPOSE 8000
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
