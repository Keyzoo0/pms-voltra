// Shared labels, status metadata and option lists for the UI layer.

export type ProjectStatus =
  | "inquiry"
  | "quotation"
  | "approved"
  | "in_progress"
  | "delivered"
  | "paid"
  | "closed"
  | "on_hold"
  | "cancelled"
  | "dispute";

type StatusMeta = { label: string; badge: string; dot: string };

export const PROJECT_STATUS: Record<ProjectStatus, StatusMeta> = {
  inquiry: {
    label: "Inquiry",
    badge:
      "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-400/15 dark:text-slate-300 dark:ring-slate-400/25",
    dot: "bg-slate-400",
  },
  quotation: {
    label: "Quotation",
    badge:
      "bg-sky-100 text-sky-700 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-400/25",
    dot: "bg-sky-500",
  },
  approved: {
    label: "Approved",
    badge:
      "bg-violet-100 text-violet-700 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-400/25",
    dot: "bg-violet-500",
  },
  in_progress: {
    label: "In Progress",
    badge:
      "bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/25",
    dot: "bg-amber-500",
  },
  delivered: {
    label: "Delivered",
    badge:
      "bg-cyan-100 text-cyan-700 ring-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-300 dark:ring-cyan-400/25",
    dot: "bg-cyan-500",
  },
  paid: {
    label: "Paid",
    badge:
      "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/25",
    dot: "bg-emerald-500",
  },
  closed: {
    label: "Closed",
    badge:
      "bg-slate-800 text-slate-100 ring-slate-700 dark:bg-slate-200/15 dark:text-slate-200 dark:ring-slate-200/20",
    dot: "bg-slate-400",
  },
  on_hold: {
    label: "On Hold",
    badge:
      "bg-orange-100 text-orange-700 ring-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-400/25",
    dot: "bg-orange-500",
  },
  cancelled: {
    label: "Cancelled",
    badge:
      "bg-slate-100 text-slate-400 ring-slate-200 line-through dark:bg-slate-500/10 dark:text-slate-500 dark:ring-slate-500/20",
    dot: "bg-slate-300",
  },
  dispute: {
    label: "Dispute",
    badge:
      "bg-red-100 text-red-700 ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-400/25",
    dot: "bg-red-500",
  },
};

export const PROJECT_STATUS_OPTIONS = (
  Object.keys(PROJECT_STATUS) as ProjectStatus[]
).map((value) => ({ value, label: PROJECT_STATUS[value].label }));

/** Statuses considered "active work in progress" for dashboard counts. */
export const ACTIVE_STATUSES: ProjectStatus[] = [
  "approved",
  "in_progress",
  "delivered",
];

/** Statuses where a project is effectively closed/dead. */
export const FINISHED_STATUSES: ProjectStatus[] = [
  "closed",
  "cancelled",
];

export type EmployeeStatus = "active" | "inactive";
export const EMPLOYEE_STATUS: Record<EmployeeStatus, StatusMeta> = {
  active: {
    label: "Aktif",
    badge:
      "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/25",
    dot: "bg-emerald-500",
  },
  inactive: {
    label: "Nonaktif",
    badge:
      "bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:ring-slate-500/20",
    dot: "bg-slate-400",
  },
};

export type ItemSource = "company" | "client" | "reimburse";
export const ITEM_SOURCE: Record<ItemSource, StatusMeta> = {
  company: {
    label: "Perusahaan",
    badge:
      "bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-400/25",
    dot: "bg-rose-500",
  },
  client: {
    label: "Klien",
    badge:
      "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-400/15 dark:text-slate-300 dark:ring-slate-400/25",
    dot: "bg-slate-400",
  },
  reimburse: {
    label: "Reimburse",
    badge:
      "bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/25",
    dot: "bg-amber-500",
  },
};
export const ITEM_SOURCE_OPTIONS = (
  Object.keys(ITEM_SOURCE) as ItemSource[]
).map((value) => ({ value, label: ITEM_SOURCE[value].label }));

export type PurchaseStatus = "not_purchased" | "purchased" | "reimbursed";
export const PURCHASE_STATUS: Record<PurchaseStatus, StatusMeta> = {
  not_purchased: {
    label: "Belum Dibeli",
    badge:
      "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-400/15 dark:text-slate-300 dark:ring-slate-400/25",
    dot: "bg-slate-400",
  },
  purchased: {
    label: "Sudah Dibeli",
    badge:
      "bg-sky-100 text-sky-700 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-400/25",
    dot: "bg-sky-500",
  },
  reimbursed: {
    label: "Di-reimburse",
    badge:
      "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/25",
    dot: "bg-emerald-500",
  },
};
export const PURCHASE_STATUS_OPTIONS = (
  Object.keys(PURCHASE_STATUS) as PurchaseStatus[]
).map((value) => ({ value, label: PURCHASE_STATUS[value].label }));

export type PaymentStatus = "unpaid" | "paid";
export const PAYMENT_STATUS: Record<PaymentStatus, StatusMeta> = {
  unpaid: {
    label: "Belum Bayar",
    badge:
      "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-400/15 dark:text-slate-300 dark:ring-slate-400/25",
    dot: "bg-slate-400",
  },
  paid: {
    label: "Sudah Bayar",
    badge:
      "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/25",
    dot: "bg-emerald-500",
  },
};

export type FeeStatus = "pending" | "paid";
export const FEE_STATUS: Record<FeeStatus, StatusMeta> = {
  pending: {
    label: "Pending",
    badge:
      "bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/25",
    dot: "bg-amber-500",
  },
  paid: {
    label: "Cair",
    badge:
      "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/25",
    dot: "bg-emerald-500",
  },
};

export const DEFAULT_CATEGORIES = [
  "IoT",
  "Machine Learning",
  "PLC",
  "SCADA",
  "3D Design",
  "Robotika",
  "Firmware",
  "Web Development",
];

export const DEFAULT_ROLES = [
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
