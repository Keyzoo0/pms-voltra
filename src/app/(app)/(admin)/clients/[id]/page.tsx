import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Building2,
  MapPin,
  Pencil,
  Phone,
  Trash2,
  User,
  Wallet,
} from "lucide-react";
import { db } from "@/lib/db";
import { computeProjectFinance } from "@/lib/finance";
import { PROJECT_STATUS, type ProjectStatus } from "@/lib/constants";
import { formatDate, formatIDR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import { deleteClient } from "../actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const c = await db.client.findUnique({ where: { id }, select: { name: true } });
  return { title: c?.name ?? "Klien" };
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const client = await db.client.findUnique({
    where: { id },
    include: {
      projects: {
        include: { paymentTerms: true, assignments: true, items: true, additionalCosts: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!client) notFound();

  const live = client.projects.filter((p) => p.status !== "cancelled");
  const totalValue = live.reduce((s, p) => s + computeProjectFinance(p).revenue, 0);
  const received = live.reduce((s, p) => s + computeProjectFinance(p).paid, 0);
  const outstanding = live.reduce((s, p) => s + computeProjectFinance(p).outstanding, 0);

  return (
    <div className="space-y-6">
      <Link
        href="/clients"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        ← Daftar Klien
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex size-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="size-7" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
            {client.picName && (
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <User className="size-3.5" /> PIC: {client.picName}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/clients/${client.id}/edit`}>
              <Pencil /> Edit
            </Link>
          </Button>
          <ConfirmDialog
            action={deleteClient.bind(null, client.id)}
            title="Hapus klien ini?"
            description={`"${client.name}" akan dihapus. Proyek terkait tidak ikut terhapus tetapi kehilangan kaitan klien.`}
            trigger={
              <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10">
                <Trash2 /> Hapus
              </Button>
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Nilai Proyek" value={formatIDR(totalValue)} icon={Wallet} accent="primary" />
        <StatCard label="Sudah Diterima" value={formatIDR(received)} accent="emerald" />
        <StatCard label="Outstanding" value={formatIDR(outstanding)} accent="amber" />
        <StatCard label="Jumlah Proyek" value={client.projects.length} accent="violet" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Informasi Kontak</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span>{client.contact ?? "—"}</span>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span>{client.address ?? "—"}</span>
            </div>
            {client.notes && (
              <div className="rounded-lg bg-muted/50 p-3 text-muted-foreground">
                {client.notes}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Riwayat Proyek</CardTitle>
            <CardDescription>Semua proyek dari klien ini.</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {client.projects.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Proyek</TableHead>
                    <TableHead className="text-right">Nilai</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="pr-5 text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {client.projects.map((p) => {
                    const fin = computeProjectFinance(p);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="pl-5">
                          <Link href={`/projects/${p.id}`} className="font-medium hover:text-primary">
                            {p.name}
                          </Link>
                          <p className="text-xs text-muted-foreground">{formatDate(p.deadline)}</p>
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatIDR(fin.revenue)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fin.outstanding > 0 ? (
                            <span className="text-amber-600 dark:text-amber-400">
                              {formatIDR(fin.outstanding)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="pr-5 text-right">
                          <StatusBadge meta={PROJECT_STATUS[p.status as ProjectStatus]} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="p-5">
                <EmptyState
                  icon={Building2}
                  title="Belum ada proyek"
                  description="Klien ini belum memiliki proyek."
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
