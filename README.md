# Daytona Async Sandbox Manager

> An AgentOps dashboard for launching, monitoring, and comparing parallel AI-agent workloads running inside ephemeral [Daytona](https://daytona.io) sandboxes — with live logs, cost tracking, and automatic cleanup.

---

## Overview

Daytona Async Sandbox Manager lets you dispatch a single task to **N parallel AI agents**, each running in its own isolated Daytona sandbox. While they work, the dashboard streams live logs, tracks CPU/RAM/credit usage in real time, fires cost and runtime alerts, and surfaces the best result when they finish.

Built for teams that need to benchmark, test, or run AI workloads at scale without losing visibility or blowing their compute budget.

---

## Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Sandbox Overview** | Real-time grid of every Daytona environment — active, completed, failed, and stopped |
| 2 | **Async Task Runner** | Dispatch a prompt or task to 1–20 parallel sandboxes with a single click |
| 3 | **Live Log Stream** | Per-sandbox terminal panel streaming stdout from the agent in real time |
| 4 | **Usage Tracking** | Runtime clock, CPU %, RAM %, and estimated credit cost per sandbox |
| 5 | **Cost & Runtime Alerts** | Banner warnings when total spend or per-sandbox runtime crosses configurable thresholds |
| 6 | **Auto Cleanup** | One-click (or automatic) teardown of idle sandboxes to stop the credit meter |
| 7 | **Result Summary** | Side-by-side comparison of all agents — winner ranked by pass rate then runtime |

---

## Architecture

```
Browser
  └─ React + TanStack Router (SPA)
       └─ Zustand store  ──── polls GET /api/worker/state every 1s
       └─ Task Runner    ──── POST /api/worker/jobs

Vercel Serverless Function (Node.js 20, maxDuration 300s)
  └─ src/server.ts          (custom SSR entry)
       └─ handleWorkerApi   (routes /api/worker/*)
            └─ worker-engine.ts   (in-memory job & sandbox state)
                 └─ daytona-adapter.ts
                      └─ @daytona/sdk  ──── Daytona Cloud API
                           └─ ephemeral TypeScript sandbox
                                └─ multi-phase agent script (Node.js ESM)
```

Each sandbox executes a self-contained **multi-phase agent script** that logs progress at every step, making the live-log panel meaningful during a demo. Each template runs ~20–26 seconds across four named phases (parse → analyse → generate → validate).

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend framework | [React 19](https://react.dev) + [TanStack Start](https://tanstack.com/start) + [TanStack Router](https://tanstack.com/router) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com) |
| State management | [Zustand](https://zustand-demo.pmnd.rs) |
| Build tooling | [Vite](https://vitejs.dev) + [Nitro](https://nitro.unjs.io) (vercel preset) |
| Sandbox execution | [Daytona SDK](https://github.com/daytonaio/sdk) (`@daytona/sdk`) |
| Email alerts | [Resend](https://resend.com) |
| Deployment | [Vercel](https://vercel.com) |

---

## Quick Start

### Prerequisites

- Node.js 20+
- [Bun](https://bun.sh) (or npm/pnpm)
- A [Daytona](https://daytona.io) account and API key

### 1. Clone and install

```bash
git clone https://github.com/abbasovdu1-ux/daytona-sandbox-pilot.git
cd daytona-sandbox-pilot
bun install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in:

```env
DAYTONA_API_KEY=dtn_...          # Required — from app.daytona.io
DAYTONA_API_URL=https://app.daytona.io/api
```

### 3. Run locally

```bash
bun run dev
```

Open [http://localhost:8080](http://localhost:8080).

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DAYTONA_API_KEY` | **Yes** | Daytona API key — provisioning sandboxes will fail without this |
| `DAYTONA_API_URL` | No | Daytona API base URL (default: `https://app.daytona.io/api`) |
| `RESEND_API_KEY` | No | [Resend](https://resend.com) key for email cost/runtime alerts |
| `ALERT_EMAIL_FROM` | No | Sender address for alert emails (default: `onboarding@resend.dev`) |

> **Vercel:** Add these under *Project → Settings → Environment Variables* in the Vercel dashboard. `.env.local` is gitignored and never deployed.

---

## Deploying to Vercel

The project is pre-configured for Vercel via `vercel.json` and Nitro's `vercel` preset.

```bash
vercel deploy
```

Or connect the GitHub repo to a Vercel project for automatic deployments on push to `main`.

**Required Vercel settings** (set in the dashboard, not in code):

```
DAYTONA_API_KEY   =  dtn_...
DAYTONA_API_URL   =  https://app.daytona.io/api
```

After adding environment variables, trigger a **Redeploy** — Vercel does not auto-redeploy on env-var changes alone.

---

## Project Structure

```
├── src/
│   ├── backend/
│   │   ├── daytona-adapter.ts   # Daytona SDK wrapper + agent script builder
│   │   ├── worker-engine.ts     # In-memory job/sandbox state + execution orchestration
│   │   ├── worker-api.ts        # HTTP route handlers for /api/worker/*
│   │   └── email-service.ts     # Resend email alert sender
│   ├── components/
│   │   ├── sandbox-detail-modal.tsx  # Live log terminal + resource gauges
│   │   ├── cost-alert-banner.tsx     # Cost & runtime threshold warnings
│   │   ├── app-sidebar.tsx           # Navigation
│   │   └── status-pill.tsx           # Active / Completed / Failed badge
│   ├── routes/
│   │   ├── index.tsx            # Dashboard — stats + recent sandboxes
│   │   ├── sandboxes.tsx        # Sandbox manager + result summary
│   │   ├── tasks.tsx            # Async task runner / batch launcher
│   │   └── settings.tsx         # Cost/runtime alert configuration
│   ├── lib/
│   │   ├── store.ts             # Zustand store + /api/worker/* client
│   │   └── mock-data.ts         # TypeScript types + template list
│   └── server.ts                # Custom SSR entry — routes API before TanStack SSR
├── vercel.json                  # Vercel build config (Nitro vercel preset)
└── vite.config.ts               # Vite + Nitro config (maxDuration: 300s)
```

---

## Agent Templates

| Template | What it does inside the sandbox |
|----------|----------------------------------|
| `unit-test-generator` | Parses AST → identifies boundaries → generates test stubs → runs coverage |
| `code-review-agent` | Loads linter → scans anti-patterns → checks security → aggregates findings |
| `refactor-suggester` | Builds call graph → detects hotspots → proposes patterns → estimates savings |
| `api-fuzzer` | Enumerates endpoints → generates payloads → executes fuzz cases → triages failures |
| `docstring-writer` | Extracts signatures → infers semantics → drafts JSDoc bodies → validates completeness |

Each template runs **4 phases** totalling ~20–26 seconds, logging progress at every step so the live-log panel shows meaningful output during demos.

---

## Demo

1. Open the **Task Runner** tab
2. Enter a task description (e.g. *"Generate unit tests for parser.ts with edge cases"*)
3. Set parallel sandboxes to **5**
4. Choose a template and click **Execute parallel run**
5. Watch the **Sandbox Manager** — all 5 sandboxes provision, run their phases, and complete
6. The **Batch Result** panel highlights the winner ranked by pass rate and runtime

---

## License

MIT — see [LICENSE](LICENSE) for details.
