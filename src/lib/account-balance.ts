import { useMemo } from "react";
import { useTransactions, type Account, type Transaction } from "@/lib/mock-data";

export interface AccountBalance {
  /** Verified starting point. */
  opening: number;
  /** Sum of ledger movements counted after the opening date. */
  movements: number;
  /** opening + movements — the number to display. */
  computed: number;
  /** Number of transactions counted. */
  txCount: number;
}

export function openingOf(a: Account): number {
  return a.openingBalance ?? a.balance ?? 0;
}

/** Ledger movements on an account, counted from its opening balance date. */
export function accountMovements(a: Account, txs: Transaction[]): { total: number; count: number } {
  const from = a.openingBalanceDate;
  let total = 0;
  let count = 0;
  for (const t of txs) {
    if (t.accountId !== a.id) continue;
    if (from && t.date < from) continue;
    total += t.type === "income" ? t.amount : -t.amount;
    count++;
  }
  return { total, count };
}

export function computeAccountBalance(a: Account, txs: Transaction[]): AccountBalance {
  const opening = openingOf(a);
  const { total, count } = accountMovements(a, txs);
  return { opening, movements: total, computed: opening + total, txCount: count };
}

/** Reactive computed balances for a list of accounts, keyed by account id. */
export function useAccountBalances(accounts: Account[]): Map<string, AccountBalance> {
  const txs = useTransactions();
  return useMemo(() => {
    const map = new Map<string, AccountBalance>();
    for (const a of accounts) map.set(a.id, computeAccountBalance(a, txs));
    return map;
  }, [accounts, txs]);
}
