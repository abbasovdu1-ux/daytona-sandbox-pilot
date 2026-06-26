"""
backend_api/main.py — ENGINEER 1

FastAPI application entry point.
Mounts the router and loads environment variables on startup.

Run from repo root:
    uvicorn backend_api.main:app --reload
"""

from dotenv import load_dotenv
from fastapi import FastAPI

from backend_api.routes import router

load_dotenv()

app = FastAPI(title="AgentOps API", version="0.1.0")
app.include_router(router)
