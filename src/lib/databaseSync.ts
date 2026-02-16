import type { MonthlyEntry, Indicator } from "@/data/hospitalIndicators";
import type { MonthlyData } from "@/hooks/useDatabase";

/**
 * Convert database MonthlyData records to MonthlyEntry format used by the app
 */
export function convertMonthlyDataToEntries(
  dbData: MonthlyData[],
  indicators: Indicator[]
): MonthlyEntry[] {
  return dbData.map((record) => {
    const indicator = indicators.find((ind) => ind.code === record.indicator_code);
    return {
      code: record.indicator_code,
      month: record.month,
      actual: record.actual,
      remarks: record.remarks,
      target: indicator?.target || 0,
      baseline: indicator?.baseline || 0,
    };
  });
}

/**
 * Convert MonthlyEntry format to database-ready object
 */
export function convertEntryToMonthlyData(
  entry: MonthlyEntry,
  year: number,
  userId: string | null
): Omit<MonthlyData, "id" | "created_at" | "updated_at"> {
  return {
    year,
    month: entry.month,
    indicator_code: entry.code,
    actual: entry.actual,
    remarks: entry.remarks,
    entered_by: userId,
  };
}

/**
 * Merge database data with app data, preferring database values
 */
export function mergeMonthlyData(
  appData: MonthlyEntry[],
  dbData: MonthlyData[]
): MonthlyEntry[] {
  const dbMap = new Map(dbData.map((d) => [`${d.month}_${d.indicator_code}`, d]));

  return appData.map((entry) => {
    const key = `${entry.month}_${entry.code}`;
    const dbRecord = dbMap.get(key);
    if (dbRecord) {
      return {
        ...entry,
        actual: dbRecord.actual,
        remarks: dbRecord.remarks,
      };
    }
    return entry;
  });
}
