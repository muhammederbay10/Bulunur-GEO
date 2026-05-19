FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8001

WORKDIR /app

RUN addgroup --system app \
    && adduser --system --ingroup app app

COPY . /app/ai

RUN python -m pip install --upgrade pip \
    && python -m pip install --no-cache-dir -e /app/ai

USER app

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\", \"8001\")}/health', timeout=5)"

CMD ["sh", "-c", "python -m uvicorn ai.main:app --host 0.0.0.0 --port ${PORT:-8001}"]
