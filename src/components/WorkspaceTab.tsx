import RecognitionBoard from "./RecognitionBoard";
import { Award } from "lucide-react";
import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  getActualYTD,
  getStatus,
  MONTHS,
  type MonthlyEntry,
} from "@/data/hospitalIndicators";
import { useDatabase } from "@/hooks/useDatabase";
import { mapToIndicators } from "../../hospitalDataSync";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, Legend, PieChart, Pie, LineChart, Line, AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ReferenceLine,
} from "recharts";
import {
  FileDown, FileSpreadsheet, FileText, Table2, BarChart3, PieChartIcon,
  TrendingUp, Radar as RadarIcon, Filter, Printer, ArrowUpRight,
  ArrowDownRight, Minus, Info, ChevronRight, Layers,
} from "lucide-react";
import { exportToCSV, exportToExcel, exportToPDF } from "@/lib/exportUtils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
 
interface Props {
  monthlyData: MonthlyEntry[];
}
 
// ── Design Tokens ────────────────────────────────────────────────────────────
 
const STATUS_COLORS = {
  green:  { bg: "#059669", light: "#d1fae5", text: "#064e3b" },
  yellow: { bg: "#d97706", light: "#fef3c7", text: "#78350f" },
  red:    { bg: "#dc2626", light: "#fee2e2", text: "#7f1d1d" },
} as const;
 
const STATUS_LABELS = { green: "On Track", yellow: "At Risk", red: "Off Track" } as const;
 
const AREA_PALETTE = [
  "#0ea5e9", "#8b5cf6", "#10b981", "#f59e0b",
  "#ef4444", "#06b6d4", "#84cc16", "#ec4899",
  "#f97316", "#6366f1",
];
 
// ── Shared UI Primitives ──────────────────────────────────────────────────────
 
const StatusPill = ({ status }: { status: "green" | "yellow" | "red" }) => (
  <span
    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide"
    style={{ background: STATUS_COLORS[status].light, color: STATUS_COLORS[status].text }}
  >
    <span
      className="inline-block w-1.5 h-1.5 rounded-full"
      style={{ background: STATUS_COLORS[status].bg }}
    />
    {STATUS_LABELS[status]}
  </span>
);
 
const MiniBar = ({ percent }: { percent: number }) => {
  const status = getStatus(percent);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.min(percent, 100)}%`,
            background: STATUS_COLORS[status].bg,
          }}
        />
      </div>
      <span className="font-mono text-[11px] font-semibold text-muted-foreground w-9 text-right tabular-nums">
        {percent}%
      </span>
    </div>
  );
};
 
const DeltaChip = ({ value }: { value: number }) => {
  if (Math.abs(value) < 1)
    return <span className="flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="h-3 w-3" />0%</span>;
  if (value > 0)
    return <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-600"><ArrowUpRight className="h-3 w-3" />+{value}%</span>;
  return <span className="flex items-center gap-0.5 text-xs font-semibold text-red-500"><ArrowDownRight className="h-3 w-3" />{value}%</span>;
};
 
// ── Custom Tooltip ────────────────────────────────────────────────────────────
 
const ChartTooltip = ({
  active, payload, label,
}: {
  active?: boolean; payload?: any[]; label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card shadow-lg px-3 py-2 text-xs space-y-1 max-w-[220px]">
      {label && <p className="font-semibold text-foreground">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1 text-muted-foreground">
            <span className="inline-block w-2 h-2 rounded-sm" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-mono font-semibold">
            {typeof p.value === "number" && p.name?.includes("%")
              ? `${p.value}%`
              : typeof p.value === "number"
              ? p.value.toLocaleString()
              : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};
 
// ── Summary KPI Card ──────────────────────────────────────────────────────────
 
const KpiCard = ({
  label, value, delta, accent, icon,
}: {
  label: string; value: string | number; delta?: number;
  accent?: string; icon?: React.ReactNode;
}) => (
  <Card className="relative overflow-hidden">
    {accent && (
      <div
        className="absolute inset-y-0 left-0 w-1 rounded-l"
        style={{ background: accent }}
      />
    )}
    <CardContent className="p-4 pl-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">
            {label}
          </p>
          <p className="text-2xl font-bold tabular-nums mt-0.5">{value}</p>
          {delta !== undefined && (
            <div className="mt-1">
              <DeltaChip value={delta} />
            </div>
          )}
        </div>
        {icon && (
          <div className="shrink-0 p-2 rounded-lg bg-muted/60 text-muted-foreground">
            {icon}
          </div>
        )}
      </div>
    </CardContent>
  </Card>
);
 
// ── Section Header ────────────────────────────────────────────────────────────
 
const SectionTitle = ({
  title, description, action,
}: {
  title: string; description?: string; action?: React.ReactNode;
}) => (
  <div className="flex items-start justify-between gap-4">
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && (
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      )}
    </div>
    {action}
  </div>
);
 
// ── Main Component ────────────────────────────────────────────────────────────
 
export default function WorkspaceTab({ monthlyData }: Props) {
  const { fetchHospitalPerformanceData } = useDatabase();
  const [planIndicators, setPlanIndicators] = useState<any[]>([]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const rows = await fetchHospitalPerformanceData();
        if (!mounted) return;
        setPlanIndicators(mapToIndicators(rows as any));
      } catch (err) {
        console.error('Failed to load plan indicators for WorkspaceTab', err);
        setPlanIndicators([]);
      }
    })();
    return () => { mounted = false; };
  }, [fetchHospitalPerformanceData]);

  const sourceIndicators = planIndicators && planIndicators.length > 0 ? planIndicators : [];
  const [selectedArea, setSelectedArea] = useState("all");
  const [analysisPeriod, setAnalysisPeriod] = useState("monthly");
  const [referenceMonth, setReferenceMonth] = useState(MONTHS[MONTHS.length - 1]);
  const [viewMode, setViewMode] = useState("table");
  const [groupBy, setGroupBy] = useState<"department" | "indicator" | "status">("department");
  const printRef = useRef<HTMLDivElement>(null);
 
  const areas = useMemo(() => Array.from(new Set(sourceIndicators.map((i) => i.programArea))).sort(), [sourceIndicators]);
 
  // ── Computed Data ──────────────────────────────────────────────────────────
 
  const indicatorPerformance = useMemo(() => {
    const list = selectedArea === "all" ? sourceIndicators : sourceIndicators.filter((i) => i.programArea === selectedArea);
    return list.map((ind) => {
      const actual = getActualYTD(ind.code, monthlyData);
      const percent = ind.target === 0 ? 0 : Math.round((actual / ind.target) * 100);
      const status = getStatus(percent);
      return {
        code: ind.code,
        programArea: ind.programArea,
        subProgram: ind.subProgram,
        indicator: ind.indicator,
        unit: ind.unit,
        baseline: ind.baseline,
        target: ind.target,
        actual,
        percent,
        status,
        statusLabel: STATUS_LABELS[status],
        gap: Math.max(0, ind.target - actual),
      };
    });
  }, [monthlyData, selectedArea]);
 
  const deptSummary = useMemo(() =>
    areas.map((area) => {
      const areaInds = sourceIndicators.filter((i) => i.programArea === area);
      let green = 0, yellow = 0, red = 0, totalPercent = 0;
      areaInds.forEach((ind) => {
        const actual = getActualYTD(ind.code, monthlyData);
        const pct = ind.target === 0 ? 0 : Math.round((actual / ind.target) * 100);
        totalPercent += pct;
        const s = getStatus(pct);
        if (s === "green") green++;
        else if (s === "yellow") yellow++;
        else red++;
      });
      const total = areaInds.length;
      return {
        area,
        total,
        onTrack: green,
        atRisk: yellow,
        offTrack: red,
        avgPercent: total > 0 ? Math.round(totalPercent / total) : 0,
        onTrackPct: total > 0 ? Math.round((green / total) * 100) : 0,
        offTrackPct: total > 0 ? Math.round((red / total) * 100) : 0,
      };
    }), [monthlyData]);
 
  const statusDistribution = useMemo(() => {
    let g = 0, y = 0, r = 0;
    indicatorPerformance.forEach((d) => {
      if (d.status === "green") g++;
      else if (d.status === "yellow") y++;
      else r++;
    });
    return [
      { name: "On Track ≥90%", value: g, fill: STATUS_COLORS.green.bg },
      { name: "At Risk 70–89%", value: y, fill: STATUS_COLORS.yellow.bg },
      { name: "Off Track <70%", value: r, fill: STATUS_COLORS.red.bg },
    ];
  }, [indicatorPerformance]);
 
  const monthlyTrend = useMemo(() =>
    MONTHS.map((month) => {
      const filterInds = selectedArea === "all" ? sourceIndicators : sourceIndicators.filter((i) => i.programArea === selectedArea);
      let total = 0, count = 0;
      filterInds.forEach((ind) => {
        const e = monthlyData.find((x) => x.code === ind.code && x.month === month);
        if (e?.actual != null) { total += e.actual; count++; }
      });
      return {
        month: month.split(" ")[0],
        fullMonth: month,
        actual: total,
        avgActual: count > 0 ? Math.round(total / count) : 0,
      };
    }), [monthlyData, selectedArea]);
 
  const cumulativeTrend = useMemo(() => {
    const filterInds = selectedArea === "all" ? sourceIndicators : sourceIndicators.filter((i) => i.programArea === selectedArea);
    return MONTHS.map((month, idx) => {
      let totalActual = 0, totalTarget = 0;
      filterInds.forEach((ind) => {
        totalTarget += (ind.target / 12) * (idx + 1);
        for (let m = 0; m <= idx; m++) {
          const e = monthlyData.find((x) => x.code === ind.code && x.month === MONTHS[m]);
          totalActual += e?.actual ?? 0;
        }
      });
      return {
        month: month.split(" ")[0],
        fullMonth: month,
        Actual: totalActual,
        Target: Math.round(totalTarget),
        gap: Math.round(totalTarget) - totalActual,
      };
    });
  }, [monthlyData, selectedArea]);
 
  const topBottom = useMemo(() => {
    const sorted = [...indicatorPerformance].sort((a, b) => b.percent - a.percent);
    return { top5: sorted.slice(0, 5), bottom5: sorted.slice(-5).reverse() };
  }, [indicatorPerformance]);
 
  const radarData = useMemo(() =>
    areas.map((area) => {
      const areaInds = sourceIndicators.filter((i) => i.programArea === area);
      let total = 0;
      areaInds.forEach((ind) => {
        const actual = getActualYTD(ind.code, monthlyData);
        total += ind.target === 0 ? 0 : Math.round((actual / ind.target) * 100);
      });
      return {
        subject: area.length > 12 ? area.slice(0, 12) + "…" : area,
        fullArea: area,
        value: areaInds.length > 0 ? Math.round(total / areaInds.length) : 0,
        fullMark: 100,
      };
    }), [monthlyData]);
 
  const summaryStats = useMemo(() => {
    const total = indicatorPerformance.length;
    const onTrack = indicatorPerformance.filter((d) => d.status === "green").length;
    const atRisk = indicatorPerformance.filter((d) => d.status === "yellow").length;
    const offTrack = indicatorPerformance.filter((d) => d.status === "red").length;
    const avgPercent = total > 0
      ? Math.round(indicatorPerformance.reduce((s, d) => s + d.percent, 0) / total)
      : 0;
    return { total, onTrack, atRisk, offTrack, avgPercent };
  }, [indicatorPerformance]);
 
  // ── Export ─────────────────────────────────────────────────────────────────
 
  const getTableExportData = useCallback(() => {
    if (groupBy === "department") {
      return deptSummary.map((d) => ({
        "Department": d.area,
        "Total Indicators": d.total,
        "On Track": d.onTrack,
        "At Risk": d.atRisk,
        "Off Track": d.offTrack,
        "Avg Achievement %": d.avgPercent,
      }));
    }
    return indicatorPerformance.map((d) => ({
      "Code": d.code,
      "Program Area": d.programArea,
      "Sub-program": d.subProgram,
      "Indicator": d.indicator,
      "Unit": d.unit,
      "Baseline": d.baseline,
      "Target": d.target,
      "Actual (YTD)": d.actual,
      "% Achieved": d.percent,
      "Gap": d.gap,
      "Status": d.statusLabel,
    }));
  }, [groupBy, deptSummary, indicatorPerformance]);
 
  const handleExport = useCallback(
    (format: "csv" | "excel" | "pdf") => {
      const data = getTableExportData();
      const filename = `Analytics_${groupBy}_${new Date().toISOString().split("T")[0]}`;
      try {
        if (format === "csv") {
          exportToCSV(data, filename);
          toast.success("Exported as CSV");
        } else if (format === "excel") {
          exportToExcel(
            [
              {
                name: "Department Summary",
                data: deptSummary.map((d) => ({
                  "Department": d.area,
                  "Total": d.total,
                  "On Track": d.onTrack,
                  "At Risk": d.atRisk,
                  "Off Track": d.offTrack,
                  "Avg %": d.avgPercent,
                })),
              },
              {
                name: "Indicator Details",
                data: indicatorPerformance.map((d) => ({
                  "Code": d.code,
                  "Program Area": d.programArea,
                  "Indicator": d.indicator,
                  "Target": d.target,
                  "Actual": d.actual,
                  "% Achieved": d.percent,
                  "Status": d.statusLabel,
                })),
              },
              {
                name: "Monthly Trend",
                data: monthlyTrend.map((d) => ({
                  "Month": d.fullMonth,
                  "Total Actual": d.actual,
                  "Avg per Indicator": d.avgActual,
                })),
              },
            ],
            filename
          );
          toast.success("Exported as Excel (3 sheets)");
        } else {
          const headers = Object.keys(data[0]);
          const rows = data.map((d) =>
            headers.map((h) => d[h as keyof typeof d])
          );
          exportToPDF(
            `Analytics Workspace — ${groupBy === "department" ? "Department Summary" : "Indicator Details"}`,
            headers,
            rows as (string | number)[][],
            filename
          );
          toast.success("Exported as PDF");
        }
      } catch {
        toast.error("Export failed");
      }
    },
    [getTableExportData, groupBy, deptSummary, indicatorPerformance, monthlyTrend]
  );
 
  // ── Render ─────────────────────────────────────────────────────────────────
 
  return (
    <div ref={printRef} className="space-y-5 print:space-y-4">
 
      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between print:hidden">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Department filter */}
          <Select value={selectedArea} onValueChange={setSelectedArea}>
            <SelectTrigger className="h-8 w-[200px] text-xs">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {areas.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
 
          {/* Group by */}
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <Layers className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="department">By Department</SelectItem>
              <SelectItem value="indicator">By Indicator</SelectItem>
              <SelectItem value="status">By Status</SelectItem>
            </SelectContent>
          </Select>
 
          {/* Period */}
          <Select value={analysisPeriod} onValueChange={setAnalysisPeriod}>
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
            </SelectContent>
          </Select>
 
          {/* Month */}
          <Select value={referenceMonth} onValueChange={setReferenceMonth}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
 
        {/* Export buttons */}
        <div className="flex gap-1.5">
          {(
            [
              { fmt: "csv", icon: <FileText className="h-3.5 w-3.5" />, label: "CSV" },
              { fmt: "excel", icon: <FileSpreadsheet className="h-3.5 w-3.5" />, label: "Excel" },
              { fmt: "pdf", icon: <FileDown className="h-3.5 w-3.5" />, label: "PDF" },
            ] as const
          ).map(({ fmt, icon, label }) => (
            <Button
              key={fmt}
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => handleExport(fmt)}
            >
              {icon}{label}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => window.print()}
          >
            <Printer className="h-3.5 w-3.5" />Print
          </Button>
        </div>
      </div>
 
      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <KpiCard
          label="Total Indicators"
          value={summaryStats.total}
          accent="#6366f1"
        />
        <KpiCard
          label="On Track"
          value={summaryStats.onTrack}
          accent={STATUS_COLORS.green.bg}
        />
        <KpiCard
          label="At Risk"
          value={summaryStats.atRisk}
          accent={STATUS_COLORS.yellow.bg}
        />
        <KpiCard
          label="Off Track"
          value={summaryStats.offTrack}
          accent={STATUS_COLORS.red.bg}
        />
        <KpiCard
          label="Avg Achievement"
          value={`${summaryStats.avgPercent}%`}
          accent="#0ea5e9"
        />
      </div>
 
      {/* ── View Tabs ── */}
      <Tabs value={viewMode} onValueChange={setViewMode}>
        <TabsList className="h-9 print:hidden">
          <TabsTrigger value="table" className="gap-1.5 text-xs">
            <Table2 className="h-3.5 w-3.5" />Table
          </TabsTrigger>
          <TabsTrigger value="bar" className="gap-1.5 text-xs">
            <BarChart3 className="h-3.5 w-3.5" />Bar Chart
          </TabsTrigger>
          <TabsTrigger value="pie" className="gap-1.5 text-xs">
            <PieChartIcon className="h-3.5 w-3.5" />Pie Chart
          </TabsTrigger>
          <TabsTrigger value="trend" className="gap-1.5 text-xs">
            <TrendingUp className="h-3.5 w-3.5" />Trend
          </TabsTrigger>
          <TabsTrigger value="radar" className="gap-1.5 text-xs">
            <RadarIcon className="h-3.5 w-3.5" />Radar
          </TabsTrigger>
          <TabsTrigger value="recognition" className="gap-1.5 text-xs">
            <Award className="h-3.5 w-3.5" />Recognition
          </TabsTrigger>
        </TabsList>
 
        {/* ── TABLE ── */}
        <TabsContent value="table" className="mt-4">
          {groupBy === "department" ? (
            <Card>
              <CardHeader className="pb-3">
                <SectionTitle
                  title="Department Performance Summary"
                  description={`${deptSummary.length} departments · ${referenceMonth}`}
                />
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Department
                        </th>
                        <th className="text-center p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Total
                        </th>
                        <th className="text-center p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          On Track
                        </th>
                        <th className="text-center p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          At Risk
                        </th>
                        <th className="text-center p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Off Track
                        </th>
                        <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground min-w-[160px]">
                          Achievement
                        </th>
                        <th className="text-center p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {deptSummary
                        .sort((a, b) => b.avgPercent - a.avgPercent)
                        .map((d, i) => (
                          <tr
                            key={d.area}
                            className="hover:bg-muted/20 transition-colors"
                          >
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{
                                    background: AREA_PALETTE[i % AREA_PALETTE.length],
                                  }}
                                />
                                <span className="font-medium text-sm">{d.area}</span>
                              </div>
                            </td>
                            <td className="p-3 text-center font-mono text-sm">{d.total}</td>
                            <td className="p-3 text-center">
                              <span className="text-sm font-semibold text-emerald-600">
                                {d.onTrack}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <span className="text-sm font-semibold text-amber-600">
                                {d.atRisk}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <span className="text-sm font-semibold text-red-500">
                                {d.offTrack}
                              </span>
                            </td>
                            <td className="p-3 min-w-[160px]">
                              <MiniBar percent={d.avgPercent} />
                            </td>
                            <td className="p-3 text-center">
                              <StatusPill status={getStatus(d.avgPercent)} />
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <SectionTitle
                  title={
                    groupBy === "status"
                      ? "Indicators Sorted by Status"
                      : "Indicator-Level Performance"
                  }
                  description={`${indicatorPerformance.length} indicators`}
                />
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        {["Code", "Department", "Indicator", "Baseline", "Target", "Actual", "%", "Gap", "Status"].map(
                          (h) => (
                            <th
                              key={h}
                              className={cn(
                                "p-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground",
                                ["Baseline", "Target", "Actual", "%", "Gap"].includes(h)
                                  ? "text-right"
                                  : h === "Status"
                                  ? "text-center"
                                  : "text-left"
                              )}
                            >
                              {h}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {(groupBy === "status"
                        ? [...indicatorPerformance].sort((a, b) => a.percent - b.percent)
                        : indicatorPerformance
                      ).map((d) => (
                        <tr
                          key={d.code}
                          className="hover:bg-muted/20 transition-colors"
                        >
                          <td className="p-2.5">
                            <span className="font-mono text-xs font-bold text-primary">
                              {d.code}
                            </span>
                          </td>
                          <td className="p-2.5 text-muted-foreground max-w-[120px]">
                            <span className="truncate block">{d.programArea}</span>
                          </td>
                          <td className="p-2.5 max-w-[240px]">
                            <span
                              className="truncate block font-medium"
                              title={d.indicator}
                            >
                              {d.indicator}
                            </span>
                          </td>
                          <td className="p-2.5 text-right font-mono">{d.baseline}</td>
                          <td className="p-2.5 text-right font-mono">{d.target.toLocaleString()}</td>
                          <td className="p-2.5 text-right font-mono font-semibold text-primary">
                            {d.actual.toLocaleString()}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold">{d.percent}%</td>
                          <td className="p-2.5 text-right font-mono text-muted-foreground">
                            {d.gap > 0 ? d.gap.toLocaleString() : "—"}
                          </td>
                          <td className="p-2.5 text-center">
                            <StatusPill status={d.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
 
        {/* ── BAR CHART ── */}
        <TabsContent value="bar" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <SectionTitle title="Department Average Achievement" />
              </CardHeader>
              <CardContent>
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[...deptSummary].sort((a, b) => b.avgPercent - a.avgPercent)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${v}%`} />
                      <YAxis type="category" dataKey="area" width={130} tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip content={<ChartTooltip />} />
                      <ReferenceLine x={90} stroke={STATUS_COLORS.green.bg} strokeDasharray="4 2" label={{ value: "90%", fontSize: 9, fill: STATUS_COLORS.green.bg }} />
                      <ReferenceLine x={70} stroke={STATUS_COLORS.yellow.bg} strokeDasharray="4 2" label={{ value: "70%", fontSize: 9, fill: STATUS_COLORS.yellow.bg }} />
                      <Bar dataKey="avgPercent" name="Avg %" radius={[0, 3, 3, 0]}>
                        {deptSummary.map((d, i) => (
                          <Cell key={i} fill={STATUS_COLORS[getStatus(d.avgPercent)].bg} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
 
            <Card>
              <CardHeader className="pb-2">
                <SectionTitle title="Status Distribution by Department" />
              </CardHeader>
              <CardContent>
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={deptSummary}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="area" tick={{ fontSize: 8 }} height={70} angle={-30} textAnchor="end" stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      <Bar dataKey="onTrack" name="On Track" fill={STATUS_COLORS.green.bg} stackId="a" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="atRisk" name="At Risk" fill={STATUS_COLORS.yellow.bg} stackId="a" />
                      <Bar dataKey="offTrack" name="Off Track" fill={STATUS_COLORS.red.bg} stackId="a" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
 
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <SectionTitle
                  title="Top 10 Indicator Performance"
                  description="Sorted by % achieved"
                />
              </CardHeader>
              <CardContent>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[...indicatorPerformance].sort((a, b) => b.percent - a.percent).slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="code" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis domain={[0, 130]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${v}%`} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.[0]) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="rounded-lg border bg-card shadow-lg p-2.5 text-xs space-y-1 max-w-[220px]">
                              <p className="font-semibold line-clamp-2">{d.indicator}</p>
                              <p className="text-muted-foreground">
                                Target: {d.target.toLocaleString()} · Actual: {d.actual.toLocaleString()}
                              </p>
                              <StatusPill status={d.status} />
                            </div>
                          );
                        }}
                      />
                      <ReferenceLine y={90} stroke={STATUS_COLORS.green.bg} strokeDasharray="4 2" />
                      <Bar dataKey="percent" name="% Achieved" radius={[3, 3, 0, 0]}>
                        {indicatorPerformance.slice(0, 10).map((d, i) => (
                          <Cell key={i} fill={STATUS_COLORS[d.status].bg} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
 
        {/* ── PIE CHART ── */}
        <TabsContent value="pie" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <SectionTitle title="Overall Status Distribution" />
              </CardHeader>
              <CardContent>
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusDistribution}
                        cx="50%"
                        cy="50%"
                        outerRadius={110}
                        innerRadius={55}
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${(percent * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                      >
                        {statusDistribution.map((e, i) => (
                          <Cell key={i} fill={e.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: "11px" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
 
            <Card>
              <CardHeader className="pb-2">
                <SectionTitle title="Indicators per Department" />
              </CardHeader>
              <CardContent>
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={deptSummary.map((d, i) => ({
                          name: d.area,
                          value: d.total,
                          fill: AREA_PALETTE[i % AREA_PALETTE.length],
                        }))}
                        cx="50%"
                        cy="50%"
                        outerRadius={110}
                        dataKey="value"
                        label={({ name, value }) =>
                          `${name.slice(0, 10)}: ${value}`
                        }
                      >
                        {deptSummary.map((_, i) => (
                          <Cell key={i} fill={AREA_PALETTE[i % AREA_PALETTE.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
 
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <SectionTitle
                  title="Status Breakdown per Department"
                  description="Mini donut per department"
                />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {deptSummary.map((d) => {
                    const status = getStatus(d.avgPercent);
                    return (
                      <div
                        key={d.area}
                        className="flex flex-col items-center gap-1"
                      >
                        <div className="h-[90px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={[
                                  { value: d.onTrack, fill: STATUS_COLORS.green.bg },
                                  { value: d.atRisk, fill: STATUS_COLORS.yellow.bg },
                                  { value: d.offTrack, fill: STATUS_COLORS.red.bg },
                                  ...(d.total === 0
                                    ? [{ value: 1, fill: "hsl(var(--muted))" }]
                                    : []),
                                ]}
                                cx="50%"
                                cy="50%"
                                outerRadius={38}
                                innerRadius={22}
                                dataKey="value"
                                strokeWidth={0}
                              >
                                {[0, 1, 2].map((i) => (
                                  <Cell
                                    key={i}
                                    fill={
                                      [
                                        STATUS_COLORS.green.bg,
                                        STATUS_COLORS.yellow.bg,
                                        STATUS_COLORS.red.bg,
                                      ][i]
                                    }
                                  />
                                ))}
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <p
                          className="text-[10px] font-semibold text-center truncate w-full"
                          title={d.area}
                        >
                          {d.area}
                        </p>
                        <StatusPill status={status} />
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {d.avgPercent}% avg
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
 
        {/* ── TREND ── */}
        <TabsContent value="trend" className="mt-4">
          <div className="grid grid-cols-1 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <SectionTitle
                  title="Cumulative Target vs Actual"
                  description="Running totals across all indicators"
                />
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={cumulativeTrend}>
                      <defs>
                        <linearGradient id="grad-actual" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="grad-target" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      <Area type="monotone" dataKey="Target" stroke="#94a3b8" fill="url(#grad-target)" strokeDasharray="5 3" strokeWidth={1.5} />
                      <Area type="monotone" dataKey="Actual" stroke="#0ea5e9" fill="url(#grad-actual)" strokeWidth={2} dot={{ r: 3 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
 
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <SectionTitle title="Monthly Total Actuals" />
                </CardHeader>
                <CardContent>
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={monthlyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip content={<ChartTooltip />} />
                        <Area type="monotone" dataKey="actual" name="Total Actual" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.1} strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
 
              <Card>
                <CardHeader className="pb-2">
                  <SectionTitle title="Avg per Indicator" />
                </CardHeader>
                <CardContent>
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={monthlyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip content={<ChartTooltip />} />
                        <Line type="monotone" dataKey="avgActual" name="Avg per Indicator" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: "#10b981" }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
 
        {/* ── RADAR ── */}
        <TabsContent value="radar" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <SectionTitle
                title="Multi-Department Performance Radar"
                description="Average achievement % by program area"
              />
            </CardHeader>
            <CardContent>
              <div className="h-[420px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis
                      dataKey="subject"
                      tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 8 }} />
                    <Radar
                      name="Achievement %"
                      dataKey="value"
                      stroke="#0ea5e9"
                      fill="#0ea5e9"
                      fillOpacity={0.2}
                      strokeWidth={2}
                      dot={{ r: 4, fill: "#0ea5e9" }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.[0]) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="rounded-lg border bg-card shadow p-2 text-xs">
                            <p className="font-semibold">{d.fullArea}</p>
                            <p className="text-muted-foreground">{d.value}% avg achievement</p>
                          </div>
                        );
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
 
        {/* ── RECOGNITION ── */}
        <TabsContent value="recognition" className="mt-4">
          <RecognitionBoard monthlyData={monthlyData} />
        </TabsContent>
      </Tabs>
 
      {/* ── Top & Bottom Performers ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="text-lg">🏆</span> Top 5 Performers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {topBottom.top5.map((d, i) => (
              <div key={d.code} className="flex items-center gap-3">
                <span className="text-xs font-bold text-muted-foreground w-4 tabular-nums">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium" title={d.indicator}>
                    {d.indicator}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground">{d.code}</p>
                </div>
                <StatusPill status={d.status} />
                <span className="font-mono text-sm font-bold tabular-nums w-12 text-right">
                  {d.percent}%
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
 
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="text-lg">⚠️</span> Bottom 5 — Needs Attention
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {topBottom.bottom5.map((d, i) => (
              <div key={d.code} className="flex items-center gap-3">
                <span className="text-xs font-bold text-muted-foreground w-4 tabular-nums">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium" title={d.indicator}>
                    {d.indicator}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground">{d.code}</p>
                </div>
                <StatusPill status={d.status} />
                <span className="font-mono text-sm font-bold tabular-nums w-12 text-right">
                  {d.percent}%
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}