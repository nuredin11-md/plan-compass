import { useMemo, useState, useCallback } from "react";
import {
  indicators, getActualYTD, getStatus, getProgramAreas, MONTHS, type MonthlyEntry,
} from "@/data/hospitalIndicators";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
  PieChart, Pie, LineChart, Line, AreaChart, Area, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import {
  FileDown, FileSpreadsheet, FileText, Table2, BarChart3, PieChartIcon,
  TrendingUp, Radar as RadarIcon, Filter, Download, Printer,
} from "lucide-react";
import { exportToCSV, exportToExcel, exportToPDF } from "@/lib/exportUtils";
import { toast } from "sonner";

interface Props {
  monthlyData: MonthlyEntry[];
}

const STATUS_COLORS: Record<string, string> = {
  green: "#22895a",
  yellow: "#cc8000",
  red: "#dc2626",
};

const STATUS_LABELS: Record<string, string> = {
  green: "On Track",
  yellow: "At Risk",
  red: "Off Track",
};

const PIE_COLORS = ["#22895a", "#cc8000", "#dc2626"];
const AREA_COLORS = [
  "#0e88a8", "#2e9e8f", "#cc9200", "#8b5cf6", "#dc2626",
  "#16a34a", "#e67e22", "#3b82f6", "#ec4899", "#84cc16",
];

export default function WorkspaceTab({ monthlyData }: Props) {
  const [selectedArea, setSelectedArea] = useState("all");
  const [viewMode, setViewMode] = useState("table");
  const [groupBy, setGroupBy] = useState<"department" | "indicator" | "status">("department");

  const areas = getProgramAreas();

  // ─── COMPUTED DATA ───

  // Per-indicator performance
  const indicatorPerformance = useMemo(() => {
    const filterInds = selectedArea === "all" ? indicators : indicators.filter((i) => i.programArea === selectedArea);
    return filterInds.map((ind) => {
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
        gap: ind.target - actual,
      };
    });
  }, [monthlyData, selectedArea]);

  // Department summary
  const deptSummary = useMemo(() => {
    return areas.map((area) => {
      const areaInds = indicators.filter((i) => i.programArea === area);
      let green = 0, yellow = 0, red = 0, totalPercent = 0;
      areaInds.forEach((ind) => {
        const actual = getActualYTD(ind.code, monthlyData);
        const percent = ind.target === 0 ? 0 : Math.round((actual / ind.target) * 100);
        totalPercent += percent;
        const s = getStatus(percent);
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
    });
  }, [monthlyData]);

  // Status distribution (for pie)
  const statusDistribution = useMemo(() => {
    let green = 0, yellow = 0, red = 0;
    indicatorPerformance.forEach((d) => {
      if (d.status === "green") green++;
      else if (d.status === "yellow") yellow++;
      else red++;
    });
    return [
      { name: "On Track (≥90%)", value: green, fill: PIE_COLORS[0] },
      { name: "At Risk (70–89%)", value: yellow, fill: PIE_COLORS[1] },
      { name: "Off Track (<70%)", value: red, fill: PIE_COLORS[2] },
    ];
  }, [indicatorPerformance]);

  // Monthly trend per area
  const monthlyTrend = useMemo(() => {
    const filterInds = selectedArea === "all" ? indicators : indicators.filter((i) => i.programArea === selectedArea);
    return MONTHS.map((month) => {
      let totalActual = 0;
      let count = 0;
      filterInds.forEach((ind) => {
        const entry = monthlyData.find((e) => e.code === ind.code && e.month === month);
        if (entry?.actual !== null && entry?.actual !== undefined) {
          totalActual += entry.actual;
          count++;
        }
      });
      return {
        month: month.substring(0, 3),
        fullMonth: month,
        actual: totalActual,
        avgActual: count > 0 ? Math.round(totalActual / count) : 0,
      };
    });
  }, [monthlyData, selectedArea]);

  // Cumulative Target vs Actual trend
  const cumulativeTrend = useMemo(() => {
    const filterInds = selectedArea === "all" ? indicators : indicators.filter((i) => i.programArea === selectedArea);
    return MONTHS.map((month, idx) => {
      let totalActual = 0;
      let totalTarget = 0;
      filterInds.forEach((ind) => {
        const monthlyTarget = ind.target / 12;
        totalTarget += monthlyTarget * (idx + 1);
        for (let m = 0; m <= idx; m++) {
          const entry = monthlyData.find((e) => e.code === ind.code && e.month === MONTHS[m]);
          totalActual += entry?.actual ?? 0;
        }
      });
      // Recalculate actual properly
      totalActual = 0;
      filterInds.forEach((ind) => {
        for (let m = 0; m <= idx; m++) {
          const entry = monthlyData.find((e) => e.code === ind.code && e.month === MONTHS[m]);
          totalActual += entry?.actual ?? 0;
        }
      });
      return { month: month.substring(0, 3), fullMonth: month, Actual: totalActual, Target: Math.round(totalTarget) };
    });
  }, [monthlyData, selectedArea]);

  // Top & Bottom performers
  const topBottom = useMemo(() => {
    const sorted = [...indicatorPerformance].sort((a, b) => b.percent - a.percent);
    return { top5: sorted.slice(0, 5), bottom5: sorted.slice(-5).reverse() };
  }, [indicatorPerformance]);

  // Radar data
  const radarData = useMemo(() => {
    return areas.map((area) => {
      const areaInds = indicators.filter((i) => i.programArea === area);
      let totalPercent = 0;
      areaInds.forEach((ind) => {
        const actual = getActualYTD(ind.code, monthlyData);
        totalPercent += ind.target === 0 ? 0 : Math.round((actual / ind.target) * 100);
      });
      return {
        subject: area.length > 14 ? area.substring(0, 14) + "…" : area,
        fullArea: area,
        value: areaInds.length > 0 ? Math.round(totalPercent / areaInds.length) : 0,
        fullMark: 100,
      };
    });
  }, [monthlyData]);

  // ─── EXPORT FUNCTIONS ───

  const getTableExportData = useCallback(() => {
    if (groupBy === "department") {
      return deptSummary.map((d) => ({
        "Department": d.area,
        "Total Indicators": d.total,
        "On Track": d.onTrack,
        "At Risk": d.atRisk,
        "Off Track": d.offTrack,
        "Avg Achievement %": d.avgPercent,
        "On Track %": d.onTrackPct,
        "Off Track %": d.offTrackPct,
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

  const handleExport = useCallback((format: "csv" | "excel" | "pdf") => {
    const data = getTableExportData();
    const filename = `Analytics_Workspace_${groupBy}_${new Date().toISOString().split("T")[0]}`;

    try {
      if (format === "csv") {
        exportToCSV(data, filename);
        toast.success("Exported as CSV");
      } else if (format === "excel") {
        // Multi-sheet Excel export
        const sheets = [
          { name: "Summary by Department", data: deptSummary.map((d) => ({
            "Department": d.area, "Total": d.total, "On Track": d.onTrack,
            "At Risk": d.atRisk, "Off Track": d.offTrack, "Avg %": d.avgPercent,
          })) },
          { name: "Indicator Details", data: indicatorPerformance.map((d) => ({
            "Code": d.code, "Program Area": d.programArea, "Indicator": d.indicator,
            "Baseline": d.baseline, "Target": d.target, "Actual": d.actual,
            "% Achieved": d.percent, "Status": d.statusLabel,
          })) },
          { name: "Monthly Trend", data: monthlyTrend.map((d) => ({
            "Month": d.fullMonth, "Total Actual": d.actual, "Avg per Indicator": d.avgActual,
          })) },
        ];
        exportToExcel(sheets, filename);
        toast.success("Exported as Excel (3 sheets)");
      } else {
        const headers = Object.keys(data[0]);
        const rows = data.map((d) => headers.map((h) => d[h as keyof typeof d]));
        exportToPDF(`Analytics Workspace — ${groupBy === "department" ? "Department Summary" : "Indicator Details"}`, headers, rows as (string | number)[][], filename);
        toast.success("Exported as PDF");
      }
    } catch (err) {
      toast.error("Export failed");
      console.error("Export error:", err);
    }
  }, [getTableExportData, groupBy, deptSummary, indicatorPerformance, monthlyTrend]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // ─── SUMMARY STATS ───
  const summaryStats = useMemo(() => {
    const total = indicatorPerformance.length;
    const onTrack = indicatorPerformance.filter((d) => d.status === "green").length;
    const atRisk = indicatorPerformance.filter((d) => d.status === "yellow").length;
    const offTrack = indicatorPerformance.filter((d) => d.status === "red").length;
    const avgPercent = total > 0 ? Math.round(indicatorPerformance.reduce((s, d) => s + d.percent, 0) / total) : 0;
    return { total, onTrack, atRisk, offTrack, avgPercent };
  }, [indicatorPerformance]);

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header with Filters & Export */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between print:hidden">
        <div className="flex flex-wrap gap-3 items-center">
          <Select value={selectedArea} onValueChange={setSelectedArea}>
            <SelectTrigger className="w-[220px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {areas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Group by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="department">By Department</SelectItem>
              <SelectItem value="indicator">By Indicator</SelectItem>
              <SelectItem value="status">By Status</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport("csv")} className="gap-1.5">
            <FileText className="h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("excel")} className="gap-1.5">
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} className="gap-1.5">
            <FileDown className="h-4 w-4" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
            <Printer className="h-4 w-4" /> Print
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{summaryStats.total}</p>
            <p className="text-xs text-muted-foreground">Total Indicators</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{summaryStats.onTrack}</p>
            <p className="text-xs text-muted-foreground">On Track</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{summaryStats.atRisk}</p>
            <p className="text-xs text-muted-foreground">At Risk</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{summaryStats.offTrack}</p>
            <p className="text-xs text-muted-foreground">Off Track</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{summaryStats.avgPercent}%</p>
            <p className="text-xs text-muted-foreground">Avg Achievement</p>
          </CardContent>
        </Card>
      </div>

      {/* View Tabs */}
      <Tabs value={viewMode} onValueChange={setViewMode} className="w-full">
        <TabsList className="grid w-full grid-cols-5 print:hidden">
          <TabsTrigger value="table" className="gap-1.5"><Table2 className="h-4 w-4" /> Table</TabsTrigger>
          <TabsTrigger value="bar" className="gap-1.5"><BarChart3 className="h-4 w-4" /> Bar Chart</TabsTrigger>
          <TabsTrigger value="pie" className="gap-1.5"><PieChartIcon className="h-4 w-4" /> Pie Chart</TabsTrigger>
          <TabsTrigger value="trend" className="gap-1.5"><TrendingUp className="h-4 w-4" /> Trend</TabsTrigger>
          <TabsTrigger value="radar" className="gap-1.5"><RadarIcon className="h-4 w-4" /> Radar</TabsTrigger>
        </TabsList>

        {/* ─── TABLE VIEW ─── */}
        <TabsContent value="table" className="mt-4">
          {groupBy === "department" ? (
            <Card>
              <CardHeader><CardTitle className="text-base">Department Performance Summary</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">Department</th>
                        <th className="text-center p-3 font-medium">Total</th>
                        <th className="text-center p-3 font-medium">On Track</th>
                        <th className="text-center p-3 font-medium">At Risk</th>
                        <th className="text-center p-3 font-medium">Off Track</th>
                        <th className="text-center p-3 font-medium">Avg %</th>
                        <th className="text-center p-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deptSummary.map((d, i) => {
                        const status = getStatus(d.avgPercent);
                        return (
                          <tr key={d.area} className={`border-b last:border-0 hover:bg-muted/30 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                            <td className="p-3 font-medium">{d.area}</td>
                            <td className="p-3 text-center font-mono">{d.total}</td>
                            <td className="p-3 text-center"><span className="inline-flex items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold w-7 h-7">{d.onTrack}</span></td>
                            <td className="p-3 text-center"><span className="inline-flex items-center justify-center rounded-full bg-amber-100 text-amber-800 text-xs font-bold w-7 h-7">{d.atRisk}</span></td>
                            <td className="p-3 text-center"><span className="inline-flex items-center justify-center rounded-full bg-red-100 text-red-800 text-xs font-bold w-7 h-7">{d.offTrack}</span></td>
                            <td className="p-3 text-center font-mono font-semibold">{d.avgPercent}%</td>
                            <td className="p-3 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold text-white`}
                                style={{ backgroundColor: STATUS_COLORS[status] }}>
                                {STATUS_LABELS[status]}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {groupBy === "status" ? "Indicators Grouped by Status" : "Indicator-Level Performance"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-2 font-medium">Code</th>
                        <th className="text-left p-2 font-medium">Department</th>
                        <th className="text-left p-2 font-medium max-w-[200px]">Indicator</th>
                        <th className="text-center p-2 font-medium">Baseline</th>
                        <th className="text-center p-2 font-medium">Target</th>
                        <th className="text-center p-2 font-medium">Actual</th>
                        <th className="text-center p-2 font-medium">%</th>
                        <th className="text-center p-2 font-medium">Gap</th>
                        <th className="text-center p-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(groupBy === "status"
                        ? [...indicatorPerformance].sort((a, b) => a.percent - b.percent)
                        : indicatorPerformance
                      ).map((d, i) => (
                        <tr key={d.code} className={`border-b last:border-0 hover:bg-muted/30 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                          <td className="p-2 font-mono text-xs">{d.code}</td>
                          <td className="p-2 text-xs">{d.programArea}</td>
                          <td className="p-2 text-xs max-w-[200px] truncate" title={d.indicator}>{d.indicator}</td>
                          <td className="p-2 text-center font-mono text-xs">{d.baseline}</td>
                          <td className="p-2 text-center font-mono text-xs">{d.target}</td>
                          <td className="p-2 text-center font-mono text-xs font-semibold">{d.actual}</td>
                          <td className="p-2 text-center font-mono text-xs font-bold">{d.percent}%</td>
                          <td className="p-2 text-center font-mono text-xs">{d.gap > 0 ? d.gap : "—"}</td>
                          <td className="p-2 text-center">
                            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold text-white"
                              style={{ backgroundColor: STATUS_COLORS[d.status] }}>
                              {d.statusLabel}
                            </span>
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

        {/* ─── BAR CHART VIEW ─── */}
        <TabsContent value="bar" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Department Average Achievement (%)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={deptSummary} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis type="category" dataKey="area" width={140} tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip formatter={(v: number) => [`${v}%`, "Avg Achievement"]} />
                      <Bar dataKey="avgPercent" radius={[0, 4, 4, 0]}>
                        {deptSummary.map((d, i) => (
                          <Cell key={i} fill={STATUS_COLORS[getStatus(d.avgPercent)]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Status Distribution by Department</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={deptSummary}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="area" tick={{ fontSize: 8 }} height={80} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="onTrack" name="On Track" fill="#22895a" stackId="a" />
                      <Bar dataKey="atRisk" name="At Risk" fill="#cc8000" stackId="a" />
                      <Bar dataKey="offTrack" name="Off Track" fill="#dc2626" stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Top performers bar */}
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-base">Top 10 Indicator Performance</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={indicatorPerformance.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="code" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis domain={[0, 150]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip content={({ active, payload }) => {
                        if (active && payload?.[0]) {
                          const d = payload[0].payload;
                          return (
                            <div className="bg-card border rounded p-2 text-xs shadow-lg">
                              <p className="font-bold">{d.indicator}</p>
                              <p>Target: {d.target} | Actual: {d.actual}</p>
                              <p className="font-semibold">{d.percent}% — {d.statusLabel}</p>
                            </div>
                          );
                        }
                        return null;
                      }} />
                      <Bar dataKey="percent" radius={[4, 4, 0, 0]}>
                        {indicatorPerformance.slice(0, 10).map((d, i) => (
                          <Cell key={i} fill={STATUS_COLORS[d.status]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── PIE CHART VIEW ─── */}
        <TabsContent value="pie" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Overall Status Distribution</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusDistribution} cx="50%" cy="50%" outerRadius={120} innerRadius={60} dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                        {statusDistribution.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Indicators per Department</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={deptSummary.map((d, i) => ({ name: d.area, value: d.total, fill: AREA_COLORS[i % AREA_COLORS.length] }))}
                        cx="50%" cy="50%" outerRadius={120} dataKey="value"
                        label={({ name, value }) => `${name.substring(0, 12)}: ${value}`}>
                        {deptSummary.map((_, i) => (
                          <Cell key={i} fill={AREA_COLORS[i % AREA_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Per-department pie charts */}
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-base">Status Breakdown per Department</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {deptSummary.map((d) => (
                    <div key={d.area} className="text-center">
                      <div className="h-[120px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={[
                              { name: "On Track", value: d.onTrack, fill: "#22895a" },
                              { name: "At Risk", value: d.atRisk, fill: "#cc8000" },
                              { name: "Off Track", value: d.offTrack, fill: "#dc2626" },
                            ]} cx="50%" cy="50%" outerRadius={45} innerRadius={25} dataKey="value">
                              {[0, 1, 2].map((i) => (
                                <Cell key={i} fill={PIE_COLORS[i]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <p className="text-xs font-medium mt-1 truncate" title={d.area}>{d.area}</p>
                      <p className="text-xs text-muted-foreground">{d.avgPercent}% avg</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── TREND VIEW ─── */}
        <TabsContent value="trend" className="mt-4">
          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Monthly Performance Trend (Total Actuals)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip content={({ active, payload }) => {
                        if (active && payload?.[0]) {
                          const d = payload[0].payload;
                          return (
                            <div className="bg-card border rounded p-2 text-xs shadow-lg">
                              <p className="font-bold">{d.fullMonth}</p>
                              <p>Total: {d.actual}</p>
                              <p>Avg per Indicator: {d.avgActual}</p>
                            </div>
                          );
                        }
                        return null;
                      }} />
                      <Legend />
                      <Area type="monotone" dataKey="actual" name="Total Actual" stroke="#0e88a8" fill="#0e88a8" fillOpacity={0.15} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Monthly Average per Indicator</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="avgActual" name="Avg per Indicator" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Cumulative Target vs Actual */}
            <Card>
              <CardHeader><CardTitle className="text-base">Cumulative Target vs Actual</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={cumulativeTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip />
                      <Legend />
                      <Area type="monotone" dataKey="Target" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted))" strokeDasharray="5 5" fillOpacity={0.3} />
                      <Area type="monotone" dataKey="Actual" stroke="#0e88a8" fill="#0e88a8" fillOpacity={0.2} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── RADAR VIEW ─── */}
        <TabsContent value="radar" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Multi-Department Performance Radar</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[450px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9 }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 8 }} />
                    <Radar name="Achievement %" dataKey="value" stroke="#0e88a8" fill="#0e88a8" fillOpacity={0.25} strokeWidth={2} />
                    <Tooltip content={({ active, payload }) => {
                      if (active && payload?.[0]) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-card border rounded p-2 text-xs shadow-lg">
                            <p className="font-bold">{d.fullArea}</p>
                            <p>{d.value}% achievement</p>
                          </div>
                        );
                      }
                      return null;
                    }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Top & Bottom Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2">🏆 Top 5 Performers</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topBottom.top5.map((d, i) => (
                <div key={d.code} className="flex items-center gap-3 text-sm">
                  <span className="font-bold text-muted-foreground w-5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{d.indicator}</p>
                    <p className="text-xs text-muted-foreground font-mono">{d.code}</p>
                  </div>
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: STATUS_COLORS[d.status] }}>
                    {d.percent}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2">⚠️ Bottom 5 — Needs Attention</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topBottom.bottom5.map((d, i) => (
                <div key={d.code} className="flex items-center gap-3 text-sm">
                  <span className="font-bold text-muted-foreground w-5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{d.indicator}</p>
                    <p className="text-xs text-muted-foreground font-mono">{d.code}</p>
                  </div>
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: STATUS_COLORS[d.status] }}>
                    {d.percent}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
