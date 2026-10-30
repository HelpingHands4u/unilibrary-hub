import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookCopy, Brain, Briefcase, Calculator, Cpu, Database, FileText, Atom, Landmark, Laptop, ShieldCheck, Users, Wrench, Library, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import libraryImage from "@/assets/library.jpg";
import { Shelf, StatCard } from "@/components/lib/bits";
import { useLibrary } from "@/lib/library/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "UniLibrary — Discover. Learn. Grow." },
      { name: "description", content: "Explore your university library: search the catalog, reserve books, track loans and access digital learning resources." },
      { property: "og:title", content: "UniLibrary — Discover. Learn. Grow." },
      { property: "og:description", content: "Search, reserve and borrow university library books and learning resources." },
    ],
  }),
  component: Home,
});

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "Computer Science": Laptop,
  Cybersecurity: ShieldCheck,
  "Artificial Intelligence": Brain,
  "Data Science": Database,
  Engineering: Wrench,
  Mathematics: Calculator,
  Physics: Atom,
  Electronics: Cpu,
  "Business and Management": Briefcase,
  Humanities: Landmark,
};

function Home() {
  const { state, user } = useLibrary();
  const { books } = state;
  const cats = Object.keys(ICONS);
  const popular = books.filter((b) => b.tags.includes("textbook"));
  const newest = [...books].sort((a, b) => b.addedAt.localeCompare(a.addedAt)).slice(0, 10);
  const most = [...books].sort((a, b) => b.borrowCount - a.borrowCount).slice(0, 10);
  const pref = user?.department;
  const recommended = [...books].filter((b) => !pref || b.category === pref || b.rating >= 4.6).sort((a, b) => b.rating - a.rating).slice(0, 10);
  const handbooks = books.filter((b) => b.tags.includes("handbook"));
  const members = state.users.filter((u) => u.role === "student" && u.active).length;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8">
      <section className="relative min-h-80 overflow-hidden bg-navy text-navy-foreground">
        <img src={libraryImage} width={1536} height={1024} alt="A bright university library with study tables and academic books" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-navy/75" />
        <div className="relative max-w-xl p-6 sm:p-10">
          <p className="text-sm font-semibold text-accent">Discover. Learn. Grow.</p>
          <h1 className="mt-3 text-4xl font-extrabold sm:text-5xl">UniLibrary</h1>
          <p className="mt-3 text-sm sm:text-base">Explore your university library, discover new ideas, and access the resources you need to succeed.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90"><Link to="/catalog">Explore Catalog <ArrowRight className="size-4" /></Link></Button>
            {user && <Button asChild size="lg" variant="secondary"><Link to="/my-library">My Books</Link></Button>}
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Browse by Category</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {cats.map((c) => {
            const Icon = ICONS[c] ?? Library;
            const count = books.filter((b) => b.category === c).length;
            return (
              <Link key={c} to="/catalog" search={{ category: c }} className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center shadow-card transition hover:-translate-y-0.5 hover:border-primary">
                <div className="grid size-11 place-items-center rounded-full bg-secondary text-primary">
                  <Icon className="size-5" />
                </div>
                <p className="text-sm font-semibold leading-tight">{c}</p>
                <p className="text-xs text-muted-foreground">{count} books</p>
              </Link>
            );
          })}
        </div>
      </section>

      <Shelf title="Popular Course Textbooks" books={popular} to={{ tag: "textbook" }} />
      <Shelf title="Newly Arrived Books" books={newest} to={{ sort: "newest" }} />
      <Shelf title="Most Borrowed This Semester" books={most} to={{ sort: "popular" }} />
      <Shelf title={user ? `Recommended for You, ${user.name.split(" ")[0]}` : "Recommended for You"} books={recommended} to={{ sort: "rating" }} />

      <Link to="/resources" className="flex flex-col items-start gap-4 rounded-2xl bg-navy p-6 text-navy-foreground sm:flex-row sm:items-center">
        <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-teal text-teal-foreground">
          <FileText className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold">Digital Learning Resources</p>
          <p className="text-sm opacity-80">Lecture notes, past exam papers and syllabus copies — approved by faculty.</p>
        </div>
        <span className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">Open resources →</span>
      </Link>

      <Shelf title="Quick Reference and Handbooks" books={handbooks} to={{ tag: "handbook" }} />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Titles in catalog" value={books.length} icon={Library} />
        <StatCard label="Active student members" value={members} icon={Users} tone="reserved" />
        <StatCard label="Copies available" value={state.copies.filter((c) => c.status === "available").length} icon={BookCopy} tone="success" />
        <StatCard label="Digital resources" value={state.resources.filter((r) => r.approved).length} icon={GraduationCap} tone="warning" />
      </section>
    </div>
  );
}
