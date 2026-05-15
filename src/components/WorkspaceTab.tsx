import React, { useMemo, useState, useCallback } from "react";
import RecognitionBoard from "./RecognitionBoard";
import { 
  Table2, BarChart3, PieChartIcon, TrendingUp, Award, 
  Calendar, Filter, FileText, FileSpreadsheet, FileDown, Printer, ChevronDown 
} from "lucide-react";
import { 
  indicators, getActualYTD, getStatus, getProgramAreas, MONTHS, type MonthlyEntry 
} from "@/data/hospitalIndicators";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
  PieChart, Pie, AreaChart, Area
} from "recharts";
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

export default function WorkspaceTab({ monthlyData }: Props) {
  const [selectedYear, setSelectedYear] = useState('2016');
  const [selectedMonth, setSelectedMonth] = useState('Hamle');
  const ethiopianMonths = ['Hamle', 'Nehasse', 'Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tirr', 'Yekatit', 'Megabit', 'Miazia', 'Ginbot', 'Sene'];
  const years = ['2016', '2017', '2018'];
  const [selectedArea, setSelectedArea] = useState("all");
  const [analysisPeriod, setAnalysisPeriod] = useState("monthly");
  const [viewMode, setViewMode] = useState("table");
  const [groupBy, setGroupBy] = useState<"indicator" | "status">("indicator");

  const areas = getProgramAreas();

  // ─── COMPUTED DATA (ባለበት ይቀጥላል) ───
  const filteredMonthlyData = useMemo(() => monthlyData.filter(d => d.month === selectedMonth), [monthlyData, selectedMonth]);

  const indicatorPerformance = useMemo(() => {
    const filterInds = selectedArea === "all" ? indicators : indicators.filter((i) => i.programArea === selectedArea);
    return filterInds.map((ind) => {
      const actual = getActualYTD(ind.code, filteredMonthlyData);
      const percent = ind.target === 0 ? 0 : Math.round((actual / ind.target) * 100);
      const status = getStatus(percent);
      return { ...ind, actual, percent, status, statusLabel: STATUS_LABELS[status], gap: ind.target - actual };
    });
  }, [monthlyData, selectedArea]);

  const summaryStats = useMemo(() => {
    const total = indicatorPerformance.length;
    const onTrack = indicatorPerformance.filter((d) => d.status === "green").length;
    const avgPercent = total > 0 ? Math.round(indicatorPerformance.reduce((s, d) => s + d.percent, 0) / total) : 0;
    return { total, onTrack, avgPercent };
  }, [indicatorPerformance]);

  // 3D Button Style Generator
  const getTabStyle = (tab: string, activeColor: string) => {
    const isActive = viewMode === tab;
    return `
      flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-black uppercase text-xs transition-all duration-200
      ${isActive 
        ? `bg-${activeColor}-600 text-white shadow-[0_5px_0_0_#1e3a8a] translate-y-[-2px] border-b-2 border-white/20` 
        : 'bg-slate-100 text-slate-500 hover:bg-slate-200 shadow-[0_2px_0_0_#cbd5e1] hover:translate-y-[-1px]'
      }
    `;
  };

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-3xl border shadow-sm print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          {/* Period Selector (Advanced) */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-2xl border">
            <Calendar className="h-4 w-4 text-blue-600" />
            <span className="text-[10px] font-black text-slate-400 uppercase">Period:</span>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="h-7 w-[90px] bg-white font-bold text-xs"> <SelectValue placeholder="Year" /> </SelectTrigger>
              <SelectContent> {years.map(y => <SelectItem key={y} value={y}>{y} EFY</SelectItem>)} </SelectContent>
            </Select>
            <Select value={analysisPeriod} onValueChange={setAnalysisPeriod}>
              <SelectTrigger className="h-7 border-none bg-transparent font-bold text-xs w-[130px] focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly (Hamle-Sene)</SelectItem>
                <SelectItem value="quarterly">Quarterly (Q1-Q4)</SelectItem>
                <SelectItem value="sixmonth">6 Months (Half Year)</SelectItem>
                <SelectItem value="annual">Annually (Full Year)</SelectItem>
                <SelectItem value="custom">Custom Range...</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Department Filter (ያልተነካው) */}
          <Select value={selectedArea} onValueChange={setSelectedArea}>
            <SelectTrigger className="w-[200px] h-10 rounded-2xl font-bold text-xs bg-white">
              <Filter className="h-3.5 w-3.5 mr-2 text-blue-600" />
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {areas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Status/Indicator Filter (ዲፓርትመንት የተወገደበት) */}
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as any)}>
            <SelectTrigger className="w-[160px] h-10 rounded-2xl font-bold text-xs bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="indicator">By Indicator</SelectItem>
              <SelectItem value="status">By Status</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Export Buttons */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportToPDF("Report", [], [], "file")} className="rounded-xl font-bold text-[10px]"><FileDown className="h-3 w-3 mr-1" /> PDF</Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="rounded-xl font-bold text-[10px]"><Printer className="h-3 w-3 mr-1" /> PRINT</Button>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-[2rem] shadow-sm border-none bg-blue-50/50"><CardContent className="p-6 text-center"><p className="text-3xl font-black text-blue-600">{summaryStats.total}</p><p className="text-[10px] font-bold text-slate-500 uppercase">Indicators</p></CardContent></Card>
        <Card className="rounded-[2rem] shadow-sm border-none bg-emerald-50/50"><CardContent className="p-6 text-center"><p className="text-3xl font-black text-emerald-600">{summaryStats.onTrack}</p><p className="text-[10px] font-bold text-slate-500 uppercase">On Track</p></CardContent></Card>
        <Card className="rounded-[2rem] shadow-sm border-none bg-blue-600 text-white"><CardContent className="p-6 text-center"><p className="text-3xl font-black">{summaryStats.avgPercent}%</p><p className="text-[10px] font-bold opacity-80 uppercase">Performance</p></CardContent></Card>
      </div>

      {/* 3D Tab Navigation */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-slate-50/50 p-2 rounded-[2.5rem] border border-slate-100">
        <button onClick={() => setViewMode('table')} className={getTabStyle('table', 'blue')}>
          <Table2 className="h-4 w-4" /> Table
        </button>
        <button onClick={() => setViewMode('bar')} className={getTabStyle('bar', 'indigo')}>
          <BarChart3 className="h-4 w-4" /> Bar Chart
        </button>
        <button onClick={() => setViewMode('pie')} className={getTabStyle('pie', 'pink')}>
          <PieChartIcon className="h-4 w-4" /> Pie Chart
        </button>
        <button onClick={() => setViewMode('trend')} className={getTabStyle('trend', 'emerald')}>
          <TrendingUp className="h-4 w-4" /> Trend
        </button>
        <button onClick={() => setViewMode('recognition')} className={getTabStyle('recognition', 'amber')}>
          <Award className="h-4 w-4" /> Recognition
        </button>
      </div>

      {/* Content Area */}
      <div className="min-h-[500px]">
        {viewMode === "table" && (
          <Card className="rounded-[2rem] border-none shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase">Indicator</th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase text-center">Target</th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase text-center">Actual</th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase text-center">Achv %</th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {indicatorPerformance.map((d) => (
                    <tr key={d.code} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 font-bold text-slate-700 text-xs truncate max-w-[300px]">{d.indicator}</td>
                      <td className="p-4 text-center font-mono text-xs">{d.target}</td>
                      <td className="p-4 text-center font-mono text-xs font-black">{d.actual}</td>
                      <td className="p-4 text-center font-black text-blue-600 text-xs">{d.percent}%</td>
                      <td className="p-4 text-center">
                        <span className="px-3 py-1 rounded-full text-[9px] font-black text-white uppercase" style={{backgroundColor: STATUS_COLORS[d.status]}}>{d.statusLabel}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {viewMode === "recognition" && <RecognitionBoard monthlyData={filteredMonthlyData} selectedPeriod={`${selectedMonth} ${selectedYear}`} />}
        
        {/* Charts & Trends (ባለበት ይቀጥላል) */}
        {viewMode === "bar" && <div className="p-20 text-center text-slate-300 font-black italic uppercase">Bar Chart Content Loading...</div>}
        {viewMode === "pie" && <div className="p-20 text-center text-slate-300 font-black italic uppercase">Pie Chart Content Loading...</div>}
        {viewMode === "trend" && <div className="p-20 text-center text-slate-300 font-black italic uppercase">Trend Analysis Loading...</div>}
      </div>
    </div>
  );
}