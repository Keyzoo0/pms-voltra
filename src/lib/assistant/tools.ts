import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { computeProjectFinance } from "@/lib/finance";
import { toNum } from "@/lib/utils";
import { ACTIVE_STATUSES, PROJECT_STATUS, type ProjectStatus } from "@/lib/constants";

/**
 * Tool layer for the AI assistant. Each declaration is sent to Gemini as a
 * function the model may call; `executeTool` runs the matching query/mutation
 * against the live PMS data and returns a plain, JSON-safe object.
 */

const STATUS_VALUES = Object.keys(PROJECT_STATUS) as ProjectStatus[];

function isStatus(v: unknown): v is ProjectStatus {
  return typeof v === "string" && (STATUS_VALUES as string[]).includes(v);
}

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

// ── full project relations needed for finance ─────────────────
const FINANCE_INCLUDE = {
  client: { select: { id: true, name: true, contact: true } },
  assignments: {
    include: { employee: { select: { id: true, name: true } }, role: { select: { name: true } } },
  },
  items: true,
  additionalCosts: true,
  paymentTerms: true,
  categories: { select: { name: true } },
  requiredRoles: { select: { name: true } },
} as const;

type ProjectWithRels = Awaited<
  ReturnType<typeof db.project.findMany<{ include: typeof FINANCE_INCLUDE }>>
>[number];

function projectSummary(p: ProjectWithRels) {
  const fin = computeProjectFinance(p);
  return {
    id: p.id,
    name: p.name,
    status: p.status,
    statusLabel: PROJECT_STATUS[p.status as ProjectStatus]?.label ?? p.status,
    client: p.client?.name ?? null,
    progress: p.progress,
    deadline: iso(p.deadline),
    contractValue: fin.revenue,
    profit: fin.profit,
    outstanding: fin.outstanding,
    isFullyPaid: fin.isFullyPaid,
    teamSize: p.assignments.length,
  };
}

// ── active workload per employee (assignments on live projects) ──
async function activeWorkload(): Promise<Map<string, number>> {
  const rows = await db.projectAssignment.groupBy({
    by: ["employeeId"],
    where: { project: { status: { in: ACTIVE_STATUSES } } },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.employeeId, r._count._all]));
}

// ── tool declarations (sent to Gemini) ───────────────────────
export const TOOL_DECLARATIONS = [
  {
    name: "get_overview",
    description:
      "Ringkasan analitik seluruh PMS: jumlah proyek per status, total nilai kontrak, profit, piutang (outstanding), fee belum cair, jumlah karyawan aktif, dan klien dengan nilai proyek terbesar. Pakai untuk pertanyaan analisa menyeluruh / kesehatan bisnis. Tidak butuh argumen.",
  },
  {
    name: "list_projects",
    description:
      "Cari/daftar proyek. Bisa difilter berdasarkan status dan/atau kata kunci nama. Pakai untuk 'proyek yang sedang berjalan', 'proyek lunas', dll.",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: STATUS_VALUES,
          description:
            "Filter status proyek. in_progress=sedang berjalan, paid=dibayar/lunas, delivered=terkirim, approved=disetujui, on_hold=ditunda, cancelled=dibatalkan, closed=selesai, dispute=sengketa, inquiry, quotation.",
        },
        query: { type: "string", description: "Kata kunci pada nama proyek." },
        limit: { type: "integer", description: "Maksimal hasil (default 25)." },
      },
    },
  },
  {
    name: "get_project",
    description:
      "Detail lengkap satu proyek termasuk keuangan (P&L), tim, kebutuhan/BOM, dan termin pembayaran. Beri projectId bila tahu, atau name untuk dicari berdasarkan nama.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "ID proyek (cuid)." },
        name: { type: "string", description: "Sebagian/seluruh nama proyek." },
      },
    },
  },
  {
    name: "list_employees",
    description:
      "Daftar karyawan beserta role/keahlian, status, dan jumlah proyek aktif (beban kerja). Bisa difilter status, role, atau nama.",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["active", "inactive"], description: "Filter status karyawan." },
        role: { type: "string", description: "Filter berdasarkan nama role/keahlian (mis. 'firmware')." },
        query: { type: "string", description: "Kata kunci nama karyawan." },
      },
    },
  },
  {
    name: "suggest_employees",
    description:
      "Rekomendasikan karyawan AKTIF yang cocok untuk role tertentu, diurutkan dari yang paling cocok (kecocokan role) dan beban kerja paling ringan. Beri daftar roles, atau projectId untuk memakai role yang dibutuhkan proyek itu.",
    parameters: {
      type: "object",
      properties: {
        roles: {
          type: "array",
          items: { type: "string" },
          description: "Daftar nama role/keahlian yang dibutuhkan (mis. ['Firmware Engineer','IoT Developer']).",
        },
        projectId: { type: "string", description: "Pakai requiredRoles dari proyek ini bila roles tidak diberikan." },
      },
    },
  },
  {
    name: "list_clients",
    description: "Daftar klien (untuk memilih klien saat membuat proyek). Bisa difilter kata kunci nama.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "Kata kunci nama klien." } },
    },
  },
  {
    name: "list_taxonomy",
    description:
      "Daftar semua kategori dan role yang tersedia (untuk dipakai saat membuat proyek). Tidak butuh argumen.",
  },
  {
    name: "create_project",
    description:
      "Buat proyek baru. WAJIB konfirmasi detail ke user dan dapatkan persetujuan eksplisit sebelum memanggil tool ini. Kategori & role akan dicocokkan dengan yang sudah ada (yang tidak cocok diabaikan). Bila contractValue diisi, termin DP 50% / Pelunasan 50% dibuat otomatis.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nama proyek (wajib)." },
        description: { type: "string", description: "Deskripsi singkat." },
        clientName: { type: "string", description: "Nama klien (dicari yang sudah ada)." },
        clientId: { type: "string", description: "ID klien bila sudah tahu." },
        contractValue: { type: "number", description: "Nilai kontrak dalam IDR (angka)." },
        status: { type: "string", enum: STATUS_VALUES, description: "Status awal (default inquiry)." },
        categories: { type: "array", items: { type: "string" }, description: "Nama kategori." },
        roles: { type: "array", items: { type: "string" }, description: "Nama role yang dibutuhkan." },
      },
      required: ["name"],
    },
  },
] as const;

// ── execution ────────────────────────────────────────────────
type Args = Record<string, unknown>;

export async function executeTool(name: string, args: Args): Promise<unknown> {
  switch (name) {
    case "get_overview":
      return getOverview();
    case "list_projects":
      return listProjects(args);
    case "get_project":
      return getProject(args);
    case "list_employees":
      return listEmployees(args);
    case "suggest_employees":
      return suggestEmployees(args);
    case "list_clients":
      return listClients(args);
    case "list_taxonomy":
      return listTaxonomy();
    case "create_project":
      return createProjectTool(args);
    default:
      return { error: `Tool tidak dikenal: ${name}` };
  }
}

async function getOverview() {
  const projects = await db.project.findMany({ include: FINANCE_INCLUDE });
  const byStatus: Record<string, number> = {};
  let revenue = 0,
    profit = 0,
    outstanding = 0,
    feesPending = 0;
  const clientValue = new Map<string, number>();

  for (const p of projects) {
    byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
    const fin = computeProjectFinance(p);
    revenue += fin.revenue;
    profit += fin.profit;
    outstanding += fin.outstanding;
    feesPending += fin.feesPending;
    if (p.client) clientValue.set(p.client.name, (clientValue.get(p.client.name) ?? 0) + fin.revenue);
  }

  const [activeEmp, inactiveEmp, clientCount] = await Promise.all([
    db.employee.count({ where: { status: "active" } }),
    db.employee.count({ where: { status: "inactive" } }),
    db.client.count(),
  ]);

  const topClients = [...clientValue.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([clientName, value]) => ({ clientName, contractValue: value }));

  return {
    totalProjects: projects.length,
    projectsByStatus: Object.fromEntries(
      Object.entries(byStatus).map(([k, v]) => [
        `${k} (${PROJECT_STATUS[k as ProjectStatus]?.label ?? k})`,
        v,
      ]),
    ),
    activeProjects: projects.filter((p) => (ACTIVE_STATUSES as string[]).includes(p.status)).length,
    totalContractValue: revenue,
    totalProfit: profit,
    totalOutstanding: outstanding,
    totalFeesPending: feesPending,
    employees: { active: activeEmp, inactive: inactiveEmp },
    clients: clientCount,
    topClientsByValue: topClients,
    currency: "IDR",
  };
}

async function listProjects(args: Args) {
  const status = args.status;
  const query = typeof args.query === "string" ? args.query.trim() : "";
  const limit = Math.min(50, Math.max(1, Number(args.limit) || 25));

  const projects = await db.project.findMany({
    where: {
      ...(isStatus(status) ? { status } : {}),
      ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
    },
    include: FINANCE_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return { count: projects.length, projects: projects.map(projectSummary) };
}

async function getProject(args: Args) {
  const projectId = typeof args.projectId === "string" ? args.projectId : null;
  const name = typeof args.name === "string" ? args.name.trim() : "";

  const project = projectId
    ? await db.project.findUnique({ where: { id: projectId }, include: FINANCE_INCLUDE })
    : name
      ? await db.project.findFirst({
          where: { name: { contains: name, mode: "insensitive" } },
          include: FINANCE_INCLUDE,
          orderBy: { createdAt: "desc" },
        })
      : null;

  if (!project) return { error: "Proyek tidak ditemukan." };

  const fin = computeProjectFinance(project);
  return {
    ...projectSummary(project),
    description: project.description,
    startDate: iso(project.startDate),
    repoUrl: project.repoUrl,
    waGroupUrl: project.waGroupUrl,
    categories: project.categories.map((c) => c.name),
    requiredRoles: project.requiredRoles.map((r) => r.name),
    finance: {
      revenue: fin.revenue,
      expense: fin.expense,
      profit: fin.profit,
      marginPct: Math.round(fin.margin * 1000) / 10,
      paid: fin.paid,
      outstanding: fin.outstanding,
      materialCompany: fin.materialCompany,
      fees: fin.fees,
      feesPaid: fin.feesPaid,
      feesPending: fin.feesPending,
    },
    team: project.assignments.map((a) => ({
      name: a.employee.name,
      role: a.role?.name ?? null,
      isManager: a.isManager,
      fee: toNum(a.fee),
      feeStatus: a.feeStatus,
    })),
    paymentTerms: project.paymentTerms
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((t) => ({
        termName: t.termName,
        percentage: toNum(t.percentage),
        amount: toNum(t.amount),
        status: t.status,
        paidAt: iso(t.paidAt),
      })),
    itemCount: project.items.length,
  };
}

async function listEmployees(args: Args) {
  const status = args.status === "active" || args.status === "inactive" ? args.status : undefined;
  const role = typeof args.role === "string" ? args.role.trim() : "";
  const query = typeof args.query === "string" ? args.query.trim() : "";

  const [employees, workload] = await Promise.all([
    db.employee.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(role ? { roles: { some: { name: { contains: role, mode: "insensitive" } } } } : {}),
        ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
      },
      include: { roles: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    activeWorkload(),
  ]);

  return {
    count: employees.length,
    employees: employees.map((e) => ({
      id: e.id,
      name: e.name,
      status: e.status,
      roles: e.roles.map((r) => r.name),
      activeProjects: workload.get(e.id) ?? 0,
    })),
  };
}

async function suggestEmployees(args: Args) {
  let roles = Array.isArray(args.roles)
    ? args.roles.map((r) => String(r).trim()).filter(Boolean)
    : [];

  if (roles.length === 0 && typeof args.projectId === "string") {
    const project = await db.project.findUnique({
      where: { id: args.projectId },
      include: { requiredRoles: { select: { name: true } } },
    });
    roles = project?.requiredRoles.map((r) => r.name) ?? [];
  }

  if (roles.length === 0)
    return { error: "Sebutkan role yang dibutuhkan, atau berikan projectId yang punya required roles." };

  const lower = roles.map((r) => r.toLowerCase());
  const [employees, workload] = await Promise.all([
    db.employee.findMany({
      where: { status: "active" },
      include: { roles: { select: { name: true } } },
    }),
    activeWorkload(),
  ]);

  const ranked = employees
    .map((e) => {
      const matched = e.roles
        .map((r) => r.name)
        .filter((n) => lower.some((q) => n.toLowerCase().includes(q) || q.includes(n.toLowerCase())));
      return {
        id: e.id,
        name: e.name,
        roles: e.roles.map((r) => r.name),
        matchedRoles: matched,
        matchCount: matched.length,
        activeProjects: workload.get(e.id) ?? 0,
      };
    })
    .filter((e) => e.matchCount > 0)
    .sort((a, b) => b.matchCount - a.matchCount || a.activeProjects - b.activeProjects);

  return {
    requestedRoles: roles,
    candidates: ranked,
    note:
      ranked.length === 0
        ? "Tidak ada karyawan aktif dengan role tersebut. Pertimbangkan menambah role di Pengaturan atau mengaktifkan karyawan."
        : "Diurutkan dari kecocokan role tertinggi, lalu beban kerja paling ringan.",
  };
}

async function listClients(args: Args) {
  const query = typeof args.query === "string" ? args.query.trim() : "";
  const clients = await db.client.findMany({
    where: query ? { name: { contains: query, mode: "insensitive" } } : {},
    orderBy: { name: "asc" },
    select: { id: true, name: true, contact: true, picName: true },
    take: 50,
  });
  return { count: clients.length, clients };
}

async function listTaxonomy() {
  const [categories, roles] = await Promise.all([
    db.category.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
    db.role.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
  ]);
  return { categories: categories.map((c) => c.name), roles: roles.map((r) => r.name) };
}

async function createProjectTool(args: Args) {
  const name = typeof args.name === "string" ? args.name.trim() : "";
  if (!name) return { error: "Nama proyek wajib diisi." };

  const status = isStatus(args.status) ? args.status : "inquiry";
  const contractValue = Number(args.contractValue) || 0;
  const wantCategories = Array.isArray(args.categories) ? args.categories.map((c) => String(c).trim()) : [];
  const wantRoles = Array.isArray(args.roles) ? args.roles.map((r) => String(r).trim()) : [];

  // Resolve client (existing only — never auto-create a client).
  let clientId: string | null = typeof args.clientId === "string" ? args.clientId : null;
  let clientName: string | null = null;
  if (!clientId && typeof args.clientName === "string" && args.clientName.trim()) {
    const c = await db.client.findFirst({
      where: { name: { contains: args.clientName.trim(), mode: "insensitive" } },
      select: { id: true, name: true },
    });
    if (c) {
      clientId = c.id;
      clientName = c.name;
    }
  } else if (clientId) {
    const c = await db.client.findUnique({ where: { id: clientId }, select: { name: true } });
    clientName = c?.name ?? null;
    if (!c) clientId = null;
  }

  // Match categories/roles by name against existing rows (case-insensitive).
  const [allCats, allRoles] = await Promise.all([
    db.category.findMany({ select: { id: true, name: true } }),
    db.role.findMany({ select: { id: true, name: true } }),
  ]);
  const matchNames = (want: string[], all: { id: string; name: string }[]) => {
    const matched: { id: string; name: string }[] = [];
    const unmatched: string[] = [];
    for (const w of want) {
      const hit = all.find((a) => a.name.toLowerCase() === w.toLowerCase());
      if (hit) matched.push(hit);
      else unmatched.push(w);
    }
    return { matched, unmatched };
  };
  const cats = matchNames(wantCategories, allCats);
  const roles = matchNames(wantRoles, allRoles);

  const project = await db.project.create({
    data: {
      name,
      description: typeof args.description === "string" ? args.description.trim() || null : null,
      ...(clientId ? { client: { connect: { id: clientId } } } : {}),
      contractValue,
      status,
      categories: { connect: cats.matched.map((c) => ({ id: c.id })) },
      requiredRoles: { connect: roles.matched.map((r) => ({ id: r.id })) },
      ...(contractValue > 0
        ? {
            paymentTerms: {
              create: [
                { termName: "DP 50%", percentage: 50, amount: contractValue * 0.5, sortOrder: 0 },
                { termName: "Pelunasan 50%", percentage: 50, amount: contractValue * 0.5, sortOrder: 1 },
              ],
            },
          }
        : {}),
    },
  });

  revalidatePath("/projects");
  revalidatePath("/");

  return {
    ok: true,
    id: project.id,
    name: project.name,
    url: `/projects/${project.id}`,
    client: clientName,
    status,
    contractValue,
    connectedCategories: cats.matched.map((c) => c.name),
    connectedRoles: roles.matched.map((r) => r.name),
    unmatchedCategories: cats.unmatched,
    unmatchedRoles: roles.unmatched,
    paymentTermsCreated: contractValue > 0,
  };
}
