import React, { useState, useMemo, useEffect } from "react";
import { type MonthlyEntry, type Indicator } from "@/data/hospitalIndicators";
import { useIndicators } from "@/context/IndicatorsContext";
import { 
  Search, Filter, Plus, Trash2, Edit2, Check, X, Maximize2, Minimize2, 
  HelpCircle, Sparkles, ArrowUpDown, CalendarRange, TrendingUp, Landmark, ShieldCheck,
  Trophy, Settings, Activity, CheckSquare, Info, Save, RefreshCw, Sliders, ListTodo, BadgeAlert
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  monthlyData: MonthlyEntry[];
  selectedYear: number;
  previousYearData: MonthlyEntry[];
}

// Department list from the app
const DEPARTMENTS = [
  "Maternal & Child Health",
  "Child Health",
  "EPI",
  "Surgical Services",
  "Hospital Utilization",
  "Quality & Safety",
  "Pharmacy",
  "Blood Bank",
  "Tuberculosis",
  "HIV Prevention and Control",
  "Non-Communicable Diseases",
  "Nutrition",
];

// ── Recognition Board Weights Configuration ───────────────────────────────────

const DEFAULT_WEIGHTS: { label: string; weight: number; color: string }[] = [
  { label: "Programme Performance", weight: 35, color: "#0ea5e9" },
  { label: "EHSIG Score", weight: 25, color: "#8b5cf6" },
  { label: "IPC Practices", weight: 20, color: "#10b981" },
  { label: "Data Quality", weight: 20, color: "#f59e0b" },
];

// ── Main Component ────────────────────────────────────────────────────────────

export default function MasterPlanTab({ monthlyData, selectedYear, previousYearData }: Props) {
  const { indicators } = useIndicators();
  
  // Filters & State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedDepartment, setSelectedDepartment] = useState("All");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sortBy, setSortBy] = useState<"code" | "name">("code");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Sub-tab selection: "indicators" or "recognition"
  const [activeSubTab, setActiveSubTab] = useState<"indicators" | "recognition">("indicators");

  // Recognition weights configuration
  const [weights, setWeights] = useState<{ label: string; weight: number; color: string }[]>(() => {
    const cached = localStorage.getItem("plan_compass_recognition_criteria");
    if (cached) {
      try { return JSON.parse(cached); } catch (e) { console.error(e); }
    }
    return DEFAULT_WEIGHTS;
  });

  // Selected indicator codes per department
  const [selectedIndicatorsByDept, setSelectedIndicatorsByDept] = useState<Record<string, string[]>>(() => {
    const cached = localStorage.getItem("plan_compass_selected_indicators_by_dept");
    if (cached) {
      try { return JSON.parse(cached); } catch (e) { console.error(e); }
    }
    const defaultObj: Record<string, string[]> = {};
    DEPARTMENTS.forEach(dept => {
      defaultObj[dept] = [];
    });
    return defaultObj;
  });

  const [selectedYearFilter, setSelectedYearFilter] = useState("All");
  const [selectedIndicatorCode, setSelectedIndicatorCode] = useState("All");

  const [evalSetupYear, setEvalSetupYear] = useState(() => {
    return localStorage.getItem("plan_compass_setup_year") || "2018";
  });
  const [evalSetupInterval, setEvalSetupInterval] = useState<"annual" | "six-month" | "quarterly">(() => {
    return (localStorage.getItem("plan_compass_setup_interval") as any) || "annual";
  });
  const [evalSetupRef, setEvalSetupRef] = useState(() => {
    return localStorage.getItem("plan_compass_setup_ref") || "Annual";
  });

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Inline edit state
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editTarget, setEditTarget] = useState(0);

  // Add Indicator form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("count");
  const [newTarget, setNewTarget] = useState(0);

  const sourceIndicators = planIndicators && planIndicators.length > 0 ? planIndicators : indicators;

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
      // አዲሱን የ9 ወራት አፈጻጸም እውነተኛ መረጃ እዚህ ጋር ያገናኛል
      const actual = calculatePerformanceActual(ind.code, monthlyData);
      const percent = ind.target > 0 ? Math.round((actual / ind.target) * 100) : 0;
      const prevActual = calculatePerformanceActual(ind.code, previousYearData);
      const prevPercent = ind.target > 0 ? Math.round((prevActual / ind.target) * 100) : 0;
      return { ...ind, actual, percent, prevPercent, status: getStatus(percent) };
    });

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.code.toLowerCase().includes(q) ||
          r.indicator.toLowerCase().includes(q) ||
          r.programArea.toLowerCase().includes(q) ||
          r.subProgram.toLowerCase().includes(q)
      );
    }
    if (filterArea !== "all") list = list.filter((r) => r.programArea === filterArea);
    if (filterStatus !== "all") list = list.filter((r) => r.status === filterStatus);

    list.sort((a, b) => {
      const aVal = ({ code: a.code, indicator: a.indicator, programArea: a.programArea, target: a.target, actual: a.actual, percent: a.percent }[sortField]);
      const bVal = ({ code: b.code, indicator: b.indicator, programArea: b.programArea, target: b.target, actual: b.actual, percent: b.percent }[sortField]);
      if (typeof aVal === "string")
        return sortDir === "asc" ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
      return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    return list;
  }, [sourceIndicators, monthlyData, previousYearData, search, filterArea, filterStatus, sortField, sortDir]);

  const stats = useMemo(() => {
    const all = sourceIndicators.map((ind) => {
      const actual = calculatePerformanceActual(ind.code, monthlyData);
      const pct = ind.target > 0 ? Math.round((actual / ind.target) * 100) : 0;
      return getStatus(pct);
    });
    return {
      total: all.length,
      onTrack: all.filter((s) => s === "green").length,
      atRisk: all.filter((s) => s === "yellow").length,
      offTrack: all.filter((s) => s === "red").length,
    };
  }, [sourceIndicators, monthlyData]);

  const handleSaveEdit = useCallback(
    async (patch: Partial<Indicator>) => {
      if (!editingIndicator) return;
      updateIndicator(editingIndicator.code, patch);
      try {
        const merged = { ...editingIndicator, ...patch };
        await upsertHospitalPlan(
          selectedYear, merged.code, merged.programArea, merged.subProgram,
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
      const ok = addIndicator(ind as any);
      if (!ok) { toast.error("An indicator with this code already exists"); return false; }
      try {
        await upsertHospitalPlan(
          selectedYear, ind.code, ind.programArea, ind.subProgram,
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
    const data = rows.map((r) => ({
      "Code": r.code,
      "Program Area": r.programArea,
      "Sub-program": r.subProgram,
      "Indicator": r.indicator,
      "Unit": r.unit,
      "Baseline": r.baseline,
      "Annual Target": r.target,
      "Actual YTD": r.actual,
      "% Achieved": r.percent,
      "Status": STATUS_CONFIG[r.status].label,
    }));
    exportToCSV(data, `MasterPlan_${selectedYear}_Export`);
    toast.success("Exported as CSV");
  }, [rows, selectedYear]);

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
            <Input placeholder="Search code, name, area…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
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
                "h-8 px-3 rounded-md text-xs font-semibold border transition-all",
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
        <div className="overflow-auto flex-1">
          <table className="w-full min-w-[1100px] text-sm border-collapse">
            <thead className="sticky top-0 z-30 bg-muted/80 backdrop-blur-sm border-b">
              <tr>
                <SortTh field="code" label="Code" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="sticky left-0 bg-muted z-40 border-r text-left w-[110px]" />
                <SortTh field="indicator" label="Indicator" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-left min-w-[260px]" />
                <SortTh field="programArea" label="Program Area" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-left min-w-[150px]" />
                <th className="p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-left min-w-[120px]">Sub-program</th>
                <th className="p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center w-[60px]">Unit</th>
                <SortTh field="target" label="Target" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-right w-[90px]" />
                <SortTh field="actual" label="Actual" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-right w-[90px]" />
                <th className="p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-left min-w-[160px]">Progress</th>
                <SortTh field="percent" label="YoY" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-center w-[80px]" />
                <th className="p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center w-[90px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y bg-background">
              {rows.map((row) => (
                <tr key={row.code} className="hover:bg-muted/50 transition-colors group">
                  <td className="p-3 font-mono text-xs font-semibold sticky left-0 bg-background group-hover:bg-muted border-r text-primary text-left">
                    {row.code}
                  </td>
                  <td className="p-3 text-left font-medium max-w-[350px] truncate" title={row.indicator}>
                    {row.indicator}
                  </td>
                  <td className="p-3 text-left text-muted-foreground text-xs">{row.programArea}</td>
                  <td className="p-3 text-left text-muted-foreground text-xs">{row.subProgram}</td>
                  <td className="p-3 text-center font-mono text-xs text-muted-foreground">{row.unit}</td>
                  <td className="p-3 text-right font-mono font-semibold tabular-nums">{row.target}</td>
                  <td className="p-3 text-right font-mono font-semibold text-indigo-600 tabular-nums">{row.actual}</td>
                  <td className="p-3 text-left"><ProgressBar percent={row.percent} /></td>
                  <td className="p-3 text-center"><YoYChip current={row.percent} previous={row.prevPercent} /></td>
                  <td className="p-3 text-center">
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