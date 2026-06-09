"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  FolderKanban,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
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
  collapsed = false,
  onToggleCollapse,
}: {
  role: "admin" | "employee";
  name?: string;
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const pathname = usePathname();
  const nav = role === "admin" ? ADMIN_NAV : EMPLOYEE_NAV;

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div
        className={cn(
          "flex h-16 items-center border-b border-sidebar-border",
          collapsed ? "justify-center px-2" : "gap-2.5 px-5",
        )}
      >
        <BrandMark className="size-9 shrink-0" />
        {!collapsed && (
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-semibold tracking-tight text-white">Voltra Techno</p>
            <p className="text-[11px] text-sidebar-foreground/60">Project Management</p>
          </div>
        )}
        {!collapsed && onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Ciutkan menu"
            aria-label="Ciutkan menu"
            className="rounded-md p-1 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/60 hover:text-white"
          >
            <PanelLeftClose className="size-[18px]" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {!collapsed && (
          <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/40">
            Menu
          </p>
        )}
        {collapsed && onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Lebarkan menu"
            aria-label="Lebarkan menu"
            className="mb-1 flex w-full items-center justify-center rounded-lg p-2 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/60 hover:text-white"
          >
            <PanelLeftOpen className="size-[18px]" />
          </button>
        )}
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
              title={collapsed ? item.label : undefined}
              className={cn(
                "group flex items-center rounded-lg text-sm font-medium transition-colors",
                collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon
                className={cn(
                  "size-[18px] shrink-0 transition-colors",
                  active ? "text-sidebar-primary" : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground",
                )}
              />
              {!collapsed && item.label}
              {!collapsed && active && <span className="ml-auto size-1.5 rounded-full bg-sidebar-primary" />}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div
          className={cn(
            "flex items-center rounded-lg bg-sidebar-accent/50",
            collapsed ? "justify-center p-1.5" : "gap-2.5 px-3 py-2.5",
          )}
        >
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/20 text-xs font-semibold text-sidebar-primary"
            title={collapsed ? name : undefined}
          >
            {initials(name) || "U"}
          </span>
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <p className="truncate text-xs font-medium text-white">{name}</p>
              <p className="truncate text-[11px] text-sidebar-foreground/50">
                {role === "admin" ? "Administrator" : "Karyawan"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
