import { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAgentOps } from "@/lib/store";
import { formatRuntime, type Sandbox } from "@/lib/mock-data";
import { StatusPill } from "./status-pill";
import { Button } from "@/components/ui/button";
import { Square, Cpu, MemoryStick, Coins, Clock } from "lucide-react";

function Gauge({ label, value, icon: Icon, accent }: { label: string; value: number; icon: typeof Cpu; accent: string }) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Icon className="size-3.5" /> {label}
        </span>
        <span className="font-mono text-foreground">{value}%</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-surface-elevated overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${value}%`, background: `var(--${accent})` }}
        />
      </div>
    </div>
  );
}

export function SandboxDetailModal({
  sandbox,
  open,
  onOpenChange,
}: {
  sandbox: Sandbox | null;
  open: boolean;
  onOpenChange: (b: boolean) => void;
}) {
  const logs = useAgentOps((s) => (sandbox ? s.logs[sandbox.id] : undefined));
  const stopSandbox = useAgentOps((s) => s.stopSandbox);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    terminalRef.current?.scrollTo({ top: terminalRef.current.scrollHeight });
  }, [logs?.length]);

  if (!sandbox) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="font-mono text-sm">{sandbox.id}</span>
            <StatusPill status={sandbox.status} />
            <span className="text-xs text-muted-foreground font-normal">
              {sandbox.agent} · {sandbox.template}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
          <Gauge label="CPU" value={sandbox.cpu} icon={Cpu} accent="neon-blue" />
          <Gauge label="RAM" value={sandbox.ram} icon={MemoryStick} accent="neon-purple" />
          <div className="rounded-md border border-border bg-background/40 p-3">
            <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
              <Clock className="size-3.5" /> Runtime
            </div>
            <div className="mt-1 font-mono text-sm">{formatRuntime(sandbox.runtimeSec)}</div>
          </div>
          <div className="rounded-md border border-border bg-background/40 p-3">
            <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
              <Coins className="size-3.5" /> Cost
            </div>
            <div className="mt-1 font-mono text-sm">{sandbox.costCredits.toFixed(3)} cr</div>
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              Live stream · agent stdout
            </span>
            <span className="text-[10px] font-mono text-neon-blue inline-flex items-center gap-1.5">
              <span className="status-dot text-neon-blue" /> streaming
            </span>
          </div>
          <div
            ref={terminalRef}
            className="h-72 overflow-y-auto rounded-md border border-border bg-background p-3 font-mono text-xs leading-relaxed"
          >
            {logs?.map((l, i) => (
              <div key={i} className="flex gap-3">
                <span className="text-muted-foreground">{l.ts}</span>
                <span
                  className={
                    l.level === "error"
                      ? "text-destructive"
                      : l.level === "warn"
                      ? "text-warning"
                      : l.level === "debug"
                      ? "text-muted-foreground"
                      : "text-foreground"
                  }
                >
                  {l.msg}
                </span>
              </div>
            ))}
            {sandbox.status === "active" && (
              <div className="text-neon-blue animate-pulse">▍</div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-2">
          {sandbox.status === "active" && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                stopSandbox(sandbox.id);
                onOpenChange(false);
              }}
            >
              <Square className="size-3.5" /> Stop sandbox
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
