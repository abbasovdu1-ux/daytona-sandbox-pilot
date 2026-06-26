"""
backend_api/routes.py — ENGINEER 1

Thin HTTP glue between FastAPI and the worker modules.

Endpoints:
    POST /run              — kick off a parallel run, returns run_id immediately
    GET  /status/{run_id}  — poll current RunState as JSON
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from shared import state as store
from backend_workers.llm import generate_solutions
from backend_workers.runner import run_all

router = APIRouter()

DEFAULT_TESTS = """
def run_tests():
    assert is_palindrome("racecar"), "racecar should be palindrome"
    assert is_palindrome("madam"),   "madam should be palindrome"
    assert not is_palindrome("hello"), "hello should NOT be palindrome"
    print("All tests passed.")

run_tests()
"""


class RunRequest(BaseModel):
    task: str
    n: int = 5
    tests: Optional[str] = None


class RunResponse(BaseModel):
    run_id: str


async def _execute_run(run: store.RunState, solutions, tests: str) -> None:
    """Background task: seed sandbox states then execute all solutions."""
    for sol in solutions:
        run.solutions[sol.id] = store.SandboxState()
    await run_all(solutions, tests, run)


@router.post("/run", response_model=RunResponse)
async def start_run(body: RunRequest, background_tasks: BackgroundTasks):
    """
    Start a parallel run.
    Generates solutions, seeds the state store, then launches execution
    as a background task so the client gets a run_id right away.
    """
    run = store.create_run(body.task)
    solutions = await generate_solutions(body.task, body.n)
    tests = body.tests or DEFAULT_TESTS
    background_tasks.add_task(_execute_run, run, solutions, tests)
    return RunResponse(run_id=run.run_id)


@router.get("/status/{run_id}")
async def get_status(run_id: str):
    """Return the current RunState serialised as JSON."""
    run = store.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="run not found")

    return {
        "run_id": run.run_id,
        "task": run.task,
        "winner": run.winner,
        "llm_cost": run.llm_cost,
        "compute_cost": run.compute_cost,
        "total_cost": run.total_cost,
        "solutions": {
            sid: {
                "status": sb.status,
                "seconds": sb.seconds,
                "cost": sb.cost,
                "output": sb.output,
            }
            for sid, sb in run.solutions.items()
        },
    }
