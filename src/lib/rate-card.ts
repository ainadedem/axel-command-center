// AXEL rate card — derived from the Publicis ERP rate-card template.
// Defines annual salaries by Capability × Level (MGA), then computes
// fully-loaded hourly / day rates using the standard chain:
//   staff_cost = salary * (1 + benefits)
//   loaded    = staff_cost * (1 + overhead)
//   fee       = loaded / (1 - margin)
//   hourly    = fee / annualHours
//   daily     = fee / annualDays
import { FX, type Currency } from "./mock-data";

export type Capability = "CREATIVE" | "PR" | "PRODUCTION" | "MEDIA";
export const capabilities: Capability[] = ["CREATIVE", "PR", "PRODUCTION", "MEDIA"];

export type Level =
  | "P1" | "P2" | "P3" | "P4" | "P5"
  | "P6" | "P7" | "P8" | "P9" | "P10";

export const levels: { code: Level; title: string }[] = [
  { code: "P1",  title: "Executive (MD/President/CEO)" },
  { code: "P2",  title: "EVP" },
  { code: "P3",  title: "SVP" },
  { code: "P4",  title: "VP / Group Director" },
  { code: "P5",  title: "Director" },
  { code: "P6",  title: "Associate Director" },
  { code: "P7",  title: "Manager" },
  { code: "P8",  title: "Senior Associate" },
  { code: "P9",  title: "Associate" },
  { code: "P10", title: "Junior" },
];

// Annual salaries in MGA (from template, all capabilities share base scale).
export const annualSalaryMGA: Record<Level, number> = {
  P1:  156_000_000,
  P2:  138_000_000,
  P3:  115_000_000,
  P4:   95_000_000,
  P5:   80_000_000,
  P6:   65_000_000,
  P7:   52_000_000,
  P8:   40_000_000,
  P9:   32_000_000,
  P10:  24_000_000,
};

export interface RateCardParams {
  benefits: number;     // e.g. 0.35
  overhead: number;     // e.g. 0.70
  margin: number;       // e.g. 0.15
  annualHours: number;  // e.g. 1760
  annualDays: number;   // e.g. 218
}

export const defaultRateParams: RateCardParams = {
  benefits: 0.35,
  overhead: 0.70,
  margin: 0.15,
  annualHours: 1760,
  annualDays: 218,
};

/** Compute hourly + day rate (in MGA) for a level + params. */
export function computeRateMGA(level: Level, p: RateCardParams = defaultRateParams) {
  const salary = annualSalaryMGA[level];
  const loaded = salary * (1 + p.benefits) * (1 + p.overhead);
  const fee = loaded / (1 - p.margin);
  return {
    hourly: Math.round(fee / p.annualHours),
    daily: Math.round(fee / p.annualDays),
  };
}

/** Convert an MGA rate into the target currency using the project FX table. */
export function rateInCurrency(mga: number, currency: Currency) {
  return Math.round(mga / FX[currency]);
}

export type Unit = "hour" | "day";

/** Full rate lookup helper used by quote line editors. */
export function getRate(level: Level, unit: Unit, currency: Currency, p?: RateCardParams) {
  const { hourly, daily } = computeRateMGA(level, p);
  const mga = unit === "hour" ? hourly : daily;
  return rateInCurrency(mga, currency);
}
