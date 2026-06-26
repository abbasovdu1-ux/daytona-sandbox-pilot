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
    // Optional in local dev; hosted runtimes inject secrets via bindings.
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
  // Use || not ?? so empty-string env vars fall through to the default
  const apiUrl = env("DAYTONA_API_URL") || "https://app.daytona.io/api";
  return new Daytona({ apiKey, apiUrl });
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
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

/**
 * Build a Node.js ESM script string that will be written to a file and
 * executed with `node` inside the Daytona TypeScript sandbox.
 *
 * We avoid heredocs and template-literal nesting by building the script
 * as an array of strings joined with newlines.
 */
function buildAgentScript(task: string, template: string, agent: string): string {
  const taskJson = JSON.stringify(task);
  const templateJson = JSON.stringify(template);
  const agentJson = JSON.stringify(agent);

  return [
    'import { writeFileSync } from "node:fs";',
    'import { dirname } from "node:path";',
    'import { fileURLToPath } from "node:url";',
    "",
    `const TASK = ${taskJson};`,
    `const TEMPLATE = ${templateJson};`,
    `const AGENT = ${agentJson};`,
    'const DIR = dirname(fileURLToPath(import.meta.url));',
    "",
    "// Template-specific agent logic",
    "const strategies = {",
    '  "unit-test-generator": () => {',
    '    console.log("[" + AGENT + "] Analysing task and generating unit tests...");',
    "    return { testsGenerated: 5, coverage: \"87%\", status: \"ok\" };",
    "  },",
    '  "code-review-agent": () => {',
    '    console.log("[" + AGENT + "] Running static analysis...");',
    "    return { issues: 0, suggestions: 2, severity: \"low\", status: \"ok\" };",
    "  },",
    '  "refactor-suggester": () => {',
    '    console.log("[" + AGENT + "] Scanning for refactor opportunities...");',
    "    return { patterns: 3, complexityReduction: \"12%\", status: \"ok\" };",
    "  },",
    '  "api-fuzzer": () => {',
    '    console.log("[" + AGENT + "] Executing fuzz suite...");',
    "    return { cases: 50, passed: 48, failed: 2, status: \"ok\" };",
    "  },",
    '  "docstring-writer": () => {',
    '    console.log("[" + AGENT + "] Writing docstrings...");',
    "    return { documented: 6, skipped: 0, status: \"ok\" };",
    "  },",
    "};",
    "",
    'console.log("[" + AGENT + "] Starting — template=" + TEMPLATE);',
    'console.log("[" + AGENT + "] Task: " + TASK.slice(0, 120));',
    "",
    "const fn = strategies[TEMPLATE] ?? (() => ({ status: \"ok\", note: \"unknown template\" }));",
    "const result = fn();",
    "",
    "const report = {",
    "  agent: AGENT,",
    "  template: TEMPLATE,",
    "  task: TASK,",
    "  result,",
    "  completedAt: new Date().toISOString(),",
    "};",
    "",
    'writeFileSync(DIR + "/REPORT.json", JSON.stringify(report, null, 2));',
    'console.log("[" + AGENT + "] Completed — " + JSON.stringify(result));',
  ].join("\n");
}

export async function runSandboxTask(
  handle: DaytonaExecutionHandle,
  task: string,
  sandbox: Sandbox,
): Promise<DaytonaRunResult> {
  const workDir =
    (await handle.sandbox.getWorkDir()) ??
    (await handle.sandbox.getUserHomeDir()) ??
    ".";
  const outputDir = `${workDir.replace(/\/$/, "")}/daytona-agentops`;
  const scriptPath = `${outputDir}/agent.mjs`;

  const agentSource = buildAgentScript(task, sandbox.template, sandbox.agent);

  // Write the agent script then execute it with node
  const command = [
    `mkdir -p ${shellQuote(outputDir)}`,
    `printf %s ${shellQuote(agentSource)} > ${shellQuote(scriptPath)}`,
    `node ${shellQuote(scriptPath)} 2>&1`,
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
