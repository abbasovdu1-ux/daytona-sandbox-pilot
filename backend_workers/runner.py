"""
backend_workers/runner.py — ENGINEER 2 (sandbox execution)

Contract:
    async def run_all(solutions: list[Solution], tests: str, run: RunState) -> None

Runs every solution in its own ephemeral Daytona Python sandbox in parallel,
updating RunState live via update_sandbox(). Sets run.winner to the first
solution that passes all tests.

Each sandbox is isolated — one failure never aborts the others.

Real-mode SDK facts (daytona-sdk ≥ 0.19):
  - Import:  from daytona_sdk import Daytona, DaytonaConfig, CreateSandboxFromSnapshotParams
  - Create:  client.create(CreateSandboxFromSnapshotParams(language="python", ephemeral=True), timeout=120)
  - Run:     sandbox.process.code_run(code)  →  ExecuteResponse(.exit_code, .result, .artifacts)
  - Delete:  client.delete(sandbox)
  - SDK is synchronous → use asyncio.to_thread() for every blocking call
"""

from __future__ import annotations

import asyncio
import os
import random
import time

from shared.state import RunState, Solution, update_sandbox
from backend_workers.cost import compute_cost, total_cost

# USE_MOCK_RUNNER overrides USE_MOCK for the sandbox layer only.
# Set USE_MOCK_RUNNER=false + DAYTONA_API_KEY to run real sandboxes
# while keeping the LLM mocked (no OPENAI_API_KEY needed).
_global_mock = os.getenv("USE_MOCK", "true").lower() == "true"
USE_MOCK = os.getenv("USE_MOCK_RUNNER", str(_global_mock)).lower() == "true"


# ---------------------------------------------------------------------------
# Mock path
# ---------------------------------------------------------------------------

async def _mock_execute(solution: Solution, _tests: str, run_id: str) -> None:
    """Fake sandbox: 1–3 s sleep, 70 % pass rate."""
    update_sandbox(run_id, solution.id, status="running")
    duration = random.uniform(1.0, 3.0)
    await asyncio.sleep(duration)
    passed = random.random() > 0.3
    update_sandbox(
        run_id,
        solution.id,
        status="passed" if passed else "failed",
        seconds=round(duration, 2),
        cost=compute_cost(duration),
        output="All tests passed." if passed else "AssertionError: test_case_3 failed.",
    )


# ---------------------------------------------------------------------------
# Real path — Daytona SDK (synchronous, wrapped in asyncio.to_thread)
# ---------------------------------------------------------------------------

def _sync_execute(solution: Solution, tests: str, run_id: str) -> None:
    """
    Blocking Daytona execution — called via asyncio.to_thread so it doesn't
    block the event loop.
    """
    from daytona_sdk import Daytona, DaytonaConfig, CreateSandboxFromSnapshotParams

    update_sandbox(run_id, solution.id, status="running")
    start = time.perf_counter()
    sandbox = None

    config = DaytonaConfig(
        api_key=os.environ["DAYTONA_API_KEY"],
        api_url=os.getenv("DAYTONA_API_URL", "https://app.daytona.io/api"),
    )
    client = Daytona(config=config)

    try:
        sandbox = client.create(
            CreateSandboxFromSnapshotParams(
                language="python",
                ephemeral=True,
                auto_stop_interval=5,   # auto-stop after 5 min idle
            ),
            timeout=120,
        )

        full_code = f"{solution.code}\n\n{tests}"
        result = sandbox.process.code_run(full_code, timeout=60)

        duration = time.perf_counter() - start
        passed = (result.exit_code == 0)
        # .result holds combined stdout; fall back to artifacts.stdout
        output = result.result or (result.artifacts.stdout if result.artifacts else "") or ""

        update_sandbox(
            run_id,
            solution.id,
            status="passed" if passed else "failed",
            seconds=round(duration, 2),
            cost=compute_cost(duration),
            output=output,
        )

    except Exception as exc:
        duration = time.perf_counter() - start
        update_sandbox(
            run_id,
            solution.id,
            status="failed",
            seconds=round(duration, 2),
            cost=compute_cost(duration),
            output=f"[runner error] {exc}",
        )

    finally:
        if sandbox is not None:
            try:
                client.delete(sandbox)
            except Exception:
                pass


async def _real_execute(solution: Solution, tests: str, run_id: str) -> None:
    await asyncio.to_thread(_sync_execute, solution, tests, run_id)


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def run_all(solutions: list[Solution], tests: str, run: RunState) -> None:
    """
    Run all solutions in parallel isolated sandboxes, mutate RunState in place.

    Each solution gets its own try/except so a single failure never aborts
    the gather.
    """
    execute = _mock_execute if USE_MOCK else _real_execute

    async def _safe(sol: Solution) -> None:
        try:
            await execute(sol, tests, run.run_id)
        except Exception as exc:
            update_sandbox(run.run_id, sol.id, status="failed", output=f"[unhandled] {exc}")

    await asyncio.gather(*[_safe(s) for s in solutions])

    # Winner = first passing solution in submission order
    for sol in solutions:
        sb = run.solutions.get(sol.id)
        if sb and sb.status == "passed" and run.winner is None:
            run.winner = sol.id

    run.compute_cost = round(sum(sb.cost for sb in run.solutions.values()), 6)
    run.total_cost = total_cost(run)
