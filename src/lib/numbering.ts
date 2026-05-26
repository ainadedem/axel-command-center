// Per-company document numbering.
// Infers the writing model (prefix, year/month tokens, padding…) from the
// company's existing documents and increments the trailing sequence.
//
// Examples seen in real data:
//   Axiom invoices:  INV-26-0001  → INV-26-0002
//   Logia invoices:  FAC-LOG/01-26/003 → FAC-LOG/01-26/004
//   Bare prefix:     Q-12345 → Q-12346
import { invoices, quotes, purchaseOrders } from "./mock-data";

export type DocKind = "invoice" | "quote" | "po";

const FALLBACK_PREFIX: Record<DocKind, string> = {
  invoice: "INV",
  quote: "QUO",
  po: "PO",
};

function pool(kind: DocKind, companyId: string): string[] {
  const arr =
    kind === "invoice" ? invoices : kind === "quote" ? quotes : purchaseOrders;
  return arr
    .filter((x) => x.companyId === companyId && typeof x.number === "string" && x.number.trim())
    .map((x) => x.number);
}

/**
 * Returns the next number for the given kind, modelled on the latest existing
 * document of the same kind for that company.
 */
export function nextNumber(kind: DocKind, companyId: string): string {
  const existing = pool(kind, companyId);
  if (existing.length === 0) {
    const yy = String(new Date().getFullYear()).slice(-2);
    return `${FALLBACK_PREFIX[kind]}-${yy}-0001`;
  }

  // Pick the template = the document whose trailing numeric group is largest.
  let best = existing[0];
  let bestN = -1;
  let bestMatch: RegExpMatchArray | null = null;
  for (const n of existing) {
    // Last run of digits anywhere in the string.
    const m = n.match(/(\d+)(?!.*\d)/);
    if (!m) continue;
    const v = parseInt(m[1], 10);
    if (v > bestN) {
      bestN = v;
      best = n;
      bestMatch = m;
    }
  }
  if (!bestMatch) {
    // No digits at all — append -0001.
    return `${best}-0001`;
  }
  const width = bestMatch[1].length;
  const next = String(bestN + 1).padStart(width, "0");
  const idx = bestMatch.index!;
  return best.slice(0, idx) + next + best.slice(idx + bestMatch[1].length);
}
