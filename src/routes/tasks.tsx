import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAgentOps } from "@/lib/store";
import { USECASE_TEMPLATES } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Rocket, Zap } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/tasks")({
  head: () => ({ meta: [{ title: "Task Runner · Daytona" }] }),
  component: TaskRunner,
});

function TaskRunner() {
  const launchBatch = useAgentOps((s) => s.launchBatch);
  const jobs = useAgentOps((s) => s.jobs);
  const navigate = useNavigate();

  const [description, setDescription] = useState("Generate unit tests for parser.ts with edge cases");
  const [parallel, setParallel] = useState(5);
  const [template, setTemplate] = useState(USECASE_TEMPLATES[1]);

  function execute() {
    if (!description.trim()) {
      toast.error("Task description is required");
      return;
    }
    const jobId = launchBatch(description, parallel, template);
    toast.success(`Batch ${jobId} dispatched · ${parallel} sandboxes provisioning`);
    navigate({ to: "/sandboxes" });
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Async task runner</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Launch parallel agent sandboxes through the Daytona SDK and compare deterministic outputs.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 grid-bg">
        <div className="space-y-5">
          <div>
            <Label htmlFor="desc" className="text-xs uppercase tracking-widest text-muted-foreground">
              Task description
            </Label>
            <Textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="mt-2 font-mono text-sm bg-background/60 border-border resize-none"
              placeholder='e.g. "Refactor src/api/*.ts to use the new auth middleware"'
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="parallel" className="text-xs uppercase tracking-widest text-muted-foreground">
                Parallel sandboxes
              </Label>
              <Input
                id="parallel"
                type="number"
                min={1}
                max={20}
                value={parallel}
                onChange={(e) => setParallel(Math.max(1, Math.min(20, Number(e.target.value))))}
                className="mt-2 font-mono bg-background/60 border-border"
              />
              <p className="text-[11px] text-muted-foreground mt-1.5 font-mono">
                ≈ {(parallel * 0.18).toFixed(2)} cr/min estimated burn
              </p>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                Use-case template
              </Label>
              <div className="mt-2 grid grid-cols-1 gap-1.5">
                {USECASE_TEMPLATES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTemplate(t)}
                    className={`text-left text-xs font-mono px-3 py-2 rounded-md border transition-colors ${
                      template === t
                        ? "border-neon-purple/60 bg-neon-purple/10 text-foreground"
                        : "border-border bg-background/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-border flex items-center justify-between">
            <div className="text-xs text-muted-foreground font-mono">
              BullMQ queue · <span className="text-neon-blue">worker:agents</span> · concurrency 32
            </div>
            <Button
              onClick={execute}
              size="lg"
              className="bg-gradient-to-r from-neon-blue to-neon-purple text-background hover:opacity-90 glow-purple"
            >
              <Rocket className="size-4" /> Execute parallel run
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Zap className="size-4 text-neon-blue" />
          <h2 className="text-sm font-medium">Recent batch jobs</h2>
        </div>
        <div className="divide-y divide-border">
          {jobs.map((j) => (
            <div key={j.id} className="grid grid-cols-12 px-4 py-3 text-sm gap-2 items-center">
              <div className="col-span-3 font-mono text-xs">{j.id}</div>
              <div className="col-span-5 text-muted-foreground text-xs truncate">{j.description}</div>
              <div className="col-span-2 font-mono text-xs">{j.parallel}× {j.template}</div>
              <div className="col-span-2 text-right">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-mono">
                  <span className={`status-dot ${j.status === "running" ? "text-neon-blue" : "text-success"}`} />
                  {j.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
