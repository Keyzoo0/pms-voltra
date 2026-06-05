"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

export type FormState = { ok?: boolean; error?: string };

export async function updateOwnProfile(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  if (session.role !== "employee") return { error: "Hanya untuk karyawan." };

  await db.employee.update({
    where: { id: session.uid },
    data: {
      contact: str(formData.get("contact")) || null,
      notes: str(formData.get("notes")) || null,
    },
  });

  revalidatePath("/me");
  return { ok: true };
}

export async function changeOwnPassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  if (session.role !== "employee") return { error: "Hanya untuk karyawan." };

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  if (next.length < 6) return { error: "Password baru minimal 6 karakter." };

  const emp = await db.employee.findUnique({ where: { id: session.uid } });
  if (!emp?.passwordHash) return { error: "Akun Anda belum memiliki password." };

  const ok = await bcrypt.compare(current, emp.passwordHash);
  if (!ok) return { error: "Password lama salah." };

  await db.employee.update({
    where: { id: session.uid },
    data: { passwordHash: await bcrypt.hash(next, 10) },
  });

  return { ok: true };
}
