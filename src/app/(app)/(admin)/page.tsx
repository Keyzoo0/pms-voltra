import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  FolderKanban,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { db } from "@/lib/db";
import { computeProjectFinance, sumBy } from "@/lib/finance";
import {
  ACTIVE_STATUSES,
  PROJECT_STATUS,
  type ProjectStatus,
} from "@/lib/constants";
import { cn, daysUntil, formatDate, formatIDR, toNum } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CashflowChart,
  StatusDonut,
} from "@/components/dashboard/dashboard-charts";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<ProjectStatus, string> = {
  inquiry: "#94a3b8",
  quotation: "#0ea5e9",
  approved: "#8b5cf6",
  in_progress: "#f59e0b",
  delivered: "#06b6d4",
  paid: "#10b981",
  closed: "#475569",
  on_hold: "#f97316",
  cancelled: "#cbd5e1",
  dispute: "#ef4444",
};

function trackBadge(deadline: Date | null) {
  const d = daysUntil(deadline);
  if (d === null) return null;
  if (d < 0)
    return (
      <Badge variant="destructive">Telat {Math.abs(d)}h</Badge>
    );
  if (d <= 5) return <Badge variant="warning">{d}h lagi</Badge>;
  return <Badge variant="success">On track</Badge>;
}

export default async function DashboardPage() {
  const [projects, employees] = await Promise.all([
    db.project.findMany({
      include: {
        client: true,
        assignments: true,
        items: true,
        additionalCosts: true,
        paymentTerms: true,
      },
      orderBy: { deadline: "asc" },
    }),
    db.employee.findMany({
      where: { status: "active" },
      include: {
        assignments: { include: { project: { select: { status: true } } } },
      },
    }),
  ]);

  const finance = new Map(
    projects.map((p) => [p.id, computeProjectFinance(p)]),
  );

  const activeProjects = projects.filter((p) =>
    ACTIVE_STATUSES.includes(p.status as ProjectStatus),
  );
  const live = projects.filter((p) => p.status !== "cancelled");

  const idleEmployees = employees.filter(
    (emp) =>
      !emp.assignments.some((a) =>
        ACTIVE_STATUSES.includes(a.project.status as ProjectStatus),
      ),
  ).length;
  const workingEmployees = employees.length - idleEmployees;

  const totalRevenue = sumBy(live, (p) => finance.get(p.id)!.revenue);
  const totalExpense = sumBy(live, (p) => finance.get(p.id)!.expense);
  const totalReceived = sumBy(live, (p) => finance.get(p.id)!.paid);
  const totalOutstanding = sumBy(live, (p) => finance.get(p.id)!.outstanding);
  const totalProfit = totalRevenue - totalExpense;
  const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  // Cashflow — last 6 months of received payments.
  const now = new Date();
  const buckets = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      y: d.getFullYear(),
      m: d.getMonth(),
      label: new Intl.DateTimeFormat("id-ID", { month: "short" }).format(d),
      value: 0,
    };
  });
  for (const p of projects) {
    for (const t of p.paymentTerms) {
      if (t.status === "paid" && t.paidAt) {
        const d = new Date(t.paidAt);
        const b = buckets.find(
          (x) => x.y === d.getFullYear() && x.m === d.getMonth(),
        );
        if (b) b.value += toNum(t.amount);
      }
    }
  }
  const cashData = buckets.map((b) => ({ label: b.label, value: b.value }));

  // Status distribution donut.
  const statusCounts = new Map<ProjectStatus, number>();
  for (const p of projects) {
    const s = p.status as ProjectStatus;
    statusCounts.set(s, (statusCounts.get(s) ?? 0) + 1);
  }
  const donutData = [...statusCounts.entries()]
    .map(([s, v]) => ({
      name: PROJECT_STATUS[s].label,
      value: v,
      color: STATUS_COLORS[s],
    }))
    .sort((a, b) => b.value - a.value);

  const deadlineSoon = activeProjects
    .filter((p) => {
      const d = daysUntil(p.deadline);
      return d !== null && d >= 0 && d <= 7;
    })
    .slice(0, 5);

  const outstandingProjects = live
    .filter((p) => finance.get(p.id)!.outstanding > 0)
    .filter((p) =>
      (["in_progress", "delivered", "on_hold", "dispute", "approved"] as ProjectStatus[]).includes(
        p.status as ProjectStatus,
      ),
    )
    .sort((a, b) => finance.get(b.id)!.outstanding - finance.get(a.id)!.outstanding)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Ringkasan bisnis Voltra Techno per{" "}
          {new Intl.DateTimeFormat("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }).format(now)}
          .
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Proyek Aktif"
          value={activeProjects.length}
          icon={FolderKanban}
          accent="primary"
          hint={`${projects.length} proyek total`}
        />
        <StatCard
          label="Karyawan Aktif"
          value={employees.length}
          icon={Users}
          accent="violet"
          hint={`${workingEmployees} bekerja · ${idleEmployees} idle`}
        />
        <StatCard
          label="Outstanding Payment"
          value={formatIDR(totalOutstanding)}
          icon={Wallet}
          accent="amber"
          hint={`${formatIDR(totalReceived)} sudah diterima`}
        />
        <StatCard
          label="Profit Perusahaan"
          value={formatIDR(totalProfit)}
          icon={TrendingUp}
          accent="emerald"
          hint={`Margin ${margin.toFixed(0)}% · omzet ${formatIDR(totalRevenue)}`}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Arus Kas Pembayaran</CardTitle>
            <CardDescription>
              Pembayaran klien diterima dalam 6 bulan terakhir.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CashflowChart data={cashData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Proyek per Status</CardTitle>
            <CardDescription>Distribusi lifecycle proyek.</CardDescription>
          </CardHeader>
          <CardContent>
            {donutData.length > 0 ? (
              <>
                <StatusDonut data={donutData} />
                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {donutData.map((d) => (
                    <div
                      key={d.name}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: d.color }}
                      />
                      <span className="truncate text-muted-foreground">
                        {d.name}
                      </span>
                      <span className="ml-auto font-medium tabular-nums">
                        {d.value}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Belum ada proyek.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Active projects + alerts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Proyek Berjalan</CardTitle>
              <CardDescription>
                Progress & deadline proyek yang sedang dikerjakan.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/projects">
                Semua proyek <ArrowUpRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {activeProjects.length > 0 ? (
              <>
              {/* Mobile: cards */}
              <div className="divide-y divide-border/60 md:hidden">
                {activeProjects.slice(0, 6).map((p) => (
                  <Link key={p.id} href={`/projects/${p.id}`} className="block p-4 transition-colors hover:bg-muted/40">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{p.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{p.client?.name ?? "Tanpa klien"}</p>
                      </div>
                      <StatusBadge meta={PROJECT_STATUS[p.status as ProjectStatus]} />
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Progress value={p.progress} className="w-24" />
                        <span className="text-xs tabular-nums text-muted-foreground">{p.progress}%</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatDate(p.deadline)}</span>
                        {trackBadge(p.deadline)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              {/* Desktop: table */}
              <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Proyek</TableHead>
                    <TableHead className="w-40">Progress</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead className="pr-5 text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeProjects.slice(0, 6).map((p) => (
                    <TableRow key={p.id} className="group">
                      <TableCell className="pl-5">
                        <Link
                          href={`/projects/${p.id}`}
                          className="font-medium text-foreground hover:text-primary"
                        >
                          {p.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {p.client?.name ?? "Tanpa klien"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={p.progress} className="w-20" />
                          <span className="text-xs font-medium tabular-nums text-muted-foreground">
                            {p.progress}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm text-muted-foreground">
                            {formatDate(p.deadline)}
                          </span>
                          {trackBadge(p.deadline)}
                        </div>
                      </TableCell>
                      <TableCell className="pr-5 text-right">
                        <StatusBadge
                          meta={PROJECT_STATUS[p.status as ProjectStatus]}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
              </>
            ) : (
              <div className="p-5">
                <EmptyState
                  icon={FolderKanban}
                  title="Belum ada proyek berjalan"
                  description="Proyek dengan status Approved, In Progress, atau Delivered akan tampil di sini."
                />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <CalendarClock className="size-4 text-amber-500" />
                Mendekati Deadline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {deadlineSoon.length > 0 ? (
                deadlineSoon.map((p) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(p.deadline)}
                      </p>
                    </div>
                    {trackBadge(p.deadline)}
                  </Link>
                ))
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Tidak ada deadline dalam 7 hari ke depan. 🎉
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <AlertTriangle className="size-4 text-rose-500" />
                Pembayaran Outstanding
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {outstandingProjects.length > 0 ? (
                outstandingProjects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.client?.name ?? "Tanpa klien"}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-rose-600 tabular-nums dark:text-rose-400">
                      {formatIDR(finance.get(p.id)!.outstanding)}
                    </span>
                  </Link>
                ))
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Semua pembayaran lunas. 👍
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
