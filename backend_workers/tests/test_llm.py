"""Tests for llm.py — Engineer 2."""

import os
import pytest

os.environ.setdefault("USE_MOCK", "true")

from shared.state import Solution
from backend_workers.llm import generate_solutions


@pytest.mark.asyncio
async def test_returns_correct_count():
    for n in (1, 3, 5):
        sols = await generate_solutions("task", n=n)
        assert len(sols) == n


@pytest.mark.asyncio
async def test_returns_solution_objects():
    sols = await generate_solutions("task", n=3)
    for s in sols:
        assert isinstance(s, Solution)
        assert s.id and s.code


@pytest.mark.asyncio
async def test_unique_ids():
    sols = await generate_solutions("task", n=5)
    ids = [s.id for s in sols]
    assert len(ids) == len(set(ids))
