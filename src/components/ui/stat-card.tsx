import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  accent = "primary",
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  hint?: React.ReactNode;
  accent?: "primary" | "emerald" | "amber" | "rose" | "sky" | "violet";
  className?: string;
}) {
  const accents: Record<string, string> = {
    primary:
      "bg-primary/10 text-primary ring-primary/15",
    emerald:
      "bg-emerald-500/10 text-emerald-600 ring-emerald-500/15 dark:text-emerald-400",
    amber:
      "bg-amber-500/10 text-amber-600 ring-amber-500/15 dark:text-amber-400",
    rose: "bg-rose-500/10 text-rose-600 ring-rose-500/15 dark:text-rose-400",
    sky: "bg-sky-500/10 text-sky-600 ring-sky-500/15 dark:text-sky-400",
    violet:
      "bg-violet-500/10 text-violet-600 ring-violet-500/15 dark:text-violet-400",
  };

  return (
    <Card className={cn("p-4 sm:p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 truncate text-xl font-semibold tracking-tight text-foreground tabular-nums sm:text-2xl">
            {value}
          </p>
          {hint && (
            <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
          )}
        </div>
        {Icon && (
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset sm:size-10",
              accents[accent],
            )}
          >
            <Icon className="size-4.5 sm:size-5" />
          </div>
        )}
      </div>
    </Card>
  );
}
