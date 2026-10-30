import { useSyncExternalStore } from "react";
import type { LibraryState, Loan, Role, User } from "./types";
import { firebaseConfigured } from "@/lib/firebase";
import { connectFirestore, libraryCommand } from "./remote";
import { buildSeed } from "./seed";
import { addDays, calculateFine, canRenew, checkIssueEligibility, daysOverdue } from "./rules";

const KEY = "unilibrary.v1";
const SESSION = "unilibrary.session";

const initialState = () => {
  const seed = buildSeed(new Date("2026-10-27T00:00:00Z"));
  if (!firebaseConfigured) return seed;
  return { ...seed, books: [], copies: [], users: [], loans: [], reservations: [], fines: [], wishlists: [], notifications: [], reviews: [], resources: [], audit: [], recent: [] };
};
let state: LibraryState = initialState();
let externalUser: User | null = null;
let sessionId: string | null = null;
const listeners = new Set<() => void>();
let hydrated = false;

function emit() {
  if (!firebaseConfigured && typeof window !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(state));
    if (sessionId) localStorage.setItem(SESSION, sessionId);
    else localStorage.removeItem(SESSION);
  }
  listeners.forEach((l) => l());
}

export function hydrateStore() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  if (firebaseConfigured) {
    void connectFirestore((key, rows) => {
      if (key === "resources" && rows && typeof rows === "object" && "ownerRows" in rows) {
        const own = (rows as { ownerRows: LibraryState["resources"] }).ownerRows;
        state = { ...state, resources: [...state.resources.filter(r => !own.some(o => o.id === r.id)), ...own] };
      } else state = { ...state, [key]: rows };
      if (key === "users" && externalUser) externalUser = { ...externalUser, ...state.users.find(u => u.id === externalUser?.id), role: externalUser.role };
      emit();
    }, user => { externalUser = user; sessionId = user?.id ?? null; emit(); }, message => { void import("sonner").then(({ toast }) => toast.error(message)); });
    return;
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = JSON.parse(raw);
    sessionId = localStorage.getItem(SESSION);
  } catch {
    /* corrupt storage: keep seed */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

type Snap = { state: LibraryState; user: User | null };
let snap: Snap = { state, user: null };
function getSnap(): Snap {
  const user = firebaseConfigured ? externalUser : sessionId ? state.users.find((u) => u.id === sessionId) ?? null : null;
  if (snap.state !== state || snap.user !== user) snap = { state, user };
  return snap;
}
const serverSnap: Snap = { state, user: null };

export function useLibrary() {
  return useSyncExternalStore(subscribe, getSnap, () => serverSnap);
}

function set(mut: (s: LibraryState) => LibraryState) {
  state = mut(state);
  emit();
}
const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
function log(s: LibraryState, action: string, detail: string): LibraryState {
  return { ...s, audit: [{ id: uid("a"), actorId: sessionId ?? "system", action, detail, timestamp: new Date().toISOString() }, ...s.audit] };
}
function notify(s: LibraryState, userId: string, message: string, type: "info" | "due" | "reservation" | "fine"): LibraryState {
  return { ...s, notifications: [{ id: uid("n"), userId, message, type, isRead: false, timestamp: new Date().toISOString() }, ...s.notifications] };
}
function me(): User {
  const u = state.users.find((x) => x.id === sessionId);
  if (!u) throw new Error("Please sign in first");
  return u;
}
function requireRole(...roles: Role[]) {
  const u = me();
  if (!roles.includes(u.role)) throw new Error("You don't have permission for this action");
  return u;
}
const title = (bookId: string) => state.books.find((b) => b.id === bookId)?.title ?? "Book";

const demoActions = {
  signInDemo(email: string) {
    const u = state.users.find((x) => x.email.toLowerCase() === email.toLowerCase());
    if (!u) throw new Error("No account with that email");
    sessionId = u.id;
    emit();
    return u;
  },
  /** Used after Firebase auth succeeds: map Firebase uid/email to a library profile. Role is never taken from the browser. */
  signInExternal(id: string, email: string, name: string, roleFromServer: Role) {
    const existing = state.users.find((x) => x.id === id || x.email === email);
    if (!existing) {
      state = { ...state, users: [...state.users, { id, email, name, role: roleFromServer, maxBorrowLimit: 4, active: true }] };
    }
    externalUser = { id, email, name, role: roleFromServer, maxBorrowLimit: 4, active: true };
    sessionId = firebaseConfigured ? id : existing?.id ?? id;
    emit();
  },
  register(name: string, email: string, rollNumber: string, department: string) {
    if (state.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) throw new Error("Email already registered");
    const u: User = { id: uid("u"), name, email, rollNumber, department, role: "student", maxBorrowLimit: 4, active: true };
    set((s) => log({ ...s, users: [...s.users, u] }, "user.register", email));
    sessionId = u.id;
    emit();
  },
  signOut() {
    sessionId = null;
    externalUser = null;
    if (firebaseConfigured) void import("firebase/auth").then(async ({ getAuth, signOut }) => { const { getFirebaseApp } = await import("@/lib/firebase"); const app = getFirebaseApp(); if (app) await signOut(getAuth(app)); });
    emit();
  },
  resetDemo() {
    state = buildSeed();
    emit();
  },
  toggleWishlist(bookId: string) {
    const u = me();
    set((s) => {
      const has = s.wishlists.some((w) => w.userId === u.id && w.bookId === bookId);
      return { ...s, wishlists: has ? s.wishlists.filter((w) => !(w.userId === u.id && w.bookId === bookId)) : [...s.wishlists, { userId: u.id, bookId }] };
    });
  },
  visit(bookId: string) {
    if (!sessionId) return;
    const id = sessionId;
    state = { ...state, recent: [{ userId: id, bookId, at: new Date().toISOString() }, ...state.recent.filter((r) => !(r.userId === id && r.bookId === bookId))].slice(0, 20) };
    emit();
  },
  reserve(bookId: string) {
    const u = me();
    if (state.reservations.some((r) => r.userId === u.id && r.bookId === bookId && (r.status === "waiting" || r.status === "ready")))
      throw new Error("You already reserved this book");
    if (state.loans.some((l) => l.userId === u.id && l.bookId === bookId && l.status === "active")) throw new Error("You already hold this book");
    set((s) =>
      log(
        notify({ ...s, reservations: [...s.reservations, { id: uid("r"), userId: u.id, bookId, status: "waiting", reservedAt: new Date().toISOString(), expiresAt: addDays(new Date(), 7) }] }, u.id, `Reservation placed for “${title(bookId)}”.`, "reservation"),
        "reservation.create",
        `${u.email} → ${title(bookId)}`,
      ),
    );
  },
  cancelReservation(id: string) {
    const u = me();
    set((s) => ({ ...s, reservations: s.reservations.map((r) => (r.id === id && (r.userId === u.id || u.role !== "student") ? { ...r, status: "cancelled" } : r)) }));
  },
  renew(loanId: string) {
    const u = me();
    const loan = state.loans.find((l) => l.id === loanId && l.userId === u.id);
    if (!loan) throw new Error("Loan not found");
    const r = canRenew(state, loan, state.settings, new Date());
    if (!r.ok) throw new Error(r.reason);
    set((s) => log({ ...s, loans: s.loans.map((l) => (l.id === loanId ? { ...l, renewals: l.renewals + 1, dueDate: addDays(new Date(l.dueDate), s.settings.loanDays) } : l)) }, "loan.renew", loanId));
  },
  payFine(fineId: string) {
    const u = me();
    set((s) => log({ ...s, fines: s.fines.map((f) => (f.id === fineId && (f.userId === u.id || u.role !== "student") ? { ...f, status: "paid" } : f)) }, "fine.pay", fineId));
  },
  waiveFine(fineId: string) {
    requireRole("librarian", "admin");
    set((s) => log({ ...s, fines: s.fines.map((f) => (f.id === fineId ? { ...f, status: "waived" } : f)) }, "fine.waive", fineId));
  },
  markRead(userId: string) {
    set((s) => ({ ...s, notifications: s.notifications.map((n) => (n.userId === userId ? { ...n, isRead: true } : n)) }));
  },
  addReview(bookId: string, rating: number, text: string) {
    const u = me();
    const verified = state.loans.some((l) => l.userId === u.id && l.bookId === bookId);
    if (!verified) throw new Error("Only students who borrowed this book can review it");
    set((s) => ({ ...s, reviews: [{ id: uid("rv"), bookId, userId: u.id, userName: u.name, rating, text, verified, createdAt: new Date().toISOString() }, ...s.reviews] }));
  },
  issue(userId: string, barcode: string, days: number) {
    requireRole("librarian", "admin");
    const user = state.users.find((x) => x.id === userId);
    if (!user) throw new Error("Student not found");
    const el = checkIssueEligibility(state, user);
    if (!el.ok) throw new Error(el.reason);
    const copy = state.copies.find((c) => c.barcode.toLowerCase() === barcode.toLowerCase());
    if (!copy) throw new Error("No copy with that barcode");
    const heldFor = state.reservations.find((r) => r.bookId === copy.bookId && r.status === "ready");
    if (copy.status === "on_hold" && heldFor?.userId !== userId) throw new Error("Copy is on hold for another student");
    if (copy.status !== "available" && copy.status !== "on_hold") throw new Error(`Copy is ${copy.status}`);
    const now = new Date();
    const loan: Loan = { id: uid("l"), userId, bookId: copy.bookId, copyId: copy.id, issueDate: now.toISOString(), dueDate: addDays(now, days), status: "active", renewals: 0, fineAmount: 0 };
    set((s) =>
      log(
        notify(
          {
            ...s,
            loans: [loan, ...s.loans],
            copies: s.copies.map((c) => (c.id === copy.id ? { ...c, status: "issued" } : c)),
            reservations: s.reservations.map((r) => (r.userId === userId && r.bookId === copy.bookId && (r.status === "ready" || r.status === "waiting") ? { ...r, status: "fulfilled" } : r)),
          },
          userId,
          `“${title(copy.bookId)}” issued. Due ${new Date(loan.dueDate).toLocaleDateString()}.`,
          "info",
        ),
        "loan.issue",
        `${copy.barcode} → ${user.rollNumber ?? user.email}`,
      ),
    );
    return loan;
  },
  returnCopy(barcode: string, payNow: boolean) {
    requireRole("librarian", "admin");
    const copy = state.copies.find((c) => c.barcode.toLowerCase() === barcode.toLowerCase());
    if (!copy) throw new Error("No copy with that barcode");
    const loan = state.loans.find((l) => l.copyId === copy.id && l.status === "active");
    if (!loan) throw new Error("No active loan for this copy");
    const now = new Date();
    const late = daysOverdue(loan.dueDate, now);
    const amount = calculateFine(loan.dueDate, now, state.settings.finePerDay);
    const next = state.reservations.filter((r) => r.bookId === copy.bookId && r.status === "waiting").sort((a, b) => a.reservedAt.localeCompare(b.reservedAt))[0];
    set((s) => {
      let n: LibraryState = {
        ...s,
        loans: s.loans.map((l) => (l.id === loan.id ? { ...l, status: "returned", returnDate: now.toISOString(), fineAmount: amount } : l)),
        copies: s.copies.map((c) => (c.id === copy.id ? { ...c, status: next ? "on_hold" : "available" } : c)),
        fines: amount > 0 ? [{ id: uid("f"), loanId: loan.id, userId: loan.userId, amount, daysOverdue: late, rate: s.settings.finePerDay, status: payNow ? "paid" : "unpaid", createdAt: now.toISOString() }, ...s.fines] : s.fines,
      };
      if (next) {
        n = { ...n, reservations: n.reservations.map((r) => (r.id === next.id ? { ...r, status: "ready", expiresAt: addDays(now, s.settings.reservationHoldDays) } : r)) };
        n = notify(n, next.userId, `“${title(copy.bookId)}” is ready for pickup. Held for ${s.settings.reservationHoldDays} days.`, "reservation");
      }
      if (amount > 0 && !payNow) n = notify(n, loan.userId, `Fine of ₹${amount} added for late return of “${title(copy.bookId)}”.`, "fine");
      return log(n, "loan.return", `${copy.barcode} late=${late}d fine=₹${amount}`);
    });
    return { late, amount, heldFor: next?.userId };
  },
  addBook(input: { title: string; author: string; category: string; year: number; isbn13: string; publisher: string; copies: number; shelf: string }) {
    requireRole("librarian", "admin");
    const id = uid("b");
    const start = state.copies.length + 5000;
    set((s) =>
      log(
        {
          ...s,
          books: [
            { id, title: input.title, authors: [input.author], category: input.category, subjects: [input.category], publisher: input.publisher, edition: "1st Edition", year: input.year, isbn10: input.isbn13.slice(3), isbn13: input.isbn13, language: "English", format: "physical", rating: 0, reviewCount: 0, description: `${input.title} by ${input.author}.`, topics: [], coverColor: "cover-2", shelf: input.shelf, borrowCount: 0, addedAt: new Date().toISOString(), tags: [] },
            ...s.books,
          ],
          copies: [...s.copies, ...Array.from({ length: input.copies }, (_, i) => ({ id: `${id}-c${i + 1}`, bookId: id, barcode: `UL${start + i}`, shelf: input.shelf, status: "available" as const }))],
        },
        "book.create",
        input.title,
      ),
    );
    return id;
  },
  addCopy(bookId: string) {
    requireRole("librarian", "admin");
    const book = state.books.find((b) => b.id === bookId);
    if (!book) throw new Error("Book not found");
    const n = state.copies.filter((c) => c.bookId === bookId).length + 1;
    set((s) => log({ ...s, copies: [...s.copies, { id: `${bookId}-c${n}-${Date.now()}`, bookId, barcode: `UL${7000 + s.copies.length}`, shelf: book.shelf, status: "available" }] }, "copy.create", book.title));
  },
  setCopyStatus(copyId: string, status: "available" | "lost" | "damaged" | "maintenance") {
    requireRole("librarian", "admin");
    const c = state.copies.find((x) => x.id === copyId);
    if (c?.status === "issued") throw new Error("Return the copy before changing its status");
    set((s) => log({ ...s, copies: s.copies.map((x) => (x.id === copyId ? { ...x, status } : x)) }, "copy.status", `${c?.barcode} → ${status}`));
  },
  updateSettings(patch: Partial<LibraryState["settings"]>) {
    requireRole("admin");
    set((s) => log({ ...s, settings: { ...s.settings, ...patch } }, "settings.update", JSON.stringify(patch)));
  },
  setRole(userId: string, role: Role) {
    const admin = requireRole("admin");
    if (userId === admin.id) throw new Error("You can't change your own role");
    set((s) => log({ ...s, users: s.users.map((u) => (u.id === userId ? { ...u, role } : u)) }, "user.role", `${userId} → ${role}`));
  },
  setActive(userId: string, active: boolean) {
    requireRole("admin");
    set((s) => log({ ...s, users: s.users.map((u) => (u.id === userId ? { ...u, active } : u)) }, "user.active", `${userId} → ${active}`));
  },
  updateProfile(name: string, rollNumber: string, department: string) {
    const u = me();
    if (name.trim().length < 2) throw new Error("Enter your full name");
    set(s => ({ ...s, users: s.users.map(x => x.id === u.id ? { ...x, name, rollNumber, department } : x) }));
  },
  updateBook(bookId: string, patch: Partial<LibraryState["books"][number]>) {
    requireRole("admin", "librarian");
    set(s => log({ ...s, books: s.books.map(b => b.id === bookId ? { ...b, ...patch, id: b.id } : b) }, "book.update", bookId));
  },
  submitResource(title: string, kind: "Lecture Notes" | "Past Paper" | "Syllabus", course: string, url: string = "") {
    const u = requireRole("faculty", "admin", "librarian");
    set((s) => log({ ...s, resources: [{ id: uid("res"), title, kind, course, url, approved: u.role === "admin", submittedBy: u.id }, ...s.resources] }, "resource.submit", title));
  },
  approveResource(id: string) {
    requireRole("admin");
    set((s) => log({ ...s, resources: s.resources.map((r) => (r.id === id ? { ...r, approved: true } : r)) }, "resource.approve", id));
  },
};

export function bookStats(s: LibraryState, bookId: string) {
  const copies = s.copies.filter((c) => c.bookId === bookId);
  const lendable = copies.filter((c) => c.status !== "reference");
  return { total: lendable.length, available: lendable.filter((c) => c.status === "available").length, copies };
}

const localOnly = new Set(["signInDemo", "signInExternal", "signOut", "register", "resetDemo"]);
export const actions = new Proxy(demoActions, { get(target, key: keyof typeof demoActions) {
  const fn = target[key];
  if (localOnly.has(key)) return (...args: unknown[]) => {
    if (firebaseConfigured && ["signInDemo", "register", "resetDemo"].includes(key)) throw new Error("Demo actions are unavailable for live accounts");
    return Reflect.apply(fn, target, args);
  };
  return (...args: unknown[]) => firebaseConfigured ? libraryCommand(key, args) : Reflect.apply(fn, target, args);
} });
