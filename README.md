# Voltra Techno — Project Management System (PMS)

Sistem manajemen proyek, SDM, dan keuangan untuk **Voltra Techno** — jasa
development teknologi (IoT, Robotika, Machine Learning, PLC, SCADA, dll).

Single-user (Owner/PM) app dengan dashboard bisnis, manajemen proyek end-to-end
(lifecycle, assignment, BOM, pembayaran), laporan laba-rugi, rekap fee karyawan,
dan export Excel.

## ✨ Fitur

- **Dashboard** — ringkasan bisnis, grafik arus kas & distribusi status, alert
  deadline dan pembayaran outstanding.
- **Proyek** — CRUD lengkap, lifecycle 10 status, multi-kategori & role,
  assignment karyawan + fee, BOM (material), biaya tambahan, termin pembayaran,
  dan laporan **Laba Rugi (P&L)** otomatis per proyek.
- **Karyawan** — CRUD, multi-role dinamis, status aktif/idle, riwayat proyek &
  total fee (lifetime).
- **Klien** — CRM ringan: riwayat proyek, total nilai, outstanding payment.
- **Keuangan** — P&L keseluruhan + per proyek, filter per tahun.
- **Rekap Fee** — total fee per karyawan + status pencairan.
- **Pengaturan** — kelola kategori & role secara dinamis.
- **Export Excel** — P&L proyek, laporan keuangan, rekap fee (.xlsx).
- **Auth** — login owner sederhana (cookie ber-tanda-tangan HMAC).

## 🛠 Tech Stack

| Layer | Teknologi |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS v4 + komponen ala shadcn/ui |
| Database | PostgreSQL (Neon) |
| ORM | Prisma 7 (driver adapter `@prisma/adapter-pg`) |
| Charts | Recharts |
| Export | ExcelJS |
| Deploy | Vercel |

## 🚀 Menjalankan Lokal

```bash
pnpm install
cp .env.example .env          # isi DATABASE_URL, AUTH_PASSWORD, AUTH_SECRET
pnpm prisma db push           # buat skema di database
pnpm db:seed                  # isi data contoh
pnpm dev
```

Buka http://localhost:3000 — login dengan `AUTH_PASSWORD` (default `voltra-admin`).

## 🔐 Environment Variables

| Variable | Keterangan |
|---|---|
| `DATABASE_URL` | Connection string PostgreSQL (pakai pooled URL untuk serverless) |
| `AUTH_PASSWORD` | Password login owner |
| `AUTH_SECRET` | Secret untuk menandatangani cookie sesi (string acak panjang) |

## 📦 Scripts

- `pnpm dev` — development server
- `pnpm build` — `prisma generate` + production build
- `pnpm db:push` — sinkron skema ke database
- `pnpm db:seed` — isi data contoh
- `pnpm db:studio` — Prisma Studio

---

Dibuat berdasarkan `VOLTRA_PMS_Documentation.md`.
