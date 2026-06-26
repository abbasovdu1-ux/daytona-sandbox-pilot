"""
backend_workers/llm.py — ENGINEER 2 (LLM solution generation)

Contract:
    async def generate_solutions(task: str, n: int = 5) -> list[Solution]

Calls the OpenAI API to produce n distinct Python implementations for `task`.
Mock mode returns 5 hard-coded is_palindrome variants so the app runs with
zero API keys.

TODO(ENGINEER 2):
  1. Replace _real_generate with a real openai.AsyncOpenAI call.
  2. Build a prompt requesting n independent implementations, each wrapped in
     a fenced code block labelled with a unique id.
  3. Parse the assistant response into Solution objects.
  4. Compute and set run.llm_cost via cost.llm_cost(total_tokens).
     (Pass `run` as an argument or return token count alongside solutions.)
  5. Set USE_MOCK=false in .env once OPENAI_API_KEY is configured.
"""

from __future__ import annotations

import os
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


async def _mock_generate(task: str, n: int) -> list[Solution]:
    return [
        Solution(id=str(uuid.uuid4()), code=_MOCK_SOLUTIONS[i % len(_MOCK_SOLUTIONS)])
        for i in range(n)
    ]


async def _real_generate(task: str, n: int) -> list[Solution]:
    # TODO(ENGINEER 2):
    # import openai
    # client = openai.AsyncOpenAI()
    # resp = await client.chat.completions.create(
    #     model="gpt-4o",
    #     messages=[{"role": "user", "content": build_prompt(task, n)}],
    # )
    # return parse_solutions(resp.choices[0].message.content)
    raise NotImplementedError("Set USE_MOCK=true or implement the OpenAI integration")


async def generate_solutions(task: str, n: int = 5) -> list[Solution]:
    """
    Generate n distinct Python implementations for the given task.

    Args:
        task: natural-language problem description
        n:    number of candidate solutions (default 5)

    Returns:
        list of Solution(id, code) ready for runner.run_all()
    """
    if USE_MOCK:
        return await _mock_generate(task, n)
    return await _real_generate(task, n)
