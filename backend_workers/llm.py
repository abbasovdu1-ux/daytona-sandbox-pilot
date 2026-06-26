"""
backend_workers/llm.py — ENGINEER 2 (LLM solution generation)

Contract:
    async def generate_solutions(task: str, n: int = 5) -> tuple[list[Solution], int]

Returns (solutions, total_tokens).  Caller uses total_tokens to compute llm_cost.
Mock mode returns (5 hard-coded is_palindrome variants, 0).

TODO(ENGINEER 2 — real mode):
  Set USE_MOCK=false in .env and ensure OPENAI_API_KEY is set.
"""

from __future__ import annotations

import os
import re
import uuid

from shared.state import Solution

USE_MOCK = os.getenv("USE_MOCK", "true").lower() == "true"

_MOCK_SOLUTIONS = [
    "def is_palindrome(s):\n    return s == s[::-1]",
    "def is_palindrome(s):\n    return list(s) == list(reversed(s))",
    "def is_palindrome(s):\n    i, j = 0, len(s) - 1\n    while i < j:\n        if s[i] != s[j]: return False\n        i += 1; j -= 1\n    return True",
    "def is_palindrome(s):\n    return all(s[i] == s[~i] for i in range(len(s) // 2))",
    "import re\ndef is_palindrome(s):\n    clean = re.sub(r'[^a-zA-Z0-9]', '', s).lower()\n    return clean == clean[::-1]",
]

_SYSTEM_PROMPT = (
    "You are an expert Python engineer. When given a programming task you produce "
    "multiple distinct, self-contained Python implementations. Each implementation "
    "must be a complete function or module — no placeholders, no ellipses."
)


def _build_prompt(task: str, n: int) -> str:
    return (
        f"Write {n} distinct Python implementations for the following task:\n\n"
        f"{task}\n\n"
        f"Return exactly {n} code blocks. "
        f"Prefix each block with ### SOLUTION N (N = 1..{n}). "
        "No prose outside the code blocks."
    )


def _parse_solutions(content: str, n: int) -> list[Solution]:
    """Extract ```python ... ``` fenced blocks; fall back to mock if short."""
    blocks = re.findall(r"```(?:python)?\s*\n(.*?)```", content, re.DOTALL)
    solutions: list[Solution] = []
    for code in blocks[:n]:
        solutions.append(Solution(id=str(uuid.uuid4()), code=code.strip()))
    # Pad with mock snippets if the LLM returned fewer than asked
    for i in range(len(solutions), n):
        solutions.append(Solution(
            id=str(uuid.uuid4()),
            code=_MOCK_SOLUTIONS[i % len(_MOCK_SOLUTIONS)],
        ))
    return solutions


async def _mock_generate(_task: str, n: int) -> tuple[list[Solution], int]:
    return (
        [Solution(id=str(uuid.uuid4()), code=_MOCK_SOLUTIONS[i % len(_MOCK_SOLUTIONS)]) for i in range(n)],
        0,
    )


async def _real_generate(task: str, n: int) -> tuple[list[Solution], int]:
    import openai  # deferred so mock mode never needs the package installed

    client = openai.AsyncOpenAI()  # reads OPENAI_API_KEY from env
    resp = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user",   "content": _build_prompt(task, n)},
        ],
        temperature=1.0,   # high temperature → diverse solutions
    )
    content = resp.choices[0].message.content or ""
    tokens = resp.usage.total_tokens if resp.usage else 0
    return _parse_solutions(content, n), tokens


async def generate_solutions(task: str, n: int = 5) -> tuple[list[Solution], int]:
    """
    Generate n distinct Python implementations for the given task.

    Returns:
        (solutions, total_tokens) — caller computes llm_cost from total_tokens.
    """
    if USE_MOCK:
        return await _mock_generate(task, n)
    return await _real_generate(task, n)
