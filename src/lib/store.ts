import { create } from "zustand";
import {
  MOCK_SANDBOXES,
  MOCK_LOGS,
  MOCK_JOBS,
  newSandboxBatch,
  type Sandbox,
  type BatchJob,
  type LogLine,
} from "./mock-data";

interface AgentOpsState {
  sandboxes: Sandbox[];
  logs: Record<string, LogLine[]>;
  jobs: BatchJob[];
  costAlertThreshold: number;
  runtimeAlertSec: number;
  autoCleanupSec: number;
  launchBatch: (description: string, count: number, template: string) => string;
  stopSandbox: (id: string) => void;
  cleanupJob: (jobId: string) => void;
  tick: () => void;
  setCostThreshold: (n: number) => void;
  setRuntimeAlert: (n: number) => void;
  setAutoCleanup: (n: number) => void;
}

export const useAgentOps = create<AgentOpsState>((set, get) => ({
  sandboxes: MOCK_SANDBOXES,
  logs: MOCK_LOGS,
  jobs: MOCK_JOBS,
  costAlertThreshold: 10,
  runtimeAlertSec: 1800,
  autoCleanupSec: 3600,

  launchBatch: (description, count, template) => {
    const { job, sandboxes } = newSandboxBatch(count, template, description);
    const seedLogs: Record<string, LogLine[]> = {};
    sandboxes.forEach((s) => {
      seedLogs[s.id] = [
        { ts: "00:00:01", level: "info", msg: `[daytona] provisioning ${s.id} (${s.agent})` },
        { ts: "00:00:02", level: "info", msg: `[bullmq] queued job ${job.id} → worker:agents` },
        { ts: "00:00:04", level: "info", msg: `[task] "${description}"` },
      ];
    });
    set((st) => ({
      jobs: [job, ...st.jobs],
      sandboxes: [...sandboxes, ...st.sandboxes],
      logs: { ...st.logs, ...seedLogs },
    }));
    return job.id;
  },

  stopSandbox: (id) =>
    set((st) => ({
      sandboxes: st.sandboxes.map((s) =>
        s.id === id ? { ...s, status: "stopped", cpu: 0, ram: 0 } : s
      ),
    })),

  cleanupJob: (jobId) =>
    set((st) => ({
      sandboxes: st.sandboxes.map((s) =>
        s.jobId === jobId && (s.status === "active" || s.status === "completed")
          ? { ...s, status: "stopped", cpu: 0, ram: 0 }
          : s
      ),
    })),

  tick: () =>
    set((st) => ({
      sandboxes: st.sandboxes.map((s) => {
        if (s.status !== "active") return s;
        const cpu = Math.max(10, Math.min(95, s.cpu + (Math.random() * 10 - 5)));
        const ram = Math.max(10, Math.min(95, s.ram + (Math.random() * 8 - 4)));
        return {
          ...s,
          runtimeSec: s.runtimeSec + 1,
          cpu: Math.round(cpu),
          ram: Math.round(ram),
          costCredits: +(s.costCredits + 0.003).toFixed(3),
        };
      }),
    })),

  setCostThreshold: (n) => set({ costAlertThreshold: n }),
  setRuntimeAlert: (n) => set({ runtimeAlertSec: n }),
  setAutoCleanup: (n) => set({ autoCleanupSec: n }),
}));
