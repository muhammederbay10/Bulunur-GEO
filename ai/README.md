# Bulunur AI/GEO Service

This folder contains the AI side of Bulunur. It owns the GEO analysis engine, GEO optimization agent, Schema.org Product JSON-LD logic, Gemini integration, and the FastAPI service used by the web app.

The AI service is intentionally separate from the web app so it can evolve as an independent backend service.

## What This Service Does

- Scores products with the four-layer GEO algorithm.
- Runs the GEO Analysis Agent.
- Runs the GEO Optimization Agent.
- Selects improvement strategies with LangGraph.
- Calls Gemini for semantic judgment and Turkish buyer-intent reasoning.
- Builds and validates Schema.org Product JSON-LD.
- Generates safe FAQ, suggested attributes, and optimization output.
- Exposes HTTP endpoints for the web application.

## Stack

- Python 3.11+
- FastAPI
- LangChain
- LangGraph
- Google Gemini
- Pydantic
- Uvicorn

## Environment Variables

Create `ai/.env` and add:

```env
GOOGLE_API_KEY=your_gemini_api_key
SERVICE_AUTH_SECRET_KEY=your_internal_service_secret
AI_CORS_ALLOW_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

`SERVICE_AUTH_SECRET_KEY` must match the secret used by the web service when it calls the AI API.

## Install Dependencies

From the repository root:

```bash
ai/.venv/Scripts/python.exe -m pip install -e ai[dev]
```

On macOS/Linux, use:

```bash
python -m pip install -e ai[dev]
```

## Run With Uvicorn

From the repository root:

```bash
ai/.venv/Scripts/python.exe -m uvicorn ai.main:app --host 127.0.0.1 --port 8001 --reload
```

On macOS/Linux, use:

```bash
python -m uvicorn ai.main:app --host 127.0.0.1 --port 8001 --reload
```

The service will be available at:

```text
http://127.0.0.1:8001
```

Health check:

```text
http://127.0.0.1:8001/health
```

Interactive API docs:

```text
http://127.0.0.1:8001/docs
```

## API Endpoints

Protected endpoints require the internal service auth header:

```http
Authorization: Bearer your_internal_service_secret
```

Available endpoints:

```text
GET  /health
POST /ai/analyze-product
POST /ai/improve-product
```

## Run Tests

From the repository root:

```bash
ai/.venv/Scripts/python.exe -m pytest ai/tests -q
```

## Run With Docker Compose

From the repository root:

```bash
docker compose up --build ai
```

The AI service will run on:

```text
http://localhost:8001
```

## Folder Guide

```text
ai/
├── agents/          # LangGraph analysis and optimization agents
├── api/             # FastAPI routers, dependencies, and service wiring
├── api_contracts/   # Pydantic request/response contracts
├── geo_engine/      # Scoring engine, strategies, validation, estimation
├── llm/             # Gemini client, skill loader, structured output parsing
├── schema_engine/   # Schema.org Product extraction/build/validation
├── skills/          # Turkish markdown skill files used by Gemini
├── turkish_nlp/     # Turkish normalization and buyer-intent helpers
├── examples/        # Local product examples
├── scripts/         # CLI scripts for analyze/improve flows
└── tests/           # Unit and integration tests
```
