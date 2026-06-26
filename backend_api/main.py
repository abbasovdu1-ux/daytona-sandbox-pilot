"""
backend_api/main.py — ENGINEER 1

FastAPI application entry point.

Run from repo root:
    uvicorn backend_api.main:app --reload
"""

import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend_api.routes import router

load_dotenv()

app = FastAPI(title="AgentOps API", version="0.1.0")

# Allow the frontend dev server (any origin in dev; tighten for production)
_cors_origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

app.include_router(router)
