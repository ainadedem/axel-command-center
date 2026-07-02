import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Building2, Wallet, ArrowLeftRight, FileText,
  Users, Briefcase, TrendingUp, BarChart3, Settings, Search, Bell, Plus, Truck,
  ChevronDown, ChevronRight, Check, LogOut, Target, UserCog, Handshake,
  BookOpen, BookText, Scale, Library, Receipt, FileSignature, ClipboardList, RefreshCw,
  Sparkles, CreditCard, Repeat, Wallet2, ExternalLink,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CompanyProvider, useCompany } from "@/lib/company-context";

import { useFxRates } from "@/lib/fx";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import axelIcon from "@/assets/axel-icon-purple.png";

interface NavItem { to: string; label: string; icon: React.ComponentType<{ className?: string }>; requireGroupAdmin?: boolean }

interface NavSection {
  label: string;
  items: NavItem[];
}


const sections: NavSection[] = [
  {
    label: "Overview",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/axel", label: "Axel AI", icon: Sparkles },
    ],
  },
  {
    label: "Finance",
    items: [
      { to: "/accounts", label: "Accounts", icon: Wallet },
      { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
      { to: "/quotations", label: "Quotations", icon: FileSignature },
      { to: "/purchase-orders", label: "Purchase orders", icon: ClipboardList },
      { to: "/invoices", label: "Invoices", icon: FileText },
      { to: "/budgets", label: "Budgets", icon: Target },
      { to: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    label: "CRM",
    items: [
      { to: "/clients", label: "Clients", icon: Users },
      { to: "/suppliers", label: "Suppliers", icon: Truck },
      { to: "/pipeline", label: "Pipeline", icon: TrendingUp },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/expenses", label: "Expenses", icon: CreditCard },
      { to: "/billing", label: "Billing", icon: Repeat },
      { to: "/payroll", label: "Payroll", icon: Wallet2 },
    ],
  },
  {
    label: "Organization",
    items: [
      { to: "/companies", label: "Companies", icon: Building2 },
      { to: "/users-access", label: "Users & Access", icon: Users, requireGroupAdmin: true },
      { to: "/projects", label: "Projects", icon: Briefcase },
      { to: "/team", label: "Team", icon: UserCog },
      { to: "/sales-team", label: "Sales team", icon: Handshake },
    ],
  },
  {
    label: "Comptabilité",
    items: [
      { to: "/plan-comptable", label: "Plan comptable", icon: Library },
      { to: "/journal", label: "Journal", icon: BookOpen },
      { to: "/grand-livre", label: "Grand-livre", icon: BookText },
      { to: "/balance", label: "Balance", icon: Scale },
      { to: "/bilan", label: "Bilan", icon: Receipt },
      { to: "/compte-resultat", label: "Compte de résultat", icon: BarChart3 },
    ],
  },
];

function CompanySwitcher() {
  const { scope, setScope, label, accessibleCompanies: companies, isGroupAdmin } = useCompany();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-sidebar-accent/40 hover:bg-sidebar-accent border border-sidebar-border text-sm transition"
      >
        <div className="h-7 w-7 rounded-md bg-gradient-to-br from-primary to-chart-2 grid place-items-center text-[10px] font-display font-bold text-primary-foreground">
          {scope.id === "group" ? "GR" : companies.find((c) => c.id === scope.companyId)?.shortName}
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Workspace</div>
          <div className="truncate font-medium">{label}</div>
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-2 w-full rounded-lg border border-border bg-popover shadow-2xl overflow-hidden">
            {isGroupAdmin && (
              <>
                <button
                  onClick={() => { setScope({ id: "group" }); setOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent text-sm"
                >
                  <div className="h-6 w-6 rounded bg-gradient-to-br from-primary to-chart-2 grid place-items-center text-[9px] font-bold text-primary-foreground">GR</div>
                  <span className="flex-1 text-left">Group · All companies</span>
                  {scope.id === "group" && <Check className="h-4 w-4 text-primary" />}
                </button>
                <div className="h-px bg-border" />
              </>
            )}
            {companies.map((c) => (
              <button
                key={c.id}
                onClick={() => { setScope({ id: "company", companyId: c.id }); setOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent text-sm"
              >
                <div className="h-6 w-6 rounded grid place-items-center text-[9px] font-bold text-primary-foreground" style={{ background: c.color }}>
                  {c.shortName}
                </div>
                <span className="flex-1 text-left">{c.name}</span>
                {scope.id === "company" && scope.companyId === c.id && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SidebarSection({ section, pathname }: { section: NavSection; pathname: string }) {
  const hasActive = section.items.some(
    (item) => pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to)),
  );
  // Default: every section is expanded; opens automatically when a child route is active.
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (hasActive) setOpen(true);
  }, [hasActive]);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition cursor-pointer select-none">
        <span>{section.label}</span>
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-0.5 pb-2">
          {section.items.map((item) => {
            const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "group flex items-center gap-3 px-3 py-2 rounded-md text-sm transition relative",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
                )}
              >
                {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary" />}
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function Sidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { roles } = useAuth();
  const isGroupAdmin = roles.includes("group_admin") || roles.includes("super_admin");
  const visibleSections = sections
    .map((s) => ({ ...s, items: s.items.filter((i) => !i.requireGroupAdmin || isGroupAdmin) }))
    .filter((s) => s.items.length > 0);
  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="px-5 py-5 flex items-center gap-2.5">
        <img src={axelIcon} alt="AXEL Business Platform logo" className="h-8 w-8 rounded-lg shadow-[var(--shadow-glow)]" />
        <span className="font-display text-sm font-semibold text-sidebar-foreground">Axel - Unified Business Platform</span>
      </div>
      <div className="px-3 pb-3">
        <CompanySwitcher />
      </div>
      <nav className="flex-1 px-2 py-2 space-y-1 overflow-y-auto">
        {visibleSections.map((section) => (
          <SidebarSection key={section.label} section={section} pathname={pathname} />
        ))}
      </nav>
      <div className="p-3 border-t border-sidebar-border">
        <Link to="/settings" className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50">
          <Settings className="h-4 w-4" /> Settings
        </Link>
      </div>
    </aside>
  );
}


// Map current path → the create action exposed by that page (via window event)
const CREATE_EVENT = "axel:open-create";
const NEW_BUTTON_ROUTES: { match: (p: string) => boolean; to: string; label: string }[] = [
  { match: (p) => p.startsWith("/accounts"), to: "/accounts", label: "New account" },
  { match: (p) => p.startsWith("/transactions"), to: "/transactions", label: "New transaction" },
  { match: (p) => p.startsWith("/invoices"), to: "/invoices", label: "New invoice" },
  { match: (p) => p.startsWith("/quotations"), to: "/quotations", label: "New quote" },
  { match: (p) => p.startsWith("/purchase-orders"), to: "/purchase-orders", label: "New PO" },
  { match: (p) => p.startsWith("/clients"), to: "/clients", label: "New client" },
  { match: (p) => p.startsWith("/suppliers"), to: "/suppliers", label: "New supplier" },
  { match: (p) => p.startsWith("/projects"), to: "/projects", label: "New project" },
  { match: (p) => p.startsWith("/pipeline"), to: "/pipeline", label: "New opportunity" },
  { match: (p) => p.startsWith("/sales-team"), to: "/sales-team", label: "Add sales member" },
  { match: (p) => p.startsWith("/team"), to: "/team", label: "New team member" },
  { match: (p) => p.startsWith("/budgets"), to: "/budgets", label: "New category" },
  { match: (p) => p.startsWith("/companies"), to: "/companies", label: "New company" },
  { match: (p) => p.startsWith("/expenses"), to: "/expenses", label: "New expense" },
  { match: (p) => p.startsWith("/billing"), to: "/billing", label: "New schedule" },
  { match: (p) => p.startsWith("/payroll"), to: "/payroll", label: "New run" },
  { match: (p) => p.startsWith("/journal"), to: "/journal", label: "New entry" },
];

function Topbar() {
  const { profile, user, signOut, roles } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const name = profile?.display_name || user?.email || "—";
  const initials = name.split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  const role = roles[0]?.replace("_", " ") ?? "no role";

  const newAction = NEW_BUTTON_ROUTES.find((r) => r.match(pathname));
  const newLabel = newAction?.label ?? "New";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    navigate({ to: "/transactions", search: { q } as never });
  };

  const handleNew = () => {
    if (newAction) {
      if (pathname.startsWith(newAction.to)) {
        window.dispatchEvent(new CustomEvent(CREATE_EVENT));
      } else {
        navigate({ to: newAction.to });
      }
    } else {
      navigate({ to: "/transactions" });
    }
  };

  return (
    <header className="h-14 shrink-0 border-b border-border bg-background/70 backdrop-blur px-6 flex items-center gap-4 sticky top-0 z-30">
      <form onSubmit={submitSearch} className="flex-1 max-w-md relative">
        <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search transactions, invoices, clients…"
          className="w-full h-9 pl-9 pr-12 rounded-md bg-surface border border-border text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">⌘K</kbd>
      </form>
      <div className="flex items-center gap-2">
        <FxBadge />
        <button
          onClick={handleNew}
          className="h-9 px-3 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" /> {newLabel}
        </button>
        <div className="relative">
          <button
            onClick={() => setBellOpen((v) => !v)}
            className="h-9 w-9 grid place-items-center rounded-md hover:bg-surface relative"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </button>
          {bellOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setBellOpen(false)} />
              <div className="absolute right-0 mt-2 w-72 rounded-lg border border-border bg-popover shadow-2xl z-50 overflow-hidden">
                <div className="px-3 py-2.5 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">Notifications</div>
                <div className="p-6 text-center text-sm text-muted-foreground">You're all caught up.</div>
              </div>
            </>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="h-8 w-8 rounded-full bg-gradient-to-br from-chart-2 to-chart-4 grid place-items-center text-xs font-display font-bold"
          >
            {initials || "?"}
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 mt-2 w-60 rounded-lg border border-border bg-popover shadow-2xl z-50 overflow-hidden">
                <div className="px-3 py-3 border-b border-border">
                  <div className="text-sm font-medium truncate">{name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{user?.email}</div>
                  <div className="text-[10px] uppercase tracking-wider text-primary mt-1">{role}</div>
                </div>
                <button
                  onClick={() => { setMenuOpen(false); navigate({ to: "/settings" }); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-accent"
                >
                  <Settings className="h-4 w-4" /> Settings
                </button>
                <button
                  onClick={async () => { await signOut(); navigate({ to: "/login" }); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-accent"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export { CREATE_EVENT };

function FxBadge() {
  const { rates, updatedAt, source, refresh } = useFxRates();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const stamp = updatedAt
    ? new Date(updatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : "never";
  const onRefresh = async () => { setBusy(true); try { await refresh(); } finally { setBusy(false); } };
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={`FX rates · ${source} · updated ${stamp}`}
        className="hidden md:flex items-center gap-1.5 h-9 px-2.5 rounded-md border border-border bg-surface hover:bg-surface-elevated text-[11px] font-tnum text-muted-foreground"
      >
        <span className="text-foreground/80">€</span>
        <span>{rates.EUR.toLocaleString()}</span>
        <span className="text-border">·</span>
        <span className="text-foreground/80">$</span>
        <span>{rates.USD.toLocaleString()}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-64 rounded-lg border border-border bg-popover shadow-2xl z-50 overflow-hidden">
            <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">FX rates (per MGA)</div>
              <button
                onClick={onRefresh}
                disabled={busy}
                className="h-6 w-6 grid place-items-center rounded hover:bg-accent text-muted-foreground disabled:opacity-50"
                title="Refresh now"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} />
              </button>
            </div>
            <div className="p-3 text-xs space-y-1.5 font-tnum">
              <div className="flex justify-between"><span className="text-muted-foreground">1 EUR</span><span>{rates.EUR.toLocaleString()} MGA</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">1 USD</span><span>{rates.USD.toLocaleString()} MGA</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">1 MGA</span><span>1 MGA</span></div>
            </div>
            <div className="px-3 py-2 border-t border-border text-[10px] text-muted-foreground flex items-center justify-between">
              <span className="uppercase tracking-wider">{source}</span>
              <span>updated {stamp}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <CompanyProvider>
      <div className="min-h-screen flex bg-background text-foreground">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar />
          <main className="flex-1 overflow-y-auto">
            <div className="absolute inset-0 pointer-events-none [background:var(--gradient-glow)] opacity-60" />
            <div className="relative">{children}</div>
          </main>
          <footer className="shrink-0 border-t border-border bg-background/70 backdrop-blur px-6 py-3 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>© {new Date().getFullYear()} AXEL by WeAxiom</span>
            <div className="flex items-center gap-4">
              <Link to="/about" className="hover:text-foreground transition">About</Link>
              <a href="https://axel.weaxiom.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition flex items-center gap-1">
                Help <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </footer>
        </div>
      </div>
    </CompanyProvider>
  );
}
