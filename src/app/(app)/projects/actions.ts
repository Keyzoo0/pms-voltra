"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { toNum } from "@/lib/utils";

// ── helpers ───────────────────────────────────────────────
function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}
function num(v: FormDataEntryValue | null): number {
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function dateOrNull(v: FormDataEntryValue | null): Date | null {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

const PROJECT_STATUSES = [
  "inquiry", "quotation", "approved", "in_progress", "delivered",
  "paid", "closed", "on_hold", "cancelled", "dispute",
] as const;
type PStatus = (typeof PROJECT_STATUSES)[number];
function parseStatus(v: FormDataEntryValue | null): PStatus {
  const s = str(v);
  return (PROJECT_STATUSES as readonly string[]).includes(s)
    ? (s as PStatus)
    : "inquiry";
}

const ITEM_SOURCES = ["company", "client", "reimburse"] as const;
type ISource = (typeof ITEM_SOURCES)[number];
function parseSource(v: FormDataEntryValue | null): ISource {
  const s = str(v);
  return (ITEM_SOURCES as readonly string[]).includes(s)
    ? (s as ISource)
    : "company";
}

const PURCHASE_STATUSES = ["not_purchased", "purchased", "reimbursed"] as const;
type PurStatus = (typeof PURCHASE_STATUSES)[number];
function parsePurchase(v: FormDataEntryValue | null): PurStatus {
  const s = str(v);
  return (PURCHASE_STATUSES as readonly string[]).includes(s)
    ? (s as PurStatus)
    : "not_purchased";
}

export type FormState = { ok?: boolean; error?: string };

// ── Project CRUD ──────────────────────────────────────────
export async function createProject(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = str(formData.get("name"));
  if (!name) return { error: "Nama proyek wajib diisi." };

  const clientId = str(formData.get("clientId"));
  const contractValue = num(formData.get("contractValue"));
  const categoryIds = formData.getAll("categoryIds").map(String);
  const roleIds = formData.getAll("roleIds").map(String);
  const progress = Math.min(100, Math.max(0, Math.round(num(formData.get("progress")))));

  let terms: { termName: string; percentage: number }[] = [];
  try {
    terms = JSON.parse(str(formData.get("paymentTermsJson")) || "[]");
  } catch {
    terms = [];
  }

  const project = await db.project.create({
    data: {
      name,
      description: str(formData.get("description")) || null,
      ...(clientId ? { client: { connect: { id: clientId } } } : {}),
      contractValue,
      startDate: dateOrNull(formData.get("startDate")),
      deadline: dateOrNull(formData.get("deadline")),
      status: parseStatus(formData.get("status")),
      progress,
      notes: str(formData.get("notes")) || null,
      categories: { connect: categoryIds.map((id) => ({ id })) },
      requiredRoles: { connect: roleIds.map((id) => ({ id })) },
      paymentTerms: {
        create: terms
          .filter((t) => t.termName?.trim())
          .map((t, i) => ({
            termName: t.termName.trim(),
            percentage: t.percentage,
            amount: (t.percentage / 100) * contractValue,
            sortOrder: i,
          })),
      },
    },
  });

  revalidatePath("/projects");
  revalidatePath("/");
  redirect(`/projects/${project.id}`);
}

export async function updateProject(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = str(formData.get("name"));
  if (!name) return { error: "Nama proyek wajib diisi." };

  const clientId = str(formData.get("clientId"));
  const contractValue = num(formData.get("contractValue"));
  const categoryIds = formData.getAll("categoryIds").map(String);
  const roleIds = formData.getAll("roleIds").map(String);
  const progress = Math.min(100, Math.max(0, Math.round(num(formData.get("progress")))));

  await db.project.update({
    where: { id },
    data: {
      name,
      description: str(formData.get("description")) || null,
      client: clientId ? { connect: { id: clientId } } : { disconnect: true },
      contractValue,
      startDate: dateOrNull(formData.get("startDate")),
      deadline: dateOrNull(formData.get("deadline")),
      status: parseStatus(formData.get("status")),
      progress,
      notes: str(formData.get("notes")) || null,
      categories: { set: categoryIds.map((cid) => ({ id: cid })) },
      requiredRoles: { set: roleIds.map((rid) => ({ id: rid })) },
    },
  });

  // Keep payment term amounts in sync with the (possibly new) contract value.
  const terms = await db.projectPaymentTerm.findMany({ where: { projectId: id } });
  await Promise.all(
    terms.map((t) =>
      db.projectPaymentTerm.update({
        where: { id: t.id },
        data: { amount: (toNum(t.percentage) / 100) * contractValue },
      }),
    ),
  );

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  revalidatePath("/");
  redirect(`/projects/${id}`);
}

export async function deleteProject(id: string) {
  await db.project.delete({ where: { id } });
  revalidatePath("/projects");
  revalidatePath("/");
  redirect("/projects");
}

export async function setProjectStatus(id: string, status: string) {
  await db.project.update({
    where: { id },
    data: { status: parseStatus(status) },
  });
  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
  revalidatePath("/");
}

export async function setProjectProgress(id: string, progress: number) {
  await db.project.update({
    where: { id },
    data: { progress: Math.min(100, Math.max(0, Math.round(progress))) },
  });
  revalidatePath(`/projects/${id}`);
  revalidatePath("/");
}

// ── Assignments ───────────────────────────────────────────
export async function addAssignment(
  projectId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const employeeId = str(formData.get("employeeId"));
  if (!employeeId) return { error: "Pilih karyawan." };
  const roleId = str(formData.get("roleId"));

  await db.projectAssignment.create({
    data: {
      project: { connect: { id: projectId } },
      employee: { connect: { id: employeeId } },
      ...(roleId ? { role: { connect: { id: roleId } } } : {}),
      fee: num(formData.get("fee")),
      notes: str(formData.get("notes")) || null,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function deleteAssignment(
  assignmentId: string,
  projectId: string,
) {
  await db.projectAssignment.delete({ where: { id: assignmentId } });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
}

export async function toggleFeeStatus(assignmentId: string, projectId: string) {
  const a = await db.projectAssignment.findUnique({ where: { id: assignmentId } });
  if (!a) return;
  await db.projectAssignment.update({
    where: { id: assignmentId },
    data: { feeStatus: a.feeStatus === "paid" ? "pending" : "paid" },
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/fees");
}

// ── BOM items ─────────────────────────────────────────────
export async function addItem(
  projectId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = str(formData.get("name"));
  if (!name) return { error: "Nama item wajib diisi." };
  const quantity = Math.max(1, Math.round(num(formData.get("quantity")) || 1));
  const unitPrice = num(formData.get("unitPrice"));

  await db.projectItem.create({
    data: {
      project: { connect: { id: projectId } },
      name,
      quantity,
      unitPrice,
      totalPrice: quantity * unitPrice,
      link: str(formData.get("link")) || null,
      source: parseSource(formData.get("source")),
      purchaseStatus: parsePurchase(formData.get("purchaseStatus")),
    },
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function deleteItem(itemId: string, projectId: string) {
  await db.projectItem.delete({ where: { id: itemId } });
  revalidatePath(`/projects/${projectId}`);
}

export async function cycleItemStatus(itemId: string, projectId: string) {
  const item = await db.projectItem.findUnique({ where: { id: itemId } });
  if (!item) return;
  const next =
    item.purchaseStatus === "not_purchased"
      ? "purchased"
      : item.purchaseStatus === "purchased"
        ? "reimbursed"
        : "not_purchased";
  await db.projectItem.update({
    where: { id: itemId },
    data: { purchaseStatus: next },
  });
  revalidatePath(`/projects/${projectId}`);
}

// ── Additional costs ──────────────────────────────────────
export async function addCost(
  projectId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = str(formData.get("name"));
  if (!name) return { error: "Nama biaya wajib diisi." };
  await db.projectAdditionalCost.create({
    data: {
      project: { connect: { id: projectId } },
      name,
      amount: num(formData.get("amount")),
    },
  });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function deleteCost(costId: string, projectId: string) {
  await db.projectAdditionalCost.delete({ where: { id: costId } });
  revalidatePath(`/projects/${projectId}`);
}

// ── Payment terms ─────────────────────────────────────────
export async function addPaymentTerm(
  projectId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const termName = str(formData.get("termName"));
  if (!termName) return { error: "Nama termin wajib diisi." };
  const percentage = num(formData.get("percentage"));

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { contractValue: true, _count: { select: { paymentTerms: true } } },
  });
  const contractValue = toNum(project?.contractValue);

  await db.projectPaymentTerm.create({
    data: {
      project: { connect: { id: projectId } },
      termName,
      percentage,
      amount: (percentage / 100) * contractValue,
      sortOrder: project?._count.paymentTerms ?? 0,
    },
  });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function deletePaymentTerm(termId: string, projectId: string) {
  await db.projectPaymentTerm.delete({ where: { id: termId } });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
}

export async function togglePaymentTerm(termId: string, projectId: string) {
  const term = await db.projectPaymentTerm.findUnique({ where: { id: termId } });
  if (!term) return;
  const paid = term.status === "paid";
  await db.projectPaymentTerm.update({
    where: { id: termId },
    data: {
      status: paid ? "unpaid" : "paid",
      paidAt: paid ? null : new Date(),
    },
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
}

export async function generateDefaultTerms(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { contractValue: true, _count: { select: { paymentTerms: true } } },
  });
  if (!project || project._count.paymentTerms > 0) return;
  const contractValue = toNum(project.contractValue);
  await db.projectPaymentTerm.createMany({
    data: [
      { projectId, termName: "DP 50%", percentage: 50, amount: contractValue * 0.5, sortOrder: 0 },
      { projectId, termName: "Pelunasan 50%", percentage: 50, amount: contractValue * 0.5, sortOrder: 1 },
    ],
  });
  revalidatePath(`/projects/${projectId}`);
}
