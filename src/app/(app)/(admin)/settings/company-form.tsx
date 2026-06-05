"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Building2, Loader2, Save, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { removeLogo, updateCompanyProfile, type FormState } from "./actions";
import type { AppSettingsData } from "@/lib/settings";
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

export function CompanyProfileForm({ settings }: { settings: AppSettingsData }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    updateCompanyProfile,
    {},
  );
  const logoRef = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState<string | null>(null);

  useEffect(() => {
    if (state.ok) {
      toast.success("Profil perusahaan disimpan.");
      setChosen(null);
    } else if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="size-4.5 text-primary" /> Profil Perusahaan
        </CardTitle>
        <CardDescription>
          Dipakai sebagai kop & info rekening pada nota/invoice.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="flex items-center gap-4">
            {settings.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={settings.logoUrl}
                alt="Logo"
                className="size-16 rounded-lg bg-white object-contain p-1 ring-1 ring-border"
              />
            ) : (
              <div className="flex size-16 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Building2 className="size-7" />
              </div>
            )}
            <div className="space-y-1">
              <input
                ref={logoRef}
                type="file"
                name="logo"
                accept="image/*"
                className="hidden"
                onChange={(e) => setChosen(e.target.files?.[0]?.name ?? null)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => logoRef.current?.click()}
              >
                <Upload className="size-3.5" /> Pilih Logo
              </Button>
              <p className="text-xs text-muted-foreground">
                {chosen ? `Dipilih: ${chosen}` : "PNG/JPG, maks 4MB"}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="companyName">Nama Perusahaan</Label>
            <Input id="companyName" name="companyName" defaultValue={settings.companyName} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address">Alamat</Label>
            <Textarea id="address" name="address" defaultValue={settings.address ?? ""} rows={2} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telepon</Label>
              <Input id="phone" name="phone" defaultValue={settings.phone ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" defaultValue={settings.email ?? ""} />
            </div>
          </div>

          <div className="border-t border-border/60 pt-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Rekening Pembayaran (untuk nota klien)
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="bankName">Bank</Label>
                <Input id="bankName" name="bankName" defaultValue={settings.bankName ?? ""} placeholder="cth. BCA" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bankAccount">No. Rekening</Label>
                <Input id="bankAccount" name="bankAccount" defaultValue={settings.bankAccount ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bankHolder">Atas Nama</Label>
                <Input id="bankHolder" name="bankHolder" defaultValue={settings.bankHolder ?? ""} />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Save />} Simpan Profil
            </Button>
          </div>
        </form>

        {settings.logoUrl && (
          <form action={removeLogo} className="mt-2">
            <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
              <X className="size-3.5" /> Hapus logo
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
