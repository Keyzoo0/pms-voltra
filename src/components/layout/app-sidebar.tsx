"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  FolderKanban,
  LayoutDashboard,
  ReceiptText,
  Settings,
  Sparkles,
  User,
  Users,
  Wallet,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { BrandMark } from "@/components/brand";

const ADMIN_NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assistant", label: "AI Assistant", icon: Sparkles },
  { href: "/projects", label: "Proyek", icon: FolderKanban },
  { href: "/employees", label: "Karyawan", icon: Users },
  { href: "/clients", label: "Klien", icon: Building2 },
  { href: "/finance", label: "Keuangan", icon: Wallet },
  { href: "/fees", label: "Rekap Fee", icon: ReceiptText },
  { href: "/settings", label: "Pengaturan", icon: Settings },
] as const;

const EMPLOYEE_NAV = [
  { href: "/projects", label: "Proyek Saya", icon: FolderKanban },
  { href: "/me", label: "Profil Saya", icon: User },
] as const;

export function AppSidebar({
  role,
  name = "Owner",
  onNavigate,
}: {
  role: "admin" | "employee";
  name?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const nav = role === "admin" ? ADMIN_NAV : EMPLOYEE_NAV;

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-5">
        <BrandMark className="size-9" />
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight text-white">Voltra Techno</p>
          <p className="text-[11px] text-sidebar-foreground/60">Project Management</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/40">
          Menu
        </p>
        {nav.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon
                className={cn(
                  "size-[18px] shrink-0 transition-colors",
                  active
                    ? "text-sidebar-primary"
                    : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground",
                )}
              />
              {item.label}
              {active && <span className="ml-auto size-1.5 rounded-full bg-sidebar-primary" />}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-2.5 rounded-lg bg-sidebar-accent/50 px-3 py-2.5">
          <span className="flex size-8 items-center justify-center rounded-full bg-sidebar-primary/20 text-xs font-semibold text-sidebar-primary">
            {initials(name) || "U"}
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-xs font-medium text-white">{name}</p>
            <p className="truncate text-[11px] text-sidebar-foreground/50">
              {role === "admin" ? "Administrator" : "Karyawan"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
