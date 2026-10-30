import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useMemo, useState } from "react";
import { SlidersHorizontal, X, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BookCard } from "@/components/lib/bits";
import { CATEGORIES } from "@/lib/library/seed";
import { bookStats, useLibrary } from "@/lib/library/store";

const schema = z.object({
  q: fallback(z.string(), "").default(""),
  category: fallback(z.string(), "").default(""),
  avail: fallback(z.string(), "all").default("all"),
  format: fallback(z.string(), "").default(""),
  lang: fallback(z.string(), "").default(""),
  minRating: fallback(z.number(), 0).default(0),
  yearFrom: fallback(z.number(), 0).default(0),
  sort: fallback(z.string(), "relevance").default("relevance"),
  tag: fallback(z.string(), "").default(""),
  author: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/catalog")({
  validateSearch: zodValidator(schema),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Catalog — UniLibrary" },
      { name: "description", content: "Search and filter the UniLibrary catalog by subject, availability, format, year, language and rating." },
      { property: "og:title", content: "Catalog — UniLibrary" },
      { property: "og:description", content: "Search and filter university library books." },
    ],
  }),
  component: Catalog,
});

function Catalog() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/catalog" });
  const { state } = useLibrary();
  const set = (patch: Partial<typeof s>) => navigate({ search: (p) => ({ ...p, ...patch }) });

  const results = useMemo(() => {
    const t = s.q.toLowerCase().trim();
    let r = state.books.filter((b) => {
      if (t && ![b.title, b.authors.join(" "), b.isbn13, b.isbn10, b.category, b.subjects.join(" ")].join(" ").toLowerCase().includes(t)) return false;
      if (s.category && b.category !== s.category) return false;
      if (s.author && !b.authors.includes(s.author)) return false;
      if (s.tag && !b.tags.includes(s.tag as "textbook")) return false;
      if (s.format && b.format !== s.format) return false;
      if (s.lang && b.language !== s.lang) return false;
      if (s.minRating && b.rating < s.minRating) return false;
      if (s.yearFrom && b.year < s.yearFrom) return false;
      if (s.avail !== "all") {
        const a = bookStats(state, b.id).available;
        if (s.avail === "available" && a === 0) return false;
        if (s.avail === "out" && (a > 0 || b.format === "digital")) return false;
      }
      return true;
    });
    const by: Record<string, (a: (typeof r)[0], b: (typeof r)[0]) => number> = {
      newest: (a, b) => b.year - a.year,
      popular: (a, b) => b.borrowCount - a.borrowCount,
      rating: (a, b) => b.rating - a.rating,
      title: (a, b) => a.title.localeCompare(b.title),
    };
    if (by[s.sort]) r = [...r].sort(by[s.sort]);
    else if (t) r = [...r].sort((a, b) => Number(b.title.toLowerCase().includes(t)) - Number(a.title.toLowerCase().includes(t)));
    return r;
  }, [s, state]);

  const chips = [
    s.q && { k: "q", label: `“${s.q}”` },
    s.category && { k: "category", label: s.category },
    s.author && { k: "author", label: `Author: ${s.author}` },
    s.tag && { k: "tag", label: s.tag === "textbook" ? "Course textbooks" : "Handbooks" },
    s.avail !== "all" && { k: "avail", label: s.avail === "available" ? "Available now" : "Out of stock" },
    s.format && { k: "format", label: s.format },
    s.lang && { k: "lang", label: s.lang },
    s.minRating > 0 && { k: "minRating", label: `${s.minRating}★ & up` },
    s.yearFrom > 0 && { k: "yearFrom", label: `From ${s.yearFrom}` },
  ].filter(Boolean) as { k: keyof typeof s; label: string }[];

  const clear = (k: keyof typeof s) => set({ [k]: k === "avail" ? "all" : typeof s[k] === "number" ? 0 : "" } as Partial<typeof s>);

  return (
    <div className="mx-auto flex max-w-7xl gap-6">
      <aside className="hidden w-60 shrink-0 lg:block">
        <div className="sticky top-32 rounded-xl border bg-card p-4 shadow-card">
          <Filters s={s} set={set} />
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-extrabold">{s.q ? `Results for “${s.q}”` : s.category || "All books"}</h1>
            <p className="text-sm text-muted-foreground">{results.length} books found</p>
          </div>
          <div className="flex gap-2">
            <MobileFilters s={s} set={set} />
            <Select value={s.sort} onValueChange={(v) => set({ sort: v })}>
              <SelectTrigger className="w-36 bg-card sm:w-44" aria-label="Sort by">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relevance">Relevance</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="popular">Most Popular</SelectItem>
                <SelectItem value="rating">Highest Rated</SelectItem>
                <SelectItem value="title">Title A–Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {chips.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {chips.map((c) => (
              <button key={c.k} onClick={() => clear(c.k)} className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
                {c.label} <X className="size-3" />
              </button>
            ))}
            <Link to="/catalog" className="px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground">Clear all</Link>
          </div>
        )}
        {results.length === 0 ? (
          <div className="rounded-2xl border bg-card p-8 text-center shadow-card">
            <SearchX className="mx-auto size-10 text-muted-foreground" />
            <h2 className="mt-3 text-lg font-bold">No books found</h2>
            <p className="mt-1 text-sm text-muted-foreground">Try fewer words, check spelling, search by author or ISBN, or remove some filters.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {CATEGORIES.slice(0, 6).map((c) => (
                <Link key={c} to="/catalog" search={{ category: c }} className="rounded-full border px-3 py-1 text-xs font-medium hover:border-primary hover:text-primary">{c}</Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {results.map((b) => (
              <BookCard key={b.id} book={b} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type FP = { s: z.infer<typeof schema>; set: (p: Partial<z.infer<typeof schema>>) => void };

function Radio({ name, value, current, onChange, children }: { name: string; value: string; current: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-1 text-sm">
      <input type="radio" name={name} checked={current === value} onChange={() => onChange(value)} className="accent-primary" />
      {children}
    </label>
  );
}

function Filters({ s, set }: FP) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Category</p>
        <Radio name="cat" value="" current={s.category} onChange={(v) => set({ category: v })}>All categories</Radio>
        {CATEGORIES.map((c) => (
          <Radio key={c} name="cat" value={c} current={s.category} onChange={(v) => set({ category: v })}>{c}</Radio>
        ))}
      </div>
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Availability</p>
        <Radio name="av" value="all" current={s.avail} onChange={(v) => set({ avail: v })}>All</Radio>
        <Radio name="av" value="available" current={s.avail} onChange={(v) => set({ avail: v })}>Available now</Radio>
        <Radio name="av" value="out" current={s.avail} onChange={(v) => set({ avail: v })}>Out of stock</Radio>
      </div>
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Format</p>
        <Radio name="fm" value="" current={s.format} onChange={(v) => set({ format: v })}>Any</Radio>
        <Radio name="fm" value="physical" current={s.format} onChange={(v) => set({ format: v })}>Physical book</Radio>
        <Radio name="fm" value="digital" current={s.format} onChange={(v) => set({ format: v })}>Digital resource</Radio>
        <Radio name="fm" value="reference" current={s.format} onChange={(v) => set({ format: v })}>Reference only</Radio>
      </div>
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Language</p>
        <Radio name="lg" value="" current={s.lang} onChange={(v) => set({ lang: v })}>Any</Radio>
        <Radio name="lg" value="English" current={s.lang} onChange={(v) => set({ lang: v })}>English</Radio>
        <Radio name="lg" value="Hindi" current={s.lang} onChange={(v) => set({ lang: v })}>Hindi</Radio>
      </div>
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Published from</p>
        <select value={s.yearFrom} onChange={(e) => set({ yearFrom: Number(e.target.value) })} className="w-full rounded-md border bg-card px-2 py-1.5 text-sm">
          <option value={0}>Any year</option>
          {[2020, 2015, 2010, 2000].map((y) => <option key={y} value={y}>{y} or later</option>)}
        </select>
      </div>
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Minimum rating</p>
        {[0, 4, 4.5].map((r) => (
          <Radio key={r} name="rt" value={String(r)} current={String(s.minRating)} onChange={(v) => set({ minRating: Number(v) })}>{r ? `${r}★ & up` : "Any"}</Radio>
        ))}
      </div>
    </div>
  );
}

function MobileFilters(p: FP) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="bg-card lg:hidden"><SlidersHorizontal className="size-4" /> <span className="hidden sm:inline">Filters</span></Button>
      </SheetTrigger>
      <SheetContent side="left" className="overflow-y-auto">
        <SheetHeader><SheetTitle>Filters</SheetTitle></SheetHeader>
        <div className="px-4 pb-6"><Filters {...p} /></div>
      </SheetContent>
    </Sheet>
  );
}
