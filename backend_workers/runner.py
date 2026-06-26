"""
backend_workers/runner.py — ENGINEER 2 (sandbox execution)

Contract:
    async def run_all(solutions: list[Solution], tests: str, run: RunState) -> None

Runs each solution in an isolated Daytona sandbox in parallel via asyncio.gather,
updating run.solutions[id] live via shared.state.update_sandbox().
Sets run.winner to the id of the first solution that passes.

TODO(ENGINEER 2):
  1. Replace _mock_execute_solution with real Daytona calls:
       from daytona_sdk import Daytona, CreateWorkspaceParams
       client = Daytona()
       ws  = client.create(CreateWorkspaceParams(language="python"))
       out = client.process.code_run(ws.id, solution.code + "\n\n" + tests)
       client.remove(ws.id)
  2. Parse out.result / out.exit_code to detect PASS/FAIL and capture stdout.
  3. Set USE_MOCK=false in .env once DAYTONA_API_KEY is configured.
"""

from __future__ import annotations

import asyncio
import os
import random

from shared.state import RunState, Solution, update_sandbox
from backend_workers.cost import compute_cost, total_cost

USE_MOCK = os.getenv("USE_MOCK", "true").lower() == "true"


async def _mock_execute_solution(solution: Solution, tests: str, run_id: str) -> None:
    """Fake sandbox: sleep 1–3 s, return random PASS/FAIL (70 % pass rate)."""
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


async def _real_execute_solution(solution: Solution, tests: str, run_id: str) -> None:
    """Execute solution in a real Daytona workspace. TODO(ENGINEER 2)."""
    raise NotImplementedError("Set USE_MOCK=true or implement the Daytona integration")


async def run_all(solutions: list[Solution], tests: str, run: RunState) -> None:
    """
    Run all solutions in parallel sandboxes, update RunState in place.

    Args:
        solutions: list of Solution objects from llm.generate_solutions()
        tests:     raw Python test code to append to each solution
        run:       the RunState whose .solutions dict is updated live
    """
    execute = _mock_execute_solution if USE_MOCK else _real_execute_solution
    await asyncio.gather(*[execute(sol, tests, run.run_id) for sol in solutions])

    # Pick winner: first passed solution (insertion order)
    for sol in solutions:
        sb = run.solutions.get(sol.id)
        if sb and sb.status == "passed" and run.winner is None:
            run.winner = sol.id

    run.compute_cost = sum(sb.cost for sb in run.solutions.values())
    run.total_cost = total_cost(run)
