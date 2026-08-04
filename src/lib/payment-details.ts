/** Formats the 23-digit Madagascar RIB into 4 clean groups. */
export function formatRib(
  bankCode?: string,
  branchCode?: string,
  accountNumber?: string,
  ribKey?: string,
): string {
  const parts = [bankCode, branchCode, accountNumber, ribKey]
    .map((p) => String(p ?? "").replace(/\D/g, ""))
    .filter(Boolean);
  if (parts.length < 4) return "";
  return parts.join(" ");
}
