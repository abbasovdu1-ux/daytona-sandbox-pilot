import type { SandboxStatus } from "@/lib/mock-data";

const COLOR: Record<SandboxStatus, string> = {
  active: "text-neon-blue",
  completed: "text-success",
  failed: "text-destructive",
  stopped: "text-muted-foreground",
};

const LABEL: Record<SandboxStatus, string> = {
  active: "Active",
  completed: "Completed",
  failed: "Failed",
  stopped: "Stopped",
};

export function StatusPill({ status }: { status: SandboxStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-2 py-0.5 text-[11px] font-mono">
      <span className={`status-dot ${COLOR[status]}`} />
      <span className="text-foreground">{LABEL[status]}</span>
    </span>
  );
}
