import type { Currency } from "./mock-data";

const UNITS = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
];

const TENS = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];

function underHundred(n: number): string {
  if (n < 17) return UNITS[n];
  if (n < 20) return "dix-" + UNITS[n - 10];

  if (n < 70) {
    const ten = Math.floor(n / 10);
    const unit = n % 10;
    if (unit === 0) return TENS[ten];
    if (unit === 1) return `${TENS[ten]}-et-un`;
    return `${TENS[ten]}-${UNITS[unit]}`;
  }

  if (n < 80) {
    // 70-79: soixante + (10-19)
    const rest = n - 60;
    if (rest === 11) return "soixante-et-onze";
    return "soixante-" + underHundred(rest);
  }

  // 80-99
  if (n === 80) return "quatre-vingts";
  const rest = n - 80;
  if (rest === 0) return "quatre-vingts";
  return "quatre-vingt-" + underHundred(rest);
}

function underThousand(n: number): string {
  if (n < 100) return underHundred(n);

  const hundreds = Math.floor(n / 100);
  const rest = n % 100;

  if (rest === 0) {
    if (hundreds === 1) return "cent";
    return `${UNITS[hundreds]} cents`;
  }

  if (hundreds === 1) return `cent ${underHundred(rest)}`;
  return `${UNITS[hundreds]} cent ${underHundred(rest)}`;
}

function splitThousands(n: number): number[] {
  const parts: number[] = [];
  while (n > 0) {
    parts.push(n % 1000);
    n = Math.floor(n / 1000);
  }
  return parts.length === 0 ? [0] : parts;
}

function integerToFrench(n: number): string {
  if (n === 0) return "zéro";

  const parts = splitThousands(n);
  const labels = ["", "mille", "million", "milliard"];
  const chunks: string[] = [];

  for (let i = parts.length - 1; i >= 0; i--) {
    const value = parts[i];
    if (value === 0) continue;

    const label = labels[i];

    if (i === 1 && value === 1) {
      // "mille" (no "un mille")
      chunks.push("mille");
      continue;
    }

    if (i >= 2 && value === 1) {
      // "un million", "un milliard"
      chunks.push(`un ${label}`);
      continue;
    }

    if (i >= 2) {
      // plural millions/milliards
      chunks.push(`${underThousand(value)} ${label}s`);
      continue;
    }

    if (i === 1) {
      chunks.push(`${underThousand(value)} mille`);
      continue;
    }

    chunks.push(underThousand(value));
  }

  return chunks.join(" ");
}

function currencyName(currency: Currency, plural: boolean): string {
  switch (currency) {
    case "MGA":
      return plural ? "Ariary" : "Ariary";
    case "EUR":
      return plural ? "euros" : "euro";
    case "USD":
      return plural ? "dollars" : "dollar";
    default:
      return currency;
  }
}

/** Convert a monetary amount to its French written form. */
export function amountInFrench(amount: number, currency: Currency = "MGA"): string {
  const abs = Math.abs(amount);
  const integer = Math.floor(abs);
  const cents = Math.round((abs - integer) * 100);

  const unitName = currencyName(currency, integer !== 1);
  let result = `${integerToFrench(integer)} ${unitName}`;

  if (currency !== "MGA" && cents > 0) {
    result += ` et ${integerToFrench(cents)} centime${cents > 1 ? "s" : ""}`;
  }

  return result;
}
