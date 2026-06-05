"use client";

import { useActionState, useEffect, useRef } from "react";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { changeAdminPassword, type FormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function AdminPasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    changeAdminPassword,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      toast.success("Password admin berhasil diubah.");
      formRef.current?.reset();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4.5 text-primary" /> Akun Admin
        </CardTitle>
        <CardDescription>
          Ubah password login admin. Username tetap diatur lewat environment.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={action} className="grid gap-4 sm:max-w-md">
          <div className="space-y-1.5">
            <Label htmlFor="current">Password Lama</Label>
            <Input
              id="current"
              name="current"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="next">Password Baru</Label>
            <Input
              id="next"
              name="next"
              type="password"
              autoComplete="new-password"
              placeholder="Min. 8 karakter"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Ulangi Password Baru</Label>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <KeyRound />} Ubah Password
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
