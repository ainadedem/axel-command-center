/**
 * Stable per-client colour coding.
 *
 * Every client gets a colour so rows and Kanban cards can be scanned by
 * client at a glance. A client may store an explicit override; otherwise the
 * colour is derived deterministically from its id, so the same client always
 * looks the same on every screen and every device.
 *
 * Colour is decorative only — status meaning always stays in the badges.
 */

/** Curated palette that stays legible on both light and dark surfaces. */
export const CLIENT_PALETTE = [
  "#0B57D1", // blue
  "#00639B", // cerulean
  "#0F7B6C", // teal
  "#1E8E3E", // green
  "#7A8B00", // olive
  "#B06000", // amber
  "#C5221F", // red
  "#B3261E", // brick
  "#9334E6", // purple
  "#6D4AFF", // indigo
  "#A8177B", // magenta
  "#00796B", // deep teal
  "#8E5B00", // bronze
  "#3B6EA5", // steel
  "#7B1FA2", // violet
  "#4E6C50", // moss
] as const;

const hash = (value: string) => {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};

/** Resolves the colour of a client: explicit override, else deterministic. */
export function clientColor(client?: { id?: string; color?: string; name?: string } | null): string {
  if (!client) return "var(--muted-foreground)";
  if (client.color && /^#[0-9a-f]{3,8}$/i.test(client.color)) return client.color;
  const seed = client.id || client.name || "client";
  return CLIENT_PALETTE[hash(seed) % CLIENT_PALETTE.length];
}

/** A very light tint of the client colour, for chips and card backgrounds. */
export function clientTint(color: string, pct = 12): string {
  return `color-mix(in oklab, ${color} ${pct}%, transparent)`;
}
