/**
 * Data Validation & Filtering Utility
 * Ensures strict context-aware data filtering with zero-data enforcement
 */

import type { MonthlyEntry, Indicator } from "@/data/hospitalIndicators";
import { MONTHS } from "@/data/hospitalIndicators";

export interface DataValidationResult {
  hasData: boolean;
  dataType: "complete" | "missing" | "zero";
  message: string;
  entries: MonthlyEntry[];
}

export interface PeriodRange {
  startMonth: number;
  endMonth: number;
  monthCount: number;
}

/**
 * Get month index from month name (e.g., "Hamle (Nov)" => 0)
 */
export function getMonthIndex(monthName: string): number {
  return MONTHS.indexOf(monthName);
}

/**
 * Get period date range (month indices)
 */
export function getPeriodRange(
  period: "monthly" | "quarterly" | "semiannual" | "annual",
  monthIndex: number = 0
): PeriodRange {
  switch (period) {
    case "monthly":
      return { startMonth: monthIndex, endMonth: monthIndex, monthCount: 1 };
    case "quarterly":
      const quarterStart = Math.floor(monthIndex / 3) * 3;
      return { startMonth: quarterStart, endMonth: quarterStart + 2, monthCount: 3 };
    case "semiannual":
      const semiStart = Math.floor(monthIndex / 6) * 6;
      return { startMonth: semiStart, endMonth: semiStart + 5, monthCount: 6 };
    case "annual":
      return { startMonth: 0, endMonth: 11, monthCount: 12 };
  }
}

/**
 * Get all months in a period
 */
export function getMonthsInPeriod(
  period: "monthly" | "quarterly" | "semiannual" | "annual",
  monthIndex: number = 0
): string[] {
  const range = getPeriodRange(period, monthIndex);
  const months: string[] = [];
  for (let i = range.startMonth; i <= range.endMonth; i++) {
    months.push(MONTHS[i]);
  }
  return months;
}

/**
 * Validate data existence for a specific indicator in a specific period
 * Distinguishes between "Zero Performance" and "Missing Data"
 */
export function validateIndicatorData(
  indicator: Indicator,
  monthlyData: MonthlyEntry[],
  period: "monthly" | "quarterly" | "semiannual" | "annual",
  monthIndex: number = 0
): DataValidationResult {
  const periodMonths = getMonthsInPeriod(period, monthIndex);
  const relevantEntries = monthlyData.filter(
    (entry) => entry.code === indicator.code && periodMonths.includes(entry.month)
  );

  // No entries submitted at all for this period
  if (relevantEntries.length === 0) {
    return {
      hasData: false,
      dataType: "missing",
      message: `No data entry recorded for ${period} in selected timeframe`,
      entries: [],
    };
  }

  // Check if all entries are null/undefined (missing data)
  const validEntries = relevantEntries.filter((e) => e.actual !== null && e.actual !== undefined);
  if (validEntries.length === 0) {
    return {
      hasData: false,
      dataType: "missing",
      message: `Data not submitted for ${indicator.indicator} in selected period`,
      entries: [],
    };
  }

  // Calculate actual performance
  const totalActual = validEntries.reduce((sum, e) => sum + (e.actual ?? 0), 0);

  // Zero performance (data exists but value is 0)
  if (totalActual === 0 && validEntries.length > 0) {
    return {
      hasData: true,
      dataType: "zero",
      message: `Zero performance recorded for ${indicator.indicator} (${validEntries.length} months reported)`,
      entries: validEntries,
    };
  }

  // Complete valid data
  return {
    hasData: true,
    dataType: "complete",
    message: `Data available: ${totalActual} (${validEntries.length} months)`,
    entries: validEntries,
  };
}

/**
 * Validate data for multiple indicators (department/program area)
 */
export function validateDepartmentData(
  departmentIndicators: Indicator[],
  monthlyData: MonthlyEntry[],
  period: "monthly" | "quarterly" | "semiannual" | "annual",
  monthIndex: number = 0
): {
  allValid: boolean;
  completeCount: number;
  missingCount: number;
  zeroCount: number;
  validationResults: Map<string, DataValidationResult>;
} {
  const validationResults = new Map<string, DataValidationResult>();
  let completeCount = 0;
  let missingCount = 0;
  let zeroCount = 0;

  departmentIndicators.forEach((ind) => {
    const result = validateIndicatorData(ind, monthlyData, period, monthIndex);
    validationResults.set(ind.code, result);

    if (result.dataType === "complete") completeCount++;
    else if (result.dataType === "zero") zeroCount++;
    else missingCount++;
  });

  return {
    allValid: missingCount === 0,
    completeCount,
    missingCount,
    zeroCount,
    validationResults,
  };
}

/**
 * Get data entries for a specific period (filtered by time range)
 */
export function getDataByPeriod(
  monthlyData: MonthlyEntry[],
  indicatorCode: string,
  period: "monthly" | "quarterly" | "semiannual" | "annual",
  monthIndex: number = 0
): MonthlyEntry[] {
  const periodMonths = getMonthsInPeriod(period, monthIndex);
  return monthlyData.filter(
    (entry) => entry.code === indicatorCode && periodMonths.includes(entry.month)
  );
}

/**
 * Calculate actual value for a specific period
 * Returns null if no data exists
 */
export function getActualByPeriod(
  monthlyData: MonthlyEntry[],
  indicatorCode: string,
  period: "monthly" | "quarterly" | "semiannual" | "annual",
  monthIndex: number = 0
): number | null {
  const entries = getDataByPeriod(monthlyData, indicatorCode, period, monthIndex);
  const validEntries = entries.filter((e) => e.actual !== null && e.actual !== undefined);

  if (validEntries.length === 0) return null;
  return validEntries.reduce((sum, e) => sum + (e.actual ?? 0), 0);
}

/**
 * Check if ALL indicators in a department have valid data for a period
 */
export function shouldGenerateFeedback(
  departmentIndicators: Indicator[],
  monthlyData: MonthlyEntry[],
  period: "monthly" | "quarterly" | "semiannual" | "annual",
  monthIndex: number = 0,
  minCompletionThreshold: number = 0.8 // 80% of indicators must have data
): {
  shouldGenerate: boolean;
  completionPercentage: number;
  reason: string;
} {
  const validation = validateDepartmentData(departmentIndicators, monthlyData, period, monthIndex);
  const completionPercentage = validation.completeCount / departmentIndicators.length;

  if (completionPercentage < minCompletionThreshold) {
    return {
      shouldGenerate: false,
      completionPercentage,
      reason: `Insufficient data: Only ${validation.completeCount}/${departmentIndicators.length} indicators have valid data (${Math.round(completionPercentage * 100)}%). 
Ensure all required indicators are entered before generating analysis.`,
    };
  }

  if (validation.missingCount > 0) {
    return {
      shouldGenerate: true,
      completionPercentage,
      reason: `Warning: ${validation.missingCount} indicator(s) have missing data. Analysis includes only valid entries.`,
    };
  }

  return {
    shouldGenerate: true,
    completionPercentage: 1.0,
    reason: "All data validated successfully",
  };
}

/**
 * Get empty state message for missing data
 */
export function getEmptyStateMessage(
  context: "indicator" | "department" | "period",
  period?: string,
  name?: string
): string {
  const periodText = period ? ` for the selected ${period}` : "";
  const nameText = name ? ` (${name})` : "";

  switch (context) {
    case "indicator":
      return `📋 No Entry Recorded${nameText}${periodText}\n\nPlease ensure the indicator data has been submitted.`;
    case "department":
      return `📋 No Data Found${nameText}${periodText}\n\nPlease ensure all required indicators have been entered for this department.`;
    case "period":
      return `📋 No Data Available${nameText}${periodText}\n\nPlease select a period with submitted data or ensure data entry is completed first.`;
    default:
      return "No data available";
  }
}

/**
 * Format validation message for user display
 */
export function formatValidationMessage(validation: DataValidationResult): string {
  switch (validation.dataType) {
    case "complete":
      return `✓ Data validated (${validation.entries.length} entries)`;
    case "zero":
      return `⚠ Zero Performance (${validation.entries.length} entries recorded)`;
    case "missing":
      return `✗ No Data Submitted`;
    default:
      return validation.message;
  }
}
