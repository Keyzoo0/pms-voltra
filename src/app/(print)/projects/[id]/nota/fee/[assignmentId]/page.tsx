import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getAppSettings } from "@/lib/settings";
import { requireAdmin } from "@/lib/session";
import { FEE_STATUS, type FeeStatus } from "@/lib/constants";
import { formatDate, formatIDR, toNum } from "@/lib/utils";
import { NotaDocument } from "@/components/nota/nota-document";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Kwitansi Fee" };

export default async function NotaFeePage({
  params,
}: {
  params: Promise<{ id: string; assignmentId: string }>;
}) {
  await requireAdmin();
  const { id, assignmentId } = await params;

  const [assignment, settings] = await Promise.all([
    db.projectAssignment.findFirst({
      where: { id: assignmentId, projectId: id },
      include: { employee: true, role: true, project: true },
    }),
    getAppSettings(),
  ]);
  if (!assignment) notFound();

  const fee = toNum(assignment.fee);
  const now = new Date();

  return (
    <NotaDocument
      settings={settings}
      docTitle="Kwitansi Fee"
      docNumber={`FEE/${assignment.id.slice(-6).toUpperCase()}/${now.getFullYear()}`}
      docDate={formatDate(assignment.feeStatus === "paid" ? (assignment.project.updatedAt ?? now) : now)}
      backHref={`/projects/${assignment.project.id}`}
      recipient={
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Telah dibayarkan kepada</p>
          <p className="font-semibold">{assignment.employee.name}</p>
          <p className="text-slate-500">{assignment.role?.name ?? "—"}</p>
        </div>
      }
    >
      <div className="rounded-lg bg-slate-50 p-5">
        <p className="text-sm text-slate-600">
          Telah dibayarkan fee kepada{" "}
          <span className="font-semibold text-slate-900">{assignment.employee.name}</span> atas
          pekerjaan sebagai{" "}
          <span className="font-semibold text-slate-900">{assignment.role?.name ?? "anggota tim"}</span>{" "}
          pada proyek{" "}
          <span className="font-semibold text-slate-900">{assignment.project.name}</span>.
        </p>
        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Jumlah Fee</p>
            <p className="text-2xl font-bold tabular-nums">{formatIDR(fee)}</p>
          </div>
          <span
            className={
              assignment.feeStatus === "paid"
                ? "rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700"
                : "rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700"
            }
          >
            {FEE_STATUS[assignment.feeStatus as FeeStatus].label}
          </span>
        </div>
      </div>

      <div className="mt-12 grid grid-cols-2 gap-8 text-center text-sm">
        <div>
          <p className="text-slate-500">Penerima,</p>
          <div className="h-16" />
          <p className="border-t border-slate-400 pt-1 font-medium">{assignment.employee.name}</p>
        </div>
        <div>
          <p className="text-slate-500">Pemberi,</p>
          <div className="h-16" />
          <p className="border-t border-slate-400 pt-1 font-medium">{settings.companyName}</p>
        </div>
      </div>
    </NotaDocument>
  );
}
