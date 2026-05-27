import React, { useState, useMemo, useEffect, useCallback } from "react";
import { type MonthlyEntry, type Indicator, getStatus, getActualYTD } from "@/data/hospitalIndicators";
import { useIndicators } from "@/context/IndicatorsContext";
import { useAuth } from "@/hooks/useAuth";
import { useDatabase } from "@/hooks/useDatabase";
import { exportToCSV } from "@/lib/exportUtils";
import { 
  Search, Filter, Plus, Trash2, Edit2, Check, X, Maximize2, Minimize2, 
  HelpCircle, Sparkles, ArrowUpDown, CalendarRange, TrendingUp, Landmark, ShieldCheck,
  Trophy, Settings, Activity, CheckSquare, Info, Save, RefreshCw, Sliders, ListTodo, BadgeAlert,
  BarChart3, CheckCircle2, AlertTriangle, XCircle, Pencil, Download, Share2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  monthlyData: MonthlyEntry[];
  selectedYear: number;
  previousYearData: MonthlyEntry[];
}

type SortField = "code" | "indicator" | "programArea" | "baseline" | "target" | "actual" | "percent";

const STATUS_CONFIG: Record<"green" | "yellow" | "red", { label: string; color: string }> = {
  green: { label: "On Track", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  yellow: { label: "At Risk", color: "text-amber-700 bg-amber-50 border-amber-200" },
  red: { label: "Off Track", color: "text-red-700 bg-red-50 border-red-200" }
};

// ── Helper ────────────────────────────────────────────────────────────────────
const calculatePerformanceActual = getActualYTD;

// ── Main Component ────────────────────────────────────────────────────────────

export default function MasterPlanTab({ monthlyData, selectedYear, previousYearData }: Props) {
  const { indicators, isCustom, addIndicator, updateIndicator, removeIndicator } = useIndicators();
  const { user } = useAuth();
  const { upsertHospitalPlan, deleteHospitalPlan, fetchHospitalPerformanceData } = useDatabase();
  
  // Filters & State
  const [search, setSearch] = useState("");
  const [filterArea, setFilterArea] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sortField, setSortField] = useState<SortField>("code");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Real database plan performance rows
  const [dbPerformanceRows, setDbPerformanceRows] = useState<any[]>([]);
  const [loadingDb, setLoadingDb] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingDb(true);
      try {
        const data = await fetchHospitalPerformanceData();
        if (active) {
          setDbPerformanceRows(data);
        }
      } catch (err) {
        console.error("Failed to load performance rows in MasterPlan:", err);
      } finally {
        if (active) setLoadingDb(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [fetchHospitalPerformanceData, selectedYear]);

  // Dialog State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingIndicator, setEditingIndicator] = useState<Indicator | null>(null);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);

  const sourceIndicators = indicators;

  const uniqueProgramAreas = useMemo(
    () => Array.from(new Set(sourceIndicators.map((i) => i.programArea))).sort(),
    [sourceIndicators]
  );
  const uniqueSubPrograms = useMemo(
    () => Array.from(new Set(sourceIndicators.map((i) => i.subProgram))).sort(),
    [sourceIndicators]
  );

  const handleSort = useCallback(
    (field: SortField) => {
      if (field === sortField) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      else { setSortField(field); setSortDir("asc"); }
    },
    [sortField]
  );

  const rows = useMemo(() => {
    let list = sourceIndicators.map((ind) => {
      // Find dynamic matching row inside dbPerformanceRows
      const matchRow = (row: any) => {
        const slugified = row.indicator_name
          ? row.indicator_name
              .toUpperCase()
              .replace(/[^A-Z0-9]+/g, "_")
              .replace(/^_+|_+$/g, "")
              .slice(0, 100)
          : "";
        return slugified === ind.code || row.indicator_name === ind.indicator;
      };

      const currentEfyLabel = `${selectedYear} EFY`;
      const prevEfyLabel = `${selectedYear - 1} EFY`;

      // 1. Dynamic Plan/Target for the selected year
      const planRow = dbPerformanceRows.find(
        (r) => matchRow(r) && r.fiscal_year === currentEfyLabel && r.metric_type === "Plan"
      ) ?? dbPerformanceRows.find(
        (r) => matchRow(r) && r.fiscal_year === currentEfyLabel && r.metric_type === "EAP"
      );
      const target = planRow && planRow.metric_value != null ? Number(planRow.metric_value) : ind.target;

      // 2. Dynamic Baseline (baseline for each EFY is last year's performance)
      const prevPerformanceRow = dbPerformanceRows.find(
        (r) => matchRow(r) && r.fiscal_year === prevEfyLabel && r.metric_type === "Performance"
      ) ?? dbPerformanceRows.find(
        (r) => matchRow(r) && r.fiscal_year === prevEfyLabel && r.metric_type === "Actual"
      );
      const prevMonthlyActualSum = calculatePerformanceActual(ind.code, previousYearData);
      const hasPrevMonthlyEntries = previousYearData.some(
        (e) => e.code === ind.code && e.month !== "Annual" && e.month !== "Annual Target" && e.actual !== null
      );
      const baseline = hasPrevMonthlyEntries
        ? prevMonthlyActualSum
        : (prevMonthlyActualSum > 0
            ? prevMonthlyActualSum
            : (prevPerformanceRow && prevPerformanceRow.metric_value != null ? Number(prevPerformanceRow.metric_value) : ind.baseline));

      // 3. Dynamic Achievement / Actual of this year (sum can change through monthly data entry)
      const actualFromMonthly = calculatePerformanceActual(ind.code, monthlyData);
      const currentPerformanceRow = dbPerformanceRows.find(
        (r) => matchRow(r) && r.fiscal_year === currentEfyLabel && r.metric_type === "Performance"
      ) ?? dbPerformanceRows.find(
        (r) => matchRow(r) && r.fiscal_year === currentEfyLabel && r.metric_type === "Actual"
      );
      const hasMonthlyEntries = monthlyData.some(
        (e) => e.code === ind.code && e.month !== "Annual" && e.month !== "Annual Target" && e.actual !== null
      );
      const actual = hasMonthlyEntries
        ? actualFromMonthly
        : (actualFromMonthly > 0
            ? actualFromMonthly
            : (currentPerformanceRow && currentPerformanceRow.metric_value != null ? Number(currentPerformanceRow.metric_value) : 0));

      const percent = target > 0 ? Math.round((actual / target) * 100) : 0;

      // Previous percent for YoY comparison
      const prevPlanRow = dbPerformanceRows.find(
        (r) => matchRow(r) && r.fiscal_year === prevEfyLabel && r.metric_type === "Plan"
      );
      const prevTarget = prevPlanRow && prevPlanRow.metric_value != null ? Number(prevPlanRow.metric_value) : ind.target;
      const computedPrevPercent = prevTarget > 0 ? Math.round((baseline / prevTarget) * 100) : 0;

      return {
        ...ind,
        baseline,
        target,
        actual,
        percent,
        prevPercent: computedPrevPercent,
        status: getStatus(percent),
      };
    });

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.code.toLowerCase().includes(q) ||
          r.indicator.toLowerCase().includes(q) ||
          r.programArea.toLowerCase().includes(q) ||
          (r.subProgram && r.subProgram.toLowerCase().includes(q))
      );
    }
    if (filterArea !== "all") list = list.filter((r) => r.programArea === filterArea);
    if (filterStatus !== "all") list = list.filter((r) => r.status === filterStatus);

    list.sort((a, b) => {
      const aVal = ({
        code: a.code,
        indicator: a.indicator,
        programArea: a.programArea,
        baseline: a.baseline,
        target: a.target,
        actual: a.actual,
        percent: a.percent,
      }[sortField]);
      const bVal = ({
        code: b.code,
        indicator: b.indicator,
        programArea: b.programArea,
        baseline: b.baseline,
        target: b.target,
        actual: b.actual,
        percent: b.percent,
      }[sortField]);

      if (aVal === undefined) return sortDir === "asc" ? -1 : 1;
      if (bVal === undefined) return sortDir === "asc" ? 1 : -1;

      if (typeof aVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
      }
      return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    return list;
  }, [sourceIndicators, dbPerformanceRows, selectedYear, monthlyData, previousYearData, search, filterArea, filterStatus, sortField, sortDir]);

  const stats = useMemo(() => {
    const all = rows.map((r) => r.status);
    return {
      total: all.length,
      onTrack: all.filter((s) => s === "green").length,
      atRisk: all.filter((s) => s === "yellow").length,
      offTrack: all.filter((s) => s === "red").length,
    };
  }, [rows]);

  const handleSaveEdit = useCallback(
    async (patch: Partial<Indicator>) => {
      if (!editingIndicator) return;
      updateIndicator(editingIndicator.code, patch);
      try {
        const merged = { ...editingIndicator, ...patch };
        await upsertHospitalPlan(
          selectedYear, merged.code, merged.programArea, merged.subProgram || "General",
          merged.indicator, merged.unit, merged.baseline, merged.target, user?.id ?? null
        );
        toast.success("Indicator updated successfully ✓");
      } catch {
        toast.error("Saved locally but failed to sync to database");
      }
    },
    [editingIndicator, updateIndicator, upsertHospitalPlan, selectedYear, user]
  );

  const handleAdd = useCallback(
    async (ind: Indicator): Promise<boolean> => {
      const ok = addIndicator(ind);
      if (!ok) { toast.error("An indicator with this code already exists"); return false; }
      try {
        await upsertHospitalPlan(
          selectedYear, ind.code, ind.programArea, ind.subProgram || "General",
          ind.indicator, ind.unit, ind.baseline, ind.target, user?.id ?? null
        );
        toast.success(`"${ind.indicator}" added successfully ✓`);
      } catch {
        toast.error("Added locally but failed to sync to database");
      }
      return true;
    },
    [addIndicator, upsertHospitalPlan, selectedYear, user]
  );

  const handleDelete = useCallback(
    async (code: string) => {
      if (!window.confirm("Are you sure you want to delete this indicator?")) return;
      setDeletingCode(code);
      try {
        await deleteHospitalPlan(selectedYear, code);
        removeIndicator(code);
        toast.success("Indicator removed from all tabs");
      } catch {
        toast.error("Failed to delete — please try again");
      } finally { setDeletingCode(null); }
    },
    [deleteHospitalPlan, removeIndicator, selectedYear]
  );

  const handleExportCSV = useCallback(() => {
    if (rows.length === 0) {
      toast.error("No data to export");
      return;
    }
    const data = rows.map((r) => ({
      "Code": r.code,
      "Program Area": r.programArea,
      "Sub-program": r.subProgram || "",
      "Indicator": r.indicator,
      "Unit": r.unit,
      "Baseline": r.baseline,
      "Annual Target": r.target,
      "Actual YTD": r.actual,
      "% Achieved": r.percent,
      "Status": STATUS_CONFIG[r.status]?.label || r.status,
    }));
    exportToCSV(data, `MasterPlan_${selectedYear}_Export`);
    toast.success("Exported as CSV");
  }, [rows, selectedYear]);

  const handleShareToHub = () => {
    const shareItem = {
      id: "master_plan_share_" + Date.now(),
      title: `${selectedYear} EFY Clinical Master Plan Highlights`,
      type: "action-plan",
      author: "Quality Director",
      content: `Master plan highlights for the ${selectedYear} EFY period. A total of ${stats.total} KPIs are actively tracked. Current accomplishments count is ${stats.onTrack} on track indicator targets. Remedial administrative priority goes to our ${stats.offTrack} off track items.`,
      data: {
        total: stats.total,
        onTrack: stats.onTrack,
        atRisk: stats.atRisk,
        offTrack: stats.offTrack,
        year: selectedYear
      },
      createdAt: new Date().toISOString()
    };
    const existing = JSON.parse(localStorage.getItem("hospital_meeting_hub_shares") || "[]");
    existing.push(shareItem);
    localStorage.setItem("hospital_meeting_hub_shares", JSON.stringify(existing));
    toast.success("Active master plan highlights shared to Meeting Hub!");
  };

  const clearFilters = () => { setSearch(""); setFilterArea("all"); setFilterStatus("all"); };
  const hasFilters = search || filterArea !== "all" || filterStatus !== "all";

  return (
    <div className={cn("flex flex-col gap-4", isFullscreen && "fixed inset-0 z-50 bg-background p-4 overflow-hidden")}>
      
      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard icon={<BarChart3 className="h-4 w-4 text-indigo-600" />} label="Total Indicators" value={stats.total} sub={`${rows.length} shown`} accent="#6366f1" />
        <KpiCard icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} label="On Track ≥90%" value={stats.onTrack} sub={`${stats.total > 0 ? Math.round((stats.onTrack / stats.total) * 100) : 0}% of total`} accent="#059669" />
        <KpiCard icon={<AlertTriangle className="h-4 w-4 text-amber-600" />} label="At Risk 70–89%" value={stats.atRisk} accent="#d97706" />
        <KpiCard icon={<XCircle className="h-4 w-4 text-red-600" />} label="Off Track <70%" value={stats.offTrack} accent="#dc2626" />
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2 flex-1 min-w-0">
          <div className="relative min-w-[200px] flex-1 max-w-[320px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input placeholder="Search code, name, area…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-8 text-sm bg-background border border-input text-foreground font-medium" />
            {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
          </div>

          <Select value={filterArea} onValueChange={setFilterArea}>
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="All Areas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Program Areas</SelectItem>
              {uniqueProgramAreas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>

          {(["all", "green", "yellow", "red"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn(
                "h-8 px-3 rounded-md text-xs font-semibold border transition-all cursor-pointer",
                filterStatus === s
                  ? s === "all" ? "bg-primary text-primary-foreground border-primary" : s === "green" ? "bg-emerald-600 text-white border-emerald-600" : s === "yellow" ? "bg-amber-500 text-white border-amber-500" : "bg-red-500 text-white border-red-500"
                  : "bg-background text-muted-foreground border-input hover:bg-muted"
              )}
            >
              {s === "all" ? "All" : s === "green" ? "✓ On Track" : s === "yellow" ? "⚠ At Risk" : "✕ Off Track"}
            </button>
          ))}

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 gap-1.5 text-xs text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5" />Clear
            </Button>
          )}
        </div>

        <div className="flex gap-1.5 shrink-0">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleExportCSV}>
            <Download className="h-3.5 w-3.5" />Export
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs text-purple-700 bg-purple-50 hover:bg-purple-100 hover:text-purple-800 border-purple-200 font-semibold" onClick={handleShareToHub}>
            <Share2 className="h-3.5 w-3.5" /> Share Plan to Hub
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setIsFullscreen(!isFullscreen)}>
            {isFullscreen ? <><Minimize2 className="h-3.5 w-3.5" />Exit</> : <><Maximize2 className="h-3.5 w-3.5" />Expand</>}
          </Button>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" />Add Indicator
              </Button>
            </DialogTrigger>
            <AddIndicatorModal uniqueProgramAreas={uniqueProgramAreas} uniqueSubPrograms={uniqueSubPrograms} onAdd={handleAdd} onClose={() => setIsAddOpen(false)} />
          </Dialog>
        </div>
      </div>

      {/* ── Table ── */}
      <div className={cn("rounded-xl border bg-card shadow-sm overflow-hidden flex flex-col", isFullscreen && "flex-1 min-h-0")}>
        <div className="overflow-x-auto overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-muted-foreground/25 scrollbar-track-transparent">
          <table className="w-full min-w-[1200px] text-sm border-collapse table-layout-fixed">
            <thead className="sticky top-0 z-30 bg-muted/90 backdrop-blur-sm border-b">
              <tr>
                <SortTh field="code" label="Code" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="sticky left-0 bg-muted z-40 border-r text-left w-[110px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]" />
                <SortTh field="indicator" label="Indicator" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="sticky left-[110px] bg-muted z-40 border-r text-left w-[320px] min-w-[320px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]" />
                <SortTh field="programArea" label="Program Area" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-left min-w-[150px] pl-4" />
                <th className="p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-left min-w-[120px]">Sub-program</th>
                <th className="p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center w-[60px]">Unit</th>
                <SortTh field="baseline" label="Baseline" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-right w-[90px]" />
                <SortTh field="target" label="Target" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-right w-[90px]" />
                <SortTh field="actual" label="Actual" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-right w-[90px]" />
                <th className="p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-left min-w-[160px]">Progress</th>
                <SortTh field="percent" label="YoY" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-center w-[80px]" />
                <th className="p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center w-[90px] sticky right-0 bg-muted z-40 border-l shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y bg-background">
              {rows.map((row) => (
                <tr key={`${row.code}-${row.indicator}`} className="hover:bg-muted/50 transition-colors group">
                  <td className="p-3 font-mono text-xs font-semibold border-r text-primary text-left sticky left-0 bg-background group-hover:bg-slate-50 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                    {row.code}
                  </td>
                  <td className="p-3 text-left font-medium w-[320px] min-w-[320px] truncate sticky left-[110px] bg-background group-hover:bg-slate-50 border-r text-foreground z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]" title={row.indicator}>
                    {row.indicator}
                  </td>
                  <td className="p-3 text-left text-muted-foreground text-xs pl-4">{row.programArea}</td>
                  <td className="p-3 text-left text-muted-foreground text-xs">{row.subProgram || "General"}</td>
                  <td className="p-3 text-center font-mono text-xs text-muted-foreground">{row.unit}</td>
                  <td className="p-3 text-right font-mono font-semibold text-slate-500 tabular-nums">{row.baseline}</td>
                  <td className="p-3 text-right font-mono font-semibold tabular-nums">{row.target}</td>
                  <td className="p-3 text-right font-mono font-semibold text-indigo-600 tabular-nums">{row.actual}</td>
                  <td className="p-3 text-left"><ProgressBar percent={row.percent} /></td>
                  <td className="p-3 text-center"><YoYChip current={row.percent} previous={row.prevPercent} /></td>
                  <td className="p-3 text-center sticky right-0 bg-background group-hover:bg-slate-50 border-l z-20 w-[90px] shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center justify-center gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7 opacity-60 hover:opacity-100" onClick={() => setEditingIndicator(row)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 opacity-60 hover:opacity-100" onClick={() => handleDelete(row.code)} disabled={deletingCode === row.code}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Dialog rendering */}
      <Dialog open={!!editingIndicator} onOpenChange={(o) => { if (!o) setEditingIndicator(null); }}>
        {editingIndicator && (
          <EditIndicatorModal
            indicator={editingIndicator}
            isCustomIndicator={isCustom(editingIndicator.code)}
            uniqueProgramAreas={uniqueProgramAreas}
            uniqueSubPrograms={uniqueSubPrograms}
            onSave={handleSaveEdit}
            onClose={() => setEditingIndicator(null)}
          />
        )}
      </Dialog>
    </div>
  );
}

// ── KPI Card Sub-component ────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub?: string;
  accent: string;
}

function KpiCard({ icon, label, value, sub, accent }: KpiCardProps) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-sans tabular-nums" style={{ color: accent }}>{value}</span>
            {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
          </div>
        </div>
        <div className="bg-muted p-2.5 rounded-xl">{icon}</div>
      </CardContent>
    </Card>
  );
}

// ── Dynamic Sorting Header Sub-component ──────────────────────────────────────

interface SortThProps {
  field: SortField;
  label: string;
  sortField: SortField;
  sortDir: "asc" | "desc";
  onSort: (field: SortField) => void;
  className?: string;
}

function SortTh({ field, label, sortField, sortDir, onSort, className }: SortThProps) {
  const isSorted = sortField === field;
  return (
    <th
      onClick={() => onSort(field)}
      className={cn(
        "p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:bg-accent/50 transition-colors",
        className
      )}
    >
      <div className="flex items-center gap-1">
        <span>{label}</span>
        <ArrowUpDown className={cn("h-3 w-3 opacity-40", isSorted && "opacity-100 text-primary")} />
      </div>
    </th>
  );
}

// ── Progress Bar Sub-component ────────────────────────────────────────────────

function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent));
  const color = percent >= 90 ? "bg-emerald-500" : percent >= 70 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 w-full max-w-[150px]">
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-300", color)} style={{ width: `${clamped}%` }} />
      </div>
      <span className="font-mono text-xs font-bold tabular-nums w-8 shrink-0">{percent}%</span>
    </div>
  );
}

// ── Year over Year Trend Chip Sub-component ───────────────────────────────────

function YoYChip({ current, previous }: { current: number; previous: number }) {
  const diff = current - previous;
  const isUp = diff > 0;
  const isZero = diff === 0;
  if (isZero) return <span className="text-[10px] text-muted-foreground font-mono">-</span>;
  return (
    <span className={cn(
      "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded",
      isUp ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
    )}>
      {isUp ? `+${diff}%` : `${diff}%`}
    </span>
  );
}

// ── Add Indicator Setup Modal ─────────────────────────────────────────────────

interface AddModalProps {
  uniqueProgramAreas: string[];
  uniqueSubPrograms: string[];
  onAdd: (ind: Indicator) => Promise<boolean>;
  onClose: () => void;
}

function AddIndicatorModal({ uniqueProgramAreas, uniqueSubPrograms, onAdd, onClose }: AddModalProps) {
  const [code, setCode] = useState("");
  const [indicator, setIndicator] = useState("");
  const [programArea, setProgramArea] = useState("");
  const [subProgram, setSubProgram] = useState("");
  const [unit, setUnit] = useState("%");
  const [baseline, setBaseline] = useState(0);
  const [target, setTarget] = useState(100);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (uniqueProgramAreas.length > 0) setProgramArea(uniqueProgramAreas[0]);
    if (uniqueSubPrograms.length > 0) setSubProgram(uniqueSubPrograms[0]);
  }, [uniqueProgramAreas, uniqueSubPrograms]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !indicator || !programArea) return;
    setLoading(true);
    const newInd: Indicator = {
      code: code.toUpperCase().trim(),
      indicator: indicator.trim(),
      programArea,
      subProgram: subProgram || "General",
      unit,
      baseline,
      target
    };
    const success = await onAdd(newInd);
    setLoading(false);
    if (success) {
      onClose();
    }
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5 text-indigo-650" />
          <span>New Indicator Setup</span>
        </DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="code" className="text-xs">Indicator Code</Label>
            <Input id="code" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. EPI_COV_01" className="bg-background text-foreground" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="unit" className="text-xs">Unit of Measure</Label>
            <Input id="unit" required value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="e.g. % or count" className="bg-background text-foreground" />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="desc" className="text-xs">Indicator Description/Name</Label>
          <Input id="desc" required value={indicator} onChange={(e) => setIndicator(e.target.value)} placeholder="Full title of indicator" className="bg-background text-foreground" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="area" className="text-xs">Program Area</Label>
            <select
              id="area"
              value={programArea}
              onChange={(e) => setProgramArea(e.target.value)}
              className="w-full h-10 px-3 bg-background border border-input rounded-md text-xs text-foreground focus:ring-1 focus:ring-primary"
            >
              {uniqueProgramAreas.map((a) => <option key={a} value={a}>{a}</option>)}
              <option value="New Area">+ Create New...</option>
            </select>
            {programArea === "New Area" && (
              <Input placeholder="Enter new area..." onChange={(e) => setProgramArea(e.target.value)} className="mt-1.5 h-8 text-xs bg-background text-foreground" />
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="sub" className="text-xs">Sub-program</Label>
            <select
              id="sub"
              value={subProgram}
              onChange={(e) => setSubProgram(e.target.value)}
              className="w-full h-10 px-3 bg-background border border-input rounded-md text-xs text-foreground focus:ring-1 focus:ring-primary"
            >
              {uniqueSubPrograms.map((s) => <option key={s} value={s}>{s}</option>)}
              <option value="New Sub">+ Create New...</option>
            </select>
            {subProgram === "New Sub" && (
              <Input placeholder="Enter new sub..." onChange={(e) => setSubProgram(e.target.value)} className="mt-1.5 h-8 text-xs bg-background text-foreground" />
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="baseline" className="text-xs">Baseline Value</Label>
            <Input id="baseline" type="number" step="any" required value={baseline} onChange={(e) => setBaseline(Number(e.target.value))} className="bg-background text-right text-foreground" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="target" className="text-xs">Annual Target</Label>
            <Input id="target" type="number" step="any" required value={target} onChange={(e) => setTarget(Number(e.target.value))} className="bg-background text-right text-foreground" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t mt-4">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" disabled={loading}>
            {loading ? "Creating..." : "Add Indicator"}
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}

// ── Edit Indicator Modal ──────────────────────────────────────────────────────

interface EditModalProps {
  indicator: Indicator;
  isCustomIndicator: boolean;
  uniqueProgramAreas: string[];
  uniqueSubPrograms: string[];
  onSave: (patch: Partial<Indicator>) => Promise<void>;
  onClose: () => void;
}

function EditIndicatorModal({ indicator, isCustomIndicator, uniqueProgramAreas, uniqueSubPrograms, onSave, onClose }: EditModalProps) {
  const [indicatorVal, setIndicatorVal] = useState(indicator.indicator);
  const [programArea, setProgramArea] = useState(indicator.programArea);
  const [subProgram, setSubProgram] = useState(indicator.subProgram ?? "");
  const [unit, setUnit] = useState(indicator.unit);
  const [baseline, setBaseline] = useState(indicator.baseline ?? 0);
  const [target, setTarget] = useState(indicator.target ?? 0);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSave({
      indicator: indicatorVal.trim(),
      programArea,
      subProgram: subProgram || "General",
      unit,
      baseline,
      target
    });
    setLoading(false);
    onClose();
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Edit2 className="h-5 w-5 text-indigo-650" />
          <span>Edit Indicator — {indicator.code}</span>
        </DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        <div className="space-y-1">
          <Label htmlFor="edit-desc" className="text-xs">Indicator Description</Label>
          <Input id="edit-desc" required value={indicatorVal} onChange={(e) => setIndicatorVal(e.target.value)} disabled={!isCustomIndicator} className="bg-background text-foreground" />
          {!isCustomIndicator && <span className="text-[10px] text-muted-foreground italic">Standard indicator description cannot be edited</span>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="edit-area" className="text-xs">Program Area</Label>
            <select
              id="edit-area"
              value={programArea}
              onChange={(e) => setProgramArea(e.target.value)}
              disabled={!isCustomIndicator}
              className="w-full h-10 px-3 bg-background border border-input rounded-md text-xs font-medium text-foreground"
            >
              {uniqueProgramAreas.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-sub" className="text-xs">Sub-program</Label>
            <select
              id="edit-sub"
              value={subProgram}
              onChange={(e) => setSubProgram(e.target.value)}
              disabled={!isCustomIndicator}
              className="w-full h-10 px-3 bg-background border border-input rounded-md text-xs font-medium text-foreground"
            >
              {uniqueSubPrograms.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1 col-span-1">
            <Label htmlFor="edit-unit" className="text-xs">Unit</Label>
            <Input id="edit-unit" required value={unit} onChange={(e) => setUnit(e.target.value)} disabled={!isCustomIndicator} className="bg-background text-center font-mono text-foreground" />
          </div>
          <div className="space-y-1 col-span-1">
            <Label htmlFor="edit-baseline" className="text-xs">Baseline</Label>
            <Input id="edit-baseline" type="number" step="any" required value={baseline} onChange={(e) => setBaseline(Number(e.target.value))} className="bg-background text-right font-mono text-foreground" />
          </div>
          <div className="space-y-1 col-span-1">
            <Label htmlFor="edit-target" className="text-xs">Target</Label>
            <Input id="edit-target" type="number" step="any" required value={target} onChange={(e) => setTarget(Number(e.target.value))} className="bg-background text-right font-mono text-foreground" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t mt-4">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}
