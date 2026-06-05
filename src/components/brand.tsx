import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.jpeg"
        alt="Voltra Techno"
        className="size-full object-contain p-1"
      />
    </span>
  );
}

export function BrandLockup({
  className,
  subtitle = "Project Management",
}: {
  className?: string;
  subtitle?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BrandMark className="size-9" />
      <div className="leading-tight">
        <p className="text-sm font-semibold tracking-tight">Voltra Techno</p>
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}
