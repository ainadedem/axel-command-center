/**
 * Madagascar public holidays.
 *
 * Fixed-date holidays plus the movable Christian feasts (Easter Monday,
 * Ascension, Whit Monday) which are public holidays in Madagascar.
 */

export interface HolidaySeed {
  name: string;
  /** yyyy-MM-dd */
  date: string;
  recurring: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** Anonymous Gregorian computus — returns Easter Sunday for the given year. */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

const shift = (base: Date, days: number) =>
  new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

const FIXED: { name: string; month: number; day: number }[] = [
  { name: "Nouvel An", month: 1, day: 1 },
  { name: "Journée des femmes", month: 3, day: 8 },
  { name: "Journée des Martyrs", month: 3, day: 29 },
  { name: "Fête du Travail", month: 5, day: 1 },
  { name: "Fête de l'Indépendance", month: 6, day: 26 },
  { name: "Assomption", month: 8, day: 15 },
  { name: "Toussaint", month: 11, day: 1 },
  { name: "Noël", month: 12, day: 25 },
];

/** Madagascar public holidays for a calendar year. */
export function madagascarHolidays(year: number): HolidaySeed[] {
  const easter = easterSunday(year);
  const movable: HolidaySeed[] = [
    { name: "Lundi de Pâques", date: iso(shift(easter, 1)), recurring: false },
    { name: "Ascension", date: iso(shift(easter, 39)), recurring: false },
    { name: "Lundi de Pentecôte", date: iso(shift(easter, 50)), recurring: false },
  ];
  const fixed: HolidaySeed[] = FIXED.map((f) => ({
    name: f.name,
    date: `${year}-${pad(f.month)}-${pad(f.day)}`,
    recurring: true,
  }));
  return [...fixed, ...movable].sort((a, b) => a.date.localeCompare(b.date));
}
