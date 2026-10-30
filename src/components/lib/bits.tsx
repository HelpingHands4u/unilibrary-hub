import { Link } from "@tanstack/react-router";
import { Heart, Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Book } from "@/lib/library/types";
import { actions, bookStats, useLibrary } from "@/lib/library/store";
import { availability } from "@/lib/library/rules";

const TONES = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  destructive: "bg-destructive-soft text-destructive",
  reserved: "bg-reserved-soft text-reserved",
  info: "bg-secondary text-primary",
  muted: "bg-muted text-muted-foreground",
} as const;
export type Tone = keyof typeof TONES;

export function StatusBadge({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold", TONES[tone], className)}>
      <span className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function BookCover({ book, className }: { book: Book; className?: string }) {
  return (
    <div
      className={cn("relative flex aspect-[2/3] flex-col justify-between overflow-hidden rounded-md p-2 text-primary-foreground shadow-card", className)}
      style={{ background: `linear-gradient(160deg, var(--${book.coverColor}), color-mix(in oklab, var(--${book.coverColor}) 60%, black))` }}
      aria-label={`Cover of ${book.title}`}
    >
      <div className="absolute inset-y-0 left-0 w-1.5 bg-foreground/20" />
      <p className="line-clamp-4 pl-1 text-[0.7rem] font-bold leading-tight sm:text-xs">{book.title}</p>
      <p className="truncate pl-1 text-[0.6rem] opacity-80">{book.authors[0]}</p>
    </div>
  );
}

export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn("size-3.5", i <= Math.round(value) ? "fill-accent text-accent" : "text-border")} />
      ))}
    </span>
  );
}

export function useRequireUser() {
  const { user } = useLibrary();
  return async (fn: () => unknown) => {
    if (!user) {
      toast.info("Please sign in to continue");
      return;
    }
    try {
      await fn();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
}

export function BookCard({ book, compact }: { book: Book; compact?: boolean }) {
  const { state, user } = useLibrary();
  const { available, total } = bookStats(state, book.id);
  const a = book.format === "digital" ? { tone: "info" as const, label: "Digital" } : availability(available, total);
  const wished = !!user && state.wishlists.some((w) => w.userId === user.id && w.bookId === book.id);
  const guard = useRequireUser();
  return (
    <div className={cn("group flex h-full flex-col rounded-xl border bg-card p-3 shadow-card transition-shadow hover:shadow-md", compact && "w-40 shrink-0 sm:w-44")}>
      <div className="relative">
        <Link to="/book/$id" params={{ id: book.id }}>
          <BookCover book={book} />
        </Link>
        <button
          aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
          onClick={() => guard(() => actions.toggleWishlist(book.id))}
          className="absolute right-1.5 top-1.5 grid size-8 place-items-center rounded-full bg-card/90 shadow"
        >
          <Heart className={cn("size-4", wished ? "fill-destructive text-destructive" : "text-muted-foreground")} />
        </button>
      </div>
      <div className="mt-3 flex min-w-0 flex-1 flex-col gap-1">
        <Link to="/book/$id" params={{ id: book.id }} className="line-clamp-2 min-h-[2.5rem] text-sm font-bold leading-tight hover:text-primary">
          {book.title}
        </Link>
        <p className="truncate text-xs text-muted-foreground">{book.authors[0]}</p>
        <p className="truncate text-[0.7rem] font-medium text-teal">{book.category}</p>
        <div className="flex items-center gap-1 text-xs">
          <Stars value={book.rating} />
          <span className="font-semibold">{book.rating.toFixed(1)}</span>
          <span className="text-muted-foreground">({book.reviewCount})</span>
        </div>
        <div className="mt-1">
          <StatusBadge tone={a.tone}>{a.label}</StatusBadge>
        </div>
        <Button asChild size="sm" className="mt-auto w-full bg-navy text-navy-foreground hover:bg-navy/90">
          <Link to="/book/$id" params={{ id: book.id }}>View Details</Link>
        </Button>
      </div>
    </div>
  );
}

export function Shelf({ title, books, to }: { title: string; books: Book[]; to?: { sort?: string; q?: string; tag?: string } }) {
  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="truncate text-lg font-bold">{title}</h2>
        <Link to="/catalog" search={to ?? {}} className="shrink-0 text-sm font-semibold text-primary hover:underline">
          View All →
        </Link>
      </div>
      <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {books.map((b) => (
          <BookCard key={b.id} book={b} compact />
        ))}
      </div>
    </section>
  );
}

export function StatCard({ label, value, icon: Icon, tone = "info" }: { label: string; value: React.ReactNode; icon: React.ComponentType<{ className?: string }>; tone?: Tone }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border bg-card p-4 shadow-card">
      <div className={cn("grid size-10 shrink-0 place-items-center rounded-lg", TONES[tone])}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-xl font-extrabold">{value}</p>
      </div>
    </div>
  );
}

export const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
