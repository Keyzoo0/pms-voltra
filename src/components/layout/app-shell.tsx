"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";

const STORAGE_KEY = "voltra_sidebar_collapsed";

export function AppShell({
  role,
  name,
  children,
}: {
  role: "admin" | "employee";
  name: string;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <div className="min-h-screen">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r border-sidebar-border transition-[width] duration-200 lg:block",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <AppSidebar role={role} name={name} collapsed={collapsed} onToggleCollapse={toggle} />
      </aside>

      <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-16" : "lg:pl-64")}>
        <Topbar role={role} name={name} />
        <main className="px-4 py-5 lg:px-6 lg:py-6">
          <div className="mx-auto w-full max-w-7xl animate-in fade-in-50 duration-300">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
