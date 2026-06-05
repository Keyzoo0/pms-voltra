"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Save } from "lucide-react";
import type { FormState } from "./actions";
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

type ClientInitial = {
  name: string;
  picName: string | null;
  contact: string | null;
  address: string | null;
  notes: string | null;
};

export function ClientForm({
  mode,
  action,
  client,
}: {
  mode: "create" | "edit";
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  client?: ClientInitial;
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

      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Data Klien</CardTitle>
          <CardDescription>Perorangan atau perusahaan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nama Klien *</Label>
            <Input id="name" name="name" defaultValue={client?.name} placeholder="cth. PT Agrotech Nusantara" required autoFocus />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="picName">PIC (Person in Charge)</Label>
              <Input id="picName" name="picName" defaultValue={client?.picName ?? ""} placeholder="cth. Budi Santoso" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact">Kontak</Label>
              <Input id="contact" name="contact" defaultValue={client?.contact ?? ""} placeholder="No HP / Email" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address">Alamat</Label>
            <Textarea id="address" name="address" defaultValue={client?.address ?? ""} placeholder="Alamat lengkap…" rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Catatan</Label>
            <Textarea id="notes" name="notes" defaultValue={client?.notes ?? ""} placeholder="Catatan tambahan…" rows={2} />
          </div>
        </CardContent>
      </Card>

      <div className="mx-auto flex max-w-2xl items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Batal
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />}
          {mode === "create" ? "Tambah Klien" : "Simpan Perubahan"}
        </Button>
      </div>
    </form>
  );
}
