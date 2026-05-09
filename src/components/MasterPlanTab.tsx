import { useState, useMemo, useCallback } from "react";
import { getStatus, getActualYTD, type MonthlyEntry, type Indicator, updateIndicatorTargets, distributeAnnualTarget } from "@/data/hospitalIndicators";
import { useIndicators } from "@/context/IndicatorsContext";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Search, Save, X, Plus, Trash2, Maximize2, Minimize2, Pencil,
  TrendingUp, TrendingDown, Minus, ChevronUp, ChevronDown,
  AlertTriangle, CheckCircle2, XCircle, Filter, BarChart3,
  Target, Activity, RefreshCw, Info,
} from "lucide-react";
import { useDatabase } from "@/hooks/useDatabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Props {
  monthlyData: MonthlyEntry[];
  selectedYear: number;
  previousYearData: MonthlyEntry[];
}

type SortField = "code" | "indicator" | "programArea" | "target" | "actual" | "percent";
type SortDir = "asc" | "desc";

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusBadge = ({ percent }: { percent: number }) => {
  const s = getStatus(percent);
  if (s === "green") return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400 border border-emerald-200"><CheckCircle2 className="h-3 w-3" />On Track</span>;
  if (s === "yellow") return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-200"><AlertTriangle className="h-3 w-3" />At Risk</span>;
  return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400 border border-red-200"><XCircle className="h-3 w-3" />Off Track</span>;
};

const ProgressBar = ({ percent }: { percent: number }) => {
  const s = getStatus(percent);
  const col = s === "green" ? "bg-emerald-500" : s === "yellow" ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${col}`} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
      <span className="text-xs font-mono font-semibold w-10 text-right tabular-nums">{percent}%</span>
    </div>
  );
};

const YoYChip = ({ current, previous }: { current: number; previous: number }) => {
  const diff = current - previous;
  if (Math.abs(diff) < 1) return <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Minus className="h-3 w-3" />—</span>;
  if (diff > 0) return <span className="text-xs font-semibold text-emerald-600 flex items-center gap-0.5"><TrendingUp className="h-3 w-3" />+{diff}%</span>;
  return <span className="text-xs font-semibold text-red-500 flex items-center gap-0.5"><TrendingDown className="h-3 w-3" />{diff}%</span>;
};

const SortTh = ({ field, label, sortField, sortDir, onSort, className = "" }: {
  field: SortField; label: string; sortField: SortField; sortDir: SortDir;
  onSort: (f: SortField) => void; className?: string;
}) => (
  <th className={`p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors whitespace-nowrap ${className}`} onClick={() => onSort(field)}>
    <span className="inline-flex items-center gap-1">
      {label}
      {sortField === field ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3 text-primary" /> : <ChevronDown className="h-3 w-3 text-primary" />) : <ChevronUp className="h-3 w-3 opacity-20" />}
    </span>
  </th>
);

const KpiCard = ({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string }) => (
  <div className="flex items-center gap-3 p-4 rounded-xl border bg-card shadow-sm">
    <div className={`p-2.5 rounded-lg ${color}`}>{icon}</div>
    <div className="min-w-0">
      <p className="text-2xl font-bold tabular-nums leading-none">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5 truncate">{label}</p>
      {sub && <p className="text-xs font-medium text-primary mt-0.5">{sub}</p>}
    </div>
  </div>
);

// ─── Edit Indicator Modal ─────────────────────────────────────────────────────

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
  const [monthlyTarget, setMonthlyTarget] = useState(String(indicator.monthlyTarget ?? indicator.target / 12));
  const [quarterlyTarget, setQuarterlyTarget] = useState(String(indicator.quarterlyTarget ?? indicator.target / 4));
  const [semiannualTarget, setSemiannualTarget] = useState(String(indicator.semiannualTarget ?? indicator.target / 2));
  const [programArea, setProgramArea] = useState(indicator.programArea);
  const [subProgram, setSubProgram] = useState(indicator.subProgram);
  const [saving, setSaving] = useState(false);

  // Auto-distribute when annual target changes
  const handleAnnualTargetChange = (value: string) => {
    setTarget(value);
    const annualVal = Number(value);
    if (!isNaN(annualVal) && annualVal > 0) {
      const dist = distributeAnnualTarget(annualVal);
      setMonthlyTarget(String(dist.monthlyTarget));
      setQuarterlyTarget(String(dist.quarterlyTarget));
      setSemiannualTarget(String(dist.semiannualTarget));
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Indicator name is required"); return; }
    const t = Number(target), b = Number(baseline);
    if (isNaN(t) || t < 0) { toast.error("Target must be a positive number"); return; }
    if (isNaN(b) || b < 0) { toast.error("Baseline must be a positive number"); return; }
    setSaving(true);
    try {
      await onSave({
        indicator: name.trim(),
        unit,
        baseline: b,
        target: t,
        monthlyTarget: Number(monthlyTarget),
        quarterlyTarget: Number(quarterlyTarget),
        semiannualTarget: Number(semiannualTarget),
        programArea,
        subProgram,
      });
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Pencil className="h-4 w-4 text-primary" />
          Edit Indicator
          <span className="ml-auto font-mono text-sm bg-muted px-2 py-0.5 rounded text-muted-foreground">{indicator.code}</span>
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4 pt-2">
        {/* Propagation notice */}
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-sm text-blue-800 dark:text-blue-300">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Changes will <strong>instantly update</strong> in Master Plan, Monthly Entry, Dashboard, Analytics Workspace, and Dept. Feedback.</span>
        </div>

        {/* Name — editable for all */}
        <div className="space-y-1.5">
          <Label>Indicator Name <span className="text-red-500">*</span></Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Clear, measurable description…" autoFocus />
        </div>

        {/* Unit — editable for all */}
        <div className="space-y-1.5">
          <Label>Unit of Measure</Label>
          <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="#, %, ratio…" />
        </div>

        {/* Program Area + Sub-program */}
        {isCustomIndicator ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Program Area</Label>
              <Select value={programArea} onValueChange={setProgramArea}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{uniqueProgramAreas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Sub-program</Label>
              <Select value={subProgram} onValueChange={setSubProgram}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{uniqueSubPrograms.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
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

        {/* Baseline + Annual Target */}
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

        {/* Time-Based Targets */}
        <div className="space-y-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
          <Label className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            <Target className="h-3.5 w-3.5 inline mr-1" />
            Time-Based Targets (Auto-calculated – <span className="italic">Editable for seasonal adjustments</span>)
          </Label>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Monthly</Label>
              <Input type="number" min="0" step="0.01" value={monthlyTarget} onChange={(e) => setMonthlyTarget(e.target.value)} className="text-xs" />
              <p className="text-xs text-muted-foreground">Annual ÷ 12</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Quarterly</Label>
              <Input type="number" min="0" step="0.01" value={quarterlyTarget} onChange={(e) => setQuarterlyTarget(e.target.value)} className="text-xs" />
              <p className="text-xs text-muted-foreground">Annual ÷ 4</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Semi-annual</Label>
              <Input type="number" min="0" step="0.01" value={semiannualTarget} onChange={(e) => setSemiannualTarget(e.target.value)} className="text-xs" />
              <p className="text-xs text-muted-foreground">Annual ÷ 2</p>
            </div>
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

// ─── Add Indicator Modal ──────────────────────────────────────────────────────

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
    if (!code.trim()) { toast.error("Indicator code is required"); return; }
    if (!name.trim()) { toast.error("Indicator name is required"); return; }
    if (!programArea) { toast.error("Please select a Program Area"); return; }
    if (!subProgram) { toast.error("Please select a Sub-program"); return; }
    const t = Number(target), b = Number(baseline);
    if (isNaN(t) || t < 0) { toast.error("Target must be a positive number"); return; }
    setSaving(true);
    const ok = await onAdd({ code: code.toUpperCase().trim(), indicator: name.trim(), unit: unit || "#", baseline: b, target: t, programArea, subProgram });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <DialogContent className="sm:max-w-[560px]">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" />
          Add New Indicator
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4 pt-2">
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-sm text-blue-800 dark:text-blue-300">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>This indicator will appear <strong>immediately</strong> in Master Plan, <strong>Monthly Entry selector</strong>, Dashboard, Analytics Workspace, and Dept. Feedback.</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Code <span className="text-red-500">*</span></Label>
            <Input placeholder="e.g. MCH_FP_05" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="font-mono" autoFocus />
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
              <SelectContent>{uniqueProgramAreas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Sub-program <span className="text-red-500">*</span></Label>
            <Select value={subProgram} onValueChange={setSubProgram}>
              <SelectTrigger><SelectValue placeholder="Select sub" /></SelectTrigger>
              <SelectContent>{uniqueSubPrograms.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MasterPlanTab({ monthlyData, selectedYear, previousYearData }: Props) {
  const { user } = useAuth();
  const { upsertAnnualPlan, deleteAnnualPlan } = useDatabase();
  const { indicators, addIndicator, updateIndicator, removeIndicator, isCustom } = useIndicators();

  const [search, setSearch] = useState("");
  const [filterArea, setFilterArea] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "green" | "yellow" | "red">("all");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sortField, setSortField] = useState<SortField>("code");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [editingIndicator, setEditingIndicator] = useState<Indicator | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);

  const uniqueProgramAreas = useMemo(() => Array.from(new Set(indicators.map((i) => i.programArea))).sort(), [indicators]);
  const uniqueSubPrograms = useMemo(() => Array.from(new Set(indicators.map((i) => i.subProgram))).sort(), [indicators]);

  const handleSort = useCallback((field: SortField) => {
    if (field === sortField) { setSortDir((d) => d === "asc" ? "desc" : "asc"); }
    else { setSortField(field); setSortDir("asc"); }
  }, [sortField]);

  const rows = useMemo(() => {
    let list = indicators.map((ind) => {
      const actual = getActualYTD(ind.code, monthlyData);
      const percent = ind.target > 0 ? Math.round((actual / ind.target) * 100) : 0;
      const prevActual = getActualYTD(ind.code, previousYearData);
      const prevPercent = ind.target > 0 ? Math.round((prevActual / ind.target) * 100) : 0;
      return { ...ind, actual, percent, prevPercent, status: getStatus(percent) };
    });

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.code.toLowerCase().includes(q) || r.indicator.toLowerCase().includes(q) || r.programArea.toLowerCase().includes(q) || r.subProgram.toLowerCase().includes(q));
    }
    if (filterArea !== "all") list = list.filter((r) => r.programArea === filterArea);
    if (filterStatus !== "all") list = list.filter((r) => r.status === filterStatus);

    list.sort((a, b) => {
      const aVal = ({ code: a.code, indicator: a.indicator, programArea: a.programArea, target: a.target, actual: a.actual, percent: a.percent } as Record<SortField, string | number>)[sortField];
      const bVal = ({ code: b.code, indicator: b.indicator, programArea: b.programArea, target: b.target, actual: b.actual, percent: b.percent } as Record<SortField, string | number>)[sortField];
      if (typeof aVal === "string") return sortDir === "asc" ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
      return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    return list;
  }, [indicators, monthlyData, previousYearData, search, filterArea, filterStatus, sortField, sortDir]);

  const stats = useMemo(() => {
    const all = indicators.map((ind) => {
      const actual = getActualYTD(ind.code, monthlyData);
      const percent = ind.target > 0 ? Math.round((actual / ind.target) * 100) : 0;
      return getStatus(percent);
    });
    return { total: all.length, onTrack: all.filter((s) => s === "green").length, atRisk: all.filter((s) => s === "yellow").length, offTrack: all.filter((s) => s === "red").length };
  }, [indicators, monthlyData]);

  const handleSaveEdit = useCallback(async (patch: Partial<Indicator>) => {
    if (!editingIndicator) return;
    updateIndicator(editingIndicator.code, patch);
    try {
      const merged = { ...editingIndicator, ...patch };
      await upsertAnnualPlan(selectedYear, merged.code, merged.programArea, merged.subProgram, merged.indicator, merged.unit, merged.baseline, merged.target, user?.id || null);
      toast.success("Indicator updated — live across all tabs ✓");
    } catch {
      toast.error("Saved in memory but failed to sync to database");
    }
  }, [editingIndicator, updateIndicator, upsertAnnualPlan, selectedYear, user]);

  const handleAdd = useCallback(async (ind: Indicator): Promise<boolean> => {
    const ok = addIndicator(ind as any);
    if (!ok) { toast.error("An indicator with this code already exists"); return false; }
    try {
      await upsertAnnualPlan(selectedYear, ind.code, ind.programArea, ind.subProgram, ind.indicator, ind.unit, ind.baseline, ind.target, user?.id || null);
      toast.success(`"${ind.indicator}" added — visible in all tabs ✓`);
    } catch {
      toast.error("Added in memory but failed to sync to database");
    }
    return true;
  }, [addIndicator, upsertAnnualPlan, selectedYear, user]);

  const handleDelete = useCallback(async (code: string) => {
    setDeletingCode(code);
    try {
      await deleteAnnualPlan(selectedYear, code);
      removeIndicator(code);
      toast.success("Indicator removed from all tabs");
    } catch {
      toast.error("Failed to delete — please try again");
    } finally { setDeletingCode(null); }
  }, [deleteAnnualPlan, removeIndicator, selectedYear]);

  const clearFilters = () => { setSearch(""); setFilterArea("all"); setFilterStatus("all"); };
  const hasFilters = search || filterArea !== "all" || filterStatus !== "all";

  return (
    <div className={`flex flex-col gap-5 ${isFullscreen ? "fixed inset-0 z-50 bg-background p-5 overflow-hidden" : ""}`}>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard icon={<BarChart3 className="h-4 w-4 text-blue-600" />} label="Total Indicators" value={stats.total} sub={`${rows.length} shown`} color="bg-blue-100 dark:bg-blue-900/30" />
        <KpiCard icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} label="On Track ≥90%" value={stats.onTrack} sub={`${stats.total > 0 ? Math.round((stats.onTrack / stats.total) * 100) : 0}% of total`} color="bg-emerald-100 dark:bg-emerald-900/30" />
        <KpiCard icon={<AlertTriangle className="h-4 w-4 text-amber-600" />} label="At Risk 70–89%" value={stats.atRisk} color="bg-amber-100 dark:bg-amber-900/30" />
        <KpiCard icon={<XCircle className="h-4 w-4 text-red-600" />} label="Off Track <70%" value={stats.offTrack} color="bg-red-100 dark:bg-red-900/30" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2 flex-1 min-w-0">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input placeholder="Search code, name, area…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
            {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
          </div>

          <Select value={filterArea} onValueChange={setFilterArea}>
            <SelectTrigger className="h-9 w-[190px]">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="All Areas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Program Areas</SelectItem>
              {uniqueProgramAreas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>

          {(["all", "green", "yellow", "red"] as const).map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`h-9 px-3 rounded-md text-xs font-semibold border transition-all ${filterStatus === s
                ? s === "all" ? "bg-primary text-primary-foreground border-primary"
                  : s === "green" ? "bg-emerald-600 text-white border-emerald-600"
                  : s === "yellow" ? "bg-amber-500 text-white border-amber-500"
                  : "bg-red-500 text-white border-red-500"
                : "bg-background text-muted-foreground border-input hover:bg-muted"}`}>
              {s === "all" ? "All" : s === "green" ? "✓ On Track" : s === "yellow" ? "⚠ At Risk" : "✕ Off Track"}
            </button>
          ))}

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1.5 text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5" />Clear
            </Button>
          )}
        </div>

        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setIsFullscreen(!isFullscreen)} className="h-9 gap-1.5">
            {isFullscreen ? <><Minimize2 className="h-3.5 w-3.5" />Exit</> : <><Maximize2 className="h-3.5 w-3.5" />Expand</>}
          </Button>

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9 gap-1.5"><Plus className="h-3.5 w-3.5" />Add Indicator</Button>
            </DialogTrigger>
            <AddIndicatorModal uniqueProgramAreas={uniqueProgramAreas} uniqueSubPrograms={uniqueSubPrograms} onAdd={handleAdd} onClose={() => setIsAddOpen(false)} />
          </Dialog>
        </div>
      </div>

      {hasFilters && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground -mt-2">
          <Activity className="h-3.5 w-3.5" />
          Showing <strong className="text-foreground">{rows.length}</strong> of <strong className="text-foreground">{stats.total}</strong> indicators
        </div>
      )}

      {/* Edit dialog — portal-mounted */}
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

      {/* Table */}
      <div className={`rounded-xl border bg-card shadow-sm overflow-hidden flex flex-col ${isFullscreen ? "flex-1 min-h-0" : ""}`}>
        <div className="overflow-auto flex-1">
          <table className="w-full min-w-[1350px] text-sm border-collapse">
            <thead className="sticky top-0 z-30 bg-muted/80 backdrop-blur-sm border-b">
              <tr>
                <SortTh field="code" label="Code" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="sticky left-0 bg-muted/80 z-40 border-r text-left w-[115px]" />
                <SortTh field="indicator" label="Indicator" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-left min-w-[280px]" />
                <SortTh field="programArea" label="Program Area" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-left min-w-[160px]" />
                <th className="p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-left min-w-[130px]">Sub-program</th>
                <th className="p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center w-[60px]">Unit</th>
                <SortTh field="target" label="Target" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-right w-[90px]" />
                <SortTh field="actual" label="Actual" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-right w-[90px]" />
                <th className="p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-left min-w-[160px]">Progress</th>
                <th className="p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center w-[90px]">YoY</th>
                <th className="p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center w-[115px]">Status</th>
                <th className="p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center w-[90px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-16 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="h-8 w-8 opacity-30" />
                      <p className="font-medium">No indicators match your filters</p>
                      <button onClick={clearFilters} className="text-primary text-sm hover:underline">Clear filters</button>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((ind, i) => {
                  const custom = isCustom(ind.code);
                  const isDeleting = deletingCode === ind.code;
                  return (
                    <tr key={ind.code} className={`border-b transition-colors group ${i % 2 === 0 ? "bg-card hover:bg-muted/30" : "bg-muted/10 hover:bg-muted/40"}`}>
                      <td className="p-3 border-r sticky left-0 bg-inherit z-10 shadow-[2px_0_8px_-4px_rgba(0,0,0,0.15)]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-xs font-bold text-primary">{ind.code}</span>
                          {custom && <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 border border-blue-200">NEW</span>}
                        </div>
                      </td>
                      <td className="p-3"><span className="text-sm font-medium leading-snug line-clamp-2">{ind.indicator}</span></td>
                      <td className="p-3 text-xs text-muted-foreground">{ind.programArea}</td>
                      <td className="p-3 text-xs text-muted-foreground">{ind.subProgram}</td>
                      <td className="p-3 text-center"><span className="text-xs font-mono text-muted-foreground">{ind.unit}</span></td>
                      <td className="p-3 text-right"><span className="font-mono text-sm">{ind.target.toLocaleString()}</span></td>
                      <td className="p-3 text-right"><span className="font-mono text-sm font-semibold text-primary">{ind.actual.toLocaleString()}</span></td>
                      <td className="p-3 min-w-[160px]"><ProgressBar percent={ind.percent} /></td>
                      <td className="p-3 text-center"><YoYChip current={ind.percent} previous={ind.prevPercent} /></td>
                      <td className="p-3 text-center"><StatusBadge percent={ind.percent} /></td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1">
                          {/* Edit pencil — always available for all indicators */}
                          <button onClick={() => setEditingIndicator(ind)} title="Edit indicator"
                            className="h-7 w-7 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 transition-all">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {/* Delete — custom only */}
                          {custom && (
                            <button onClick={() => handleDelete(ind.code)} disabled={isDeleting} title="Delete indicator"
                              className="h-7 w-7 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500 transition-all disabled:opacity-50">
                              {isDeleting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="border-t bg-muted/30 px-4 py-2.5 flex items-center justify-between text-xs text-muted-foreground">
          <span>{rows.length} indicator{rows.length !== 1 ? "s" : ""} · {selectedYear} annual plan</span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />On Track: {stats.onTrack}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />At Risk: {stats.atRisk}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Off Track: {stats.offTrack}</span>
          </div>
        </div>
      </div>
    </div>
  );
}