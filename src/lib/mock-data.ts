// Mock data store for Daytona Async Sandbox Manager
// Shaped to map to Supabase tables: sandboxes, logs, cost_events, jobs (BullMQ)

export type SandboxStatus = "active" | "stopped" | "failed" | "completed";

export interface Sandbox {
  id: string;
  name: string;
  status: SandboxStatus;
  agent: string;
  template: string;
  runtimeSec: number;
  cpu: number; // 0-100
  ram: number; // 0-100
  costCredits: number;
  jobId: string;
  testsPassed?: number;
  testsTotal?: number;
  createdAt: string;
}

export interface LogLine {
  ts: string;
  level: "info" | "warn" | "error" | "debug";
  msg: string;
}

export interface BatchJob {
  id: string;
  description: string;
  template: string;
  parallel: number;
  status: "queued" | "running" | "completed";
  startedAt: string;
  sandboxIds: string[];
}

const TEMPLATES = [
  "code-review-agent",
  "unit-test-generator",
  "refactor-suggester",
  "api-fuzzer",
  "docstring-writer",
];

function rid(prefix = "sb") {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

export const MOCK_SANDBOXES: Sandbox[] = [
  { id: "sb_a1f9c2", name: "agent-01", status: "active", agent: "Claude-Sonnet", template: "unit-test-generator", runtimeSec: 142, cpu: 64, ram: 48, costCredits: 0.42, jobId: "job_8821", testsPassed: 3, testsTotal: 5, createdAt: new Date(Date.now() - 142000).toISOString() },
  { id: "sb_b3e7d1", name: "agent-02", status: "active", agent: "GPT-4o", template: "unit-test-generator", runtimeSec: 138, cpu: 72, ram: 55, costCredits: 0.39, jobId: "job_8821", testsPassed: 4, testsTotal: 5, createdAt: new Date(Date.now() - 138000).toISOString() },
  { id: "sb_c5d4e2", name: "agent-03", status: "completed", agent: "Claude-Opus", template: "unit-test-generator", runtimeSec: 12, cpu: 22, ram: 30, costCredits: 0.18, jobId: "job_8821", testsPassed: 5, testsTotal: 5, createdAt: new Date(Date.now() - 220000).toISOString() },
  { id: "sb_d8f1a3", name: "agent-04", status: "failed", agent: "Gemini-Pro", template: "unit-test-generator", runtimeSec: 47, cpu: 11, ram: 18, costCredits: 0.11, jobId: "job_8821", testsPassed: 1, testsTotal: 5, createdAt: new Date(Date.now() - 200000).toISOString() },
  { id: "sb_e2b9f4", name: "agent-05", status: "active", agent: "Llama-3.1", template: "unit-test-generator", runtimeSec: 156, cpu: 81, ram: 67, costCredits: 0.51, jobId: "job_8821", testsPassed: 2, testsTotal: 5, createdAt: new Date(Date.now() - 156000).toISOString() },
  { id: "sb_f7a3c5", name: "fuzz-runner-12", status: "active", agent: "GPT-4o", template: "api-fuzzer", runtimeSec: 1820, cpu: 44, ram: 38, costCredits: 4.21, jobId: "job_8795", createdAt: new Date(Date.now() - 1820000).toISOString() },
  { id: "sb_99c1d8", name: "review-bot-7", status: "stopped", agent: "Claude-Sonnet", template: "code-review-agent", runtimeSec: 320, cpu: 0, ram: 0, costCredits: 0.88, jobId: "job_8740", createdAt: new Date(Date.now() - 900000).toISOString() },
];

export const MOCK_LOGS: Record<string, LogLine[]> = Object.fromEntries(
  MOCK_SANDBOXES.map((s) => [
    s.id,
    [
      { ts: "00:00:01", level: "info", msg: `[daytona] bootstrapping sandbox ${s.id}` },
      { ts: "00:00:02", level: "info", msg: `[runtime] pulling image: agent-base:${s.template}` },
      { ts: "00:00:05", level: "info", msg: `[agent] model=${s.agent} initialized` },
      { ts: "00:00:07", level: "debug", msg: `[fs] mounted /workspace (rw)` },
      { ts: "00:00:09", level: "info", msg: `[task] received: "Generate unit tests for parser.ts"` },
      { ts: "00:00:14", level: "info", msg: `[agent] planning → 5 tool calls queued` },
      { ts: "00:00:18", level: "warn", msg: `[lint] unused import detected in candidate diff` },
      { ts: "00:00:22", level: "info", msg: `[test] running pytest -q ...` },
      { ts: "00:00:29", level: s.status === "failed" ? "error" : "info", msg: s.status === "failed" ? `[test] FAILED 4/5 — assertion error in test_parse_empty` : `[test] PASSED ${s.testsPassed ?? 3}/${s.testsTotal ?? 5}` },
      { ts: "00:00:31", level: "info", msg: `[agent] writing summary to /workspace/REPORT.md` },
    ],
  ])
);

export const MOCK_JOBS: BatchJob[] = [
  {
    id: "job_8821",
    description: "Generate unit tests for parser.ts with edge cases",
    template: "unit-test-generator",
    parallel: 5,
    status: "running",
    startedAt: new Date(Date.now() - 240000).toISOString(),
    sandboxIds: ["sb_a1f9c2", "sb_b3e7d1", "sb_c5d4e2", "sb_d8f1a3", "sb_e2b9f4"],
  },
];

export const USECASE_TEMPLATES = TEMPLATES;

export function formatRuntime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function newSandboxBatch(count: number, template: string, description: string): { job: BatchJob; sandboxes: Sandbox[] } {
  const jobId = `job_${Math.floor(Math.random() * 9000 + 1000)}`;
  const agents = ["Claude-Sonnet", "GPT-4o", "Claude-Opus", "Gemini-Pro", "Llama-3.1", "Mistral-L"];
  const sandboxes: Sandbox[] = Array.from({ length: count }).map((_, i) => ({
    id: rid(),
    name: `agent-${String(i + 1).padStart(2, "0")}`,
    status: "active",
    agent: agents[i % agents.length],
    template,
    runtimeSec: 0,
    cpu: Math.floor(Math.random() * 40) + 30,
    ram: Math.floor(Math.random() * 30) + 30,
    costCredits: 0,
    jobId,
    createdAt: new Date().toISOString(),
  }));
  return {
    job: {
      id: jobId,
      description,
      template,
      parallel: count,
      status: "running",
      startedAt: new Date().toISOString(),
      sandboxIds: sandboxes.map((s) => s.id),
    },
    sandboxes,
  };
}
