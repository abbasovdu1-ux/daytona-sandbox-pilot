import { useAgentOps } from "@/lib/store";
import { AlertTriangle } from "lucide-react";

export function CostAlertBanner() {
  const { sandboxes, costAlertThreshold, runtimeAlertSec } = useAgentOps();
  const totalCost = sandboxes.reduce((a, s) => a + s.costCredits, 0);
  const longRunning = sandboxes.filter(
    (s) => s.status === "active" && s.runtimeSec > runtimeAlertSec
  );
  const overBudget = totalCost > costAlertThreshold;
  if (!overBudget && longRunning.length === 0) return null;

  return (
    <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 flex items-start gap-3">
      <AlertTriangle className="size-4 text-warning mt-0.5 shrink-0" />
      <div className="text-sm">
        <div className="font-medium text-foreground">Cost & runtime alert</div>
        <div className="text-muted-foreground font-mono text-xs mt-0.5">
          {overBudget && (
            <span>
              Spend {totalCost.toFixed(2)} cr · threshold {costAlertThreshold} cr
            </span>
          )}
          {overBudget && longRunning.length > 0 && " · "}
          {longRunning.length > 0 && (
            <span>
              {longRunning.length} sandbox(es) over {Math.round(runtimeAlertSec / 60)}m runtime
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
