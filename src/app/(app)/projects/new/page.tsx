import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { ProjectForm } from "../project-form";
import { createProject } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Proyek Baru" };

export default async function NewProjectPage() {
  await requireAdmin();
  const [clients, categories, roles] = await Promise.all([
    db.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.role.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Proyek Baru"
        description="Buat proyek dan tentukan klien, kategori, role & termin pembayaran."
        backHref="/projects"
        backLabel="Daftar Proyek"
      />
      <ProjectForm
        mode="create"
        action={createProject}
        clients={clients}
        categories={categories}
        roles={roles}
      />
    </div>
  );
}
