// Per-company document numbering.
// Infers the writing model (prefix, year/month tokens, padding…) from the
// company's existing documents and increments the trailing sequence.
//
// Examples seen in real data:
//   Axiom invoices:  INV-26-0001  → INV-26-0002
//   Logia invoices:  FAC-LOG/01-26/003 → FAC-LOG/01-26/004
//   Bare prefix:     Q-12345 → Q-12346
import { invoices, quotes, purchaseOrders, companies, companyCode } from "./mock-data";
import { supabase } from "@/integrations/supabase/client";

export type DocKind = "invoice" | "quote" | "po";

const FALLBACK_PREFIX: Record<DocKind, string> = {
  invoice: "INV",
  quote: "QUO",
  po: "PO",
};

/**
 * Numbers a user cannot see locally (sales only load their own quotations) still
 * consume sequence positions, so the full company-wide list is fetched from the
 * database and merged with what is loaded in the app.
 */
const remoteNumbers = new Map<string, string[]>();

const cacheKey = (kind: DocKind, companyId: string) => `${kind}:${companyId}`;

/** Load every existing number for this company/kind, bypassing row visibility. */
export async function primeNumbering(kind: DocKind, companyId: string): Promise<void> {
  if (!companyId) return;
  try {
    const { data, error } = await supabase.rpc("document_numbers", {
      _company_id: companyId,
      _kind: kind,
    });
    if (error) return;
    remoteNumbers.set(cacheKey(kind, companyId), (data ?? []) as string[]);
  } catch {
    // Numbering falls back to locally visible documents.
  }
}

function pool(kind: DocKind, companyId: string): string[] {
  const arr =
    kind === "invoice" ? invoices : kind === "quote" ? quotes : purchaseOrders;
  const local = arr
    .filter((x) => x.companyId === companyId && typeof x.number === "string" && x.number.trim())
    .map((x) => x.number);
  const remote = remoteNumbers.get(cacheKey(kind, companyId)) ?? [];
  return Array.from(new Set([...local, ...remote]));
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
  const takenLocally = arr.some(
    (x) =>
      x.companyId === companyId &&
      x.id !== excludeId &&
      String(x.number ?? "").trim().toLowerCase() === target,
  );
  if (takenLocally) return true;
  // A number can belong to a document the signed-in user is not allowed to see.
  const mine = new Set(
    arr
      .filter((x) => x.companyId === companyId && x.id === excludeId)
      .map((x) => String(x.number ?? "").trim().toLowerCase()),
  );
  if (mine.has(target)) return false;
  return (remoteNumbers.get(cacheKey(kind, companyId)) ?? []).some(
    (n) => n.trim().toLowerCase() === target,
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

/** Highest trailing numeric group across a pool of numbers (0 when empty). */
function highestSequence(existing: string[]): number {
  let best = 0;
  for (const n of existing) {
    const m = n.match(/(\d+)(?!.*\d)/);
    if (m) best = Math.max(best, parseInt(m[1], 10));
  }
  return best;
}

/**
 * Fixed house formats that win over inference.
 * Logia: INV/LOG/MM-YY/NNN (invoices) and DEV/LOG/MM-YY/NNN (quotes),
 * with a continuous 3-digit sequence that never resets.
 */
function formatOverride(
  kind: DocKind,
  companyId: string,
): ((issueDate: string | undefined, seq: number) => string) | null {
  const company = companies.find((c) => c.id === companyId);
  if (!company) return null;
  if (companyCode(company).toLowerCase() !== "log") return null;
  const prefix = kind === "invoice" ? "INV" : kind === "quote" ? "DEV" : null;
  if (!prefix) return null;
  return (issueDate, seq) => {
    const d = issueDate ? new Date(`${issueDate}T00:00:00`) : new Date();
    const date = isNaN(d.getTime()) ? new Date() : d;
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yy = String(date.getFullYear()).slice(-2);
    return `${prefix}/LOG/${mm}-${yy}/${String(seq).padStart(3, "0")}`;
  };
}

/**
 * Returns the next number for the given kind, modelled on the latest existing
 * document of the same kind for that company. Guaranteed not to collide with
 * an existing number.
 */
export function nextNumber(
  kind: DocKind,
  companyId: string,
  issueDate?: string,
): string {
  const existing = pool(kind, companyId);

  const override = formatOverride(kind, companyId);
  if (override) {
    const seq = highestSequence(existing) + 1;
    let candidate = override(issueDate, seq);
    let guard = 0;
    while (isNumberTaken(kind, companyId, candidate) && guard++ < 1000) {
      candidate = bump(candidate);
    }
    return candidate;
  }

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


/** Same as `nextNumber`, but refreshes the company-wide numbers first. */
export async function nextNumberAsync(
  kind: DocKind,
  companyId: string,
  issueDate?: string,
): Promise<string> {
  await primeNumbering(kind, companyId);
  return nextNumber(kind, companyId, issueDate);
}
