import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getAppSettings } from "@/lib/settings";
import { requireAdmin } from "@/lib/session";
import { computeProjectFinance } from "@/lib/finance";
import { PAYMENT_STATUS, type PaymentStatus } from "@/lib/constants";
import { formatDate, formatIDR, toNum } from "@/lib/utils";
import { NotaDocument } from "@/components/nota/nota-document";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Nota Klien" };

export default async function NotaKlienPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const [project, settings] = await Promise.all([
    db.project.findUnique({
      where: { id },
      include: {
        client: true,
        paymentTerms: { orderBy: { sortOrder: "asc" } },
        items: true,
        assignments: true,
        additionalCosts: true,
      },
    }),
    getAppSettings(),
  ]);
  if (!project) notFound();

  const fin = computeProjectFinance(project);
  const clientItems = project.items.filter((i) => i.source === "client");
  const now = new Date();
  const docNumber = `INV/${project.id.slice(-6).toUpperCase()}/${now.getFullYear()}`;

  return (
    <NotaDocument
      settings={settings}
      docTitle="Invoice"
      docNumber={docNumber}
      docDate={formatDate(now)}
      backHref={`/projects/${project.id}`}
      recipient={
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Kepada Yth.</p>
          <p className="font-semibold">{project.client?.name ?? "—"}</p>
          {project.client?.picName && <p className="text-slate-600">u.p. {project.client.picName}</p>}
          {project.client?.address && (
            <p className="whitespace-pre-line text-slate-500">{project.client.address}</p>
          )}
        </div>
      }
    >
      <div className="mb-5 rounded-lg bg-slate-50 p-4">
        <p className="text-xs uppercase tracking-wide text-slate-400">Proyek</p>
        <p className="font-semibold">{project.name}</p>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-slate-500">Nilai Kontrak</span>
          <span className="font-bold tabular-nums">{formatIDR(fin.revenue)}</span>
        </div>
      </div>

      {clientItems.length > 0 && (
        <div className="mb-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Item / Material Ditanggung Klien
          </p>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-slate-300 text-left text-xs uppercase text-slate-500">
                <th className="py-1.5">Item</th>
                <th className="py-1.5 text-center">Qty</th>
                <th className="py-1.5 text-right">Harga</th>
                <th className="py-1.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {clientItems.map((it) => (
                <tr key={it.id} className="border-b border-slate-100">
                  <td className="py-2">{it.name}</td>
                  <td className="py-2 text-center tabular-nums">{it.quantity}</td>
                  <td className="py-2 text-right tabular-nums">{formatIDR(toNum(it.unitPrice))}</td>
                  <td className="py-2 text-right tabular-nums">{formatIDR(toNum(it.totalPrice))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Jadwal Pembayaran
      </p>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-slate-300 text-left text-xs uppercase text-slate-500">
            <th className="py-1.5">Termin</th>
            <th className="py-1.5 text-center">%</th>
            <th className="py-1.5 text-right">Nominal</th>
            <th className="py-1.5 text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          {project.paymentTerms.map((t) => (
            <tr key={t.id} className="border-b border-slate-100">
              <td className="py-2">
                {t.termName}
                {t.paidAt && (
                  <span className="block text-xs text-slate-400">{formatDate(t.paidAt)}</span>
                )}
              </td>
              <td className="py-2 text-center tabular-nums">{toNum(t.percentage)}%</td>
              <td className="py-2 text-right tabular-nums">{formatIDR(toNum(t.amount))}</td>
              <td className="py-2 text-right">
                <span
                  className={
                    t.status === "paid"
                      ? "font-medium text-emerald-600"
                      : "text-slate-500"
                  }
                >
                  {PAYMENT_STATUS[t.status as PaymentStatus].label}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 ml-auto w-full max-w-xs space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">Total Tagihan</span>
          <span className="tabular-nums">{formatIDR(fin.revenue)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Sudah Dibayar</span>
          <span className="tabular-nums text-emerald-600">{formatIDR(fin.paid)}</span>
        </div>
        <div className="flex justify-between border-t border-slate-300 pt-1 font-bold">
          <span>Sisa Tagihan</span>
          <span className="tabular-nums">{formatIDR(fin.outstanding)}</span>
        </div>
      </div>

      {settings.bankAccount && (
        <div className="mt-6 rounded-lg border border-slate-200 p-4 text-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">Pembayaran ditransfer ke</p>
          <p className="font-semibold">
            {settings.bankName} — {settings.bankAccount}
          </p>
          {settings.bankHolder && <p className="text-slate-600">a.n. {settings.bankHolder}</p>}
        </div>
      )}

      <div className="mt-10 flex justify-end text-center text-sm">
        <div>
          <p className="text-slate-500">Hormat kami,</p>
          <div className="h-16" />
          <p className="border-t border-slate-400 pt-1 font-medium">{settings.companyName}</p>
        </div>
      </div>
    </NotaDocument>
  );
}
