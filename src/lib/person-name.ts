/**
 * Person naming rules for dense list views.
 *
 * Tables and boards show only the first name to save horizontal space;
 * detail panels, pickers, dialogs and generated documents keep the full name.
 */

/** First name only. Email fallbacks keep their local part unchanged. */
export function firstName(full?: string | null, fallback = "—"): string {
  const v = (full ?? "").trim();
  if (!v) return fallback;
  if (v.includes("@")) return v.split("@")[0] || fallback;
  return v.split(/\s+/)[0] || fallback;
}
