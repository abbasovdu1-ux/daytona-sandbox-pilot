import { setDaytonaRuntimeEnv } from "./daytona-adapter";
import { setEmailRuntimeEnv } from "./email-service";
import {
  cleanupJob,
  getSnapshot,
  launchBatch,
  sendTestEmail,
  stopSandbox,
  updateAlertSettings,
} from "./worker-engine";

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });
}

async function readJson(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function handleWorkerApi(
  request: Request,
  runtimeEnv?: unknown,
): Promise<Response | undefined> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/worker")) return undefined;
  setDaytonaRuntimeEnv(runtimeEnv);
  setEmailRuntimeEnv(runtimeEnv);

  if (request.method === "GET" && url.pathname === "/api/worker/state") {
    return json(getSnapshot());
  }

  if (request.method === "GET" && url.pathname === "/api/worker/debug") {
    const { Daytona } = await import("@daytona/sdk");
    const apiKey = (runtimeEnv as Record<string,unknown>)?.["DAYTONA_API_KEY"] as string
      || (typeof process !== "undefined" ? process.env["DAYTONA_API_KEY"] : undefined);
    const apiUrl = (runtimeEnv as Record<string,unknown>)?.["DAYTONA_API_URL"] as string
      || (typeof process !== "undefined" ? process.env["DAYTONA_API_URL"] : undefined)
      || "https://app.daytona.io/api";
    let sandboxSample: unknown = null;
    let clientError: string | null = null;
    try {
      if (apiKey) {
        const d = new Daytona({ apiKey, apiUrl });
        const list = await d.list({ limit: 1 });
        sandboxSample = list[0] ? { id: list[0].id, toolboxProxyUrl: (list[0] as unknown as Record<string,unknown>).toolboxProxyUrl, state: list[0].state } : "empty";
      }
    } catch (e) { clientError = String(e); }
    return json({
      hasKey: !!apiKey,
      keyPrefix: apiKey ? apiKey.slice(0, 8) + "..." : null,
      apiUrl,
      clientError,
      sandboxSample,
      VERCEL: typeof process !== "undefined" ? process.env["VERCEL"] : "no-process",
      NODE_VERSION: typeof process !== "undefined" ? process.version : "no-process",
    });
  }

  if (request.method === "POST" && url.pathname === "/api/worker/jobs") {
    const body = await readJson(request);
    const description = String(body.description ?? "").trim();
    const template = String(body.template ?? "unit-test-generator");
    const count = Number(body.count ?? 5);

    if (!description) {
      return json({ error: "Task description is required" }, { status: 400 });
    }

    const job = launchBatch(description, count, template);
    return json({ job, snapshot: getSnapshot() }, { status: 201 });
  }

  if (request.method === "PUT" && url.pathname === "/api/worker/settings") {
    const body = await readJson(request);
    const settings = updateAlertSettings({
      costAlertThreshold: Number(body.costAlertThreshold),
      runtimeAlertSec: Number(body.runtimeAlertSec),
      autoCleanupSec: Number(body.autoCleanupSec),
      emailAlertsEnabled: Boolean(body.emailAlertsEnabled),
      emailRecipient: String(body.emailRecipient ?? ""),
    });
    return json({ settings, snapshot: getSnapshot() });
  }

  if (request.method === "POST" && url.pathname === "/api/worker/email/test") {
    try {
      const status = await sendTestEmail();
      return json({ ok: true, status, snapshot: getSnapshot() });
    } catch (error) {
      return json(
        { ok: false, error: error instanceof Error ? error.message : "Test email failed" },
        { status: 400 },
      );
    }
  }

  const stopMatch = url.pathname.match(/^\/api\/worker\/sandboxes\/([^/]+)\/stop$/);
  if (request.method === "POST" && stopMatch) {
    const ok = await stopSandbox(decodeURIComponent(stopMatch[1]));
    return json({ ok, snapshot: getSnapshot() }, { status: ok ? 200 : 404 });
  }

  const cleanupMatch = url.pathname.match(/^\/api\/worker\/jobs\/([^/]+)\/cleanup$/);
  if (request.method === "POST" && cleanupMatch) {
    const ok = await cleanupJob(decodeURIComponent(cleanupMatch[1]));
    return json({ ok, snapshot: getSnapshot() });
  }

  return json({ error: "Worker API route not found" }, { status: 404 });
}
