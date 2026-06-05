import { cn } from "@/lib/utils";

type Meta = { label: string; badge: string; dot: string };

export function StatusBadge({
  meta,
  className,
  showDot = true,
}: {
  meta: Meta;
  className?: string;
  showDot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap",
        meta.badge,
        className,
      )}
    >
      {showDot && (
        <span className={cn("size-1.5 rounded-full", meta.dot)} aria-hidden />
      )}
      {meta.label}
    </span>
  );
}
