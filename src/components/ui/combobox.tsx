"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type ComboboxOption = { value: string; label: string };

/**
 * Dependency-free searchable select: a Select-styled trigger that opens a panel
 * with a search box + filtered, keyboard-navigable list. The chosen value is
 * controlled; pair with a hidden input to submit inside a <form>.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Pilih…",
  searchPlaceholder = "Cari…",
  emptyText = "Tidak ada hasil.",
  className,
  id,
  disabled,
}: {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const activeRef = React.useRef<HTMLButtonElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  // Close on outside click.
  React.useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // On open: reset search and focus it.
  React.useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  React.useEffect(() => setActive(0), [query]);

  // Keep the highlighted option in view.
  React.useEffect(() => {
    if (open) activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function choose(opt: ComboboxOption) {
    onChange(opt.value);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[active];
      if (opt) choose(opt);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9.5 w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs transition-colors outline-none",
          "focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/25",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <span
          className={cn(
            "line-clamp-1 text-left",
            !selected && "text-muted-foreground/70",
          )}
        >
          {selected ? selected.label : placeholder}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg shadow-slate-900/10",
            "animate-in fade-in-0 zoom-in-95",
          )}
        >
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="size-4 shrink-0 text-muted-foreground/70" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1" role="listbox">
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {emptyText}
              </p>
            ) : (
              filtered.map((o, i) => (
                <button
                  type="button"
                  key={o.value}
                  ref={i === active ? activeRef : undefined}
                  role="option"
                  aria-selected={o.value === value}
                  onClick={() => choose(o)}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    "relative flex w-full cursor-pointer items-center rounded-md py-1.5 pr-8 pl-2.5 text-left text-sm outline-none select-none",
                    i === active && "bg-accent text-accent-foreground",
                    o.value === value && "font-medium",
                  )}
                >
                  <span className="line-clamp-1">{o.label}</span>
                  {o.value === value && (
                    <Check className="absolute right-2 size-4 text-primary" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
