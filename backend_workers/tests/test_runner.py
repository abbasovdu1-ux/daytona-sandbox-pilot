"""Tests for runner.py — Engineer 2."""

import os
import pytest

os.environ.setdefault("USE_MOCK", "true")

from shared.state import RunState, Solution, SandboxState, create_run
from backend_workers.runner import run_all


def _make_run(n: int = 3):
    run = create_run("test task")
    solutions = [Solution(id=f"sol-{i}", code=f"# solution {i}") for i in range(n)]
    for sol in solutions:
        run.solutions[sol.id] = SandboxState()
    return run, solutions


@pytest.mark.asyncio
async def test_run_all_terminal_status():
    run, solutions = _make_run(3)
    await run_all(solutions, "# no tests", run)
    for sol in solutions:
        assert run.solutions[sol.id].status in ("passed", "failed")


@pytest.mark.asyncio
async def test_run_all_records_seconds():
    run, solutions = _make_run(2)
    await run_all(solutions, "# no tests", run)
    for sol in solutions:
        assert run.solutions[sol.id].seconds > 0


@pytest.mark.asyncio
async def test_run_all_compute_cost_positive():
    run, solutions = _make_run(2)
    await run_all(solutions, "# no tests", run)
    assert run.compute_cost > 0


@pytest.mark.asyncio
async def test_winner_passes():
    run, solutions = _make_run(5)
    await run_all(solutions, "# no tests", run)
    if run.winner:
        assert run.solutions[run.winner].status == "passed"
