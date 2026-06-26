"""
backend_api/main.py — ENGINEER 1

IMPORTANT: load_dotenv() must run before any worker imports so that
USE_MOCK_LLM / USE_MOCK_RUNNER / OPENAI_API_KEY are visible when
llm.py and runner.py set their module-level flags at import time.

Run from repo root:
    uvicorn backend_api.main:app --reload
"""

# ── dotenv FIRST — before any import that reads os.getenv() ──────────────
import os
from dotenv import load_dotenv
load_dotenv(override=True)  # .env always wins over shell-inherited vars
# ─────────────────────────────────────────────────────────────────────────

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend_api.routes import router

app = FastAPI(title="AgentOps API", version="0.1.0")

_cors_origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

app.include_router(router)
