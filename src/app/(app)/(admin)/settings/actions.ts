"use server";

import { revalidatePath } from "next/cache";
import { del, put } from "@vercel/blob";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { setAdminPassword, verifyAdminPassword } from "@/lib/admin-auth";

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

export type FormState = { ok?: boolean; error?: string };

export async function updateCompanyProfile(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const data = {
    companyName: str(formData.get("companyName")) || "Voltra Techno",
    address: str(formData.get("address")) || null,
    phone: str(formData.get("phone")) || null,
    email: str(formData.get("email")) || null,
    bankName: str(formData.get("bankName")) || null,
    bankAccount: str(formData.get("bankAccount")) || null,
    bankHolder: str(formData.get("bankHolder")) || null,
  };

  let logoUrl: string | undefined;
  const file = formData.get("logo");
  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith("image/")) return { error: "Logo harus berupa gambar." };
    if (file.size > 4 * 1024 * 1024) return { error: "Logo maksimal 4MB." };
    const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
    const blob = await put(`settings/logo.${ext}`, file, {
      access: "public",
      addRandomSuffix: true,
    });
    logoUrl = blob.url;
    const cur = await db.appSettings.findUnique({
      where: { id: "singleton" },
      select: { logoUrl: true },
    });
    if (cur?.logoUrl) {
      try {
        await del(cur.logoUrl);
      } catch {}
    }
  }

  await db.appSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data, ...(logoUrl ? { logoUrl } : {}) },
    update: { ...data, ...(logoUrl ? { logoUrl } : {}) },
  });

  revalidatePath("/settings");
  return { ok: true };
}

export async function removeLogo() {
  await requireAdmin();
  const cur = await db.appSettings.findUnique({
    where: { id: "singleton" },
    select: { logoUrl: true },
  });
  if (cur?.logoUrl) {
    try {
      await del(cur.logoUrl);
    } catch {}
  }
  await db.appSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", logoUrl: null },
    update: { logoUrl: null },
  });
  revalidatePath("/settings");
}

export async function changeAdminPassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next.length < 8) return { error: "Password baru minimal 8 karakter." };
  if (next !== confirm) return { error: "Konfirmasi password tidak cocok." };

  const ok = await verifyAdminPassword(current);
  if (!ok) return { error: "Password lama salah." };

  await setAdminPassword(next);
  return { ok: true };
}

// Roles & categories are listed in several forms (employee add/edit, project
// add/edit, assignment dialog). Revalidate the whole tree so those forms pick
// up additions/removals immediately instead of serving a cached list.
function revalidateTaxonomy() {
  revalidatePath("/", "layout");
}

export async function addCategory(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const name = str(formData.get("name"));
  if (!name) return { error: "Nama kategori wajib diisi." };
  const exists = await db.category.findUnique({ where: { name } });
  if (exists) return { error: "Kategori sudah ada." };
  await db.category.create({ data: { name } });
  revalidateTaxonomy();
  return { ok: true };
}

export async function deleteCategory(id: string) {
  await requireAdmin();
  await db.category.delete({ where: { id } });
  revalidateTaxonomy();
}

export async function addRole(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const name = str(formData.get("name"));
  if (!name) return { error: "Nama role wajib diisi." };
  const exists = await db.role.findUnique({ where: { name } });
  if (exists) return { error: "Role sudah ada." };
  await db.role.create({ data: { name } });
  revalidateTaxonomy();
  return { ok: true };
}

export async function deleteRole(id: string) {
  await requireAdmin();
  await db.role.delete({ where: { id } });
  revalidateTaxonomy();
}
