import type { Metadata } from "next";
import Link from "next/link";
import { FileSpreadsheet, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { computeProjectFinance } from "@/lib/finance";
import { PROJECT_STATUS, type ProjectStatus } from "@/lib/constants";
import { formatIDR } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PeriodFilter } from "@/components/period-filter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Keuangan" };

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year } = await searchParams;

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

  const years = [
    ...new Set(projects.map((p) => (p.startDate ?? p.createdAt).getFullYear())),
  ].sort((a, b) => b - a);

  const filtered =
    year && year !== "all"
      ? projects.filter(
          (p) => String((p.startDate ?? p.createdAt).getFullYear()) === year,
        )
      : projects;

  const rows = filtered.map((p) => ({ p, fin: computeProjectFinance(p) }));
  const sum = (pick: (r: (typeof rows)[number]) => number) =>
    rows.reduce((s, r) => s + pick(r), 0);

  const totalRevenue = sum((r) => r.fin.revenue);
  const totalMaterial = sum((r) => r.fin.materialCompany);
  const totalAdditional = sum((r) => r.fin.additional);
  const totalFees = sum((r) => r.fin.fees);
  const totalExpense = sum((r) => r.fin.expense);
  const totalProfit = totalRevenue - totalExpense;
  const totalReceived = sum((r) => r.fin.paid);
  const totalOutstanding = sum((r) => r.fin.outstanding);
  const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan Keuangan"
        description="Ringkasan laba rugi keseluruhan bisnis & per proyek."
        actions={
          <div className="flex items-center gap-2">
            <PeriodFilter years={years} />
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/export/finance?year=${year ?? "all"}`}>
                <FileSpreadsheet /> Export Excel
              </a>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Pendapatan" value={formatIDR(totalRevenue)} icon={Wallet} accent="primary" />
        <StatCard label="Total Pengeluaran" value={formatIDR(totalExpense)} icon={TrendingDown} accent="rose" />
        <StatCard label="Profit Perusahaan" value={formatIDR(totalProfit)} icon={TrendingUp} accent="emerald" hint={`Margin ${margin.toFixed(1)}%`} />
        <StatCard label="Outstanding" value={formatIDR(totalOutstanding)} accent="amber" hint={`${formatIDR(totalReceived)} diterima`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rincian Pengeluaran</CardTitle>
          <CardDescription>Komposisi total pengeluaran perusahaan.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { label: "Material (perusahaan)", value: totalMaterial, color: "bg-rose-500" },
              { label: "Biaya Tambahan", value: totalAdditional, color: "bg-amber-500" },
              { label: "Fee Karyawan", value: totalFees, color: "bg-indigo-500" },
            ].map((it) => {
              const pct = totalExpense > 0 ? (it.value / totalExpense) * 100 : 0;
              return (
                <div key={it.label} className="rounded-lg border border-border/60 p-4">
                  <p className="text-sm text-muted-foreground">{it.label}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{formatIDR(it.value)}</p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div className={`h-full rounded-full ${it.color}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{pct.toFixed(0)}% dari pengeluaran</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Laba Rugi per Proyek</CardTitle>
          <CardDescription>
            {filtered.length} proyek{year && year !== "all" ? ` · tahun ${year}` : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {rows.length ? (
            <>
            {/* Mobile: cards */}
            <div className="divide-y divide-border/60 md:hidden">
              {rows.map(({ p, fin }) => (
                <Link key={p.id} href={`/projects/${p.id}`} className="block p-4 transition-colors hover:bg-muted/40">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate font-medium">{p.name}</p>
                    <StatusBadge meta={PROJECT_STATUS[p.status as ProjectStatus]} />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <span className="text-muted-foreground">Omzet</span>
                    <span className="text-right tabular-nums">{formatIDR(fin.revenue)}</span>
                    <span className="text-muted-foreground">Profit</span>
                    <span className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatIDR(fin.profit)} · {(fin.margin * 100).toFixed(0)}%
                    </span>
                    <span className="text-muted-foreground">Outstanding</span>
                    <span className="text-right tabular-nums">
                      {fin.outstanding > 0 ? (
                        <span className="text-amber-600 dark:text-amber-400">{formatIDR(fin.outstanding)}</span>
                      ) : (
                        "—"
                      )}
                    </span>
                  </div>
                </Link>
              ))}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 bg-muted/40 p-4 text-sm font-semibold">
                <span>Total Profit</span>
                <span className="text-right tabular-nums">{formatIDR(totalProfit)}</span>
              </div>
            </div>
            {/* Desktop: table */}
            <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Proyek</TableHead>
                  <TableHead className="text-right">Omzet</TableHead>
                  <TableHead className="text-right">Pengeluaran</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead className="pr-5 text-right">Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ p, fin }) => (
                  <TableRow key={p.id}>
                    <TableCell className="pl-5">
                      <Link href={`/projects/${p.id}`} className="font-medium hover:text-primary">
                        {p.name}
                      </Link>
                      <div className="mt-0.5">
                        <StatusBadge meta={PROJECT_STATUS[p.status as ProjectStatus]} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatIDR(fin.revenue)}</TableCell>
                    <TableCell className="text-right tabular-nums text-rose-600 dark:text-rose-400">
                      {formatIDR(fin.expense)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatIDR(fin.profit)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {(fin.margin * 100).toFixed(0)}%
                    </TableCell>
                    <TableCell className="pr-5 text-right tabular-nums">
                      {fin.outstanding > 0 ? (
                        <span className="text-amber-600 dark:text-amber-400">{formatIDR(fin.outstanding)}</span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="pl-5 font-semibold">Total</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatIDR(totalRevenue)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatIDR(totalExpense)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatIDR(totalProfit)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{margin.toFixed(0)}%</TableCell>
                  <TableCell className="pr-5 text-right font-semibold tabular-nums">{formatIDR(totalOutstanding)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
            </div>
            </>
          ) : (
            <div className="p-5">
              <EmptyState icon={Wallet} title="Belum ada data keuangan" description="Tambahkan proyek untuk melihat laporan." />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
