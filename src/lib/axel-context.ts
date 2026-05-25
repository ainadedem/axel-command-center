import {
  companies,
  clients,
  suppliers,
  projects,
  transactions,
  invoices,
  opportunities,
  budgets,
} from "./mock-data";

/**
 * Build a compact textual snapshot of the user's financial data
 * to send as context to Axel AI (CFO analyst).
 * Keep it small — model context cost matters.
 */
export function buildAxelDataSnapshot(scope: { companyId?: string }): string {
  const cId = scope.companyId;
  const filt = <T extends { companyId?: string }>(arr: T[]) =>
    cId ? arr.filter((x) => x.companyId === cId) : arr;

  const cos = cId ? companies.filter((c) => c.id === cId) : companies;
  const tx = filt(transactions);
  const inv = filt(invoices);
  const cls = filt(clients);
  const sup = filt(suppliers);
  const prj = filt(projects);
  const opps = filt(opportunities);
  const bud = filt(budgets);

  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

  // Aggregate transactions by month/type
  const byMonth: Record<string, { in: number; out: number }> = {};
  for (const t of tx) {
    const m = String((t as { date?: string }).date ?? "").slice(0, 7);
    if (!m) continue;
    byMonth[m] ??= { in: 0, out: 0 };
    const amt = Number((t as { amount?: number }).amount ?? 0);
    const type = (t as { type?: string }).type;
    if (type === "income" || amt > 0) byMonth[m].in += Math.abs(amt);
    else byMonth[m].out += Math.abs(amt);
  }
  const monthsSorted = Object.keys(byMonth).sort().slice(-12);
  const cashflow = monthsSorted
    .map((m) => `${m}: +${Math.round(byMonth[m].in).toLocaleString()} / -${Math.round(byMonth[m].out).toLocaleString()}`)
    .join("\n  ");

  // Invoices summary
  const paid = inv.filter((i) => (i as { paid?: boolean }).paid);
  const unpaid = inv.filter((i) => !(i as { paid?: boolean }).paid);
  const invAmt = (i: unknown) => Number((i as { amount?: number; total?: number }).amount ?? (i as { total?: number }).total ?? 0);
  const today = new Date().toISOString().slice(0, 10);
  const overdue = unpaid.filter((i) => {
    const d = (i as { dueDate?: string }).dueDate;
    return d && d < today;
  });

  // Top clients by invoiced amount
  const byClient: Record<string, number> = {};
  for (const i of inv) {
    const cid = (i as { clientId?: string }).clientId ?? "?";
    byClient[cid] = (byClient[cid] ?? 0) + invAmt(i);
  }
  const clientName = (id: string) => cls.find((c) => c.id === id)?.name ?? id;
  const topClients = Object.entries(byClient)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, v]) => `${clientName(id)}: ${Math.round(v).toLocaleString()}`)
    .join("; ");

  const lines = [
    `Scope: ${cId ? cos[0]?.name ?? cId : "All companies (group)"}`,
    `Currency base: ${cos[0]?.baseCurrency ?? "MGA"}`,
    `Companies: ${cos.length} | Clients: ${cls.length} | Suppliers: ${sup.length} | Projects: ${prj.length}`,
    `Opportunities: ${opps.length} | Budget lines: ${bud.length}`,
    ``,
    `Invoices: total ${inv.length} | paid ${paid.length} (${Math.round(sum(paid.map(invAmt))).toLocaleString()}) | unpaid ${unpaid.length} (${Math.round(sum(unpaid.map(invAmt))).toLocaleString()}) | overdue ${overdue.length}`,
    `Top 5 clients by revenue: ${topClients || "n/a"}`,
    ``,
    `Cash flow last 12 months (in / out):`,
    `  ${cashflow || "n/a"}`,
  ];
  return lines.join("\n");
}
