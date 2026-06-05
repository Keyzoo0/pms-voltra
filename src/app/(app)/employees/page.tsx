import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { db } from "@/lib/db";
import { ACTIVE_STATUSES, EMPLOYEE_STATUS, type EmployeeStatus, type ProjectStatus } from "@/lib/constants";
import { formatDate, formatIDR, toNum } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Karyawan" };

export default async function EmployeesPage() {
  const employees = await db.employee.findMany({
    include: {
      roles: { orderBy: { name: "asc" } },
      assignments: {
        include: { project: { select: { id: true, status: true } } },
      },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  const activeCount = employees.filter((e) => e.status === "active").length;
  const idleCount = employees.filter(
    (e) =>
      e.status === "active" &&
      !e.assignments.some((a) =>
        ACTIVE_STATUSES.includes(a.project.status as ProjectStatus),
      ),
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Karyawan"
        description={`${employees.length} karyawan · ${activeCount} aktif · ${idleCount} idle`}
        actions={
          <Button asChild>
            <Link href="/employees/new">
              <Plus /> Karyawan Baru
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="px-0 pb-0">
          {employees.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Karyawan</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Aktivitas</TableHead>
                  <TableHead className="text-right">Total Fee</TableHead>
                  <TableHead className="pr-5">Bergabung</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((e) => {
                  const activeProjects = e.assignments.filter((a) =>
                    ACTIVE_STATUSES.includes(a.project.status as ProjectStatus),
                  ).length;
                  const totalFee = e.assignments.reduce(
                    (s, a) => s + toNum(a.fee),
                    0,
                  );
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="pl-5">
                        <Link href={`/employees/${e.id}`} className="flex items-center gap-3">
                          <Avatar name={e.name} />
                          <div className="min-w-0">
                            <p className="font-medium hover:text-primary">{e.name}</p>
                            {e.contact && (
                              <p className="truncate text-xs text-muted-foreground">
                                {e.contact}
                              </p>
                            )}
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {e.roles.slice(0, 2).map((r) => (
                            <Badge key={r.id} variant="secondary" className="text-[10px]">
                              {r.name}
                            </Badge>
                          ))}
                          {e.roles.length > 2 && (
                            <Badge variant="secondary" className="text-[10px]">
                              +{e.roles.length - 2}
                            </Badge>
                          )}
                          {e.roles.length === 0 && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {e.status === "inactive" ? (
                          <StatusBadge meta={EMPLOYEE_STATUS["inactive" as EmployeeStatus]} />
                        ) : activeProjects > 0 ? (
                          <Badge variant="default">{activeProjects} proyek aktif</Badge>
                        ) : (
                          <Badge variant="warning">Idle</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatIDR(totalFee)}
                      </TableCell>
                      <TableCell className="pr-5 text-sm text-muted-foreground">
                        {formatDate(e.joinedAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="p-5">
              <EmptyState
                icon={Users}
                title="Belum ada karyawan"
                description="Tambahkan karyawan untuk mulai meng-assign ke proyek."
                action={
                  <Button asChild>
                    <Link href="/employees/new">
                      <Plus /> Karyawan Baru
                    </Link>
                  </Button>
                }
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
