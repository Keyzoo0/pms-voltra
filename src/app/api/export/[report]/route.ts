import { cookies } from "next/headers";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { computeProjectFinance } from "@/lib/finance";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import {
  FEE_STATUS,
  ITEM_SOURCE,
  PAYMENT_STATUS,
  PROJECT_STATUS,
  PURCHASE_STATUS,
  type FeeStatus,
  type ItemSource,
  type PaymentStatus,
  type ProjectStatus,
  type PurchaseStatus,
} from "@/lib/constants";
import { formatDate, toNum } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const IDR_FMT = '"Rp"#,##0;[Red]-"Rp"#,##0';
const HEADER_FILL = "FF4F46E5";

type Col = Partial<ExcelJS.Column> & { header: string; key: string };

function makeSheet(wb: ExcelJS.Workbook, name: string, columns: Col[]) {
  const ws = wb.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  ws.columns = columns;
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: HEADER_FILL },
  };
  header.alignment = { vertical: "middle", horizontal: "left" };
  header.height = 22;
  return ws;
}

function totalRow(ws: ExcelJS.Worksheet, row: Record<string, unknown>) {
  const r = ws.addRow(row);
  r.font = { bold: true };
  r.eachCell((cell) => {
    cell.border = { top: { style: "thin", color: { argb: "FFCBD5E1" } } };
  });
  return r;
}

function xlsxResponse(buffer: ArrayBuffer, filename: string) {
  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ report: string }> },
) {
  // Auth guard (middleware excludes /api).
  const store = await cookies();
  const valid = await verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!valid) return new Response("Unauthorized", { status: 401 });

  const { report } = await params;
  const url = new URL(request.url);
  const id = url.searchParams.get("id") ?? "";
  const year = url.searchParams.get("year") ?? "all";
  const stamp = new Date().toISOString().slice(0, 10);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Voltra Techno PMS";
  wb.created = new Date();

  if (report === "project") {
    const project = await db.project.findUnique({
      where: { id },
      include: {
        client: true,
        categories: true,
        assignments: { include: { employee: true, role: true } },
        items: true,
        additionalCosts: true,
        paymentTerms: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!project) return new Response("Not found", { status: 404 });
    const fin = computeProjectFinance(project);

    const info = wb.addWorksheet("Ringkasan P&L");
    info.columns = [
      { key: "k", width: 32 },
      { key: "v", width: 36 },
    ];
    const title = info.addRow([project.name]);
    title.font = { bold: true, size: 14 };
    info.addRow([]);
    const kv = (k: string, v: string | number) => info.addRow({ k, v });
    kv("Klien", project.client?.name ?? "—");
    kv("Status", PROJECT_STATUS[project.status as ProjectStatus].label);
    kv("Progress", `${project.progress}%`);
    kv("Mulai", formatDate(project.startDate));
    kv("Deadline", formatDate(project.deadline));
    kv("Kategori", project.categories.map((c) => c.name).join(", ") || "—");
    info.addRow([]);
    const head = info.addRow(["LABA RUGI", ""]);
    head.font = { bold: true };
    const money = (k: string, v: number) => {
      const r = info.addRow({ k, v });
      r.getCell("v").numFmt = IDR_FMT;
      return r;
    };
    money("Pendapatan (Nilai Kontrak)", fin.revenue);
    money("Material (perusahaan)", fin.materialCompany);
    money("Biaya Tambahan", fin.additional);
    money("Fee Karyawan", fin.fees);
    money("Total Pengeluaran", fin.expense).font = { bold: true };
    const profit = money("Profit Perusahaan", fin.profit);
    profit.font = { bold: true };
    info.addRow({ k: "Margin", v: `${(fin.margin * 100).toFixed(1)}%` });
    info.addRow([]);
    money("Sudah Dibayar Klien", fin.paid);
    money("Outstanding", fin.outstanding);

    const team = makeSheet(wb, "Tim", [
      { header: "Karyawan", key: "name", width: 26 },
      { header: "Role", key: "role", width: 22 },
      { header: "Fee", key: "fee", width: 18, style: { numFmt: IDR_FMT } },
      { header: "Status Fee", key: "status", width: 14 },
    ]);
    for (const a of project.assignments) {
      team.addRow({
        name: a.employee.name,
        role: a.role?.name ?? "—",
        fee: toNum(a.fee),
        status: FEE_STATUS[a.feeStatus as FeeStatus].label,
      });
    }
    totalRow(team, { role: "TOTAL", fee: fin.fees });

    const bom = makeSheet(wb, "BOM", [
      { header: "Item", key: "name", width: 30 },
      { header: "Qty", key: "qty", width: 8 },
      { header: "Harga Satuan", key: "unit", width: 16, style: { numFmt: IDR_FMT } },
      { header: "Total", key: "total", width: 16, style: { numFmt: IDR_FMT } },
      { header: "Sumber", key: "source", width: 14 },
      { header: "Status", key: "status", width: 16 },
    ]);
    for (const it of project.items) {
      bom.addRow({
        name: it.name,
        qty: it.quantity,
        unit: toNum(it.unitPrice),
        total: toNum(it.totalPrice),
        source: ITEM_SOURCE[it.source as ItemSource].label,
        status: PURCHASE_STATUS[it.purchaseStatus as PurchaseStatus].label,
      });
    }
    for (const c of project.additionalCosts) {
      bom.addRow({ name: c.name, source: "Biaya Tambahan", total: toNum(c.amount) });
    }

    const pay = makeSheet(wb, "Termin", [
      { header: "Termin", key: "term", width: 24 },
      { header: "%", key: "pct", width: 8 },
      { header: "Nominal", key: "amount", width: 18, style: { numFmt: IDR_FMT } },
      { header: "Status", key: "status", width: 14 },
      { header: "Tgl Bayar", key: "paid", width: 16 },
    ]);
    for (const t of project.paymentTerms) {
      pay.addRow({
        term: t.termName,
        pct: toNum(t.percentage),
        amount: toNum(t.amount),
        status: PAYMENT_STATUS[t.status as PaymentStatus].label,
        paid: t.paidAt ? formatDate(t.paidAt) : "—",
      });
    }

    const buffer = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    return xlsxResponse(buffer, `PL_${project.name.replace(/\s+/g, "_")}_${stamp}.xlsx`);
  }

  if (report === "finance") {
    const projects = await db.project.findMany({
      where: { status: { not: "cancelled" } },
      include: {
        client: { select: { name: true } },
        assignments: true,
        items: true,
        additionalCosts: true,
        paymentTerms: true,
      },
      orderBy: { createdAt: "desc" },
    });
    const filtered =
      year !== "all"
        ? projects.filter(
            (p) => String((p.startDate ?? p.createdAt).getFullYear()) === year,
          )
        : projects;

    const ws = makeSheet(wb, "Laba Rugi", [
      { header: "Proyek", key: "name", width: 30 },
      { header: "Klien", key: "client", width: 24 },
      { header: "Status", key: "status", width: 14 },
      { header: "Omzet", key: "rev", width: 16, style: { numFmt: IDR_FMT } },
      { header: "Material", key: "mat", width: 15, style: { numFmt: IDR_FMT } },
      { header: "Biaya Tambahan", key: "add", width: 15, style: { numFmt: IDR_FMT } },
      { header: "Fee", key: "fee", width: 15, style: { numFmt: IDR_FMT } },
      { header: "Pengeluaran", key: "exp", width: 16, style: { numFmt: IDR_FMT } },
      { header: "Profit", key: "profit", width: 16, style: { numFmt: IDR_FMT } },
      { header: "Diterima", key: "paid", width: 16, style: { numFmt: IDR_FMT } },
      { header: "Outstanding", key: "out", width: 16, style: { numFmt: IDR_FMT } },
    ]);

    let tRev = 0, tMat = 0, tAdd = 0, tFee = 0, tExp = 0, tProfit = 0, tPaid = 0, tOut = 0;
    for (const p of filtered) {
      const f = computeProjectFinance(p);
      tRev += f.revenue; tMat += f.materialCompany; tAdd += f.additional;
      tFee += f.fees; tExp += f.expense; tProfit += f.profit; tPaid += f.paid; tOut += f.outstanding;
      ws.addRow({
        name: p.name,
        client: p.client?.name ?? "—",
        status: PROJECT_STATUS[p.status as ProjectStatus].label,
        rev: f.revenue, mat: f.materialCompany, add: f.additional, fee: f.fees,
        exp: f.expense, profit: f.profit, paid: f.paid, out: f.outstanding,
      });
    }
    totalRow(ws, {
      name: "TOTAL", rev: tRev, mat: tMat, add: tAdd, fee: tFee,
      exp: tExp, profit: tProfit, paid: tPaid, out: tOut,
    });

    const buffer = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    return xlsxResponse(buffer, `Laporan_Keuangan_${year}_${stamp}.xlsx`);
  }

  if (report === "fees") {
    const assignments = await db.projectAssignment.findMany({
      include: {
        employee: { select: { name: true } },
        role: { select: { name: true } },
        project: { select: { name: true } },
      },
      orderBy: { assignedAt: "desc" },
    });
    const filtered =
      year !== "all"
        ? assignments.filter((a) => String(a.assignedAt.getFullYear()) === year)
        : assignments;

    const recap = new Map<string, { name: string; count: number; total: number; paid: number; pending: number }>();
    for (const a of filtered) {
      const fee = toNum(a.fee);
      const r = recap.get(a.employee.name) ?? { name: a.employee.name, count: 0, total: 0, paid: 0, pending: 0 };
      r.count += 1; r.total += fee;
      if (a.feeStatus === "paid") r.paid += fee; else r.pending += fee;
      recap.set(a.employee.name, r);
    }
    const rows = [...recap.values()].sort((a, b) => b.total - a.total);

    const ws = makeSheet(wb, "Rekap Fee", [
      { header: "Karyawan", key: "name", width: 28 },
      { header: "Assignment", key: "count", width: 12 },
      { header: "Total Fee", key: "total", width: 18, style: { numFmt: IDR_FMT } },
      { header: "Sudah Cair", key: "paid", width: 18, style: { numFmt: IDR_FMT } },
      { header: "Pending", key: "pending", width: 18, style: { numFmt: IDR_FMT } },
    ]);
    let gt = 0, gp = 0, gpe = 0;
    for (const r of rows) {
      gt += r.total; gp += r.paid; gpe += r.pending;
      ws.addRow(r);
    }
    totalRow(ws, { name: "TOTAL", total: gt, paid: gp, pending: gpe });

    const detail = makeSheet(wb, "Detail", [
      { header: "Karyawan", key: "emp", width: 26 },
      { header: "Proyek", key: "proj", width: 30 },
      { header: "Role", key: "role", width: 20 },
      { header: "Fee", key: "fee", width: 16, style: { numFmt: IDR_FMT } },
      { header: "Status", key: "status", width: 12 },
      { header: "Tanggal", key: "date", width: 16 },
    ]);
    for (const a of filtered) {
      detail.addRow({
        emp: a.employee.name,
        proj: a.project.name,
        role: a.role?.name ?? "—",
        fee: toNum(a.fee),
        status: FEE_STATUS[a.feeStatus as FeeStatus].label,
        date: formatDate(a.assignedAt),
      });
    }

    const buffer = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    return xlsxResponse(buffer, `Rekap_Fee_${year}_${stamp}.xlsx`);
  }

  return new Response("Unknown report", { status: 400 });
}
