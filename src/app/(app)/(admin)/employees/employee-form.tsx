"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Save } from "lucide-react";
import type { FormState } from "./actions";
import { toDateInputValue } from "@/lib/utils";
import { MultiChipField } from "@/components/multi-chip-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Option = { id: string; name: string };
type EmployeeInitial = {
  name: string;
  username: string | null;
  contact: string | null;
  bankName: string | null;
  bankAccount: string | null;
  joinedAt: Date | null;
  notes: string | null;
  roleIds: string[];
};

export function EmployeeForm({
  mode,
  action,
  roles,
  employee,
}: {
  mode: "create" | "edit";
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  roles: Option[];
  employee?: EmployeeInitial;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <p className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {state.error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Data Karyawan</CardTitle>
            <CardDescription>Informasi dasar karyawan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nama Lengkap *</Label>
              <Input id="name" name="name" defaultValue={employee?.name} placeholder="cth. Rizky Pratama" required autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact">Kontak</Label>
              <Input id="contact" name="contact" defaultValue={employee?.contact ?? ""} placeholder="No HP / Email" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="bankName">Bank</Label>
                <Input id="bankName" name="bankName" defaultValue={employee?.bankName ?? ""} placeholder="cth. BCA" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bankAccount">No. Rekening</Label>
                <Input id="bankAccount" name="bankAccount" defaultValue={employee?.bankAccount ?? ""} placeholder="cth. 1234567890" inputMode="numeric" />
              </div>
            </div>
            <div className="space-y-1.5 sm:max-w-xs">
              <Label htmlFor="joinedAt">Tgl Bergabung</Label>
              <Input id="joinedAt" name="joinedAt" type="date" defaultValue={toDateInputValue(employee?.joinedAt) || toDateInputValue(new Date())} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Catatan</Label>
              <Textarea id="notes" name="notes" defaultValue={employee?.notes ?? ""} placeholder="Catatan tambahan…" rows={2} />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Role / Keahlian</CardTitle>
              <CardDescription>Bisa lebih dari satu.</CardDescription>
            </CardHeader>
            <CardContent>
              <MultiChipField
                name="roleIds"
                options={roles}
                initial={employee?.roleIds}
                emptyText="Belum ada role. Tambah di Pengaturan."
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Akun Login</CardTitle>
              <CardDescription>
                {mode === "create"
                  ? "Isi untuk memberi karyawan akses login (opsional)."
                  : "Kosongkan password jika tidak ingin mengubahnya."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  name="username"
                  defaultValue={employee?.username ?? ""}
                  placeholder="cth. rizky"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">
                  {mode === "create" ? "Password" : "Reset Password"}
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder={
                    mode === "create" ? "Min. 6 karakter" : "Kosongkan = tidak diubah"
                  }
                  autoComplete="new-password"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Batal
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />}
          {mode === "create" ? "Tambah Karyawan" : "Simpan Perubahan"}
        </Button>
      </div>
    </form>
  );
}
