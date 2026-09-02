import {
  BadgeCheck,
  LayoutDashboard, Building2, Wallet, ArrowLeftRight, FileText,
  Users, Briefcase, TrendingUp, BarChart3, Settings, Truck,
  Target, UserCog, Handshake,
  BookOpen, BookText, Scale, Library, Receipt, FileSignature, ClipboardList,
  Sparkles, CreditCard, Repeat, Wallet2, Info, ShieldCheck,
  Clock, CalendarDays, KeyRound,
  FolderOpen, CheckSquare, LifeBuoy, Ticket, ClipboardCheck, Plug,
} from "lucide-react";
import { AXEL_AI_ENABLED } from "@/lib/features";

export interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requireGroupAdmin?: boolean;
}

export interface NavSection {
  label: string;
  /** Rail icon standing for the whole section. */
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

export interface AxelModule {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Landing page when the module is picked from the launcher. */
  defaultTo: string;
  sections: NavSection[];
}

/** The six top-level Axel modules. Every existing page lives in exactly one. */
export const MODULES: AxelModule[] = [
  {
    id: "sales",
    label: "Axel Sales",
    description: "CRM: leads, pipeline, deals and contacts.",
    icon: TrendingUp,
    defaultTo: "/pipeline",
    sections: [
      {
        label: "Sales",
        icon: TrendingUp,
        items: [
          { to: "/pipeline", label: "Pipeline", icon: TrendingUp },
          { to: "/quotations", label: "Quotations", icon: FileSignature },
          { to: "/clients", label: "Clients", icon: Users },
          { to: "/sales-team", label: "Sales team", icon: Handshake },
        ],
      },
    ],
  },
  {
    id: "books",
    label: "Axel Books",
    description: "Finance: invoices, expenses, reporting and cash flow.",
    icon: FileText,
    defaultTo: "/dashboard",
    sections: [
      {
        label: "Overview",
        icon: LayoutDashboard,
        items: [
          { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
          ...(AXEL_AI_ENABLED ? [{ to: "/axel", label: "Axel AI", icon: Sparkles }] : []),
        ],
      },
      {
        label: "Billing",
        icon: FileText,
        items: [
          { to: "/purchase-orders", label: "Purchase orders", icon: ClipboardList },
          { to: "/invoices", label: "Invoices", icon: FileText },
          { to: "/billing", label: "Recurring billing", icon: Repeat },
          { to: "/cash-flow", label: "Cash flow", icon: Wallet2 },
        ],
      },
      {
        label: "Treasury",
        icon: Wallet,
        items: [
          { to: "/accounts", label: "Accounts", icon: Wallet },
          { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
          { to: "/expenses", label: "Expenses", icon: CreditCard },
          { to: "/payment-approvals", label: "Payment approvals", icon: BadgeCheck },
          { to: "/suppliers", label: "Suppliers", icon: Truck },
        ],
      },
      {
        label: "Accounting",
        icon: BookOpen,
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
        icon: BarChart3,
        items: [
          { to: "/budgets", label: "Budgets", icon: Target },
          { to: "/reports", label: "Reports", icon: BarChart3 },
        ],
      },
    ],
  },
  {
    id: "forge",
    label: "Axel Forge",
    description: "Collaboration: projects, files and tasks.",
    icon: FolderOpen,
    defaultTo: "/projects",
    sections: [
      {
        label: "Axel Forge",
        icon: FolderOpen,
        items: [
          { to: "/projects", label: "Projects", icon: Briefcase },
          { to: "/files", label: "Files", icon: FolderOpen },
          { to: "/tasks", label: "Tasks", icon: CheckSquare },
          { to: "/sops", label: "SOPs & Compliance", icon: ShieldCheck },
        ],
      },
    ],
  },
  {
    id: "support",
    label: "Axel Customer Support",
    description: "Tickets and service requests from your clients.",
    icon: LifeBuoy,
    defaultTo: "/tickets",
    sections: [
      {
        label: "Customer Support",
        icon: LifeBuoy,
        items: [
          { to: "/tickets", label: "Tickets", icon: Ticket },
          { to: "/service-requests", label: "Service requests", icon: ClipboardCheck },
        ],
      },
    ],
  },
  {
    id: "people",
    label: "Axel People",
    description: "HR & payroll: records, attendance and compensation.",
    icon: Users,
    defaultTo: "/team",
    sections: [
      {
        label: "People",
        icon: Users,
        items: [
          { to: "/team", label: "Team", icon: UserCog },
          { to: "/time", label: "Time & Attendance", icon: Clock },
          { to: "/leave", label: "Leave", icon: CalendarDays },
          { to: "/kiosk", label: "Kiosk", icon: KeyRound },
          { to: "/payroll", label: "Payroll", icon: Wallet2 },
        ],
      },
    ],
  },
  {
    id: "integrations",
    label: "Integrations Hub",
    description: "Connect Axel to the tools your team already uses.",
    icon: Plug,
    defaultTo: "/integrations",
    sections: [
      {
        label: "Integrations",
        icon: Plug,
        items: [{ to: "/integrations", label: "Integrations Hub", icon: Plug }],
      },
    ],
  },
];

/** Always available, in every module, pinned at the bottom of the sidebar. */
export const ADMIN_SECTION: NavSection = {
  label: "Administration",
  icon: Building2,
  items: [
    { to: "/companies", label: "Companies", icon: Building2 },
    { to: "/users-access", label: "Users & Access", icon: Users, requireGroupAdmin: true },
    { to: "/settings", label: "Settings", icon: Settings },
    { to: "/about", label: "About", icon: Info },
  ],
};

const matches = (pathname: string, to: string) =>
  pathname === to || pathname.startsWith(`${to}/`);

/** Which module a route belongs to, so deep links land in the right sidebar. */
export function moduleForRoute(pathname: string): AxelModule | undefined {
  for (const mod of MODULES) {
    for (const section of mod.sections) {
      if (section.items.some((item) => matches(pathname, item.to))) return mod;
    }
  }
  return undefined;
}

export const moduleById = (id: string | null | undefined) =>
  MODULES.find((m) => m.id === id);
