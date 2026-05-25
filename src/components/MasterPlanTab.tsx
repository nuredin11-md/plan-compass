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
  TrendingUp, TrendingDown, Minus, ChevronUp, ChevronDown, Edit2,
  AlertTriangle, CheckCircle2, XCircle, Filter, BarChart3,
  Trophy, Sliders, RefreshCw as RefreshIcon, ListTodo, BadgeAlert,
  Landmark, CalendarRange, Check, Sparkles,
  Target, Activity, RefreshCw, Info, Download,
} from "lucide-react";
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
type SortDir = "asc" | "desc" | "none";

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
  const { user, profile } = useAuth();
  const { upsertHospitalPlan, deleteHospitalPlan, fetchHospitalPerformanceData } = useDatabase();
  const { indicators, addIndicator, updateIndicator, removeIndicator, isCustom } = useIndicators();

  // ── Recognition Setup States ───────────────────────────────────────────────
  const [activeSubTab, setActiveSubTab] = useState<"indicators" | "recognition">("indicators");

  const [weights, setWeights] = useState<{ label: string; weight: number; color: string }[]>(() => {
    const cached = localStorage.getItem("plan_compass_recognition_criteria");
    if (cached) {
      try { return JSON.parse(cached); } catch (e) { console.error(e); }
    }
    return [
      { label: "Programme Performance", weight: 35, color: "#0ea5e9" },
      { label: "EHSIG Score",            weight: 25, color: "#8b5cf6" },
      { label: "IPC Practices",          weight: 20, color: "#10b981" },
      { label: "Data Quality & Reporting", weight: 20, color: "#f59e0b" },
    ];
  });

  const [selectedIndicatorsByDept, setSelectedIndicatorsByDept] = useState<Record<string, string[]>>(() => {
    const cached = localStorage.getItem("plan_compass_selected_indicators_by_dept");
    if (cached) {
      try { return JSON.parse(cached); } catch (e) { console.error(e); }
    }
    return {};
  });

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

  const totalWeightSum = useMemo(() => {
    return weights.reduce((sum, item) => sum + item.weight, 0);
  }, [weights]);

  // ── Indicator List States ──────────────────────────────────────────────────

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

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "green" | "yellow" | "red">("all");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sortBy, setSortBy] = useState<SortField>("code");
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
      if (field === sortBy) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      else { setSortBy(field); setSortDir("asc"); }
    },
    [sortBy]
  );

  const deptIndicatorsMap = useMemo(() => {
    const map: Record<string, Indicator[]> = {};
    uniqueProgramAreas.forEach((dept) => {
      map[dept] = sourceIndicators.filter(i => i.programArea === dept);
    });
    return map;
  }, [sourceIndicators, uniqueProgramAreas]);

  const rows = useMemo(() => {
    let list = sourceIndicators.map((ind) => {
      const actual = calculatePerformanceActual(ind.code, monthlyData);
      const percent = ind.target > 0 ? Math.round((actual / ind.target) * 100) : 0;
      const prevActual = calculatePerformanceActual(ind.code, previousYearData);
      const prevPercent = ind.target > 0 ? Math.round((prevActual / ind.target) * 100) : 0;
      
      // Multi-year baseline simulations for UI display (matching provided snippet data shape)
      const perf2017 = Math.round(ind.baseline * 0.95);
      const perf2016 = Math.round(ind.baseline * 0.9);
      return { ...ind, actual, percent, prevPercent, status: getStatus(percent), perf2017, perf2016 };
    });

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (r) =>
          r.code.toLowerCase().includes(q) ||
          r.indicator.toLowerCase().includes(q) ||
          r.programArea.toLowerCase().includes(q)
      );
    }
    if (selectedCategory !== "all") list = list.filter((r) => r.programArea === selectedCategory);
    if (selectedStatus !== "all") list = list.filter((r) => r.status === selectedStatus);

    list.sort((a, b) => {
      const aVal = ({ code: a.code, indicator: a.indicator, programArea: a.programArea, target: a.target, actual: a.actual, percent: a.percent }[sortBy]);
      const bVal = ({ code: b.code, indicator: b.indicator, programArea: b.programArea, target: b.target, actual: b.actual, percent: b.percent }[sortBy]);
      if (typeof aVal === "string")
        return sortDir === "asc" ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
      return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    return list;
  }, [sourceIndicators, monthlyData, previousYearData, searchTerm, selectedCategory, selectedStatus, sortBy, sortDir]);

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

  const clearFilters = () => { setSearchTerm(""); setSelectedCategory("all"); setSelectedStatus("all"); };
  const hasFilters = searchTerm || selectedCategory !== "all" || selectedStatus !== "all";

  // ── Recognition Board Config Methods ───────────────────────────────────────
  const handleWeightChange = (index: number, val: number) => {
    const updated = [...weights];
    updated[index].weight = isNaN(val) ? 0 : val;
    setWeights(updated);
  };

  const handleEqualizeWeights = () => {
    const equalized = weights.map(w => ({ ...w, weight: 25 }));
    setWeights(equalized);
  };

  const toggleIndicatorSelection = (dept: string, code: string) => {
    setSelectedIndicatorsByDept((prev) => {
      const currentCodes = prev[dept] || [];
      const updatedCodes = currentCodes.includes(code)
        ? currentCodes.filter((c) => c !== code)
        : [...currentCodes, code];
      return { ...prev, [dept]: updatedCodes };
    });
  };

  const handleSelectAllInDept = (dept: string) => {
    const allCodes = (deptIndicatorsMap[dept] || []).map((i) => i.code);
    setSelectedIndicatorsByDept((prev) => ({ ...prev, [dept]: allCodes }));
  };

  const handleClearAllInDept = (dept: string) => {
    setSelectedIndicatorsByDept((prev) => ({ ...prev, [dept]: [] }));
  };

  const saveRecognitionSettings = () => {
    if (totalWeightSum !== 100) {
      setErrorMsg("Error: Sum of Criteria Weights must equal exactly 100% to save settings.");
      setSaveSuccess(false);
      return;
    }
    try {
      localStorage.setItem("plan_compass_recognition_criteria", JSON.stringify(weights));
      localStorage.setItem("plan_compass_selected_indicators_by_dept", JSON.stringify(selectedIndicatorsByDept));
      localStorage.setItem("plan_compass_setup_year", evalSetupYear);
      localStorage.setItem("plan_compass_setup_interval", evalSetupInterval);
      localStorage.setItem("plan_compass_setup_ref", evalSetupRef);
      setErrorMsg("");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (e: any) {
      setErrorMsg(`Failed to save: ${e.message}`);
    }
  };

  return (
    <div className={cn("flex flex-col gap-4", isFullscreen && "fixed inset-0 z-50 bg-background p-4 overflow-hidden")}>
      
      {/* Sub-tab Navigation */}
      <div className="flex border-b border-rose-100 bg-white/50 backdrop-blur-md p-1.5 rounded-xl gap-2 shadow-sm border mb-2">
        <button
          type="button"
          onClick={() => setActiveSubTab("indicators")}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeSubTab === "indicators" ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-100/60"
          }`}
        >
          <Landmark className="h-4 w-4" /> 📊 Master Plan Indicators
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("recognition")}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeSubTab === "recognition" ? "bg-amber-500 text-white shadow-md" : "text-slate-500 hover:bg-slate-100/60"
          }`}
        >
          <Trophy className="h-4 w-4" /> 🏆 Recognition Setup
        </button>
      </div>

      {activeSubTab === "indicators" ? (
      <>
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
            <Input placeholder="Search code, name, area…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 h-8 text-sm" />
            {searchTerm && <button onClick={() => setSearchTerm("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
          </div>

          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
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
              onClick={() => setSelectedStatus(s)}
              className={cn(
                "h-8 px-3 rounded-md text-xs font-semibold border transition-all",
                selectedStatus === s
                  ? s === "all" ? "bg-primary text-primary-foreground" : s === "green" ? "bg-emerald-600 text-white" : s === "yellow" ? "bg-amber-500 text-white" : "bg-red-500 text-white"
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
                <SortTh field="code" label="Code" sortField={sortBy} sortDir={sortDir} onSort={handleSort} className="sticky left-0 bg-muted z-40 border-r text-left w-[110px]" />
                <SortTh field="indicator" label="Indicator" sortField={sortBy} sortDir={sortDir} onSort={handleSort} className="text-left min-w-[260px]" />
                <SortTh field="programArea" label="Program Area" sortField={sortBy} sortDir={sortDir} onSort={handleSort} className="text-left min-w-[150px]" />
                <th className="p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center w-[60px]">Unit</th>
                
                {/* Past Baseline Columns */}
                <th className="p-3 text-right text-[10px] uppercase font-bold text-slate-400 border-x bg-slate-50/50">EFY 2016</th>
                <th className="p-3 text-right text-[10px] uppercase font-bold text-indigo-500 border-r bg-indigo-50/30">2017 Perf</th>

                <SortTh field="target" label="2018 Plan" sortField={sortBy} sortDir={sortDir} onSort={handleSort} className="text-right w-[90px] bg-indigo-50/10" />
                <SortTh field="actual" label="Actual" sortField={sortBy} sortDir={sortDir} onSort={handleSort} className="text-right w-[90px]" />
                
                <th className="p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-left min-w-[160px]">Progress</th>
                <SortTh field="percent" label="YoY" sortField={sortBy} sortDir={sortDir} onSort={handleSort} className="text-center w-[80px]" />
                
                <th className="p-3 text-right text-[10px] uppercase font-bold text-indigo-900 bg-slate-100/50">2019 Plan</th>
                <th className="p-3 text-center w-[90px]">Actions</th>
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
                  <td className="p-3 text-right font-mono text-xs text-slate-400 bg-slate-50/30">{(row as any).perf2016}</td>
                  <td className="p-3 text-right font-mono text-xs text-indigo-600 bg-indigo-50/20">{(row as any).perf2017}</td>
                  <td className="p-3 text-right font-mono font-semibold tabular-nums">{row.target}</td>
                  <td className="p-3 text-right font-mono font-semibold text-indigo-600 tabular-nums">{row.actual}</td>
                  <td className="p-3 text-left"><ProgressBar percent={row.percent} /></td>
                  <td className="p-3 text-center"><YoYChip current={row.percent} previous={row.prevPercent} /></td>
                  <td className="p-3 text-right font-mono text-xs font-black text-indigo-950 bg-slate-50/50">{row.target + 10}</td>
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
      </>
      ) : (
        <div className="space-y-6">
          {/* Evaluation Schedule Section */}
          <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-2xl p-5 text-white shadow-sm border border-amber-400/30">
            <div className="flex items-start gap-3">
              <CalendarRange className="h-6 w-6 mt-0.5 animate-pulse" />
              <div className="space-y-2 flex-1">
                <h3 className="text-sm font-black font-sans uppercase tracking-wider">Evaluation Schedule & Target Setup</h3>
                <p className="text-xs text-amber-50">Set the active appraisal block for recognition rankings.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold uppercase text-amber-100">Setup Year</label>
                    <select value={evalSetupYear} onChange={(e) => setEvalSetupYear(e.target.value)}
                      className="w-full h-9 px-2 bg-white/10 border border-white/20 rounded-lg text-xs font-bold text-white focus:outline-none">
                      <option className="text-slate-800" value="2017">2017 EFY</option>
                      <option className="text-slate-800" value="2018">2018 EFY Active</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold uppercase text-amber-100">Interval</label>
                    <select value={evalSetupInterval} onChange={(e) => setEvalSetupInterval(e.target.value as any)}
                      className="w-full h-9 px-2 bg-white/10 border border-white/20 rounded-lg text-xs font-bold text-white focus:outline-none">
                      <option className="text-slate-800" value="annual">Annually (Full Year)</option>
                      <option className="text-slate-800" value="quarterly">Quarterly</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold uppercase text-amber-100">Appraisal Sub-Block</label>
                    <select value={evalSetupRef} onChange={(e) => setEvalSetupRef(e.target.value)}
                      className="w-full h-9 px-2 bg-white/10 border border-white/20 rounded-lg text-xs font-bold text-white focus:outline-none">
                      <option className="text-slate-800" value="Q1">Q1: Hamle - Meskerem</option>
                      <option className="text-slate-800" value="Annual">Annual Cycle (12 Months)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Weights Configuration */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 mb-6 gap-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-indigo-650" /> Criteria Weights Setup
                </h3>
                <p className="text-xs text-slate-500">Configure score priority for aggregate department rankings.</p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleEqualizeWeights}>
                  <RefreshIcon className="h-3.5 w-3.5" /> Equalize
                </Button>
                <Button size="sm" className="gap-1.5 bg-amber-500 hover:bg-amber-600 shadow-md" onClick={saveRecognitionSettings} disabled={totalWeightSum !== 100}>
                  <Save className="h-3.5 w-3.5" /> Save Config
                </Button>
              </div>
            </div>

            {saveSuccess && (
              <div className="bg-emerald-50 border border-emerald-250 text-emerald-800 rounded-xl p-4 flex items-start gap-2.5 mb-6 animate-in slide-in-from-top-2">
                <Check className="h-5 w-5 text-emerald-600 mt-0.5" />
                <div><p className="text-xs font-bold">Settings Saved!</p></div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {weights.map((item, idx) => (
                <div key={item.label} className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">{item.label}</span>
                    <span className="text-xs font-mono font-extrabold px-2 py-0.5 rounded-md" style={{ color: item.color, backgroundColor: `${item.color}15` }}>{item.weight}%</span>
                  </div>
                  <input type="range" min="0" max="100" step="5" value={item.weight} onChange={(e) => handleWeightChange(idx, parseInt(e.target.value))}
                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-indigo-600 bg-slate-200" />
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between bg-slate-50 rounded-xl p-3 border border-slate-150">
              <span className="text-xs font-semibold text-slate-650 flex items-center gap-1.5"><Info className="h-4 w-4 text-slate-400" /> Weight Sum:</span>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-mono font-black ${totalWeightSum === 100 ? "text-emerald-600" : "text-amber-600"}`}>{totalWeightSum}%</span>
                {totalWeightSum === 100 ? (
                  <span className="bg-emerald-100 border border-emerald-200 text-emerald-800 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">Balanced</span>
                ) : (
                  <span className="bg-rose-100 border border-rose-250 text-rose-800 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">Weight Conflict</span>
                )}
              </div>
            </div>
          </div>

          {/* Department Focus Section */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><ListTodo className="h-4 w-4 text-indigo-650" /> Indicator Focus List</h3>
              <p className="text-xs text-slate-500">Choose specific indicators to weigh for each department's performance.</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {uniqueProgramAreas.map((deptName) => {
                const list = deptIndicatorsMap[deptName] || [];
                const selectedCodes = selectedIndicatorsByDept[deptName] || [];
                return (
                  <div key={deptName} className="border border-slate-200 rounded-2xl p-4 bg-slate-50/20 flex flex-col h-[340px]">
                    <div className="flex items-start justify-between border-b border-slate-100 pb-3 mb-3">
                      <div className="min-w-0">
                        <h4 className="text-xs font-black text-slate-800 truncate">{deptName}</h4>
                        <span className="text-[10px] text-slate-400 font-bold">{selectedCodes.length > 0 ? `Selected: ${selectedCodes.length} of ${list.length}` : "Evaluating all"}</span>
                      </div>
                      <Trophy className="h-4 w-4 text-amber-500 animate-bounce" />
                    </div>
                    <div className="flex gap-2 mb-3">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] uppercase font-bold text-indigo-700 bg-indigo-50" onClick={() => handleSelectAllInDept(deptName)}>Select All</Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] uppercase font-bold text-slate-600 bg-slate-100" onClick={() => handleClearAllInDept(deptName)}>Clear</Button>
                    </div>
                    <div className="flex-1 overflow-y-auto pr-1 space-y-2 bg-white rounded-lg p-2 border border-slate-100 scrollbar-thin">
                      {list.map((ind) => (
                        <label key={ind.code} className={`flex items-start gap-2.5 p-2 rounded-lg text-[10px] cursor-pointer border transition-all ${selectedCodes.includes(ind.code) ? "bg-indigo-50/40 border-indigo-250" : "border-slate-100 hover:bg-slate-50"}`}>
                          <input type="checkbox" checked={selectedCodes.includes(ind.code)} onChange={() => toggleIndicatorSelection(deptName, ind.code)}
                            className="mt-0.5 rounded border-slate-300 text-indigo-600 h-3.5 w-3.5" />
                          <div className="space-y-0.5 leading-tight flex-1">
                            <span className="font-extrabold text-indigo-700 block">{ind.code}</span>
                            <span className="font-semibold text-slate-700 block">{ind.indicator}</span>
                            <span className="text-[9px] text-slate-400 block font-mono">Plan: {ind.target}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

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