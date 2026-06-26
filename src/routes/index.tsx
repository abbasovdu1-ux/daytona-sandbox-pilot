import { createFileRoute } from "@tanstack/react-router";
import { useAgentOps } from "@/lib/store";
import { CostAlertBanner } from "@/components/cost-alert-banner";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Boxes, Coins, CheckCircle2, Cpu, Rocket, ArrowUpRight } from "lucide-react";
import { formatRuntime } from "@/lib/mock-data";
import { StatusPill } from "@/components/status-pill";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard · Daytona Async Sandbox Manager" },
      { name: "description", content: "Overview of active AI agent sandboxes, costs, and resource usage." },
    ],
  }),
  component: Dashboard,
});

function Stat({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof Boxes;
  accent: "blue" | "purple" | "green" | "warn";
}) {
  const accentClass = {
    blue: "text-neon-blue",
    purple: "text-neon-purple",
    green: "text-success",
    warn: "text-warning",
  }[accent];
  return (
    <div className="rounded-lg border border-border bg-card p-4 relative overflow-hidden">
      <div className="absolute -right-6 -top-6 size-24 rounded-full opacity-10 blur-2xl"
           style={{ background: `var(--${accent === "blue" ? "neon-blue" : accent === "purple" ? "neon-purple" : accent === "green" ? "success" : "warning"})` }} />
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
        <Icon className={`size-4 ${accentClass}`} />
      </div>
      <div className="mt-3 font-mono text-2xl font-semibold">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Dashboard() {
  const { sandboxes, jobs } = useAgentOps();
  const active = sandboxes.filter((s) => s.status === "active");
  const completed = sandboxes.filter((s) => s.status === "completed");
  const failed = sandboxes.filter((s) => s.status === "failed");
  const totalCost = sandboxes.reduce((a, s) => a + s.costCredits, 0);
  const successRate =
    sandboxes.length > 0
      ? Math.round((completed.length / (completed.length + failed.length || 1)) * 100)
      : 0;
  const avgCpu = active.length
    ? Math.round(active.reduce((a, s) => a + s.cpu, 0) / active.length)
    : 0;
  const avgRam = active.length
    ? Math.round(active.reduce((a, s) => a + s.ram, 0) / active.length)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Operations overview</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">
            {jobs.length} batch job(s) · {sandboxes.length} sandboxes tracked
          </p>
        </div>
        <Button asChild className="bg-neon-blue text-background hover:opacity-90">
          <Link to="/tasks">
            <Rocket className="size-4" /> Launch new batch job
          </Link>
        </Button>
      </div>

      <CostAlertBanner />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Active sandboxes" value={String(active.length)} sub={`${sandboxes.length} total`} icon={Boxes} accent="blue" />
        <Stat label="Estimated cost" value={`${totalCost.toFixed(2)} cr`} sub="current session" icon={Coins} accent="warn" />
        <Stat label="Success rate" value={`${successRate}%`} sub={`${completed.length} passed · ${failed.length} failed`} icon={CheckCircle2} accent="green" />
        <Stat label="Avg resources" value={`${avgCpu}% / ${avgRam}%`} sub="CPU / RAM across active" icon={Cpu} accent="purple" />
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-medium">Recent sandboxes</h2>
          <Link to="/sandboxes" className="text-xs text-neon-blue inline-flex items-center gap-1 hover:underline">
            View all <ArrowUpRight className="size-3" />
          </Link>
        </div>
        <div className="divide-y divide-border">
          {sandboxes.slice(0, 6).map((s) => (
            <div key={s.id} className="grid grid-cols-12 gap-3 px-4 py-3 items-center text-sm">
              <div className="col-span-3 font-mono text-xs">{s.id}</div>
              <div className="col-span-3 text-muted-foreground text-xs">{s.agent} · {s.template}</div>
              <div className="col-span-2"><StatusPill status={s.status} /></div>
              <div className="col-span-2 font-mono text-xs text-muted-foreground">{formatRuntime(s.runtimeSec)}</div>
              <div className="col-span-2 text-right font-mono text-xs">{s.costCredits.toFixed(3)} cr</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
