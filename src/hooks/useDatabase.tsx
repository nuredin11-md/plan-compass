import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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

        // Try to fetch from database first
        const { data, error: queryError } = await supabase
          .from("monthly_data")
          .select("*")
          .eq("year", year);

        if (!queryError && data) {
          // Cache in offline storage
          for (const item of data) {
            await saveMonthlyDataOffline(item);
          }
          return data || [];
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
        const monthlyDataPayload = {
          year,
          month,
          indicator_code,
          actual,
          remarks,
          entered_by: userId,
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
          .from("monthly_data")
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

  return {
    loading,
    error,
    fetchAnnualPlans,
    fetchMonthlyData,
    upsertMonthlyData,
    upsertAnnualPlan,
    deleteAnnualPlan,
  };
}
