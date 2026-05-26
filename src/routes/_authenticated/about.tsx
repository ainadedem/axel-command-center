import { createFileRoute } from "@tanstack/react-router";
import {
  Sparkles, Shield, Building2, Wallet, ArrowLeftRight, FileText,
  Users, Briefcase, TrendingUp, BarChart3, Target, CreditCard,
  Repeat, Wallet2, Truck, Handshake, UserCog, BookOpen, BookText,
  Scale, Library, Receipt, FileSignature, ClipboardList, Globe,
  Zap, Lock, Server, Cpu, Code, Heart, ExternalLink,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/about")({
  component: AboutPage,
});

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 hover:bg-accent/40 transition">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function AboutPage() {
  return (
    <div className="space-y-8 p-6 max-w-4xl mx-auto">
      <PageHeader
        title="About AXEL"
        subtitle="Unified Business Platform — ERP, CRM & Accounting for modern organisations"
      />

      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-chart-2/5 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">What is AXEL?</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              AXEL is a premium, multi-company, multi-currency enterprise resource planning (ERP)
              platform designed for modern businesses. It unifies finance, customer relationship
              management (CRM), operations, and full French-compliant accounting (Plan Comptable,
              Journal, Grand-Livre, Balance, Bilan, Compte de Résultat) into one cohesive workspace.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Built with real-world business complexity in mind, AXEL supports multi-entity groups,
              role-based access control, live FX rate tracking, and AI-powered assistance — all
              within a clean, fast, responsive interface.
            </p>
          </div>
        </div>
      </div>

      <Section title="Modules & Capabilities">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={Wallet}
            title="Accounts"
            description="Manage multi-currency bank accounts, cash positions, and reconcile statements automatically."
          />
          <FeatureCard
            icon={ArrowLeftRight}
            title="Transactions"
            description="Record, categorise, and search every financial movement across all group entities."
          />
          <FeatureCard
            icon={FileSignature}
            title="Quotations"
            description="Create professional quotes, track approval status, and convert them seamlessly into invoices."
          />
          <FeatureCard
            icon={ClipboardList}
            title="Purchase Orders"
            description="Raise, approve, and monitor POs from request to goods receipt."
          />
          <FeatureCard
            icon={FileText}
            title="Invoices"
            description="Generate compliant invoices with automatic numbering, PDF preview, and payment tracking."
          />
          <FeatureCard
            icon={Target}
            title="Budgets"
            description="Set category-level budgets, track burn rates, and compare actuals vs. planned spend."
          />
          <FeatureCard
            icon={BarChart3}
            title="Reports"
            description="Interactive dashboards and downloadable reports for financial performance and trends."
          />
          <FeatureCard
            icon={Users}
            title="Clients"
            description="Centralised client database with contact history, opportunity linkage, and enrichment."
          />
          <FeatureCard
            icon={Truck}
            title="Suppliers"
            description="Track vendor details, payment terms, and linked purchase history."
          />
          <FeatureCard
            icon={TrendingUp}
            title="Pipeline"
            description="Visual sales pipeline with stage management, probability weighting, and forecasting."
          />
          <FeatureCard
            icon={CreditCard}
            title="Expenses"
            description="Employee expense claims with receipt upload, approval workflows, and reimbursement tracking."
          />
          <FeatureCard
            icon={Repeat}
            title="Billing"
            description="Recurring billing schedules with automated invoice generation and reminders."
          />
          <FeatureCard
            icon={Wallet2}
            title="Payroll"
            description="Salary runs, social contributions, and payslip generation aligned with local regulations."
          />
          <FeatureCard
            icon={Building2}
            title="Companies"
            description="Multi-company architecture with per-entity branding, currencies, and admin controls."
          />
          <FeatureCard
            icon={UserCog}
            title="Team"
            description="Directory of employees, roles, departments, and reporting lines."
          />
          <FeatureCard
            icon={Handshake}
            title="Sales Team"
            description="Commission structures, target tracking, and performance leaderboards."
          />
          <FeatureCard
            icon={Briefcase}
            title="Projects"
            description="Project-based cost tracking, time allocation, and profitability analysis."
          />
          <FeatureCard
            icon={Library}
            title="Plan Comptable"
            description="Complete French standard chart of accounts (PCG) with multi-level hierarchy."
          />
          <FeatureCard
            icon={BookOpen}
            title="Journal"
            description="General journal with automated numbering, attachment support, and period closing."
          />
          <FeatureCard
            icon={BookText}
            title="Grand-Livre"
            description="Ledger view with account balances, debit/credit totals, and drill-down to entries."
          />
          <FeatureCard
            icon={Scale}
            title="Balance"
            description="Trial balance with automatic balancing checks and variance analysis."
          />
          <FeatureCard
            icon={Receipt}
            title="Bilan"
            description="Balance-sheet generation with asset, liability, and equity summaries."
          />
        </div>
      </Section>

      <Section title="Platform Highlights">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
            <Globe className="mt-0.5 h-5 w-5 shrink-0 text-chart-2" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">Multi-Currency & FX</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Built-in live exchange rates (EUR, USD vs. MGA) with automatic conversion and
                historical tracking. Every transaction records both local and functional currency.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
            <Shield className="mt-0.5 h-5 w-5 shrink-0 text-chart-2" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">Role-Based Access</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Granular permissions per user and per company. Group admin, company admin, and
                standard user roles with scoped data visibility enforced at the row level.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
            <Zap className="mt-0.5 h-5 w-5 shrink-0 text-chart-2" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">AI Assistant — Axel AI</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Conversational AI embedded directly in the platform. Ask about balances, generate
                reports, draft emails, or get accounting guidance without leaving the app.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
            <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-chart-2" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">Multi-Company Groups</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Operate across an unlimited number of legal entities. Switch context instantly,
                compare group-wide KPIs, or drill into a single subsidiary with one click.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-chart-2" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">Security & Compliance</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                JWT-based authentication with secure session management, RLS-protected data,
                audit-ready logs, and SOC-2 aligned infrastructure.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
            <Server className="mt-0.5 h-5 w-5 shrink-0 text-chart-2" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">Cloud-Native Architecture</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Edge-deployed serverless functions, global CDN, automatic scaling, and zero-downtime
                updates. Your data is replicated and backed up in real time.
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Technology Stack">
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            AXEL is built on modern, battle-tested technologies chosen for performance, type safety,
            and developer velocity:
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3">
              <Cpu className="h-5 w-5 text-primary" />
              <div>
                <div className="text-sm font-medium text-foreground">React 19</div>
                <div className="text-xs text-muted-foreground">UI layer with concurrent features</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Code className="h-5 w-5 text-primary" />
              <div>
                <div className="text-sm font-medium text-foreground">TypeScript</div>
                <div className="text-xs text-muted-foreground">End-to-end type safety</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-primary" />
              <div>
                <div className="text-sm font-medium text-foreground">TanStack Start</div>
                <div className="text-xs text-muted-foreground">Full-stack React framework with SSR</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Server className="h-5 w-5 text-primary" />
              <div>
                <div className="text-sm font-medium text-foreground">Cloud Backend</div>
                <div className="text-xs text-muted-foreground">Managed PostgreSQL, Auth & Storage</div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Getting Help">
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Need assistance? Here is how to reach us:
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-primary" />
              <span>
                Product feedback and feature requests are always welcome — use the in-app chat or
                email <span className="text-foreground font-medium">support@weaxiom.com</span>
              </span>
            </li>
            <li className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-primary" />
              <span>
                Documentation, API references, and release notes are published at{" "}
                <a
                  href="https://axel.weaxiom.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  axel.weaxiom.com
                </a>
              </span>
            </li>
            <li className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <span>
                Security disclosures: please email{" "}
                <span className="text-foreground font-medium">security@weaxiom.com</span>{" "}
                with responsible disclosure details.
              </span>
            </li>
          </ul>
        </div>
      </Section>

      <div className="rounded-xl border border-border bg-gradient-to-r from-primary/5 via-chart-2/5 to-chart-4/5 p-5 text-center">
        <p className="text-sm font-medium text-foreground">AXEL — Built with care for modern businesses</p>
        <p className="mt-1 text-xs text-muted-foreground">
          © {new Date().getFullYear()} WeAxiom. All rights reserved.
        </p>
      </div>
    </div>
  );
}
