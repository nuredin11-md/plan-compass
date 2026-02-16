import { useMemo, useState } from "react";
import { indicators, getActualYTD, getStatus, getProgramAreas, MONTHS, type MonthlyEntry } from "@/data/hospitalIndicators";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  AreaChart, Area,
} from "recharts";

interface Props {
  monthlyData: MonthlyEntry[];
}

const STATUS_COLORS_HEX = { green: "#22895a", yellow: "#cc8000", red: "#dc2626" };
const AREA_COLORS = [
  "hsl(199, 89%, 38%)", "hsl(174, 62%, 40%)", "hsl(40, 90%, 50%)",
  "hsl(280, 60%, 50%)", "hsl(0, 72%, 51%)", "hsl(120, 50%, 40%)",
  "hsl(30, 80%, 50%)", "hsl(220, 70%, 55%)", "hsl(340, 70%, 50%)", "hsl(60, 70%, 40%)",
];

export default function AnalysisTab({ monthlyData }: Props) {
  const [selectedArea, setSelectedArea] = useState("all");
  const areas = getProgramAreas();

  // Program area comparison
  const areaComparison = useMemo(() => {
    return areas.map((area) => {
      const areaInds = indicators.filter((i) => i.programArea === area);
      let totalPercent = 0;
      areaInds.forEach((ind) => {
        const actual = getActualYTD(ind.code, monthlyData);
        const percent = ind.target === 0 ? 0 : Math.round((actual / ind.target) * 100);
        totalPercent += percent;
      });
      const avg = areaInds.length > 0 ? Math.round(totalPercent / areaInds.length) : 0;
      return { area: area.length > 18 ? area.substring(0, 18) + "…" : area, fullArea: area, avgPercent: avg, status: getStatus(avg) };
    });
  }, [monthlyData]);

  // Radar chart data
  const radarData = useMemo(() => {
    return areas.map((area) => {
      const areaInds = indicators.filter((i) => i.programArea === area);
      let totalPercent = 0;
      areaInds.forEach((ind) => {
        const actual = getActualYTD(ind.code, monthlyData);
        totalPercent += ind.target === 0 ? 0 : Math.round((actual / ind.target) * 100);
      });
      return {
        subject: area.length > 12 ? area.substring(0, 12) + "…" : area,
        value: areaInds.length > 0 ? Math.round(totalPercent / areaInds.length) : 0,
        fullMark: 100,
      };
    });
  }, [monthlyData]);

  // Monthly cumulative trend
  const cumulativeTrend = useMemo(() => {
    const filterInds = selectedArea === "all" ? indicators : indicators.filter((i) => i.programArea === selectedArea);
    return MONTHS.map((month, idx) => {
      let totalActual = 0;
      let totalTarget = 0;
      filterInds.forEach((ind) => {
        const monthlyTarget = ind.target / 12;
        totalTarget += monthlyTarget * (idx + 1);
        // Sum actuals up to this month
        for (let m = 0; m <= idx; m++) {
          const entry = monthlyData.find((e) => e.code === ind.code && e.month === MONTHS[m]);
          totalActual += entry?.actual ?? 0;
        }
      });
      // Reset for recalculation
      totalActual = 0;
      filterInds.forEach((ind) => {
        for (let m = 0; m <= idx; m++) {
          const entry = monthlyData.find((e) => e.code === ind.code && e.month === MONTHS[m]);
          totalActual += entry?.actual ?? 0;
        }
      });
      return {
        month: month.substring(0, 3),
        Actual: totalActual,
        Target: Math.round(totalTarget),
      };
    });
  }, [monthlyData, selectedArea]);

  // Top/Bottom performers
  const allPerformers = useMemo(() => {
    const filterInds = selectedArea === "all" ? indicators : indicators.filter((i) => i.programArea === selectedArea);
    return filterInds.map((ind) => {
      const actual = getActualYTD(ind.code, monthlyData);
      const percent = ind.target === 0 ? 0 : Math.round((actual / ind.target) * 100);
      return { ...ind, actual, percent, status: getStatus(percent) };
    }).sort((a, b) => b.percent - a.percent);
  }, [monthlyData, selectedArea]);

  const top5 = allPerformers.slice(0, 5);
  const bottom5 = [...allPerformers].reverse().slice(0, 5);

  // Department-level summary
  const deptSummary = useMemo(() => {
    return areas.map((area) => {
      const areaInds = indicators.filter((i) => i.programArea === area);
      let green = 0, yellow = 0, red = 0;
      areaInds.forEach((ind) => {
        const actual = getActualYTD(ind.code, monthlyData);
        const percent = ind.target === 0 ? 0 : Math.round((actual / ind.target) * 100);
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
        onTrackPct: total > 0 ? Math.round((green / total) * 100) : 0,
        offTrackPct: total > 0 ? Math.round((red / total) * 100) : 0,
      };
    });
  }, [monthlyData]);

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Program Area Comparison */}
        <div className="rounded-lg border bg-card p-5">
          <h3 className="font-semibold mb-4">Program Area Comparison (Avg % Achieved)</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={areaComparison} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis type="category" dataKey="area" width={130} tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip formatter={(v: number) => [`${v}%`, "Avg Achievement"]} />
                <Bar dataKey="avgPercent" radius={[0, 4, 4, 0]}>
                  {areaComparison.map((d, i) => (
                    <Cell key={i} fill={STATUS_COLORS_HEX[d.status]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Radar */}
        <div className="rounded-lg border bg-card p-5">
          <h3 className="font-semibold mb-4">Performance Radar</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 8 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 8 }} />
                <Radar name="Achievement" dataKey="value" stroke="hsl(199, 89%, 38%)" fill="hsl(199, 89%, 38%)" fillOpacity={0.25} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cumulative Trend */}
        <div className="rounded-lg border bg-card p-5 lg:col-span-2">
          <h3 className="font-semibold mb-4">Cumulative Target vs Actual Trend</h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cumulativeTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="Target" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted))" strokeDasharray="5 5" fillOpacity={0.3} />
                <Area type="monotone" dataKey="Actual" stroke="hsl(199, 89%, 38%)" fill="hsl(199, 89%, 38%)" fillOpacity={0.2} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
      </div>

      {/* Department Summary Table */}
      <div className="rounded-lg border bg-card p-5">
        <h3 className="font-semibold mb-4">Department-Level Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Department / Program Area</th>
                <th className="text-center p-3 font-medium">Total Indicators</th>
                <th className="text-center p-3 font-medium">On Track (≥90%)</th>
                <th className="text-center p-3 font-medium">At Risk (70–89%)</th>
                <th className="text-center p-3 font-medium">Off Track (&lt;70%)</th>
                <th className="text-center p-3 font-medium">On Track %</th>
                <th className="text-center p-3 font-medium">Off Track %</th>
              </tr>
            </thead>
            <tbody>
              {deptSummary.map((d, i) => (
                <tr key={d.area} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                  <td className="p-3 font-medium">{d.area}</td>
                  <td className="p-3 text-center font-mono">{d.total}</td>
                  <td className="p-3 text-center"><span className="status-badge-green">{d.onTrack}</span></td>
                  <td className="p-3 text-center"><span className="status-badge-yellow">{d.atRisk}</span></td>
                  <td className="p-3 text-center"><span className="status-badge-red">{d.offTrack}</span></td>
                  <td className="p-3 text-center font-mono font-semibold">{d.onTrackPct}%</td>
                  <td className="p-3 text-center font-mono font-semibold">{d.offTrackPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
        </div>
      </div>

      {/* Top & Bottom performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border bg-card p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2">🏆 Top 5 Performers</h3>
          <div className="space-y-2">
            {top5.map((d, i) => (
              <div key={d.code} className="flex items-center gap-3 text-sm">
                <span className="font-bold text-muted-foreground w-5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{d.indicator}</p>
                  <p className="text-xs text-muted-foreground font-mono">{d.code}</p>
                </div>
                <span className={`status-badge-${d.status}`}>{d.percent}%</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2">⚠️ Bottom 5 — Needs Attention</h3>
          <div className="space-y-2">
            {bottom5.map((d, i) => (
              <div key={d.code} className="flex items-center gap-3 text-sm">
                <span className="font-bold text-muted-foreground w-5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{d.indicator}</p>
                  <p className="text-xs text-muted-foreground font-mono">{d.code}</p>
                </div>
                <span className={`status-badge-${d.status}`}>{d.percent}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
