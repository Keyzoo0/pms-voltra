"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Plus, Save, Trash2 } from "lucide-react";
import type { FormState } from "./actions";
import { PROJECT_STATUS_OPTIONS } from "@/lib/constants";
import { cn, formatIDR, toDateInputValue } from "@/lib/utils";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Option = { id: string; name: string };
type ProjectInitial = {
  id: string;
  name: string;
  description: string | null;
  clientId: string | null;
  contractValue: string | number;
  startDate: Date | null;
  deadline: Date | null;
  status: string;
  progress: number;
  notes: string | null;
  categoryIds: string[];
  roleIds: string[];
};

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

export function ProjectForm({
  mode,
  action,
  clients,
  categories,
  roles,
  project,
  canEditFinance = true,
}: {
  mode: "create" | "edit";
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  clients: Option[];
  categories: Option[];
  roles: Option[];
  project?: ProjectInitial;
  canEditFinance?: boolean;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );

  const [clientId, setClientId] = useState(project?.clientId ?? "none");
  const [contractValue, setContractValue] = useState(
    project ? String(Number(project.contractValue)) : "",
  );
  const [cats, setCats] = useState<Set<string>>(
    new Set(project?.categoryIds ?? []),
  );
  const [roleSet, setRoleSet] = useState<Set<string>>(
    new Set(project?.roleIds ?? []),
  );
  const [terms, setTerms] = useState<{ termName: string; percentage: number }[]>(
    mode === "create"
      ? [
          { termName: "DP 50%", percentage: 50 },
          { termName: "Pelunasan 50%", percentage: 50 },
        ]
      : [],
  );

  const value = Number(contractValue) || 0;
  const totalPct = useMemo(
    () => terms.reduce((s, t) => s + (Number(t.percentage) || 0), 0),
    [terms],
  );

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <p className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {state.error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Informasi Proyek</CardTitle>
              <CardDescription>Detail utama proyek.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nama Proyek *</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={project?.name}
                  placeholder="cth. Smart Greenhouse IoT"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Deskripsi</Label>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={project?.description ?? ""}
                  placeholder="Penjelasan singkat proyek…"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {canEditFinance && (
                  <div className="space-y-1.5">
                    <Label>Klien</Label>
                    <input type="hidden" name="clientId" value={clientId === "none" ? "" : clientId} />
                    <Select value={clientId} onValueChange={setClientId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih klien" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Tanpa klien —</SelectItem>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select name="status" defaultValue={project?.status ?? "inquiry"}>
                    <SelectTrigger>
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
                </div>

                {canEditFinance && (
                  <div className="space-y-1.5">
                    <Label htmlFor="contractValue">Nilai Kontrak (IDR)</Label>
                    <Input
                      id="contractValue"
                      name="contractValue"
                      inputMode="numeric"
                      value={contractValue}
                      onChange={(e) =>
                        setContractValue(e.target.value.replace(/[^0-9]/g, ""))
                      }
                      placeholder="0"
                    />
                    <p className="text-xs text-muted-foreground">{formatIDR(value)}</p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="progress">Progress (%)</Label>
                  <Input
                    id="progress"
                    name="progress"
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={project?.progress ?? 0}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="startDate">Tanggal Mulai</Label>
                  <Input
                    id="startDate"
                    name="startDate"
                    type="date"
                    defaultValue={toDateInputValue(project?.startDate)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="deadline">Deadline</Label>
                  <Input
                    id="deadline"
                    name="deadline"
                    type="date"
                    defaultValue={toDateInputValue(project?.deadline)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes">Catatan</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  defaultValue={project?.notes ?? ""}
                  placeholder="Catatan tambahan…"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {mode === "create" && (
            <Card>
              <CardHeader>
                <CardTitle>Termin Pembayaran</CardTitle>
                <CardDescription>
                  Default 2 termin 50/50 — bisa diubah. Nominal otomatis dari %
                  × nilai kontrak.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <input
                  type="hidden"
                  name="paymentTermsJson"
                  value={JSON.stringify(terms)}
                />
                {terms.map((t, i) => (
                  <div key={i} className="flex items-end gap-2">
                    <div className="flex-1 space-y-1.5">
                      {i === 0 && <Label className="text-xs">Nama Termin</Label>}
                      <Input
                        value={t.termName}
                        onChange={(e) =>
                          setTerms((prev) =>
                            prev.map((x, j) =>
                              j === i ? { ...x, termName: e.target.value } : x,
                            ),
                          )
                        }
                        placeholder="cth. DP"
                      />
                    </div>
                    <div className="w-24 space-y-1.5">
                      {i === 0 && <Label className="text-xs">%</Label>}
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={t.percentage}
                        onChange={(e) =>
                          setTerms((prev) =>
                            prev.map((x, j) =>
                              j === i
                                ? { ...x, percentage: Number(e.target.value) }
                                : x,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="w-32 pb-2 text-right text-xs text-muted-foreground">
                      {formatIDR((t.percentage / 100) * value)}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="mb-0.5 text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        setTerms((prev) => prev.filter((_, j) => j !== i))
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setTerms((prev) => [
                        ...prev,
                        { termName: "", percentage: 0 },
                      ])
                    }
                  >
                    <Plus /> Tambah Termin
                  </Button>
                  <span
                    className={cn(
                      "text-sm font-medium tabular-nums",
                      totalPct === 100
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-amber-600 dark:text-amber-400",
                    )}
                  >
                    Total {totalPct}%
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Kategori</CardTitle>
              <CardDescription>Bisa lebih dari satu.</CardDescription>
            </CardHeader>
            <CardContent>
              {[...cats].map((id) => (
                <input key={id} type="hidden" name="categoryIds" value={id} />
              ))}
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <Chip
                    key={c.id}
                    label={c.name}
                    active={cats.has(c.id)}
                    onClick={() => toggle(cats, setCats, c.id)}
                  />
                ))}
                {categories.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Belum ada kategori. Tambah di Pengaturan.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Role Dibutuhkan</CardTitle>
              <CardDescription>Keahlian yang diperlukan.</CardDescription>
            </CardHeader>
            <CardContent>
              {[...roleSet].map((id) => (
                <input key={id} type="hidden" name="roleIds" value={id} />
              ))}
              <div className="flex flex-wrap gap-2">
                {roles.map((r) => (
                  <Chip
                    key={r.id}
                    label={r.name}
                    active={roleSet.has(r.id)}
                    onClick={() => toggle(roleSet, setRoleSet, r.id)}
                  />
                ))}
                {roles.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Belum ada role. Tambah di Pengaturan.
                  </p>
                )}
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
          {mode === "create" ? "Buat Proyek" : "Simpan Perubahan"}
        </Button>
      </div>
    </form>
  );
}
