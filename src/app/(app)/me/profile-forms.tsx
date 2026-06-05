"use client";

import { useActionState, useEffect } from "react";
import { KeyRound, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { changeOwnPassword, updateOwnProfile, type FormState } from "./actions";
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

export function ProfileForm({
  contact,
  notes,
}: {
  contact: string | null;
  notes: string | null;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    updateOwnProfile,
    {},
  );

  useEffect(() => {
    if (state.ok) toast.success("Profil diperbarui.");
    else if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Diri</CardTitle>
        <CardDescription>Perbarui kontak Anda.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="contact">Kontak</Label>
            <Input id="contact" name="contact" defaultValue={contact ?? ""} placeholder="No HP / Email" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Catatan</Label>
            <Textarea id="notes" name="notes" defaultValue={notes ?? ""} rows={2} placeholder="Opsional" />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Save />} Simpan
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    changeOwnPassword,
    {},
  );

  useEffect(() => {
    if (state.ok) toast.success("Password berhasil diubah.");
    else if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ganti Password</CardTitle>
        <CardDescription>Ubah password login Anda.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4" key={state.ok ? "ok" : "form"}>
          <div className="space-y-1.5">
            <Label htmlFor="current">Password Lama</Label>
            <Input id="current" name="current" type="password" autoComplete="current-password" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="next">Password Baru</Label>
            <Input id="next" name="next" type="password" autoComplete="new-password" placeholder="Min. 6 karakter" required />
          </div>
          <div className="flex justify-end">
            <Button type="submit" variant="outline" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <KeyRound />} Ubah Password
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
