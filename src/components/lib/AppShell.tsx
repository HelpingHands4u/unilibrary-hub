import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, BookOpen, Compass, GraduationCap, Heart, Home, LayoutDashboard, LibraryBig, LogOut, Menu, Search, Shield, User as UserIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { actions, hydrateStore, useLibrary } from "@/lib/library/store";
import { firebaseConfigured } from "@/lib/firebase";
import { apiConfigured } from "@/lib/library/remote";
import { fmtDate } from "./bits";

function useNav() {
  const { user } = useLibrary();
  const items = [
    { to: "/", label: "Home", icon: Home },
    { to: "/catalog", label: "Explore", icon: Compass },
    { to: "/resources", label: "E-Resources", icon: GraduationCap },
  ] as const;
  const extra: { to: "/my-library" | "/librarian" | "/admin"; label: string; icon: typeof Home }[] = [];
  if (user) {
    extra.push({ to: "/my-library", label: "My Books", icon: BookOpen });
    extra.push({ to: "/my-library", label: "Wishlist", icon: Heart });
  }
  if (user && (user.role === "librarian" || user.role === "admin")) extra.push({ to: "/librarian", label: "Circulation Desk", icon: LibraryBig });
  if (user?.role === "admin") extra.push({ to: "/admin", label: "Admin", icon: Shield });
  return [...items, ...extra];
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const nav = useNav();
  return (
    <nav className="flex flex-col gap-1">
      {nav.map((n, i) => {
        const active = n.to === "/" ? path === "/" : path.startsWith(n.to) && !(n.label === "Wishlist");
        return (
          <Link
            key={n.label + i}
            to={n.to}
            search={n.label === "Wishlist" ? { tab: "wishlist" } : {}}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent",
            )}
          >
            <n.icon className="size-4.5 shrink-0" />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <div className="grid size-9 place-items-center rounded-lg bg-accent text-accent-foreground">
        <LibraryBig className="size-5" />
      </div>
      <div className="leading-tight">
        <p className="text-lg font-extrabold text-sidebar-foreground">UniLibrary</p>
        <p className="text-[0.65rem] text-sidebar-foreground/70">Discover · Learn · Grow</p>
      </div>
    </Link>
  );
}

function SearchBox() {
  const { state } = useLibrary();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const suggestions = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    return state.books
      .filter((b) => b.title.toLowerCase().includes(t) || b.authors.some((a) => a.toLowerCase().includes(t)) || b.isbn13.includes(t) || b.category.toLowerCase().includes(t))
      .slice(0, 6);
  }, [q, state.books]);
  useEffect(() => {
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const go = () => {
    setOpen(false);
    navigate({ to: "/catalog", search: { q: q.trim() } });
  };
  return (
    <div ref={ref} className="relative min-w-0 flex-1">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
        className="flex h-10 overflow-hidden rounded-lg border bg-card focus-within:ring-2 focus-within:ring-ring"
      >
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search books, authors, ISBN, subjects…"
          aria-label="Search catalog"
          className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
        />
        <button type="submit" aria-label="Search" className="grid w-11 shrink-0 place-items-center bg-accent text-accent-foreground">
          <Search className="size-4" />
        </button>
      </form>
      {open && suggestions.length > 0 && (
        <div className="absolute inset-x-0 top-11 z-50 overflow-hidden rounded-lg border bg-popover shadow-lg">
          {suggestions.map((b) => (
            <Link key={b.id} to="/book/$id" params={{ id: b.id }} onClick={() => setOpen(false)} className="flex items-center gap-3 px-3 py-2 hover:bg-muted">
              <Search className="size-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{b.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {b.authors[0]} · {b.category} · ISBN {b.isbn13}
                </p>
              </div>
            </Link>
          ))}
          <button onClick={go} className="w-full border-t px-3 py-2 text-left text-sm font-semibold text-primary hover:bg-muted">
            See all results for “{q}”
          </button>
        </div>
      )}
    </div>
  );
}

function Notifications() {
  const { state, user } = useLibrary();
  if (!user) return null;
  const mine = state.notifications.filter((n) => n.userId === user.id);
  const unread = mine.filter((n) => !n.isRead).length;
  return (
    <Popover onOpenChange={(o) => { if (!o && unread) void Promise.resolve(actions.markRead(user.id)).catch(() => {}); }}>
      <PopoverTrigger asChild>
        <button aria-label="Notifications" className="relative grid size-10 shrink-0 place-items-center rounded-lg hover:bg-muted">
          <Bell className="size-5" />
          {unread > 0 && <span className="absolute right-1.5 top-1.5 grid size-4 place-items-center rounded-full bg-destructive text-[0.6rem] font-bold text-destructive-foreground">{unread}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <p className="border-b px-4 py-3 text-sm font-bold">Notifications</p>
        <div className="max-h-80 overflow-y-auto">
          {mine.length === 0 && <p className="p-4 text-sm text-muted-foreground">You're all caught up.</p>}
          {mine.map((n) => (
            <div key={n.id} className={cn("border-b px-4 py-3 text-sm last:border-0", !n.isRead && "bg-secondary")}>
              <p>{n.message}</p>
              <p className="mt-1 text-xs text-muted-foreground">{fmtDate(n.timestamp)}</p>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function UserMenu() {
  const { user } = useLibrary();
  const navigate = useNavigate();
  if (!user)
    return (
      <div className="flex shrink-0 gap-2">
        <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
          <Link to="/login" search={{ mode: "register" }}>Register</Link>
        </Button>
        <Button asChild size="sm">
          <Link to="/login">Sign in</Link>
        </Button>
      </div>
    );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex shrink-0 items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-muted">
        <div className="grid size-9 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{user.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</div>
        <div className="hidden text-left leading-tight md:block">
          <p className="text-sm font-semibold">Hello, {user.name.split(" ")[0]}</p>
          <p className="text-xs capitalize text-muted-foreground">{user.role}</p>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate({ to: "/my-library" })}><BookOpen className="size-4" /> My Library</DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate({ to: "/my-library", search: { tab: "profile" } })}><UserIcon className="size-4" /> Profile</DropdownMenuItem>
        {(user.role === "librarian" || user.role === "admin") && <DropdownMenuItem onClick={() => navigate({ to: "/librarian" })}><LibraryBig className="size-4" /> Circulation Desk</DropdownMenuItem>}
        {user.role === "admin" && <DropdownMenuItem onClick={() => navigate({ to: "/admin" })}><LayoutDashboard className="size-4" /> Admin Dashboard</DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            actions.signOut();
            navigate({ to: "/login", replace: true });
          }}
        >
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { state } = useLibrary();
  useEffect(() => hydrateStore(), []);
  return (
    <div className="flex min-h-screen w-full overflow-x-hidden">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 bg-sidebar p-4 lg:flex">
        <Brand />
        <SidebarNav />
        <div className="mt-auto rounded-xl bg-sidebar-accent p-4 text-sm text-sidebar-foreground">
          <BookOpen className="mb-2 size-6 text-sidebar-primary" />
          A better you builds a brighter future.
        </div>
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="Close menu" className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-72 max-w-[85%] flex-col gap-6 bg-sidebar p-4">
            <div className="flex items-center justify-between">
              <Brand />
              <button aria-label="Close menu" onClick={() => setOpen(false)} className="text-sidebar-foreground">
                <X className="size-5" />
              </button>
            </div>
            <SidebarNav onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
          <div className="flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-6">
            <button aria-label="Open menu" onClick={() => setOpen(true)} className="grid size-10 shrink-0 place-items-center rounded-lg hover:bg-muted lg:hidden">
              <Menu className="size-5" />
            </button>
            <SearchBox />
            <Notifications />
            <UserMenu />
          </div>
          <div className="no-scrollbar flex gap-4 overflow-x-auto border-t px-3 py-2 text-xs font-medium text-muted-foreground sm:px-6">
            {Array.from(new Set(state.books.map((b) => b.category))).map((c) => (
              <Link key={c} to="/catalog" search={{ category: c }} className="whitespace-nowrap hover:text-primary">
                {c}
              </Link>
            ))}
          </div>
        </header>
        <div role="status" className="border-b bg-secondary px-4 py-1.5 text-xs text-secondary-foreground">{!firebaseConfigured ? "Demonstration · changes saved in this browser only" : apiConfigured ? "Firebase connected" : "Firebase connected · library saving service not configured"}</div>
        <main className="min-w-0 flex-1 px-3 py-5 sm:px-6">{children}</main>
        <Footer />
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t bg-navy text-navy-foreground">
      <div className="grid gap-6 px-6 py-8 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-base font-extrabold">UniLibrary</p>
          <p className="mt-1 opacity-75">Discover. Learn. Grow.</p>
        </div>
        <div>
          <p className="font-bold">Quick links</p>
          <ul className="mt-2 space-y-1 opacity-80">
            <li><Link to="/catalog">Catalog</Link></li>
            <li><Link to="/resources">Digital resources</Link></li>
            <li><Link to="/my-library">My Library</Link></li>
            <li><Link to="/login" search={{ portal: "librarian" }}>Librarian portal</Link></li>
            <li><Link to="/login" search={{ portal: "admin" }}>Admin portal</Link></li>
            <li><Link to="/login" search={{ portal: "faculty" }}>Faculty portal</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-bold">Library timings</p>
          <p className="mt-2 opacity-80">Timings to be confirmed by the university</p>
        </div>
        <div>
          <p className="font-bold">Helpdesk</p>
          <p className="mt-2 opacity-80">Contact details to be confirmed</p>
        </div>
      </div>
      <p className="border-t border-sidebar-border px-6 py-3 text-xs opacity-70">
        Academic project — B.Tech CSE. Sample data for demonstration; not an official university system.
      </p>
    </footer>
  );
}
