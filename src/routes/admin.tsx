import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, BookCopy, Library, Users, ArrowRightLeft } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCard, fmtDate } from "@/components/lib/bits";
import { actions, useLibrary } from "@/lib/library/store";
import { daysOverdue } from "@/lib/library/rules";
import { firebaseConfigured } from "@/lib/firebase";
import type { Role } from "@/lib/library/types";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Admin Dashboard — UniLibrary" },
      { name: "description", content: "Library statistics, settings, users and audit logs." },
      { property: "og:title", content: "Admin Dashboard — UniLibrary" },
      { property: "og:description", content: "Library administration." },
    ],
  }),
  component: Admin,
});

function Admin() {
  const { state, user } = useLibrary();
  if (user?.role !== "admin") return <p className="py-16 text-center font-semibold">Administrator access only.</p>;
  const now = new Date();
  const run = async (fn: () => unknown) => { try { await fn(); toast.success("Saved"); } catch (e) { toast.error((e as Error).message); } };
  const active = state.loans.filter((l) => l.status === "active");
  const cats = Object.entries(state.loans.reduce<Record<string, number>>((m, l) => { const c = state.books.find((b) => b.id === l.bookId)?.category ?? "?"; m[c] = (m[c] ?? 0) + 1; return m; }, {})).map(([name, n]) => ({ name: name.split(" ")[0], n }));
  return (
    <div className="mx-auto grid max-w-6xl gap-5">
      <h1 className="text-2xl font-extrabold text-navy">Admin Dashboard</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Total books" value={state.books.length} icon={Library} />
        <StatCard label="Total copies" value={state.copies.length} icon={BookCopy} tone="success" />
        <StatCard label="Members" value={state.users.filter((u) => u.role === "student").length} icon={Users} tone="reserved" />
        <StatCard label="Loans today" value={active.filter((l) => l.issueDate.slice(0, 10) === now.toISOString().slice(0, 10)).length} icon={ArrowRightLeft} tone="warning" />
        <StatCard label="Overdue" value={active.filter((l) => daysOverdue(l.dueDate, now) > 0).length} icon={AlertTriangle} tone="destructive" />
      </div>
      <section className="rounded-xl border bg-card p-4 shadow-card">
        <h2 className="font-bold">Loans by category</h2>
        <div className="mt-3 h-56"><ResponsiveContainer><BarChart data={cats}><XAxis dataKey="name" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip /><Bar dataKey="n" fill="var(--primary)" radius={4} /></BarChart></ResponsiveContainer></div>
      </section>
      <section className="rounded-xl border bg-card p-4 shadow-card">
        <h2 className="font-bold">Library settings</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(["loanDays", "finePerDay", "maxLoans", "maxRenewals", "fineBlockThreshold", "reservationHoldDays"] as const).map((k) => (
            <label key={k} className="text-xs font-medium text-muted-foreground">{{loanDays: "Loan period (days)", finePerDay: "Fine per day (₹)", maxLoans: "Maximum loans", maxRenewals: "Maximum renewals", fineBlockThreshold: "Fine threshold (₹)", reservationHoldDays: "Pickup hold (days)"}[k]}<Input type="number" min={0} defaultValue={state.settings[k]} onBlur={(e) => run(() => actions.updateSettings({ [k]: Math.max(0, Number(e.target.value)) }))} /></label>
          ))}
        </div>
      </section>
      <section className="rounded-xl border bg-card p-4 shadow-card">
        <h2 className="font-bold">Users & roles</h2>
        <div className="mt-2 grid gap-2">
          {state.users.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-sm">
              <span className="min-w-0 truncate"><b>{u.name}</b> · {u.email}</span>
              <span className="flex gap-2">
                <select value={u.role} onChange={(e) => run(() => actions.setRole(u.id, e.target.value as Role))} className="rounded-md border bg-card px-2 py-1">
                  {["student", "faculty", "librarian", "admin"].map((r) => <option key={r}>{r}</option>)}
                </select>
                <Button size="sm" variant="outline" onClick={() => run(() => actions.setActive(u.id, !u.active))}>{u.active ? "Deactivate" : "Activate"}</Button>
              </span>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-xl border bg-card p-4 shadow-card">
        <div className="flex items-center justify-between"><h2 className="font-bold">Audit log</h2><Button disabled={firebaseConfigured} size="sm" variant="ghost" onClick={() => { actions.resetDemo(); toast.success("Demo data reset"); }}>Reset demo data</Button></div>
        <div className="mt-2 max-h-72 overflow-y-auto text-xs">
          {state.audit.slice(0, 50).map((a) => <p key={a.id} className="border-b py-1.5"><span className="text-muted-foreground">{fmtDate(a.timestamp)}</span> · <b>{a.action}</b> · {a.detail}</p>)}
        </div>
      </section>
    </div>
  );
}
