import { createFileRoute } from "@tanstack/react-router";
import { useAgentOps } from "@/lib/store";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Mail, Send } from "lucide-react";

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
  const {
    costAlertThreshold,
    runtimeAlertSec,
    autoCleanupSec,
    emailAlertsEnabled,
    emailRecipient,
    emailFrom,
    emailProviderConfigured,
    emailOutbox,
    lastEmailStatus,
    saveSettings,
    sendTestEmail,
  } = useAgentOps();
  const [cost, setCost] = useState(costAlertThreshold);
  const [runtime, setRuntime] = useState(Math.round(runtimeAlertSec / 60));
  const [cleanup, setCleanup] = useState(Math.round(autoCleanupSec / 60));
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(emailAlertsEnabled);
  const [recipient, setRecipient] = useState(emailRecipient);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setCost(costAlertThreshold);
    setRuntime(Math.round(runtimeAlertSec / 60));
    setCleanup(Math.round(autoCleanupSec / 60));
    setEmailAlerts(emailAlertsEnabled);
    setRecipient(emailRecipient);
  }, [autoCleanupSec, costAlertThreshold, emailAlertsEnabled, emailRecipient, runtimeAlertSec]);

  async function save() {
    setSaving(true);
    try {
      await saveSettings({
        costAlertThreshold: cost,
        runtimeAlertSec: runtime * 60,
        autoCleanupSec: cleanup * 60,
        emailAlertsEnabled: emailAlerts,
        emailRecipient: recipient,
      });
      toast.success("Settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Settings save failed");
    } finally {
      setSaving(false);
    }
  }

  async function testEmail() {
    setTesting(true);
    try {
      await saveSettings({
        costAlertThreshold: cost,
        runtimeAlertSec: runtime * 60,
        autoCleanupSec: cleanup * 60,
        emailAlertsEnabled: emailAlerts,
        emailRecipient: recipient,
      });
      await sendTestEmail();
      toast.success(emailProviderConfigured ? "Test email sent" : "Test email saved to outbox");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Test email failed");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure cost alerts and auto-cleanup thresholds.</p>
      </div>

      <Section title="Cost alerts" desc="Warn when accumulated spend crosses a credit ceiling.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <div className="flex items-center justify-between rounded-md border border-border bg-background/40 px-3 py-2">
            <div>
              <div className="text-sm inline-flex items-center gap-2">
                <Mail className="size-4 text-neon-blue" />
                Email alerts
              </div>
              <div className="text-xs text-muted-foreground">Notify on every breach</div>
            </div>
            <Switch checked={emailAlerts} onCheckedChange={setEmailAlerts} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <Label htmlFor="email" className="text-xs uppercase tracking-widest text-muted-foreground">
              Alert recipient
            </Label>
            <Input
              id="email"
              type="email"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="ops@example.com"
              className="mt-2 font-mono bg-background/60 border-border"
              disabled={!emailAlerts}
            />
            <p className="text-[11px] text-muted-foreground mt-1.5 font-mono">
              From {emailFrom} · {emailProviderConfigured ? "Resend configured" : "dev outbox mode"}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={testEmail}
            disabled={!emailAlerts || !recipient || testing}
            className="border-neon-blue/40 text-neon-blue hover:bg-neon-blue/10 hover:text-neon-blue"
          >
            <Send className="size-4" />
            {testing ? "Sending..." : "Send test"}
          </Button>
        </div>
        {(lastEmailStatus || emailOutbox.length > 0) && (
          <div className="rounded-md border border-border bg-background/40 px-3 py-2 text-xs font-mono text-muted-foreground">
            {lastEmailStatus ?? `Outbox has ${emailOutbox.length} message(s)`}
          </div>
        )}
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
        <Button onClick={save} disabled={saving} className="bg-neon-blue text-background hover:opacity-90">
          {saving ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
