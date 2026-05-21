import { supabase } from "@/lib/supabase";

/**
 * Types based on public.hospital_plan_and_performance
 */
export interface HospitalDBRow {
  id?: number;
  category: string;
  indicator_name: string;
  fiscal_year: string;
  metric_type: string; // 'Plan' or 'Actual'
  metric_value: number | null;
  percentage_value: number | null;
  status: string;
  remark: string | null;
  created_at?: string;
}

/**
 * Component State structures as used in the frontend tabs
 */
export interface Indicator {
  code: string;
  indicator: string;
  programArea: string;
  subProgram: string;
  unit: string;
  baseline: number;
  target: number;
}

export interface MonthlyEntry {
  indicatorName: string;
  actual: number;
  percentage: number;
  fiscalYear: string;
  remark: string;
}

/**
 * Maps DB rows to Indicator objects for MasterPlanTab.
 */
export const mapToIndicators = (rows: HospitalDBRow[]): Indicator[] => {
  return rows
    .filter((row) => row.metric_type === 'Plan')
    .map((row) => ({
      code: row.indicator_name,
      indicator: row.remark || '',
      programArea: row.category,
      subProgram: row.category, // Defaulted to category
      unit: row.status || '#', // Using status column to store Unit
      baseline: 0,
      target: row.metric_value || 0,
    }));
};

/**
 * Maps DB rows to MonthlyEntry objects for MonthlyDataTab.
 */
export const mapToMonthlyEntries = (rows: HospitalDBRow[]): MonthlyEntry[] => {
  return rows
    .filter((row) => row.metric_type === 'Actual')
    .map((row) => ({
      indicatorName: row.indicator_name,
      actual: row.metric_value || 0,
      percentage: row.percentage_value || 0,
      fiscalYear: row.fiscal_year,
      remark: row.remark || '',
    }));
};

/**
 * Maps DB rows to summary data for charts in WorkspaceTab.
 */
export const mapToWorkspaceCharts = (rows: HospitalDBRow[]) => {
  return rows
    .filter((row) => row.metric_type === 'Actual')
    .map((row) => ({
      name: row.indicator_name,
      percentage: row.percentage_value || 0,
      category: row.category,
      status: row.status
    }));
};

/**
 * Maps DB rows to a feedback list for FeedbackTab.
 */
export const mapToFeedbackList = (rows: HospitalDBRow[]) => {
  return rows
    .filter((row) => row.remark && row.remark.trim() !== "")
    .map((row) => ({
      indicator: row.indicator_name,
      content: row.remark,
      context: row.metric_type,
      year: row.fiscal_year
    }));
};

/**
 * Fetches all records for a specific fiscal year from Supabase.
 */
export const fetchHospitalData = async (fiscalYear: string): Promise<HospitalDBRow[]> => {
  const { data, error } = await supabase
    .from('hospital_plan_and_performance')
    .select('*')
    .eq('fiscal_year', fiscalYear);

  if (error) {
    console.error("Error fetching hospital data:", error);
    throw error;
  }
  return data || [];
};

/**
 * Upserts a Plan (Target) into the database.
 */
export const saveIndicatorPlan = async (indicator: Indicator, fiscalYear: string) => {
  const payload: HospitalDBRow = {
    category: indicator.programArea,
    indicator_name: indicator.code,
    fiscal_year: fiscalYear,
    metric_type: 'Plan',
    metric_value: indicator.target,
    percentage_value: null,
    status: indicator.unit,
    remark: indicator.indicator,
  };

  await supabase
    .from('hospital_plan_and_performance')
    .upsert(payload, { onConflict: 'indicator_name,fiscal_year,metric_type' });
};

/**
 * Upserts Actual Performance data into the database.
 */
export const saveActualPerformance = async (
  indicatorName: string, 
  category: string, 
  value: number, 
  target: number, 
  fiscalYear: string,
  remark: string = ""
) => {
  const payload: HospitalDBRow = {
    category: category,
    indicator_name: indicatorName,
    fiscal_year: fiscalYear,
    metric_type: 'Actual',
    metric_value: value,
    percentage_value: target > 0 ? (value / target) * 100 : 0,
    status: 'Active',
    remark: remark,
  };

  await supabase
    .from('hospital_plan_and_performance')
    .upsert(payload, { onConflict: 'indicator_name,fiscal_year,metric_type' });
};