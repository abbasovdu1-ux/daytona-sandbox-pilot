# Frontend

**This folder is owned by the frontend team.**

The frontend team is building and designing this independently.
Do not add files here unless coordinating with the frontend team.

## API contract (what the backend exposes)

| Endpoint | Method | Body | Response |
|---|---|---|---|
| `/run` | POST | `{"task": "...", "n": 5}` | `{"run_id": "uuid"}` |
| `/status/{run_id}` | GET | — | `RunState` JSON (see below) |

### RunState JSON shape

```json
{
  "run_id": "string",
  "task": "string",
  "winner": "solution-id or null",
  "llm_cost": 0.0,
  "compute_cost": 0.0,
  "total_cost": 0.0,
  "solutions": {
    "<solution-id>": {
      "status": "pending | running | passed | failed",
      "seconds": 0.0,
      "cost": 0.0,
      "output": "string"
    }
  }
}
```

Poll `/status/{run_id}` every second until all statuses are `passed` or `failed`.
