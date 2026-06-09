"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Mobile-only top bar: hamburger (opens the nav drawer) + brand. On desktop
 * the sidebar carries everything (nav, theme, logout), so no top bar at all.
 */
export function Topbar({
  role,
  name,
}: {
  role: "admin" | "employee";
  name: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md lg:hidden">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Buka menu"
          >
            <Menu />
          </Button>
        </DialogTrigger>
        <DialogContent
          showClose={false}
          className="left-0 top-0 h-full max-w-[16rem] translate-x-0 translate-y-0 gap-0 rounded-none border-y-0 border-l-0 p-0 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-[16rem]"
        >
          <DialogTitle className="sr-only">Navigasi</DialogTitle>
          <AppSidebar role={role} name={name} onNavigate={() => setOpen(false)} />
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-2">
        <BrandMark className="size-8" />
        <span className="text-sm font-semibold tracking-tight">Voltra PMS</span>
      </div>
    </header>
  );
}
