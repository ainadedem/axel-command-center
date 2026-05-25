import React from "react";

/**
 * Financial UX helper.
 * Renders a pre-formatted money string colored by the sign of `value`:
 *  - positive → text-success (green)
 *  - negative → text-destructive (red)
 *  - zero     → neutral (inherits color)
 *
 * Use this for any value where the sign carries financial meaning
 * (net P&L, variance, balance, profit, écart, etc.).
 */
export function SignedAmount({
  value,
  formatted,
  className = "",
  neutralZero = true,
}: {
  value: number;
  formatted: React.ReactNode;
  className?: string;
  neutralZero?: boolean;
}) {
  const tone =
    value > 0
      ? "text-success"
      : value < 0
        ? "text-destructive"
        : neutralZero
          ? ""
          : "text-success";
  return <span className={`${tone} ${className}`.trim()}>{formatted}</span>;
}

export const signClass = (n: number) =>
  n > 0 ? "text-success" : n < 0 ? "text-destructive" : "";
