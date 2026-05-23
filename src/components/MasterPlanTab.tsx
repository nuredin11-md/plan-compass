import { useState, useMemo, useCallback, useEffect } from "react";
import {
  getStatus,
  type MonthlyEntry,
  type Indicator,
  distributeAnnualTarget,
} from "@/data/hospitalIndicators";
import { useIndicators } from "@/context/IndicatorsContext";
import { useDatabase } from "@/hooks/useDatabase";
import { mapToIndicators } from "../../hospitalDataSync";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search, Save, X, Plus, Trash2, Maximize2, Minimize2, Pencil,
  TrendingUp, TrendingDown, Minus, ChevronUp, ChevronDown,
  AlertTriangle, CheckCircle2, XCircle, Filter, BarChart3,
  Target, Activity, RefreshCw, Info, Download,
} from "lucide-react";
import { useDatabase } from "@/hooks/useDatabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { exportToCSV } from "@/lib/exportUtils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  monthlyData: MonthlyEntry[];
  selectedYear: number;
  previousYearData: MonthlyEntry[];
}

type SortField = "code" | "indicator" | "programArea" | "target" | "actual" | "percent";
type SortDir = "asc" | "desc";

// ── Design tokens ──────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  green:  { label: "On Track",  Icon: CheckCircle2, bg: "#d1fae5", text: "#064e3b", bar: "#059669", badge: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  yellow: { label: "At Risk",   Icon: AlertTriangle, bg: "#fef3c7", text: "#78350f", bar: "#d97706", badge: "bg-amber-100 text-amber-800 border-amber-200" },
  red:    { label: "Off Track", Icon: XCircle,       bg: "#fee2e2", text: "#7f1d1d", bar: "#dc2626", badge: "bg-red-100 text-red-800 border-red-200" },
} as const;

// ── Helper Function for Ethiopian 9-Month Report ─────────────────────────────

/**
 * በ2017/18 በጀት ዓመት የሆስፒታሉን የ9 ወር አፈጻጸም ወይም መደበኛውን YTD የሚሰላበት መንገድ
 */
const calculatePerformanceActual = (indicatorCode: string, data: MonthlyEntry[]): number => {
  // እዚህ ጋር d.indicatorCode የሚለውን በዳታቤዝህ ስም መሰረት አስተካክለዋለሁ (ለምሳሌ d.indicator_code ከሆነ)
  const indicatorRows = data.filter(d => (d as any).indicatorCode === indicatorCode);
  if (indicatorRows.length === 0) return 0;
  
  return indicatorRows.reduce((sum, row) => sum + (row.actual || 0), 0);
};
// ── Primitives ────────────────────────────────────────────────────────────────

const StatusPill = ({ percent }: { percent: number }) => {
  const s = getStatus(percent);
  const cfg = STATUS_CONFIG[s];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border",
        cfg.badge
      )}
    >
      <cfg.Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
};

const ProgressBar = ({ percent }: { percent: number }) => {
  const s = getStatus(percent);
  return (
    <div className="flex items-center gap-2 min-w-[130px]">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(percent, 100)}%`,
            background: STATUS_CONFIG[s].bar,
          }}
        />
      </div>
      <span className="font-mono text-[11px] font-semibold text-muted-foreground tabular-nums w-10 text-right">
        {percent}%
      </span>
    </div>
  );
};

const YoYChip = ({ current, previous }: { current: number; previous: number }) => {
  const diff = current - previous;
  if (Math.abs(diff) < 1)
    return <span className="text-[11px] text-muted-foreground flex items-center gap-0.5"><Minus className="h-3 w-3" />—</span>;
  if (diff > 0)
    return <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-0.5"><TrendingUp className="h-3 w-3" />+{diff}%</span>;
  return <span className="text-[11px] font-semibold text-red-500 flex items-center gap-0.5"><TrendingDown className="h-3 w-3" />{diff}%</span>;
};

const SortTh = ({
  field, label, sortField, sortDir, onSort, className = "",
}: {
  field: SortField; label: string; sortField: SortField; sortDir: SortDir;
  onSort: (f: SortField) => void; className?: string;
}) => (
  <th
    className={cn(
      "p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors whitespace-nowrap",
      className
    )}
    onClick={() => onSort(field)}
  >
    <span className="inline-flex items-center gap-1">
      {label}
      {sortField === field
        ? sortDir === "asc"
          ? <ChevronUp className="h-3 w-3 text-primary" />
          : <ChevronDown className="h-3 w-3 text-primary" />
        : <ChevronUp className="h-3 w-3 opacity-20" />}
    </span>
  </th>
);

const KpiCard = ({
  icon, label, value, sub, accent,
}: {
  icon: React.ReactNode; label: string; value: string | number;
  sub?: string; accent: string;
}) => (
  <Card className="relative overflow-hidden">
    <div className="absolute inset-y-0 left-0 w-0.5 rounded-l" style={{ background: accent }} />
    <CardContent className="p-4 pl-5">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-muted/60">{icon}</div>
        <div>
          <p className="text-xl font-bold tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
          {sub && <p className="text-[11px] font-medium text-primary mt-0.5">{sub}</p>}
        </div>
      </div>
    </CardContent>
  </Card>
);

// ── Edit Indicator Modal ───────────────────────────────────────────────────────

function EditIndicatorModal({
  indicator, isCustomIndicator, uniqueProgramAreas, uniqueSubPrograms, onSave, onClose,
}: {
  indicator: Indicator; isCustomIndicator: boolean;
  uniqueProgramAreas: string[]; uniqueSubPrograms: string[];
  onSave: (patch: Partial<Indicator>) => Promise<void>; onClose: () => void;
}) {
  const [name, setName] = useState(indicator.indicator);
  const [unit, setUnit] = useState(indicator.unit);
  const [baseline, setBaseline] = useState(String(indicator.baseline));
  const [target, setTarget] = useState(String(indicator.target));
  const [monthlyTarget, setMonthlyTarget] = useState(String(indicator.monthlyTarget ?? Math.round(indicator.target / 12)));
  const [quarterlyTarget, setQuarterlyTarget] = useState(String(indicator.quarterlyTarget ?? Math.round(indicator.target / 4)));
  const [semiannualTarget, setSemiannualTarget] = useState(String(indicator.semiannualTarget ?? Math.round(indicator.target / 2)));
  const [programArea, setProgramArea] = useState(indicator.programArea);
  const [subProgram, setSubProgram] = useState(indicator.subProgram);
  const [saving, setSaving] = useState(false);

  const handleAnnualTargetChange = (value: string) => {
    setTarget(value);
    const v = Number(value);
    if (!isNaN(v) && v >= 0) {
      const dist = distributeAnnualTarget(v);
      setMonthlyTarget(String(dist.monthlyTarget));
      setQuarterlyTarget(String(dist.quarterlyTarget));
      setSemiannualTarget(String(dist.semiannualTarget));
    }
  };

 const handleSave = async () => {
    if (!name.trim()) { toast.error("Indicator name is required"); return; }
    const t = Number(target), b = Number(baseline);
    if (isNaN(t) || t < 0) { toast.error("Target must be ≥ 0"); return; }
    if (isNaN(b) || b < 0) { toast.error("Baseline must be ≥ 0"); return; }
    setSaving(true);
    try {
      await onSave({
        indicator: name.trim(), unit, baseline: b, target: t,
        monthlyTarget: Number(monthlyTarget), quarterlyTarget: Number(quarterlyTarget),
        semiannualTarget: Number(semiannualTarget), programArea, subProgram,
      });
      onClose();
    } catch (error) {
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-base">
          <Pencil className="h-4 w-4 text-primary" />
          Edit Indicator
          <code className="ml-auto text-xs bg-muted px-2 py-0.5 rounded font-mono text-muted-foreground">
            {indicator.code}
          </code>
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4 pt-1">
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-sm text-blue-800 dark:text-blue-300">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
          <span>
            Changes propagate instantly across <strong>Master Plan</strong>, <strong>Monthly Entry</strong>,{" "}
            <strong>Dashboard</strong>, <strong>Analytics</strong>, and <strong>Dept. Feedback</strong>.
          </span>
        </div>

        <div className="space-y-1.5">
          <Label>Indicator Name <span className="text-red-500">*</span></Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Clear, measurable description…" autoFocus />
        </div>

        <div className="space-y-1.5">
          <Label>Unit of Measure</Label>
          <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="#, %, ratio…" />
        </div>

        {isCustomIndicator ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Program Area</Label>
              <Select value={programArea} onValueChange={setProgramArea}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {uniqueProgramAreas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Sub-program</Label>
              <Select value={subProgram} onValueChange={setSubProgram}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {uniqueSubPrograms.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Program Area</Label>
              <p className="px-3 py-2 rounded-md bg-muted text-sm">{programArea}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Sub-program</Label>
              <p className="px-3 py-2 rounded-md bg-muted text-sm">{subProgram}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Baseline</Label>
            <Input type="number" min="0" value={baseline} onChange={(e) => setBaseline(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Annual Target <span className="text-red-500">*</span></Label>
            <Input type="number" min="0" value={target} onChange={(e) => handleAnnualTargetChange(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 gap-2" onClick={handleSave} disabled={saving}>
            {saving ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" />Saving…</> : <><Save className="h-3.5 w-3.5" />Save Changes</>}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

// ── Add Indicator Modal ───────────────────────────────────────────────────────

function AddIndicatorModal({
  uniqueProgramAreas, uniqueSubPrograms, onAdd, onClose,
}: {
  uniqueProgramAreas: string[]; uniqueSubPrograms: string[];
  onAdd: (ind: Indicator) => Promise<boolean>; onClose: () => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("#");
  const [baseline, setBaseline] = useState("0");
  const [target, setTarget] = useState("0");
  const [programArea, setProgramArea] = useState("");
  const [subProgram, setSubProgram] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!code.trim()) { toast.error("Code is required"); return; }
    if (!name.trim()) { toast.error("Name is required"); return; }
    if (!programArea) { toast.error("Select a Program Area"); return; }
    if (!subProgram) { toast.error("Select a Sub-program"); return; }
    const t = Number(target), b = Number(baseline);
    if (isNaN(t) || t < 0) { toast.error("Target must be ≥ 0"); return; }
    setSaving(true);
    const ok = await onAdd({
      code: code.toUpperCase().trim(),
      indicator: name.trim(),
      unit: unit || "#",
      baseline: b, target: t, programArea, subProgram,
    });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <DialogContent className="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-base">
          <Plus className="h-4 w-4 text-primary" />
          Add New Indicator
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4 pt-1">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Code <span className="text-red-500">*</span></Label>
            <Input
              placeholder="CD_HIV_06"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="font-mono"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Unit</Label>
            <Input placeholder="#, %, ratio…" value={unit} onChange={(e) => setUnit(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Indicator Name <span className="text-red-500">*</span></Label>
          <Input placeholder="Clear, measurable description…" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Program Area <span className="text-red-500">*</span></Label>
            <Select value={programArea} onValueChange={setProgramArea}>
              <SelectTrigger><SelectValue placeholder="Select area" /></SelectTrigger>
              <SelectContent>
                {uniqueProgramAreas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Sub-program <span className="text-red-500">*</span></Label>
            <Select value={subProgram} onValueChange={setSubProgram}>
              <SelectTrigger><SelectValue placeholder="Select sub" /></SelectTrigger>
              <SelectContent>
                {uniqueSubPrograms.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Baseline</Label>
            <Input type="number" min="0" value={baseline} onChange={(e) => setBaseline(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Annual Target</Label>
            <Input type="number" min="0" value={target} onChange={(e) => setTarget(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 gap-2" onClick={handleAdd} disabled={saving}>
            {saving ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" />Saving…</> : <><Save className="h-3.5 w-3.5" />Add Indicator</>}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function MasterPlanTab({ monthlyData, selectedYear, previousYearData }: Props) {
  const { user } = useAuth();
  const { upsertHospitalPlan, deleteHospitalPlan, fetchHospitalPerformanceData } = useDatabase();
  const { indicators, addIndicator, updateIndicator, removeIndicator, isCustom } = useIndicators();

  // Prefer hospital_plan_and_performance (full 230 records) mapped to Indicator shape
  const [planIndicators, setPlanIndicators] = useState<Array<any>>([]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const rows = await fetchHospitalPerformanceData();
        if (!mounted) return;
        const mapped = mapToIndicators(rows as any);
        setPlanIndicators(mapped);
      } catch (err) {
        console.error('Failed to load hospital plan rows for MasterPlanTab', err);
        setPlanIndicators([]);
      }
    })();
    return () => { mounted = false; };
  }, [fetchHospitalPerformanceData]);

  const [search, setSearch] = useState("");
  const [filterArea, setFilterArea] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "green" | "yellow" | "red">("all");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sortField, setSortField] = useState<SortField>("code");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [editingIndicator, setEditingIndicator] = useState<Indicator | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);

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
  }, [indicators, monthlyData]);

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
    [editingIndicator, updateIndicator, upsertAnnualPlan, selectedYear, user]
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
    [addIndicator, upsertAnnualPlan, selectedYear, user]
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
    [deleteAnnualPlan, removeIndicator, selectedYear]
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