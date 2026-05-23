import { useEffect, useState } from "react";
import { useDatabase } from "@/hooks/useDatabase";
import { mapToIndicators } from "../../hospitalDataSync";

export default function DashboardTab() {
  const { fetchHospitalPerformanceData } = useDatabase();
  const [planCount, setPlanCount] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const rows = await fetchHospitalPerformanceData();
        if (!mounted) return;
        const inds = mapToIndicators(rows as any);
        setPlanCount(inds.length);
      } catch (err) {
        console.error('DashboardTab: failed to fetch plan indicators', err);
        setPlanCount(null);
      }
    })();
    return () => { mounted = false; };
  }, [fetchHospitalPerformanceData]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-slate-50/50 rounded-xl border border-dashed">
      <h2 className="text-xl font-semibold text-slate-800 mb-2">Plan Compass Dashboard</h2>
      <p className="text-slate-500 max-w-sm">
        Welcome! Use the <strong>Analytics Workspace</strong> tab to filter by month or quarter and view detailed hospital performance reports.
      </p>
      <div className="mt-4 text-sm text-muted-foreground">
        {planCount === null ? (
          <span>Loading plan indicators…</span>
        ) : (
          <span>{planCount} plan indicators loaded from hospital_plan_and_performance</span>
        )}
      </div>
    </div>
  );
}
