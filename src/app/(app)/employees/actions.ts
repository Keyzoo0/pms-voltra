"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}
function dateOrNull(v: FormDataEntryValue | null): Date | null {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
function parseEmployeeStatus(v: FormDataEntryValue | null): "active" | "inactive" {
  return str(v) === "inactive" ? "inactive" : "active";
}

export type FormState = { ok?: boolean; error?: string };

export async function createEmployee(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = str(formData.get("name"));
  if (!name) return { error: "Nama karyawan wajib diisi." };

  const roleIds = formData.getAll("roleIds").map(String);
  const joinedAt = dateOrNull(formData.get("joinedAt"));

  const employee = await db.employee.create({
    data: {
      name,
      contact: str(formData.get("contact")) || null,
      status: parseEmployeeStatus(formData.get("status")),
      joinedAt: joinedAt ?? new Date(),
      leftAt: dateOrNull(formData.get("leftAt")),
      notes: str(formData.get("notes")) || null,
      roles: { connect: roleIds.map((id) => ({ id })) },
    },
  });

  revalidatePath("/employees");
  revalidatePath("/");
  redirect(`/employees/${employee.id}`);
}

export async function updateEmployee(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = str(formData.get("name"));
  if (!name) return { error: "Nama karyawan wajib diisi." };

  const roleIds = formData.getAll("roleIds").map(String);

  await db.employee.update({
    where: { id },
    data: {
      name,
      contact: str(formData.get("contact")) || null,
      status: parseEmployeeStatus(formData.get("status")),
      joinedAt: dateOrNull(formData.get("joinedAt")) ?? undefined,
      leftAt: dateOrNull(formData.get("leftAt")),
      notes: str(formData.get("notes")) || null,
      roles: { set: roleIds.map((rid) => ({ id: rid })) },
    },
  });

  revalidatePath("/employees");
  revalidatePath(`/employees/${id}`);
  revalidatePath("/");
  redirect(`/employees/${id}`);
}

export async function deleteEmployee(id: string) {
  await db.employee.delete({ where: { id } });
  revalidatePath("/employees");
  revalidatePath("/");
  redirect("/employees");
}
