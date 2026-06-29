# AgentOps

Run N AI-generated solutions in parallel Daytona sandboxes, pick the winner, meter the cost.

## Who owns what

| Folder | Owner | Responsibility |
|---|---|---|
| `frontend/` | Frontend team | UI, polling, visualisation |
| `backend_api/` | Engineer 1 | FastAPI app, routing, orchestration |
| `backend_workers/` | Engineer 2 | Daytona runner, OpenAI LLM, cost math |
| `shared/state.py` | Both (discuss changes) | Shared data contracts — `RunState`, `Solution`, `SandboxState` |

**Rule:** nobody edits a folder they don't own. Schema changes to `shared/state.py` require both backend engineers to agree.

## Quick start (mock mode — zero API keys needed)

```bash
# 1. clone & install
git clone <repo-url> && cd agentops
pip install -r requirements.txt

# 2. copy env (defaults to USE_MOCK=true)
cp .env.example .env

# 3. run
uvicorn backend_api.main:app --reload
```

Then open [http://localhost:8000](http://localhost:8000) — the frontend team's UI lives there.

## API at a glance

```
POST /run          {"task": "...", "n": 5}  →  {"run_id": "uuid"}
GET  /status/{id}                           →  RunState JSON
```

Poll `/status/{run_id}` every second until all `solutions[id].status` are `passed` or `failed`.

## Tests

```bash
# Engineer 1
pytest backend_api/tests/

# Engineer 2
pytest backend_workers/tests/
```

## Replacing mock mode

| What | File | Env var |
|---|---|---|
| Daytona sandbox | `backend_workers/runner.py` | `DAYTONA_API_KEY` |
| OpenAI solutions | `backend_workers/llm.py` | `OPENAI_API_KEY` |

Set `USE_MOCK=false` in `.env` after filling in the `# TODO(ENGINEER 2)` blocks.
