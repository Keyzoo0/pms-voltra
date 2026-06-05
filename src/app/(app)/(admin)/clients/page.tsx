import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { computeProjectFinance } from "@/lib/finance";
import { formatIDR } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
export const metadata: Metadata = { title: "Klien" };

export default async function ClientsPage() {
  const clients = await db.client.findMany({
    include: { projects: { include: { paymentTerms: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Klien"
        description={`${clients.length} klien terdaftar.`}
        actions={
          <Button asChild>
            <Link href="/clients/new">
              <Plus /> Klien Baru
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="px-0 pb-0">
          {clients.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Klien</TableHead>
                  <TableHead>Kontak</TableHead>
                  <TableHead className="text-center">Proyek</TableHead>
                  <TableHead className="text-right">Total Nilai</TableHead>
                  <TableHead className="pr-5 text-right">Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c) => {
                  const live = c.projects.filter((p) => p.status !== "cancelled");
                  const totalValue = live.reduce(
                    (s, p) => s + computeProjectFinance(p).revenue,
                    0,
                  );
                  const outstanding = live.reduce(
                    (s, p) => s + computeProjectFinance(p).outstanding,
                    0,
                  );
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="pl-5">
                        <Link href={`/clients/${c.id}`} className="flex items-center gap-3">
                          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Building2 className="size-4.5" />
                          </span>
                          <div>
                            <p className="font-medium hover:text-primary">{c.name}</p>
                            {c.picName && (
                              <p className="text-xs text-muted-foreground">PIC: {c.picName}</p>
                            )}
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.contact ?? "—"}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {c.projects.length}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatIDR(totalValue)}
                      </TableCell>
                      <TableCell className="pr-5 text-right tabular-nums">
                        {outstanding > 0 ? (
                          <span className="font-medium text-amber-600 dark:text-amber-400">
                            {formatIDR(outstanding)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Lunas</span>
                        )}
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
                title="Belum ada klien"
                description="Tambahkan klien untuk mulai mencatat proyek."
                action={
                  <Button asChild>
                    <Link href="/clients/new">
                      <Plus /> Klien Baru
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
