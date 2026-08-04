import { companyCode, type Company } from "./mock-data";

/** Logia Madagascar only became liable for 20% TVA from April 2026. */
export const LOGIA_VAT_START = "2026-04-01";
export const LOGIA_VAT_RATE = 20;

/**
 * Default tax rate (%) for a new document, based on the issuing company and
 * the document's issue date. Only Logia Madagascar applies TVA, and only for
 * documents dated on or after 1 April 2026.
 */
export function defaultTaxRate(
  company: Pick<Company, "code" | "shortName" | "name"> | null | undefined,
  issueDate: string | undefined,
): number {
  if (!company || !issueDate) return 0;
  const code = companyCode(company).toLowerCase();
  if (code !== "log") return 0;
  return issueDate >= LOGIA_VAT_START ? LOGIA_VAT_RATE : 0;
}
