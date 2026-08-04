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

import type { Company, CompanyBankAccount } from "./mock-data";

/** Company bank accounts, always including a legacy entry when the list is empty. */
export function companyBankAccounts(company?: Company | null): CompanyBankAccount[] {
  const list = company?.bankAccounts ?? [];
  if (list.length > 0) return list;
  if (!company) return [];
  const hasLegacy = Boolean(company.bankName || company.accountNumber || company.iban || company.mobileNumber);
  if (!hasLegacy) return [];
  return [{
    id: "legacy",
    label: company.bankName || "Primary account",
    bankName: company.bankName,
    bankAccount: company.bankAccount,
    bankSwift: company.bankSwift,
    bankHolder: company.bankHolder,
    bankCode: company.bankCode,
    branchCode: company.branchCode,
    accountNumber: company.accountNumber,
    ribKey: company.ribKey,
    iban: company.iban,
    intlEnabled: company.intlEnabled,
    mobileEnabled: company.mobileEnabled,
    mobileProvider: company.mobileProvider,
    mobileNumber: company.mobileNumber,
    mobileName: company.mobileName,
    isDefault: true,
  }];
}

/** The account preselected on new documents. */
export function defaultBankAccount(company?: Company | null): CompanyBankAccount | undefined {
  const list = companyBankAccounts(company);
  return list.find((a) => a.isDefault) ?? list[0];
}

/** Resolve the bank block printed on a document. */
export function resolveBankAccount(company?: Company | null, id?: string): CompanyBankAccount | undefined {
  const list = companyBankAccounts(company);
  return (id ? list.find((a) => a.id === id) : undefined) ?? defaultBankAccount(company);
}
