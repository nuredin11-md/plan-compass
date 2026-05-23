import { supabase } from "@/integrations/supabase/client";

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
export interface IndicatorCatalogRow {
  id: string;
  code: string;
  name: string;
  department: string;
  description: string | null;
  baseline: number | null;
  target: number | null;
  unit: string | null;
  created_at: string | null;
}

const isIndicatorCatalogRow = (row: any): row is IndicatorCatalogRow => {
  return row && typeof row === 'object' && typeof row.code === 'string' && typeof row.name === 'string';
};

const mapIndicatorCatalogRows = (rows: IndicatorCatalogRow[]): Indicator[] => {
  return rows.map((row) => ({
    code: row.code,
    indicator: row.name || row.code,
    programArea: row.department || '',
    subProgram: row.department || '',
    unit: row.unit || '#',
    baseline: Number(row.baseline || 0),
    target: Number(row.target || 0),
  }));
};

const mapPlanRowsToIndicators = (rows: HospitalDBRow[], options?: { fiscal_year?: string }): Indicator[] => {
  const pickYear = (fy: string | undefined) => {
    if (!fy) return -Infinity;
    const m = fy.match(/(\d{4})/);
    return m ? Number(m[1]) : -Infinity;
  };

  const candidates = new Map<string, HospitalDBRow>();

  for (const row of rows) {
    if (row.metric_type !== 'Plan') continue;

    const key = row.indicator_name;
    const existing = candidates.get(key);

    if (options?.fiscal_year) {
      if (row.fiscal_year === options.fiscal_year) {
        candidates.set(key, row);
        continue;
      }
      if (existing && existing.fiscal_year === options.fiscal_year) continue;
    }

    if (!existing) {
      candidates.set(key, row);
      continue;
    }

    const existingYear = pickYear(existing.fiscal_year);
    const rowYear = pickYear(row.fiscal_year);
    if (rowYear > existingYear) {
      candidates.set(key, row);
    }
  }

  return Array.from(candidates.values()).map((row) => ({
    code: row.indicator_name,
    indicator: (row.remark?.trim() || row.indicator_name || ''),
    programArea: row.category,
    subProgram: row.category,
    unit: row.status || '#',
    baseline: 0,
    target: row.metric_value || 0,
  }));
};

export const mapToIndicators = (
  rows: Array<HospitalDBRow | IndicatorCatalogRow>,
  options?: { fiscal_year?: string }
): Indicator[] => {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  if (isIndicatorCatalogRow(rows[0])) {
    return mapIndicatorCatalogRows(rows as IndicatorCatalogRow[]);
  }

  return mapPlanRowsToIndicators(rows as HospitalDBRow[], options);
};

export const fetchIndicatorsFromDB = async (): Promise<Indicator[]> => {
  const { data: catalogRows, error: catalogError } = await supabase
    .from('indicators')
    .select('*');

  if (!catalogError && Array.isArray(catalogRows) && catalogRows.length > 0) {
    return mapIndicatorCatalogRows(catalogRows as IndicatorCatalogRow[]);
  }

  if (catalogError && import.meta.env.DEV) {
    console.warn('Indicators catalog query failed, falling back to hospital_plan_and_performance:', catalogError);
  }

  const { data: planRows, error: planError } = await supabase
    .from('hospital_plan_and_performance')
    .select('*')
    .eq('metric_type', 'Plan');

  if (planError) {
    console.error('Failed to fetch plan rows from hospital_plan_and_performance:', planError);
    return [];
  }

  return mapPlanRowsToIndicators(planRows as HospitalDBRow[]);
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