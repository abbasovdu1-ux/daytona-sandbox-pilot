"""
backend_api/routes.py — ENGINEER 1

FastAPI router. Owns HTTP concerns only — no execution logic lives here.

Endpoints:
    POST /run                — kick off a parallel run, returns run_id immediately
    GET  /status/{run_id}   — poll live RunState (frontend polls every 1s)
    POST /cleanup/{run_id}  — freeze meter and cancel pending/running sandboxes
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
# Defensive worker imports — a missing module must NOT crash startup.
# backend_workers may not be pushed yet when Engineer 1 is developing.
# ---------------------------------------------------------------------------

_WORKERS_AVAILABLE = False
try:
    from backend_workers.llm import generate_solutions as _worker_generate
    from backend_workers.runner import run_all as _worker_run_all
    from backend_workers.cost import llm_cost as _calc_llm_cost
    _WORKERS_AVAILABLE = True
except ImportError:
    _worker_generate = None   # type: ignore[assignment]
    _worker_run_all = None    # type: ignore[assignment]
    _calc_llm_cost = None     # type: ignore[assignment]

_global_mock: bool = os.getenv("USE_MOCK", "true").lower() == "true"
USE_MOCK_LLM: bool = os.getenv("USE_MOCK_LLM", str(_global_mock)).lower() == "true"
USE_MOCK_RUNNER: bool = os.getenv("USE_MOCK_RUNNER", str(_global_mock)).lower() == "true"

# ---------------------------------------------------------------------------
# Inline mock fallbacks
# Used when USE_MOCK=true OR backend_workers isn't importable yet.
# Both return the same (list[Solution], int) tuple as the real generate_solutions.
# ---------------------------------------------------------------------------

_MOCK_SNIPPETS = [
    "def is_palindrome(s):\n    return s == s[::-1]",
    "def is_palindrome(s):\n    return list(s) == list(reversed(s))",
    "def is_palindrome(s):\n    i,j=0,len(s)-1\n    while i<j:\n        if s[i]!=s[j]: return False\n        i+=1;j-=1\n    return True",
    "def is_palindrome(s):\n    return all(s[i]==s[~i] for i in range(len(s)//2))",
    "import re\ndef is_palindrome(s):\n    c=re.sub(r'[^a-zA-Z0-9]','',s).lower()\n    return c==c[::-1]",
]


async def _mock_generate(_task: str, n: int = 5) -> tuple[list[store.Solution], int]:
    solutions = [
        store.Solution(id=str(uuid.uuid4()), code=_MOCK_SNIPPETS[i % len(_MOCK_SNIPPETS)])
        for i in range(n)
    ]
    return solutions, 0   # 0 tokens — no LLM call in mock


async def _mock_run_all(
    solutions: list[store.Solution], _tests: str, run: store.RunState
) -> None:
    async def _resolve(sol: store.Solution) -> None:
        delay = random.uniform(0.8, 2.8)
        await asyncio.sleep(delay)
        passed = random.random() > 0.25
        store.update_sandbox(
            run.run_id, sol.id,
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


def _active_mock_llm() -> bool:
    return USE_MOCK_LLM or not _WORKERS_AVAILABLE


def _active_mock_runner() -> bool:
    return USE_MOCK_RUNNER or not _WORKERS_AVAILABLE


def _generate_fn():
    return _mock_generate if _active_mock_llm() else _worker_generate


def _run_all_fn():
    return _mock_run_all if _active_mock_runner() else _worker_run_all


# ---------------------------------------------------------------------------
# Task reference set — prevents asyncio.create_task targets being GC'd mid-run
# ---------------------------------------------------------------------------

_LIVE_TASKS: Set[asyncio.Task] = set()

# ---------------------------------------------------------------------------
# Default test harness
# TODO: accept test code from the request body or a test registry
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
    Start a parallel run and return immediately.

    Flow:
      1. create_run() → RunState
      2. generate_solutions() → (solutions, tokens)
      3. Pre-populate run.solutions with pending SandboxState per solution
         so /status returns a full grid on the very first poll.
      4. Set run.llm_cost from the token count.
      5. Fire-and-forget run_all via asyncio.create_task (never awaited here).
      6. Return run_id + mock flag.
    """
    using_mock = _active_mock_llm() or _active_mock_runner()

    run = store.create_run(body.task)
    solutions, tokens = await _generate_fn()(body.task, body.n)
    tests = body.tests or _DEFAULT_TESTS

    # Pre-populate before the task fires → frontend sees full grid immediately
    for sol in solutions:
        run.solutions[sol.id] = store.SandboxState(status="pending")

    # Wire LLM cost from real token count (0 in mock mode)
    if not _active_mock_llm() and _calc_llm_cost is not None:
        run.llm_cost = _calc_llm_cost(tokens)

    # Fire-and-forget — HTTP response returns before any sandbox starts
    task = asyncio.create_task(_run_all_fn()(solutions, tests, run))
    _LIVE_TASKS.add(task)
    task.add_done_callback(_LIVE_TASKS.discard)

    return RunResponse(run_id=run.run_id, mock=using_mock)


@router.get("/status/{run_id}")
async def get_status(run_id: str):
    """
    Return live RunState as JSON. Polled by the frontend every 1 s.
    dataclasses.asdict gives a stable flat shape — do not change field names
    without coordinating with the frontend team.
    """
    run = store.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="run not found")
    return dataclasses.asdict(run)


@router.post("/cleanup/{run_id}")
async def cleanup_run(run_id: str):
    """
    Cancel pending/running sandboxes and freeze the cost meter.

    TODO(coordinate with backend_workers): once backend_workers exposes a
    teardown hook (e.g. runner.cancel(run_id)), call it here to abort
    in-flight Daytona sandboxes before marking them failed.
    """
    run = store.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="run not found")

    for sol_id, sb in run.solutions.items():
        if sb.status in ("pending", "running"):
            store.update_sandbox(run_id, sol_id, status="failed", output="Cancelled by cleanup.")

    run.compute_cost = round(sum(sb.cost for sb in run.solutions.values()), 6)
    run.total_cost = round(run.llm_cost + run.compute_cost, 6)

    return dataclasses.asdict(run)
