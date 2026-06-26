"""Tests for backend_api routes — Engineer 1."""

import os
import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("USE_MOCK", "true")

from backend_api.main import app

client = TestClient(app)


def test_post_run_returns_run_id():
    resp = client.post("/run", json={"task": "write is_palindrome", "n": 2})
    assert resp.status_code == 200
    assert "run_id" in resp.json()


def test_status_unknown_run_returns_404():
    resp = client.get("/status/does-not-exist")
    assert resp.status_code == 404


def test_status_known_run_has_expected_keys():
    resp = client.post("/run", json={"task": "write is_palindrome", "n": 2})
    run_id = resp.json()["run_id"]
    status = client.get(f"/status/{run_id}")
    assert status.status_code == 200
    data = status.json()
    for key in ("run_id", "task", "winner", "llm_cost", "compute_cost", "total_cost", "solutions"):
        assert key in data, f"missing key: {key}"


def test_solutions_count_matches_n():
    resp = client.post("/run", json={"task": "write is_palindrome", "n": 3})
    run_id = resp.json()["run_id"]
    import time; time.sleep(0.1)   # let background task seed solutions
    data = client.get(f"/status/{run_id}").json()
    assert len(data["solutions"]) == 3
