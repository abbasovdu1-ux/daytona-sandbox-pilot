import { createFileRoute } from "@tanstack/react-router";
import { useAgentOps } from "@/lib/store";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings · Daytona" }] }),
  component: Settings,
});

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-sm font-medium">{title}</h2>
      <p className="text-xs text-muted-foreground mt-1">{desc}</p>
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

function Settings() {
  const { costAlertThreshold, runtimeAlertSec, autoCleanupSec, setCostThreshold, setRuntimeAlert, setAutoCleanup } = useAgentOps();
  const [cost, setCost] = useState(costAlertThreshold);
  const [runtime, setRuntime] = useState(Math.round(runtimeAlertSec / 60));
  const [cleanup, setCleanup] = useState(Math.round(autoCleanupSec / 60));
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(true);

  function save() {
    setCostThreshold(cost);
    setRuntimeAlert(runtime * 60);
    setAutoCleanup(cleanup * 60);
    toast.success("Settings saved");
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure cost alerts and auto-cleanup thresholds.</p>
      </div>

      <Section title="Cost alerts" desc="Warn when accumulated spend crosses a credit ceiling.">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="cost" className="text-xs uppercase tracking-widest text-muted-foreground">
              Threshold (credits)
            </Label>
            <Input
              id="cost"
              type="number"
              value={cost}
              onChange={(e) => setCost(Number(e.target.value))}
              className="mt-2 font-mono bg-background/60 border-border"
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border bg-background/40 px-3">
            <div>
              <div className="text-sm">Email alerts</div>
              <div className="text-xs text-muted-foreground">Notify on every breach</div>
            </div>
            <Switch checked={emailAlerts} onCheckedChange={setEmailAlerts} />
          </div>
        </div>
      </Section>

      <Section title="Runtime alerts" desc="Flag any sandbox running longer than this duration.">
        <div>
          <Label htmlFor="runtime" className="text-xs uppercase tracking-widest text-muted-foreground">
            Max runtime (minutes)
          </Label>
          <Input
            id="runtime"
            type="number"
            value={runtime}
            onChange={(e) => setRuntime(Number(e.target.value))}
            className="mt-2 font-mono bg-background/60 border-border w-48"
          />
        </div>
      </Section>

      <Section title="Auto-cleanup" desc="Automatically stop idle sandboxes past this age.">
        <div className="flex items-center justify-between rounded-md border border-border bg-background/40 px-3 py-2">
          <div>
            <div className="text-sm">Enable auto-cleanup</div>
            <div className="text-xs text-muted-foreground">Daytona SDK will issue stop() calls</div>
          </div>
          <Switch checked={autoEnabled} onCheckedChange={setAutoEnabled} />
        </div>
        <div>
          <Label htmlFor="cleanup" className="text-xs uppercase tracking-widest text-muted-foreground">
            Idle threshold (minutes)
          </Label>
          <Input
            id="cleanup"
            type="number"
            value={cleanup}
            onChange={(e) => setCleanup(Number(e.target.value))}
            className="mt-2 font-mono bg-background/60 border-border w-48"
            disabled={!autoEnabled}
          />
        </div>
      </Section>

      <div className="flex justify-end">
        <Button onClick={save} className="bg-neon-blue text-background hover:opacity-90">
          Save changes
        </Button>
      </div>
    </div>
  );
}
