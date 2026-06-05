"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

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
function isUniqueError(e: unknown): boolean {
  return (
    !!e &&
    typeof e === "object" &&
    "code" in e &&
    (e as { code?: string }).code === "P2002"
  );
}

export type FormState = { ok?: boolean; error?: string };

export async function createEmployee(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const name = str(formData.get("name"));
  if (!name) return { error: "Nama karyawan wajib diisi." };

  const roleIds = formData.getAll("roleIds").map(String);
  const joinedAt = dateOrNull(formData.get("joinedAt"));
  const username = str(formData.get("username")) || null;
  const password = str(formData.get("password"));

  let employeeId: string;
  try {
    const employee = await db.employee.create({
      data: {
        name,
        contact: str(formData.get("contact")) || null,
        status: parseEmployeeStatus(formData.get("status")),
        joinedAt: joinedAt ?? new Date(),
        leftAt: dateOrNull(formData.get("leftAt")),
        notes: str(formData.get("notes")) || null,
        username,
        ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
        roles: { connect: roleIds.map((id) => ({ id })) },
      },
    });
    employeeId = employee.id;
  } catch (e) {
    if (isUniqueError(e)) return { error: "Username sudah dipakai karyawan lain." };
    throw e;
  }

  revalidatePath("/employees");
  revalidatePath("/");
  redirect(`/employees/${employeeId}`);
}

export async function updateEmployee(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const name = str(formData.get("name"));
  if (!name) return { error: "Nama karyawan wajib diisi." };

  const roleIds = formData.getAll("roleIds").map(String);
  const username = str(formData.get("username")) || null;
  const password = str(formData.get("password"));

  try {
    await db.employee.update({
      where: { id },
      data: {
        name,
        contact: str(formData.get("contact")) || null,
        status: parseEmployeeStatus(formData.get("status")),
        joinedAt: dateOrNull(formData.get("joinedAt")) ?? undefined,
        leftAt: dateOrNull(formData.get("leftAt")),
        notes: str(formData.get("notes")) || null,
        username,
        ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
        roles: { set: roleIds.map((rid) => ({ id: rid })) },
      },
    });
  } catch (e) {
    if (isUniqueError(e)) return { error: "Username sudah dipakai karyawan lain." };
    throw e;
  }

  revalidatePath("/employees");
  revalidatePath(`/employees/${id}`);
  revalidatePath("/");
  redirect(`/employees/${id}`);
}

export async function deleteEmployee(id: string) {
  await requireAdmin();
  await db.employee.delete({ where: { id } });
  revalidatePath("/employees");
  revalidatePath("/");
  redirect("/employees");
}
