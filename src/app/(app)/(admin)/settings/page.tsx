import type { Metadata } from "next";
import { Layers, Trash2, UserCog } from "lucide-react";
import { db } from "@/lib/db";
import { getAppSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { CompanyProfileForm } from "./company-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InlineAddForm } from "./inline-add-form";
import {
  addCategory,
  addRole,
  deleteCategory,
  deleteRole,
} from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pengaturan" };

export default async function SettingsPage() {
  const [categories, roles, settings] = await Promise.all([
    db.category.findMany({
      include: { _count: { select: { projects: true } } },
      orderBy: { name: "asc" },
    }),
    db.role.findMany({
      include: {
        _count: { select: { employees: true, requiredFor: true, assignments: true } },
      },
      orderBy: { name: "asc" },
    }),
    getAppSettings(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengaturan"
        description="Profil perusahaan, kategori proyek, dan role karyawan."
      />

      <CompanyProfileForm settings={settings} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Categories */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="size-4.5 text-primary" /> Kategori Proyek
            </CardTitle>
            <CardDescription>
              IoT, Machine Learning, PLC, SCADA, dll. ({categories.length})
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <InlineAddForm
              action={addCategory}
              placeholder="Nama kategori baru…"
              successMessage="Kategori ditambahkan."
            />
            <div className="divide-y divide-border/60">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.name}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {c._count.projects} proyek
                    </Badge>
                  </div>
                  <form action={deleteCategory.bind(null, c.id)}>
                    <button
                      type="submit"
                      className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Hapus kategori"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </form>
                </div>
              ))}
              {categories.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Belum ada kategori.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Roles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="size-4.5 text-primary" /> Role / Keahlian
            </CardTitle>
            <CardDescription>
              Firmware Engineer, 3D Drafter, ML Engineer, dll. ({roles.length})
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <InlineAddForm
              action={addRole}
              placeholder="Nama role baru…"
              successMessage="Role ditambahkan."
            />
            <div className="divide-y divide-border/60">
              {roles.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.name}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {r._count.employees} karyawan
                    </Badge>
                  </div>
                  <form action={deleteRole.bind(null, r.id)}>
                    <button
                      type="submit"
                      className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Hapus role"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </form>
                </div>
              ))}
              {roles.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Belum ada role.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
