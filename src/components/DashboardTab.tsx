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
    <div className="space-y-6 animate-fade-in">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <SummaryCard icon={<CheckCircle2 className="h-5 w-5" />} label="Total Indicators" value={stats.total} colorClass="text-primary" />
        <SummaryCard icon={<TrendingUp className="h-5 w-5" />} label="On Track" value={stats.green} colorClass="text-status-green" />
        <SummaryCard icon={<AlertTriangle className="h-5 w-5" />} label="At Risk" value={stats.yellow} colorClass="text-status-yellow" />
        <SummaryCard icon={<XCircle className="h-5 w-5" />} label="Off Track" value={stats.red} colorClass="text-status-red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie chart */}
        <div className="glass-card rounded-xl border bg-card/50 p-6 backdrop-blur-md hover:shadow-lg transition-all duration-300">
          <h3 className="font-bold text-lg mb-4 bg-gradient-to-r from-primary to-cyan-500 bg-clip-text text-transparent">Overall Performance Distribution</h3>
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
          <div className="flex justify-center gap-4 mt-4 flex-wrap">
            {pieData.map((d) => (
              <div key={d.name} className="flex items-center gap-2 text-xs px-3 py-1 rounded-full bg-muted/50 backdrop-blur-sm hover:bg-muted transition-colors duration-200">
                <span className="w-3 h-3 rounded-full shadow-md" style={{ background: d.color }} />
                <span className="font-medium">{d.name}:</span>
                <strong>{d.value}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* Trend chart */}
        <div className="glass-card rounded-xl border bg-card/50 p-6 backdrop-blur-md hover:shadow-lg transition-all duration-300">
          <h3 className="font-bold text-lg mb-4 bg-gradient-to-r from-primary to-cyan-500 bg-clip-text text-transparent">Monthly Trends – Key Indicators</h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ borderRadius: '10px', backgroundColor: 'rgba(0,0,0,0.8)', border: 'none' }} />
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
                      strokeWidth={3}
                      dot={{ r: 4, fill: TREND_COLORS[i], filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
                      activeDot={{ r: 6, filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Traffic light table */}
      <div className="glass-card rounded-xl border bg-card/50 p-6 backdrop-blur-md">
        <h3 className="font-bold text-lg mb-6 bg-gradient-to-r from-primary to-cyan-500 bg-clip-text text-transparent">Program Area Performance Summary</h3>
        <div className="overflow-x-auto rounded-lg border border-border/50">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gradient-to-r from-primary/10 via-transparent to-cyan-500/10">
                <th className="table-header text-left p-4 font-bold">Program Area</th>
                <th className="table-header text-center p-4 font-bold">Total</th>
                <th className="table-header text-center p-4 font-bold">🟢 On Track</th>
                <th className="table-header text-center p-4 font-bold">🟡 At Risk</th>
                <th className="table-header text-center p-4 font-bold">🔴 Off Track</th>
                <th className="table-header text-center p-4 font-bold">Achievement</th>
              </tr>
            </thead>
            <tbody>
              {programSummary.map((ps, i) => {
                const achievePercent = ps.total > 0 ? Math.round((ps.green / ps.total) * 100) : 0;
                return (
                  <tr key={ps.area} className={`border-b transition-all duration-200 hover:bg-primary/5 ${i % 2 === 0 ? "" : "bg-muted/5"}`}>
                    <td className="p-4 font-semibold text-foreground">{ps.area}</td>
                    <td className="p-4 text-center font-mono font-bold text-lg">{ps.total}</td>
                    <td className="p-4 text-center"><span className="status-badge-green">{ps.green}</span></td>
                    <td className="p-4 text-center"><span className="status-badge-yellow">{ps.yellow}</span></td>
                    <td className="p-4 text-center"><span className="status-badge-red">{ps.red}</span></td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-24 h-2.5 rounded-full bg-muted/50 overflow-hidden shadow-inner">
                          <div
                            className="h-full rounded-full transition-all duration-500 shadow-lg"
                            style={{
                              width: `${achievePercent}%`,
                              background: achievePercent >= 90 ? `linear-gradient(90deg, ${STATUS_COLORS.green}, ${STATUS_COLORS.green})` : achievePercent >= 70 ? `linear-gradient(90deg, ${STATUS_COLORS.yellow}, ${STATUS_COLORS.yellow})` : `linear-gradient(90deg, ${STATUS_COLORS.red}, ${STATUS_COLORS.red})`,
                            }}
                          />
                        </div>
                        <span className="font-bold text-xs w-8 text-right">{achievePercent}%</span>
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
    <div className="group relative rounded-xl border bg-gradient-to-br from-card to-card/80 p-5 flex items-center gap-4 hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden card-3d">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      
      {/* Border Animation */}
      <div className="absolute inset-0 border border-transparent rounded-xl bg-gradient-to-r from-blue-500/20 to-cyan-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

      {/* Icon Container */}
      <div className={`relative z-10 p-3 rounded-lg bg-gradient-to-br from-${colorClass} to-${colorClass}/50 shadow-lg group-hover:scale-110 transition-transform duration-300 ${colorClass}`}>
        {icon}
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1">
        <p className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">{value}</p>
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider group-hover:text-foreground/80 transition-colors duration-300">{label}</p>
      </div>
    </div>
  );
}
