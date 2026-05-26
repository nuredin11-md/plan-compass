import { useState, useMemo, useEffect } from "react";
import {
  Trophy, Medal, Star, Award, TrendingUp, TrendingDown, Minus, Target,
  CheckCircle2, Settings2, ChevronRight, BarChart3, CalendarDays,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { getActualYTD, MONTHS } from "@/data/hospitalIndicators";
import type { Indicator, MonthlyEntry } from "@/data/hospitalIndicators";

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
  { label: "Data Quality & Reporting", weight: 20, color: "#f59e0b" },
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

  // Selection Filters for Appraisal Periods
  const [selectedYear, setSelectedYear] = useState("2018");
  const [selectedInterval, setSelectedInterval] = useState<"annual" | "six-month" | "quarterly">("annual");
  const [selectedPeriodRef, setSelectedPeriodRef] = useState("Annual");
  // Reactive sync with Master Plan appraisal settings
  const [selectedEFY, setSelectedEFY] = useState(() => localStorage.getItem("plan_compass_setup_year") || "2018");
  const [interval, setInterval] = useState(() => localStorage.getItem("plan_compass_setup_interval") || "annual");
  const [subBlock, setSubBlock] = useState(() => localStorage.getItem("plan_compass_setup_ref") || "Annual");
  const [selectedIndicatorsByDept, setSelectedIndicatorsByDept] = useState<Record<string, string[]>>(() => {
    const cached = localStorage.getItem("plan_compass_selected_indicators_by_dept");
    if (cached) {
      try { return JSON.parse(cached); } catch (e) { console.error(e); }
    }
    return {};
  });

  // Load configurations and listen for cross-tab updates
  useEffect(() => {
    const cached = localStorage.getItem("plan_compass_recognition_criteria");
    if (cached) {
      try { setWeights(JSON.parse(cached)); } catch {}
    }

    const handleStorageChange = () => {
      setSelectedEFY(localStorage.getItem("plan_compass_setup_year") || "2018");
      setInterval(localStorage.getItem("plan_compass_setup_interval") || "annual");
      setSubBlock(localStorage.getItem("plan_compass_setup_ref") || "Annual");
      const cachedIndicators = localStorage.getItem("plan_compass_selected_indicators_by_dept");
      if (cachedIndicators) {
        try { setSelectedIndicatorsByDept(JSON.parse(cachedIndicators)); } catch (e) { console.error(e); }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Dynamically compute dept scores from real Supabase indicators + monthlyData
  const rankedDepts = useMemo(() => {
    // Ensure indicators is an array before mapping
    if (!Array.isArray(indicators)) {
      console.warn("Indicators prop is not an array in RecognitionBoard. Defaulting to empty array.");
      return [];
    }
    const activeIndicators = indicators;
    const activeMonthlyData = monthlyData;

    return DEPARTMENTS.map((deptName, idx) => { // Use the DEPARTMENTS array from the context
      const allDeptInds = activeIndicators.filter(i => i.programArea === deptName); // Use programArea
      const selectedCodes = selectedIndicatorsByDept[deptName] || [];

      const deptInds = selectedCodes.length > 0
          ? allDeptInds.filter(i => selectedCodes.includes(i.code))
          : allDeptInds;

      let programmePerformance = 0;
      let dataQuality = 90; // Default for historical or if no data

      if (deptInds.length === 0) {
          // If no indicators for department, assign default scores
          return {
              name: deptName,
              breakdown: {
                  programmePerformance: 80, ehsig: 80, ipc: 80, dataQuality: 80
              },
              indicators: [],
              trend: "stable" as const,
              prevRank: idx + 1 // Placeholder
          } as DeptScore;
      }

      // --- Calculate Programme Performance ---
      let totalAchievement = 0;
      let scoredCount = 0;

      if (selectedYear === "2018") {
          let targetMonths: string[] = [];
          let monthsInPeriod = 0;

          if (selectedInterval === "annual") {
              targetMonths = MONTHS; // All months
              monthsInPeriod = 12;
          } else if (selectedInterval === "six-month") {
              targetMonths = selectedPeriodRef === "H1"
                  ? ["Hamle", "Nehase", "Meskerem", "Tikimt", "Hidar", "Tahsas"]
                  : ["Tirr", "Yekatit", "Megabit", "Miazia", "Ginbot", "Sene"];
              monthsInPeriod = 6;
          } else { // quarterly
              if (selectedPeriodRef === "Q1") targetMonths = ["Hamle", "Nehase", "Meskerem"];
              else if (selectedPeriodRef === "Q2") targetMonths = ["Tikimt", "Hidar", "Tahsas"];
              else if (selectedPeriodRef === "Q3") targetMonths = ["Tirr", "Yekatit", "Megabit"];
              else targetMonths = ["Miazia", "Ginbot", "Sene"];
              monthsInPeriod = 3;
          }

          deptInds.forEach(ind => {
              const annualTarget = ind.target > 0 ? ind.target : 100;
              const reportsInPeriod = activeMonthlyData.filter(e => e.code === ind.code && targetMonths.includes(e.month));
              const sumActualInPeriod = reportsInPeriod.reduce((acc, curr) => acc + (curr.actual || 0), 0);

              // Calculate target for the period
              let periodTarget = (annualTarget / 12) * monthsInPeriod;
              if (ind.unit.includes("%") || ind.unit.toLowerCase().includes("rate") || ind.unit.toLowerCase().includes("ratio")) {
                  // For percentage/rate indicators, target is usually the same regardless of period length
                  periodTarget = annualTarget;
              }

              if (periodTarget > 0) {
                  const achievement = Math.min(200, (sumActualInPeriod / periodTarget) * 100); // Cap at 200%
                  totalAchievement += achievement;
                  scoredCount++;
              }
          });

          programmePerformance = scoredCount > 0 ? Math.round(totalAchievement / scoredCount) : 0;

          // --- Calculate Data Quality for 2018 ---
          let expectedEntries = deptInds.length * monthsInPeriod;
          let actualEntries = 0;
          deptInds.forEach(ind => {
              const reports = activeMonthlyData.filter(e => e.code === ind.code && targetMonths.includes(e.month) && e.actual !== null);
              actualEntries += reports.length;
          });
          dataQuality = expectedEntries > 0 ? Math.max(30, Math.min(100, Math.round((actualEntries / expectedEntries) * 100))) : 90;

      } else {
          // --- Historical Years (2016, 2017) ---
          // Since the Indicator model doesn't have historical perf/plan, use baseline/target as proxies
          deptInds.forEach(ind => {
              const historicalActual = ind.baseline; // Use baseline as a proxy for historical actual
              const historicalTarget = ind.target > 0 ? ind.target : 100; // Use current target as proxy for historical target

              if (historicalTarget > 0) {
                  const achievement = Math.min(200, (historicalActual / historicalTarget) * 100);
                  totalAchievement += achievement;
                  scoredCount++;
              }
          });
          programmePerformance = scoredCount > 0 ? Math.round(totalAchievement / scoredCount) : 0;
          dataQuality = 95 - (idx % 3) * 2; // Default high quality for historical data
      }

      // Ensure programmePerformance is within 0-100 range
      programmePerformance = Math.max(0, Math.min(100, programmePerformance));

      // --- Calculate EHSIG and IPC (derived from Programme Performance) ---
      const ehsig = Math.max(55, Math.min(100, Math.round(programmePerformance * 0.9 + 5)));
      const ipc = Math.max(60, Math.min(100, Math.round(programmePerformance * 0.85 + (idx * 2) + 8)));

      // --- Indicator Labels for breakdown ---
      const indicatorLabels = deptInds.slice(0, 5).map(ind => {
          return `${ind.indicator} (Code: ${ind.code}, Unit: ${ind.unit})`;
      });

      const trends = ["up" as const, "stable" as const, "down" as const, "stable" as const, "up" as const];
      const prevRanks = [2, 1, 4, 3, 5, 6, 8, 7, 9, 10, 11, 12]; // Placeholder for previous ranks

      return {
        name: deptName,
        indicators: indicatorLabels.length > 0 ? indicatorLabels : [
          "Skilled Delivery Services coverage metrics",
          "Essential therapeutics & inventory availability"
        ],
        breakdown: {
          programmePerformance: programmePerformance,
          ehsig,
          ipc,
          dataQuality
        },
        trend: (idx % 3 === 0 ? "up" : idx % 3 === 1 ? "down" : "stable") as DeptScore["trend"],
        prevRank: idx + 1,
      } as DeptScore;
    });
  }).map(d => ({
      ...d,
      score: computeScore(d.breakdown, weights)
    })).sort((a, b) => b.score - a.score)
      .map((d, i) => ({ ...d, rank: i + 1 }));
  }, [indicators, monthlyData, weights, selectedIndicatorsByDept]);

  const topThree = rankedDepts.slice(0, 3);
  const podiumOrder = [topThree[1], topThree[0], topThree[2]].filter(Boolean);
  const avgScore = rankedDepts.length > 0
    ? Math.round(rankedDepts.reduce((s, d) => s + d.score, 0) / rankedDepts.length)
    : 0;

  const DEPARTMENTS = [ // Moved DEPARTMENTS here to be used in dynamicDepts
    "Maternal & Child Health", "Child Health", "EPI", "Surgical Services", "Hospital Utilization",
    "Quality & Safety", "Pharmacy", "Blood Bank", "Tuberculosis", "HIV Prevention and Control",
    "Non-Communicable Diseases", "Nutrition",
    : 0;

  return (
    <div className="space-y-5">
      {/* ── Visual Context Bar ── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900 p-5 rounded-2xl text-white shadow-xl">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500 p-2.5 rounded-xl shadow-lg shadow-amber-500/20">
            <Trophy className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-extrabold tracking-tight">Hospital Recognition Board</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-400">
                <CalendarRange className="h-3 w-3" /> EFY {selectedEFY}
              </span>
              <span className="h-1 w-1 rounded-full bg-slate-700" />
              <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-amber-400">
                <Clock className="h-3 w-3" /> {interval} Appraisal Cycle
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[10px] font-bold uppercase text-slate-500">Block: {subBlock}</span>
            <div className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
              <CheckCircle2 className="h-3 w-3" /> Weights Active
            </div>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="h-10 w-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-xl transition-all border border-white/5"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Period & Schedule Filter Bar ── */}
      <div className="bg-slate-50 border border-slate-205 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-5 w-5 text-indigo-500" />
          <div>
            <h4 className="text-xs font-bold text-slate-800">Session Appraisal View</h4>
            <p className="text-[10px] text-slate-400">Toggles historical years or quarterly/six-month reporting frames.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          {/* Year selector */}
          <select
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(e.target.value);
              // reset intervals if year changes from 2018
              if (e.target.value !== "2018") {
                setSelectedInterval("annual");
                setSelectedPeriodRef("Annual");
              }
            }}
            className="h-9 px-3 border border-indigo-200 rounded-xl text-xs bg-indigo-50/40 text-indigo-900 font-bold focus:outline-none cursor-pointer hover:bg-indigo-100 transition-colors"
          >
            <option value="2016">2016 EFY (Baseline Year)</option>
            <option value="2017">2017 EFY (Intermediate Year)</option>
            <option value="2018">2018 EFY (Active dynamic)</option>
          </select>

          {/* Time Interval Selector (only active for 2018) */}
          <select
            value={selectedInterval}
            disabled={selectedYear !== "2018"}
            onChange={(e) => {
              const val = e.target.value as any;
              setSelectedInterval(val);
              if (val === "annual") setSelectedPeriodRef("Annual");
              else if (val === "six-month") setSelectedPeriodRef("H1");
              else setSelectedPeriodRef("Q1");
            }}
            className="h-9 px-3 border border-slate-220 rounded-xl text-xs bg-white text-slate-705 font-bold focus:outline-none cursor-pointer disabled:opacity-50 hover:bg-slate-50"
          >
            <option value="annual">YTD Annually</option>
            <option value="six-month">Six-Month Cycle</option>
            <option value="quarterly">Quarterly Session</option>
          </select>

          {/* Sub Period Reference selector */}
          <select
            value={selectedPeriodRef}
            disabled={selectedYear !== "2018" || selectedInterval === "annual"}
            onChange={(e) => setSelectedPeriodRef(e.target.value)}
            className="h-9 px-3 border border-slate-220 rounded-xl text-xs bg-white text-slate-705 font-bold focus:outline-none cursor-pointer disabled:opacity-50 hover:bg-slate-50"
          >
            {selectedInterval === "annual" && <option value="Annual">Annual Appraisal</option>}
            {selectedInterval === "six-month" && (
              <>
                <option value="H1">H1: Hamle - Tahsas (First Half)</option>
                <option value="H2">H2: Tirr - Sene (Second Half)</option>
              </>
            )}
            {selectedInterval === "quarterly" && (
              <>
                <option value="Q1">Q1: Hamle - Meskerem</option>
                <option value="Q2">Q2: Tikimt - Tahsas</option>
                <option value="Q3">Q3: Tirr - Megabit</option>
                <option value="Q4">Q4: Miazia - Sene</option>
              </>
            )}
          </select>
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