import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchHospitalPerformanceRows,
  upsertHospitalPlanRow,
  deleteHospitalPlanRow,
} from "@/lib/hospitalPerformanceIntegration";
import type { MonthlyEntry, Indicator } from "@/data/hospitalIndicators";
import {
  saveMonthlyDataOffline,
  getMonthlyDataOffline,
  addToSyncQueue,
  isOfflineMode,
  saveToLocalStorage,
  getFromLocalStorage,
} from "@/lib/offlineStorage";

export interface AnnualPlan {
  id: string;
  year: number;
  indicator_code: string;
  program_area: string;
  sub_program: string;
  indicator: string;
  unit: string;
  baseline: number;
  target: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MonthlyData {
  id: string;
  year: number;
  month: number;
  indicator_code: string;
  actual: number;
  remarks: string;
  entered_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface HospitalPlanPerformance {
  id: number;
  category: string;
  indicator_name: string;
  fiscal_year: string;
  metric_type: string;
  metric_value: number | null;
  percentage_value: number | null;
  status: string;
  remark: string | null;
  created_at: string;
  updated_at?: string;
}

export function useDatabase() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch annual plans for a specific year
  const fetchAnnualPlans = useCallback(
    async (year: number): Promise<AnnualPlan[]> => {
      try {
        setLoading(true);
        setError(null);
        const { data, error: queryError } = await supabase
          .from("annual_plans")
          .select("*")
          .eq("year", year);

        if (queryError) throw queryError;
        return data || [];
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch annual plans";
        setError(message);
        if (import.meta.env.DEV) console.error("Error fetching annual plans:", err);
        return [];
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Fetch monthly data for a specific year
  const fetchMonthlyData = useCallback(
    async (year: number): Promise<MonthlyData[]> => {
      try {
        setLoading(true);
        setError(null);

        // Try to fetch from database first. The canonical table is `monthly_entries`.
        const { data, error: queryError } = await supabase
          .from("monthly_entries")
          .select("*")
          .eq("year", year);

        if (!queryError && data) {
          // Normalize rows to the MonthlyData interface expected by the app
          const normalized = (data as any[]).map((row) => {
            // month may be stored as text (Ethiopian month names) or numeric
            const monthVal = row.month;
            const monthNumber = typeof monthVal === "number" ? monthVal : Number(monthVal);
            return {
              id: row.id ?? `${row.year}-${row.month}-${row.indicator_code}`,
              year: row.year,
              month: !Number.isNaN(monthNumber) ? monthNumber : row.month,
              indicator_code: row.indicator_code,
              actual: Number(row.value ?? row.actual ?? 0),
              remarks: row.remark ?? row.remarks ?? "",
              entered_by: row.reported_by ?? row.entered_by ?? null,
              created_at: row.created_at,
            } as MonthlyData;
          });

          // Cache in offline storage
          for (const item of normalized) {
            await saveMonthlyDataOffline(item);
          }

          return normalized || [];
        }

        // If database query fails, try offline storage
        if (queryError) {
          const offlineData = await getMonthlyDataOffline(year);
          if (offlineData.length > 0) {
            setError("Loading cached data - offline mode");
            return offlineData;
          }
          throw queryError;
        }

        return [];
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch monthly data";
        setError(message);
        if (import.meta.env.DEV) console.error("Error fetching monthly data:", err);

        // Fallback to offline storage
        try {
          return await getMonthlyDataOffline(year);
        } catch {
          return [];
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Upsert (insert or update) monthly data entry
  const upsertMonthlyData = useCallback(
    async (
      year: number,
      month: number,
      indicator_code: string,
      actual: number,
      remarks: string,
      userId: string | null
    ): Promise<MonthlyData | null> => {
      try {
        setError(null);
        const now = new Date().toISOString();
        // Store month as a textual month name in the DB to match `monthly_entries` schema
        const monthName = MONTHS[month - 1] ?? String(month);
        const monthlyDataPayload = {
          year,
          month: monthName,
          indicator_code,
          value: actual,
          remark: remarks,
          reported_by: userId,
          updated_at: now,
        };

        // Always save to offline storage
        const offlineData: MonthlyData = {
          id: `${year}-${month}-${indicator_code}`,
          ...monthlyDataPayload,
          created_at: now,
        };
        await saveMonthlyDataOffline(offlineData);

        // Try to sync to database
        if (isOfflineMode()) {
          // If offline, add to sync queue
          await addToSyncQueue({
            type: "monthly_data",
            action: "update",
            data: offlineData,
            timestamp: Date.now(),
          });
          saveToLocalStorage(`pending_sync_${year}_${month}_${indicator_code}`, true);
          return offlineData;
        }

        // If online, sync to database
        const { data, error: upsertError } = await supabase
          .from("monthly_entries")
          .upsert([monthlyDataPayload], {
            onConflict: "year,month,indicator_code",
          })
          .select()
          .single();

        if (upsertError) throw upsertError;
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to save monthly data";
        setError(message);
        if (import.meta.env.DEV) console.error("Error upserting monthly data:", err);
        return null;
      }
    },
    []
  );

  // Upsert annual plan entry
  const upsertAnnualPlan = useCallback(
    async (
      year: number,
      indicator_code: string,
      program_area: string,
      sub_program: string,
      indicator: string,
      unit: string,
      baseline: number,
      target: number,
      userId: string | null
    ): Promise<AnnualPlan | null> => {
      try {
        setError(null);
        const { data, error: upsertError } = await supabase
          .from("annual_plans")
          .upsert(
            {
              year,
              indicator_code,
              program_area,
              sub_program,
              indicator,
              unit,
              baseline,
              target,
              created_by: userId,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: "year,indicator_code",
            }
          )
          .select()
          .single();

        if (upsertError) throw upsertError;
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to save annual plan";
        setError(message);
        if (import.meta.env.DEV) console.error("Error upserting annual plan:", err);
        return null;
      }
    },
    []
  );

  // Delete annual plan entry
  const deleteAnnualPlan = useCallback(
    async (year: number, indicator_code: string): Promise<boolean> => {
      try {
        setError(null);
        const { error: deleteError } = await supabase
          .from("annual_plans")
          .delete()
          .eq("year", year)
          .eq("indicator_code", indicator_code);

        if (deleteError) throw deleteError;
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete annual plan";
        setError(message);
        if (import.meta.env.DEV) console.error("Error deleting annual plan:", err);
        return false;
      }
    },
    []
  );

  // Fetch hospital plan and performance data
  const fetchHospitalPerformanceData = useCallback(
    async (filters?: {
      category?: string;
      fiscal_year?: string;
      metric_type?: string;
    }): Promise<HospitalPlanPerformance[]> => {
      try {
        setLoading(true);
        setError(null);

        const data = await fetchHospitalPerformanceRows(filters);
        return data || [];
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch hospital performance data";
        setError(message);
        if (import.meta.env.DEV) console.error("Error fetching hospital performance data:", err);
        return [];
      } finally {
        setLoading(false);
      }
    },
    []
  );

    // Upsert a Plan row into hospital_plan_and_performance
    const upsertHospitalPlan = useCallback(
      async (
        year: number,
        indicator_code: string,
        program_area: string,
        sub_program: string,
        indicator: string,
        unit: string,
        baseline: number,
        target: number,
        userId: string | null
      ): Promise<HospitalPlanPerformance | null> => {
        try {
          setError(null);
          const fiscal_year = `${year} EFY`;
          const payload = {
            category: program_area,
            indicator_name: indicator_code,
            fiscal_year,
            metric_type: "Plan",
            metric_value: target,
            percentage_value: null,
            status: unit,
            remark: indicator,
            created_at: new Date().toISOString(),
          } as any;

          const data = await upsertHospitalPlanRow(payload);
          return data as HospitalPlanPerformance;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to save hospital plan';
          setError(message);
          if (import.meta.env.DEV) console.error('Error upserting hospital plan:', err);
          return null;
        }
      },
      []
    );

    const deleteHospitalPlan = useCallback(
      async (year: number, indicator_code: string): Promise<boolean> => {
        try {
          setError(null);
          const fiscal_year = `${year} EFY`;
          await deleteHospitalPlanRow(fiscal_year, indicator_code);
          return true;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to delete hospital plan';
          setError(message);
          if (import.meta.env.DEV) console.error('Error deleting hospital plan:', err);
          return false;
        }
      },
      []
    );

  return {
    loading,
    error,
    fetchAnnualPlans,
    fetchMonthlyData,
    upsertMonthlyData,
    upsertAnnualPlan,
    deleteAnnualPlan,
    fetchHospitalPerformanceData,
    upsertHospitalPlan,
    deleteHospitalPlan,
  };
}

