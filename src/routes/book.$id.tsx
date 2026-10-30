import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, MapPin, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookCard, BookCover, StatusBadge, Stars, fmtDate, useRequireUser, type Tone } from "@/components/lib/bits";
import { actions, bookStats, useLibrary } from "@/lib/library/store";
import { availability } from "@/lib/library/rules";
import { buildSeed } from "@/lib/library/seed";

const seedBooks = () => buildSeed(new Date("2026-10-27T00:00:00Z")).books;

export const Route = createFileRoute("/book/$id")({
  loader: ({ params }) => {
    const b = seedBooks().find((x) => x.id === params.id);
    return { title: b?.title, author: b?.authors[0] };
  },
  head: ({ loaderData }) => {
    const t = loaderData?.title ? `${loaderData.title} — UniLibrary` : "Book — UniLibrary";
    const d = loaderData?.title ? `${loaderData.title} by ${loaderData.author}: availability, copies, reviews and reservations.` : "Book details at UniLibrary.";
    return { meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { title: t }, { name: "description", content: d }, { property: "og:title", content: t }, { property: "og:description", content: d }] };
  },
  component: BookPage,
});

const COPY_TONE: Record<string, [Tone, string]> = {
  available: ["success", "Available"],
  issued: ["warning", "Issued"],
  reference: ["info", "Reference only"],
  maintenance: ["muted", "Under maintenance"],
  lost: ["destructive", "Lost"],
  damaged: ["destructive", "Damaged"],
  on_hold: ["reserved", "On hold"],
};

function BookPage() {
  const { id } = Route.useParams();
  const { state, user } = useLibrary();
  const guard = useRequireUser();
  const [more, setMore] = useState(false);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const book = state.books.find((b) => b.id === id);
  useEffect(() => {
    if (book && user) void Promise.resolve(actions.visit(book.id)).catch(() => {});
  }, [book?.id, user?.id]);
  if (!book) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-xl font-bold">Book not found</h1>
        <Link to="/catalog" className="mt-3 inline-block text-primary">Back to catalog</Link>
      </div>
    );
  }
  const { available, total, copies } = bookStats(state, book.id);
  const a = availability(available, total);
  const holding = user && state.loans.some((l) => l.userId === user.id && l.bookId === book.id && l.status === "active");
  const reserved = user && state.reservations.some((r) => r.userId === user.id && r.bookId === book.id && (r.status === "waiting" || r.status === "ready"));
  const wished = user && state.wishlists.some((w) => w.userId === user.id && w.bookId === book.id);
  const nextDue = state.loans.filter((l) => l.bookId === book.id && l.status === "active").map((l) => l.dueDate).sort()[0];
  const reviews = state.reviews.filter((r) => r.bookId === book.id);
  const coBorrowers = new Set(state.loans.filter((l) => l.bookId === book.id).map((l) => l.userId));
  const alsoIds = new Set(state.loans.filter((l) => coBorrowers.has(l.userId) && l.bookId !== book.id).map((l) => l.bookId));
  const also = state.books.filter((b) => alsoIds.has(b.id)).slice(0, 6);
  const sameCat = state.books.filter((b) => b.category === book.category && b.id !== book.id).slice(0, 6);
  const canReview = user && state.loans.some((l) => l.userId === user.id && l.bookId === book.id);
  const breakdown = [5, 4, 3, 2, 1].map((s) => ({ s, pct: reviews.length ? Math.round(reviews.filter(r => r.rating === s).length / reviews.length * 100) : 0 }));

  const reserve = () =>
    guard(async () => {
      await actions.reserve(book.id);
      toast.success(available > 0 ? "Reserved! Collect it from the circulation desk." : "You've joined the waitlist.");
    });

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8">
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-3">
          <BookCover book={book} className="mx-auto w-44 lg:w-full" />
          <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground lg:justify-start"><MapPin className="size-4" /> {book.shelf}</p>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-teal">{book.category}</p>
          <h1 className="mt-1 text-2xl font-extrabold text-navy sm:text-3xl">{book.title}</h1>
          <p className="mt-1 text-sm">
            by{" "}
            {book.authors.map((au) => (
              <Link key={au} to="/catalog" search={{ author: au }} className="font-semibold text-primary hover:underline">{au}</Link>
            ))}
          </p>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <Stars value={book.rating} />
            <span className="font-bold">{book.rating.toFixed(1)}</span>
            <span className="text-muted-foreground">({book.reviewCount} ratings)</span>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
            {[["Publisher", book.publisher], ["Edition", book.edition], ["Year", book.year], ["ISBN-10", book.isbn10], ["ISBN-13", book.isbn13], ["Language", book.language]].map(([k, v]) => (
              <div key={k as string} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="truncate font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            {book.subjects.map((t) => <span key={t} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-primary">{t}</span>)}
          </div>
          <h2 className="mt-6 font-bold">About this book</h2>
          <p className={`mt-1 text-sm text-muted-foreground ${more ? "" : "line-clamp-3"}`}>{book.description}</p>
          <button onClick={() => setMore(!more)} className="text-sm font-semibold text-primary">{more ? "Read less" : "Read more"}</button>
          {book.topics.length > 0 && (
            <>
              <h2 className="mt-4 font-bold">Key topics</h2>
              <ol className="mt-1 list-decimal pl-5 text-sm text-muted-foreground">{book.topics.map((t) => <li key={t}>{t}</li>)}</ol>
            </>
          )}
        </div>
        <aside className="h-fit rounded-xl border bg-card p-5 shadow-card lg:sticky lg:top-32">
          {book.format === "digital" ? <StatusBadge tone="info">Digital resource</StatusBadge> : <StatusBadge tone={a.tone}>{a.label}</StatusBadge>}
          <p className="mt-3 text-sm text-muted-foreground">Available copies</p>
          <p className="text-2xl font-extrabold">{available} <span className="text-base font-medium text-muted-foreground">of {total}</span></p>
          {available === 0 && nextDue && <p className="mt-1 text-xs text-muted-foreground">Earliest expected return: {fmtDate(nextDue)}</p>}
          <div className="mt-4 flex flex-col gap-2">
            {holding ? (
              <Button asChild variant="outline"><Link to="/my-library">View in My Books</Link></Button>
            ) : reserved ? (
              <Button disabled variant="secondary">Reserved ✓</Button>
            ) : book.format === "digital" ? (
              <Button asChild className="bg-teal text-teal-foreground hover:bg-teal/90"><Link to="/resources">Open digital resources</Link></Button>
            ) : total === 0 ? (
              <Button disabled>Reference only</Button>
            ) : (
              <Button onClick={reserve} size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">{available > 0 ? "Reserve Book" : "Join Waitlist"}</Button>
            )}
            <Button variant="outline" onClick={() => guard(() => actions.toggleWishlist(book.id))}>
              <Heart className={wished ? "size-4 fill-destructive text-destructive" : "size-4"} /> {wished ? "In Wishlist" : "Add to Wishlist"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                void navigator.clipboard?.writeText(window.location.href).then(() => toast.success("Link copied")).catch(() => toast.error("Could not copy the link"));
              }}
            >
              <Share2 className="size-4" /> Share Resource
            </Button>
          </div>
        </aside>
      </div>

      {copies.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Copies</h2>
          <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
            <Table>
              <TableHeader><TableRow><TableHead>Barcode</TableHead><TableHead>Shelf</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {copies.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.barcode}</TableCell>
                    <TableCell className="whitespace-nowrap">{c.shelf}</TableCell>
                    <TableCell><StatusBadge tone={(COPY_TONE[c.status] ?? ["muted", c.status])[0] as Tone}>{(COPY_TONE[c.status] ?? ["muted", c.status])[1]}</StatusBadge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {also.length > 0 && <Row title="Students who borrowed this also borrowed…" books={also} />}
      <Row title="More books in this category" books={sameCat} />

      <section className="grid gap-6 md:grid-cols-[240px_minmax(0,1fr)]">
        <div>
          <h2 className="text-lg font-bold">Student reviews</h2>
          <div className="mt-2 space-y-1.5">
            {breakdown.map((r) => (
              <div key={r.s} className="flex items-center gap-2 text-xs">
                <span className="w-6">{r.s}★</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-accent" style={{ width: `${r.pct}%` }} /></div>
                <span className="w-8 text-right text-muted-foreground">{r.pct}%</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {canReview && (
            <form
              className="rounded-xl border bg-card p-4 shadow-card"
              onSubmit={(e) => {
                e.preventDefault();
                const t = text.trim();
                if (t.length < 5 || t.length > 500) { toast.error("Review must be 5–500 characters"); return; }
                guard(async () => {
                  await actions.addReview(book.id, rating, t);
                  setText("");
                  toast.success("Review posted");
                });
              }}
            >
              <p className="text-sm font-semibold">Rate this book</p>
              <div className="my-2 flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <button type="button" key={i} onClick={() => setRating(i)} aria-label={`${i} stars`} className={i <= rating ? "text-accent" : "text-border"}>★</button>
                ))}
              </div>
              <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="What did you think?" />
              <Button type="submit" size="sm" className="mt-2">Post review</Button>
            </form>
          )}
          {reviews.length === 0 && <p className="text-sm text-muted-foreground">No reviews yet.</p>}
          {reviews.map((r) => (
            <div key={r.id} className="rounded-xl border bg-card p-4 shadow-card">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{r.userName}</span>
                {r.verified && <StatusBadge tone="success">Verified borrower</StatusBadge>}
                <Stars value={r.rating} />
              </div>
              <p className="mt-1 text-sm">{r.text}</p>
              <p className="mt-1 text-xs text-muted-foreground">{fmtDate(r.createdAt)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Row({ title, books }: { title: string; books: ReturnType<typeof useLibrary>["state"]["books"] }) {
  if (!books.length) return null;
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">{books.map((b) => <BookCard key={b.id} book={b} compact />)}</div>
    </section>
  );
}

void notFound;
