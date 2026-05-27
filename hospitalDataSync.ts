import { supabase } from "@/integrations/supabase/client";
import { type Indicator, distributeAnnualTarget } from "@/data/hospitalIndicators";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HospitalDBRow {
  id?: number;
  category: string;
  indicator_name: string;
  fiscal_year: string;
  metric_type: string;
  metric_value?: number | null;
  percentage_value?: number | null;
  status?: string;
  remark?: string | null;
  created_at?: string;
}

// ─── Fetch from Supabase ──────────────────────────────────────────────────────

/**
 * Fetches all rows from hospital_plan_and_performance and maps them
 * to the Indicator shape used throughout the app.
 *
 * Strategy:
 *  - Each unique indicator_name becomes one Indicator
 *  - We pick the latest fiscal year's "Plan" row for the target value
 *  - category maps to both programArea and subProgram
 */
export async function fetchIndicatorsFromDB(): Promise<Indicator[]> {
  const { data, error } = await supabase
    .from("hospital_plan_and_performance")
    .select("*")
    .order("fiscal_year", { ascending: false });

  if (error) {
    console.error("fetchIndicatorsFromDB error:", error);
    throw error;
  }

  return mapToIndicators(data || []);
}

// ─── Map DB rows → Indicator[] ────────────────────────────────────────────────

/**
 * Converts raw hospital_plan_and_performance rows into the Indicator[]
 * shape the app uses across all tabs.
 *
 * Rules:
 *  - One Indicator per unique indicator_name
 *  - target  = metric_value of the latest "Plan" row for that indicator
 *  - If no Plan row exists, fall back to latest "EAP" then "Performance"
 *  - programArea = category
 *  - subProgram  = category  (no separate sub_program column in this table)
 *  - code = slugified indicator_name (uppercase, spaces → underscores)
 *  - unit defaults to "#"
 *  - baseline defaults to 0
 */
export function mapToIndicators(rows: HospitalDBRow[]): Indicator[] {
  // Group rows by indicator_name
  const grouped = new Map<string, HospitalDBRow[]>();
  for (const row of rows) {
    const key = row.indicator_name;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(row);
  }

  const indicators: Indicator[] = [];

  grouped.forEach((indicatorRows, indicatorName) => {
    // Pick target: prefer Plan → EAP → Performance, latest fiscal year first
    const pick = (type: string) =>
      indicatorRows
        .filter((r) => r.metric_type === type && r.metric_value != null)
        .sort((a, b) => b.fiscal_year.localeCompare(a.fiscal_year))[0];

    const targetRow = pick("Plan") ?? pick("EAP") ?? pick("Performance");
    const target = Number(targetRow?.metric_value ?? 0);

    // Use the first row for category info
    const ref = indicatorRows[0];
    const category = ref.category ?? "General";

    // Generate a clean code from indicator_name
    const code = indicatorName
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 100);

    const dist = distributeAnnualTarget(target);

    indicators.push({
      code,
      programArea: category,
      subProgram: category,
      indicator: indicatorName,
      unit: "#",
      baseline: 0,
      target,
      monthlyTarget: dist.monthlyTarget,
      quarterlyTarget: dist.quarterlyTarget,
      semiannualTarget: dist.semiannualTarget,
    });
  });

  // Sort by programArea then indicator name
  indicators.sort((a, b) =>
    a.programArea.localeCompare(b.programArea) ||
    a.indicator.localeCompare(b.indicator)
  );

  return indicators;
}

// ─── Upsert helper ────────────────────────────────────────────────────────────

export async function upsertHospitalPlanRow(
  indicatorName: string,
  category: string,
  fiscalYear: string,
  value: number,
  target: number,
  remark: string = ""
) {
  const payload: Omit<HospitalDBRow, "id" | "created_at"> = {
    category,
    indicator_name: indicatorName,
    fiscal_year: fiscalYear,
    metric_type: "Actual",
    metric_value: value,
    percentage_value: target > 0 ? (value / target) * 100 : 0,
    status: "Active",
    remark,
  };

  const { data, error } = await supabase
    .from("hospital_plan_and_performance")
    .upsert(payload, { onConflict: "indicator_name,fiscal_year,metric_type" })
    .select()
    .single();

  if (error) throw error;
  return data;
}