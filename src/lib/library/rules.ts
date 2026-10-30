import type { LibraryState, Loan, Settings, User } from "./types";

const DAY = 86_400_000;

export function daysBetween(fromISO: string, to: Date): number {
  const a = new Date(fromISO);
  const start = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((end - start) / DAY);
}

/** Whole days late; 0 when returned on or before the due date. */
export function daysOverdue(dueISO: string, at: Date): number {
  return Math.max(0, daysBetween(dueISO, at));
}

export function calculateFine(dueISO: string, at: Date, finePerDay: number): number {
  return daysOverdue(dueISO, at) * finePerDay;
}

export function addDays(d: Date, n: number): string {
  return new Date(d.getTime() + n * DAY).toISOString();
}

export function outstandingFines(state: LibraryState, userId: string): number {
  return state.fines.filter((f) => f.userId === userId && f.status === "unpaid").reduce((s, f) => s + f.amount, 0);
}

export function checkIssueEligibility(
  state: LibraryState,
  user: User,
): { ok: true } | { ok: false; reason: string } {
  if (!user.active) return { ok: false, reason: "Account is inactive" };
  const active = state.loans.filter((l) => l.userId === user.id && l.status === "active").length;
  const limit = Math.min(user.maxBorrowLimit, state.settings.maxLoans);
  if (active >= limit) return { ok: false, reason: `Loan limit reached (${active}/${limit})` };
  const dues = outstandingFines(state, user.id);
  if (dues > state.settings.fineBlockThreshold)
    return { ok: false, reason: `Unpaid fines ₹${dues} exceed ₹${state.settings.fineBlockThreshold}` };
  return { ok: true };
}

export function canRenew(state: LibraryState, loan: Loan, settings: Settings, now: Date): { ok: boolean; reason?: string } {
  if (loan.status !== "active") return { ok: false, reason: "Loan closed" };
  if (loan.renewals >= settings.maxRenewals) return { ok: false, reason: "Renewal limit reached" };
  if (daysOverdue(loan.dueDate, now) > 0) return { ok: false, reason: "Overdue loans cannot be renewed" };
  const waiting = state.reservations.some((r) => r.bookId === loan.bookId && r.status === "waiting");
  if (waiting) return { ok: false, reason: "Other students are waiting" };
  return { ok: true };
}

export function dueBadge(dueISO: string, now: Date): { tone: "success" | "warning" | "destructive"; label: string } {
  const left = -daysBetween(dueISO, now);
  if (left < 0) return { tone: "destructive", label: `${-left}d overdue` };
  if (left <= 3) return { tone: "warning", label: left === 0 ? "Due today" : `${left}d left` };
  return { tone: "success", label: `${left}d left` };
}

export function availability(available: number, total: number) {
  if (total === 0 || available === 0) return { tone: "destructive" as const, label: "Out of stock" };
  if (available <= 2) return { tone: "warning" as const, label: `Limited · ${available} left` };
  return { tone: "success" as const, label: `Available · ${available}` };
}
