export interface Indicator {
  code: string;
  programArea: string;
  subProgram: string;
  indicator: string;
  unit: string;
  baseline: number;
  target: number;
  // Time-based targets (auto-calculated from annual target)
  monthlyTarget?: number;
  quarterlyTarget?: number;
  semiannualTarget?: number;
}

// Represents a row from the `hospital_plan_and_performance` table
export interface HospitalPlanRow {
  id?: number;
  category: string; // maps to programArea
  indicator_name: string; // maps to code / indicator
  fiscal_year: string;
  metric_type: string; // 'Plan' | 'Performance' | 'Actual' etc.
  metric_value?: number | null;
  percentage_value?: number | null;
  status?: string;
  remark?: string | null;
  created_at?: string;
}

export interface MonthlyEntry {
  code: string;
  month: string;
  actual: number | null;
  remarks: string;
}

export interface PeriodicTarget {
  code: string;
  indicator: string;
  programArea: string;
  period: "monthly" | "quarterly" | "semiannual" | "annual";
  target: number;
  actual: number;
  variance: number;
  variancePercent: number;
}

// Ethiopian Financial Year: Hamle (July) to Sene (June)
// Mapped to Gregorian months starting from November
export const MONTHS = [
  "Hamle (Nov)", "Nehase (Dec)", "Meskerem (Jan)", "Tikimt (Feb)",
  "Hidar (Mar)", "Tahsas (Apr)", "Tir (May)", "Yekatit (Jun)",
  "Megabit (Jul)", "Miyazia (Aug)", "Ginbot (Sep)", "Sene (Oct)"
];

// ─── TIME-BASED AUTO-DISTRIBUTION ─────────────────────────────────────────

/**
 * Automatically calculates monthly, quarterly, and semiannual targets
 * based on the annual target. Editable for seasonal adjustments.
 */
export function distributeAnnualTarget(annualTarget: number): {
  monthlyTarget: number;
  quarterlyTarget: number;
  semiannualTarget: number;
  annualTarget: number;
} {
  return {
    monthlyTarget: Number((annualTarget / 12).toFixed(2)),
    quarterlyTarget: Number((annualTarget / 4).toFixed(2)),
    semiannualTarget: Number((annualTarget / 2).toFixed(2)),
    annualTarget,
  };
}
// Module-level indicators array. This will be populated from Supabase via the
// IndicatorsContext at runtime. Using a mutable binding allows other modules
// to observe updated values.
export let indicators: Indicator[] = [];

export function setIndicatorsFromDB(rows: HospitalPlanRow[] | Partial<Indicator>[]) {
  indicators = (rows as any[]).map((r: any) => {
    const ind: Indicator = {
      code: String(r.code),
      programArea: String(r.programArea ?? r.department ?? r.program_area ?? r.category ?? ""),
      subProgram: String(r.subProgram ?? r.sub_program ?? ""),
      indicator: String(r.indicator ?? r.name ?? r.indicator_name ?? r.indicator_name ?? ""),
      unit: String(r.unit ?? r.status ?? "#"),
      baseline: Number(r.baseline ?? 0),
      target: Number(r.target ?? r.metric_value ?? 0),
    };
    const dist = distributeAnnualTarget(ind.target);
    ind.monthlyTarget = dist.monthlyTarget;
    ind.quarterlyTarget = dist.quarterlyTarget;
    ind.semiannualTarget = dist.semiannualTarget;
    return ind;
  });
}

// Generate sample monthly data with realistic patterns
// Note: sample generation removed to avoid synthetic mock numbers. The
// app loads indicators from Supabase and monthly entries from `monthly_entries`.

export function getStatus(percent: number): "green" | "yellow" | "red" {
  if (percent >= 90) return "green";
  if (percent >= 70) return "yellow";
  return "red";
}

export function getActualYTD(code: string, monthlyData: MonthlyEntry[]): number {
  const codeEntries = monthlyData.filter((e) => e.code === code && e.actual !== null);
  const monthlyEntries = codeEntries.filter((e) => e.month !== "Annual" && e.month !== "Annual Target");
  
  if (monthlyEntries.length > 0) {
    // If there are month-specific entries, sum them up
    return monthlyEntries.reduce((sum, e) => sum + (e.actual ?? 0), 0);
  }
  
  // Otherwise, fall back to the "Annual" performance row if it exists
  const annualEntry = codeEntries.find((e) => e.month === "Annual");
  return annualEntry ? (annualEntry.actual ?? 0) : 0;
}

export function getProgramAreas(): string[] {
  return [...new Set(indicators.map((i) => i.programArea))];
}

// ─── PERIODIC PERFORMANCE CALCULATIONS ────────────────────────────────────

export function getTargetByPeriod(indicator: Indicator, period: "monthly" | "quarterly" | "semiannual" | "annual"): number {
  switch (period) {
    case "monthly":
      return indicator.monthlyTarget ?? indicator.target / 12;
    case "quarterly":
      return indicator.quarterlyTarget ?? indicator.target / 4;
    case "semiannual":
      return indicator.semiannualTarget ?? indicator.target / 2;
    case "annual":
    default:
      return indicator.target;
  }
}

export function getActualByPeriod(indicator: Indicator, period: "monthly" | "quarterly" | "semiannual" | "annual", monthlyData: MonthlyEntry[]): number {
  const code = indicator.code;
  const entries = monthlyData.filter((e) => e.code === code && e.actual !== null);

  switch (period) {
    case "monthly":
      // For monthly, return the latest month's actual
      return entries.length > 0 ? entries[entries.length - 1].actual ?? 0 : 0;
    case "quarterly":
      // Last 3 months
      return entries.slice(-3).reduce((sum, e) => sum + (e.actual ?? 0), 0);
    case "semiannual":
      // Last 6 months
      return entries.slice(-6).reduce((sum, e) => sum + (e.actual ?? 0), 0);
    case "annual":
    default:
      // All available data
      return entries.reduce((sum, e) => sum + (e.actual ?? 0), 0);
  }
}

export function calculatePeriodicPerformance(
  indicator: Indicator,
  period: "monthly" | "quarterly" | "semiannual" | "annual",
  monthlyData: MonthlyEntry[]
): {
  code: string;
  indicator: string;
  target: number;
  actual: number;
  variance: number;
  variancePercent: number;
} {
  const target = getTargetByPeriod(indicator, period);
  const actual = getActualByPeriod(indicator, period, monthlyData);
  const variance = actual - target;
  const variancePercent = target === 0 ? 0 : Math.round((variance / target) * 100);

  return {
    code: indicator.code,
    indicator: indicator.indicator,
    target,
    actual,
    variance,
    variancePercent,
  };
}

export function flagPerformanceIssue(
  performance: { variancePercent: number },
  threshold: number = 20
): boolean {
  return Math.abs(performance.variancePercent) > threshold;
}
