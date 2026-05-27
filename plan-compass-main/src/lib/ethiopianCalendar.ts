// ─── Ethiopian Fiscal Year (EFY) Utilities ────────────────────────────────────
//
// Ethiopian fiscal year runs from Hamle 1 to Sene 30 (roughly July–June).
// EFY 2016 corresponds approximately to Gregorian 2023/2024.
// Conversion: EFY year = Gregorian year - 7 or - 8 depending on month.
//
// In this app we store fiscal years as strings like "2016 EFY", "2017 EFY", etc.

export const EFY_SUFFIX = " EFY";

/**
 * All available EFY years in the database, ordered newest first.
 * Update this list as new fiscal years are added.
 */
export const AVAILABLE_EFY_YEARS = [
  "2019 EFY",
  "2018 EFY",
  "2017 EFY",
  "2016 EFY",
];

/**
 * The current EFY year based on today's Gregorian date.
 * Ethiopian New Year falls around September 11 (Gregorian).
 * EFY = Gregorian year - 7 (before Sep 11) or Gregorian year - 7 (after Sep 11).
 * Simplified: EFY ≈ Gregorian year - 7.
 */
export function getCurrentEFY(): string {
  const now = new Date();
  const gregorianYear = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12

  // Ethiopian New Year is ~Sep 11. After that, EFY increments.
  // EFY 2016 = Sep 2023 – Sep 2024
  // EFY 2017 = Sep 2024 – Sep 2025
  // EFY 2018 = Sep 2025 – Sep 2026
  const efyYear = month >= 9 ? gregorianYear - 7 : gregorianYear - 8;
  return `${efyYear}${EFY_SUFFIX}`;
}

/**
 * Convert a Gregorian year number to the corresponding EFY string.
 * e.g. 2024 → "2016 EFY", 2025 → "2017 EFY"
 */
export function gregorianToEFY(gregorianYear: number): string {
  const efyYear = gregorianYear - 7;
  return `${efyYear}${EFY_SUFFIX}`;
}

/**
 * Convert an EFY string to approximate Gregorian year (end of fiscal year).
 * e.g. "2016 EFY" → 2024, "2017 EFY" → 2025
 */
export function efyToGregorian(efyString: string): number {
  const match = efyString.match(/(\d{4})/);
  if (!match) return new Date().getFullYear();
  return parseInt(match[1]) + 7;
}

/**
 * Extract the numeric EFY year from an EFY string.
 * e.g. "2016 EFY" → 2016
 */
export function getEFYNumber(efyString: string): number {
  const match = efyString.match(/(\d{4})/);
  return match ? parseInt(match[1]) : 0;
}

/**
 * Format an EFY string for display.
 * e.g. "2016 EFY" → "2016 EFY (2023/24)"
 */
export function formatEFYDisplay(efyString: string): string {
  const efyNum = getEFYNumber(efyString);
  if (!efyNum) return efyString;
  const gregStart = efyNum + 7;
  const gregEnd = (gregStart + 1).toString().slice(-2);
  return `${efyNum} EFY (${gregStart}/${gregEnd})`;
}

/**
 * Normalize an EFY value to the stored fiscal year format.
 * Accepts values like "2016", "2016EFY", "2016 EFY" and returns "2016 EFY".
 */
export function normalizeEFYString(value: string): string {
  const match = value.match(/(\d{4})/);
  if (!match) return value.trim();
  return `${match[1]}${EFY_SUFFIX}`;
}

/**
 * Get the "previous" EFY string.
 * e.g. "2018 EFY" → "2017 EFY"
 */
export function getPreviousEFY(efyString: string): string {
  const efyNum = getEFYNumber(efyString);
  return `${efyNum - 1}${EFY_SUFFIX}`;
}

/**
 * Sort EFY strings newest first.
 */
export function sortEFYDesc(years: string[]): string[] {
  return [...years].sort((a, b) => getEFYNumber(b) - getEFYNumber(a));
}