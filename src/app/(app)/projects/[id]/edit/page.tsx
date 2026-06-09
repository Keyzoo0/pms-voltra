import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getProjectAccess, requireSession } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { ProjectForm } from "../../project-form";
import { updateProject } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit Proyek" };

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

  const access = await getProjectAccess(id, session);
  if (access !== "admin" && access !== "manager") redirect(`/projects/${id}`);
  const isAdmin = access === "admin";

  const [project, clients, categories, roles] = await Promise.all([
    db.project.findUnique({
      where: { id },
      include: {
        categories: { select: { id: true } },
        requiredRoles: { select: { id: true } },
      },
    }),
    db.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.role.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  if (!project) notFound();

  const action = updateProject.bind(null, project.id);

  return (
    <div>
      <PageHeader
        title="Edit Proyek"
        description={project.name}
        backHref={`/projects/${project.id}`}
        backLabel="Detail Proyek"
      />
      <ProjectForm
        mode="edit"
        action={action}
        canEditFinance={isAdmin}
        clients={clients}
        categories={categories}
        roles={roles}
        project={{
          id: project.id,
          name: project.name,
          description: project.description,
          clientId: project.clientId,
          contractValue: project.contractValue.toString(),
          startDate: project.startDate,
          deadline: project.deadline,
          status: project.status,
          progress: project.progress,
          notes: project.notes,
          repoUrl: project.repoUrl,
          waGroupUrl: project.waGroupUrl,
          categoryIds: project.categories.map((c) => c.id),
          roleIds: project.requiredRoles.map((r) => r.id),
        }}
      />
    </div>
  );
}
