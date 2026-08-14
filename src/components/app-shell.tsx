import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Building2, Wallet, ArrowLeftRight, FileText,
  Users, Briefcase, TrendingUp, BarChart3, Settings, Search, Bell, Plus, Truck,
  ChevronDown, Check, LogOut, Target, UserCog, Handshake,
  BookOpen, BookText, Scale, Library, Receipt, FileSignature, ClipboardList, RefreshCw,
  Sparkles, CreditCard, Repeat, Wallet2, ExternalLink, Info, ShieldCheck, Menu, X, Undo2, Redo2,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { CREATE_EVENT } from "@/lib/create-action";
import { useHistory, undo as undoAction, redo as redoAction } from "@/lib/history";
import { toast } from "sonner";

import { useCompany } from "@/lib/company-context";
import { useFxRates } from "@/lib/fx";
import { useAuth } from "@/lib/auth-context";
import { useEffectiveRole } from "@/lib/use-effective-role";
import { cn } from "@/lib/utils";
import { TableStackLabeler } from "@/components/stacked-table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ThemeControls } from "@/components/theme-controls";
import { useFileUrl } from "@/hooks/use-file-url";

import { AxelWordmark, AxelBraceMark } from "@/components/axel-wordmark";
import { AXEL_AI_ENABLED } from "@/lib/features";


interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requireGroupAdmin?: boolean;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

/** Routes a sales-only user may reach. Everything else is hidden and redirected. */
export const SALES_ROUTES = ["/quotations", "/clients", "/projects", "/settings"];

const sections: NavSection[] = [
  {
    label: "Overview",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      ...(AXEL_AI_ENABLED ? [{ to: "/axel", label: "Axel AI", icon: Sparkles }] : []),
    ],
  },

  {
    label: "Sales",
    items: [
      { to: "/pipeline", label: "Pipeline", icon: TrendingUp },
      { to: "/quotations", label: "Quotations", icon: FileSignature },
      { to: "/clients", label: "Clients", icon: Users },
      { to: "/projects", label: "Projects", icon: Briefcase },
      { to: "/sales-team", label: "Sales team", icon: Handshake },
    ],
  },
  {
    label: "Billing",
    items: [
      { to: "/purchase-orders", label: "Purchase orders", icon: ClipboardList },
      { to: "/invoices", label: "Invoices", icon: FileText },
      { to: "/billing", label: "Recurring billing", icon: Repeat },
    ],
  },
  {
    label: "Treasury",
    items: [
      { to: "/accounts", label: "Accounts", icon: Wallet },
      { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
      { to: "/expenses", label: "Expenses", icon: CreditCard },
      { to: "/suppliers", label: "Suppliers", icon: Truck },
    ],
  },
  {
    label: "Accounting",
    items: [
      { to: "/plan-comptable", label: "Plan comptable", icon: Library },
      { to: "/journal", label: "Journal", icon: BookOpen },
      { to: "/grand-livre", label: "Grand-livre", icon: BookText },
      { to: "/balance", label: "Balance", icon: Scale },
      { to: "/bilan", label: "Bilan", icon: Receipt },
      { to: "/compte-resultat", label: "Compte de resultat", icon: BarChart3 },
    ],
  },
  {
    label: "Analysis",
    items: [
      { to: "/budgets", label: "Budgets", icon: Target },
      { to: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/sops", label: "SOPs & Compliance", icon: ShieldCheck },
    ],
  },
  {

    label: "Administration",
    items: [
      { to: "/companies", label: "Companies", icon: Building2 },
      { to: "/team", label: "Team", icon: UserCog },
      { to: "/payroll", label: "Payroll", icon: Wallet2 },
      { to: "/users-access", label: "Users & Access", icon: Users, requireGroupAdmin: true },
      { to: "/settings", label: "Settings", icon: Settings },
      { to: "/about", label: "About", icon: Info },
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
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-full bg-[var(--surface-container)] hover:bg-[var(--surface-container-high)] border-0 text-sm transition-all duration-150 ease-[cubic-bezier(0.2,0,0,1)] active:scale-[0.99] group/ws"
      >
        <div className="h-7 w-7 rounded-md bg-gradient-to-br from-primary to-chart-2 grid place-items-center text-[10px] font-display font-bold text-primary-foreground">
          {scope.id === "group" ? "GR" : companies.find((c) => c.id === scope.companyId)?.shortName}
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-foreground/60">Workspace</div>
          <div className="truncate font-medium">{label}</div>
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-2 w-full rounded-2xl border-0 bg-popover/95 material-panel shadow-[var(--shadow-elevated)] overflow-hidden origin-top animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-150">
            {isGroupAdmin && (
              <>
                <button
                  onClick={() => { setScope({ id: "group" }); setOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent hover:pl-4 text-sm transition-all duration-200"
                >
                  <div className="h-6 w-6 rounded bg-gradient-to-br from-primary to-chart-2 grid place-items-center text-[9px] font-bold text-primary-foreground">GR</div>
                  <span className="flex-1 text-left">Group · All companies</span>
                  {scope.id === "group" && <Check className="h-4 w-4 text-primary" />}
                </button>
                <div className="h-px bg-border" />
              </>
            )}
            {companies.map((company) => (
              <button
                key={company.id}
                onClick={() => { setScope({ id: "company", companyId: company.id }); setOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent text-sm"
              >
                <div className="h-6 w-6 rounded grid place-items-center text-[9px] font-bold text-primary-foreground" style={{ background: company.color }}>
                  {company.shortName}
                </div>
                <span className="flex-1 text-left">{company.name}</span>
                {scope.id === "company" && scope.companyId === company.id && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SidebarSection({ section, pathname, onNavigate }: { section: NavSection; pathname: string; onNavigate?: () => void }) {
  const hasActive = section.items.some((item) => pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to)));
  const [open, setOpen] = useState(hasActive);

  useEffect(() => {
    if (hasActive) setOpen(true);
  }, [hasActive]);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger aria-label={`${section.label} section`} className="w-full focus-ring rounded-full flex items-center justify-between px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-foreground/55 hover:text-foreground transition cursor-pointer select-none group/section">
        <span className="transition-transform duration-200 group-hover/section:translate-x-0.5">{section.label}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "h-3 w-3 transition-transform duration-300 ease-in-out",
            open ? "rotate-0" : "-rotate-90",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-[accordion-down_240ms_cubic-bezier(0.22,1,0.36,1)] data-[state=closed]:animate-[accordion-up_200ms_cubic-bezier(0.22,1,0.36,1)]">
        <div className="space-y-0.5 pb-2">
          {section.items.map((item) => {
            const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group focus-ring flex items-center gap-3 pl-4 pr-4 py-2.5 rounded-full text-sm relative transition-[color,background-color] duration-150 ease-[cubic-bezier(0.2,0,0,1)]",
                    active
                      ? "bg-[var(--primary-container)] text-[var(--on-primary-container)] font-medium"
                      : "text-foreground/80 hover:text-foreground hover:bg-[var(--surface-container)]",
                )}
              >
                <Icon
                  className={cn(
                    "h-[18px] w-[18px] transition-colors duration-150",
                    active ? "text-[var(--on-primary-container)]" : "text-foreground/55",
                  )}
                  aria-hidden="true"
                />

                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </CollapsibleContent>

    </Collapsible>
  );
}

function useVisibleSections() {
  const { isSalesOnly, isGroupAdmin } = useEffectiveRole();
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          (!item.requireGroupAdmin || isGroupAdmin) &&
          (!isSalesOnly || SALES_ROUTES.includes(item.to)),
      ),
    }))
    .filter((section) => section.items.length > 0);
}

function SidebarInner({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const visibleSections = useVisibleSections();

  return (
    <>
      <div className="px-5 py-5 flex flex-col gap-1.5">
        <AxelWordmark title="AXEL Business Platform" className="h-7 w-auto self-start text-foreground" />
        <span className="text-[11px] font-medium tracking-wide text-foreground/80">The Axiom Winford Group</span>
      </div>
      <div className="px-3 pb-3">
        <CompanySwitcher />
      </div>
      <nav aria-label="Main" className="flex-1 px-2 py-2 space-y-1 overflow-y-auto">
        {visibleSections.map((section) => (
          <SidebarSection key={section.label} section={section} pathname={pathname} onNavigate={onNavigate} />
        ))}
      </nav>
      <div className="p-3 border-t border-sidebar-border">
        <Link
          to="/settings"
          onClick={onNavigate}
          className="group focus-ring flex items-center gap-3 px-4 py-2.5 rounded-full text-sm text-foreground/80 hover:bg-[var(--surface-container)] hover:text-foreground transition-all duration-150"
        >
          <Settings className="h-4 w-4 transition-transform duration-500 group-hover:rotate-90" /> Settings
        </Link>
      </div>
    </>
  );
}

function Sidebar() {
  return (
    <aside className="hidden lg:flex w-[17rem] shrink-0 flex-col border-r-0 bg-sidebar px-2">
      <SidebarInner />
    </aside>
  );
}

function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="lg:hidden fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px] animate-in fade-in-0 duration-200"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className="absolute inset-y-0 left-0 w-[min(19rem,86vw)] flex flex-col bg-sidebar border-r-0 shadow-[var(--shadow-elevated)] rounded-r-2xl animate-in slide-in-from-left duration-250"
      >
        <button
          onClick={onClose}
          aria-label="Close navigation"
          className="absolute right-3 top-3 h-9 w-9 grid place-items-center rounded-full focus-ring hover:bg-sidebar-accent/60 text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <SidebarInner onNavigate={onClose} />
      </div>
    </div>
  );
}

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
  { match: (p) => p.startsWith("/payroll"), to: "/payroll", label: "New payroll run" },
  { match: (p) => p.startsWith("/journal"), to: "/journal", label: "New journal entry" },
  { match: (p) => p.startsWith("/users-access"), to: "/users-access", label: "Add user" },
  { match: (p) => p.startsWith("/sops"), to: "/sops", label: "Log escalation" },
  ...(AXEL_AI_ENABLED
    ? [{ match: (p: string) => p.startsWith("/axel"), to: "/axel", label: "New conversation" }]
    : []),

  // Dashboard has no entity of its own — invoicing is the primary action.
  { match: (p) => p === "/" || p.startsWith("/dashboard"), to: "/invoices", label: "New invoice" },
];


function Topbar({ onOpenNav }: { onOpenNav: () => void }) {
  const { profile, user, signOut, roles } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const name = profile?.display_name || user?.email || "—";
  const initials = name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  const avatarUrl = useFileUrl(profile?.avatar_url);
  const role = roles[0]?.replace("_", " ") ?? "no role";
  const newAction = NEW_BUTTON_ROUTES.find((route) => route.match(pathname));
  const newLabel = newAction?.label ?? "New";
  const history = useHistory();

  const runUndo = async () => {
    try {
      const label = await undoAction();
      if (label) toast.success(`Undid ${label}`, { action: { label: "Redo", onClick: () => void redoAction() } });
    } catch (e) {
      toast.error(`Could not undo: ${e instanceof Error ? e.message : "unknown error"}`);
    }
  };
  const runRedo = async () => {
    try {
      const label = await redoAction();
      if (label) toast.success(`Redid ${label}`, { action: { label: "Undo", onClick: () => void undoAction() } });
    } catch (e) {
      toast.error(`Could not redo: ${e instanceof Error ? e.message : "unknown error"}`);
    }
  };

  useEffect(() => {
    const isTyping = (el: EventTarget | null) => {
      const node = el as HTMLElement | null;
      if (!node) return false;
      const tag = node.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || node.isContentEditable;
    };
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (!(event.metaKey || event.ctrlKey) || isTyping(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        void runUndo();
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        void runRedo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);


  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    navigate({ to: "/transactions", search: { q } as never });
  };

  const handleNew = () => {
    if (!newAction) return;
    if (pathname.startsWith(newAction.to)) {
      window.dispatchEvent(new CustomEvent(CREATE_EVENT));
      return;
    }
    void Promise.resolve(navigate({ to: newAction.to })).then(() => {
      // Give the destination page a tick to mount its create listener.
      setTimeout(() => window.dispatchEvent(new CustomEvent(CREATE_EVENT)), 120);
    });
  };


  return (
    <header className="h-16 shrink-0 border-b-0 material-bar px-3 sm:px-6 flex items-center gap-2 sm:gap-4 sticky top-0 z-30">
      <button
        onClick={onOpenNav}
        aria-label="Open navigation"
        className="lg:hidden h-9 w-9 shrink-0 grid place-items-center rounded-full focus-ring hover:bg-[var(--surface-container)] active:scale-95 transition-all duration-200"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>
      <AxelBraceMark title="AXEL" className="lg:hidden h-5 w-5 shrink-0 text-foreground" />
      <form onSubmit={submitSearch} className="flex-1 min-w-0 max-w-xl relative">
        <Search className="h-5 w-5 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2" aria-hidden="true" />
        <input
          ref={searchRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search..."
          aria-label="Search transactions, invoices and clients"
          type="search"
          className="w-full h-12 pl-12 pr-3 md:pr-14 rounded-[28px] bg-[var(--surface-container)] border-0 text-sm text-foreground placeholder:text-muted-foreground transition-[background-color,box-shadow] duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-[var(--surface-container-high)] focus:outline-none focus:bg-surface focus:shadow-[var(--shadow-elevated)]"
        />
        <kbd className="hidden md:block absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">⌘K</kbd>
      </form>
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <div className="hidden sm:flex items-center gap-0.5">
          <button
            onClick={() => void runUndo()}
            disabled={!history.canUndo}
            aria-label={history.undoLabel ? `Undo ${history.undoLabel}` : "Undo"}
            title={history.undoLabel ? `Undo ${history.undoLabel} (⌘Z)` : "Nothing to undo"}
            className="h-9 w-9 grid place-items-center rounded-full focus-ring tap-target hover:bg-[var(--surface-container)] hover:text-foreground active:scale-95 transition-all duration-200 disabled:opacity-35 disabled:pointer-events-none"
          >
            <Undo2 className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            onClick={() => void runRedo()}
            disabled={!history.canRedo}
            aria-label={history.redoLabel ? `Redo ${history.redoLabel}` : "Redo"}
            title={history.redoLabel ? `Redo ${history.redoLabel} (⇧⌘Z)` : "Nothing to redo"}
            className="h-9 w-9 grid place-items-center rounded-full focus-ring tap-target hover:bg-[var(--surface-container)] hover:text-foreground active:scale-95 transition-all duration-200 disabled:opacity-35 disabled:pointer-events-none"
          >
            <Redo2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <FxBadge />

        {newAction && (
          <button
            onClick={handleNew}
            aria-label={newLabel}
            title={newLabel}
            className="h-12 w-12 sm:w-auto sm:px-6 focus-ring tap-target rounded-2xl text-sm font-medium bg-surface text-primary shadow-[var(--shadow-elevated)] hover:shadow-[0_1px_3px_rgba(60,64,67,0.2),0_6px_16px_rgba(60,64,67,0.14)] hover:bg-[var(--surface-container-high)] active:scale-[0.98] transition-all duration-150 ease-[cubic-bezier(0.2,0,0,1)] flex items-center justify-center gap-2 group"
          >
            <Plus className="h-5 w-5 shrink-0 transition-transform duration-200 group-hover:rotate-90" />
            <span className="hidden sm:inline">{newLabel}</span>
          </button>
        )}

        <div className="relative">
          <button
            onClick={() => setBellOpen((v) => !v)}
            className="h-9 w-9 grid place-items-center rounded-full focus-ring tap-target hover:bg-[var(--surface-container)] hover:text-foreground active:scale-95 transition-all duration-200 relative"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
          </button>
          {bellOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setBellOpen(false)} />
              <div className="absolute right-0 mt-2 w-72 rounded-2xl border-0 bg-popover/95 material-panel shadow-[var(--shadow-elevated)] z-50 overflow-hidden origin-top-right animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-150">
                <div className="px-3 py-2.5 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">Notifications</div>
                <div className="p-6 text-center text-sm text-muted-foreground">You're all caught up.</div>
              </div>
            </>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Account menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="h-8 w-8 rounded-full overflow-hidden bg-gradient-to-br from-chart-2 to-chart-4 grid place-items-center text-xs font-display font-bold text-primary-foreground focus-ring transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-110 active:scale-95"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initials || "?"
            )}
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div role="menu" aria-label="Account" className="absolute right-0 mt-2 w-72 rounded-2xl border-0 bg-popover/95 material-panel shadow-[var(--shadow-elevated)] z-50 overflow-hidden origin-top-right animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-150">
                <div className="px-3 py-3 border-b border-border">
                  <div className="text-sm font-medium truncate">{name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{user?.email}</div>
                  <div className="text-[10px] uppercase tracking-wider text-primary mt-1">{role}</div>
                </div>
                <div className="px-3 py-3 border-b border-border">
                  <ThemeControls />
                </div>
                <button
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); navigate({ to: "/settings" }); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-accent hover:pl-4 focus-ring transition-all duration-200"
                >
                  <Settings className="h-4 w-4" aria-hidden="true" /> Settings
                </button>
                <button
                  role="menuitem"
                  onClick={async () => { await signOut(); navigate({ to: "/login", search: { redirect: "/" } }); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-accent focus-ring"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
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
        aria-label={`Foreign exchange rates, updated ${stamp}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="hidden md:flex items-center gap-1.5 h-9 px-3.5 rounded-full border-0 bg-[var(--surface-container)] hover:bg-[var(--surface-container-high)] active:scale-[0.98] transition-all duration-150 text-[11px] font-tnum text-muted-foreground"
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
          <div className="absolute right-0 mt-2 w-64 rounded-2xl border-0 bg-popover/95 material-panel shadow-[var(--shadow-elevated)] z-50 overflow-hidden origin-top-right animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-150">
            <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">FX rates (per MGA)</div>
              <button
                onClick={onRefresh}
                disabled={busy}
                className="h-6 w-6 grid place-items-center rounded focus-ring hover:bg-accent text-muted-foreground disabled:opacity-50"
                title="Refresh now"
                aria-label="Refresh exchange rates"
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

function AppShellLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
      <div className="w-full max-w-md rounded-lg border border-border bg-[var(--gradient-surface)] p-8 shadow-[var(--shadow-soft)]">
        <div className="flex items-center gap-3">
          <AxelBraceMark title="AXEL Business Platform" className="h-9 w-9 text-primary" />
          <div>
            <div className="font-display text-base font-semibold">Axel Command Center</div>
            <div className="text-sm text-muted-foreground">Loading your workspace access and data...</div>
          </div>
        </div>
        <div className="mt-6 space-y-3">
          <div className="h-3 rounded-full bg-surface animate-pulse" />
          <div className="h-3 w-5/6 rounded-full bg-surface animate-pulse" />
          <div className="h-3 w-2/3 rounded-full bg-surface animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function AppShellError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-[var(--gradient-surface)] p-8 shadow-[var(--shadow-soft)]">
        <div className="flex items-center gap-3">
          <AxelBraceMark title="AXEL Business Platform" className="h-9 w-9 text-primary" />
          <div>
            <div className="font-display text-base font-semibold">Couldn't load your workspace</div>
            <div className="text-sm text-muted-foreground">{message}</div>
          </div>
        </div>
        <button
          onClick={onRetry}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

function AppShellFrame({ children }: { children: ReactNode }) {
  const { bootstrapReady, bootstrapError, retryBootstrap } = useCompany();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => { setNavOpen(false); }, [pathname]);

  if (bootstrapError) return <AppShellError message={bootstrapError} onRetry={retryBootstrap} />;
  if (!bootstrapReady) return <AppShellLoading />;


  return (
    <div className="min-h-dvh bg-background text-foreground p-0">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <TableStackLabeler />
      <MobileNav open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="min-h-dvh flex overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onOpenNav={() => setNavOpen(true)} />
        <main id="main-content" tabIndex={-1} className="relative flex-1 overflow-y-auto focus:outline-none">
          <div className="absolute inset-0 pointer-events-none [background:var(--gradient-glow)] opacity-60" />
          <div key={pathname} className="relative rise-in">{children}</div>
        </main>


        <footer className="shrink-0 border-t border-border/70 material-bar px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span>© {new Date().getFullYear()} AXEL by WeAxiom</span>
          <div className="flex items-center gap-4">
            <Link to="/about" className="hover:text-foreground transition underline-grow">About</Link>
            <a href="https://axel.weaxiom.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition flex items-center gap-1 group">
              Help <ExternalLink className="h-3 w-3 icon-nudge group-hover:translate-x-0.5" />
            </a>
          </div>
        </footer>

      </div>
      </div>
    </div>

  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return <AppShellFrame>{children}</AppShellFrame>;
}
