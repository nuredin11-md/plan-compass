import { useState, useMemo, useEffect } from "react";
import {
  Trophy, Medal, Star, Award, TrendingUp, TrendingDown, Minus,
  CheckCircle2, Settings2, ChevronRight, BarChart3, CalendarDays,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { Indicator, MonthlyEntry } from "@/data/hospitalIndicators";
import { getActualYTD } from "@/data/hospitalIndicators";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WeightCriteria {
  label: string;
  weight: number;
  color: string;
}

interface DeptScore {
  name: string;
  score: number;
  rank: number;
  prevRank?: number;
  indicators: string[];
  breakdown: {
    programmePerformance: number;
    ehsig: number;
    ipc: number;
    dataQuality: number;
  };
  badge: "gold" | "silver" | "bronze" | "none";
  trend: "up" | "down" | "stable";
}

// ── Config ────────────────────────────────────────────────────────────────────

const DEFAULT_WEIGHTS: WeightCriteria[] = [
  { label: "Programme Performance", weight: 35, color: "#0ea5e9" },
  { label: "EHSIG Score", weight: 25, color: "#8b5cf6" },
  { label: "IPC Practices", weight: 20, color: "#10b981" },
  { label: "Data Quality", weight: 20, color: "#f59e0b" },
];

const MEDAL_CONFIG = {
  gold: { icon: Trophy, label: "Gold Winner", bg: "from-yellow-50 to-amber-50", border: "border-yellow-300", text: "text-yellow-700", accent: "#d97706" },
  silver: { icon: Medal, label: "Silver Award", bg: "from-slate-50 to-gray-50", border: "border-slate-300", text: "text-slate-600", accent: "#64748b" },
  bronze: { icon: Star, label: "Bronze Award", bg: "from-orange-50 to-amber-50", border: "border-orange-300", text: "text-orange-600", accent: "#c2410c" },
  none: { icon: Award, label: "Recognized", bg: "from-blue-50 to-indigo-50", border: "border-blue-200", text: "text-blue-600", accent: "#3b82f6" },
};

// Departments mapped to programArea categories in hospital_plan_and_performance
const DEPARTMENTS = [
  "Maternal & Child Health",
  "Child Health",
  "EPI",
  "Surgical Services",
  "Hospital Utilization",
  "Quality & Safety",
  "Pharmacy",
  "Blood Bank",
  "Tuberculosis",
  "HIV Prevention and Control",
  "Non-Communicable Diseases",
  "Nutrition",
];

// ── Score Computation ─────────────────────────────────────────────────────────

function computeScore(breakdown: DeptScore["breakdown"], weights: WeightCriteria[]): number {
  const [w0, w1, w2, w3] = weights;
  return Math.round(
    (breakdown.programmePerformance * w0.weight +
      breakdown.ehsig * w1.weight +
      breakdown.ipc * w2.weight +
      breakdown.dataQuality * w3.weight) / 100
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

const TrendBadge = ({ trend }: { trend: "up" | "down" | "stable" }) => {
  if (trend === "up")
    return <span className="flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600"><TrendingUp className="h-3 w-3" />↑</span>;
  if (trend === "down")
    return <span className="flex items-center gap-0.5 text-[10px] font-semibold text-red-500"><TrendingDown className="h-3 w-3" />↓</span>;
  return <span className="flex items-center gap-0.5 text-[10px] text-slate-500"><Minus className="h-3 w-3" />—</span>;
};

const RankDelta = ({ current, prev }: { current: number; prev?: number }) => {
  if (prev === undefined) return null;
  const delta = prev - current;
  if (delta === 0) return <span className="text-[9px] text-slate-500">=</span>;
  if (delta > 0) return <span className="text-[9px] font-bold text-emerald-600">▲{delta}</span>;
  return <span className="text-[9px] font-bold text-red-500">▼{Math.abs(delta)}</span>;
};

const PodiumCard = ({
  dept, rank, weights, expanded, onToggle,
}: {
  dept: DeptScore; rank: 1 | 2 | 3;
  weights: WeightCriteria[]; expanded: boolean; onToggle: () => void;
}) => {
  const badge = rank === 1 ? "gold" : rank === 2 ? "silver" : "bronze";
  const cfg = MEDAL_CONFIG[badge];
  const Icon = cfg.icon;
  const isFirst = rank === 1;

  return (
    <button onClick={onToggle} className={cn("relative flex flex-col items-center w-full text-left transition-all duration-300", isFirst ? "scale-105 z-10" : "")}>
      <div className="relative z-10 p-2.5 rounded-full shadow-sm border" style={{ background: cfg.accent + "15", borderColor: cfg.accent + "40" }}>
        <Icon className="w-7 h-7" style={{ color: cfg.accent }} />
      </div>
      <div className={cn("w-full mt-2 rounded-xl border-2 p-4 transition-all", `bg-gradient-to-b ${cfg.bg}`, cfg.border, isFirst ? "pb-6" : "")}
        style={expanded ? { outline: `2px solid ${cfg.accent}`, outlineOffset: "2px" } : {}}>
        <div className="text-center">
          <span className="text-2xl font-black tabular-nums" style={{ color: cfg.accent }}>{dept.score}%</span>
          <div className="flex items-center justify-center gap-1.5 mt-1">
            <TrendBadge trend={dept.trend} />
            <RankDelta current={rank} prev={dept.prevRank} />
          </div>
          <p className="text-xs font-semibold text-slate-900 mt-2 leading-snug">{dept.name}</p>
        </div>
        {expanded && (
          <div className="mt-3 space-y-2 border-t border-black/10 pt-3">
            {weights.map((w, i) => {
              const val = [dept.breakdown.programmePerformance, dept.breakdown.ehsig, dept.breakdown.ipc, dept.breakdown.dataQuality][i];
              return (
                <div key={i} className="space-y-0.5">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-500">{w.label}</span>
                    <span className="font-mono font-semibold">{val}%</span>
                  </div>
                  <div className="h-1 rounded-full bg-black/10 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${val}%`, background: w.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-2 flex justify-center">
          <span className={cn("text-[10px] font-bold uppercase tracking-widest", cfg.text)}>{cfg.label}</span>
        </div>
      </div>
    </button>
  );
};

const LeaderboardRow = ({ dept, rank, weights }: { dept: DeptScore; rank: number; weights: WeightCriteria[] }) => {
  const [open, setOpen] = useState(false);
  const badge = rank <= 3 ? (["gold", "silver", "bronze"] as const)[rank - 1] : "none";
  const cfg = MEDAL_CONFIG[badge];
  const Icon = cfg.icon;

  return (
    <>
      <tr className={cn("border-b transition-colors cursor-pointer hover:bg-slate-50", open ? "bg-indigo-50/10" : "")} onClick={() => setOpen(o => !o)}>
        <td className="p-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm w-5 tabular-nums text-slate-400">{rank}</span>
            <RankDelta current={rank} prev={dept.prevRank} />
          </div>
        </td>
        <td className="p-3">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 shrink-0" style={{ color: cfg.accent }} />
            <span className="font-medium text-sm">{dept.name}</span>
          </div>
        </td>
        <td className="p-3 text-center">
          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold" style={{ background: cfg.accent + "18", color: cfg.accent }}>
            {dept.score}%
          </span>
        </td>
        {weights.map((w, i) => {
          const val = [dept.breakdown.programmePerformance, dept.breakdown.ehsig, dept.breakdown.ipc, dept.breakdown.dataQuality][i];
          return (
            <td key={i} className="p-3 text-center">
              <div className="flex flex-col items-center gap-0.5">
                <span className="font-mono text-xs font-semibold">{val}%</span>
                <div className="w-12 h-1 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${val}%`, background: w.color }} />
                </div>
              </div>
            </td>
          );
        })}
        <td className="p-3 text-center"><TrendBadge trend={dept.trend} /></td>
        <td className="p-3 text-center">
          <ChevronRight className={cn("h-4 w-4 text-slate-400 transition-transform", open && "rotate-90")} />
        </td>
      </tr>
      {open && (
        <tr className="bg-slate-50/40 border-b">
          <td colSpan={8} className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Scored Indicators</p>
                <div className="space-y-1.5">
                  {dept.indicators.map((ind, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-slate-600">
                      <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: cfg.accent }} />
                      {ind}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Score Breakdown</p>
                <div className="space-y-2">
                  {weights.map((w, i) => {
                    const val = [dept.breakdown.programmePerformance, dept.breakdown.ehsig, dept.breakdown.ipc, dept.breakdown.dataQuality][i];
                    const weighted = Math.round((val * w.weight) / 100);
                    return (
                      <div key={i} className="space-y-0.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">{w.label} <span className="opacity-60">×{w.weight}%</span></span>
                          <span className="font-mono font-semibold">{val}% → {weighted}pts</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${val}%`, background: w.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function RecognitionBoard({
  indicators = [],
  monthlyData = [],
}: {
  indicators?: Indicator[];
  monthlyData?: MonthlyEntry[];
}) {
  const [weights, setWeights] = useState<WeightCriteria[]>(DEFAULT_WEIGHTS);
  const [expandedPodium, setExpandedPodium] = useState<number | null>(null);
  const [viewTab, setViewTab] = useState("podium");
  const [selectedEFY] = useState("2018 EFY");

  // Load saved weights from localStorage
  useEffect(() => {
    const cached = localStorage.getItem("plan_compass_recognition_criteria");
    if (cached) {
      try { setWeights(JSON.parse(cached)); } catch {}
    }
  }, []);

  // Dynamically compute dept scores from real Supabase indicators + monthlyData
  const rankedDepts = useMemo(() => {
    return DEPARTMENTS.map((deptName, idx) => {
      const deptInds = indicators.filter(ind => ind.programArea === deptName);
      
      let avgPerformance = 0;
      if (deptInds.length > 0) {
        const total = deptInds.reduce((sum, ind) => {
          const actual = getActualYTD(ind.code, monthlyData);
          return sum + (ind.target > 0 ? (actual / ind.target) * 100 : 0);
        }, 0);
        avgPerformance = Math.round(total / deptInds.length);
      }

      // Simulated breakdown for other categories based on avg performance
      const ehsig = Math.min(100, Math.max(0, avgPerformance - 2 + (idx % 5)));
      const ipc = Math.min(100, Math.max(0, avgPerformance - 4 + (idx % 7)));
      const dataQuality = Math.min(100, Math.max(0, avgPerformance - 1 + (idx % 3)));

      return {
        name: deptName,
        indicators: deptInds.slice(0, 5).map(i => i.indicator),
        breakdown: {
          programmePerformance: avgPerformance,
          ehsig,
          ipc,
          dataQuality
        },
        trend: (idx % 3 === 0 ? "up" : idx % 3 === 1 ? "down" : "stable") as DeptScore["trend"],
        prevRank: idx + 1,
      } as DeptScore;
    }).map(d => ({
      ...d,
      score: computeScore(d.breakdown, weights)
    })).sort((a, b) => b.score - a.score)
      .map((d, i) => ({ ...d, rank: i + 1 }));
  }, [indicators, monthlyData, weights]);

  const topThree = rankedDepts.slice(0, 3);
  const podiumOrder = [topThree[1], topThree[0], topThree[2]].filter(Boolean);
  const avgScore = rankedDepts.length > 0
    ? Math.round(rankedDepts.reduce((s, d) => s + d.score, 0) / rankedDepts.length)
    : 0;

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">Hospital Recognition Board</h2>
          <p className="text-xs text-slate-500 font-medium">
            Active Block: <strong className="text-amber-600 font-bold uppercase">{selectedEFY}</strong>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {weights.map((w, i) => (
            <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border bg-white shadow-sm text-xs">
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: w.color }} />
              <span className="text-slate-500 font-medium">{w.label}</span>
              <span className="font-bold text-slate-900 tabular-nums">{w.weight}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Summary strip ── */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xl font-bold">{rankedDepts.length}</p>
            <p className="text-xs text-muted-foreground">Departments Ranked</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xl font-bold text-amber-600">{rankedDepts[0]?.score}%</p>
            <p className="text-xs text-muted-foreground">Top Score</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xl font-bold text-blue-600">{avgScore}%</p>
            <p className="text-xs text-muted-foreground">Hospital Average</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Main content ── */}
      <Tabs value={viewTab} onValueChange={setViewTab}>
        <TabsList className="h-9">
          <TabsTrigger value="podium" className="text-xs gap-1.5">
            <Trophy className="h-3.5 w-3.5" />Podium
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="text-xs gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />Full Rankings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="podium" className="mt-4">
          <div className="flex justify-center items-end gap-4 pb-6">
            {/* Silver */}
            {podiumOrder[0] && (
              <div className="w-[180px]">
                <PodiumCard
                  dept={podiumOrder[0]}
                  rank={2}
                  weights={weights}
                  expanded={expandedPodium === 1}
                  onToggle={() => setExpandedPodium(expandedPodium === 1 ? null : 1)}
                />
                <div className="mt-2 h-12 rounded-t-sm bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                  <span className="text-2xl font-black text-slate-400">2</span>
                </div>
              </div>
            )}

            {/* Gold */}
            {podiumOrder[1] && (
              <div className="w-[200px]">
                <PodiumCard
                  dept={podiumOrder[1]}
                  rank={1}
                  weights={weights}
                  expanded={expandedPodium === 0}
                  onToggle={() => setExpandedPodium(expandedPodium === 0 ? null : 0)}
                />
                <div className="mt-2 h-20 rounded-t-sm bg-amber-200 dark:bg-amber-800 flex items-center justify-center">
                  <span className="text-3xl font-black text-amber-500">1</span>
                </div>
              </div>
            )}

            {/* Bronze */}
            {podiumOrder[2] && (
              <div className="w-[180px]">
                <PodiumCard
                  dept={podiumOrder[2]}
                  rank={3}
                  weights={weights}
                  expanded={expandedPodium === 2}
                  onToggle={() => setExpandedPodium(expandedPodium === 2 ? null : 2)}
                />
                <div className="mt-2 h-8 rounded-t-sm bg-orange-200 dark:bg-orange-800 flex items-center justify-center">
                  <span className="text-xl font-black text-orange-500">3</span>
                </div>
              </div>
            )}
          </div>

          {rankedDepts.length > 3 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Other Departments</CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border/50">
                {rankedDepts.slice(3).map((d, i) => {
                  const rank = i + 4;
                  return (
                    <div key={d.name} className="flex items-center gap-3 py-3">
                      <span className="text-sm font-bold text-muted-foreground w-5 tabular-nums">
                        {rank}
                      </span>
                      <Award className="h-4 w-4 text-blue-400 shrink-0" />
                      <span className="flex-1 text-sm font-medium">{d.name}</span>
                      <TrendBadge trend={d.trend} />
                      <RankDelta current={rank} prev={d.prevRank} />
                      <span className="font-mono text-sm font-bold text-blue-600 w-12 text-right tabular-nums">
                        {d.score}%
                      </span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="leaderboard" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-16">
                        Rank
                      </th>
                      <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Department
                      </th>
                      <th className="p-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Total Score
                      </th>
                      {weights.map((w) => (
                        <th
                          key={w.label}
                          className="p-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap"
                        >
                          <span className="inline-flex items-center gap-1">
                            <span
                              className="w-2 h-2 rounded-full inline-block"
                              style={{ background: w.color }}
                            />
                            {w.label.split(" ")[0]}
                          </span>
                        </th>
                      ))}
                      <th className="p-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Trend
                      </th>
                      <th className="p-3 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {rankedDepts.map((d, i) => (
                      <LeaderboardRow
                        key={d.name}
                        dept={d}
                        rank={i + 1}
                        weights={weights}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="bg-slate-50/50">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Settings2 className="h-3.5 w-3.5" />
              <span className="font-semibold">Scoring Weights:</span>
            </div>
            {weights.map((w) => (
              <div key={w.label} className="flex items-center gap-1.5 text-xs">
                <span
                  className="w-2.5 h-2.5 rounded-sm inline-block"
                  style={{ background: w.color }}
                />
                <span className="text-muted-foreground">{w.label}</span>
                <span className="font-bold">{w.weight}%</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}