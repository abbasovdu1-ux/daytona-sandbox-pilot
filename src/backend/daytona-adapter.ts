import { CodeLanguage, Daytona, type Sandbox as DaytonaSandbox } from "@daytona/sdk";
import type { Sandbox } from "@/lib/mock-data";

let localEnvLoaded = false;
let runtimeEnv: Record<string, unknown> = {};

export interface DaytonaExecutionHandle {
  sandbox: DaytonaSandbox;
  externalId: string;
}

export interface DaytonaRunResult {
  exitCode: number;
  output: string;
}

export function setDaytonaRuntimeEnv(env: unknown) {
  runtimeEnv =
    env && typeof env === "object" ? (env as Record<string, unknown>) : {};
}

function loadLocalEnvOnce() {
  if (localEnvLoaded || typeof process === "undefined") return;
  localEnvLoaded = true;
  try {
    process.loadEnvFile?.(".env.local");
  } catch {
    // Optional in local development; hosted runtimes should provide secrets via env bindings.
  }
}

function env(name: string) {
  loadLocalEnvOnce();
  const runtimeValue = runtimeEnv[name];
  if (typeof runtimeValue === "string" && runtimeValue.length > 0) {
    return runtimeValue;
  }

  const processValue = typeof process !== "undefined" ? process.env[name] : undefined;
  const viteValue =
    typeof import.meta !== "undefined"
      ? (import.meta.env as Record<string, string | undefined>)[name]
      : undefined;
  return processValue ?? viteValue;
}

function daytonaClient() {
  const apiKey = env("DAYTONA_API_KEY");
  if (!apiKey) {
    throw new Error("DAYTONA_API_KEY is not configured");
  }

  return new Daytona({
    apiKey,
    apiUrl: env("DAYTONA_API_URL") ?? "https://app.daytona.io/api",
    target: env("DAYTONA_TARGET"),
  });
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function reportFor(task: string, sandbox: Sandbox) {
  return [
    "# Daytona AgentOps Result",
    "",
    `Sandbox: ${sandbox.id}`,
    `Agent: ${sandbox.agent}`,
    `Template: ${sandbox.template}`,
    "",
    "## Task",
    task,
    "",
    "## Worker Result",
    "The backend worker provisioned this Daytona sandbox, executed the task runner, and captured this report from inside the sandbox.",
    "",
  ].join("\n");
}

export async function provisionSandbox(
  sandbox: Sandbox,
  task: string,
): Promise<DaytonaExecutionHandle> {
  const daytona = daytonaClient();
  const remoteSandbox = await daytona.create(
    {
      name: sandbox.name,
      language: CodeLanguage.TYPESCRIPT,
      ephemeral: true,
      autoStopInterval: 5,
      autoDeleteInterval: 0,
      labels: {
        app: "daytona-agentops",
        jobId: sandbox.jobId,
        localSandboxId: sandbox.id,
        template: sandbox.template,
      },
      envVars: {
        AGENT_TASK: task,
        AGENT_TEMPLATE: sandbox.template,
        AGENT_NAME: sandbox.agent,
      },
    },
    { timeout: 120 },
  );

  return {
    sandbox: remoteSandbox,
    externalId: remoteSandbox.id,
  };
}

export async function runSandboxTask(
  handle: DaytonaExecutionHandle,
  task: string,
  sandbox: Sandbox,
): Promise<DaytonaRunResult> {
  const report = reportFor(task, sandbox);
  const workDir = (await handle.sandbox.getWorkDir()) ?? (await handle.sandbox.getUserHomeDir()) ?? ".";
  const outputDir = `${workDir.replace(/\/$/, "")}/daytona-agentops`;
  const command = [
    `mkdir -p ${shellQuote(outputDir)}`,
    `printf %s ${shellQuote(task)} > ${shellQuote(`${outputDir}/TASK.txt`)}`,
    `printf %s ${shellQuote(report)} > ${shellQuote(`${outputDir}/REPORT.md`)}`,
    "printf 'Daytona worker execution complete\\n'",
    `printf ${shellQuote(`Report: ${outputDir}/REPORT.md\n`)}`,
  ].join(" && ");

  const response = await handle.sandbox.process.executeCommand(command, workDir, undefined, 90);
  return {
    exitCode: response.exitCode ?? 0,
    output: response.result ?? response.artifacts?.stdout ?? "",
  };
}

export async function stopSandbox(handleOrId: DaytonaExecutionHandle | string) {
  if (typeof handleOrId !== "string") {
    await handleOrId.sandbox.stop(60, true);
    return;
  }

  const daytona = daytonaClient();
  const sandbox = await daytona.get(handleOrId);
  await sandbox.stop(60, true);
}
