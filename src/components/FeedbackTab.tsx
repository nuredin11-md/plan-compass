import { useMemo, useState, useRef } from "react";
import { indicators, getActualYTD, getStatus, getProgramAreas, MONTHS, type MonthlyEntry } from "@/data/hospitalIndicators";
import { getDepartmentFeedbackData } from "@/lib/exportUtils";
import { exportToPDF } from "@/lib/exportUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FileDown, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Target, MessageSquareText } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface Props {
  monthlyData: MonthlyEntry[];
}

const STATUS_COLORS_HEX = {
  green: "#22895a",
  yellow: "#cc8000",
  red: "#dc2626",
};

export default function FeedbackTab({ monthlyData }: Props) {
  const [selectedArea, setSelectedArea] = useState("all");

  const feedbackData = useMemo(() => getDepartmentFeedbackData(monthlyData), [monthlyData]);

  const displayed = selectedArea === "all" ? feedbackData : feedbackData.filter((d) => d.area === selectedArea);

  const handleExportPDF = (areaData: ReturnType<typeof getDepartmentFeedbackData>[0]) => {
    const headers = ["Code", "Indicator", "Target", "Actual (YTD)", "% Achieved", "Status"];
    const rows = areaData.details.map((d) => [
      d.code,
      d.indicator,
      d.target,
      d.actual,
      `${d.percent}%`,
      d.status === "green" ? "On Track" : d.status === "yellow" ? "At Risk" : "Off Track",
    ]);
    exportToPDF(
      `Department Feedback: ${areaData.area} (Avg: ${areaData.avgPercent}%)`,
      headers,
      rows,
      `Feedback_${areaData.area.replace(/\s+/g, "_")}`
    );
  };

  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <Select value={selectedArea} onValueChange={setSelectedArea}>
          <SelectTrigger className="w-full sm:w-[280px]">
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {getProgramAreas().map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Department cards */}
      {displayed.map((dept) => {
        const chartData = dept.details.map((d) => ({
          name: d.code,
          percent: d.percent,
          status: d.status,
        }));

        const onTrack = dept.details.filter((d) => d.status === "green").length;
        const atRisk = dept.details.filter((d) => d.status === "yellow").length;
        const offTrack = dept.details.filter((d) => d.status === "red").length;

        const topPerformer = [...dept.details].sort((a, b) => b.percent - a.percent)[0];
        const bottomPerformer = [...dept.details].sort((a, b) => a.percent - b.percent)[0];

        return (
          <div key={dept.area} className="rounded-lg border bg-card overflow-hidden">
            {/* Header */}
            <div className="header-gradient p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MessageSquareText className="h-5 w-5 text-primary-foreground" />
                <div>
                  <h3 className="font-bold text-primary-foreground">{dept.area}</h3>
                  <p className="text-xs text-primary-foreground/80">
                    Average Achievement: {dept.avgPercent}% • {dept.details.length} indicators
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`status-badge-${dept.status}`}>
                  {dept.status === "green" ? "On Track" : dept.status === "yellow" ? "At Risk" : "Needs Attention"}
                </span>
                <Button size="sm" variant="secondary" onClick={() => handleExportPDF(dept)} className="gap-1">
                  <FileDown className="h-3.5 w-3.5" /> PDF
                </Button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Quick stats */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <MiniStat icon={<Target className="h-4 w-4" />} label="Indicators" value={dept.details.length} />
                <MiniStat icon={<CheckCircle2 className="h-4 w-4 text-status-green" />} label="On Track" value={onTrack} />
                <MiniStat icon={<AlertTriangle className="h-4 w-4 text-status-yellow" />} label="At Risk" value={atRisk} />
                <MiniStat icon={<TrendingDown className="h-4 w-4 text-status-red" />} label="Off Track" value={offTrack} />
                <MiniStat icon={<TrendingUp className="h-4 w-4 text-primary" />} label="Avg %" value={`${dept.avgPercent}%`} />
              </div>

              {/* Chart */}
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" angle={-45} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" domain={[0, 100]} />
                    <Tooltip formatter={(v: number) => [`${v}%`, "Achievement"]} />
                    <Bar dataKey="percent" radius={[3, 3, 0, 0]}>
                      {chartData.map((d, i) => (
                        <Cell key={i} fill={STATUS_COLORS_HEX[d.status]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Feedback narrative */}
              <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-2">
                <h4 className="font-semibold flex items-center gap-1.5">
                  <MessageSquareText className="h-4 w-4 text-primary" /> Performance Feedback
                </h4>
                <p>
                  The <strong>{dept.area}</strong> department has achieved an average of <strong>{dept.avgPercent}%</strong> towards
                  annual targets. {onTrack > 0 && <>{onTrack} indicator{onTrack > 1 ? "s are" : " is"} on track. </>}
                  {offTrack > 0 && (
                    <span className="text-status-red font-medium">
                      {offTrack} indicator{offTrack > 1 ? "s require" : " requires"} immediate attention.
                    </span>
                  )}
                </p>
                {topPerformer && (
                  <p>
                    <strong className="text-status-green">Best performer:</strong> {topPerformer.indicator} ({topPerformer.percent}%)
                  </p>
                )}
                {bottomPerformer && (
                  <p>
                    <strong className="text-status-red">Needs improvement:</strong> {bottomPerformer.indicator} ({bottomPerformer.percent}%)
                  </p>
                )}
                {dept.avgPercent < 50 && (
                  <p className="font-medium text-status-red">
                    ⚠ Recommendation: Conduct an urgent performance review meeting. Develop action plans for all off-track indicators.
                  </p>
                )}
                {dept.avgPercent >= 50 && dept.avgPercent < 70 && (
                  <p className="font-medium text-status-yellow">
                    ⚠ Recommendation: Schedule a departmental review to identify bottlenecks and reallocate resources to underperforming indicators.
                  </p>
                )}
                {dept.avgPercent >= 70 && dept.avgPercent < 90 && (
                  <p className="font-medium text-muted-foreground">
                    ✓ Good progress. Continue monitoring and maintain current strategies. Focus on pushing at-risk indicators above target.
                  </p>
                )}
                {dept.avgPercent >= 90 && (
                  <p className="font-medium text-status-green">
                    ✓ Excellent performance! Document best practices and share with other departments.
                  </p>
                )}
              </div>

              {/* Indicator table */}
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="table-header text-left p-2">Code</th>
                      <th className="table-header text-left p-2">Indicator</th>
                      <th className="table-header text-right p-2">Target</th>
                      <th className="table-header text-right p-2">Actual</th>
                      <th className="table-header text-right p-2">%</th>
                      <th className="table-header text-center p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dept.details.map((d, i) => (
                      <tr key={d.code} className={`border-b last:border-0 ${i % 2 ? "bg-muted/10" : ""}`}>
                        <td className="p-2 font-mono text-xs text-primary">{d.code}</td>
                        <td className="p-2 text-xs">{d.indicator}</td>
                        <td className="p-2 text-right font-mono">{d.target}</td>
                        <td className="p-2 text-right font-mono font-semibold">{d.actual}</td>
                        <td className="p-2 text-right font-mono font-semibold">{d.percent}%</td>
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
      })}
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-background p-3 flex items-center gap-2">
      {icon}
      <div>
        <p className="font-bold text-lg leading-tight">{value}</p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
