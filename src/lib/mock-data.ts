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
  status: "queued" | "running" | "completed" | "failed";
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

export const USECASE_TEMPLATES = TEMPLATES;

export function formatRuntime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
