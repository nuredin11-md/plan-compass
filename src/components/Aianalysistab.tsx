import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  indicators as seedIndicators,
  getProgramAreas,
  type MonthlyEntry,
} from "@/data/hospitalIndicators";
import { useIndicators } from "@/context/IndicatorsContext";
import { useAuth } from "@/hooks/useAuth";
import RecognitionBoard from "./RecognitionBoard";
import {
  Sparkles, TrendingUp, Cpu, Calendar, AlertTriangle,
  ShieldCheck, Loader2, RefreshCw, BarChart3, UserCheck,
  Layers, AlertCircle, FileText, CheckCircle2, BedDouble,
  Users, Trophy,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  monthlyData: MonthlyEntry[];
}

interface TrendInsight {
  title: string;
  description: string;
  indicatorCode: string;
  trendDirection: "increasing" | "decreasing" | "stable" | "fluctuating";
}

interface ForecastedMonth {
  month: string;
  value: number;
  confidenceIntervalLower: number;
  confidenceIntervalUpper: number;
}

interface PredictionData {
  indicatorCode: string;
  indicatorName: string;
  forecastedMonths: ForecastedMonth[];
  staffingNeedScore: "adequate" | "warning_shortage" | "critical_shortage";
  bedOccupancyForecast: number;
  resourceGapAnalysis: string;
}

interface KpiEval {
  indicatorCode: string;
  name: string;
  baseline: number;
  target: number;
  currentActual: number;
  achievementPercentage: number;
  kpiStatus: "exceeded" | "on_track" | "off_track" | "critical";
  remedialGuidance: string;
}

interface Recommendation {
  title: string;
  actionSteps: string[];
  priority: "critical" | "high" | "medium";
  timeline: string;
  estimatedImpact: string;
}

interface AiAnalysisResult {
  trendAnalysis: { summary: string; insights: TrendInsight[] };
  predictiveModeling: { summary: string; predictions: PredictionData[] };
  kpiEvaluation: { summary: string; evaluations: KpiEval[] };
  overallRecommendations: Recommendation[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TrendIcon = ({ direction }: { direction: TrendInsight["trendDirection"] }) => {
  const map = {
    increasing:  { label: "Uptrending",  dot: "bg-emerald-500 animate-ping", ring: "bg-emerald-50 border-emerald-100 text-emerald-700" },
    decreasing:  { label: "Declining",   dot: "bg-rose-500",                 ring: "bg-rose-50 border-rose-100 text-rose-700" },
    stable:      { label: "Stabilizing", dot: "bg-indigo-500",               ring: "bg-indigo-50 border-indigo-100 text-indigo-700" },
    fluctuating: { label: "Fluctuating", dot: "bg-amber-500",                ring: "bg-amber-50 border-amber-100 text-amber-700" },
  }[direction];
  return (
    <div className={`flex items-center gap-1.5 font-bold border px-2 py-1 rounded-full text-xs ${map.ring}`}>
      <span className={`h-2 w-2 rounded-full ${map.dot}`} />
      {map.label}
    </div>
  );
};

const PriorityBadge = ({ priority }: { priority: Recommendation["priority"] }) => {
  if (priority === "critical")
    return <span className="bg-rose-50 border border-rose-200 text-rose-700 px-2.5 py-1 rounded-md font-mono text-xs font-bold uppercase animate-pulse">🔥 Critical</span>;
  if (priority === "high")
    return <span className="bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1 rounded-md font-mono text-xs font-bold uppercase">⚠️ High</span>;
  return <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded-md font-mono text-xs font-bold uppercase">⚡ Medium</span>;
};

const KpiStatusBadge = ({ status }: { status: KpiEval["kpiStatus"] }) => {
  const map = {
    exceeded:  "bg-emerald-500 text-white",
    on_track:  "bg-emerald-100 border border-emerald-200 text-emerald-800",
    off_track: "bg-amber-100 border border-amber-200 text-amber-800",
    critical:  "bg-rose-600 text-white animate-pulse",
  }[status];
  return <span className={`font-mono font-bold text-[10px] px-2.5 py-1 rounded uppercase ${map}`}>{status.replace("_", " ")}</span>;
};

const StaffingBadge = ({ score }: { score: PredictionData["staffingNeedScore"] }) => {
  const map = {
    adequate:          "bg-emerald-50 text-emerald-800 border-emerald-200",
    warning_shortage:  "bg-amber-50 text-amber-800 border-amber-200",
    critical_shortage: "bg-rose-50 text-rose-800 border-rose-250 animate-pulse",
  }[score];
  const label = { adequate: "Adequate", warning_shortage: "Staffing Warning", critical_shortage: "Critical Deficit" }[score];
  return <span className={`border font-semibold text-xs px-2 py-0.5 rounded-full ${map}`}>{label}</span>;
};

const ForecastChart = ({ prediction }: { prediction: PredictionData }) => {
  const [hoveredPoint, setHoveredPoint] = useState<{ month: string; value: number } | null>(null);

  return (
    <div className="h-40 bg-slate-50 rounded-xl relative border border-slate-100 px-8 pt-4 pb-6 overflow-hidden">
      {[100, 75, 50, 25, 0].map((g, gi) => (
        <div key={g} className="absolute left-0 right-0 border-t border-slate-200/50" style={{ top: `${gi * 25 + 12}px` }}>
          <span className="absolute left-2 text-[8px] font-mono font-bold text-slate-400" style={{ transform: "translateY(-50%)" }}>{g}%</span>
        </div>
      ))}
      <svg className="w-full h-full overflow-visible" viewBox="0 0 340 100" preserveAspectRatio="none">
        {(() => {
          const pts = prediction.forecastedMonths.map((m, mi) => ({
            x: (mi / Math.max(prediction.forecastedMonths.length - 1, 1)) * 340,
            y: 100 - (m.value / 100) * 100,
            yU: 100 - (m.confidenceIntervalUpper / 100) * 100,
            yL: 100 - (m.confidenceIntervalLower / 100) * 100,
            month: m.month, value: m.value,
          }));
          const bounds = pts.length > 0
            ? `M ${pts[0].x} ${pts[0].yU} ${pts.slice(1).map((p) => `L ${p.x} ${p.yU}`).join(" ")} L ${pts[pts.length - 1].x} ${pts[pts.length - 1].yL} ${[...pts].reverse().slice(1).map((p) => `L ${p.x} ${p.yL}`).join(" ")} Z`
            : "";
          const line = pts.length > 0
            ? `M ${pts[0].x} ${pts[0].y} ${pts.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ")}`
            : "";
          return (
            <>
              {bounds && <path d={bounds} fill="rgb(79,70,229)" fillOpacity="0.08" />}
              {line && <path d={line} fill="none" stroke="rgb(79,70,229)" strokeWidth="2.5" strokeDasharray="4 3" />}
              {pts.map((p, pi) => (
                <circle 
                  key={pi} 
                  cx={p.x} 
                  cy={p.y} 
                  r="4" 
                  fill="rgb(79,70,229)" 
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredPoint({ month: p.month, value: p.value })}
                  onMouseLeave={() => setHoveredPoint(null)} 
                />
              ))}
            </>
          );
        })()}
      </svg>
      <div className="absolute bottom-1 left-8 right-0 flex justify-between px-1 text-[9px] font-mono font-bold text-slate-400">
        {prediction.forecastedMonths.map((m, mi) => <span key={mi}>{m.month}</span>)}
      </div>
      {hoveredPoint && (
        <div className="absolute top-2 right-2 bg-slate-900/90 text-white rounded px-2 py-1 text-[9px] font-mono font-bold pointer-events-none flex gap-1 z-20">
          <span>{hoveredPoint.month}:</span>
          <span className="text-indigo-400">{hoveredPoint.value}%</span>
        </div>
      )}
    </div>
  );
};

// ── Constants ─────────────────────────────────────────────────────────────────

const ANALYSIS_STEPS = [
  "Securing connection with Plan Compass AI gateway…",
  "Reading registered hospital indicators and baselines…",
  "Extracting historical patient reporting matrices…",
  "Benchmarking indicators against EFY strategic goals…",
  "Configuring predictive mathematical trend grids…",
  "Polishing operational directives and remedial plans…",
];

// ── Main Component ────────────────────────────────────────────────────────────

export default function AiAnalysisTab({ monthlyData }: Props) {
  const { profile } = useAuth();
  const { indicators } = useIndicators(); // live list from context

  const areas = getProgramAreas();

  const [selectedDept, setSelectedDept]           = useState("all");
  const [selectedIndicatorCode, setSelectedCode]  = useState("All");
  const [loading, setLoading]                     = useState(false);
  const [loadingStep, setLoadingStep]             = useState("");
  const [error, setError]                         = useState<string | null>(null);
  const [result, setResult]                       = useState<AiAnalysisResult | null>(null);
  const [resultsSource, setResultsSource]         = useState<"gemini" | "mock">("mock");
  const [activeSubTab, setActiveSubTab]           = useState<"trends" | "predictions" | "evaluation" | "recommendations" | "recognition">("trends");

  // Filter indicators for payload
  const filteredIndicators = useMemo(() => {
    return indicators.filter((ind) => {
      const matchesDept = selectedDept === "all" || ind.programArea === selectedDept;
      const matchesInd  = selectedIndicatorCode === "All" || ind.code === selectedIndicatorCode;
      return matchesDept && matchesInd;
    });
  }, [indicators, selectedDept, selectedIndicatorCode]);

  const filteredMonthlyData = useMemo(() => {
    const codes = new Set(filteredIndicators.map((i) => i.code));
    return monthlyData.filter((m) => codes.has(m.code));
  }, [filteredIndicators, monthlyData]);

  const runAiAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);

    let idx = 0;
    setLoadingStep(ANALYSIS_STEPS[0]);
    const stepInterval = setInterval(() => {
      idx++;
      if (idx < ANALYSIS_STEPS.length) setLoadingStep(ANALYSIS_STEPS[idx]);
    }, 600);

    try {
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        signal: AbortSignal.timeout(30000), // 30s timeout
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          indicators: filteredIndicators,
          monthlyData: filteredMonthlyData,
          profile: {
            facility: profile?.display_name ?? "Hospital",
            region:   (profile as any)?.region   ?? "Ethiopia",
            department: selectedDept,
          },
        }),
      });

      clearInterval(stepInterval);

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const payload = await response.json();
      if (payload.success && payload.data) {
        setResult(payload.data);
        setResultsSource(payload.source === "gemini_copilot" ? "gemini" : "mock");
      } else {
        throw new Error(payload.error || "Failed to parse AI response.");
      }
    } catch (err: any) {
      clearInterval(stepInterval);
      setError(err?.message || "Network error during analysis.");
    } finally {
      setLoading(false);
    }
  }, [filteredIndicators, filteredMonthlyData, profile, selectedDept]);

  // Auto-run when department changes or indicators first load
  useEffect(() => {
    if (indicators.length > 0) runAiAnalysis();
  }, [selectedDept, indicators.length, runAiAnalysis]);

  // ── Sub-tab button ──────────────────────────────────────────────────────────

  const SubTabBtn = ({
    id, label, icon: Icon,
  }: {
    id: typeof activeSubTab; label: string; icon: React.ElementType;
  }) => (
    <button
      onClick={() => setActiveSubTab(id)}
      className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
        activeSubTab === id
          ? "bg-slate-950 text-white"
          : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Controls header ── */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 bg-white p-5 border border-slate-200 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-slate-900 p-1.5 rounded-lg">
            <Sparkles className="h-5 w-5 text-amber-500 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-bold tracking-tight text-slate-950">AI Analytics &amp; Forecasting Engine</h2>
            <p className="text-[11px] text-slate-500 font-medium">
              Predictive modeling, clinical resource constraints, and structured KPI evaluations
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Department filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-mono font-bold text-slate-400">Dept:</span>
            <select
              value={selectedDept}
              onChange={(e) => { setSelectedDept(e.target.value); setSelectedCode("All"); }}
              className="h-9 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="all">All Departments</option>
              {areas.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {/* Indicator filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-mono font-bold text-slate-400">Indicator:</span>
            <select
              value={selectedIndicatorCode}
              onChange={(e) => setSelectedCode(e.target.value)}
              className="h-9 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none cursor-pointer max-w-[200px]"
            >
              <option value="All">All Indicators</option>
              {indicators
                .filter((i) => selectedDept === "all" || i.programArea === selectedDept)
                .map((i) => (
                  <option key={i.code} value={i.code}>
                    [{i.code}] {i.indicator.length > 30 ? `${i.indicator.slice(0, 30)}…` : i.indicator}
                  </option>
                ))}
            </select>
          </div>

          <button
            onClick={runAiAnalysis}
            disabled={loading}
            className="h-9 px-4 bg-slate-950 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-40 shadow"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Analyzing…" : "Run Analysis"}
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex gap-3 text-rose-900">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold">Analysis Halted</h4>
            <p className="text-xs text-rose-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center space-y-6 flex flex-col items-center shadow-sm">
          <div className="relative">
            <div className="h-16 w-16 rounded-full border-4 border-slate-100 border-t-indigo-600 animate-spin" />
            <Cpu className="h-6 w-6 text-slate-900 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest font-mono">
              Running Predictive Intelligence Model
            </h3>
            <p className="text-xs text-slate-500 font-medium animate-pulse">{loadingStep}</p>
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {!loading && result && (
        <div className="space-y-6">

          {/* Source bar */}
          <div className="flex items-center justify-between text-[11px] bg-slate-100 border border-slate-200 p-3 rounded-xl font-mono text-slate-600">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${resultsSource === "gemini" ? "bg-indigo-600" : "bg-amber-500 animate-pulse"}`} />
              <span className="font-bold">
                {resultsSource === "gemini" ? "Gemini Pro Strategic Model" : "Plan Compass Emulation Engine"}
              </span>
            </div>
            <span>Facility: {profile?.display_name ?? "—"} · {(profile as any)?.region ?? "Ethiopia"}</span>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { title: "Trend Analysis", text: result.trendAnalysis.summary,      bg: "bg-indigo-950",  sub: "text-indigo-300", icon: TrendingUp },
              { title: "Forecasting",    text: result.predictiveModeling.summary, bg: "bg-slate-900",   sub: "text-slate-400",  icon: Cpu },
              { title: "KPI Status",     text: result.kpiEvaluation.summary,      bg: "bg-emerald-950", sub: "text-emerald-300", icon: ShieldCheck },
            ].map(({ title, text, bg, sub, icon: Icon }) => (
              <div key={title} className={`${bg} text-white rounded-2xl p-5 shadow-sm space-y-2 relative overflow-hidden`}>
                <span className={`text-[10px] uppercase font-mono tracking-widest font-bold ${sub}`}>{title}</span>
                <p className="text-xs leading-relaxed text-white/80 line-clamp-4">{text}</p>
                <div className="absolute right-[-10px] bottom-[-10px] opacity-10 pointer-events-none">
                  <Icon className="h-24 w-24" />
                </div>
              </div>
            ))}
          </div>

          {/* Sub-tab nav */}
          <div className="flex border bg-white p-1 rounded-xl shadow-sm border-slate-200 gap-1">
            <SubTabBtn id="trends"          label="1. Trend Analysis"    icon={TrendingUp} />
            <SubTabBtn id="predictions"     label="2. Predictive Model"  icon={Cpu} />
            <SubTabBtn id="evaluation"      label="3. KPI Evaluation"    icon={ShieldCheck} />
            <SubTabBtn id="recommendations" label="4. Action Directives" icon={FileText} />
            <SubTabBtn id="recognition"     label="5. Recognition Board" icon={Trophy} />
          </div>

          {/* ── Tab 1: Trends ── */}
          {activeSubTab === "trends" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-950 flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-indigo-600" />
                    Historical Trend Diagnostics
                  </h3>
                  <p className="text-[11px] text-slate-400">Behavioral and structural trends matching regional health datasets</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {result.trendAnalysis.insights.map((ins, i) => (
                    <div key={i} className="py-4 first:pt-0 last:pb-0 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <h4 className="text-sm font-extrabold text-slate-900">{ins.title}</h4>
                        <TrendIcon direction={ins.trendDirection} />
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{ins.description}</p>
                      <div className="text-[10px] font-mono font-bold text-indigo-700 flex items-center gap-1">
                        <span>Indicator:</span>
                        <span className="px-1.5 py-0.5 bg-indigo-50 border border-indigo-100 rounded">{ins.indicatorCode}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono border-b border-slate-100 pb-2">
                  Clinically Mapped Factors
                </h4>
                {[
                  { title: "Seasonal Road Obstacles", desc: "Washouts from rainfall delay ambulance dispatch." },
                  { title: "Community Outreach Density", desc: "Extension worker screening heightens maternal clinic engagement." },
                  { title: "Drug Stockout Incidents", desc: "Intermittent depot shipments suppress hypertension compliance loops." },
                ].map(({ title, desc }) => (
                  <div key={title} className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="h-2 w-2 rounded-full bg-slate-400 mt-1 shrink-0" />
                    <div>
                      <strong className="block text-xs text-slate-800">{title}</strong>
                      <span className="text-[11px] text-slate-500 leading-normal">{desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Tab 2: Predictions ── */}
          {activeSubTab === "predictions" && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-2">
                  <h3 className="text-sm font-bold text-slate-950 flex items-center gap-1.5">
                    <Cpu className="h-4 w-4 text-indigo-600" />
                    Workforce &amp; Bed Occupancy Predictive Modeling
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Using historical monthly run-rates and seasonality factors, the model projects patient flow peaks.
                  </p>
                </div>
                <div className="flex flex-col items-center justify-center text-center p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                  <BedDouble className="h-5 w-5 text-indigo-600" />
                  <span className="text-[10px] uppercase font-mono text-slate-400 font-bold block">Predicted Bed Occupancy</span>
                  <strong className="text-2xl font-mono text-slate-900">82% Peak</strong>
                  <span className="text-[9px] text-amber-600 font-semibold block uppercase">Warning Limit Approaching</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {result.predictiveModeling.predictions.map((pred, idx) => (
                  <div key={idx} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
                    <div className="border-b border-slate-100 pb-3">
                      <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block">{pred.indicatorCode}</span>
                      <h4 className="text-sm font-extrabold text-slate-900">{pred.indicatorName}</h4>
                    </div>

                    {/* SVG forecast chart */}
                    <ForecastChart prediction={pred} />

                    <div className="grid grid-cols-2 gap-4 pt-1">
                      <div>
                        <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block">Staff Status</span>
                        <div className="flex items-center gap-1.5 pt-1">
                          <Users className="h-4 w-4 text-slate-500" />
                          <StaffingBadge score={pred.staffingNeedScore} />
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block">Bed Capacity</span>
                        <div className="flex items-center gap-1.5 font-bold font-mono text-xs pt-0.5 text-indigo-950">
                          <BedDouble className="h-4 w-4 text-indigo-600" />
                          {pred.bedOccupancyForecast}% peak
                        </div>
                      </div>
                    </div>

                    <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-3.5 space-y-1">
                      <span className="text-[10px] uppercase font-mono font-extrabold text-amber-700 block">Resource Gaps</span>
                      <p className="text-xs text-slate-700 leading-relaxed">{pred.resourceGapAnalysis}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Tab 3: KPI Evaluation ── */}
          {activeSubTab === "evaluation" && (
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-6">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-950 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  KPI Realization &amp; Action Plan Scorecard
                </h3>
                <p className="text-[11px] text-slate-400">Evaluates current YTD achievements against targets</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 min-w-max border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-mono font-bold border-b border-slate-200 uppercase text-[10px]">
                      {["Code", "Indicator", "Baseline", "Target", "Actual", "Achievement", "Status"].map((h) => (
                        <th key={h} className="p-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {result.kpiEvaluation.evaluations.map((ev, i) => (
                      <React.Fragment key={i}>
                        <tr className="hover:bg-slate-50/50">
                          <td className="p-3 font-mono font-bold text-slate-900 text-[11px]">{ev.indicatorCode}</td>
                          <td className="p-3 font-semibold max-w-xs">{ev.name}</td>
                          <td className="p-3 text-center font-mono text-slate-500">{ev.baseline}%</td>
                          <td className="p-3 text-center font-mono font-bold">{ev.target}%</td>
                          <td className="p-3 text-center font-mono font-extrabold text-indigo-900">{ev.currentActual}%</td>
                          <td className="p-3 text-center font-mono">
                            <span className={`font-extrabold text-sm ${ev.achievementPercentage >= 95 ? "text-emerald-700" : ev.achievementPercentage >= 70 ? "text-slate-700" : "text-rose-600 animate-pulse"}`}>
                              {ev.achievementPercentage}%
                            </span>
                          </td>
                          <td className="p-3"><KpiStatusBadge status={ev.kpiStatus} /></td>
                        </tr>
                        <tr className="bg-slate-50/30">
                          <td colSpan={7} className="p-3 pl-8 text-xs italic text-indigo-900">
                            <div className="flex gap-2 bg-white/65 p-2 rounded-lg border border-indigo-100/50">
                              <span className="font-extrabold font-mono text-[9px] uppercase text-indigo-700 shrink-0">Directive:</span>
                              <span>{ev.remedialGuidance}</span>
                            </div>
                          </td>
                        </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Tab 4: Recommendations ── */}
          {activeSubTab === "recommendations" && (
            <div className="space-y-4">
              {result.overallRecommendations.map((rec, i) => (
                <div key={i} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <span className="text-[10px] uppercase font-mono tracking-wider font-extrabold text-slate-400">
                        Strategic Resolution {i + 1}
                      </span>
                      <h3 className="text-sm font-extrabold text-slate-900 pt-0.5">{rec.title}</h3>
                    </div>
                    <PriorityBadge priority={rec.priority} />
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block">Action Steps</span>
                    <ul className="space-y-2 text-xs text-slate-700">
                      {rec.actionSteps.map((step, si) => (
                        <li key={si} className="flex gap-2.5 items-start bg-slate-50/70 p-3 rounded-lg border border-slate-100">
                          <span className="h-5 w-5 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {si + 1}
                          </span>
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-3">
                    <div>
                      <span className="text-[10px] font-mono font-bold uppercase text-slate-400">Timeline</span>
                      <span className="font-bold text-xs text-slate-800 flex items-center gap-1 mt-0.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-500" />
                        {rec.timeline}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono font-bold uppercase text-slate-400">Estimated Impact</span>
                      <span className="font-bold text-xs text-slate-800 block mt-0.5">{rec.estimatedImpact}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Tab 5: Recognition Board ── */}
          {activeSubTab === "recognition" && (
            <RecognitionBoard indicators={indicators} monthlyData={monthlyData} />
          )}
        </div>
      )}

    </div>
  );
}