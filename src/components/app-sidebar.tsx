import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Boxes,
  Rocket,
  Settings as SettingsIcon,
  Terminal,
} from "lucide-react";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/sandboxes", label: "Sandbox Manager", icon: Boxes },
  { to: "/tasks", label: "Task Runner", icon: Rocket },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2 px-5 h-14 border-b border-border">
        <div className="size-7 rounded-md bg-gradient-to-br from-neon-blue to-neon-purple grid place-items-center">
          <Terminal className="size-4 text-background" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight">Daytona</span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Async Sandbox
          </span>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {nav.map((item) => {
          const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-accent text-foreground border border-border"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-elevated"
              }`}
            >
              <Icon className="size-4" />
              {item.label}
              {active && (
                <span className="ml-auto status-dot text-neon-blue" aria-hidden />
              )}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-border">
        <div className="rounded-md border border-border bg-background/40 p-3 text-xs">
          <div className="flex items-center gap-2 mb-1">
            <span className="status-dot text-success" />
            <span className="text-muted-foreground">Daytona SDK</span>
          </div>
          <div className="font-mono text-foreground">connected · us-west-2</div>
        </div>
      </div>
    </aside>
  );
}
