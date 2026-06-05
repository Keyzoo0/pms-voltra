import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getAppSettings } from "@/lib/settings";
import { getProjectAccess, requireSession } from "@/lib/session";
import { ITEM_SOURCE, type ItemSource } from "@/lib/constants";
import { formatDate, formatIDR, toNum } from "@/lib/utils";
import { NotaDocument } from "@/components/nota/nota-document";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Nota Kebutuhan" };

export default async function NotaKebutuhanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const access = await getProjectAccess(id, session);
  if (!access) notFound();

  const [project, settings] = await Promise.all([
    db.project.findUnique({
      where: { id },
      include: { items: { orderBy: { createdAt: "asc" } }, additionalCosts: true, client: true },
    }),
    getAppSettings(),
  ]);
  if (!project) notFound();

  const itemsTotal = project.items.reduce((s, i) => s + toNum(i.totalPrice), 0);
  const costsTotal = project.additionalCosts.reduce((s, c) => s + toNum(c.amount), 0);
  const grand = itemsTotal + costsTotal;
  const now = new Date();

  return (
    <NotaDocument
      settings={settings}
      docTitle="Nota Kebutuhan"
      docNumber={`BOM/${project.id.slice(-6).toUpperCase()}/${now.getFullYear()}`}
      docDate={formatDate(now)}
      backHref={`/projects/${project.id}`}
      recipient={
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Proyek</p>
          <p className="font-semibold">{project.name}</p>
          {project.client && <p className="text-slate-500">Klien: {project.client.name}</p>}
        </div>
      }
    >
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-slate-300 text-left text-xs uppercase text-slate-500">
            <th className="py-1.5">Item</th>
            <th className="py-1.5 text-center">Qty</th>
            <th className="py-1.5 text-right">Harga Satuan</th>
            <th className="py-1.5 text-right">Total</th>
            <th className="py-1.5 text-right">Sumber</th>
          </tr>
        </thead>
        <tbody>
          {project.items.map((it) => (
            <tr key={it.id} className="border-b border-slate-100">
              <td className="py-2">{it.name}</td>
              <td className="py-2 text-center tabular-nums">{it.quantity}</td>
              <td className="py-2 text-right tabular-nums">{formatIDR(toNum(it.unitPrice))}</td>
              <td className="py-2 text-right tabular-nums">{formatIDR(toNum(it.totalPrice))}</td>
              <td className="py-2 text-right text-slate-500">
                {ITEM_SOURCE[it.source as ItemSource].label}
              </td>
            </tr>
          ))}
          {project.items.length === 0 && (
            <tr>
              <td colSpan={5} className="py-4 text-center text-slate-400">
                Belum ada item.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {project.additionalCosts.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Biaya Tambahan
          </p>
          <table className="w-full border-collapse text-sm">
            <tbody>
              {project.additionalCosts.map((c) => (
                <tr key={c.id} className="border-b border-slate-100">
                  <td className="py-2">{c.name}</td>
                  <td className="py-2 text-right tabular-nums">{formatIDR(toNum(c.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 ml-auto w-full max-w-xs space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">Total Material</span>
          <span className="tabular-nums">{formatIDR(itemsTotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Biaya Tambahan</span>
          <span className="tabular-nums">{formatIDR(costsTotal)}</span>
        </div>
        <div className="flex justify-between border-t border-slate-300 pt-1 font-bold">
          <span>Total Kebutuhan</span>
          <span className="tabular-nums">{formatIDR(grand)}</span>
        </div>
      </div>
    </NotaDocument>
  );
}
