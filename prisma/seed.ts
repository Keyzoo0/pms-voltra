import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

const CATEGORIES = [
  "IoT",
  "Machine Learning",
  "PLC",
  "SCADA",
  "3D Design",
  "Robotika",
  "Firmware",
  "Web Development",
];

const ROLES = [
  "Firmware Engineer",
  "3D Drafter",
  "Electrical Engineer",
  "ML Engineer",
  "Frontend Developer",
  "Backend Developer",
  "Fullstack Developer",
  "Automation Engineer",
  "IoT Developer",
  "Mechanic Assembler",
  "Electronic Assembler",
  "Electronic Designer",
];

function daysFromNow(n: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
}

async function main() {
  console.log("🌱 Seeding Voltra Techno PMS...");

  // Clean slate (children first)
  await db.projectAssignment.deleteMany();
  await db.projectItem.deleteMany();
  await db.projectAdditionalCost.deleteMany();
  await db.projectPaymentTerm.deleteMany();
  await db.project.deleteMany();
  await db.employee.deleteMany();
  await db.client.deleteMany();
  await db.category.deleteMany();
  await db.role.deleteMany();

  await db.category.createMany({ data: CATEGORIES.map((name) => ({ name })) });
  await db.role.createMany({ data: ROLES.map((name) => ({ name })) });

  // ── Clients ───────────────────────────────────────────────
  const agrotech = await db.client.create({
    data: {
      name: "PT Agrotech Nusantara",
      picName: "Budi Santoso",
      contact: "budi@agrotech.co.id · 0812-1100-2200",
      address: "Jl. Raya Bogor KM 30, Cibinong, Jawa Barat",
      notes: "Klien fokus pertanian presisi & smart farming.",
    },
  });
  const mekatronika = await db.client.create({
    data: {
      name: "CV Maju Mekatronika",
      picName: "Andi Wijaya",
      contact: "andi@majumekatronika.id · 0813-5566-7788",
      address: "Kawasan Industri Jababeka II, Cikarang",
      notes: "Manufaktur, butuh otomasi lini produksi.",
    },
  });
  const surya = await db.client.create({
    data: {
      name: "PT Surya Energi Mandiri",
      picName: "Rina Kartika",
      contact: "rina@suryaenergi.com · 0815-2233-4455",
      address: "Jl. Gatot Subroto No. 88, Jakarta Selatan",
      notes: "Pembangkit listrik tenaga surya skala industri.",
    },
  });
  const kampus = await db.client.create({
    data: {
      name: "Universitas Teknologi Bandung",
      picName: "Dr. Hadi Nugroho",
      contact: "hadi@utb.ac.id · 0817-9090-1212",
      address: "Jl. Ganesha No. 10, Bandung",
      notes: "Proyek riset & prototype akademik.",
    },
  });
  const pelabuhan = await db.client.create({
    data: {
      name: "PT Pelabuhan Cerdas Indonesia",
      picName: "Slamet Riyadi",
      contact: "slamet@pelabuhancerdas.co.id · 0819-3434-5656",
      address: "Pelabuhan Tanjung Priok, Jakarta Utara",
      notes: "Digitalisasi & monitoring SCADA pelabuhan.",
    },
  });

  // ── Employees ─────────────────────────────────────────────
  const e = {
    rizky: await db.employee.create({
      data: {
        name: "Rizky Pratama",
        contact: "rizky.pratama@voltra.id · 0812-0001-0001",
        joinedAt: daysFromNow(-420),
        roles: { connect: [{ name: "Firmware Engineer" }, { name: "IoT Developer" }] },
        notes: "Spesialis embedded C/C++ & RTOS.",
      },
    }),
    dewi: await db.employee.create({
      data: {
        name: "Dewi Lestari",
        contact: "dewi.lestari@voltra.id · 0812-0002-0002",
        joinedAt: daysFromNow(-360),
        roles: { connect: [{ name: "Frontend Developer" }, { name: "Fullstack Developer" }] },
      },
    }),
    bagus: await db.employee.create({
      data: {
        name: "Bagus Setiawan",
        contact: "bagus.s@voltra.id · 0812-0003-0003",
        joinedAt: daysFromNow(-500),
        roles: { connect: [{ name: "Electrical Engineer" }, { name: "Electronic Designer" }] },
      },
    }),
    siti: await db.employee.create({
      data: {
        name: "Siti Nurhaliza",
        contact: "siti.n@voltra.id · 0812-0004-0004",
        joinedAt: daysFromNow(-300),
        roles: { connect: [{ name: "ML Engineer" }, { name: "Backend Developer" }] },
      },
    }),
    arif: await db.employee.create({
      data: {
        name: "Arif Rahman",
        contact: "arif.r@voltra.id · 0812-0005-0005",
        joinedAt: daysFromNow(-260),
        roles: { connect: [{ name: "3D Drafter" }, { name: "Mechanic Assembler" }] },
      },
    }),
    putri: await db.employee.create({
      data: {
        name: "Putri Maharani",
        contact: "putri.m@voltra.id · 0812-0006-0006",
        joinedAt: daysFromNow(-180),
        roles: { connect: [{ name: "Backend Developer" }, { name: "Fullstack Developer" }] },
      },
    }),
    eko: await db.employee.create({
      data: {
        name: "Eko Prasetyo",
        contact: "eko.p@voltra.id · 0812-0007-0007",
        joinedAt: daysFromNow(-150),
        roles: { connect: [{ name: "Automation Engineer" }, { name: "Electrical Engineer" }] },
      },
    }),
    maya: await db.employee.create({
      data: {
        name: "Maya Anggraini",
        contact: "maya.a@voltra.id · 0812-0008-0008",
        status: "inactive",
        joinedAt: daysFromNow(-540),
        leftAt: daysFromNow(-30),
        roles: { connect: [{ name: "Electronic Assembler" }, { name: "Electronic Designer" }] },
        notes: "Resign, pindah ke luar kota.",
      },
    }),
  };

  // Give every employee a login (username = key, password = "karyawan123").
  const passwordHash = await bcrypt.hash("karyawan123", 10);
  for (const [username, emp] of Object.entries(e)) {
    await db.employee.update({
      where: { id: emp.id },
      data: { username, passwordHash },
    });
  }

  // ── Projects ──────────────────────────────────────────────
  type Term = { termName: string; percentage: number; paid: boolean; paidOffset?: number };
  type Item = {
    name: string;
    quantity: number;
    unitPrice: number;
    source: "company" | "client" | "reimburse";
    purchaseStatus: "not_purchased" | "purchased" | "reimbursed";
    link?: string;
  };
  type Assign = {
    empId: string;
    role: string;
    fee: number;
    feeStatus?: "pending" | "paid";
    isManager?: boolean;
  };

  async function makeProject(opts: {
    name: string;
    description: string;
    clientId: string;
    contractValue: number;
    status: string;
    progress: number;
    startOffset: number;
    deadlineOffset: number;
    categories: string[];
    requiredRoles: string[];
    notes?: string;
    assignments: Assign[];
    items: Item[];
    costs: { name: string; amount: number }[];
    terms: Term[];
  }) {
    return db.project.create({
      data: {
        name: opts.name,
        description: opts.description,
        client: { connect: { id: opts.clientId } },
        contractValue: opts.contractValue,
        status: opts.status as never,
        progress: opts.progress,
        startDate: daysFromNow(opts.startOffset),
        deadline: daysFromNow(opts.deadlineOffset),
        notes: opts.notes,
        categories: { connect: opts.categories.map((name) => ({ name })) },
        requiredRoles: { connect: opts.requiredRoles.map((name) => ({ name })) },
        assignments: {
          create: opts.assignments.map((a) => ({
            employee: { connect: { id: a.empId } },
            role: { connect: { name: a.role } },
            fee: a.fee,
            feeStatus: (a.feeStatus ?? "pending") as never,
            isManager: a.isManager ?? false,
          })),
        },
        items: {
          create: opts.items.map((it) => ({
            name: it.name,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            totalPrice: it.quantity * it.unitPrice,
            source: it.source as never,
            purchaseStatus: it.purchaseStatus as never,
            link: it.link,
          })),
        },
        additionalCosts: { create: opts.costs },
        paymentTerms: {
          create: opts.terms.map((t, i) => ({
            termName: t.termName,
            percentage: t.percentage,
            amount: (t.percentage / 100) * opts.contractValue,
            status: (t.paid ? "paid" : "unpaid") as never,
            paidAt: t.paid ? daysFromNow(t.paidOffset ?? -10) : null,
            sortOrder: i,
          })),
        },
      },
    });
  }

  await makeProject({
    name: "Smart Greenhouse IoT",
    description:
      "Sistem monitoring & kontrol rumah kaca berbasis IoT: sensor suhu, kelembaban, pH tanah, dan aktuator irigasi otomatis dengan dashboard real-time.",
    clientId: agrotech.id,
    contractValue: 75_000_000,
    status: "in_progress",
    progress: 60,
    startOffset: -25,
    deadlineOffset: 12,
    categories: ["IoT", "Firmware", "Web Development"],
    requiredRoles: ["Firmware Engineer", "IoT Developer", "Frontend Developer"],
    notes: "Klien minta integrasi notifikasi WhatsApp di fase 2.",
    assignments: [
      { empId: e.rizky.id, role: "Firmware Engineer", fee: 9_000_000, isManager: true },
      { empId: e.dewi.id, role: "Frontend Developer", fee: 7_000_000 },
    ],
    items: [
      { name: "ESP32 DevKit V1", quantity: 6, unitPrice: 85_000, source: "company", purchaseStatus: "purchased" },
      { name: "Sensor Suhu & Kelembaban SHT31", quantity: 6, unitPrice: 145_000, source: "company", purchaseStatus: "purchased" },
      { name: "Sensor pH Tanah", quantity: 4, unitPrice: 320_000, source: "company", purchaseStatus: "purchased" },
      { name: "Relay Module 8 Channel", quantity: 2, unitPrice: 95_000, source: "company", purchaseStatus: "not_purchased" },
      { name: "Pompa Air & Selang Irigasi", quantity: 1, unitPrice: 1_250_000, source: "client", purchaseStatus: "purchased" },
    ],
    costs: [
      { name: "Ongkir komponen", amount: 180_000 },
      { name: "PCB custom (fabrikasi)", amount: 850_000 },
    ],
    terms: [
      { termName: "DP 50%", percentage: 50, paid: true, paidOffset: -24 },
      { termName: "Pelunasan 50%", percentage: 50, paid: false },
    ],
  });

  await makeProject({
    name: "Robot Arm Assembly Line",
    description:
      "Lengan robot 4-axis untuk pick-and-place pada lini perakitan, terintegrasi PLC dan HMI touchscreen.",
    clientId: mekatronika.id,
    contractValue: 120_000_000,
    status: "in_progress",
    progress: 30,
    startOffset: -15,
    deadlineOffset: 25,
    categories: ["Robotika", "PLC"],
    requiredRoles: ["Automation Engineer", "Electrical Engineer", "3D Drafter"],
    assignments: [
      { empId: e.eko.id, role: "Automation Engineer", fee: 15_000_000, isManager: true },
      { empId: e.bagus.id, role: "Electrical Engineer", fee: 11_000_000 },
      { empId: e.arif.id, role: "3D Drafter", fee: 6_500_000 },
    ],
    items: [
      { name: "Servo Motor Industrial 750W", quantity: 4, unitPrice: 3_200_000, source: "company", purchaseStatus: "purchased" },
      { name: "PLC Omron CP1H", quantity: 1, unitPrice: 8_500_000, source: "company", purchaseStatus: "purchased" },
      { name: "HMI Touchscreen 7\"", quantity: 1, unitPrice: 4_200_000, source: "client", purchaseStatus: "purchased" },
      { name: "Aluminium Profile & Bracket", quantity: 1, unitPrice: 5_500_000, source: "company", purchaseStatus: "not_purchased" },
    ],
    costs: [
      { name: "Ongkir & handling", amount: 750_000 },
      { name: "Machining custom part", amount: 3_200_000 },
    ],
    terms: [
      { termName: "DP 40%", percentage: 40, paid: true, paidOffset: -14 },
      { termName: "Termin 2 (30%)", percentage: 30, paid: false },
      { termName: "Pelunasan 30%", percentage: 30, paid: false },
    ],
  });

  await makeProject({
    name: "SCADA Port Monitoring System",
    description:
      "Sistem SCADA untuk monitoring crane, conveyor, dan kelistrikan pelabuhan dengan dashboard terpusat dan alarm.",
    clientId: pelabuhan.id,
    contractValue: 95_000_000,
    status: "delivered",
    progress: 90,
    startOffset: -45,
    deadlineOffset: 5,
    categories: ["SCADA", "IoT"],
    requiredRoles: ["Automation Engineer", "Backend Developer", "Electrical Engineer"],
    notes: "Sudah serah terima, menunggu pembayaran termin akhir.",
    assignments: [
      { empId: e.eko.id, role: "Automation Engineer", fee: 12_000_000, isManager: true },
      { empId: e.putri.id, role: "Backend Developer", fee: 9_500_000 },
    ],
    items: [
      { name: "Gateway Modbus TCP", quantity: 3, unitPrice: 2_100_000, source: "company", purchaseStatus: "purchased" },
      { name: "Sensor Arus 3-Phase", quantity: 8, unitPrice: 650_000, source: "company", purchaseStatus: "purchased" },
      { name: "Server Mini PC (klien)", quantity: 1, unitPrice: 14_000_000, source: "client", purchaseStatus: "purchased" },
    ],
    costs: [{ name: "Instalasi & komisioning on-site", amount: 4_500_000 }],
    terms: [
      { termName: "DP 50%", percentage: 50, paid: true, paidOffset: -44 },
      { termName: "Pelunasan 50%", percentage: 50, paid: false },
    ],
  });

  await makeProject({
    name: "Solar Panel ML Forecasting",
    description:
      "Model machine learning untuk prediksi output panel surya berdasarkan cuaca + dashboard analitik.",
    clientId: surya.id,
    contractValue: 60_000_000,
    status: "approved",
    progress: 10,
    startOffset: -3,
    deadlineOffset: 30,
    categories: ["Machine Learning", "IoT"],
    requiredRoles: ["ML Engineer", "Backend Developer"],
    assignments: [
      { empId: e.siti.id, role: "ML Engineer", fee: 13_000_000 },
    ],
    items: [
      { name: "Weather Station Sensor Kit", quantity: 2, unitPrice: 1_850_000, source: "company", purchaseStatus: "not_purchased" },
    ],
    costs: [{ name: "Cloud GPU training (2 bulan)", amount: 2_400_000 }],
    terms: [
      { termName: "DP 50%", percentage: 50, paid: true, paidOffset: -2 },
      { termName: "Pelunasan 50%", percentage: 50, paid: false },
    ],
  });

  await makeProject({
    name: "Conveyor PLC Automation",
    description:
      "Otomasi conveyor sortir barang dengan sensor proximity dan kontrol PLC.",
    clientId: mekatronika.id,
    contractValue: 45_000_000,
    status: "paid",
    progress: 100,
    startOffset: -60,
    deadlineOffset: -20,
    categories: ["PLC"],
    requiredRoles: ["Automation Engineer", "Electrical Engineer"],
    notes: "Lunas, fee karyawan siap dicairkan.",
    assignments: [
      { empId: e.eko.id, role: "Automation Engineer", fee: 8_000_000, feeStatus: "pending" },
      { empId: e.bagus.id, role: "Electrical Engineer", fee: 5_000_000, feeStatus: "pending" },
    ],
    items: [
      { name: "PLC Mitsubishi FX5U", quantity: 1, unitPrice: 6_500_000, source: "company", purchaseStatus: "purchased" },
      { name: "Sensor Proximity Inductive", quantity: 10, unitPrice: 180_000, source: "company", purchaseStatus: "purchased" },
      { name: "Motor Induksi 1HP", quantity: 2, unitPrice: 1_650_000, source: "reimburse", purchaseStatus: "reimbursed" },
    ],
    costs: [{ name: "Ongkir", amount: 220_000 }],
    terms: [
      { termName: "DP 50%", percentage: 50, paid: true, paidOffset: -58 },
      { termName: "Pelunasan 50%", percentage: 50, paid: true, paidOffset: -18 },
    ],
  });

  await makeProject({
    name: "Drone Inspection Firmware",
    description:
      "Firmware kustom untuk drone inspeksi jalur transmisi listrik dengan auto-waypoint.",
    clientId: kampus.id,
    contractValue: 35_000_000,
    status: "quotation",
    progress: 0,
    startOffset: 7,
    deadlineOffset: 45,
    categories: ["Firmware", "Robotika"],
    requiredRoles: ["Firmware Engineer"],
    notes: "Menunggu approval anggaran dari kampus.",
    assignments: [],
    items: [],
    costs: [],
    terms: [
      { termName: "DP 50%", percentage: 50, paid: false },
      { termName: "Pelunasan 50%", percentage: 50, paid: false },
    ],
  });

  await makeProject({
    name: "Water Quality Monitoring",
    description:
      "Stasiun pemantauan kualitas air sungai (pH, TDS, turbidity) dengan analitik tren ML.",
    clientId: agrotech.id,
    contractValue: 50_000_000,
    status: "closed",
    progress: 100,
    startOffset: -120,
    deadlineOffset: -75,
    categories: ["IoT", "Machine Learning"],
    requiredRoles: ["IoT Developer", "ML Engineer"],
    notes: "Selesai sepenuhnya. Klien puas, potensi proyek lanjutan.",
    assignments: [
      { empId: e.rizky.id, role: "IoT Developer", fee: 7_500_000, feeStatus: "paid" },
      { empId: e.siti.id, role: "ML Engineer", fee: 8_000_000, feeStatus: "paid" },
    ],
    items: [
      { name: "Sensor pH & TDS Probe", quantity: 3, unitPrice: 750_000, source: "company", purchaseStatus: "purchased" },
      { name: "Turbidity Sensor", quantity: 3, unitPrice: 420_000, source: "company", purchaseStatus: "purchased" },
      { name: "Solar Panel 50W + Baterai", quantity: 3, unitPrice: 1_100_000, source: "company", purchaseStatus: "purchased" },
    ],
    costs: [
      { name: "Enclosure waterproof IP67", amount: 1_350_000 },
      { name: "Ongkir & instalasi", amount: 900_000 },
    ],
    terms: [
      { termName: "DP 50%", percentage: 50, paid: true, paidOffset: -118 },
      { termName: "Pelunasan 50%", percentage: 50, paid: true, paidOffset: -74 },
    ],
  });

  const counts = await Promise.all([
    db.client.count(),
    db.employee.count(),
    db.project.count(),
    db.projectAssignment.count(),
  ]);
  console.log(
    `✅ Seed selesai — ${counts[0]} klien, ${counts[1]} karyawan, ${counts[2]} proyek, ${counts[3]} assignment.`,
  );
}

main()
  .catch((err) => {
    console.error("❌ Seed gagal:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
