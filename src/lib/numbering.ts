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

/** True when another document of the same kind already uses this number. */
export function isNumberTaken(
  kind: DocKind,
  companyId: string,
  number: string,
  excludeId?: string,
): boolean {
  const arr =
    kind === "invoice" ? invoices : kind === "quote" ? quotes : purchaseOrders;
  const target = number.trim().toLowerCase();
  if (!target) return false;
  return arr.some(
    (x) =>
      x.companyId === companyId &&
      x.id !== excludeId &&
      String(x.number ?? "").trim().toLowerCase() === target,
  );
}

/** Increment the trailing digit group of a document number. */
function bump(n: string): string {
  const m = n.match(/(\d+)(?!.*\d)/);
  if (!m) return `${n}-0001`;
  const width = m[1].length;
  const next = String(parseInt(m[1], 10) + 1).padStart(width, "0");
  const idx = m.index!;
  return n.slice(0, idx) + next + n.slice(idx + m[1].length);
}

/**
 * Returns the next number for the given kind, modelled on the latest existing
 * document of the same kind for that company. Guaranteed not to collide with
 * an existing number.
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
  for (const n of existing) {
    const m = n.match(/(\d+)(?!.*\d)/);
    if (!m) continue;
    const v = parseInt(m[1], 10);
    if (v > bestN) {
      bestN = v;
      best = n;
    }
  }

  let candidate = bump(best);
  let guard = 0;
  while (isNumberTaken(kind, companyId, candidate) && guard++ < 1000) {
    candidate = bump(candidate);
  }
  return candidate;
}

