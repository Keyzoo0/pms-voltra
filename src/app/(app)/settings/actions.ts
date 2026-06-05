"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

export type FormState = { ok?: boolean; error?: string };

export async function addCategory(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = str(formData.get("name"));
  if (!name) return { error: "Nama kategori wajib diisi." };
  const exists = await db.category.findUnique({ where: { name } });
  if (exists) return { error: "Kategori sudah ada." };
  await db.category.create({ data: { name } });
  revalidatePath("/settings");
  return { ok: true };
}

export async function deleteCategory(id: string) {
  await db.category.delete({ where: { id } });
  revalidatePath("/settings");
}

export async function addRole(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = str(formData.get("name"));
  if (!name) return { error: "Nama role wajib diisi." };
  const exists = await db.role.findUnique({ where: { name } });
  if (exists) return { error: "Role sudah ada." };
  await db.role.create({ data: { name } });
  revalidatePath("/settings");
  return { ok: true };
}

export async function deleteRole(id: string) {
  await db.role.delete({ where: { id } });
  revalidatePath("/settings");
}
