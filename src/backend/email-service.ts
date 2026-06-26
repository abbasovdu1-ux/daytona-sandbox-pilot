export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailSendResult {
  ok: boolean;
  mode: "resend" | "outbox";
  message: string;
}

interface OutboxItem extends EmailMessage {
  id: string;
  createdAt: string;
}

let localEnvLoaded = false;
let runtimeEnv: Record<string, unknown> = {};
const outbox: OutboxItem[] = [];

export function setEmailRuntimeEnv(env: unknown) {
  runtimeEnv =
    env && typeof env === "object" ? (env as Record<string, unknown>) : {};
}

function loadLocalEnvOnce() {
  if (localEnvLoaded || typeof process === "undefined") return;
  localEnvLoaded = true;
  try {
    process.loadEnvFile?.(".env.local");
  } catch {
    // Local .env files are optional. Hosted runtimes should use env bindings.
  }
}

function env(name: string) {
  loadLocalEnvOnce();
  const runtimeValue = runtimeEnv[name];
  if (typeof runtimeValue === "string" && runtimeValue.length > 0) {
    return runtimeValue.trim();
  }

  return typeof process !== "undefined" ? process.env[name]?.trim() : undefined;
}

function isPlaceholder(value: string | undefined) {
  if (!value) return true;
  return value.includes("your_") || value.includes("your-domain.com");
}

function resendApiKey() {
  const apiKey = env("RESEND_API_KEY");
  return isPlaceholder(apiKey) ? undefined : apiKey;
}

function outboxResult(message: EmailMessage, reason: string): EmailSendResult {
  outbox.unshift({
    ...message,
    id: `mail_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  });
  outbox.splice(25);

  return {
    ok: true,
    mode: "outbox",
    message: `${reason}; stored in development outbox`,
  };
}

export function getEmailOutbox() {
  return outbox.map((item) => ({ ...item }));
}

export function isEmailConfigured() {
  return Boolean(resendApiKey());
}

export function defaultEmailFrom() {
  const from = env("ALERT_EMAIL_FROM");
  if (!from || from.includes("your-domain.com")) return "onboarding@resend.dev";
  return from;
}

export async function sendEmail(message: EmailMessage): Promise<EmailSendResult> {
  const apiKey = resendApiKey();
  const from = defaultEmailFrom();

  if (!apiKey) {
    return outboxResult(message, "RESEND_API_KEY is not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend failed (${response.status}): ${body}`);
  }

  return {
    ok: true,
    mode: "resend",
    message: "Email sent via Resend",
  };
}
