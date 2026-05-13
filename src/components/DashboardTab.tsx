export default function DashboardTab() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-slate-50/50 rounded-xl border border-dashed">
      <h2 className="text-xl font-semibold text-slate-800 mb-2">Plan Compass Dashboard</h2>
      <p className="text-slate-500 max-w-sm">
        Welcome! Use the <strong>Analytics Workspace</strong> tab to filter by month or quarter and view detailed hospital performance reports.
      </p>
    </div>
  );
}
