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
  alertSettings: AlertSettings;
  emailOutbox: EmailOutboxItem[];
  emailProviderConfigured: boolean;
}

interface AlertSettings {
  costAlertThreshold: number;
  runtimeAlertSec: number;
  autoCleanupSec: number;
  emailAlertsEnabled: boolean;
  emailRecipient: string;
  emailFrom: string;
  lastEmailStatus?: string;
}

interface EmailOutboxItem {
  id: string;
  to: string;
  subject: string;
  text: string;
  createdAt: string;
}

interface AgentOpsState {
  sandboxes: Sandbox[];
  logs: Record<string, LogLine[]>;
  jobs: BatchJob[];
  costAlertThreshold: number;
  runtimeAlertSec: number;
  autoCleanupSec: number;
  emailAlertsEnabled: boolean;
  emailRecipient: string;
  emailFrom: string;
  lastEmailStatus?: string;
  emailOutbox: EmailOutboxItem[];
  emailProviderConfigured: boolean;
  isRefreshing: boolean;
  refresh: () => Promise<void>;
  hydrate: (snapshot: WorkerSnapshot) => void;
  saveSettings: (settings: Partial<AlertSettings>) => Promise<void>;
  sendTestEmail: () => Promise<void>;
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
    let detail = "";
    try {
      const body = (await response.json()) as { error?: string };
      detail = body.error ? `: ${body.error}` : "";
    } catch {
      detail = "";
    }
    throw new Error(`Worker API failed: ${response.status}${detail}`);
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
  emailAlertsEnabled: false,
  emailRecipient: "",
  emailFrom: "Daytona AgentOps <alerts@daytona-agentops.local>",
  emailOutbox: [],
  emailProviderConfigured: false,
  isRefreshing: false,

  hydrate: (snapshot) =>
    set({
      sandboxes: snapshot.sandboxes,
      logs: snapshot.logs,
      jobs: snapshot.jobs,
      costAlertThreshold: snapshot.alertSettings.costAlertThreshold,
      runtimeAlertSec: snapshot.alertSettings.runtimeAlertSec,
      autoCleanupSec: snapshot.alertSettings.autoCleanupSec,
      emailAlertsEnabled: snapshot.alertSettings.emailAlertsEnabled,
      emailRecipient: snapshot.alertSettings.emailRecipient,
      emailFrom: snapshot.alertSettings.emailFrom,
      lastEmailStatus: snapshot.alertSettings.lastEmailStatus,
      emailOutbox: snapshot.emailOutbox,
      emailProviderConfigured: snapshot.emailProviderConfigured,
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

  saveSettings: async (settings) => {
    const current = get();
    const response = await requestJson<{ snapshot: WorkerSnapshot }>(
      "/api/worker/settings",
      {
        method: "PUT",
        body: JSON.stringify({
          costAlertThreshold: settings.costAlertThreshold ?? current.costAlertThreshold,
          runtimeAlertSec: settings.runtimeAlertSec ?? current.runtimeAlertSec,
          autoCleanupSec: settings.autoCleanupSec ?? current.autoCleanupSec,
          emailAlertsEnabled: settings.emailAlertsEnabled ?? current.emailAlertsEnabled,
          emailRecipient: settings.emailRecipient ?? current.emailRecipient,
        }),
      },
    );
    get().hydrate(response.snapshot);
  },

  sendTestEmail: async () => {
    const response = await requestJson<{ snapshot: WorkerSnapshot }>(
      "/api/worker/email/test",
      { method: "POST" },
    );
    get().hydrate(response.snapshot);
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

  setCostThreshold: (n) => {
    void get().saveSettings({ costAlertThreshold: n });
  },
  setRuntimeAlert: (n) => {
    void get().saveSettings({ runtimeAlertSec: n });
  },
  setAutoCleanup: (n) => {
    void get().saveSettings({ autoCleanupSec: n });
  },
}));
