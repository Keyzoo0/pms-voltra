"use client";

import { useState } from "react";
import { LogOut, Menu } from "lucide-react";
import { logout } from "@/app/login/actions";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { BrandMark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function Topbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md lg:px-8">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="icon-sm"
            className="lg:hidden"
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
          <AppSidebar onNavigate={() => setOpen(false)} />
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-2 lg:hidden">
        <BrandMark className="size-8" />
        <span className="text-sm font-semibold tracking-tight">Voltra PMS</span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <form action={logout}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Keluar</span>
          </Button>
        </form>
      </div>
    </header>
  );
}
