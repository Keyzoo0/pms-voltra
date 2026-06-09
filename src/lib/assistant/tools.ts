import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { computeProjectFinance } from "@/lib/finance";
import { toNum } from "@/lib/utils";
import { ACTIVE_STATUSES, PROJECT_STATUS, type ProjectStatus } from "@/lib/constants";

/**
 * Tool layer for the AI assistant. Each declaration is sent to the model as a
 * function it may call; `executeTool` runs the matching query/mutation against
 * the live PMS data and returns a plain, JSON-safe object.
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
    name: "ask_user",
    description:
      "Tanya balik ke user saat ada informasi yang kurang atau ambigu sebelum melanjutkan (mis. memilih klien, menentukan nilai kontrak, status, role, atau proyek yang dimaksud). Lebih baik bertanya daripada menebak. Boleh sertakan opsi pilihan singkat agar user tinggal memilih.",
    parameters: {
      type: "object",
      properties: {
        question: { type: "string", description: "Pertanyaan singkat & jelas untuk user." },
        options: {
          type: "array",
          items: { type: "string" },
          description: "2-5 opsi jawaban singkat (opsional). Kosongkan bila jawaban berupa teks bebas.",
        },
      },
      required: ["question"],
    },
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
  {
    name: "update_project",
    description:
      "Ubah data proyek yang sudah ada (resolusi via projectId atau projectName). Hanya field yang diisi yang diubah. WAJIB konfirmasi ke user sebelum mengubah. Bila contractValue diubah, nominal termin pembayaran ikut dihitung ulang.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        projectName: { type: "string", description: "Nama proyek untuk dicari bila projectId tidak ada." },
        name: { type: "string", description: "Nama proyek baru." },
        description: { type: "string" },
        status: { type: "string", enum: STATUS_VALUES },
        contractValue: { type: "number", description: "Nilai kontrak baru (IDR)." },
        progress: { type: "integer", description: "0-100." },
        deadline: { type: "string", description: "Tanggal deadline YYYY-MM-DD (kosongkan '' untuk menghapus)." },
        startDate: { type: "string", description: "Tanggal mulai YYYY-MM-DD." },
        clientName: { type: "string", description: "Ganti klien (nama klien yang ada); '' untuk melepas klien." },
        categories: { type: "array", items: { type: "string" }, description: "Ganti daftar kategori." },
        roles: { type: "array", items: { type: "string" }, description: "Ganti daftar role dibutuhkan." },
        repoUrl: { type: "string" },
        waGroupUrl: { type: "string" },
      },
    },
  },
  {
    name: "set_project_status",
    description: "Ubah status satu proyek (cepat). Resolusi via projectId atau projectName.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        projectName: { type: "string" },
        status: { type: "string", enum: STATUS_VALUES },
      },
      required: ["status"],
    },
  },
  {
    name: "set_project_progress",
    description: "Set progress proyek (0-100). Resolusi via projectId atau projectName.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        projectName: { type: "string" },
        progress: { type: "integer" },
      },
      required: ["progress"],
    },
  },
  {
    name: "delete_project",
    description:
      "HAPUS proyek beserta semua assignment, BOM, dan termin pembayarannya (permanen). WAJIB minta konfirmasi eksplisit user via ask_user sebelum memanggil ini.",
    parameters: {
      type: "object",
      properties: { projectId: { type: "string" }, projectName: { type: "string" } },
    },
  },
  {
    name: "create_client",
    description: "Tambah klien baru.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        picName: { type: "string", description: "Nama PIC/kontak person." },
        contact: { type: "string", description: "No HP / email." },
        address: { type: "string" },
        notes: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "update_client",
    description: "Ubah data klien (resolusi via clientId atau clientName). WAJIB konfirmasi sebelum mengubah.",
    parameters: {
      type: "object",
      properties: {
        clientId: { type: "string" },
        clientName: { type: "string" },
        name: { type: "string", description: "Nama klien baru." },
        picName: { type: "string" },
        contact: { type: "string" },
        address: { type: "string" },
        notes: { type: "string" },
      },
    },
  },
  {
    name: "delete_client",
    description:
      "HAPUS klien (permanen). Proyek yang terkait akan kehilangan tautan kliennya (tidak ikut terhapus). WAJIB minta konfirmasi user via ask_user dulu.",
    parameters: {
      type: "object",
      properties: { clientId: { type: "string" }, clientName: { type: "string" } },
    },
  },
  {
    name: "create_employee",
    description:
      "Tambah karyawan baru. Role dicocokkan dengan role yang sudah ada (yang tidak cocok diabaikan & dilaporkan).",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        roles: { type: "array", items: { type: "string" }, description: "Nama role/keahlian." },
        status: { type: "string", enum: ["active", "inactive"] },
        contact: { type: "string" },
        bankName: { type: "string" },
        bankAccount: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "update_employee",
    description: "Ubah data karyawan (resolusi via employeeId atau employeeName). WAJIB konfirmasi sebelum mengubah.",
    parameters: {
      type: "object",
      properties: {
        employeeId: { type: "string" },
        employeeName: { type: "string" },
        name: { type: "string", description: "Nama baru." },
        roles: { type: "array", items: { type: "string" }, description: "Ganti daftar role." },
        status: { type: "string", enum: ["active", "inactive"] },
        contact: { type: "string" },
        bankName: { type: "string" },
        bankAccount: { type: "string" },
      },
    },
  },
  {
    name: "set_employee_status",
    description: "Aktifkan/nonaktifkan karyawan (lebih aman daripada menghapus). Resolusi via employeeId atau employeeName.",
    parameters: {
      type: "object",
      properties: {
        employeeId: { type: "string" },
        employeeName: { type: "string" },
        status: { type: "string", enum: ["active", "inactive"] },
      },
      required: ["status"],
    },
  },
  {
    name: "delete_employee",
    description:
      "HAPUS karyawan permanen beserta penugasannya. Biasanya lebih baik pakai set_employee_status('inactive'). WAJIB minta konfirmasi user via ask_user dulu.",
    parameters: {
      type: "object",
      properties: { employeeId: { type: "string" }, employeeName: { type: "string" } },
    },
  },
  {
    name: "assign_employee",
    description:
      "Tugaskan (assign) seorang karyawan ke sebuah proyek, dengan role, fee, dan opsi sebagai PM. Resolusi proyek & karyawan via nama atau id.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        projectName: { type: "string" },
        employeeId: { type: "string" },
        employeeName: { type: "string" },
        roleName: { type: "string", description: "Nama role untuk penugasan ini (opsional)." },
        fee: { type: "number", description: "Fee karyawan untuk proyek ini (IDR)." },
        isManager: { type: "boolean", description: "Jadikan project manager (PM)." },
      },
    },
  },
  {
    name: "update_assignment",
    description:
      "Ubah penugasan karyawan yang SUDAH ADA di sebuah proyek: ganti role, fee, status fee, atau jadikan/lepas sebagai Project Manager (isManager). Pakai ini untuk menjadikan karyawan yang sudah ditugaskan sebagai PM — JANGAN membuat penugasan kedua. Resolusi via nama/id proyek & karyawan.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        projectName: { type: "string" },
        employeeId: { type: "string" },
        employeeName: { type: "string" },
        roleName: { type: "string", description: "Ganti role penugasan ('' untuk menghapus role)." },
        fee: { type: "number", description: "Fee baru (IDR)." },
        feeStatus: { type: "string", enum: ["pending", "paid"], description: "Status pencairan fee." },
        isManager: { type: "boolean", description: "Jadikan PM (true) atau lepas PM (false)." },
      },
    },
  },
  {
    name: "unassign_employee",
    description: "Lepas penugasan seorang karyawan dari sebuah proyek. WAJIB konfirmasi dulu.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        projectName: { type: "string" },
        employeeId: { type: "string" },
        employeeName: { type: "string" },
      },
    },
  },
  {
    name: "get_employee",
    description:
      "Detail lengkap satu karyawan: role, status, kontak, rekening, riwayat penugasan proyek beserta fee & statusnya, dan total fee. Resolusi via employeeId atau employeeName.",
    parameters: {
      type: "object",
      properties: { employeeId: { type: "string" }, employeeName: { type: "string" } },
    },
  },
  {
    name: "add_item",
    description:
      "Tambah item kebutuhan material (BOM) ke sebuah proyek. Total harga otomatis qty × harga satuan.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        projectName: { type: "string" },
        name: { type: "string", description: "Nama item/material (wajib)." },
        quantity: { type: "integer", description: "Jumlah (default 1)." },
        unitPrice: { type: "number", description: "Harga satuan IDR (default 0)." },
        link: { type: "string", description: "Link toko/marketplace (opsional)." },
        source: {
          type: "string",
          enum: ["company", "client", "reimburse"],
          description: "Sumber dana: company=dibeli perusahaan (pengeluaran), client=dari klien, reimburse.",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "update_item",
    description:
      "Ubah item BOM pada sebuah proyek (cari item berdasarkan namanya di proyek itu). Bisa ubah qty, harga, sumber, status beli, atau nama.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        projectName: { type: "string" },
        itemName: { type: "string", description: "Nama item yang dicari (wajib)." },
        newName: { type: "string" },
        quantity: { type: "integer" },
        unitPrice: { type: "number" },
        link: { type: "string" },
        source: { type: "string", enum: ["company", "client", "reimburse"] },
        purchaseStatus: {
          type: "string",
          enum: ["not_purchased", "purchased", "reimbursed"],
          description: "Status pembelian.",
        },
      },
      required: ["itemName"],
    },
  },
  {
    name: "delete_item",
    description: "Hapus item BOM dari proyek (cari berdasarkan nama item). WAJIB konfirmasi dulu.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        projectName: { type: "string" },
        itemName: { type: "string" },
      },
      required: ["itemName"],
    },
  },
  {
    name: "add_cost",
    description: "Tambah biaya tambahan (ongkir, fabrikasi, admin, dll) ke sebuah proyek.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        projectName: { type: "string" },
        name: { type: "string", description: "Nama biaya (wajib)." },
        amount: { type: "number", description: "Nominal IDR (wajib)." },
      },
      required: ["name", "amount"],
    },
  },
  {
    name: "delete_cost",
    description: "Hapus biaya tambahan dari proyek (cari berdasarkan nama biaya). WAJIB konfirmasi dulu.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        projectName: { type: "string" },
        costName: { type: "string" },
      },
      required: ["costName"],
    },
  },
  {
    name: "add_payment_term",
    description:
      "Tambah termin pembayaran ke proyek. Nominal otomatis = persentase × nilai kontrak.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        projectName: { type: "string" },
        termName: { type: "string", description: "Nama termin, mis. 'DP 50%' (wajib)." },
        percentage: { type: "number", description: "Persentase dari nilai kontrak (wajib)." },
      },
      required: ["termName", "percentage"],
    },
  },
  {
    name: "set_payment_term_status",
    description:
      "Tandai termin pembayaran lunas/belum (cari termin berdasarkan namanya di proyek itu). paid = klien sudah bayar (paidAt diisi otomatis).",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        projectName: { type: "string" },
        termName: { type: "string", description: "Nama termin (boleh sebagian)." },
        status: { type: "string", enum: ["paid", "unpaid"] },
      },
      required: ["termName", "status"],
    },
  },
  {
    name: "delete_payment_term",
    description: "Hapus termin pembayaran dari proyek (berdampak finansial). WAJIB konfirmasi dulu.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        projectName: { type: "string" },
        termName: { type: "string" },
      },
      required: ["termName"],
    },
  },
  {
    name: "create_role",
    description: "Tambah role/keahlian baru ke taxonomy (langsung tersedia di semua form & tool).",
    parameters: {
      type: "object",
      properties: { name: { type: "string", description: "Nama role baru." } },
      required: ["name"],
    },
  },
  {
    name: "create_category",
    description: "Tambah kategori proyek baru ke taxonomy.",
    parameters: {
      type: "object",
      properties: { name: { type: "string", description: "Nama kategori baru." } },
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
    case "update_project":
      return updateProjectTool(args);
    case "set_project_status":
      return setProjectStatusTool(args);
    case "set_project_progress":
      return setProjectProgressTool(args);
    case "delete_project":
      return deleteProjectTool(args);
    case "create_client":
      return createClientTool(args);
    case "update_client":
      return updateClientTool(args);
    case "delete_client":
      return deleteClientTool(args);
    case "create_employee":
      return createEmployeeTool(args);
    case "update_employee":
      return updateEmployeeTool(args);
    case "set_employee_status":
      return setEmployeeStatusTool(args);
    case "delete_employee":
      return deleteEmployeeTool(args);
    case "assign_employee":
      return assignEmployeeTool(args);
    case "update_assignment":
      return updateAssignmentTool(args);
    case "unassign_employee":
      return unassignEmployeeTool(args);
    case "get_employee":
      return getEmployeeTool(args);
    case "add_item":
      return addItemTool(args);
    case "update_item":
      return updateItemTool(args);
    case "delete_item":
      return deleteItemTool(args);
    case "add_cost":
      return addCostTool(args);
    case "delete_cost":
      return deleteCostTool(args);
    case "add_payment_term":
      return addPaymentTermTool(args);
    case "set_payment_term_status":
      return setPaymentTermStatusTool(args);
    case "delete_payment_term":
      return deletePaymentTermTool(args);
    case "create_role":
      return createTaxonomyTool(args, "role");
    case "create_category":
      return createTaxonomyTool(args, "category");
    case "ask_user":
      // Normally intercepted by the run loop; handled by the UI.
      return { note: "Pertanyaan diteruskan ke pengguna." };
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

// ── CRUD helpers ──────────────────────────────────────────────
function touch() {
  revalidatePath("/", "layout");
}
function s(args: Args, key: string): string {
  return typeof args[key] === "string" ? (args[key] as string).trim() : "";
}
function parseDate(v: string): Date | null {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function resolveProject(args: Args): Promise<{ id: string; name: string } | null> {
  const id = s(args, "projectId");
  if (id) return db.project.findUnique({ where: { id }, select: { id: true, name: true } });
  const name = s(args, "projectName") || s(args, "name");
  if (name)
    return db.project.findFirst({
      where: { name: { contains: name, mode: "insensitive" } },
      select: { id: true, name: true },
      orderBy: { createdAt: "desc" },
    });
  return null;
}
async function resolveClient(args: Args): Promise<{ id: string; name: string } | null> {
  const id = s(args, "clientId");
  if (id) return db.client.findUnique({ where: { id }, select: { id: true, name: true } });
  const name = s(args, "clientName") || s(args, "name");
  if (name)
    return db.client.findFirst({
      where: { name: { contains: name, mode: "insensitive" } },
      select: { id: true, name: true },
    });
  return null;
}
async function resolveEmployee(args: Args): Promise<{ id: string; name: string } | null> {
  const id = s(args, "employeeId");
  if (id) return db.employee.findUnique({ where: { id }, select: { id: true, name: true } });
  const name = s(args, "employeeName") || s(args, "name");
  if (name)
    return db.employee.findFirst({
      where: { name: { contains: name, mode: "insensitive" } },
      select: { id: true, name: true },
    });
  return null;
}
async function matchRoleIds(names: string[]) {
  const all = await db.role.findMany({ select: { id: true, name: true } });
  const matched: { id: string; name: string }[] = [];
  const unmatched: string[] = [];
  for (const n of names) {
    const hit = all.find((r) => r.name.toLowerCase() === n.toLowerCase());
    if (hit) matched.push(hit);
    else unmatched.push(n);
  }
  return { matched, unmatched };
}
async function matchCategoryIds(names: string[]) {
  const all = await db.category.findMany({ select: { id: true, name: true } });
  const matched: { id: string; name: string }[] = [];
  const unmatched: string[] = [];
  for (const n of names) {
    const hit = all.find((c) => c.name.toLowerCase() === n.toLowerCase());
    if (hit) matched.push(hit);
    else unmatched.push(n);
  }
  return { matched, unmatched };
}

// ── Project write tools ───────────────────────────────────────
async function updateProjectTool(args: Args) {
  const proj = await resolveProject(args);
  if (!proj) return { error: "Proyek tidak ditemukan." };

  const data: Prisma.ProjectUpdateInput = {};
  const notes: string[] = [];
  if (s(args, "name")) data.name = s(args, "name");
  if (typeof args.description === "string") data.description = args.description.trim() || null;
  if (isStatus(args.status)) data.status = args.status;
  if (args.progress != null && Number.isFinite(Number(args.progress)))
    data.progress = Math.min(100, Math.max(0, Math.round(Number(args.progress))));
  let newContract: number | null = null;
  if (args.contractValue != null && Number.isFinite(Number(args.contractValue))) {
    newContract = Number(args.contractValue);
    data.contractValue = newContract;
  }
  if (typeof args.deadline === "string") data.deadline = args.deadline.trim() ? parseDate(args.deadline) : null;
  if (typeof args.startDate === "string") data.startDate = args.startDate.trim() ? parseDate(args.startDate) : null;
  if (typeof args.repoUrl === "string") data.repoUrl = args.repoUrl.trim() || null;
  if (typeof args.waGroupUrl === "string") data.waGroupUrl = args.waGroupUrl.trim() || null;

  if (Array.isArray(args.categories)) {
    const m = await matchCategoryIds(args.categories.map(String));
    data.categories = { set: m.matched.map((c) => ({ id: c.id })) };
    if (m.unmatched.length) notes.push(`Kategori tidak dikenal diabaikan: ${m.unmatched.join(", ")}`);
  }
  if (Array.isArray(args.roles)) {
    const m = await matchRoleIds(args.roles.map(String));
    data.requiredRoles = { set: m.matched.map((r) => ({ id: r.id })) };
    if (m.unmatched.length) notes.push(`Role tidak dikenal diabaikan: ${m.unmatched.join(", ")}`);
  }
  if (typeof args.clientName === "string") {
    if (!args.clientName.trim()) data.client = { disconnect: true };
    else {
      const c = await db.client.findFirst({
        where: { name: { contains: args.clientName.trim(), mode: "insensitive" } },
        select: { id: true },
      });
      if (c) data.client = { connect: { id: c.id } };
      else notes.push(`Klien "${args.clientName}" tidak ditemukan — klien tidak diubah.`);
    }
  }

  if (Object.keys(data).length === 0) return { error: "Tidak ada perubahan yang diberikan." };

  await db.project.update({ where: { id: proj.id }, data });

  if (newContract != null) {
    const terms = await db.projectPaymentTerm.findMany({ where: { projectId: proj.id } });
    await Promise.all(
      terms.map((t) =>
        db.projectPaymentTerm.update({
          where: { id: t.id },
          data: { amount: (toNum(t.percentage) / 100) * newContract! },
        }),
      ),
    );
  }
  touch();
  return { ok: true, id: proj.id, name: (data.name as string) ?? proj.name, url: `/projects/${proj.id}`, updatedFields: Object.keys(data), notes };
}

async function setProjectStatusTool(args: Args) {
  const proj = await resolveProject(args);
  if (!proj) return { error: "Proyek tidak ditemukan." };
  if (!isStatus(args.status)) return { error: "Status tidak valid." };
  await db.project.update({ where: { id: proj.id }, data: { status: args.status } });
  touch();
  return { ok: true, project: proj.name, status: args.status };
}

async function setProjectProgressTool(args: Args) {
  const proj = await resolveProject(args);
  if (!proj) return { error: "Proyek tidak ditemukan." };
  const progress = Math.min(100, Math.max(0, Math.round(Number(args.progress) || 0)));
  await db.project.update({ where: { id: proj.id }, data: { progress } });
  touch();
  return { ok: true, project: proj.name, progress };
}

async function deleteProjectTool(args: Args) {
  const proj = await resolveProject(args);
  if (!proj) return { error: "Proyek tidak ditemukan." };
  await db.project.delete({ where: { id: proj.id } });
  touch();
  return { ok: true, deleted: proj.name };
}

// ── Client write tools ────────────────────────────────────────
async function createClientTool(args: Args) {
  const name = s(args, "name");
  if (!name) return { error: "Nama klien wajib diisi." };
  const client = await db.client.create({
    data: {
      name,
      picName: s(args, "picName") || null,
      contact: s(args, "contact") || null,
      address: s(args, "address") || null,
      notes: s(args, "notes") || null,
    },
  });
  touch();
  return { ok: true, id: client.id, name: client.name, url: `/clients/${client.id}` };
}

async function updateClientTool(args: Args) {
  const cli = await resolveClient(args);
  if (!cli) return { error: "Klien tidak ditemukan." };
  const data: Prisma.ClientUpdateInput = {};
  if (s(args, "name")) data.name = s(args, "name");
  if (typeof args.picName === "string") data.picName = args.picName.trim() || null;
  if (typeof args.contact === "string") data.contact = args.contact.trim() || null;
  if (typeof args.address === "string") data.address = args.address.trim() || null;
  if (typeof args.notes === "string") data.notes = args.notes.trim() || null;
  if (Object.keys(data).length === 0) return { error: "Tidak ada perubahan yang diberikan." };
  await db.client.update({ where: { id: cli.id }, data });
  touch();
  return { ok: true, id: cli.id, name: (data.name as string) ?? cli.name, updatedFields: Object.keys(data) };
}

async function deleteClientTool(args: Args) {
  const cli = await resolveClient(args);
  if (!cli) return { error: "Klien tidak ditemukan." };
  await db.client.delete({ where: { id: cli.id } });
  touch();
  return { ok: true, deleted: cli.name };
}

// ── Employee write tools ──────────────────────────────────────
async function createEmployeeTool(args: Args) {
  const name = s(args, "name");
  if (!name) return { error: "Nama karyawan wajib diisi." };
  const status = args.status === "inactive" ? "inactive" : "active";
  const roleNames = Array.isArray(args.roles) ? args.roles.map(String) : [];
  const m = await matchRoleIds(roleNames);
  const emp = await db.employee.create({
    data: {
      name,
      status,
      leftAt: status === "inactive" ? new Date() : null,
      contact: s(args, "contact") || null,
      bankName: s(args, "bankName") || null,
      bankAccount: s(args, "bankAccount") || null,
      roles: { connect: m.matched.map((r) => ({ id: r.id })) },
    },
  });
  touch();
  return {
    ok: true,
    id: emp.id,
    name: emp.name,
    url: `/employees/${emp.id}`,
    status,
    connectedRoles: m.matched.map((r) => r.name),
    unmatchedRoles: m.unmatched,
  };
}

async function updateEmployeeTool(args: Args) {
  const emp = await resolveEmployee(args);
  if (!emp) return { error: "Karyawan tidak ditemukan." };
  const data: Prisma.EmployeeUpdateInput = {};
  const notes: string[] = [];
  if (s(args, "name")) data.name = s(args, "name");
  if (typeof args.contact === "string") data.contact = args.contact.trim() || null;
  if (typeof args.bankName === "string") data.bankName = args.bankName.trim() || null;
  if (typeof args.bankAccount === "string") data.bankAccount = args.bankAccount.trim() || null;
  if (args.status === "active" || args.status === "inactive") {
    data.status = args.status;
    data.leftAt = args.status === "inactive" ? new Date() : null;
  }
  if (Array.isArray(args.roles)) {
    const m = await matchRoleIds(args.roles.map(String));
    data.roles = { set: m.matched.map((r) => ({ id: r.id })) };
    if (m.unmatched.length) notes.push(`Role tidak dikenal diabaikan: ${m.unmatched.join(", ")}`);
  }
  if (Object.keys(data).length === 0) return { error: "Tidak ada perubahan yang diberikan." };
  await db.employee.update({ where: { id: emp.id }, data });
  touch();
  return { ok: true, id: emp.id, name: (data.name as string) ?? emp.name, updatedFields: Object.keys(data), notes };
}

async function setEmployeeStatusTool(args: Args) {
  const emp = await resolveEmployee(args);
  if (!emp) return { error: "Karyawan tidak ditemukan." };
  const status = args.status === "inactive" ? "inactive" : args.status === "active" ? "active" : null;
  if (!status) return { error: "Status harus 'active' atau 'inactive'." };
  await db.employee.update({
    where: { id: emp.id },
    data: { status, leftAt: status === "inactive" ? new Date() : null },
  });
  touch();
  return { ok: true, employee: emp.name, status };
}

async function deleteEmployeeTool(args: Args) {
  const emp = await resolveEmployee(args);
  if (!emp) return { error: "Karyawan tidak ditemukan." };
  await db.employee.delete({ where: { id: emp.id } });
  touch();
  return { ok: true, deleted: emp.name };
}

// ── Assignment write tools ────────────────────────────────────
async function assignEmployeeTool(args: Args) {
  const proj = await resolveProject(args);
  if (!proj) return { error: "Proyek tidak ditemukan." };
  const emp = await resolveEmployee(args);
  if (!emp) return { error: "Karyawan tidak ditemukan." };

  let roleId: string | null = null;
  let roleName: string | null = null;
  const wantRole = s(args, "roleName");
  if (wantRole) {
    const role = await db.role.findFirst({
      where: { name: { contains: wantRole, mode: "insensitive" } },
      select: { id: true, name: true },
    });
    if (role) {
      roleId = role.id;
      roleName = role.name;
    }
  }

  const existing = await db.projectAssignment.findFirst({
    where: { projectId: proj.id, employeeId: emp.id },
    select: { id: true },
  });
  if (existing) return { error: `${emp.name} sudah ditugaskan di proyek ${proj.name}.` };

  await db.projectAssignment.create({
    data: {
      project: { connect: { id: proj.id } },
      employee: { connect: { id: emp.id } },
      ...(roleId ? { role: { connect: { id: roleId } } } : {}),
      fee: Number(args.fee) || 0,
      isManager: args.isManager === true,
    },
  });
  touch();
  return {
    ok: true,
    project: proj.name,
    employee: emp.name,
    role: roleName,
    fee: Number(args.fee) || 0,
    isManager: args.isManager === true,
  };
}

async function updateAssignmentTool(args: Args) {
  const proj = await resolveProject(args);
  if (!proj) return { error: "Proyek tidak ditemukan." };
  const emp = await resolveEmployee(args);
  if (!emp) return { error: "Karyawan tidak ditemukan." };
  const assignment = await db.projectAssignment.findFirst({
    where: { projectId: proj.id, employeeId: emp.id },
    select: { id: true },
  });
  if (!assignment)
    return { error: `${emp.name} belum ditugaskan di proyek ${proj.name}. Pakai assign_employee dulu.` };

  const data: Prisma.ProjectAssignmentUpdateInput = {};
  const notes: string[] = [];
  if (typeof args.isManager === "boolean") data.isManager = args.isManager;
  if (args.fee != null && Number.isFinite(Number(args.fee))) data.fee = Number(args.fee);
  if (args.feeStatus === "pending" || args.feeStatus === "paid") data.feeStatus = args.feeStatus;
  if (typeof args.roleName === "string") {
    if (!args.roleName.trim()) data.role = { disconnect: true };
    else {
      const role = await db.role.findFirst({
        where: { name: { contains: args.roleName.trim(), mode: "insensitive" } },
        select: { id: true },
      });
      if (role) data.role = { connect: { id: role.id } };
      else notes.push(`Role "${args.roleName}" tidak ada di taxonomy — role tidak diubah.`);
    }
  }
  if (Object.keys(data).length === 0) return { error: "Tidak ada perubahan yang diberikan." };

  await db.projectAssignment.update({ where: { id: assignment.id }, data });
  touch();
  return { ok: true, project: proj.name, employee: emp.name, updatedFields: Object.keys(data), notes };
}

async function unassignEmployeeTool(args: Args) {
  const proj = await resolveProject(args);
  if (!proj) return { error: "Proyek tidak ditemukan." };
  const emp = await resolveEmployee(args);
  if (!emp) return { error: "Karyawan tidak ditemukan." };
  const res = await db.projectAssignment.deleteMany({ where: { projectId: proj.id, employeeId: emp.id } });
  touch();
  if (res.count === 0) return { error: `${emp.name} tidak ditugaskan di proyek ${proj.name}.` };
  return { ok: true, project: proj.name, employee: emp.name, removed: res.count };
}

// ── Employee detail ───────────────────────────────────────────
async function getEmployeeTool(args: Args) {
  const ref = await resolveEmployee(args);
  if (!ref) return { error: "Karyawan tidak ditemukan." };
  const e = await db.employee.findUnique({
    where: { id: ref.id },
    include: {
      roles: { select: { name: true } },
      assignments: {
        include: {
          project: { select: { id: true, name: true, status: true } },
          role: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!e) return { error: "Karyawan tidak ditemukan." };
  const totalFee = e.assignments.reduce((s, a) => s + toNum(a.fee), 0);
  const feePaid = e.assignments
    .filter((a) => a.feeStatus === "paid")
    .reduce((s, a) => s + toNum(a.fee), 0);
  return {
    id: e.id,
    name: e.name,
    url: `/employees/${e.id}`,
    status: e.status,
    roles: e.roles.map((r) => r.name),
    contact: e.contact,
    bank: e.bankName ? `${e.bankName} ${e.bankAccount ?? ""}`.trim() : null,
    hasLoginAccount: !!e.username,
    joinedAt: iso(e.joinedAt),
    totalFee,
    feePaid,
    feePending: totalFee - feePaid,
    assignments: e.assignments.map((a) => ({
      project: a.project.name,
      projectStatus: a.project.status,
      projectUrl: `/projects/${a.project.id}`,
      role: a.role?.name ?? null,
      isManager: a.isManager,
      fee: toNum(a.fee),
      feeStatus: a.feeStatus,
    })),
  };
}

// ── BOM & cost tools ──────────────────────────────────────────
const ITEM_SOURCES = ["company", "client", "reimburse"] as const;
const PURCHASE_STATUSES = ["not_purchased", "purchased", "reimbursed"] as const;

async function findItem(projectId: string, itemName: string) {
  return db.projectItem.findFirst({
    where: { projectId, name: { contains: itemName, mode: "insensitive" } },
  });
}

async function addItemTool(args: Args) {
  const proj = await resolveProject(args);
  if (!proj) return { error: "Proyek tidak ditemukan." };
  const name = s(args, "name");
  if (!name) return { error: "Nama item wajib diisi." };
  const quantity = Math.max(1, Math.round(Number(args.quantity) || 1));
  const unitPrice = Number(args.unitPrice) || 0;
  const source = (ITEM_SOURCES as readonly string[]).includes(String(args.source))
    ? (String(args.source) as (typeof ITEM_SOURCES)[number])
    : "company";
  await db.projectItem.create({
    data: {
      project: { connect: { id: proj.id } },
      name,
      quantity,
      unitPrice,
      totalPrice: quantity * unitPrice,
      link: s(args, "link") || null,
      source,
    },
  });
  touch();
  return { ok: true, project: proj.name, item: name, quantity, unitPrice, totalPrice: quantity * unitPrice, source, url: `/projects/${proj.id}` };
}

async function updateItemTool(args: Args) {
  const proj = await resolveProject(args);
  if (!proj) return { error: "Proyek tidak ditemukan." };
  const item = await findItem(proj.id, s(args, "itemName"));
  if (!item) return { error: `Item "${s(args, "itemName")}" tidak ditemukan di proyek ${proj.name}.` };

  const quantity =
    args.quantity != null && Number.isFinite(Number(args.quantity))
      ? Math.max(1, Math.round(Number(args.quantity)))
      : item.quantity;
  const unitPrice =
    args.unitPrice != null && Number.isFinite(Number(args.unitPrice))
      ? Number(args.unitPrice)
      : toNum(item.unitPrice);

  await db.projectItem.update({
    where: { id: item.id },
    data: {
      name: s(args, "newName") || item.name,
      quantity,
      unitPrice,
      totalPrice: quantity * unitPrice,
      ...(typeof args.link === "string" ? { link: args.link.trim() || null } : {}),
      ...((ITEM_SOURCES as readonly string[]).includes(String(args.source))
        ? { source: String(args.source) as (typeof ITEM_SOURCES)[number] }
        : {}),
      ...((PURCHASE_STATUSES as readonly string[]).includes(String(args.purchaseStatus))
        ? { purchaseStatus: String(args.purchaseStatus) as (typeof PURCHASE_STATUSES)[number] }
        : {}),
    },
  });
  touch();
  return { ok: true, project: proj.name, item: s(args, "newName") || item.name, quantity, unitPrice, totalPrice: quantity * unitPrice };
}

async function deleteItemTool(args: Args) {
  const proj = await resolveProject(args);
  if (!proj) return { error: "Proyek tidak ditemukan." };
  const item = await findItem(proj.id, s(args, "itemName"));
  if (!item) return { error: `Item "${s(args, "itemName")}" tidak ditemukan di proyek ${proj.name}.` };
  await db.projectItem.delete({ where: { id: item.id } });
  touch();
  return { ok: true, project: proj.name, deleted: item.name };
}

async function addCostTool(args: Args) {
  const proj = await resolveProject(args);
  if (!proj) return { error: "Proyek tidak ditemukan." };
  const name = s(args, "name");
  if (!name) return { error: "Nama biaya wajib diisi." };
  const amount = Number(args.amount) || 0;
  await db.projectAdditionalCost.create({
    data: { project: { connect: { id: proj.id } }, name, amount },
  });
  touch();
  return { ok: true, project: proj.name, cost: name, amount, url: `/projects/${proj.id}` };
}

async function deleteCostTool(args: Args) {
  const proj = await resolveProject(args);
  if (!proj) return { error: "Proyek tidak ditemukan." };
  const cost = await db.projectAdditionalCost.findFirst({
    where: { projectId: proj.id, name: { contains: s(args, "costName"), mode: "insensitive" } },
  });
  if (!cost) return { error: `Biaya "${s(args, "costName")}" tidak ditemukan di proyek ${proj.name}.` };
  await db.projectAdditionalCost.delete({ where: { id: cost.id } });
  touch();
  return { ok: true, project: proj.name, deleted: cost.name, amount: toNum(cost.amount) };
}

// ── Payment-term tools ────────────────────────────────────────
async function findTerm(projectId: string, termName: string) {
  return db.projectPaymentTerm.findFirst({
    where: { projectId, termName: { contains: termName, mode: "insensitive" } },
    orderBy: { sortOrder: "asc" },
  });
}

async function addPaymentTermTool(args: Args) {
  const proj = await resolveProject(args);
  if (!proj) return { error: "Proyek tidak ditemukan." };
  const termName = s(args, "termName");
  if (!termName) return { error: "Nama termin wajib diisi." };
  const percentage = Number(args.percentage) || 0;
  const full = await db.project.findUnique({
    where: { id: proj.id },
    select: { contractValue: true, _count: { select: { paymentTerms: true } } },
  });
  const contractValue = toNum(full?.contractValue);
  const amount = (percentage / 100) * contractValue;
  await db.projectPaymentTerm.create({
    data: {
      project: { connect: { id: proj.id } },
      termName,
      percentage,
      amount,
      sortOrder: full?._count.paymentTerms ?? 0,
    },
  });
  touch();
  return { ok: true, project: proj.name, termName, percentage, amount, url: `/projects/${proj.id}` };
}

async function setPaymentTermStatusTool(args: Args) {
  const proj = await resolveProject(args);
  if (!proj) return { error: "Proyek tidak ditemukan." };
  const term = await findTerm(proj.id, s(args, "termName"));
  if (!term) return { error: `Termin "${s(args, "termName")}" tidak ditemukan di proyek ${proj.name}.` };
  const paid = args.status === "paid";
  await db.projectPaymentTerm.update({
    where: { id: term.id },
    data: { status: paid ? "paid" : "unpaid", paidAt: paid ? new Date() : null },
  });
  touch();
  return {
    ok: true,
    project: proj.name,
    termName: term.termName,
    amount: toNum(term.amount),
    status: paid ? "paid" : "unpaid",
  };
}

async function deletePaymentTermTool(args: Args) {
  const proj = await resolveProject(args);
  if (!proj) return { error: "Proyek tidak ditemukan." };
  const term = await findTerm(proj.id, s(args, "termName"));
  if (!term) return { error: `Termin "${s(args, "termName")}" tidak ditemukan di proyek ${proj.name}.` };
  await db.projectPaymentTerm.delete({ where: { id: term.id } });
  touch();
  return { ok: true, project: proj.name, deleted: term.termName, amount: toNum(term.amount) };
}

// ── Taxonomy tools ────────────────────────────────────────────
async function createTaxonomyTool(args: Args, kind: "role" | "category") {
  const name = s(args, "name");
  if (!name) return { error: `Nama ${kind === "role" ? "role" : "kategori"} wajib diisi.` };
  if (kind === "role") {
    const exists = await db.role.findUnique({ where: { name } });
    if (exists) return { error: `Role "${name}" sudah ada.` };
    await db.role.create({ data: { name } });
  } else {
    const exists = await db.category.findUnique({ where: { name } });
    if (exists) return { error: `Kategori "${name}" sudah ada.` };
    await db.category.create({ data: { name } });
  }
  touch();
  return { ok: true, created: name, kind };
}
