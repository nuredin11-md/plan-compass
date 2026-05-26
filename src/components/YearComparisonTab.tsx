import { useState, useMemo } from "react";
import { getStatus, getActualYTD, MONTHS, type MonthlyEntry } from "@/data/hospitalIndicators";
import { useIndicators } from "@/context/IndicatorsContext";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
  LineChart, Line,
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Target, Activity, Calendar } from "lucide-react";

interface Props {
  monthlyData: MonthlyEntry[];
  compareData?: MonthlyEntry[];
  currentYear: number;
  compareYear?: number;
}

const STATUS_COLORS_HEX = { green: "#22895a", yellow: "#cc8000", red: "#dc2626" };

export default function YearComparisonTab({ monthlyData, compareData, currentYear, compareYear }: Props) {
  const [selectedArea, setSelectedArea] = useState("all");
  const { indicators } = useIndicators();
  const areas = useMemo(() => [...new Set(indicators.map((i) => i.programArea))], [indicators]);

  const getFilteredIndicators = () => {
    return selectedArea === "all" ? indicators : indicators.filter((i) => i.programArea === selectedArea);
  };

  // Side-by-side comparison
  const comparisonData = useMemo(() => {
    const filtered = getFilteredIndicators();
    return filtered.map((ind) => {
      const currentActual = getActualYTD(ind.code, monthlyData);
      const currentPercent = ind.target === 0 ? 0 : Math.round((currentActual / ind.target) * 100);
      const prevActual = compareData ? getActualYTD(ind.code, compareData) : 0;
      const prevPercent = ind.target === 0 ? 0 : Math.round((prevActual / ind.target) * 100);
      const change = currentPercent - prevPercent;
      return {
        code: ind.code,
        indicator: ind.indicator,
        programArea: ind.programArea,
        currentPercent,
        prevPercent,
        change,
        status: getStatus(currentPercent),
      };
    });
  }, [monthlyData, compareData, selectedArea]);

  // Area-level YoY comparison
  const areaYoY = useMemo(() => {
    return areas.map((area) => {
      const areaInds = indicators.filter((i) => i.programArea === area);
      let currentTotal = 0, prevTotal = 0;
      areaInds.forEach((ind) => {
        const cActual = getActualYTD(ind.code, monthlyData);
        currentTotal += ind.target === 0 ? 0 : Math.round((cActual / ind.target) * 100);
        if (compareData) {
          const pActual = getActualYTD(ind.code, compareData);
          prevTotal += ind.target === 0 ? 0 : Math.round((pActual / ind.target) * 100);
        }
      });
      const count = areaInds.length || 1;
      return {
        area: area.length > 15 ? area.substring(0, 15) + "…" : area,
        fullArea: area,
        current: Math.round(currentTotal / count),
        previous: compareData ? Math.round(prevTotal / count) : 0,
      };
    });
  }, [monthlyData, compareData]);

  // Monthly trend comparison
  const monthlyTrend = useMemo(() => {
    const filtered = getFilteredIndicators();
    return MONTHS.map((month, idx) => {
      let currentSum = 0, prevSum = 0;
      filtered.forEach((ind) => {
        const cEntry = monthlyData.find((e) => e.code === ind.code && e.month === month);
        currentSum += cEntry?.actual ?? 0;
        if (compareData) {
          const pEntry = compareData.find((e) => e.code === ind.code && e.month === month);
          prevSum += pEntry?.actual ?? 0;
        }
      });
      return {
        month: month.substring(0, 3),
        [String(currentYear)]: currentSum,
        ...(compareData ? { [String(compareYear)]: prevSum } : {}),
      };
    });
  }, [monthlyData, compareData, currentYear, compareYear, selectedArea]);

  if (!compareData) {
    return (
      <div className="rounded-lg border bg-card p-12 text-center">
        <p className="text-muted-foreground text-lg">Select a comparison year from the header to see year-over-year analysis.</p>
        <p className="text-sm text-muted-foreground mt-2">You need data from at least two different years to compare.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">Year-over-Year Performance Analysis</h2>
          <p className="text-xs text-muted-foreground">
            Comparative intelligence: <strong className="text-indigo-600">{currentYear}</strong> vs <strong className="text-slate-400">{compareYear}</strong>
          </p>
        </div>
        <Select value={selectedArea} onValueChange={setSelectedArea}>
          <SelectTrigger className="w-full sm:w-[280px]">
            <SelectValue placeholder="All Program Areas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Program Areas</SelectItem>
            {areas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* ── 3-Phase Strategic Timeline ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { 
            phase: "Stabilization (Q1-Q2)", 
            label: "EFY Start & Alignment", 
            desc: "Focus on baseline normalization and regional target setting.",
            color: "text-blue-600", bg: "bg-blue-50", icon: Target
          },
          { 
            phase: "Acceleration (Q2-Q3)", 
            label: "Mid-Term Execution", 
            desc: "Scaling high-impact service interventions across departments.",
            color: "text-amber-600", bg: "bg-amber-50", icon: Activity
          },
          { 
            phase: "Convergence (Q4)", 
            label: "Strategic Realization", 
            desc: "Closing the gap between annual targets and aggregate YTD actuals.",
            color: "text-emerald-600", bg: "bg-emerald-50", icon: Calendar
          },
        ].map((p, i) => (
          <Card key={i} className="border-none shadow-none bg-slate-50/50">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{p.phase}</span>
                <p.icon className={cn("h-4 w-4", p.color)} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">{p.label}</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed mt-1">{p.desc}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", p.bg, p.color)}>
                  {i === 0 ? "Verified" : i === 1 ? "Active Monitoring" : "Forecasted"}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Area-level YoY bar chart */}
        <div className="rounded-lg border bg-card p-5">
          <h3 className="font-semibold mb-4">Program Area YoY Comparison (Avg %)</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={areaYoY} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="area" width={120} tick={{ fontSize: 9 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="previous" name={String(compareYear)} fill="hsl(var(--muted))" radius={[0, 2, 2, 0]} />
                <Bar dataKey="current" name={String(currentYear)} fill="hsl(199, 89%, 38%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly trend line */}
        <div className="rounded-lg border bg-card p-5">
          <h3 className="font-semibold mb-4">Monthly Trend Comparison</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey={String(compareYear)} stroke="hsl(var(--muted))" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                <Line type="monotone" dataKey={String(currentYear)} stroke="hsl(199, 89%, 38%)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Indicator-level comparison table */}
      <div className="rounded-lg border bg-card p-5">
        <h3 className="font-semibold mb-4">Indicator-Level Year-over-Year Change</h3>
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0">
              <tr className="border-b bg-muted/50">
                <th className="table-header text-left p-2">Code</th>
                <th className="table-header text-left p-2 min-w-[200px]">Indicator</th>
                <th className="table-header text-right p-2">{compareYear} %</th>
                <th className="table-header text-right p-2">{currentYear} %</th>
                <th className="table-header text-right p-2">Change</th>
                <th className="table-header text-center p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {comparisonData.map((d, i) => (
                <tr key={d.code} className={`border-b last:border-0 ${i % 2 ? "bg-muted/10" : ""}`}>
                  <td className="p-2 font-mono text-xs text-primary">{d.code}</td>
                  <td className="p-2 text-xs">{d.indicator}</td>
                  <td className="p-2 text-right font-mono">{d.prevPercent}%</td>
                  <td className="p-2 text-right font-mono font-semibold">{d.currentPercent}%</td>
                  <td className="p-2 text-right font-mono font-semibold">
                    <span className={d.change > 0 ? "text-status-green" : d.change < 0 ? "text-status-red" : "text-muted-foreground"}>
                      {d.change > 0 ? "+" : ""}{d.change}%
                    </span>
                  </td>
                  <td className="p-2 text-center">
                    <span className={`status-badge-${d.status}`}>
                      {d.status === "green" ? "On Track" : d.status === "yellow" ? "At Risk" : "Off Track"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
