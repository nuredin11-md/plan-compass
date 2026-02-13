import { useMemo } from "react";
import { indicators, getStatus, getActualYTD, getProgramAreas, MONTHS, type MonthlyEntry } from "@/data/hospitalIndicators";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

interface Props {
  monthlyData: MonthlyEntry[];
}

const STATUS_COLORS = {
  green: "hsl(152, 60%, 42%)",
  yellow: "hsl(40, 90%, 50%)",
  red: "hsl(0, 72%, 51%)",
};

export default function DashboardTab({ monthlyData }: Props) {
  const stats = useMemo(() => {
    let green = 0, yellow = 0, red = 0;
    indicators.forEach((ind) => {
      const actual = getActualYTD(ind.code, monthlyData);
      const percent = ind.target === 0 ? 0 : Math.round((actual / ind.target) * 100);
      const s = getStatus(percent);
      if (s === "green") green++;
      else if (s === "yellow") yellow++;
      else red++;
    });
    return { green, yellow, red, total: indicators.length };
  }, [monthlyData]);

  const pieData = [
    { name: "On Track (≥90%)", value: stats.green, color: STATUS_COLORS.green },
    { name: "At Risk (70–89%)", value: stats.yellow, color: STATUS_COLORS.yellow },
    { name: "Off Track (<70%)", value: stats.red, color: STATUS_COLORS.red },
  ];

  const programSummary = useMemo(() => {
    return getProgramAreas().map((area) => {
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
      return { area, total: areaInds.length, green, yellow, red };
    });
  }, [monthlyData]);

  // Trend lines for key indicators
  const trendCodes = ["MCH_FP_01", "MCH_ANC_01", "CH_IMM_03", "CD_HIV_01", "MCH_DEL_01"];
  const trendData = useMemo(() => {
    return MONTHS.slice(0, 6).map((month) => {
      const point: Record<string, string | number> = { month: month.substring(0, 3) };
      trendCodes.forEach((code) => {
        const entry = monthlyData.find((e) => e.code === code && e.month === month);
        point[code] = entry?.actual ?? 0;
      });
      return point;
    });
  }, [monthlyData]);

  const TREND_COLORS = ["hsl(199, 89%, 38%)", "hsl(174, 62%, 40%)", "hsl(40, 90%, 50%)", "hsl(280, 60%, 50%)", "hsl(0, 72%, 51%)"];

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <SummaryCard icon={<CheckCircle2 className="h-5 w-5" />} label="Total Indicators" value={stats.total} colorClass="text-primary" />
        <SummaryCard icon={<TrendingUp className="h-5 w-5" />} label="On Track" value={stats.green} colorClass="text-status-green" />
        <SummaryCard icon={<AlertTriangle className="h-5 w-5" />} label="At Risk" value={stats.yellow} colorClass="text-status-yellow" />
        <SummaryCard icon={<XCircle className="h-5 w-5" />} label="Off Track" value={stats.red} colorClass="text-status-red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie chart */}
        <div className="rounded-lg border bg-card p-5">
          <h3 className="font-semibold mb-4">Overall Performance Distribution</h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={55} strokeWidth={2} stroke="hsl(var(--card))">
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-2">
            {pieData.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs">
                <span className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                {d.name}: <strong>{d.value}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* Trend chart */}
        <div className="rounded-lg border bg-card p-5">
          <h3 className="font-semibold mb-4">Monthly Trends – Key Indicators</h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {trendCodes.map((code, i) => {
                  const ind = indicators.find((x) => x.code === code);
                  return (
                    <Line
                      key={code}
                      type="monotone"
                      dataKey={code}
                      name={ind?.subProgram ?? code}
                      stroke={TREND_COLORS[i]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Traffic light table */}
      <div className="rounded-lg border bg-card p-5">
        <h3 className="font-semibold mb-4">Program Area Performance Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="table-header text-left p-3">Program Area</th>
                <th className="table-header text-center p-3">Total</th>
                <th className="table-header text-center p-3">🟢 On Track</th>
                <th className="table-header text-center p-3">🟡 At Risk</th>
                <th className="table-header text-center p-3">🔴 Off Track</th>
                <th className="table-header text-center p-3">Achievement</th>
              </tr>
            </thead>
            <tbody>
              {programSummary.map((ps, i) => {
                const achievePercent = ps.total > 0 ? Math.round((ps.green / ps.total) * 100) : 0;
                return (
                  <tr key={ps.area} className={`border-b last:border-0 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                    <td className="p-3 font-medium">{ps.area}</td>
                    <td className="p-3 text-center font-mono">{ps.total}</td>
                    <td className="p-3 text-center"><span className="status-badge-green">{ps.green}</span></td>
                    <td className="p-3 text-center"><span className="status-badge-yellow">{ps.yellow}</span></td>
                    <td className="p-3 text-center"><span className="status-badge-red">{ps.red}</span></td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-20 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${achievePercent}%`,
                              background: achievePercent >= 90 ? STATUS_COLORS.green : achievePercent >= 70 ? STATUS_COLORS.yellow : STATUS_COLORS.red,
                            }}
                          />
                        </div>
                        <span className="font-mono text-xs">{achievePercent}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value, colorClass }: { icon: React.ReactNode; label: string; value: number; colorClass: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 flex items-center gap-4">
      <div className={`${colorClass}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
