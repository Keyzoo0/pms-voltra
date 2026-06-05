import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { EmployeeForm } from "../../employee-form";
import { updateEmployee } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit Karyawan" };

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [employee, roles] = await Promise.all([
    db.employee.findUnique({
      where: { id },
      include: { roles: { select: { id: true } } },
    }),
    db.role.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  if (!employee) notFound();

  const action = updateEmployee.bind(null, employee.id);

  return (
    <div>
      <PageHeader
        title="Edit Karyawan"
        description={employee.name}
        backHref={`/employees/${employee.id}`}
        backLabel="Detail Karyawan"
      />
      <EmployeeForm
        mode="edit"
        action={action}
        roles={roles}
        employee={{
          name: employee.name,
          username: employee.username,
          contact: employee.contact,
          joinedAt: employee.joinedAt,
          notes: employee.notes,
          roleIds: employee.roles.map((r) => r.id),
        }}
      />
    </div>
  );
}
