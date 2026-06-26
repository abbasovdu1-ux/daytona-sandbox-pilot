import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAgentOps } from "@/lib/store";
import { StatusPill } from "@/components/status-pill";
import { SandboxDetailModal } from "@/components/sandbox-detail-modal";
import { formatRuntime, type Sandbox } from "@/lib/mock-data";
import { Coins, Cpu, MemoryStick, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CostAlertBanner } from "@/components/cost-alert-banner";

export const Route = createFileRoute("/sandboxes")({
  head: () => ({
    meta: [{ title: "Sandbox Manager · Daytona" }],
  }),
  component: SandboxManager,
});

type Filter = "all" | "active" | "completed" | "failed" | "stopped";

function SandboxCard({ s, onOpen }: { s: Sandbox; onOpen: (s: Sandbox) => void }) {
  return (
    <button
      onClick={() => onOpen(s)}
      className="text-left rounded-lg border border-border bg-card hover:border-neon-blue/50 hover:bg-surface-elevated transition-all p-4 group"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-muted-foreground">{s.id}</span>
        <StatusPill status={s.status} />
      </div>
      <div className="mt-2 flex items-baseline justify-between">
        <h3 className="font-medium text-sm">{s.name}</h3>
        <span className="text-[10px] text-muted-foreground font-mono">{s.agent}</span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground truncate">{s.template}</div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-mono">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="size-3" /> {formatRuntime(s.runtimeSec)}
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground justify-end">
          <Coins className="size-3" /> {s.costCredits.toFixed(3)} cr
        </div>
        <div>
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="inline-flex items-center gap-1"><Cpu className="size-3" /> CPU</span>
            <span>{s.cpu}%</span>
          </div>
          <div className="h-1 rounded-full bg-surface-elevated overflow-hidden">
            <div className="h-full bg-neon-blue" style={{ width: `${s.cpu}%` }} />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="inline-flex items-center gap-1"><MemoryStick className="size-3" /> RAM</span>
            <span>{s.ram}%</span>
          </div>
          <div className="h-1 rounded-full bg-surface-elevated overflow-hidden">
            <div className="h-full bg-neon-purple" style={{ width: `${s.ram}%` }} />
          </div>
        </div>
      </div>
    </button>
  );
}

function ResultSummary() {
  const { sandboxes, jobs, cleanupJob } = useAgentOps();
  const batchJob = jobs.find((j) => j.status === "running") ?? jobs[0];
  if (!batchJob) return null;
  const members = sandboxes.filter((s) => s.jobId === batchJob.id && s.testsTotal);
  if (members.length < 2) return null;

  const best = [...members].sort((a, b) => {
    const aScore = (a.testsPassed ?? 0) / (a.testsTotal ?? 1);
    const bScore = (b.testsPassed ?? 0) / (b.testsTotal ?? 1);
    if (bScore !== aScore) return bScore - aScore;
    return a.runtimeSec - b.runtimeSec;
  })[0];

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <h2 className="text-sm font-medium">Batch result · <span className="font-mono text-xs text-muted-foreground">{batchJob.id}</span></h2>
          <p className="text-xs text-muted-foreground mt-0.5">{batchJob.description}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => cleanupJob(batchJob.id)}
          className="border-warning/40 text-warning hover:bg-warning/10 hover:text-warning"
        >
          Clean up idle sandboxes
        </Button>
      </div>
      <div className="p-4">
        <div className="rounded-md border border-success/40 bg-success/10 px-3 py-2 mb-3 text-sm">
          <span className="font-medium">Best result · {best.name}</span>
          <span className="text-muted-foreground font-mono text-xs ml-2">
            passed {best.testsPassed}/{best.testsTotal} in {formatRuntime(best.runtimeSec)} · {best.agent}
          </span>
        </div>
        <div className="grid grid-cols-12 text-xs uppercase tracking-widest text-muted-foreground border-b border-border pb-2">
          <div className="col-span-3">Agent</div>
          <div className="col-span-3">Model</div>
          <div className="col-span-2">Tests</div>
          <div className="col-span-2">Runtime</div>
          <div className="col-span-2 text-right">Cost</div>
        </div>
        {members.map((m) => {
          const isBest = m.id === best.id;
          return (
            <div key={m.id} className={`grid grid-cols-12 py-2 text-sm border-b border-border last:border-0 ${isBest ? "bg-success/5" : ""}`}>
              <div className="col-span-3 font-mono text-xs flex items-center gap-2">
                {isBest && <span className="status-dot text-success" />}
                {m.name}
              </div>
              <div className="col-span-3 text-muted-foreground text-xs">{m.agent}</div>
              <div className="col-span-2 font-mono text-xs">{m.testsPassed}/{m.testsTotal}</div>
              <div className="col-span-2 font-mono text-xs text-muted-foreground">{formatRuntime(m.runtimeSec)}</div>
              <div className="col-span-2 text-right font-mono text-xs">{m.costCredits.toFixed(3)} cr</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SandboxManager() {
  const sandboxes = useAgentOps((s) => s.sandboxes);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Sandbox | null>(null);

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "completed", label: "Completed" },
    { key: "failed", label: "Failed" },
    { key: "stopped", label: "Stopped" },
  ];

  const visible = filter === "all" ? sandboxes : sandboxes.filter((s) => s.status === filter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sandbox manager</h1>
        <p className="text-sm text-muted-foreground mt-1">Live view of every Daytona environment provisioned this session.</p>
      </div>

      <CostAlertBanner />

      <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-1 w-fit">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 text-xs rounded-sm transition-colors ${
              filter === f.key ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
            <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">
              {f.key === "all" ? sandboxes.length : sandboxes.filter((s) => s.status === f.key).length}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {visible.map((s) => (
          <SandboxCard key={s.id} s={s} onOpen={setSelected} />
        ))}
      </div>

      <ResultSummary />

      <SandboxDetailModal
        sandbox={selected}
        open={!!selected}
        onOpenChange={(b) => !b && setSelected(null)}
      />
    </div>
  );
}
