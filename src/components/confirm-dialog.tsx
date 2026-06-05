"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Variant = "destructive" | "default";

function ConfirmSubmit({
  label,
  variant,
  icon,
}: {
  label: string;
  variant: Variant;
  icon: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : icon}
      {label}
    </Button>
  );
}

export function ConfirmDialog({
  action,
  title,
  description,
  confirmLabel = "Hapus",
  trigger,
  variant = "destructive",
  icon,
}: {
  action: () => void | Promise<void>;
  title: string;
  description?: string;
  confirmLabel?: string;
  trigger: React.ReactNode;
  variant?: Variant;
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Batal</Button>
          </DialogClose>
          <form action={action}>
            <ConfirmSubmit
              label={confirmLabel}
              variant={variant}
              icon={icon ?? <Trash2 />}
            />
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
