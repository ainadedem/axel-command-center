import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Building2, Wallet, ArrowLeftRight, FileText,
  Users, Briefcase, TrendingUp, BarChart3, Settings, Search, Bell, Plus,
  ChevronDown, Check, LogOut,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { CompanyProvider, useCompany } from "@/lib/company-context";
import { companies } from "@/lib/mock-data";
import { useAuth } from "@/lib/auth-context";
import { ROLE_LABEL, type Resource } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const nav: { to: string; label: string; icon: typeof LayoutDashboard; resource: Resource }[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, resource: "dashboard" },
  { to: "/companies", label: "Companies", icon: Building2, resource: "companies" },
  { to: "/accounts", label: "Accounts", icon: Wallet, resource: "accounts" },
  { to: "/transactions", label: "Transactions", icon: ArrowLeftRight, resource: "transactions" },
  { to: "/invoices", label: "Invoices", icon: FileText, resource: "invoices" },
  { to: "/clients", label: "Clients", icon: Users, resource: "clients" },
  { to: "/projects", label: "Projects", icon: Briefcase, resource: "projects" },
  { to: "/pipeline", label: "Pipeline", icon: TrendingUp, resource: "pipeline" },
  { to: "/reports", label: "Reports", icon: BarChart3, resource: "reports" },
];

function CompanySwitcher() {
  const { scope, setScope, label } = useCompany();
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
            <button
              onClick={() => { setScope({ id: "group" }); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent text-sm"
            >
              <div className="h-6 w-6 rounded bg-gradient-to-br from-primary to-chart-2 grid place-items-center text-[9px] font-bold text-primary-foreground">GR</div>
              <span className="flex-1 text-left">Group · All companies</span>
              {scope.id === "group" && <Check className="h-4 w-4 text-primary" />}
            </button>
            <div className="h-px bg-border" />
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

function Sidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { can } = useAuth();
  const visibleNav = nav.filter((item) => can(item.resource, "view"));
  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="px-5 py-5 flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-chart-2 grid place-items-center shadow-[var(--shadow-glow)]">
          <span className="font-display text-base font-bold text-primary-foreground">A</span>
        </div>
        <div>
          <div className="font-display text-lg font-bold tracking-tight leading-none">AXEL</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mt-0.5">Control System</div>
        </div>
      </div>
      <div className="px-3 pb-3">
        <CompanySwitcher />
      </div>
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {visibleNav.map((item) => {
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
      </nav>
      <div className="p-3 border-t border-sidebar-border">
        <Link to="/" className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50">
          <Settings className="h-4 w-4" /> Settings
        </Link>
      </div>
    </aside>
  );
}

function Topbar() {
  const { profile, user, signOut, roles } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const name = profile?.display_name || user?.email || "—";
  const initials = name.split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  const role = roles[0] ? ROLE_LABEL[roles[0]] : "No role";

  return (
    <header className="h-14 shrink-0 border-b border-border bg-background/70 backdrop-blur px-6 flex items-center gap-4 sticky top-0 z-30">
      <div className="flex-1 max-w-md relative">
        <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          placeholder="Search transactions, invoices, clients…"
          className="w-full h-9 pl-9 pr-3 rounded-md bg-surface border border-border text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">⌘K</kbd>
      </div>
      <div className="flex items-center gap-2">
        <button className="h-9 px-3 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition flex items-center gap-1.5">
          <Plus className="h-4 w-4" /> New
        </button>
        <button className="h-9 w-9 grid place-items-center rounded-md hover:bg-surface relative">
          <Bell className="h-4 w-4" />
          <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-primary" />
        </button>
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
        </div>
      </div>
    </CompanyProvider>
  );
}
