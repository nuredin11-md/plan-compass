import { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { normalizeEFYString } from "@/lib/ethiopianCalendar";

// የዳታቤዙን ትክክለኛ የረድፍ ታይፕ እንወስዳለን
export type HospitalPlanPerformance = Database["public"]["Tables"]["hospital_plan_and_performance"]["Row"];
export type HospitalPlanPerformanceInsert = Database["public"]["Tables"]["hospital_plan_and_performance"]["Insert"];

/**
 * Convert hospital performance data to work with existing monthly data structure
 */
export function transformHospitalPerformanceData(
  performanceData: HospitalPlanPerformance[]
): Record<string, any> {
  const grouped: Record<string, any> = {
    byCategory: {},
    byIndicator: {},
    byYear: {},
    summary: [],
  };

  performanceData.forEach((item) => {
    // 1. Group by category
    const category = item.category || "General";
    if (!grouped.byCategory[category]) {
      grouped.byCategory[category] = [];
    }
    grouped.byCategory[category].push(item);

    // 2. Group by indicator_name
    if (!grouped.byIndicator[item.indicator_name]) {
      grouped.byIndicator[item.indicator_name] = [];
    }
    grouped.byIndicator[item.indicator_name].push(item);

    // 3. Group by fiscal_year
    if (!grouped.byYear[item.fiscal_year]) {
      grouped.byYear[item.fiscal_year] = [];
    }
    grouped.byYear[item.fiscal_year].push(item);

    // 4. Add to summary
    grouped.summary.push({
      category: item.category,
      indicator: item.indicator_name,
      year: item.fiscal_year,
      type: item.metric_type,
      value: item.metric_value,
      percentage: item.percentage_value,
      status: item.status,
      remark: item.remark,
    });
  });

  return grouped;
}

/**
 * Get performance metrics for a specific category
 */
export function getCategoryPerformance(
  data: HospitalPlanPerformance[],
  category: string
): HospitalPlanPerformance[] {
  return data.filter((item) => item.category === category);
}

/**
 * Calculate performance metrics for comparison
 */
export function calculatePerformanceMetrics(
  data: HospitalPlanPerformance[],
  metricType: "Plan" | "Performance"
): {
  total: number;
  count: number;
  average: number;
  highest: number;
  lowest: number;
} {
  // metric_type "Plan" ወይም "Performance" የሆኑትን ለይቶ ይ濾ልጣል
  const filtered = data.filter(
    (item) => item.metric_type === metricType && item.metric_value !== null
  );

  if (filtered.length === 0) {
    return { total: 0, count: 0, average: 0, highest: 0, lowest: 0 };
  }

  const values = filtered.map((item) => item.metric_value as number);
  const total = values.reduce((a, b) => a + b, 0);
  const average = total / values.length;

  return {
    total,
    count: values.length,
    average: Math.round(average * 100) / 100,
    highest: Math.max(...values),
    lowest: Math.min(...values),
  };
}

/**
 * Get performance variance (Plan vs Performance)
 */
export function getPerformanceVariance(
  data: HospitalPlanPerformance[],
  indicatorName: string,
  fiscalYear: string
): {
  plan: number;
  performance: number;
  variance: number;
  variancePercent: number;
} {
  const plan = data.find(
    (item) =>
      item.indicator_name === indicatorName &&
      item.fiscal_year === fiscalYear &&
      item.metric_type === "Plan"
  );

  const performance = data.find(
    (item) =>
      item.indicator_name === indicatorName &&
      item.fiscal_year === fiscalYear &&
      item.metric_type === "Performance"
  );

  const planValue = plan?.metric_value ?? 0;
  const performanceValue = performance?.metric_value ?? 0;
  const variance = performanceValue - planValue;
  const variancePercent = planValue === 0 ? 0 : Math.round((variance / planValue) * 100);

  return {
    plan: planValue,
    performance: performanceValue,
    variance,
    variancePercent,
  };
}

/**
 * Merge hospital performance with monthly data for unified analysis
 */
export function mergeHospitalPerformanceWithMonthlyData(
  hospitalPerformance: HospitalPlanPerformance[],
  monthlyData: any[]
) {
  return {
    hospital: transformHospitalPerformanceData(hospitalPerformance),
    monthly: monthlyData,
    combined: {
      totalRecords: hospitalPerformance.length + (monthlyData?.length || 0),
      categories: [
        ...new Set(hospitalPerformance.map((d) => d.category).filter(Boolean)),
      ],
      years: [
        ...new Set(hospitalPerformance.map((d) => d.fiscal_year).filter(Boolean)),
      ].sort((a, b) => b.localeCompare(a)), // የቅርብ ዓመታትን ቀድሞ ያሳያል (2018, 2017, 2016)
    },
  };
}

// --- Direct DB helpers: make this module the canonical place to access
// `hospital_plan_and_performance` rows. Other parts of the app should use
// these helpers rather than calling Supabase directly.

export async function fetchHospitalPerformanceRows(filters?: {
  category?: string;
  fiscal_year?: string;
  metric_type?: string;
}): Promise<HospitalPlanPerformance[]> {
  let query = supabase.from("hospital_plan_and_performance").select("*");
  if (filters?.category) query = query.eq("category", filters.category);
  if (filters?.fiscal_year) {
    const normalized = normalizeEFYString(filters.fiscal_year);
    const yearKey = normalized.match(/(\d{4})/)?.[1];
    if (yearKey) {
      query = query.ilike("fiscal_year", `${yearKey}%`);
    } else {
      query = query.eq("fiscal_year", normalized);
    }
  }
  if (filters?.metric_type) query = query.eq("metric_type", filters.metric_type);
  const { data, error } = await query.order("fiscal_year", { ascending: false });
  if (error) {
    throw error;
  }
  return data || [];
}

export async function upsertHospitalPlanRow(payload: HospitalPlanPerformanceInsert) {
  const { data, error } = await supabase
    .from("hospital_plan_and_performance")
    .upsert([payload], { onConflict: "indicator_name,fiscal_year,metric_type" })
    .select()
    .single();
  if (error) throw error;
  if (!data) {
    throw new Error('No data returned after upsert.');
  }
  return data;
}

export async function deleteHospitalPlanRow(fiscal_year: string, indicator_name: string) {
  const { error } = await supabase
    .from("hospital_plan_and_performance")
    .delete()
    .eq("fiscal_year", fiscal_year)
    .eq("indicator_name", indicator_name)
    .eq("metric_type", "Plan");
  if (error) throw error;
  return true;
}