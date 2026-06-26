"""
backend_api/routes.py — ENGINEER 1

FastAPI router. Owns HTTP concerns only — no execution logic lives here.

Endpoints:
    POST /run                — kick off a parallel run, returns run_id immediately
    GET  /status/{run_id}   — poll live RunState (frontend polls every 1s)
    POST /cleanup/{run_id}  — freeze meter, signal sandbox teardown
"""

from __future__ import annotations

import asyncio
import dataclasses
import os
import random
import uuid
from typing import Optional, Set

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from shared import state as store

# ---------------------------------------------------------------------------
# Defensive worker imports
# An ImportError here must NOT crash the server — teammate may not have pushed yet.
# ---------------------------------------------------------------------------

_WORKERS_AVAILABLE = False

try:
    from backend_workers.llm import generate_solutions as _worker_generate
    from backend_workers.runner import run_all as _worker_run_all
    _WORKERS_AVAILABLE = True
except ImportError:
    _worker_generate = None  # type: ignore[assignment]
    _worker_run_all = None   # type: ignore[assignment]

USE_MOCK: bool = os.getenv("USE_MOCK", "true").lower() == "true"

# ---------------------------------------------------------------------------
# Inline mock fallbacks — active when USE_MOCK=true OR workers unavailable
# ---------------------------------------------------------------------------

_MOCK_SNIPPETS = [
    "def is_palindrome(s):\n    return s == s[::-1]",
    "def is_palindrome(s):\n    return list(s) == list(reversed(s))",
    "def is_palindrome(s):\n    i,j=0,len(s)-1\n    while i<j:\n        if s[i]!=s[j]: return False\n        i+=1;j-=1\n    return True",
    "def is_palindrome(s):\n    return all(s[i]==s[~i] for i in range(len(s)//2))",
    "import re\ndef is_palindrome(s):\n    c=re.sub(r'[^a-zA-Z0-9]','',s).lower()\n    return c==c[::-1]",
]


async def _mock_generate(_task: str, n: int = 5) -> list[store.Solution]:
    return [
        store.Solution(id=str(uuid.uuid4()), code=_MOCK_SNIPPETS[i % len(_MOCK_SNIPPETS)])
        for i in range(n)
    ]


async def _mock_run_all(
    solutions: list[store.Solution], _tests: str, run: store.RunState
) -> None:
    async def _resolve(sol: store.Solution) -> None:
        delay = random.uniform(0.8, 2.8)
        await asyncio.sleep(delay)
        passed = random.random() > 0.25
        store.update_sandbox(
            run.run_id,
            sol.id,
            status="passed" if passed else "failed",
            seconds=round(delay, 2),
            cost=round(delay * (0.067 / 3600), 6),
            output="All tests passed. [mock]" if passed else "AssertionError: test_3 failed. [mock]",
        )

    await asyncio.gather(*[_resolve(s) for s in solutions])

    for sol in solutions:
        if run.solutions[sol.id].status == "passed" and run.winner is None:
            run.winner = sol.id

    run.compute_cost = round(sum(sb.cost for sb in run.solutions.values()), 6)
    run.total_cost = round(run.llm_cost + run.compute_cost, 6)


def _generate_fn():
    """Return whichever generate function is active right now."""
    if USE_MOCK or not _WORKERS_AVAILABLE:
        return _mock_generate
    return _worker_generate


def _run_all_fn():
    """Return whichever run_all function is active right now."""
    if USE_MOCK or not _WORKERS_AVAILABLE:
        return _mock_run_all
    return _worker_run_all


# ---------------------------------------------------------------------------
# Task registry — holds references so asyncio.create_task targets aren't GC'd
# ---------------------------------------------------------------------------

_LIVE_TASKS: Set[asyncio.Task] = set()

# ---------------------------------------------------------------------------
# Hardcoded tests string
# TODO: wire a real test input from the request or a test registry
# ---------------------------------------------------------------------------

_DEFAULT_TESTS = """\
def run_tests():
    assert is_palindrome("racecar"), "racecar should be palindrome"
    assert is_palindrome("madam"),   "madam should be palindrome"
    assert not is_palindrome("hello"), "hello should NOT be palindrome"
    print("All tests passed.")

run_tests()
"""

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

router = APIRouter()


class RunRequest(BaseModel):
    task: str
    n: int = 5
    tests: Optional[str] = None


class RunResponse(BaseModel):
    run_id: str
    mock: bool


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/run", response_model=RunResponse)
async def start_run(body: RunRequest):
    """
    Kick off a parallel run.

    1. create_run → RunState + run_id
    2. generate_solutions → list[Solution]
    3. Pre-populate run.solutions with pending SandboxState for every id
       so /status returns the full grid on the very first poll.
    4. Fire-and-forget run_all via asyncio.create_task (NOT await —
       the HTTP response must return immediately).
    5. Return run_id + mock flag.
    """
    using_mock = USE_MOCK or not _WORKERS_AVAILABLE

    run = store.create_run(body.task)
    solutions = await _generate_fn()(body.task, body.n)
    tests = body.tests or _DEFAULT_TESTS

    # Pre-populate BEFORE the task fires — frontend sees 5 pending cards instantly
    for sol in solutions:
        run.solutions[sol.id] = store.SandboxState(status="pending")

    # Fire-and-forget: don't await, return immediately
    task = asyncio.create_task(_run_all_fn()(solutions, tests, run))
    _LIVE_TASKS.add(task)
    task.add_done_callback(_LIVE_TASKS.discard)  # auto-remove when done

    return RunResponse(run_id=run.run_id, mock=using_mock)


@router.get("/status/{run_id}")
async def get_status(run_id: str):
    """
    Return live RunState as JSON. Called by the frontend every 1 s.
    Uses dataclasses.asdict for a stable, flat shape the frontend can
    render cards from directly.
    """
    run = store.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="run not found")
    return dataclasses.asdict(run)


@router.post("/cleanup/{run_id}")
async def cleanup_run(run_id: str):
    """
    Freeze the cost meter and mark any still-running sandboxes as failed.

    TODO(coordinate with backend_workers): call sandbox.delete() here
    once backend_workers exposes a teardown interface, e.g.:
        await runner.teardown(run_id)
    """
    run = store.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="run not found")

    for sol_id, sb in run.solutions.items():
        if sb.status in ("pending", "running"):
            store.update_sandbox(run_id, sol_id, status="failed", output="Cancelled by cleanup.")

    # Recompute totals after forced termination
    run.compute_cost = round(sum(sb.cost for sb in run.solutions.values()), 6)
    run.total_cost = round(run.llm_cost + run.compute_cost, 6)

    return dataclasses.asdict(run)
