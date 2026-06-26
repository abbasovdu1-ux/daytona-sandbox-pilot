"""
shared/state.py — Shared contracts and in-memory store.

NEITHER backend_api NOR backend_workers owns this file.
Both import from here. Any schema change must be agreed upon by both engineers.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Dict, Literal, Optional

# ---------------------------------------------------------------------------
# Data shapes (contracts)
# ---------------------------------------------------------------------------

@dataclass
class Solution:
    """A generated code candidate."""
    id: str
    code: str


SandboxStatus = Literal["pending", "running", "passed", "failed"]


@dataclass
class SandboxState:
    """Live state for one sandbox execution."""
    status: SandboxStatus = "pending"
    seconds: float = 0.0
    cost: float = 0.0
    output: str = ""


@dataclass
class RunState:
    """Top-level state for one /run request."""
    run_id: str
    task: str
    solutions: Dict[str, SandboxState] = field(default_factory=dict)
    llm_cost: float = 0.0
    compute_cost: float = 0.0
    total_cost: float = 0.0
    winner: Optional[str] = None  # solution id of the winner


# ---------------------------------------------------------------------------
# In-memory store
# ---------------------------------------------------------------------------

RUNS: Dict[str, RunState] = {}


def create_run(task: str) -> RunState:
    """Create a new RunState, register it, and return it."""
    run_id = str(uuid.uuid4())
    run = RunState(run_id=run_id, task=task)
    RUNS[run_id] = run
    return run


def get_run(run_id: str) -> Optional[RunState]:
    """Return a RunState by id, or None if not found."""
    return RUNS.get(run_id)


def update_sandbox(run_id: str, solution_id: str, **kwargs) -> None:
    """
    Patch fields on a SandboxState in place.
    Accepted kwargs: status, seconds, cost, output.
    """
    run = RUNS.get(run_id)
    if run is None:
        raise KeyError(f"run_id {run_id!r} not found")
    sandbox = run.solutions.get(solution_id)
    if sandbox is None:
        raise KeyError(f"solution_id {solution_id!r} not in run {run_id!r}")
    for k, v in kwargs.items():
        setattr(sandbox, k, v)
