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
# `--proxy-headers` + `--forwarded-allow-ips=*` honour Cloud Run's
# `X-Forwarded-Proto: https` so uvicorn rewrites `scope["scheme"]`
# before route dispatch. Without it, FastAPI's auto-redirect from /mcp
# to /mcp/ generates a `Location: http://…` header that Claude.ai
# rejects as a mixed-content redirect. The same fix is applied in
# `app/main.py` via `ProxyHeadersMiddleware` so it survives any future
# launcher change; the duplication here is harmless (idempotent) and
# keeps prod behaviour correct even if the middleware import ever
# fails at import time.
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--timeout-keep-alive", "120", "--proxy-headers", "--forwarded-allow-ips=*"]
