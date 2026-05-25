import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  useCategories, useBudgets, useTransactions, useCompanies,
  categoriesStore, budgetsStore,
  fmtCompact, toMGA, type Category, type Budget, type Currency,
} from "@/lib/mock-data";
import { newId } from "@/lib/data-store";
import { useCompany, inScope } from "@/lib/company-context";
import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CrudToolbar, EmptyState } from "@/components/crud-toolbar";
import { Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/budgets")({ component: BudgetsPage });

function BudgetsPage() {
  return (
    <AppShell>
      <PageHeader title="Budgets" description="Yearly spending plan per category — live tracking against actuals." />
      <Body />
    </AppShell>
  );
}

function Body() {
  const { scope } = useCompany();
  const categories = useCategories();
  const budgets = useBudgets();
  const transactions = useTransactions();
  const companies = useCompanies();

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [openCat, setOpenCat] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);

  const scopedCategories = useMemo(() => inScope(categories, scope), [categories, scope]);
  const scopedTx = useMemo(() => inScope(transactions, scope), [transactions, scope]);

  // Map: categoryId → spent (in MGA, year-scoped)
  const spentByCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of scopedTx) {
      if (!t.categoryId) continue;
      if (t.type !== "expense" && t.type !== "income") continue;
      if (new Date(t.date).getFullYear() !== year) continue;
      m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + toMGA(t.amount, t.currency));
    }
    return m;
  }, [scopedTx, year]);

  const budgetFor = (categoryId: string): Budget | undefined =>
    budgets.find((b) => b.categoryId === categoryId && b.year === year);

  // Year list: every year that has transactions + current year ± 1
  const years = useMemo(() => {
    const set = new Set<number>([currentYear, currentYear - 1, currentYear + 1]);
    for (const t of transactions) set.add(new Date(t.date).getFullYear());
    return [...set].sort((a, b) => b - a);
  }, [transactions, currentYear]);

  // KPI totals (MGA)
  const totals = useMemo(() => {
    let budgetExp = 0, spentExp = 0, budgetInc = 0, earnedInc = 0;
    for (const cat of scopedCategories) {
      const b = budgetFor(cat.id);
      const amt = b ? toMGA(b.amount, b.currency) : 0;
      const spent = spentByCategory.get(cat.id) ?? 0;
      if (cat.kind === "expense") { budgetExp += amt; spentExp += spent; }
      else { budgetInc += amt; earnedInc += spent; }
    }
    return { budgetExp, spentExp, budgetInc, earnedInc };
  }, [scopedCategories, budgets, spentByCategory, year]);

  const openCreateCat = () => { setEditingCat(null); setOpenCat(true); };

  const expenseCats = scopedCategories.filter((c) => c.kind === "expense");
  const incomeCats = scopedCategories.filter((c) => c.kind === "income");

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Year</Label>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <CrudToolbar count={scopedCategories.length} label="categories" onCreate={openCreateCat} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Kpi label="Expense budget" value={totals.budgetExp} sub={`${year} planned`} />
        <Kpi label="Spent so far" value={totals.spentExp} sub={pct(totals.spentExp, totals.budgetExp)} tone={totals.spentExp > totals.budgetExp ? "danger" : "default"} />
        <Kpi label="Income budget" value={totals.budgetInc} sub={`${year} planned`} />
        <Kpi label="Earned so far" value={totals.earnedInc} sub={pct(totals.earnedInc, totals.budgetInc)} tone="success" />
      </div>

      {scopedCategories.length === 0 ? (
        <EmptyState label="categories" onCreate={openCreateCat} />
      ) : (
        <div className="space-y-6">
          <CategorySection
            title="Expense categories"
            cats={expenseCats}
            year={year}
            spentByCategory={spentByCategory}
            companies={companies}
            onEdit={(c) => { setEditingCat(c); setOpenCat(true); }}
          />
          <CategorySection
            title="Income categories"
            cats={incomeCats}
            year={year}
            spentByCategory={spentByCategory}
            companies={companies}
            onEdit={(c) => { setEditingCat(c); setOpenCat(true); }}
          />
        </div>
      )}

      <CategoryDialog open={openCat} onOpenChange={setOpenCat} editing={editingCat} />
    </div>
  );
}

function pct(a: number, b: number) {
  if (b === 0) return a > 0 ? "no budget set" : "—";
  return `${Math.round((a / b) * 100)}% of plan`;
}

function Kpi({ label, value, sub, tone = "default" }: { label: string; value: number; sub: string; tone?: "default" | "success" | "danger" }) {
  return (
    <div className="rounded-xl border border-border bg-[var(--gradient-surface)] p-5">
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={cn(
        "mt-2 font-display text-2xl font-bold tabular-nums",
        tone === "success" && "text-success",
        tone === "danger" && "text-destructive",
      )}>{fmtCompact(value, "MGA")}</div>
      <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}

function CategorySection({
  title, cats, year, spentByCategory, companies, onEdit,
}: {
  title: string;
  cats: Category[];
  year: number;
  spentByCategory: Map<string, number>;
  companies: ReturnType<typeof useCompanies>;
  onEdit: (c: Category) => void;
}) {
  if (cats.length === 0) return null;
  return (
    <section className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden">
      <div className="px-5 py-3 border-b border-border text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {title} · {cats.length}
      </div>
      <div className="divide-y divide-border/40">
        {cats.map((c) => (
          <CategoryRow
            key={c.id}
            cat={c}
            year={year}
            spent={spentByCategory.get(c.id) ?? 0}
            company={companies.find((co) => co.id === c.companyId)}
            onEdit={() => onEdit(c)}
          />
        ))}
      </div>
    </section>
  );
}

function CategoryRow({ cat, year, spent, company, onEdit }: {
  cat: Category;
  year: number;
  spent: number;
  company?: { shortName: string; color: string; baseCurrency: Currency };
  onEdit: () => void;
}) {
  const budgets = useBudgets();
  const existing = budgets.find((b) => b.categoryId === cat.id && b.year === year);
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(existing ? String(existing.amount) : "0");
  const [currency, setCurrency] = useState<Currency>(existing?.currency ?? company?.baseCurrency ?? "MGA");

  useEffect(() => {
    setAmount(existing ? String(existing.amount) : "0");
    setCurrency(existing?.currency ?? company?.baseCurrency ?? "MGA");
  }, [existing, cat.id, year, company]);

  const budgetMGA = existing ? toMGA(existing.amount, existing.currency) : 0;
  const ratio = budgetMGA > 0 ? Math.min(spent / budgetMGA, 1.5) : 0;
  const over = budgetMGA > 0 && spent > budgetMGA;
  const isIncome = cat.kind === "income";

  const saveBudget = () => {
    const amt = Number(amount) || 0;
    if (existing) budgetsStore.update(existing.id, { amount: amt, currency });
    else budgetsStore.add({ id: newId("bud"), companyId: cat.companyId, categoryId: cat.id, year, amount: amt, currency });
    setEditing(false);
  };

  return (
    <div className="px-5 py-4 grid grid-cols-12 gap-4 items-center hover:bg-surface-elevated/40 group">
      <div className="col-span-3 min-w-0">
        <div className="font-medium truncate">{cat.name}</div>
        <div className="text-[11px] text-muted-foreground flex items-center gap-2">
          {company && <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full" style={{ background: company.color }} />{company.shortName}</span>}
          {cat.account && <span className="font-mono">{cat.account}</span>}
        </div>
      </div>

      <div className="col-span-3">
        {editing ? (
          <div className="flex items-center gap-2">
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-8 w-32" />
            <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
              <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MGA">MGA</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={saveBudget}>Save</Button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-left"
          >
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Budget {year}</div>
            <div className="font-tnum font-medium hover:text-primary transition">
              {existing ? fmtCompact(existing.amount, existing.currency) : <span className="text-muted-foreground/60">set budget</span>}
            </div>
          </button>
        )}
      </div>

      <div className="col-span-2">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{isIncome ? "Earned" : "Spent"}</div>
        <div className={cn("font-tnum font-medium", over && !isIncome && "text-destructive", isIncome && spent > 0 && "text-success")}>
          {fmtCompact(spent, "MGA")}
        </div>
      </div>

      <div className="col-span-3">
        {budgetMGA > 0 ? (
          <>
            <div className="h-2 rounded-full bg-surface-elevated overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all",
                  isIncome ? "bg-success" : over ? "bg-destructive" : "bg-primary",
                )}
                style={{ width: `${Math.min(ratio * 100, 100)}%` }}
              />
            </div>
            <div className="text-[11px] mt-1 text-muted-foreground flex justify-between">
              <span>{Math.round((spent / budgetMGA) * 100)}%</span>
              <span className={cn(over && !isIncome && "text-destructive")}>
                {over ? "+" : ""}{fmtCompact(spent - budgetMGA, "MGA")}
              </span>
            </div>
          </>
        ) : (
          <div className="text-[11px] text-muted-foreground italic">No budget set</div>
        )}
      </div>

      <div className="col-span-1 flex justify-end opacity-0 group-hover:opacity-100 gap-1">
        <button onClick={onEdit} className="h-7 w-7 grid place-items-center rounded hover:bg-surface-elevated text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
        <button
          onClick={() => {
            if (!confirm(`Delete category "${cat.name}"? Linked transactions keep the label.`)) return;
            categoriesStore.remove(cat.id);
            // Cascade: remove its budgets
            for (const b of budgetsStore.items.filter((b) => b.categoryId === cat.id)) budgetsStore.remove(b.id);
          }}
          className="h-7 w-7 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function CategoryDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: Category | null }) {
  const companies = useCompanies();
  const [companyId, setCompanyId] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Category["kind"]>("expense");
  const [account, setAccount] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setCompanyId(editing.companyId); setName(editing.name); setKind(editing.kind); setAccount(editing.account ?? "");
    } else {
      setCompanyId(companies[0]?.id ?? ""); setName(""); setKind("expense"); setAccount("");
    }
  }, [open, editing, companies]);

  const submit = () => {
    if (!name.trim() || !companyId) return;
    const data = { companyId, name: name.trim(), kind, account: account.trim() || undefined };
    if (editing) categoriesStore.update(editing.id, data);
    else categoriesStore.add({ id: newId("cat"), ...data });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit category" : "New category"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Company</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Payroll, Rent, Travel…" /></div>
          <div>
            <Label>Kind</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as Category["kind"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="income">Income</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>PCG account (optional)</Label>
            <Input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="e.g. 606100" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>{editing ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
