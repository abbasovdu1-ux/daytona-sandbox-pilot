import type { BatchJob, LogLine, Sandbox } from "@/lib/mock-data";
import {
  provisionSandbox,
  runSandboxTask,
  stopSandbox as stopDaytonaSandbox,
  type DaytonaExecutionHandle,
} from "./daytona-adapter";

interface WorkerRuntime {
  sandboxId: string;
  task: string;
  handle?: DaytonaExecutionHandle;
  externalId?: string;
  startedAtMs: number;
}

export interface WorkerSnapshot {
  sandboxes: Sandbox[];
  logs: Record<string, LogLine[]>;
  jobs: BatchJob[];
}

const AGENTS = ["worker-alpha", "worker-beta", "worker-gamma", "worker-delta", "worker-epsilon"];

const state: WorkerSnapshot = {
  sandboxes: [],
  logs: {},
  jobs: [],
};

const runtimes = new Map<string, WorkerRuntime>();
let interval: ReturnType<typeof setInterval> | undefined;

function nowIso() {
  return new Date().toISOString();
}

function timestamp(runtimeSec: number) {
  const m = Math.floor(runtimeSec / 60);
  const s = runtimeSec % 60;
  return `00:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

function addLog(sandboxId: string, level: LogLine["level"], msg: string) {
  const sandbox = state.sandboxes.find((s) => s.id === sandboxId);
  const runtimeSec = sandbox?.runtimeSec ?? 0;
  state.logs[sandboxId] = [
    ...(state.logs[sandboxId] ?? []),
    { ts: timestamp(runtimeSec), level, msg },
  ].slice(-250);
}

function updateJobStatus(jobId: string) {
  const members = state.sandboxes.filter((s) => s.jobId === jobId);
  const job = state.jobs.find((j) => j.id === jobId);
  if (!job || members.length === 0) return;

  const finished = members.every((s) =>
    ["completed", "failed", "stopped"].includes(s.status),
  );
  const failed = members.some((s) => s.status === "failed");
  job.status = finished ? (failed ? "failed" : "completed") : "running";
}

function updateRuntimeEstimates(runtime: WorkerRuntime) {
  const sandbox = state.sandboxes.find((s) => s.id === runtime.sandboxId);
  if (!sandbox || sandbox.status !== "active") return;

  sandbox.runtimeSec = Math.max(0, Math.floor((Date.now() - runtime.startedAtMs) / 1000));
  sandbox.costCredits = +(sandbox.runtimeSec * 0.003).toFixed(3);
}

async function runWorkerSandbox(runtime: WorkerRuntime) {
  const sandbox = state.sandboxes.find((s) => s.id === runtime.sandboxId);
  if (!sandbox) return;

  try {
    addLog(sandbox.id, "info", "[daytona] provisioning real sandbox");
    const handle = await provisionSandbox(sandbox, runtime.task);
    const localId = runtime.sandboxId;
    runtime.handle = handle;
    runtime.externalId = handle.externalId;
    sandbox.id = handle.externalId;
    runtimes.delete(localId);
    runtime.sandboxId = handle.externalId;
    runtimes.set(handle.externalId, runtime);
    state.logs[handle.externalId] = state.logs[localId] ?? [];
    delete state.logs[localId];

    const job = state.jobs.find((j) => j.id === sandbox.jobId);
    if (job) {
      job.sandboxIds = job.sandboxIds.map((id) => (id === localId ? handle.externalId : id));
    }

    sandbox.cpu = handle.sandbox.cpu ?? 0;
    sandbox.ram = handle.sandbox.memory ?? 0;
    sandbox.createdAt = handle.sandbox.createdAt ?? sandbox.createdAt;

    addLog(sandbox.id, "info", `[daytona] sandbox ready: ${handle.externalId}`);
    addLog(sandbox.id, "info", "[worker] executing task command inside Daytona");

    const result = await runSandboxTask(handle, runtime.task, sandbox);
    for (const line of result.output.split(/\r?\n/).filter(Boolean)) {
      addLog(sandbox.id, "info", `[stdout] ${line}`);
    }

    sandbox.testsTotal = 1;
    sandbox.testsPassed = result.exitCode === 0 ? 1 : 0;
    sandbox.status = result.exitCode === 0 ? "completed" : "failed";
    addLog(
      sandbox.id,
      result.exitCode === 0 ? "info" : "error",
      `[worker] command finished with exit code ${result.exitCode}`,
    );

    addLog(sandbox.id, "info", "[cleanup] stopping ephemeral Daytona sandbox");
    try {
      await stopDaytonaSandbox(handle);
      addLog(sandbox.id, "info", "[cleanup] Daytona sandbox stopped");
    } catch (error) {
      addLog(
        sandbox.id,
        "warn",
        `[cleanup] stop failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  } catch (error) {
    sandbox.status = "failed";
    sandbox.testsTotal = 1;
    sandbox.testsPassed = 0;
    addLog(
      sandbox.id,
      "error",
      `[worker] ${error instanceof Error ? error.message : "unknown worker failure"}`,
    );
  } finally {
    sandbox.cpu = 0;
    sandbox.ram = 0;
    runtimes.delete(runtime.sandboxId);
    updateJobStatus(sandbox.jobId);
  }
}

export function ensureWorkerEngine() {
  if (interval) return;

  interval = setInterval(() => {
    for (const runtime of [...runtimes.values()]) {
      updateRuntimeEstimates(runtime);
    }
  }, 1000);
}

export function getSnapshot(): WorkerSnapshot {
  ensureWorkerEngine();
  return {
    sandboxes: state.sandboxes.map((s) => ({ ...s })),
    logs: Object.fromEntries(
      Object.entries(state.logs).map(([id, lines]) => [id, lines.map((line) => ({ ...line }))]),
    ),
    jobs: state.jobs.map((j) => ({ ...j, sandboxIds: [...j.sandboxIds] })),
  };
}

export function launchBatch(description: string, count: number, template: string): BatchJob {
  ensureWorkerEngine();

  const jobId = id("job");
  const safeCount = Math.max(1, Math.min(20, Math.floor(count || 1)));
  const sandboxes: Sandbox[] = Array.from({ length: safeCount }).map((_, index) => ({
    id: id("sb"),
    name: `agentops-${jobId}-${index + 1}`,
    status: "active",
    agent: AGENTS[index % AGENTS.length],
    template,
    runtimeSec: 0,
    cpu: 0,
    ram: 0,
    costCredits: 0,
    jobId,
    createdAt: nowIso(),
  }));

  const job: BatchJob = {
    id: jobId,
    description,
    template,
    parallel: safeCount,
    status: "running",
    startedAt: nowIso(),
    sandboxIds: sandboxes.map((s) => s.id),
  };

  state.jobs.unshift(job);
  state.sandboxes.unshift(...sandboxes);

  for (const sandbox of sandboxes) {
    state.logs[sandbox.id] = [
      { ts: "00:00:00", level: "info", msg: `[queue] job ${job.id} accepted by backend worker` },
      { ts: "00:00:00", level: "info", msg: `[task] "${description}"` },
    ];

    const runtime: WorkerRuntime = {
      sandboxId: sandbox.id,
      task: description,
      startedAtMs: Date.now(),
    };
    runtimes.set(sandbox.id, runtime);
    void runWorkerSandbox(runtime);
  }

  return job;
}

export async function stopSandbox(sandboxId: string) {
  ensureWorkerEngine();
  const sandbox = state.sandboxes.find((s) => s.id === sandboxId);
  if (!sandbox) return false;

  const runtime = runtimes.get(sandboxId);
  try {
    if (runtime?.handle) {
      await stopDaytonaSandbox(runtime.handle);
    } else {
      await stopDaytonaSandbox(sandboxId);
    }
    sandbox.status = "stopped";
    addLog(sandboxId, "warn", "[worker] Daytona sandbox stopped by operator");
  } catch (error) {
    sandbox.status = "failed";
    addLog(
      sandboxId,
      "error",
      `[worker] stop failed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }

  sandbox.cpu = 0;
  sandbox.ram = 0;
  runtimes.delete(sandboxId);
  updateJobStatus(sandbox.jobId);
  return true;
}

export async function cleanupJob(jobId: string) {
  ensureWorkerEngine();
  let changed = false;
  for (const sandbox of state.sandboxes) {
    if (sandbox.jobId !== jobId || sandbox.status === "failed" || sandbox.status === "stopped") continue;
    await stopSandbox(sandbox.id);
    changed = true;
  }
  updateJobStatus(jobId);
  return changed;
}
