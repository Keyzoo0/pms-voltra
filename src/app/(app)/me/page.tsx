import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BadgeCheck, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import {
  FEE_STATUS,
  PROJECT_STATUS,
  type FeeStatus,
  type ProjectStatus,
} from "@/lib/constants";
import { formatIDR, toNum } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
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
import { ProfileForm, PasswordForm } from "./profile-forms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profil Saya" };

export default async function MePage() {
  const session = await requireSession();
  if (session.role !== "employee") redirect("/");

  const employee = await db.employee.findUnique({
    where: { id: session.uid },
    include: {
      roles: { orderBy: { name: "asc" } },
      assignments: {
        include: { project: { select: { id: true, name: true, status: true } }, role: true },
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar name={employee.name} className="size-14 text-base" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{employee.name}</h1>
          <p className="text-sm text-muted-foreground">
            @{employee.username ?? "—"} ·{" "}
            {employee.roles.map((r) => r.name).join(", ") || "Tanpa role"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Fee Saya" value={formatIDR(totalFee)} icon={Wallet} accent="primary" />
        <StatCard label="Sudah Cair" value={formatIDR(feePaid)} icon={BadgeCheck} accent="emerald" />
        <StatCard label="Pending" value={formatIDR(feePending)} accent="amber" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ProfileForm contact={employee.contact} notes={employee.notes} />
        <PasswordForm />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fee per Proyek</CardTitle>
          <CardDescription>Rincian fee Anda di setiap proyek.</CardDescription>
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
                      <Link href={`/projects/${a.project.id}`} className="font-medium hover:text-primary">
                        {a.project.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{a.role?.name ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatIDR(toNum(a.fee))}</TableCell>
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
              <EmptyState icon={Wallet} title="Belum ada fee" description="Anda belum di-assign ke proyek." />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
