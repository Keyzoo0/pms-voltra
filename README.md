# Voltra Techno — Project Management System (PMS)

Sistem manajemen proyek, SDM, dan keuangan untuk **Voltra Techno** — jasa
development teknologi (IoT, Robotika, Machine Learning, PLC, SCADA, Firmware,
3D Design, Web).

Aplikasi web **multi-peran** (Owner/Admin + portal Karyawan) dengan dashboard
bisnis, manajemen proyek end-to-end (lifecycle, assignment, BOM, pembayaran),
laporan laba-rugi, rekap fee, nota cetak, export Excel, dan **asisten AI**
(Qwen) yang bisa menganalisa data sekaligus melakukan CRUD lewat chat.

🔗 **Live:** https://pms-voltra.vercel.app

---

## ✨ Fitur

### Manajemen inti

- **Dashboard** — ringkasan bisnis, grafik arus kas & distribusi status, alert
  deadline dan pembayaran outstanding.
- **Proyek** — CRUD lengkap, lifecycle 10 status, multi-kategori & role,
  assignment karyawan + fee, BOM (material), biaya tambahan, termin pembayaran,
  dan laporan **Laba Rugi (P&L)** otomatis per proyek. Dilengkapi tautan
  **Repo GitHub** & **Grup WhatsApp** (klik = langsung buka), serta nomor HP
  klien yang jadi shortcut **WhatsApp**.
- **Karyawan** — CRUD, multi-role dinamis, status aktif/nonaktif, detail
  rekening bank, riwayat proyek & total fee (lifetime). Bisa diberi
  **akun login** untuk mengakses **portal karyawan** (lihat proyek & fee sendiri).
- **Klien** — CRM ringan: riwayat proyek, total nilai, outstanding payment,
  dengan **picker klien yang bisa dicari**.
- **Keuangan** — P&L keseluruhan + per proyek, filter per tahun.
- **Rekap Fee** — total fee per karyawan + status pencairan.
- **Nota cetak** — Nota Klien (stempel **LUNAS** + sembunyikan rekening saat
  sudah lunas), Nota Fee, dan Nota Kebutuhan.
- **Pengaturan** — profil & logo perusahaan, kategori & role dinamis, dan
  **ganti password admin**.
- **Export Excel** — P&L proyek, laporan keuangan, rekap fee (`.xlsx`).

### 🤖 AI Assistant (Voltra AI)

Asisten cerdas khusus admin, ditenagai **Qwen** (Alibaba DashScope) via API
OpenAI-compatible:

- **Analisa menyeluruh** portofolio & keuangan, cari proyek per status, detail P&L.
- **Rekomendasi karyawan** untuk sebuah pekerjaan (kecocokan role + beban kerja).
- **CRUD database lewat chat** — buat/ubah/hapus **Proyek, Klien, Karyawan**, dan
  **assign/lepas** anggota tim. Selalu **minta konfirmasi** sebelum menulis atau
  menghapus data.
- **Upload & analisa file** — gambar (model vision), PDF, Word (`.docx`), Excel,
  CSV/JSON, dan file teks/kode apa pun.
- **Pertanyaan interaktif** — saat data kurang/ambigu, asisten bertanya balik
  dengan opsi tombol alih-alih menebak.
- **Recent chat** — riwayat percakapan tersimpan permanen di database.

### Akses & tampilan

- **Auth multi-peran** — Admin (owner) & Karyawan, sesi via cookie ber-tanda-tangan
  HMAC; password admin di-hash (bcrypt).
- **Sidebar bisa diciutkan** — navbar utama jadi rail ikon, dan panel riwayat AI
  bisa disembunyikan, agar area kerja lebih luas (preferensi tersimpan).
- **Dark mode** & desain responsif.

---

## 🛠 Tech Stack

| Layer | Teknologi |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) + React 19 + TypeScript |
| Styling | Tailwind CSS v4 + komponen ala shadcn/ui (Radix UI) |
| Database | PostgreSQL (Neon) |
| ORM | Prisma 7 (driver adapter `@prisma/adapter-pg`) |
| Charts | Recharts |
| AI Assistant | Qwen / Alibaba DashScope (OpenAI-compatible); vision `qwen3-vl-plus` |
| Parsing file | `pdf-parse` (PDF), `mammoth` (Word), ExcelJS (Excel) |
| Penyimpanan file | Vercel Blob (logo, bukti bayar, gambar AI) |
| Auth | Cookie ber-tanda-tangan HMAC + `bcryptjs` |
| Export | ExcelJS |
| Notifikasi UI | Sonner |
| Deploy | Vercel |

---

## 🚀 Menjalankan Lokal

```bash
pnpm install
cp .env.example .env          # isi variabel (lihat di bawah)
pnpm prisma db push           # buat skema di database
pnpm db:seed                  # isi data contoh (opsional)
pnpm dev
```

Buka http://localhost:3000 — login admin dengan username `admin` dan password
dari `AUTH_PASSWORD` (default `voltra-admin`).

---

## 🔐 Environment Variables

| Variable | Wajib | Keterangan |
|---|---|---|
| `DATABASE_URL` | ✅ | Connection string PostgreSQL (pakai pooled URL untuk serverless) |
| `AUTH_SECRET` | ✅ | Secret untuk menandatangani cookie sesi (string acak panjang) |
| `AUTH_PASSWORD` | ✅ | Password admin awal (bisa diganti via Pengaturan; setelah diganti tersimpan ter-hash di DB) |
| `ADMIN_USERNAME` | – | Username admin (default `admin`) |
| `BLOB_READ_WRITE_TOKEN` | – | Token Vercel Blob — untuk upload logo, bukti pembayaran/fee, & gambar di AI |
| `OPENAI_BASE_URL` | – | Endpoint AI OpenAI-compatible (mis. DashScope: `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`) |
| `OPENAI_API_KEY` | – | API key provider AI |
| `OPENAI_MODEL` | – | Model teks (default `qwen-plus`) |
| `OPENAI_VISION_MODEL` | – | Model vision untuk analisa gambar (default `qwen3-vl-plus`) |

> Fitur **AI Assistant** otomatis nonaktif (memberi pesan ramah) bila
> `OPENAI_API_KEY` belum diisi. Backend bersifat OpenAI-compatible, jadi bisa
> diarahkan ke DashScope (Qwen), OpenRouter, Groq, dll. cukup lewat env.

---

## 📦 Scripts

- `pnpm dev` — development server
- `pnpm build` — `prisma generate` + production build
- `pnpm db:push` — sinkron skema ke database
- `pnpm db:seed` — isi data contoh
- `pnpm db:studio` — Prisma Studio

---

## 📚 Dokumentasi

- **Konsep & perancangan sistem:** [`VOLTRA_PMS_Documentation.md`](./VOLTRA_PMS_Documentation.md)
- **Catatan untuk agen / AI coding:** [`AGENTS.md`](./AGENTS.md)
