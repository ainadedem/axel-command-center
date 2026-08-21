/**
 * Client naming rules.
 *
 * Clients may carry an optional short `displayName` (e.g. "Airtel" for
 * "Airtel Madagascar S.A."). Screens that list many rows show the short
 * label; generated documents always keep the full legal name.
 */

export type NamedClient = { name: string; displayName?: string };

/** Short label for tables, boards and pickers. Falls back to the legal name. */
export function clientLabel(c?: NamedClient | null, fallback = "—"): string {
  if (!c) return fallback;
  const short = c.displayName?.trim();
  return short || c.name || fallback;
}

/** Full legal name — used on invoices, quotations and tooltips. */
export function clientLegalName(c?: NamedClient | null, fallback = "—"): string {
  if (!c) return fallback;
  return c.name || fallback;
}

/** Tooltip text: shows the legal name whenever it differs from the label. */
export function clientTitle(c?: NamedClient | null): string | undefined {
  if (!c) return undefined;
  const label = clientLabel(c);
  return label === c.name ? c.name : `${label} — ${c.name}`;
}
