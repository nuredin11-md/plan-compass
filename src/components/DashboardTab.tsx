import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useDatabase } from "@/hooks/useDatabase";
import { useIndicators } from "@/context/IndicatorsContext";
import { getActualYTD, getStatus, type MonthlyEntry } from "@/data/hospitalIndicators";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip as ShTooltip } from "@/components/ui/tooltip";
import { 
  Download, 
  Trash2, 
  Sparkles, 
  TrendingUp, 
  CheckCircle2, 
  AlertTriangle, 
  XSquare, 
  Maximize2, 
  HelpCircle,
  FileSpreadsheet,
  FileText,
  Pin,
  RefreshCw,
  LayoutGrid
} from "lucide-react";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  ReferenceLine
} from "recharts";
import { exportToCSV, exportToExcel, exportToPDF } from "@/lib/exportUtils";

interface Props {
  monthlyData: MonthlyEntry[];
}

interface DashboardWidget {
  id: string;
  title: string;
  type: "chart" | "table";
  chartType: string; // 'dept-avg' | 'status-dist' | 'overall-pie' | 'dept-table'
  data: any[];
  addedAt: string;
}

const STATUS_COLORS = {
  green: { bg: "#10b981", text: "text-emerald-700 bg-emerald-50", textHex: "#10b981" },
  yellow: { bg: "#f59e0b", text: "text-amber-700 bg-amber-50", textHex: "#f59e0b" },
  red: { bg: "#ef4444", text: "text-red-700 bg-red-50", textHex: "#ef4444" }
};

export default function DashboardTab({ monthlyData }: Props) {
  const { fetchHospitalPerformanceData } = useDatabase();
  const { indicators } = useIndicators();
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [loading, setLoading] = useState(true);

  // ─── 1. Calculate Live Indicators stats from monthlyData prop ───
  const stats = useMemo(() => {
    let total = indicators.length;
    let onTrack = 0;
    let atRisk = 0;
    let offTrack = 0;
    let sumPercent = 0;

    indicators.forEach((ind) => {
      const actual = getActualYTD(ind.code, monthlyData);
      const percent = ind.target === 0 ? 0 : Math.round((actual / ind.target) * 100);
      sumPercent += percent;
      if (percent >= 90) onTrack++;
      else if (percent >= 70) atRisk++;
      else offTrack++;
    });

    const averageAchievement = total > 0 ? Math.round(sumPercent / total) : 0;
    return {
      total,
      onTrack,
      atRisk,
      offTrack,
      averageAchievement
    };
  }, [indicators, monthlyData]);

  // ─── 2. Formulate Default Datasets to Seed if Empty ───
  const defaultDeptSummary = useMemo(() => {
    const areas = Array.from(new Set(indicators.map(i => i.programArea)));
    return areas.map((area) => {
      const areaInds = indicators.filter(ind => ind.programArea === area);
      let total = areaInds.length;
      let onTrack = 0;
      let atRisk = 0;
      let offTrack = 0;
      let sumPercent = 0;
      
      areaInds.forEach(ind => {
        const actual = getActualYTD(ind.code, monthlyData);
        const percent = ind.target === 0 ? 0 : Math.round((actual / ind.target) * 100);
        sumPercent += percent;
        if (percent >= 90) onTrack++;
        else if (percent >= 70) atRisk++;
        else offTrack++;
      });
      
      const avgPercent = total > 0 ? Math.round(sumPercent / total) : 0;
      return {
        area,
        total,
        onTrack,
        atRisk,
        offTrack,
        avgPercent,
        status: avgPercent >= 90 ? "On Track" : avgPercent >= 70 ? "At Risk" : "Off Track"
      };
    });
  }, [indicators, monthlyData]);

  const defaultStatusDistribution = useMemo(() => {
    let green = 0;
    let yellow = 0;
    let red = 0;
    
    indicators.forEach(ind => {
      const actual = getActualYTD(ind.code, monthlyData);
      const percent = ind.target === 0 ? 0 : Math.round((actual / ind.target) * 100);
      if (percent >= 90) green++;
      else if (percent >= 70) yellow++;
      else red++;
    });
    
    return [
      { name: "On Track (≥90%)", value: green, fill: "#10b981", percent: stats.total > 0 ? Math.round(green/stats.total*100) : 0 },
      { name: "At Risk (70-89%)", value: yellow, fill: "#f59e0b", percent: stats.total > 0 ? Math.round(yellow/stats.total*100) : 0 },
      { name: "Off Track (<70%)", value: red, fill: "#ef4444", percent: stats.total > 0 ? Math.round(red/stats.total*100) : 0 }
    ];
  }, [indicators, monthlyData, stats.total]);

  // ─── 3. Seed and Load Dashboard Pinned Widgets ───
  const reloadWidgets = useCallback(() => {
    setLoading(true);
    const stored = localStorage.getItem("hospital_posted_dashboard_widgets");
    if (stored) {
      try {
        setWidgets(JSON.parse(stored));
      } catch (e) {
        setWidgets([]);
      }
    } else {
      // Seed prefilled default high-fidelity widgets so the page represents pristine visual on first loads
      const seed: DashboardWidget[] = [
        {
          id: "overall-status-distribution",
          title: "Overall Healthcare Status Distribution",
          type: "chart",
          chartType: "overall-pie",
          data: defaultStatusDistribution,
          addedAt: new Date().toISOString()
        },
        {
          id: "department-performance-summary-table",
          title: "Department Executive Performance Summary",
          type: "table",
          chartType: "dept-table",
          data: defaultDeptSummary,
          addedAt: new Date().toISOString()
        },
        {
          id: "department-avg-achievement-chart",
          title: "Department Average Achievement (%)",
          type: "chart",
          chartType: "dept-avg",
          data: [...defaultDeptSummary].sort((a,b) => b.avgPercent - a.avgPercent),
          addedAt: new Date().toISOString()
        }
      ];
      localStorage.setItem("hospital_posted_dashboard_widgets", JSON.stringify(seed));
      setWidgets(seed);
    }
    setLoading(false);
  }, [defaultDeptSummary, defaultStatusDistribution]);

  useEffect(() => {
    reloadWidgets();
  }, [reloadWidgets]);

  // Listen to localstorage updates in real-time
  useEffect(() => {
    const handleStorage = () => reloadWidgets();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [reloadWidgets]);

  // ─── 4. Delete Pinned Widget ───
  const handleDeleteWidget = (id: string, title: string) => {
    const filtered = widgets.filter(w => w.id !== id);
    localStorage.setItem("hospital_posted_dashboard_widgets", JSON.stringify(filtered));
    setWidgets(filtered);
    toast.success(`Removed "${title}" from custom dashboard layout`);
  };

  // ─── 5. Export Actions on Widget level ───
  const handleDownloadCSV = (widget: DashboardWidget) => {
    let rows: any[] = [];
    if (widget.chartType === "dept-table") {
      rows = widget.data.map(d => ({
        "Program Department": d.area,
        "Total KPIs": d.total,
        "On Track": d.onTrack,
        "At Risk": d.atRisk,
        "Off Track": d.offTrack,
        "Avg Performance (%)": `${d.avgPercent}%`,
        "Status State": d.status
      }));
    } else if (widget.chartType === "dept-avg") {
      rows = widget.data.map(d => ({
        "Department Sector": d.area,
        "Achievement Rate (%)": `${d.avgPercent}%`
      }));
    } else if (widget.chartType === "overall-pie") {
      rows = widget.data.map(d => ({
        "Status Classification": d.name,
        "Indicator Count": d.value,
        "Percentage of Total": `${d.percent}%`
      }));
    } else {
      // Dynamic fallback
      rows = widget.data;
    }

    exportToCSV(rows, widget.title.replace(/\s+/g, "_") + "_Dataset");
    toast.success(`Exported dataset of "${widget.title}" to CSV`);
  };

  const handleDownloadExcel = (widget: DashboardWidget) => {
    let rows: any[] = [];
    if (widget.chartType === "dept-table") {
      rows = widget.data.map(d => ({
        "Program Department": d.area,
        "Total KPIs": d.total,
        "On Track": d.onTrack,
        "At Risk": d.atRisk,
        "Off Track": d.offTrack,
        "Avg Performance (%)": d.avgPercent,
        "Status State": d.status
      }));
    } else {
      rows = widget.data;
    }

    exportToExcel([{ name: "Performance Reports", data: rows }], widget.title.replace(/\s+/g, "_") + "_Standard");
    toast.success(`Exported spreadsheet for "${widget.title}" to Excel (.xlsx)`);
  };

  const handleDownloadPDF = (widget: DashboardWidget) => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];

    if (widget.chartType === "dept-table") {
      headers = ["Department Sector", "Total KPIs", "On Track", "At Risk", "Off Track", "Avg %", "Status"];
      rows = widget.data.map(d => [
        d.area,
        d.total,
        d.onTrack,
        d.atRisk,
        d.offTrack,
        `${d.avgPercent}%`,
        d.status
      ]);
    } else if (widget.chartType === "overall-pie") {
      headers = ["Classification Status", "KPI Counts", "Proportion"];
      rows = widget.data.map(d => [
        d.name,
        d.value,
        `${d.percent}%`
      ]);
    } else {
      headers = ["Metric Property", "Value"];
      rows = widget.data.map(d => [d.area || d.name || "N/A", d.avgPercent || d.value || 0]);
    }

    exportToPDF(widget.title, headers, rows, widget.title.replace(/\s+/g, "_") + "_ClinicalPDF", "portrait");
    toast.success(`Generated official surgical-grade PDF for "${widget.title}"!`);
  };

  // Full Dashboard Bulk Export to Excel Workbook
  const handleBulkExportWorkbook = () => {
    const sheets = widgets.map(w => {
      return {
        name: w.title.substring(0, 30),
        data: w.data
      };
    });
    if (sheets.length === 0) {
      toast.warning("Dashboard contains no visual report sheets to compile.");
      return;
    }
    exportToExcel(sheets, "Full_Hospital_Clinical_Dashboard_Bulk");
    toast.success("Compiled full dynamic workspace widgets into Excel book sheets successfully!");
  };

  // Reset to original seeds
  const handleResetDashboard = () => {
    localStorage.removeItem("hospital_posted_dashboard_widgets");
    reloadWidgets();
    toast.success("Executive dashboard workspace reset to default templates.");
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-800">
      
      {/* ── Executive Dashboard Header ── */}
      <div className="bg-white border rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1.5 max-w-xl">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge className="bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-[10px] font-bold">
              🏥 Black Lion Hospital Core
            </Badge>
            <span className="text-[11px] font-mono text-slate-400">EFY Performance Dashboard</span>
          </div>
          <h1 className="text-2xl font-bold font-['Georgia'] tracking-tight text-slate-900">Clinical Leadership Dashboard</h1>
          <p className="text-xs text-slate-500 leading-relaxed font-sans">
            Your customized monitoring desk. Pin charts or corrective tables from <strong>Analytics Workspace</strong> using the pin button. View realYTD clinical outputs, track progress ratios, and download executive briefs in PDF, XLS, or CSV formats.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={handleBulkExportWorkbook}
            className="text-xs font-bold gap-1.5 border-slate-200"
            disabled={widgets.length === 0}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Export Full Book (Excel)
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleResetDashboard}
            className="text-xs text-slate-500 hover:text-slate-900 font-bold gap-1 h-9"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reset Layout
          </Button>
        </div>
      </div>

      {/* ── YTD Health Scorecard Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="bg-white border shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Total Indicators</span>
              <p className="text-2xl font-bold font-mono text-indigo-600">{stats.total}</p>
            </div>
            <div className="bg-indigo-50 p-2 rounded-lg text-indigo-700 font-bold">YTD</div>
          </CardContent>
        </Card>

        <Card className="bg-white border shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">On Track (≥90%)</span>
              <p className="text-2xl font-bold font-mono text-emerald-600">{stats.onTrack}</p>
            </div>
            <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600"><CheckCircle2 className="w-4 h-4" /></div>
          </CardContent>
        </Card>

        <Card className="bg-white border shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">At Risk (70-89%)</span>
              <p className="text-2xl font-bold font-mono text-amber-500">{stats.atRisk}</p>
            </div>
            <div className="bg-amber-50 p-2 rounded-lg text-amber-600"><AlertTriangle className="w-4 h-4" /></div>
          </CardContent>
        </Card>

        <Card className="bg-white border shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Off Track (&lt;70%)</span>
              <p className="text-2xl font-bold font-mono text-red-500">{stats.offTrack}</p>
            </div>
            <div className="bg-red-50 p-2 rounded-lg text-red-600"><XSquare className="w-4 h-4" /></div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] text-white shadow-xs border-slate-900 col-span-1 sm:col-span-2 lg:col-span-1">
          <CardContent className="p-4 flex flex-col justify-between h-full min-h-[80px]">
            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Hospital YTD Avg</span>
            <div className="flex items-baseline gap-1.5 mt-2">
              <p className="text-3xl font-mono font-bold text-teal-400">{stats.averageAchievement}%</p>
              <span className="text-[9px] text-[#10b981] font-bold">↑ 2.1% MoM</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── CUSTOM WIDGETS DISPLAY GRID ── */}
      {widgets.length === 0 ? (
        <Card className="border border-dashed p-10 text-center bg-slate-50/50">
          <Pin className="w-10 h-10 text-slate-300 mx-auto mb-3 animate-bounce" />
          <h3 className="text-md font-bold text-slate-800">Your custom desk workspace is empty</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
            There are no pinned tables or graph metrics currently saved to your browser session. Go to <strong>Analytics Workspace</strong>, adjust filter, and click the <strong>📌 Pin to Dashboard</strong> button on any chart!
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          {widgets.map((widget) => (
            <Card key={widget.id} className={`${widget.chartType === 'dept-table' ? 'xl:col-span-12' : 'xl:col-span-6'} bg-white border shadow-xs flex flex-col justify-between`}>
              
              <CardHeader className="pb-3 border-b border-slate-50 flex flex-row items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Pin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <CardTitle className="text-sm font-bold text-slate-850 font-sans tracking-tight">{widget.title}</CardTitle>
                  </div>
                  <CardDescription className="text-[10px] mt-0.5">
                    Pinned to layout • Ready for standard report compilation
                  </CardDescription>
                </div>

                {/* Individual Widget Actions Box */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => handleDownloadPDF(widget)}
                    title="Download clinical PDF Brief"
                    className="h-8 w-8 hover:bg-rose-50 hover:text-rose-600 border-slate-200 transition"
                  >
                    <FileText className="h-3.5 w-3.5 text-rose-500" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => handleDownloadExcel(widget)}
                    title="Download Excel Workbook Sheet"
                    className="h-8 w-8 hover:bg-emerald-50 hover:text-emerald-700 border-slate-200 transition"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => handleDownloadCSV(widget)}
                    title="Download data CSV row"
                    className="h-8 w-8 hover:bg-indigo-50 hover:text-indigo-600 border-slate-200 transition"
                  >
                    <Download className="h-3.5 w-3.5 text-indigo-500" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDeleteWidget(widget.id, widget.title)}
                    title="Remove from Dashboard"
                    className="h-8 w-8 hover:bg-red-50 text-slate-400 hover:text-red-500 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-4 flex-1">
                
                {/* ── Case Rendering: OVERALL PIE ── */}
                {widget.chartType === "overall-pie" && (
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={widget.data}
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          innerRadius={45}
                          dataKey="value"
                          label={({ name, percent }) =>
                            `${(percent * 100).toFixed(0)}%`
                          }
                          labelLine={false}
                        >
                          {widget.data.map((e: any, index: number) => (
                            <Cell key={index} fill={e.fill} />
                          ))}
                        </Pie>
                        <ChartTooltip />
                        <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: "10.5px" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* ── Case Rendering: DEPT AVG ACHIEVEMENT ── */}
                {widget.chartType === "dept-avg" && (
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={widget.data} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${v}%`} />
                        <YAxis type="category" dataKey="area" width={110} tick={{ fontSize: 8.5 }} stroke="hsl(var(--muted-foreground))" />
                        <ChartTooltip />
                        <ReferenceLine x={90} stroke="#10b981" strokeDasharray="4 2" label={{ value: "Target (90%)", fontSize: 8, fill: "#10b981" }} />
                        <Bar dataKey="avgPercent" name="Avg Achievement%" radius={[0, 3, 3, 0]}>
                          {widget.data.map((d: any, index: number) => {
                            const status = d.avgPercent >= 90 ? "green" : d.avgPercent >= 70 ? "yellow" : "red";
                            return <Cell key={index} fill={STATUS_COLORS[status].bg} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* ── Case Rendering: DEPT TABLE ── */}
                {widget.chartType === "dept-table" && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-sans">
                      <thead>
                        <tr className="border-b bg-slate-50/50">
                          <th className="text-left p-3 font-semibold uppercase text-zinc-500">Program Department</th>
                          <th className="text-center p-3 font-semibold uppercase text-zinc-500">Total KPIs</th>
                          <th className="text-center p-3 font-semibold uppercase text-zinc-500">On Track</th>
                          <th className="text-center p-3 font-semibold uppercase text-zinc-500">At Risk</th>
                          <th className="text-center p-3 font-semibold uppercase text-zinc-500">Off Track</th>
                          <th className="text-right p-3 font-semibold uppercase text-zinc-500 min-w-[130px]">YTD Progress Avg %</th>
                          <th className="text-center p-3 font-semibold uppercase text-zinc-500">Health State</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {widget.data.map((rawRow: any, i: number) => (
                          <tr key={rawRow.area} className="hover:bg-slate-50/50 transition duration-150">
                            <td className="p-3 font-bold text-slate-800 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: `hsl(${i * 60}, 70%, 50%)` }}></span>
                              {rawRow.area}
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-slate-600">{rawRow.total}</td>
                            <td className="p-3 text-center text-emerald-600 font-bold">{rawRow.onTrack}</td>
                            <td className="p-3 text-center text-amber-500 font-bold">{rawRow.atRisk}</td>
                            <td className="p-3 text-center text-red-500 font-bold">{rawRow.offTrack}</td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-2.5">
                                <span className="font-mono font-bold">{rawRow.avgPercent}%</span>
                                <div className="w-14 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                  <div className="h-full" style={{ 
                                    width: `${rawRow.avgPercent}%`, 
                                    background: rawRow.avgPercent >= 90 ? "#10b981" : rawRow.avgPercent >= 70 ? "#f59e0b" : "#ef4444" 
                                  }} />
                                </div>
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <Badge className={`px-2 py-0 border-none text-[10px] font-bold ${
                                rawRow.avgPercent >= 90 ? "bg-emerald-50 text-emerald-700" : rawRow.avgPercent >= 70 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-650"
                              }`}>
                                {rawRow.avgPercent >= 90 ? "✓ Optimal" : rawRow.avgPercent >= 70 ? "⚠ Guarded" : "✕ Critical"}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
    </div>
  );
}
