import { create } from "zustand";
import {
  type BatchJob,
  type LogLine,
  type Sandbox,
} from "./mock-data";

interface WorkerSnapshot {
  sandboxes: Sandbox[];
  logs: Record<string, LogLine[]>;
  jobs: BatchJob[];
}

interface AgentOpsState {
  sandboxes: Sandbox[];
  logs: Record<string, LogLine[]>;
  jobs: BatchJob[];
  costAlertThreshold: number;
  runtimeAlertSec: number;
  autoCleanupSec: number;
  isRefreshing: boolean;
  refresh: () => Promise<void>;
  hydrate: (snapshot: WorkerSnapshot) => void;
  launchBatch: (description: string, count: number, template: string) => Promise<string>;
  stopSandbox: (id: string) => Promise<void>;
  cleanupJob: (jobId: string) => Promise<void>;
  tick: () => void;
  setCostThreshold: (n: number) => void;
  setRuntimeAlert: (n: number) => void;
  setAutoCleanup: (n: number) => void;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Worker API failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export const useAgentOps = create<AgentOpsState>((set, get) => ({
  sandboxes: [],
  logs: {},
  jobs: [],
  costAlertThreshold: 10,
  runtimeAlertSec: 1800,
  autoCleanupSec: 3600,
  isRefreshing: false,

  hydrate: (snapshot) =>
    set({
      sandboxes: snapshot.sandboxes,
      logs: snapshot.logs,
      jobs: snapshot.jobs,
    }),

  refresh: async () => {
    if (get().isRefreshing) return;
    set({ isRefreshing: true });

    try {
      const snapshot = await requestJson<WorkerSnapshot>("/api/worker/state");
      get().hydrate(snapshot);
    } finally {
      set({ isRefreshing: false });
    }
  },

  launchBatch: async (description, count, template) => {
    const response = await requestJson<{ job: BatchJob; snapshot: WorkerSnapshot }>(
      "/api/worker/jobs",
      {
        method: "POST",
        body: JSON.stringify({ description, count, template }),
      },
    );
    get().hydrate(response.snapshot);
    return response.job.id;
  },

  stopSandbox: async (id) => {
    const response = await requestJson<{ snapshot: WorkerSnapshot }>(
      `/api/worker/sandboxes/${encodeURIComponent(id)}/stop`,
      { method: "POST" },
    );
    get().hydrate(response.snapshot);
  },

  cleanupJob: async (jobId) => {
    const response = await requestJson<{ snapshot: WorkerSnapshot }>(
      `/api/worker/jobs/${encodeURIComponent(jobId)}/cleanup`,
      { method: "POST" },
    );
    get().hydrate(response.snapshot);
  },

  tick: () => {
    void get().refresh().catch((error) => {
      console.error(error);
    });
  },

  setCostThreshold: (n) => set({ costAlertThreshold: n }),
  setRuntimeAlert: (n) => set({ runtimeAlertSec: n }),
  setAutoCleanup: (n) => set({ autoCleanupSec: n }),
}));
