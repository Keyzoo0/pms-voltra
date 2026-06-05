"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Option = { id: string; name: string };

export function MultiChipField({
  name,
  options,
  initial,
  emptyText = "Belum ada pilihan.",
}: {
  name: string;
  options: Option[];
  initial?: string[];
  emptyText?: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initial ?? []),
  );

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  if (options.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <>
      {[...selected].map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = selected.has(o.id);
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => toggle(o.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {o.name}
            </button>
          );
        })}
      </div>
    </>
  );
}
