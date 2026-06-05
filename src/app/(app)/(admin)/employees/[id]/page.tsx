import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  CalendarDays,
  Mail,
  Pencil,
  Trash2,
  UserCheck,
  UserX,
  Wallet,
} from "lucide-react";
import { db } from "@/lib/db";
import {
  ACTIVE_STATUSES,
  EMPLOYEE_STATUS,
  FEE_STATUS,
  PROJECT_STATUS,
  type EmployeeStatus,
  type FeeStatus,
  type ProjectStatus,
} from "@/lib/constants";
import { formatDate, formatIDR, toNum } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/confirm-dialog";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deactivateEmployee,
  deleteEmployee,
  reactivateEmployee,
} from "../actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const e = await db.employee.findUnique({ where: { id }, select: { name: true } });
  return { title: e?.name ?? "Karyawan" };
}

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const employee = await db.employee.findUnique({
    where: { id },
    include: {
      roles: { orderBy: { name: "asc" } },
      assignments: {
        include: { project: { include: { client: { select: { name: true } } } }, role: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!employee) notFound();

  const totalFee = employee.assignments.reduce((s, a) => s + toNum(a.fee), 0);
  const feePaid = employee.assignments
    .filter((a) => a.feeStatus === "paid")
    .reduce((s, a) => s + toNum(a.fee), 0);
  const feePending = totalFee - feePaid;
  const activeAssignments = employee.assignments.filter((a) =>
    ACTIVE_STATUSES.includes(a.project.status as ProjectStatus),
  );

  return (
    <div className="space-y-6">
      <Link
        href="/employees"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        ← Daftar Karyawan
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={employee.name} className="size-14 text-base" />
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-semibold tracking-tight">{employee.name}</h1>
              <StatusBadge meta={EMPLOYEE_STATUS[employee.status as EmployeeStatus]} />
            </div>
            {employee.username && (
              <p className="mt-0.5 text-xs text-muted-foreground">@{employee.username}</p>
            )}
            {employee.contact && (
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Mail className="size-3.5" /> {employee.contact}
              </p>
            )}
            {employee.status === "inactive" && employee.leftAt && (
              <p className="mt-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                Nonaktif sejak {formatDate(employee.leftAt)}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/employees/${employee.id}/edit`}>
              <Pencil /> Edit
            </Link>
          </Button>

          {employee.status === "active" ? (
            <ConfirmDialog
              action={deactivateEmployee.bind(null, employee.id)}
              variant="default"
              icon={<UserX />}
              confirmLabel="Nonaktifkan"
              title="Nonaktifkan karyawan ini?"
              description={`"${employee.name}" akan ditandai keluar & tidak bisa login lagi. Assignment di proyek yang BELUM selesai akan dilepas (proyek selesai tetap tercatat). Bisa diaktifkan kembali nanti.`}
              trigger={
                <Button
                  variant="outline"
                  size="sm"
                  className="text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
                >
                  <UserX /> Nonaktifkan
                </Button>
              }
            />
          ) : (
            <form action={reactivateEmployee.bind(null, employee.id)}>
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
              >
                <UserCheck /> Aktifkan kembali
              </Button>
            </form>
          )}

          {employee.assignments.length === 0 && (
            <ConfirmDialog
              action={deleteEmployee.bind(null, employee.id)}
              title="Hapus karyawan ini?"
              description={`Data "${employee.name}" akan dihapus permanen. Hanya bisa karena belum punya riwayat proyek.`}
              trigger={
                <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10">
                  <Trash2 /> Hapus
                </Button>
              }
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Fee (lifetime)" value={formatIDR(totalFee)} icon={Wallet} accent="primary" />
        <StatCard label="Fee Sudah Cair" value={formatIDR(feePaid)} icon={BadgeCheck} accent="emerald" />
        <StatCard label="Fee Pending" value={formatIDR(feePending)} accent="amber" />
        <StatCard label="Proyek Aktif" value={activeAssignments.length} accent="violet" hint={`${employee.assignments.length} total`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Role / Keahlian</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {employee.roles.length ? (
                employee.roles.map((r) => (
                  <Badge key={r.id} variant="secondary">
                    {r.name}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">Belum ada role.</span>
              )}
            </div>
            <div className="space-y-1.5 border-t border-border/60 pt-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarDays className="size-4" /> Bergabung: {formatDate(employee.joinedAt)}
              </div>
              {employee.leftAt && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="size-4" /> Keluar: {formatDate(employee.leftAt)}
                </div>
              )}
            </div>
            {employee.notes && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                {employee.notes}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Riwayat Proyek</CardTitle>
            <CardDescription>Semua proyek yang pernah dikerjakan & fee-nya.</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {employee.assignments.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Proyek</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Fee</TableHead>
                    <TableHead>Status Fee</TableHead>
                    <TableHead className="pr-5 text-right">Status Proyek</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employee.assignments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="pl-5">
                        <Link
                          href={`/projects/${a.project.id}`}
                          className="font-medium hover:text-primary"
                        >
                          {a.project.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {a.project.client?.name ?? "Tanpa klien"}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {a.role?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatIDR(toNum(a.fee))}
                      </TableCell>
                      <TableCell>
                        <StatusBadge meta={FEE_STATUS[a.feeStatus as FeeStatus]} />
                      </TableCell>
                      <TableCell className="pr-5 text-right">
                        <StatusBadge meta={PROJECT_STATUS[a.project.status as ProjectStatus]} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-5">
                <EmptyState
                  icon={Wallet}
                  title="Belum ada riwayat proyek"
                  description="Karyawan ini belum di-assign ke proyek manapun."
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
