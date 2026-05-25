import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { pcgAccounts, classNames, type PcgClass } from "@/lib/pcg";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/plan-comptable")({ component: PlanComptablePage });

function PlanComptablePage() {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q
    ? pcgAccounts.filter((a) => a.code.startsWith(q) || a.name.toLowerCase().includes(q))
    : pcgAccounts;

  const byClass = new Map<PcgClass, typeof pcgAccounts>();
  filtered.forEach((a) => {
    if (!byClass.has(a.class)) byClass.set(a.class, []);
    byClass.get(a.class)!.push(a);
  });

  return (
    <AppShell>
      <PageHeader
        title="Plan comptable"
        description="PCG Madagascar 2005 — cohérent avec les normes IAS/IFRS. Décret n°2004-272."
      />
      <div className="p-8 space-y-5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Recherche par code ou libellé (ex. 411, TVA, salaires)…"
          className="w-full max-w-md h-10 px-3 rounded-md bg-surface border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />

        {([1, 2, 3, 4, 5, 6, 7] as PcgClass[]).map((cls) => {
          const list = byClass.get(cls);
          if (!list?.length) return null;
          return (
            <div key={cls} className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Classe {cls}</div>
                  <div className="font-display text-lg font-semibold">{classNames[cls]}</div>
                </div>
                <div className="text-xs text-muted-foreground">{list.length} comptes</div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="text-left font-medium px-5 py-2 w-28">Code</th>
                    <th className="text-left font-medium px-5 py-2">Libellé</th>
                    <th className="text-left font-medium px-5 py-2 w-32">Nature</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((a) => (
                    <tr key={a.code} className="border-b border-border/40 last:border-0 hover:bg-surface-elevated/50">
                      <td className="px-5 py-2.5 font-tnum">
                        <span className={a.parent ? "text-muted-foreground pl-4" : "font-semibold"}>{a.code}</span>
                      </td>
                      <td className="px-5 py-2.5">{a.name}</td>
                      <td className="px-5 py-2.5 text-xs uppercase tracking-wider text-muted-foreground">{a.nature}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
