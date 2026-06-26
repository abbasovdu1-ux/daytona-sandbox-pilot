"""Tests for cost.py — Engineer 2."""

import os
os.environ.setdefault("USE_MOCK", "true")

from shared.state import RunState
from backend_workers.cost import compute_cost, llm_cost, total_cost, COST_PER_SEC


def test_compute_cost_proportional():
    assert compute_cost(3600) == round(COST_PER_SEC * 3600, 6)
    assert compute_cost(0) == 0.0


def test_llm_cost_zero_tokens():
    assert llm_cost(0) == 0.0


def test_llm_cost_nonzero():
    assert llm_cost(1000) > 0


def test_total_cost_sums():
    run = RunState(run_id="x", task="t", llm_cost=0.001, compute_cost=0.002)
    assert total_cost(run) == round(0.001 + 0.002, 6)
