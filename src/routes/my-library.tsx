import { createFileRoute, Link } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { toast } from "sonner";
import { BookOpen, Bookmark, IndianRupee, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookCard, BookCover, StatCard, StatusBadge, fmtDate } from "@/components/lib/bits";
import { actions, useLibrary } from "@/lib/library/store";
import { firebaseConfigured } from "@/lib/firebase";
import { ProfileForm } from "@/components/lib/ProfileForm";
import { canRenew, dueBadge, outstandingFines } from "@/lib/library/rules";

export const Route = createFileRoute("/my-library")({
  validateSearch: zodValidator(z.object({ tab: fallback(z.string(), "loans").default("loans") })),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "My Library — UniLibrary" },
      { name: "description", content: "Your loans, reservations, wishlist and fines." },
      { property: "og:title", content: "My Library — UniLibrary" },
      { property: "og:description", content: "Your loans, reservations, wishlist and fines." },
    ],
  }),
  component: MyLibrary,
});

const run = async (fn: () => unknown, ok: string) => {
  try { await fn(); toast.success(ok); } catch (e) { toast.error((e as Error).message); }
};

function MyLibrary() {
  const { tab } = Route.useSearch();
  const { state, user } = useLibrary();
  if (!user) return <div className="py-16 text-center"><p className="font-semibold">Please sign in to see your library.</p><Button asChild className="mt-3"><Link to="/login">Sign in</Link></Button></div>;
  const now = new Date();
  const book = (id: string) => state.books.find((b) => b.id === id);
  const loans = state.loans.filter((l) => l.userId === user.id);
  const active = loans.filter((l) => l.status === "active");
  const history = loans.filter((l) => l.status === "returned").sort((a, b) => (b.returnDate ?? "").localeCompare(a.returnDate ?? ""));
  const res = state.reservations.filter((r) => r.userId === user.id && (r.status === "waiting" || r.status === "ready"));
  const fines = state.fines.filter((f) => f.userId === user.id);
  const wish = state.wishlists.filter((w) => w.userId === user.id).map((w) => book(w.bookId)).filter((b): b is NonNullable<typeof b> => Boolean(b));
  const queuePos = (r: (typeof res)[0]) => state.reservations.filter((x) => x.bookId === r.bookId && x.status === "waiting" && x.reservedAt <= r.reservedAt).length;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <h1 className="text-2xl font-extrabold text-navy">My Library</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Borrowed now" value={active.length} icon={BookOpen} />
        <StatCard label="Reservations" value={res.length} icon={Bookmark} tone="reserved" />
        <StatCard label="Read this semester" value={history.length} icon={Trophy} tone="success" />
        <StatCard label="Outstanding fines" value={`₹${outstandingFines(state, user.id)}`} icon={IndianRupee} tone="destructive" />
      </div>
      <Tabs key={tab} defaultValue={tab}>
        <TabsList className="no-scrollbar w-full justify-start overflow-x-auto">
          {["loans", "history", "reservations", "wishlist", "fines", "profile"].map((t) => <TabsTrigger key={t} value={t} className="capitalize">{t}</TabsTrigger>)}
        </TabsList>
        <TabsContent value="loans" className="grid gap-3">
          {active.length === 0 && <p className="text-sm text-muted-foreground">No active loans.</p>}
          {active.map((l) => {
            const b = book(l.bookId); if (!b) return null; const d = dueBadge(l.dueDate, now); const r = canRenew(state, l, state.settings, now);
            return (
              <div key={l.id} className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-card">
                <BookCover book={b} className="w-12 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{b.title}</p>
                  <p className="text-xs text-muted-foreground">Issued {fmtDate(l.issueDate)} · Due {fmtDate(l.dueDate)}</p>
                  <StatusBadge tone={d.tone} className="mt-1">{d.label}</StatusBadge>
                </div>
                <Button size="sm" variant="outline" disabled={!r.ok} title={r.reason} onClick={() => run(() => actions.renew(l.id), "Loan renewed")}>Renew</Button>
              </div>
            );
          })}
        </TabsContent>
        <TabsContent value="history" className="grid gap-2">
          {history.map((l) => <div key={l.id} className="flex flex-wrap justify-between gap-2 rounded-lg border bg-card p-3 text-sm"><span className="font-semibold">{book(l.bookId)?.title ?? "Book"}</span><span className="text-muted-foreground">{fmtDate(l.issueDate)} → {fmtDate(l.returnDate)} {l.fineAmount > 0 ? "· Late" : "· On time"}</span></div>)}
        </TabsContent>
        <TabsContent value="reservations" className="grid gap-2">
          {res.length === 0 && <p className="text-sm text-muted-foreground">No reservations.</p>}
          {res.map((r) => <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 text-sm"><div><p className="font-semibold">{book(r.bookId)?.title ?? "Book"}</p><p className="text-xs text-muted-foreground">{r.status === "ready" ? "Ready for pickup" : `Queue position #${queuePos(r)}`} · Expires {fmtDate(r.expiresAt)}</p></div><Button size="sm" variant="outline" onClick={() => run(() => actions.cancelReservation(r.id), "Reservation cancelled")}>Cancel</Button></div>)}
        </TabsContent>
        <TabsContent value="wishlist">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">{wish.map((b) => <BookCard key={b.id} book={b} />)}</div>
          {wish.length === 0 && <p className="text-sm text-muted-foreground">Your wishlist is empty.</p>}
        </TabsContent>
        <TabsContent value="fines" className="grid gap-2">
          {fines.length === 0 && <p className="text-sm text-muted-foreground">No fines. 🎉</p>}
          {fines.map((f) => { const l = state.loans.find((x) => x.id === f.loanId); return (
            <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 text-sm">
              <div><p className="font-semibold">{l ? book(l.bookId)?.title ?? "Book" : "Loan"}</p><p className="text-xs text-muted-foreground">{f.daysOverdue} days × ₹{f.rate} = ₹{f.amount}</p></div>
              {f.status === "unpaid" && firebaseConfigured ? <StatusBadge tone="warning">Pay at cashier</StatusBadge> : f.status === "unpaid" ? <Button size="sm" className="bg-accent text-accent-foreground" onClick={() => run(() => actions.payFine(f.id), "Payment recorded (demo)")}>Pay (demo)</Button> : <StatusBadge tone="success">{f.status}</StatusBadge>}
            </div>); })}
          <p className="text-xs text-muted-foreground">Demo payment only — real payments are made at the university cashier counter.</p>
        </TabsContent>
        <TabsContent value="profile" className="rounded-xl border bg-card p-4 text-sm">
          <ProfileForm key={user.id} user={user} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
