import { setDaytonaRuntimeEnv } from "./daytona-adapter";
import { cleanupJob, getSnapshot, launchBatch, stopSandbox } from "./worker-engine";

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

  if (request.method === "GET" && url.pathname === "/api/worker/state") {
    return json(getSnapshot());
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
