import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, FileSpreadsheet, ReceiptText, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { toNum, formatIDR } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { PeriodFilter } from "@/components/period-filter";
import { Card, CardContent } from "@/components/ui/card";
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
export const metadata: Metadata = { title: "Rekap Fee" };

type Recap = {
  id: string;
  name: string;
  count: number;
  total: number;
  paid: number;
  pending: number;
};

export default async function FeesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year } = await searchParams;

  const assignments = await db.projectAssignment.findMany({
    include: {
      employee: { select: { id: true, name: true } },
      project: { select: { name: true } },
    },
    orderBy: { assignedAt: "desc" },
  });

  const years = [
    ...new Set(assignments.map((a) => a.assignedAt.getFullYear())),
  ].sort((a, b) => b - a);

  const filtered =
    year && year !== "all"
      ? assignments.filter((a) => String(a.assignedAt.getFullYear()) === year)
      : assignments;

  const byEmployee = new Map<string, Recap>();
  for (const a of filtered) {
    const fee = toNum(a.fee);
    const r =
      byEmployee.get(a.employee.id) ??
      { id: a.employee.id, name: a.employee.name, count: 0, total: 0, paid: 0, pending: 0 };
    r.count += 1;
    r.total += fee;
    if (a.feeStatus === "paid") r.paid += fee;
    else r.pending += fee;
    byEmployee.set(a.employee.id, r);
  }
  const recaps = [...byEmployee.values()].sort((a, b) => b.total - a.total);

  const grandTotal = recaps.reduce((s, r) => s + r.total, 0);
  const grandPaid = recaps.reduce((s, r) => s + r.paid, 0);
  const grandPending = recaps.reduce((s, r) => s + r.pending, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rekap Fee Karyawan"
        description="Total fee per karyawan beserta status pencairan."
        actions={
          <div className="flex items-center gap-2">
            <PeriodFilter years={years} />
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/export/fees?year=${year ?? "all"}`}>
                <FileSpreadsheet /> Export Excel
              </a>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Fee" value={formatIDR(grandTotal)} icon={Wallet} accent="primary" />
        <StatCard label="Sudah Dicairkan" value={formatIDR(grandPaid)} icon={BadgeCheck} accent="emerald" />
        <StatCard label="Belum Dicairkan" value={formatIDR(grandPending)} accent="amber" />
      </div>

      <Card>
        <CardContent className="px-0 pb-0">
          {recaps.length ? (
            <>
            {/* Mobile: cards */}
            <div className="divide-y divide-border/60 md:hidden">
              {recaps.map((r) => (
                <Link key={r.id} href={`/employees/${r.id}`} className="flex items-center gap-3 p-4 transition-colors hover:bg-muted/40">
                  <Avatar name={r.name} className="size-9" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-medium">{r.name}</p>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">{formatIDR(r.total)}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                      <span className="text-muted-foreground">{r.count} assignment</span>
                      <span className="text-emerald-600 dark:text-emerald-400">cair {formatIDR(r.paid)}</span>
                      <span className="text-amber-600 dark:text-amber-400">pending {formatIDR(r.pending)}</span>
                    </div>
                  </div>
                </Link>
              ))}
              <div className="flex items-center justify-between gap-2 bg-muted/40 p-4 text-sm font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatIDR(grandTotal)}</span>
              </div>
            </div>
            {/* Desktop: table */}
            <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Karyawan</TableHead>
                  <TableHead className="text-center">Assignment</TableHead>
                  <TableHead className="text-right">Total Fee</TableHead>
                  <TableHead className="text-right">Sudah Cair</TableHead>
                  <TableHead className="pr-5 text-right">Pending</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recaps.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="pl-5">
                      <Link href={`/employees/${r.id}`} className="flex items-center gap-2.5">
                        <Avatar name={r.name} className="size-8" />
                        <span className="font-medium hover:text-primary">{r.name}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-center tabular-nums text-muted-foreground">
                      {r.count}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatIDR(r.total)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatIDR(r.paid)}
                    </TableCell>
                    <TableCell className="pr-5 text-right tabular-nums text-amber-600 dark:text-amber-400">
                      {formatIDR(r.pending)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="pl-5 font-semibold" colSpan={2}>
                    Total
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatIDR(grandTotal)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatIDR(grandPaid)}</TableCell>
                  <TableCell className="pr-5 text-right font-semibold tabular-nums">{formatIDR(grandPending)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
            </div>
            </>
          ) : (
            <div className="p-5">
              <EmptyState
                icon={ReceiptText}
                title="Belum ada data fee"
                description="Assign karyawan ke proyek dengan fee untuk melihat rekap."
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
