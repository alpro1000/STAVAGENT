FROM python:3.11-slim

# System deps:
#   libpq-dev + gcc     → psycopg2 wheel build
#   libgl1 libglu1-mesa → ifcopenshell native (PR3 §3.2)
#   libxml2 libxslt1.1  → lxml runtime
#   libredwg-tools      → DWG fallback `dwg2dxf` (PR3 §3.1 fallback B —
#                         tried after ODAFileConverter; without it the
#                         DwgExtractor escalates with DWG_CONVERSION_FAILED).
#                         The Debian package name is libredwg-tools; binary is
#                         /usr/bin/dwg2dxf (discovered via PATH).
#   ca-certificates +   → ODA File Converter download (PR3 §3.1 fallback A).
#   curl + unzip          ODA distributes Linux as a tarball/deb; the Cloud
#                         Build pipeline mounts the binary into the image
#                         under $UEP_DWG_ODA_BINARY (defaulting to
#                         "ODAFileConverter" on PATH). EULA acceptance is
#                         build-time, not runtime — STAVAGENT_ClaudeCode_
#                         Session_Mantra has the operator step list.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    libgl1 \
    libglu1-mesa \
    libxml2 \
    libxslt1.1 \
    libredwg-tools \
    ca-certificates \
    curl \
    unzip \
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
