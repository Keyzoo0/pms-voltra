"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

export type FormState = { ok?: boolean; error?: string };

export async function createClient(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = str(formData.get("name"));
  if (!name) return { error: "Nama klien wajib diisi." };

  const client = await db.client.create({
    data: {
      name,
      picName: str(formData.get("picName")) || null,
      contact: str(formData.get("contact")) || null,
      address: str(formData.get("address")) || null,
      notes: str(formData.get("notes")) || null,
    },
  });

  revalidatePath("/clients");
  redirect(`/clients/${client.id}`);
}

export async function updateClient(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = str(formData.get("name"));
  if (!name) return { error: "Nama klien wajib diisi." };

  await db.client.update({
    where: { id },
    data: {
      name,
      picName: str(formData.get("picName")) || null,
      contact: str(formData.get("contact")) || null,
      address: str(formData.get("address")) || null,
      notes: str(formData.get("notes")) || null,
    },
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  redirect(`/clients/${id}`);
}

export async function deleteClient(id: string) {
  await db.client.delete({ where: { id } });
  revalidatePath("/clients");
  redirect("/clients");
}
