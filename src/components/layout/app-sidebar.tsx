"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Building2,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  Settings,
  Sparkles,
  Sun,
  User,
  Users,
  Wallet,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { BrandMark } from "@/components/brand";
import { logout } from "@/app/login/actions";

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

      <div className={cn("border-t border-sidebar-border", collapsed ? "p-2" : "p-3")}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-1">
            <SidebarThemeButton collapsed />
            <form action={logout} className="w-full">
              <button
                type="submit"
                title="Keluar"
                aria-label="Keluar"
                className="flex w-full items-center justify-center rounded-lg p-2 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/60 hover:text-white"
              >
                <LogOut className="size-[18px]" />
              </button>
            </form>
            <span
              className="mt-1 flex size-8 items-center justify-center rounded-full bg-sidebar-primary/20 text-xs font-semibold text-sidebar-primary"
              title={name}
            >
              {initials(name) || "U"}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-sidebar-accent/50 px-2.5 py-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/20 text-xs font-semibold text-sidebar-primary">
              {initials(name) || "U"}
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-xs font-medium text-white">{name}</p>
              <p className="truncate text-[11px] text-sidebar-foreground/50">
                {role === "admin" ? "Administrator" : "Karyawan"}
              </p>
            </div>
            <SidebarThemeButton />
            <form action={logout}>
              <button
                type="submit"
                title="Keluar"
                aria-label="Keluar"
                className="rounded-md p-1.5 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-white"
              >
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

function SidebarThemeButton({ collapsed = false }: { collapsed?: boolean }) {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title="Ganti tema"
      aria-label="Ganti tema terang/gelap"
      className={cn(
        "rounded-md text-sidebar-foreground/60 transition-colors hover:text-white",
        collapsed
          ? "flex w-full items-center justify-center p-2 hover:bg-sidebar-accent/60"
          : "p-1.5 hover:bg-sidebar-accent",
      )}
    >
      {isDark ? (
        <Sun className={collapsed ? "size-[18px]" : "size-4"} />
      ) : (
        <Moon className={collapsed ? "size-[18px]" : "size-4"} />
      )}
    </button>
  );
}
