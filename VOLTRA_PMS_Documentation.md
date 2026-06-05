# Voltra Techno — Project Management System (PMS)

## Dokumentasi Konsep & Perancangan Sistem

---

## 1. Gambaran Umum

Voltra Techno PMS adalah sistem manajemen proyek berbasis web yang dirancang khusus untuk perusahaan jasa development teknologi. Sistem ini mencakup tiga pilar utama: manajemen proyek, manajemen SDM (karyawan & role), dan manajemen keuangan proyek.

**Pengguna:** Single user (Owner/PM)
**Cakupan bisnis:** Jasa pembuatan teknologi di bidang IoT, Robotika, Machine Learning, PLC, SCADA, dan development teknologi lainnya.

---

## 2. Daftar Modul

### 2.1 Modul Manajemen Proyek

Modul inti untuk mengelola seluruh lifecycle proyek dari inquiry hingga closed.

**Fitur:**

- CRUD proyek dengan detail lengkap (nama, deskripsi, klien, nilai kontrak, tanggal mulai, deadline)
- Kategori proyek bersifat dinamis (IoT, Machine Learning, PLC, SCADA, 3D Design, Robotika, dll — bisa ditambah/hapus oleh owner)
- Satu proyek bisa memiliki lebih dari satu kategori
- Status proyek mengikuti lifecycle: Inquiry → Quotation → Approved → In Progress → Delivered → Paid → Closed, ditambah On Hold, Cancelled, Dispute
- Progress proyek dalam persen (input manual oleh owner)
- Assignment karyawan ke proyek (multi-karyawan per proyek, multi-proyek per karyawan)
- Setiap assignment mencantumkan role yang dikerjakan dan fee yang ditentukan manual oleh owner
- Catatan/notes per proyek

**Data yang disimpan per proyek:**

| Field | Tipe | Keterangan |
|---|---|---|
| Nama Proyek | Text | Nama proyek |
| Deskripsi | Long Text | Penjelasan detail proyek |
| Klien | Relasi | Link ke data klien |
| Kategori | Multi-select (dinamis) | IoT, ML, PLC, SCADA, dll |
| Role yang Dibutuhkan | Multi-select (dinamis) | Firmware Engineer, 3D Drafter, dll |
| Nilai Kontrak | Currency (IDR) | Total nilai deal dengan klien |
| Tanggal Mulai | Date | - |
| Deadline | Date | - |
| Status | Enum | Lifecycle status |
| Progress | Integer (0-100) | Persen progress |
| Catatan | Long Text | Notes tambahan |

---

### 2.2 Modul Manajemen Karyawan

Modul untuk mengelola data karyawan, role, assignment, dan riwayat kerja.

**Fitur:**

- CRUD karyawan (tambah, edit, nonaktifkan/pecat)
- Setiap karyawan memiliki satu atau lebih role
- Daftar role bersifat dinamis, bisa ditambah/hapus. Role awal:
  - Firmware Engineer
  - 3D Drafter
  - Electrical Engineer
  - ML Engineer
  - Frontend Developer
  - Backend Developer
  - Fullstack Developer
  - Automation Engineer
  - IoT Developer
  - Mechanic Assembler
  - Electronic Assembler
  - Electronic Designer
- Tampilan daftar karyawan dengan status: sedang mengerjakan proyek apa saja, atau sedang idle
- Riwayat karyawan: daftar proyek yang pernah dikerjakan, role di proyek tersebut, dan fee yang diterima
- Ringkasan total pendapatan per karyawan (lifetime dan per periode)

**Data yang disimpan per karyawan:**

| Field | Tipe | Keterangan |
|---|---|---|
| Nama | Text | Nama lengkap |
| Kontak | Text | No HP / Email |
| Role | Multi-select (dinamis) | Bisa lebih dari satu role |
| Status | Enum | Aktif / Nonaktif |
| Tanggal Bergabung | Date | - |
| Tanggal Keluar | Date (nullable) | Diisi saat dipecat/resign |
| Catatan | Long Text | Notes tambahan |

---

### 2.3 Modul Kebutuhan Proyek (BOM — Bill of Materials)

Modul untuk mencatat seluruh kebutuhan material/komponen per proyek.

**Fitur:**

- CRUD item kebutuhan per proyek
- Setiap item mencatat: nama, jumlah, link pembelian (opsional), harga satuan — harga total dihitung otomatis
- Sumber item: dari perusahaan (pengeluaran) atau dari klien (tidak masuk pengeluaran, hanya tercatat)
- Status pembelian: Belum Dibeli → Sudah Dibeli → Sudah Di-reimburse Klien (untuk skenario perusahaan beli dulu, klien ganti)
- Biaya tambahan per proyek: ongkir, biaya admin, biaya lain-lain — bisa ditambah secara dinamis (nama biaya + nominal)
- Total kebutuhan proyek = total harga item + total biaya tambahan

**Data yang disimpan per item:**

| Field | Tipe | Keterangan |
|---|---|---|
| Nama Item | Text | Nama komponen/material |
| Jumlah | Integer | Quantity |
| Link | URL (nullable) | Link pembelian jika ada |
| Harga Satuan | Currency (IDR) | - |
| Harga Total | Currency (IDR) | Otomatis: jumlah × harga satuan |
| Sumber | Enum | Perusahaan / Klien / Reimburse |
| Status Pembelian | Enum | Belum Dibeli / Sudah Dibeli / Di-reimburse |

**Data biaya tambahan:**

| Field | Tipe | Keterangan |
|---|---|---|
| Nama Biaya | Text | Ongkir, Admin, dll (dinamis) |
| Nominal | Currency (IDR) | - |

---

### 2.4 Modul Pembayaran Klien

Modul untuk tracking pembayaran dari klien per proyek.

**Fitur:**

- Skema pembayaran custom per proyek: jumlah termin bebas, persentase tiap termin bebas (default: 2 termin, 50/50)
- Setiap termin mencatat: nama termin, persentase, nominal (otomatis dari % × nilai kontrak), status (Belum Bayar / Sudah Bayar), tanggal bayar
- Total terbayar dan sisa pembayaran dihitung otomatis
- Status lunas otomatis ketika semua termin sudah dibayar (100%)
- Trigger: ketika proyek lunas, fee karyawan siap dicairkan

**Data yang disimpan per termin:**

| Field | Tipe | Keterangan |
|---|---|---|
| Nama Termin | Text | "DP", "Termin 2", "Pelunasan", dll |
| Persentase | Decimal | Misal 50% |
| Nominal | Currency (IDR) | Otomatis: % × nilai kontrak |
| Status | Enum | Belum Bayar / Sudah Bayar |
| Tanggal Bayar | Date (nullable) | Diisi saat sudah bayar |

---

### 2.5 Modul Keuangan & Pelaporan

Modul untuk melihat ringkasan keuangan per proyek dan keseluruhan bisnis.

**Fitur:**

**Per Proyek (Profit & Loss):**

```
Pendapatan (Nilai Kontrak)                     Rp 50.000.000
─────────────────────────────────────────────────────────────
Pengeluaran:
  Material & Komponen (dari perusahaan)         Rp 15.000.000
  Biaya Tambahan (ongkir, admin, dll)           Rp  2.500.000
  Total Fee Karyawan                            Rp 12.000.000
─────────────────────────────────────────────────────────────
Total Pengeluaran                               Rp 29.500.000
═════════════════════════════════════════════════════════════
Profit Perusahaan                               Rp 20.500.000
```

- Breakdown fee per karyawan yang terlibat
- Breakdown material dari perusahaan vs dari klien vs reimburse
- Status pembayaran klien (sudah bayar berapa, sisa berapa)
- Status pencairan fee karyawan (sudah cair / belum — tergantung lunas tidaknya proyek)

**Keseluruhan Bisnis (Dashboard):**

- Total proyek aktif (In Progress)
- Total proyek per status
- Total pendapatan (periode tertentu: bulan/kuartal/tahun)
- Total pengeluaran (material + fee karyawan + biaya tambahan)
- Total profit perusahaan
- Total outstanding (belum dibayar klien)
- Daftar karyawan aktif dan sedang idle
- Proyek yang mendekati deadline

---

### 2.6 Modul Klien (CRM Ringan)

**Fitur:**

- CRUD data klien
- Riwayat proyek per klien
- Total nilai proyek per klien (lifetime)
- Status outstanding payment per klien

**Data yang disimpan per klien:**

| Field | Tipe | Keterangan |
|---|---|---|
| Nama Klien | Text | Perorangan atau perusahaan |
| PIC (Person in Charge) | Text | Nama kontak person |
| Kontak | Text | No HP / Email |
| Alamat | Text | - |
| Catatan | Long Text | Notes tambahan |

---

## 3. Lifecycle Proyek (Alur Lengkap)

```
┌──────────┐    ┌───────────┐    ┌──────────┐    ┌─────────────┐
│ INQUIRY  │───→│ QUOTATION │───→│ APPROVED │───→│ IN PROGRESS │
└──────────┘    └───────────┘    └──────────┘    └──────┬──────┘
                                                        │
                     ┌──────────┐    ┌──────┐    ┌──────▼──────┐
                     │  CLOSED  │◀───│ PAID │◀───│  DELIVERED  │
                     └──────────┘    └──────┘    └─────────────┘

  Status Alternatif: ON HOLD ↔ IN PROGRESS
                     CANCELLED (dari status manapun)
                     DISPUTE (dari DELIVERED atau PAID)
```

**Penjelasan tiap status:**

| Status | Keterangan |
|---|---|
| Inquiry | Klien menghubungi, belum ada penawaran resmi |
| Quotation | Sudah kirim penawaran, menunggu keputusan klien |
| Approved | Klien setuju, proyek siap dimulai |
| In Progress | Proyek sedang dikerjakan |
| Delivered | Proyek sudah diserahkan ke klien |
| Paid | Klien sudah lunas 100% |
| Closed | Proyek selesai sepenuhnya, fee karyawan sudah dicairkan |
| On Hold | Proyek ditunda sementara |
| Cancelled | Proyek dibatalkan |
| Dispute | Ada masalah pembayaran atau deliverable |

---

## 4. Database Schema (ERD)

### Tabel Utama

**projects**
```
id                  UUID (PK)
name                VARCHAR(255)
description         TEXT
client_id           UUID (FK → clients.id)
contract_value      DECIMAL(15,2)
start_date          DATE
deadline            DATE
status              ENUM (inquiry, quotation, approved, in_progress,
                         delivered, paid, closed, on_hold,
                         cancelled, dispute)
progress            INTEGER (0-100)
notes               TEXT
created_at          TIMESTAMP
updated_at          TIMESTAMP
```

**clients**
```
id                  UUID (PK)
name                VARCHAR(255)
pic_name            VARCHAR(255)
contact             VARCHAR(255)
address             TEXT
notes               TEXT
created_at          TIMESTAMP
updated_at          TIMESTAMP
```

**employees**
```
id                  UUID (PK)
name                VARCHAR(255)
contact             VARCHAR(255)
status              ENUM (active, inactive)
joined_at           DATE
left_at             DATE (nullable)
notes               TEXT
created_at          TIMESTAMP
updated_at          TIMESTAMP
```

**categories** (dinamis: IoT, ML, PLC, SCADA, dll)
```
id                  UUID (PK)
name                VARCHAR(255)
created_at          TIMESTAMP
```

**roles** (dinamis: Firmware Engineer, 3D Drafter, dll)
```
id                  UUID (PK)
name                VARCHAR(255)
created_at          TIMESTAMP
```

### Tabel Relasi

**project_categories** (many-to-many)
```
project_id          UUID (FK → projects.id)
category_id         UUID (FK → categories.id)
```

**project_required_roles** (role yang dibutuhkan proyek)
```
project_id          UUID (FK → projects.id)
role_id             UUID (FK → roles.id)
```

**employee_roles** (many-to-many)
```
employee_id         UUID (FK → employees.id)
role_id             UUID (FK → roles.id)
```

**project_assignments** (karyawan di-assign ke proyek)
```
id                  UUID (PK)
project_id          UUID (FK → projects.id)
employee_id         UUID (FK → employees.id)
role_id             UUID (FK → roles.id)
fee                 DECIMAL(15,2)
fee_status          ENUM (pending, paid)
assigned_at         DATE
notes               TEXT
```

**project_items** (BOM — kebutuhan material)
```
id                  UUID (PK)
project_id          UUID (FK → projects.id)
name                VARCHAR(255)
quantity            INTEGER
link                TEXT (nullable)
unit_price          DECIMAL(15,2)
total_price         DECIMAL(15,2)  — otomatis: quantity × unit_price
source              ENUM (company, client, reimburse)
purchase_status     ENUM (not_purchased, purchased, reimbursed)
created_at          TIMESTAMP
updated_at          TIMESTAMP
```

**project_additional_costs** (ongkir, admin, dll)
```
id                  UUID (PK)
project_id          UUID (FK → projects.id)
name                VARCHAR(255)
amount              DECIMAL(15,2)
created_at          TIMESTAMP
```

**project_payment_terms** (termin pembayaran klien)
```
id                  UUID (PK)
project_id          UUID (FK → projects.id)
term_name           VARCHAR(255)
percentage          DECIMAL(5,2)
amount              DECIMAL(15,2)  — otomatis: percentage × contract_value
status              ENUM (unpaid, paid)
paid_at             DATE (nullable)
created_at          TIMESTAMP
```

---

## 5. Relasi Antar Tabel (ERD Visual)

```
clients ─────────────┐
                      │ 1:N
                      ▼
categories ◀──N:M──▶ projects ◀──N:M──▶ roles (required)
                      │   │   │
                      │   │   │
               1:N ┌──┘   │   └──┐ 1:N
                   ▼      │      ▼
          project_items   │   project_additional_costs
                          │
                   1:N ┌──┴──┐ 1:N
                       ▼     ▼
       project_assignments  project_payment_terms
              │
              │ N:1
              ▼
          employees ◀──N:M──▶ roles (employee skills)
```

---

## 6. Integrasi Eksternal

### 6.1 Export ke Spreadsheet

Semua data pelaporan bisa di-export ke format .xlsx / .csv:

- Laporan P&L per proyek
- Laporan keuangan keseluruhan (bulanan/kuartalan/tahunan)
- Daftar karyawan dan riwayat proyek
- Daftar BOM per proyek
- Rekap fee karyawan per periode
- Daftar proyek dan statusnya

Implementasi: tombol "Export to Spreadsheet" di setiap halaman laporan, generate file .xlsx menggunakan library (SheetJS/ExcelJS).

### 6.2 Integrasi Notion (Task Management)

Notion digunakan sebagai task management tool untuk karyawan. Integrasi via Notion API:

**Alur sinkronisasi:**

- Saat proyek di-approve dan karyawan di-assign, sistem otomatis membuat Notion page/database entry berisi:
  - Nama proyek
  - Karyawan yang terlibat
  - Deadline
  - Task breakdown (jika diisi di sistem)
- Status di Notion bisa disinkronkan kembali ke PMS (opsional)
- Setiap karyawan bisa diberikan akses ke Notion workspace untuk melihat task mereka

**Notion Database Structure:**

| Property | Tipe | Keterangan |
|---|---|---|
| Project | Title | Nama proyek |
| Assignee | Person/Text | Karyawan yang mengerjakan |
| Role | Select | Role di proyek ini |
| Status | Status | To Do / In Progress / Done |
| Deadline | Date | Deadline proyek |
| Priority | Select | Low / Medium / High |
| Notes | Rich Text | Catatan tambahan |

---

## 7. Halaman & UI Flow

### 7.1 Dashboard (Halaman Utama)

```
┌─────────────────────────────────────────────────────────┐
│                    VOLTRA TECHNO PMS                     │
├──────────┬──────────┬──────────┬────────────────────────┤
│ Proyek   │ Karyawan │ Karyawan │ Outstanding            │
│ Aktif: 5 │ Aktif: 8 │ Idle: 3  │ Payment: Rp 25.000.000│
├──────────┴──────────┴──────────┴────────────────────────┤
│                                                         │
│  Proyek Aktif              Progress   Deadline   Status │
│  ─────────────────────────────────────────────────────  │
│  Smart Greenhouse IoT      ████░░ 60%  15 Jul    On Track│
│  Robot Arm Assembly        ██░░░░ 30%  20 Jul    At Risk │
│  SCADA Monitoring System   ████████ 90% 10 Jul   On Track│
│                                                         │
│  Alert: 2 proyek mendekati deadline                     │
│  Alert: 1 pembayaran klien overdue                      │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  Keuangan Bulan Ini                                     │
│  Pendapatan: Rp 120.000.000                             │
│  Pengeluaran: Rp 65.000.000                             │
│  Profit: Rp 55.000.000                                  │
└─────────────────────────────────────────────────────────┘
```

### 7.2 Daftar Halaman

| No | Halaman | Fungsi |
|---|---|---|
| 1 | Dashboard | Overview bisnis keseluruhan |
| 2 | Daftar Proyek | List semua proyek + filter status/kategori |
| 3 | Detail Proyek | Semua info proyek: assignment, BOM, payment, P&L |
| 4 | Tambah/Edit Proyek | Form CRUD proyek |
| 5 | Daftar Karyawan | List karyawan + status aktif/idle |
| 6 | Detail Karyawan | Info karyawan, proyek aktif, riwayat, total fee |
| 7 | Tambah/Edit Karyawan | Form CRUD karyawan |
| 8 | Daftar Klien | List klien + outstanding payment |
| 9 | Detail Klien | Info klien, riwayat proyek, total transaksi |
| 10 | Pengaturan | Kelola kategori proyek & role (dinamis) |
| 11 | Laporan Keuangan | Report P&L, filter per periode, export |
| 12 | Rekap Fee Karyawan | Rekap pembayaran fee per karyawan per periode |

---

## 8. Rekomendasi Tech Stack

### Frontend
- **Framework:** Next.js (React) dengan TypeScript
- **UI Library:** Tailwind CSS + shadcn/ui
- **State Management:** Zustand atau React Query
- **Charts:** Recharts (untuk dashboard & laporan)
- **Export Spreadsheet:** SheetJS (xlsx)

### Backend
- **Framework:** Next.js API Routes (fullstack) atau terpisah dengan Express/Fastify
- **Database:** PostgreSQL (via Supabase untuk kemudahan)
- **ORM:** Prisma
- **Authentication:** Supabase Auth (single user, cukup email/password)

### Integrasi
- **Notion API:** @notionhq/client (official SDK)
- **Spreadsheet Export:** SheetJS / ExcelJS

### Deployment
- **Hosting:** Vercel (frontend + API) atau VPS (self-hosted)
- **Database:** Supabase (managed PostgreSQL)

---

## 9. Ringkasan Keputusan Desain

| Keputusan | Detail |
|---|---|
| Model fee karyawan | Input manual per assignment per proyek oleh owner |
| Pembayaran fee | Dicairkan setelah proyek lunas 100% dari klien |
| Struktur organisasi | Flat — semua engineer langsung di bawah owner/PM |
| Termin pembayaran klien | Custom (default 2x 50/50, bisa diubah) |
| Durasi proyek maksimal | ± 1 bulan |
| Kategori & role | Dinamis, bisa ditambah/hapus |
| Sumber hardware | Dari perusahaan (pengeluaran) / dari klien (tercatat saja) / reimburse |
| Proyek internal/R&D | Tidak ada |
| Pengguna sistem | Single user (owner) |
| Task management | Diintegrasikan ke Notion |
| Pelaporan | In-app + export ke spreadsheet (.xlsx) |

---

## 10. Fase Pengembangan (Roadmap Saran)

### Fase 1 — Core (Minggu 1-2)
- Setup project, database, auth
- CRUD Klien
- CRUD Karyawan + Role (dinamis)
- CRUD Kategori Proyek (dinamis)

### Fase 2 — Proyek & BOM (Minggu 3-4)
- CRUD Proyek + lifecycle status
- Assignment karyawan ke proyek + fee
- BOM (kebutuhan material) + biaya tambahan
- Termin pembayaran klien

### Fase 3 — Keuangan & Dashboard (Minggu 5-6)
- P&L per proyek (otomatis)
- Dashboard utama dengan ringkasan bisnis
- Laporan keuangan per periode
- Rekap fee karyawan

### Fase 4 — Integrasi & Polish (Minggu 7-8)
- Export spreadsheet (.xlsx)
- Integrasi Notion API
- Alert/reminder (deadline, overdue payment)
- Responsive design & final polish

---

*Dokumen ini adalah acuan pengembangan Voltra Techno PMS. Semua fitur dan keputusan desain berdasarkan diskusi requirement dengan owner.*
