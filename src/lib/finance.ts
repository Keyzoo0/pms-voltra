import { toNum } from "@/lib/utils";

export type ProjectFinance = {
  revenue: number;
  materialCompany: number;
  materialClient: number;
  materialReimburse: number;
  additional: number;
  fees: number;
  expense: number;
  profit: number;
  margin: number;
  paid: number;
  outstanding: number;
  isFullyPaid: boolean;
  feesPaid: number;
  feesPending: number;
};

type Money = number | string | { toString(): string } | null | undefined;

export type FinanceInput = {
  contractValue: Money;
  assignments?: { fee: Money; feeStatus?: string | null }[];
  items?: { totalPrice: Money; source?: string | null }[];
  additionalCosts?: { amount: Money }[];
  paymentTerms?: { amount: Money; status?: string | null }[];
};

/**
 * Compute the full profit & loss picture for a single project.
 *
 * Expense = material bought by the company + additional costs + employee fees.
 * Materials sourced from the client (or already reimbursed) are recorded but
 * are not counted as a net company expense.
 */
export function computeProjectFinance(p: FinanceInput): ProjectFinance {
  const revenue = toNum(p.contractValue);
  const items = p.items ?? [];

  const materialCompany = items
    .filter((i) => i.source === "company")
    .reduce((s, i) => s + toNum(i.totalPrice), 0);
  const materialClient = items
    .filter((i) => i.source === "client")
    .reduce((s, i) => s + toNum(i.totalPrice), 0);
  const materialReimburse = items
    .filter((i) => i.source === "reimburse")
    .reduce((s, i) => s + toNum(i.totalPrice), 0);

  const additional = (p.additionalCosts ?? []).reduce(
    (s, c) => s + toNum(c.amount),
    0,
  );

  const assignments = p.assignments ?? [];
  const fees = assignments.reduce((s, a) => s + toNum(a.fee), 0);
  const feesPaid = assignments
    .filter((a) => a.feeStatus === "paid")
    .reduce((s, a) => s + toNum(a.fee), 0);
  const feesPending = fees - feesPaid;

  const expense = materialCompany + additional + fees;
  const profit = revenue - expense;
  const margin = revenue > 0 ? profit / revenue : 0;

  const paid = (p.paymentTerms ?? [])
    .filter((t) => t.status === "paid")
    .reduce((s, t) => s + toNum(t.amount), 0);
  const outstanding = Math.max(0, revenue - paid);
  const isFullyPaid = revenue > 0 && paid >= revenue - 0.5;

  return {
    revenue,
    materialCompany,
    materialClient,
    materialReimburse,
    additional,
    fees,
    expense,
    profit,
    margin,
    paid,
    outstanding,
    isFullyPaid,
    feesPaid,
    feesPending,
  };
}

/** Sum a numeric field over a list, coercing Prisma Decimals. */
export function sumBy<T>(rows: T[], pick: (row: T) => Money): number {
  return rows.reduce((s, r) => s + toNum(pick(r)), 0);
}
