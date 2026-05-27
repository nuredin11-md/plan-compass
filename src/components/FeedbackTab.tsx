import { useMemo, useState, useRef, useCallback } from "react";
import { getActualYTD, getStatus, getProgramAreas, MONTHS, type MonthlyEntry } from "@/data/hospitalIndicators";
import { useIndicators } from "@/context/IndicatorsContext";
import { getDepartmentFeedbackData, getPeriodicPerformanceFeedback } from "@/lib/exportUtils";
import { exportToPDF } from "@/lib/exportUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDown, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Target, MessageSquareText, AlertCircle, TrendingUpIcon, Info } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { EmptyDataState } from "@/components/EmptyDataState";
import { validateDepartmentData, shouldGenerateFeedback } from "@/lib/dataValidation";

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
  const [timePeriod, setTimePeriod] = useState<"monthly" | "quarterly" | "semiannual" | "annual">("quarterly");
  const { indicators } = useIndicators();

  const feedbackData = useMemo(() => getDepartmentFeedbackData(monthlyData), [monthlyData]);
  const periodicFeedback = useMemo(() => getPeriodicPerformanceFeedback(monthlyData, timePeriod), [monthlyData, timePeriod]);

  // Validate data availability for feedback generation
  const dataValidation = useMemo(() => {
    if (selectedArea === "all") {
      const allAreas = [...new Set(indicators.map((i) => i.programArea))];
      const validations = new Map<string, ReturnType<typeof shouldGenerateFeedback>>();
      allAreas.forEach((area) => {
        const areaInds = indicators.filter((i) => i.programArea === area);
        const validation = shouldGenerateFeedback(areaInds, monthlyData, timePeriod, 0, 0.7);
        validations.set(area, validation);
      });
      return validations;
    } else {
      const areaInds = indicators.filter((i) => i.programArea === selectedArea);
      const validation = shouldGenerateFeedback(areaInds, monthlyData, timePeriod, 0, 0.7);
      return new Map([[selectedArea, validation]]);
    }
  }, [monthlyData, timePeriod, selectedArea]);

  const displayed = useMemo(
    () => (selectedArea === "all" ? feedbackData : feedbackData.filter((d) => d.area === selectedArea)),
    [feedbackData, selectedArea]
  );
  
  const displayedPeriodic = useMemo(
    () => (selectedArea === "all" ? periodicFeedback : periodicFeedback.filter((d) => d.area === selectedArea)),
    [periodicFeedback, selectedArea]
  );

  // Check if any data is available
  const hasAnyData = monthlyData.some((e) => e.actual !== null && e.actual !== undefined);

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
      {/* Filters & Period Selector */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
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

        <Select value={timePeriod} onValueChange={(v) => setTimePeriod(v as typeof timePeriod)}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="quarterly">Quarterly</SelectItem>
            <SelectItem value="semiannual">Semi-annual</SelectItem>
            <SelectItem value="annual">Annual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs: Annual vs Periodic */}
      <Tabs defaultValue="annual" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="annual" className="gap-1.5">Annual Feedback</TabsTrigger>
          <TabsTrigger value="periodic" className="gap-1.5">
            <AlertCircle className="h-4 w-4" /> {timePeriod.charAt(0).toUpperCase() + timePeriod.slice(1)} Performance
          </TabsTrigger>
        </TabsList>

        {/* ─── ANNUAL FEEDBACK TAB ─── */}
        <TabsContent value="annual" className="space-y-6 mt-6">
          {!hasAnyData ? (
            <EmptyDataState type="period" period="analysis" name="Annual Feedback" />
          ) : displayed.length === 0 ? (
            <EmptyDataState type="department" period="annual" />
          ) : (
            displayed.map((dept) => {
              const deptValidation = dataValidation.get(dept.area);
              const canShowFeedback = deptValidation?.shouldGenerate ?? false;

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
                    {/* Data Completeness Warning */}
                    {!canShowFeedback && deptValidation && (
                      <div className="p-3 rounded-lg border-l-4 border-l-orange-500 bg-orange-50 dark:bg-orange-950/30">
                        <p className="text-sm flex items-start gap-2 text-orange-900 dark:text-orange-200">
                          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span>{deptValidation.reason}</span>
                        </p>
                      </div>
                    )}

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

                    {/* Feedback narrative - Only show if data is sufficient */}
                    {canShowFeedback ? (
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
                    ) : (
                      <div className="p-4 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20">
                        <p className="text-sm text-muted-foreground flex items-start gap-2">
                          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          Feedback will be generated once sufficient data is submitted.
                        </p>
                      </div>
                    )}

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
            })
          )}
        </TabsContent>

        {/* ─── PERIODIC PERFORMANCE TAB ─── */}
        <TabsContent value="periodic" className="space-y-6 mt-6">
          {!hasAnyData ? (
            <EmptyDataState type="period" period={timePeriod} name={`${timePeriod.charAt(0).toUpperCase() + timePeriod.slice(1)} Performance`} />
          ) : displayedPeriodic.length === 0 ? (
            <EmptyDataState type="department" period={timePeriod} />
          ) : (
            displayedPeriodic.map((dept) => {
              const deptValidation = dataValidation.get(dept.area);
              const canShowAnalysis = deptValidation?.shouldGenerate ?? false;

              return (
                <Card key={dept.area} className={dept.hasIssue ? "border-l-4 border-l-orange-500" : "border-l-4 border-l-green-500"}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        {dept.hasIssue && <AlertCircle className="h-5 w-5 text-orange-500" />}
                        {dept.area}
                      </CardTitle>
                      <span className={`status-badge-${dept.status}`}>
                        {dept.status === "green" ? "On Track" : dept.status === "yellow" ? "At Risk" : "Below Target"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{dept.period.charAt(0).toUpperCase() + dept.period.slice(1)} Performance Analysis</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Data Completeness Warning */}
                    {!canShowAnalysis && deptValidation && (
                      <div className="p-3 rounded-lg border-l-4 border-l-orange-500 bg-orange-50 dark:bg-orange-950/30">
                        <p className="text-sm flex items-start gap-2 text-orange-900 dark:text-orange-200">
                          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span>{deptValidation.reason}</span>
                        </p>
                      </div>
                    )}

                    {/* Performance Summary */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-muted p-3 rounded-lg">
                        <p className="text-xs text-muted-foreground">Target</p>
                        <p className="text-2xl font-bold">{Math.round(dept.target)}</p>
                      </div>
                      <div className="bg-muted p-3 rounded-lg">
                        <p className="text-xs text-muted-foreground">Actual</p>
                        <p className="text-2xl font-bold">{Math.round(dept.actual)}</p>
                      </div>
                      <div className={`p-3 rounded-lg ${dept.variancePercent < -20 ? "bg-red-100 dark:bg-red-950" : dept.variancePercent > 20 ? "bg-green-100 dark:bg-green-950" : "bg-muted"}`}>
                        <p className="text-xs text-muted-foreground">Variance</p>
                        <p className={`text-2xl font-bold ${dept.variancePercent < -20 ? "text-red-600" : dept.variancePercent > 20 ? "text-green-600" : ""}`}>
                          {dept.variancePercent > 0 ? "+" : ""}{dept.variancePercent}%
                        </p>
                      </div>
                    </div>

                    {/* Recommendation - Only show if data is sufficient */}
                    {canShowAnalysis ? (
                      <div className={`p-4 rounded-lg border ${dept.variancePercent < -20 ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-900 dark:text-red-200" : dept.variancePercent > 20 ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900 text-green-900 dark:text-green-200" : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200"}`}>
                        <p className="font-semibold">📋 Recommendation</p>
                        <p className="text-sm mt-1">{dept.recommendation}</p>
                      </div>
                    ) : (
                      <div className="p-4 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20">
                        <p className="text-sm text-muted-foreground flex items-start gap-2">
                          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          Analysis will be available once sufficient data is submitted.
                        </p>
                      </div>
                    )}

                    {/* Critical Issues */}
                    {dept.criticalCount > 0 && canShowAnalysis && (
                      <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
                        <p className="font-semibold text-red-900 dark:text-red-200 flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4" /> {dept.criticalCount} Critical Issue{dept.criticalCount > 1 ? "s" : ""}
                        </p>
                        <ul className="text-sm mt-2 space-y-1 text-red-800 dark:text-red-300">
                          {dept.indicators
                            .filter((i) => i.severity === "critical")
                            .map((ind) => (
                              <li key={ind.code}>
                                • {ind.code}: {ind.variancePercent > 0 ? "+" : ""}{ind.variancePercent}% variance
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}

                    {/* Indicator Details Table */}
                    <div className="rounded-lg border overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                        <th className="table-header text-left p-2">Code</th>
                        <th className="table-header text-left p-2">Indicator</th>
                        <th className="table-header text-right p-2">Target</th>
                        <th className="table-header text-right p-2">Actual</th>
                        <th className="table-header text-right p-2">Variance</th>
                        <th className="table-header text-center p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dept.indicators.map((ind, i) => (
                        <tr key={ind.code} className={`border-b last:border-0 ${ind.hasIssue ? "bg-orange-50 dark:bg-orange-950/20" : ""} ${i % 2 && !ind.hasIssue ? "bg-muted/10" : ""}`}>
                          <td className="p-2 font-mono text-xs text-primary">{ind.code}</td>
                          <td className="p-2 text-xs">{ind.indicator}</td>
                          <td className="p-2 text-right font-mono">{Math.round(ind.target)}</td>
                          <td className="p-2 text-right font-mono font-semibold">{Math.round(ind.actual)}</td>
                          <td className="p-2 text-right font-mono font-semibold">
                            <span className={ind.variancePercent > 0 ? "text-status-green" : ind.variancePercent < 0 ? "text-status-red" : "text-muted-foreground"}>
                              {ind.variancePercent > 0 ? "+" : ""}{ind.variancePercent}%
                            </span>
                          </td>
                          <td className="p-2 text-center">
                            <span className={`status-badge-${ind.status}`}>
                              {ind.status === "green" ? "On Track" : ind.status === "yellow" ? "At Risk" : "Below Target"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>
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
