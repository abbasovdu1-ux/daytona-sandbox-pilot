"""
backend_workers/cost.py — ENGINEER 2 (cost math)

Contract:
    compute_cost(seconds: float) -> float   # sandbox wall-clock -> USD
    llm_cost(tokens: int) -> float          # token count -> USD
    total_cost(run: RunState) -> float      # full run total

TODO(ENGINEER 2):
  1. Confirm COST_PER_SEC against the Daytona pricing page.
  2. Update LLM_COST_PER_1K_TOKENS to match the model chosen for llm.py.
  3. Optionally expose a per-solution cost breakdown (extend RunState if needed,
     but discuss with Engineer 1 first since RunState lives in shared/state.py).
"""

from __future__ import annotations

from shared.state import RunState

COST_PER_SEC: float = 0.067 / 3600         # Daytona: $0.067 / CPU-hour
LLM_COST_PER_1K_TOKENS: float = 0.005      # GPT-4o blended input+output


def compute_cost(seconds: float) -> float:
    """Return USD cost for `seconds` of sandbox wall-clock time."""
    return round(seconds * COST_PER_SEC, 6)


def llm_cost(tokens: int) -> float:
    """Return USD cost for `tokens` total tokens (input + output)."""
    return round((tokens / 1000) * LLM_COST_PER_1K_TOKENS, 6)


def total_cost(run: RunState) -> float:
    """Sum llm_cost + compute_cost for a completed RunState."""
    return round(run.llm_cost + run.compute_cost, 6)
