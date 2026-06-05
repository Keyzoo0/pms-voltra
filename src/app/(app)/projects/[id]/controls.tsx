"use client";

import * as React from "react";
import { Loader2, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import {
  addAssignment,
  addCost,
  addItem,
  addPaymentTerm,
  setProjectProgress,
  setProjectStatus,
  type FormState,
} from "../actions";
import {
  ITEM_SOURCE_OPTIONS,
  PROJECT_STATUS_OPTIONS,
  PURCHASE_STATUS_OPTIONS,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Option = { id: string; name: string };
type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

function FormDialog({
  triggerLabel,
  title,
  description,
  action,
  successMessage,
  children,
}: {
  triggerLabel: string;
  title: string;
  description?: string;
  action: Action;
  successMessage: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = React.useActionState<FormState, FormData>(
    action,
    {},
  );
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (state.ok) {
      setOpen(false);
      toast.success(successMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {children}
          {state.error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Batal
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Save />}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function StatusControl({
  projectId,
  status,
}: {
  projectId: string;
  status: string;
}) {
  const [pending, start] = React.useTransition();
  return (
    <div className="flex items-center gap-2">
      <Select
        value={status}
        onValueChange={(v) =>
          start(async () => {
            await setProjectStatus(projectId, v);
            toast.success("Status diperbarui.");
          })
        }
      >
        <SelectTrigger size="sm" className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PROJECT_STATUS_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
    </div>
  );
}

export function ProgressControl({
  projectId,
  progress,
}: {
  projectId: string;
  progress: number;
}) {
  const [val, setVal] = React.useState(progress);
  const [pending, start] = React.useTransition();
  const changed = val !== progress;

  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={0}
        max={100}
        value={val}
        onChange={(e) => setVal(Number(e.target.value))}
        className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
      />
      <span className="w-10 text-right text-sm font-medium tabular-nums">
        {val}%
      </span>
      {changed && (
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await setProjectProgress(projectId, val);
              toast.success("Progress disimpan.");
            })
          }
        >
          {pending ? <Loader2 className="animate-spin" /> : <Save />}
          Simpan
        </Button>
      )}
    </div>
  );
}

export function AddAssignmentDialog({
  projectId,
  employees,
  roles,
}: {
  projectId: string;
  employees: Option[];
  roles: Option[];
}) {
  return (
    <FormDialog
      triggerLabel="Tambah Karyawan"
      title="Assign Karyawan ke Proyek"
      description="Tentukan karyawan, role yang dikerjakan, dan fee."
      action={addAssignment.bind(null, projectId)}
      successMessage="Karyawan di-assign."
    >
      <div className="space-y-1.5">
        <Label>Karyawan *</Label>
        <Select name="employeeId">
          <SelectTrigger>
            <SelectValue placeholder="Pilih karyawan" />
          </SelectTrigger>
          <SelectContent>
            {employees.map((emp) => (
              <SelectItem key={emp.id} value={emp.id}>
                {emp.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Role</Label>
          <Select name="roleId">
            <SelectTrigger>
              <SelectValue placeholder="Pilih role" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fee">Fee (IDR)</Label>
          <Input id="fee" name="fee" inputMode="numeric" placeholder="0" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="assign-notes">Catatan</Label>
        <Input id="assign-notes" name="notes" placeholder="Opsional" />
      </div>
    </FormDialog>
  );
}

export function AddItemDialog({ projectId }: { projectId: string }) {
  return (
    <FormDialog
      triggerLabel="Tambah Item"
      title="Tambah Kebutuhan (BOM)"
      description="Material/komponen yang dibutuhkan proyek."
      action={addItem.bind(null, projectId)}
      successMessage="Item ditambahkan."
    >
      <div className="space-y-1.5">
        <Label htmlFor="item-name">Nama Item *</Label>
        <Input id="item-name" name="name" placeholder="cth. ESP32 DevKit" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="quantity">Jumlah</Label>
          <Input id="quantity" name="quantity" type="number" min={1} defaultValue={1} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="unitPrice">Harga Satuan (IDR)</Label>
          <Input id="unitPrice" name="unitPrice" inputMode="numeric" placeholder="0" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Sumber</Label>
          <Select name="source" defaultValue="company">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ITEM_SOURCE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Status Beli</Label>
          <Select name="purchaseStatus" defaultValue="not_purchased">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PURCHASE_STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="link">Link Pembelian</Label>
        <Input id="link" name="link" placeholder="https://… (opsional)" />
      </div>
    </FormDialog>
  );
}

export function AddPaymentTermDialog({ projectId }: { projectId: string }) {
  return (
    <FormDialog
      triggerLabel="Tambah Termin"
      title="Tambah Termin Pembayaran"
      description="Nominal otomatis dihitung dari % × nilai kontrak."
      action={addPaymentTerm.bind(null, projectId)}
      successMessage="Termin ditambahkan."
    >
      <div className="space-y-1.5">
        <Label htmlFor="termName">Nama Termin *</Label>
        <Input id="termName" name="termName" placeholder="cth. Termin 2" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="percentage">Persentase (%)</Label>
        <Input
          id="percentage"
          name="percentage"
          type="number"
          min={0}
          max={100}
          placeholder="cth. 50"
        />
      </div>
    </FormDialog>
  );
}

export function AddCostForm({ projectId }: { projectId: string }) {
  const [state, formAction, pending] = React.useActionState<FormState, FormData>(
    addCost.bind(null, projectId),
    {},
  );
  const [name, setName] = React.useState("");
  const [amount, setAmount] = React.useState("");

  React.useEffect(() => {
    if (state.ok) {
      setName("");
      setAmount("");
    }
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row">
      <Input
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nama biaya (ongkir, admin…)"
        className="flex-1"
      />
      <Input
        name="amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
        inputMode="numeric"
        placeholder="Nominal"
        className="sm:w-48"
      />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Plus />} Tambah
      </Button>
    </form>
  );
}
