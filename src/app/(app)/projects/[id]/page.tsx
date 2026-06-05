import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Building2,
  CalendarDays,
  CreditCard,
  Crown,
  ExternalLink,
  FileSpreadsheet,
  Package,
  Pencil,
  Receipt,
  Trash2,
  Users,
} from "lucide-react";
import { db } from "@/lib/db";
import { computeProjectFinance } from "@/lib/finance";
import { getProjectAccess, requireSession } from "@/lib/session";
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
import { cn, formatDate, formatIDR, toNum } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AddAssignmentDialog,
  AddCostForm,
  AddItemDialog,
  AddPaymentTermDialog,
  ProgressControl,
  StatusControl,
} from "./controls";
import {
  cycleItemStatus,
  deleteAssignment,
  deleteCost,
  deleteItem,
  deletePaymentTerm,
  deleteProject,
  generateDefaultTerms,
  setAssignmentManager,
  togglePaymentTerm,
  toggleFeeStatus,
} from "../actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const p = await db.project.findUnique({ where: { id }, select: { name: true } });
  return { title: p?.name ?? "Proyek" };
}

function Row({
  label,
  value,
  strong,
  accent,
}: {
  label: string;
  value: string;
  strong?: boolean;
  accent?: "emerald" | "rose";
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className={cn("text-sm", strong ? "font-medium" : "text-muted-foreground")}>
        {label}
      </span>
      <span
        className={cn(
          "text-sm tabular-nums",
          strong ? "font-semibold" : "font-medium",
          accent === "emerald" && "text-emerald-600 dark:text-emerald-400",
          accent === "rose" && "text-rose-600 dark:text-rose-400",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function IconButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
    >
      {children}
    </button>
  );
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

  const project = await db.project.findUnique({
    where: { id },
    include: {
      client: true,
      categories: { orderBy: { name: "asc" } },
      requiredRoles: { orderBy: { name: "asc" } },
      assignments: {
        include: { employee: true, role: true },
        orderBy: { createdAt: "asc" },
      },
      items: { orderBy: { createdAt: "asc" } },
      additionalCosts: { orderBy: { createdAt: "asc" } },
      paymentTerms: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!project) notFound();

  const access = await getProjectAccess(project.id, session);
  if (!access) notFound(); // employee not assigned → no access

  const isAdmin = access === "admin";
  const canManage = isAdmin || access === "manager";
  const myAssignment = !isAdmin
    ? project.assignments.find((a) => a.employee.id === session.uid)
    : null;

  const [employees, roles] = isAdmin
    ? await Promise.all([
        db.employee.findMany({
          where: { status: "active" },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
        db.role.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      ])
    : [[], []];

  const fin = computeProjectFinance(project);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/projects"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          ← {isAdmin ? "Daftar Proyek" : "Proyek Saya"}
        </Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
              <StatusBadge meta={PROJECT_STATUS[project.status as ProjectStatus]} />
              {access === "manager" && (
                <Badge variant="default" className="gap-1">
                  <Crown className="size-3" /> Anda PM
                </Badge>
              )}
            </div>
            {project.client && isAdmin && (
              <Link
                href={`/clients/${project.client.id}`}
                className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
              >
                <Building2 className="size-3.5" />
                {project.client.name}
              </Link>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {isAdmin && (
              <Button variant="outline" size="sm" asChild>
                <a href={`/api/export/project?id=${project.id}`}>
                  <FileSpreadsheet /> Export P&L
                </a>
              </Button>
            )}
            {canManage && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/projects/${project.id}/edit`}>
                  <Pencil /> Edit
                </Link>
              </Button>
            )}
            {isAdmin && (
              <ConfirmDialog
                action={deleteProject.bind(null, project.id)}
                title="Hapus proyek ini?"
                description={`"${project.name}" beserta semua assignment, BOM, dan termin pembayaran akan dihapus permanen.`}
                trigger={
                  <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10">
                    <Trash2 /> Hapus
                  </Button>
                }
              />
            )}
          </div>
        </div>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Detail Proyek</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {project.description && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {project.description}
              </p>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-2 text-sm">
                <CalendarDays className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">Mulai:</span>
                <span className="font-medium">{formatDate(project.startDate)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CalendarDays className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">Deadline:</span>
                <span className="font-medium">{formatDate(project.deadline)}</span>
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Kategori
              </p>
              <div className="flex flex-wrap gap-1.5">
                {project.categories.length ? (
                  project.categories.map((c) => (
                    <Badge key={c.id} variant="secondary">
                      {c.name}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Role Dibutuhkan
              </p>
              <div className="flex flex-wrap gap-1.5">
                {project.requiredRoles.length ? (
                  project.requiredRoles.map((r) => (
                    <Badge key={r.id} variant="outline">
                      {r.name}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>
            </div>

            {project.notes && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Catatan: </span>
                {project.notes}
              </div>
            )}

            <div className="space-y-2 border-t border-border/60 pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Progress
              </p>
              <ProgressControl projectId={project.id} progress={project.progress} />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {canManage ? (
                <StatusControl projectId={project.id} status={project.status} />
              ) : (
                <StatusBadge meta={PROJECT_STATUS[project.status as ProjectStatus]} />
              )}
              {isAdmin && (
                <>
                  <div className="rounded-lg border border-border/60 p-3">
                    <Row label="Nilai Kontrak" value={formatIDR(fin.revenue)} />
                    <Row label="Total Pengeluaran" value={formatIDR(fin.expense)} />
                    <div className="my-1 border-t border-border/60" />
                    <Row
                      label="Profit"
                      value={formatIDR(fin.profit)}
                      strong
                      accent={fin.profit >= 0 ? "emerald" : "rose"}
                    />
                    <Row label="Margin" value={`${(fin.margin * 100).toFixed(1)}%`} />
                  </div>
                  <div className="rounded-lg border border-border/60 p-3">
                    <Row label="Sudah Dibayar" value={formatIDR(fin.paid)} accent="emerald" />
                    <Row
                      label="Outstanding"
                      value={formatIDR(fin.outstanding)}
                      accent={fin.outstanding > 0 ? "rose" : undefined}
                    />
                    {fin.isFullyPaid && (
                      <Badge variant="success" className="mt-2">
                        Lunas 100%
                      </Badge>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {!isAdmin && myAssignment && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Fee Saya</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold tabular-nums">
                    {formatIDR(toNum(myAssignment.fee))}
                  </span>
                  <StatusBadge meta={FEE_STATUS[myAssignment.feeStatus as FeeStatus]} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Peran: {myAssignment.role?.name ?? "—"}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={isAdmin ? "pnl" : "team"}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start sm:w-auto">
          {isAdmin && (
            <TabsTrigger value="pnl">
              <Receipt /> Laba Rugi
            </TabsTrigger>
          )}
          <TabsTrigger value="team">
            <Users /> Tim ({project.assignments.length})
          </TabsTrigger>
          <TabsTrigger value="bom">
            <Package /> Kebutuhan ({project.items.length})
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="payment">
              <CreditCard /> Pembayaran ({project.paymentTerms.length})
            </TabsTrigger>
          )}
        </TabsList>

        {/* P&L (admin) */}
        {isAdmin && (
          <TabsContent value="pnl">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Laporan Laba Rugi (P&L)</CardTitle>
                  <CardDescription>Pendapatan dikurangi seluruh pengeluaran.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Row label="Pendapatan (Nilai Kontrak)" value={formatIDR(fin.revenue)} strong />
                  <div className="my-2 border-t border-border/60" />
                  <p className="py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Pengeluaran
                  </p>
                  <Row label="Material (dari perusahaan)" value={formatIDR(fin.materialCompany)} />
                  <Row label="Biaya Tambahan" value={formatIDR(fin.additional)} />
                  <Row label="Total Fee Karyawan" value={formatIDR(fin.fees)} />
                  <div className="my-2 border-t border-border/60" />
                  <Row label="Total Pengeluaran" value={formatIDR(fin.expense)} strong accent="rose" />
                  <div className="my-2 border-t-2 border-border" />
                  <Row
                    label="Profit Perusahaan"
                    value={formatIDR(fin.profit)}
                    strong
                    accent={fin.profit >= 0 ? "emerald" : "rose"}
                  />
                  <p className="pt-1 text-right text-xs text-muted-foreground">
                    Margin {(fin.margin * 100).toFixed(1)}%
                  </p>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Sumber Material</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Row label="Dari Perusahaan (pengeluaran)" value={formatIDR(fin.materialCompany)} accent="rose" />
                    <Row label="Dari Klien (tercatat)" value={formatIDR(fin.materialClient)} />
                    <Row label="Reimburse" value={formatIDR(fin.materialReimburse)} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Pencairan Fee Karyawan</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Row label="Sudah Dicairkan" value={formatIDR(fin.feesPaid)} accent="emerald" />
                    <Row label="Belum Dicairkan" value={formatIDR(fin.feesPending)} accent={fin.feesPending > 0 ? "rose" : undefined} />
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        )}

        {/* Team */}
        <TabsContent value="team">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Tim Proyek</CardTitle>
                <CardDescription>
                  {isAdmin
                    ? "Karyawan yang di-assign, fee & kewenangan PM."
                    : "Anggota tim proyek ini."}
                </CardDescription>
              </div>
              {isAdmin && (
                <AddAssignmentDialog projectId={project.id} employees={employees} roles={roles} />
              )}
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {project.assignments.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-5">Karyawan</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>PM</TableHead>
                      {isAdmin && <TableHead className="text-right">Fee</TableHead>}
                      {isAdmin && <TableHead>Status Fee</TableHead>}
                      {isAdmin && <TableHead className="pr-5 text-right">Aksi</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {project.assignments.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="pl-5">
                          {isAdmin ? (
                            <Link href={`/employees/${a.employee.id}`} className="flex items-center gap-2.5">
                              <Avatar name={a.employee.name} className="size-8" />
                              <span className="font-medium hover:text-primary">{a.employee.name}</span>
                            </Link>
                          ) : (
                            <div className="flex items-center gap-2.5">
                              <Avatar name={a.employee.name} className="size-8" />
                              <span className="font-medium">{a.employee.name}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {a.role?.name ?? "—"}
                        </TableCell>
                        <TableCell>
                          {isAdmin ? (
                            <form action={setAssignmentManager.bind(null, a.id, project.id)}>
                              <button type="submit" className="cursor-pointer">
                                {a.isManager ? (
                                  <Badge variant="default" className="gap-1">
                                    <Crown className="size-3" /> PM
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground hover:text-foreground">
                                    + Jadikan PM
                                  </span>
                                )}
                              </button>
                            </form>
                          ) : a.isManager ? (
                            <Badge variant="default" className="gap-1">
                              <Crown className="size-3" /> PM
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatIDR(toNum(a.fee))}
                          </TableCell>
                        )}
                        {isAdmin && (
                          <TableCell>
                            <form action={toggleFeeStatus.bind(null, a.id, project.id)}>
                              <button type="submit" className="cursor-pointer">
                                <StatusBadge meta={FEE_STATUS[a.feeStatus as FeeStatus]} />
                              </button>
                            </form>
                          </TableCell>
                        )}
                        {isAdmin && (
                          <TableCell className="pr-5 text-right">
                            <form action={deleteAssignment.bind(null, a.id, project.id)}>
                              <IconButton>
                                <Trash2 className="size-4" />
                              </IconButton>
                            </form>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-5">
                  <EmptyState
                    icon={Users}
                    title="Belum ada anggota tim"
                    description={isAdmin ? "Tambahkan karyawan dan tentukan fee mereka." : "Belum ada karyawan di-assign."}
                  />
                </div>
              )}
            </CardContent>
            {isAdmin && project.assignments.length > 0 && (
              <div className="flex items-center justify-between border-t border-border/60 px-5 py-3 text-sm">
                <span className="text-muted-foreground">Total Fee</span>
                <span className="font-semibold tabular-nums">{formatIDR(fin.fees)}</span>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* BOM */}
        <TabsContent value="bom" className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Kebutuhan Material (BOM)</CardTitle>
                <CardDescription>Klik status beli untuk mengubahnya.</CardDescription>
              </div>
              <AddItemDialog projectId={project.id} />
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {project.items.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-5">Item</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-right">Harga Satuan</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Sumber</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="pr-5" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {project.items.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell className="pl-5 font-medium">
                          <span className="inline-flex items-center gap-1.5">
                            {it.name}
                            {it.link && (
                              <a href={it.link} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary">
                                <ExternalLink className="size-3.5" />
                              </a>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="text-center tabular-nums">{it.quantity}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatIDR(toNum(it.unitPrice))}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{formatIDR(toNum(it.totalPrice))}</TableCell>
                        <TableCell>
                          <StatusBadge meta={ITEM_SOURCE[it.source as ItemSource]} showDot={false} />
                        </TableCell>
                        <TableCell>
                          <form action={cycleItemStatus.bind(null, it.id, project.id)}>
                            <button type="submit" className="cursor-pointer">
                              <StatusBadge meta={PURCHASE_STATUS[it.purchaseStatus as PurchaseStatus]} />
                            </button>
                          </form>
                        </TableCell>
                        <TableCell className="pr-5 text-right">
                          <form action={deleteItem.bind(null, it.id, project.id)}>
                            <IconButton>
                              <Trash2 className="size-4" />
                            </IconButton>
                          </form>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-5">
                  <EmptyState icon={Package} title="Belum ada item BOM" description="Catat material/komponen yang dibutuhkan." />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Biaya Tambahan</CardTitle>
              <CardDescription>Ongkir, admin, fabrikasi, dll.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {project.additionalCosts.length > 0 && (
                <div className="divide-y divide-border/60">
                  {project.additionalCosts.map((c) => (
                    <div key={c.id} className="flex items-center justify-between py-2">
                      <span className="text-sm">{c.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium tabular-nums">{formatIDR(toNum(c.amount))}</span>
                        <form action={deleteCost.bind(null, c.id, project.id)}>
                          <IconButton>
                            <Trash2 className="size-3.5" />
                          </IconButton>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <AddCostForm projectId={project.id} />
            </CardContent>
            <div className="flex items-center justify-between border-t border-border/60 px-5 py-3 text-sm">
              <span className="text-muted-foreground">Total Kebutuhan (material + biaya)</span>
              <span className="font-semibold tabular-nums">
                {formatIDR(
                  fin.materialCompany + fin.materialClient + fin.materialReimburse + fin.additional,
                )}
              </span>
            </div>
          </Card>
        </TabsContent>

        {/* Payments (admin) */}
        {isAdmin && (
          <TabsContent value="payment">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle>Termin Pembayaran</CardTitle>
                  <CardDescription>Klik status untuk menandai lunas/belum.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {project.paymentTerms.length === 0 && (
                    <form action={generateDefaultTerms.bind(null, project.id)}>
                      <Button type="submit" variant="ghost" size="sm">
                        Generate 50/50
                      </Button>
                    </form>
                  )}
                  <AddPaymentTermDialog projectId={project.id} />
                </div>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                {project.paymentTerms.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-5">Termin</TableHead>
                        <TableHead className="text-center">%</TableHead>
                        <TableHead className="text-right">Nominal</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Tgl Bayar</TableHead>
                        <TableHead className="pr-5" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {project.paymentTerms.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="pl-5 font-medium">{t.termName}</TableCell>
                          <TableCell className="text-center tabular-nums">{toNum(t.percentage)}%</TableCell>
                          <TableCell className="text-right font-medium tabular-nums">{formatIDR(toNum(t.amount))}</TableCell>
                          <TableCell>
                            <form action={togglePaymentTerm.bind(null, t.id, project.id)}>
                              <button type="submit" className="cursor-pointer">
                                <StatusBadge meta={PAYMENT_STATUS[t.status as PaymentStatus]} />
                              </button>
                            </form>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDate(t.paidAt)}</TableCell>
                          <TableCell className="pr-5 text-right">
                            <form action={deletePaymentTerm.bind(null, t.id, project.id)}>
                              <IconButton>
                                <Trash2 className="size-4" />
                              </IconButton>
                            </form>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-5">
                    <EmptyState icon={CreditCard} title="Belum ada termin pembayaran" description="Buat skema pembayaran klien (default 50/50)." />
                  </div>
                )}
              </CardContent>
              {project.paymentTerms.length > 0 && (
                <div className="grid grid-cols-3 gap-2 border-t border-border/60 px-5 py-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Terbayar</p>
                    <p className="font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">{formatIDR(fin.paid)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Sisa</p>
                    <p className="font-semibold text-rose-600 tabular-nums dark:text-rose-400">{formatIDR(fin.outstanding)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Status</p>
                    {fin.isFullyPaid ? <Badge variant="success">Lunas</Badge> : <Badge variant="warning">Belum Lunas</Badge>}
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
