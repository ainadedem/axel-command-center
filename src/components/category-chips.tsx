import type { ContactCategory } from "@/lib/mock-data";
import { UserCheck, Truck, Share2, Handshake } from "lucide-react";

export const CATEGORY_META: Record<
  ContactCategory,
  { label: string; cls: string; activeCls: string; icon: React.ComponentType<{ className?: string }> }
> = {
  client:   { label: "Client",   icon: UserCheck, cls: "bg-emerald-500/10 text-emerald-700 border border-emerald-500/25", activeCls: "bg-emerald-500 text-white border-emerald-500" },
  supplier: { label: "Supplier", icon: Truck,     cls: "bg-sky-500/10 text-sky-700 border border-sky-500/25",             activeCls: "bg-sky-500 text-white border-sky-500" },
  referral: { label: "Referral", icon: Share2,    cls: "bg-violet-500/10 text-violet-700 border border-violet-500/25",   activeCls: "bg-violet-500 text-white border-violet-500" },
  partner:  { label: "Partner",  icon: Handshake, cls: "bg-amber-500/10 text-amber-700 border border-amber-500/25",      activeCls: "bg-amber-500 text-white border-amber-500" },
};

export const ALL_CATEGORIES: ContactCategory[] = ["client", "supplier", "referral", "partner"];

/** Read-only chips shown on a card/list row. */
export function CategoryChips({ value, size = "sm" }: { value?: ContactCategory[]; size?: "xs" | "sm" }) {
  if (!value || value.length === 0) return null;
  const text = size === "xs" ? "text-[9px]" : "text-[10px]";
  return (
    <div className="flex flex-wrap items-center gap-1">
      {value.map((c) => {
        const m = CATEGORY_META[c];
        const Icon = m.icon;
        return (
          <span key={c} className={`inline-flex items-center gap-1 ${text} uppercase tracking-wider px-1.5 py-0.5 rounded-full font-semibold ${m.cls}`}>
            <Icon className="h-2.5 w-2.5" />
            {m.label}
          </span>
        );
      })}
    </div>
  );
}

/** Tiny pill showing which company a contact is linked to.
 *  Prefers the compact `code` over the full trading name. */
export function CompanyTag({
  code, name, color, size = "sm",
}: { code?: string | null; name?: string | null; color?: string | null; size?: "xs" | "sm" }) {
  const label = (code || name || "").trim();
  if (!label) return null;
  const text = size === "xs" ? "text-[9px]" : "text-[10px]";
  return (
    <span
      className={`inline-flex items-center gap-1 ${text} uppercase tracking-wider px-1.5 py-0.5 rounded-full font-mono font-semibold border border-border bg-surface text-muted-foreground`}
      title={name ? `Linked to ${name}` : undefined}
    >
      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: color ?? "var(--muted-foreground)" }} />
      <span>{label}</span>
    </span>
  );
}

/** Row of CompanyTag pills, one per linked company. */
export function CompanyTags({
  ids, companies, size = "sm",
}: {
  ids: string[];
  companies: { id: string; code?: string; shortName?: string; name?: string; color?: string }[];
  size?: "xs" | "sm";
}) {
  if (!ids || ids.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {ids.map((id) => {
        const c = companies.find((x) => x.id === id);
        if (!c) return null;
        return <CompanyTag key={id} code={c.code} name={c.name} color={c.color} size={size} />;
      })}
    </div>
  );
}

/** Multi-select toggle pills, used in create/edit dialogs. */
export function CategoryMultiSelect({
  value, onChange,
}: { value: ContactCategory[]; onChange: (v: ContactCategory[]) => void }) {
  const toggle = (c: ContactCategory) => {
    const next = value.includes(c) ? value.filter((x) => x !== c) : [...value, c];
    onChange(next);
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {ALL_CATEGORIES.map((c) => {
        const m = CATEGORY_META[c];
        const Icon = m.icon;
        const on = value.includes(c);
        return (
          <button
            key={c}
            type="button"
            onClick={() => toggle(c)}
            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium transition ${on ? m.activeCls : "bg-transparent text-muted-foreground border border-border hover:bg-surface-elevated"}`}
          >
            <Icon className="h-3 w-3" />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

/** Filter toolbar: tabs to filter by category. "All" returns null. */
export function CategoryFilterTabs({
  value, onChange, counts,
}: { value: ContactCategory | "all"; onChange: (v: ContactCategory | "all") => void; counts: Record<ContactCategory | "all", number> }) {
  const tabs: Array<ContactCategory | "all"> = ["all", ...ALL_CATEGORIES];
  return (
    <div className="inline-flex rounded-md border border-border overflow-hidden text-xs">
      {tabs.map((t, i) => {
        const on = value === t;
        const label = t === "all" ? "All" : CATEGORY_META[t].label;
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            className={`px-3 py-1.5 ${i > 0 ? "border-l border-border" : ""} ${on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-elevated"}`}
          >
            {label}
            <span className="ml-1.5 text-[10px] opacity-70 font-tnum">{counts[t]}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Auto-tag helper: returns the default category for an existing record. */
export function defaultCategoriesFor(source: "client" | "supplier", current?: ContactCategory[]): ContactCategory[] {
  if (current && current.length > 0) return current;
  return [source];
}
