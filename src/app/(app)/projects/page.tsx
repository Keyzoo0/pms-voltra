import type { Metadata } from "next";
import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { computeProjectFinance } from "@/lib/finance";
import { PROJECT_STATUS, type ProjectStatus } from "@/lib/constants";
import { daysUntil, formatDate, formatIDR } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { ProjectsFilter } from "./projects-filter";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Proyek" };

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status;
  const category = sp.category;
  const q = sp.q?.trim();

  const [projects, categories] = await Promise.all([
    db.project.findMany({
      where: {
        ...(status && status !== "all"
          ? { status: status as ProjectStatus }
          : {}),
        ...(category && category !== "all"
          ? { categories: { some: { id: category } } }
          : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                {
                  client: {
                    is: { name: { contains: q, mode: "insensitive" as const } },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        client: true,
        categories: true,
        assignments: true,
        items: true,
        additionalCosts: true,
        paymentTerms: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const isFiltered = Boolean((status && status !== "all") || (category && category !== "all") || q);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proyek"
        description={`${projects.length} proyek${isFiltered ? " (terfilter)" : ""}.`}
        actions={
          <Button asChild>
            <Link href="/projects/new">
              <Plus /> Proyek Baru
            </Link>
          </Button>
        }
      />

      <ProjectsFilter categories={categories} />

      <Card>
        <CardContent className="px-0 pb-0">
          {projects.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Proyek</TableHead>
                  <TableHead>Klien</TableHead>
                  <TableHead className="text-right">Nilai Kontrak</TableHead>
                  <TableHead className="w-36">Progress</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead className="pr-5 text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((p) => {
                  const fin = computeProjectFinance(p);
                  const d = daysUntil(p.deadline);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="pl-5">
                        <Link
                          href={`/projects/${p.id}`}
                          className="font-medium text-foreground hover:text-primary"
                        >
                          {p.name}
                        </Link>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {p.categories.slice(0, 3).map((c) => (
                            <Badge key={c.id} variant="secondary" className="text-[10px]">
                              {c.name}
                            </Badge>
                          ))}
                          {p.categories.length > 3 && (
                            <Badge variant="secondary" className="text-[10px]">
                              +{p.categories.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.client?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatIDR(fin.revenue)}
                        {fin.outstanding > 0 && (
                          <p className="text-xs font-normal text-amber-600 dark:text-amber-400">
                            sisa {formatIDR(fin.outstanding)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={p.progress} className="w-16" />
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {p.progress}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="text-muted-foreground">
                          {formatDate(p.deadline)}
                        </span>
                        {d !== null && d < 0 && p.status !== "closed" && p.status !== "paid" && (
                          <p className="text-xs text-rose-600 dark:text-rose-400">
                            telat {Math.abs(d)}h
                          </p>
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
                icon={FolderKanban}
                title={isFiltered ? "Tidak ada proyek cocok" : "Belum ada proyek"}
                description={
                  isFiltered
                    ? "Coba ubah filter atau kata kunci pencarian."
                    : "Mulai dengan membuat proyek pertama Anda."
                }
                action={
                  !isFiltered && (
                    <Button asChild>
                      <Link href="/projects/new">
                        <Plus /> Proyek Baru
                      </Link>
                    </Button>
                  )
                }
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
