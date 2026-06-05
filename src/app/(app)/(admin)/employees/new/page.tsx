import type { Metadata } from "next";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { EmployeeForm } from "../employee-form";
import { createEmployee } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Karyawan Baru" };

export default async function NewEmployeePage() {
  const roles = await db.role.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div>
      <PageHeader
        title="Karyawan Baru"
        description="Tambahkan karyawan beserta role/keahliannya."
        backHref="/employees"
        backLabel="Daftar Karyawan"
      />
      <EmployeeForm mode="create" action={createEmployee} roles={roles} />
    </div>
  );
}
