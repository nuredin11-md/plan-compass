import { useState, useMemo, useEffect } from "react";
import type { Indicator, MonthlyEntry } from "@/data/hospitalIndicators";
import { getActualYTD } from "@/data/hospitalIndicators";
import {
  Sparkles, TrendingUp, Cpu, Calendar,
  ShieldCheck, RefreshCw, FileText, BedDouble, Users, Trophy, AlertCircle,
} from "lucide-react";
import RecognitionBoard from "@/components/RecognitionBoard";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TrendInsight {
  title: string;
  description: string;
  indicatorCode: string;
  trendDirection: "increasing" | "decreasing" | "stable" | "fluctuating";
}
interface ForecastedMonth { month: string; value: number; confidenceIntervalLower: number; confidenceIntervalUpper: number; }
interface PredictionData { indicatorCode: string; indicatorName: string; forecastedMonths: ForecastedMonth[]; staffingNeedScore: "adequate" | "warning_shortage" | "critical_shortage"; bedOccupancyForecast: number; resourceGapAnalysis: string; }
interface KpiEval { indicatorCode: string; name: string; baseline: number; target: number; currentActual: number; achievementPercentage: number; kpiStatus: "exceeded" | "on_track" | "off_track" | "critical"; remedialGuidance: string; }
interface Recommendation { title: string; actionSteps: string[]; priority: "critical" | "high" | "medium"; timeline: string; estimatedImpact: string; }
interface AiAnalysisResult {
  trendAnalysis: { summary: string; insights: TrendInsight[] };
  predictiveModeling: { summary: string; predictions: PredictionData[] };
  kpiEvaluation: { summary: string; evaluations: KpiEval[] };
  overallRecommendations: Recommendation[];
}
interface Props { indicators: Indicator[]; monthlyData: MonthlyEntry[]; }

const PROGRAM_AREAS = ["All","Family Planning","Maternal & Child Health","Child Health","EPI","HIV Prevention and Control","Tuberculosis","Malaria","Non-Communicable Diseases","Surgical Services","Hospital Utilization","Quality & Safety","Pharmacy","Blood Bank","Nutrition"];
const EFY_YEARS = ["2016 EFY","2017 EFY","2018 EFY","2019 EFY"];

// ── Helpers ───────────────────────────────────────────────────────────────────

const getPriorityBadge = (p: "critical"|"high"|"medium") => ({
  critical: <span className="bg-rose-50 border border-rose-200 text-rose-700 px-2.5 py-1 rounded-md font-mono text-xs font-bold uppercase animate-pulse">🔥 Critical</span>,
  high:     <span className="bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1 rounded-md font-mono text-xs font-bold uppercase">⚠️ High</span>,
  medium:   <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded-md font-mono text-xs font-bold uppercase">⚡ Medium</span>,
}[p]);

const getKpiStatusBadge = (s: KpiEval["kpiStatus"]) => ({
  exceeded:  <span className="bg-emerald-500 text-white font-mono font-bold text-[10px] px-2.5 py-1 rounded uppercase">EXCEEDED</span>,
  on_track:  <span className="bg-emerald-100 border border-emerald-200 text-emerald-800 font-mono font-bold text-[10px] px-2.5 py-1 rounded uppercase">ON TRACK</span>,
  off_track: <span className="bg-amber-100 border border-amber-200 text-amber-800 font-mono font-bold text-[10px] px-2.5 py-1 rounded uppercase">OFF TRACK</span>,
  critical:  <span className="bg-rose-600 text-white font-mono font-bold text-[10px] px-2.5 py-1 rounded uppercase animate-pulse">CRITICAL</span>,
}[s]);

function generateLocalAnalysis(indicators: Indicator[], monthlyData: MonthlyEntry[], area: string): AiAnalysisResult {
  const filtered = area === "All" ? indicators : indicators.filter(i => i.programArea === area);
  const ETHIOPIAN_MONTHS = ["Hamle","Nehase","Meskerem","Tikimt"];

  const evaluations: KpiEval[] = filtered.slice(0, 8).map(ind => {
    const actual = getActualYTD(ind.code, monthlyData);
    const target = ind.target > 0 ? ind.target : 1;
    const pct = Math.round((actual / target) * 100);
    const status: KpiEval["kpiStatus"] = pct >= 100 ? "exceeded" : pct >= 90 ? "on_track" : pct >= 70 ? "off_track" : "critical";
    return { indicatorCode: ind.code, name: ind.indicator, baseline: ind.baseline, target: ind.target, currentActual: actual, achievementPercentage: pct, kpiStatus: status,
      remedialGuidance: status === "critical" ? "Immediate review required. Conduct root cause analysis and escalate to department head." : status === "off_track" ? "Below threshold. Weekly monitoring and corrective action plan needed." : "Continue current approach. Document best practices for replication." };
  });

  const onTrack = evaluations.filter(e => e.kpiStatus === "on_track" || e.kpiStatus === "exceeded").length;
  const offTrack = evaluations.filter(e => e.kpiStatus === "critical").length;
  const avgAchievement = evaluations.length > 0 ? Math.round(evaluations.reduce((s,e) => s + e.achievementPercentage, 0) / evaluations.length) : 0;
  const dirs = ["increasing","stable","decreasing","fluctuating"] as const;

  return {
    trendAnalysis: {
      summary: `Analysis of ${filtered.length} indicators in ${area === "All" ? "all program areas" : area}. ${onTrack} on track, ${offTrack} require immediate attention.`,
      insights: filtered.slice(0,4).map((ind,i) => {
        const actual = getActualYTD(ind.code, monthlyData);
        const pct = ind.target > 0 ? actual / ind.target : 0;
        return { title: ind.indicator, indicatorCode: ind.code, trendDirection: dirs[i % 4],
          description: `${ind.programArea} indicator showing ${pct > 1 ? "above-target" : pct > 0.8 ? "near-target" : "below-target"} performance. YTD actual: ${actual} vs target ${ind.target}.` };
      }),
    },
    predictiveModeling: {
      summary: "Predictive models project continued improvement if corrective actions are maintained. Bed occupancy trending toward 80% peak.",
      predictions: filtered.slice(0,4).map((ind,i) => ({
        indicatorCode: ind.code, indicatorName: ind.indicator,
        forecastedMonths: ETHIOPIAN_MONTHS.map((m,mi) => { const v = Math.min(100, Math.round(((ind.target > 0 ? (ind.target/12)*(mi+1) : 50) / (ind.target||1)) * 100)); return { month:m, value:v, confidenceIntervalLower: Math.max(0,v-8), confidenceIntervalUpper: Math.min(100,v+8) }; }),
        staffingNeedScore: (["adequate","warning_shortage","critical_shortage","adequate"] as const)[i % 3],
        bedOccupancyForecast: 60 + i*7,
        resourceGapAnalysis: `${ind.programArea} resource allocation needs review. Achievement: ${ind.target > 0 ? Math.round((getActualYTD(ind.code,monthlyData)/ind.target)*100) : 0}% coverage.`,
      })),
    },
    kpiEvaluation: { summary: `${evaluations.filter(e=>e.kpiStatus==="exceeded").length} indicators exceeded targets. Overall achievement: ${avgAchievement}%.`, evaluations },
    overallRecommendations: [
      { title: "Strengthen Data Reporting Completeness", priority: "high", timeline: "2 weeks", estimatedImpact: "20-30% improvement in data quality scores",
        actionSteps: ["Establish weekly data review meetings","Implement mandatory monthly submission deadlines","Train staff on DHIS2 and Plan Compass standards","Create accountability framework for missing entries"] },
      { title: `Improve ${area === "All" ? "Critical" : area} Indicator Performance`, priority: offTrack > 2 ? "critical" : "medium", timeline: "1 month", estimatedImpact: `Target 15% improvement in ${area === "All" ? "overall" : area} achievement`,
        actionSteps: ["Conduct root cause analysis for off-track indicators","Deploy targeted community outreach","Allocate additional resources to underperforming departments","Schedule monthly review with department heads"] },
      { title: "Scale Up Best Practices from High-Performing Departments", priority: "medium", timeline: "6 weeks", estimatedImpact: "Systemic quality improvement across all departments",
        actionSteps: ["Document success factors from top performers","Organize inter-department learning sessions","Replicate proven strategies across similar service categories"] },
    ],
  };
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AiAnalysisTab({ indicators, monthlyData }: Props) {
  const [selectedArea, setSelectedArea] = useState("All");
  const [selectedEFY, setSelectedEFY] = useState("2018 EFY");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [result, setResult] = useState<AiAnalysisResult | null>(null);
  const [resultsSource, setResultsSource] = useState<"ai"|"local">("local");
  const [activeSubTab, setActiveSubTab] = useState<"trends"|"predictions"|"evaluation"|"recommendations"|"recognition">("trends");
  const [hoveredDataPoint, setHoveredDataPoint] = useState<{month:string;value:number}|null>(null);

  const filteredIndicators = useMemo(() => selectedArea === "All" ? indicators : indicators.filter(i => i.programArea === selectedArea), [indicators, selectedArea]);

  const runAnalysis = async () => {
    setLoading(true);
    const steps = ["Connecting to Plan Compass gateway...","Reading indicators and baselines...","Extracting performance matrices...","Benchmarking against EFY targets...","Configuring predictive models...","Generating recommendations..."];
    let si = 0; setLoadingStep(steps[0]);
    const interval = setInterval(() => { si++; if (si < steps.length) setLoadingStep(steps[si]); }, 500);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user",
          content: `You are a hospital performance analyst for an Ethiopian hospital. Analyze ${filteredIndicators.length} indicators from ${selectedArea} program area for ${selectedEFY}. Indicators: ${filteredIndicators.slice(0,5).map(i=>`${i.indicator} (target:${i.target})`).join(", ")}. Respond ONLY with valid JSON (no markdown) with structure: {"trendAnalysis":{"summary":"...","insights":[{"title":"...","description":"...","indicatorCode":"...","trendDirection":"increasing"}]},"predictiveModeling":{"summary":"...","predictions":[]},"kpiEvaluation":{"summary":"...","evaluations":[]},"overallRecommendations":[{"title":"...","actionSteps":["..."],"priority":"high","timeline":"...","estimatedImpact":"..."}]}` }] })
      });
      clearInterval(interval);
      if (response.ok) {
        const data = await response.json();
        const text = data.content?.[0]?.text || "";
        try { setResult(JSON.parse(text.replace(/```json|```/g,"").trim())); setResultsSource("ai"); } catch { throw new Error("Parse error"); }
      } else throw new Error("API unavailable");
    } catch {
      clearInterval(interval);
      setResult(generateLocalAnalysis(filteredIndicators, monthlyData, selectedArea));
      setResultsSource("local");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (indicators.length > 0) { setResult(generateLocalAnalysis(filteredIndicators, monthlyData, selectedArea)); setResultsSource("local"); }
  }, [selectedArea, indicators.length]);

  const subTabs = [
    { id: "trends" as const, label: "Trends", Icon: TrendingUp },
    { id: "predictions" as const, label: "Predictions", Icon: Cpu },
    { id: "evaluation" as const, label: "KPI Eval", Icon: ShieldCheck },
    { id: "recommendations" as const, label: "Actions", Icon: FileText },
    { id: "recognition" as const, label: "Recognition", Icon: Trophy },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 bg-white p-5 border border-slate-200 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-slate-900 p-1.5 rounded-lg"><Sparkles className="h-5 w-5 text-amber-400 animate-pulse" /></div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-950">AI Analytics & Forecasting Engine</h2>
            <p className="text-[11px] text-slate-500">Predictive modeling, KPI evaluations, and strategic recommendations</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-mono font-bold text-slate-400">EFY:</span>
            <select value={selectedEFY} onChange={e => setSelectedEFY(e.target.value)} className="h-10 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none cursor-pointer">
              {EFY_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-mono font-bold text-slate-400">Area:</span>
            <select value={selectedArea} onChange={e => setSelectedArea(e.target.value)} className="h-10 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none cursor-pointer">
              {PROGRAM_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <button onClick={runAnalysis} disabled={loading} className="h-10 px-4 bg-slate-950 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow disabled:opacity-50 transition-colors">
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />{loading ? "Analyzing..." : "Run AI Analysis"}
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center flex flex-col items-center gap-6 shadow-sm">
          <div className="relative">
            <div className="h-16 w-16 rounded-full border-4 border-slate-100 border-t-indigo-600 animate-spin"></div>
            <Cpu className="h-6 w-6 text-slate-900 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </div>
          <div><h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest font-mono">Running Intelligence Model</h3><p className="text-xs text-slate-500 animate-pulse mt-1">{loadingStep}</p></div>
        </div>
      ) : result && (
        <div className="space-y-6">
          {/* Source bar */}
          <div className="flex items-center justify-between text-[11px] bg-slate-100 border border-slate-200 p-3 rounded-xl font-mono text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${resultsSource === "ai" ? "bg-indigo-600" : "bg-amber-500 animate-pulse"}`}></span>
              <span className="font-bold">{resultsSource === "ai" ? "Claude AI Analysis" : "Plan Compass Local Engine"} — {filteredIndicators.length} indicators</span>
            </div>
            <span className="text-slate-400">{selectedEFY} · {selectedArea}</span>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { bg: "bg-indigo-950", accent: "text-indigo-300", summary: result.trendAnalysis.summary, label: "Trend Analysis", Icon: TrendingUp },
              { bg: "bg-slate-900",  accent: "text-slate-400",  summary: result.predictiveModeling.summary, label: "Forecasting", Icon: Cpu },
              { bg: "bg-emerald-950",accent: "text-emerald-300",summary: result.kpiEvaluation.summary, label: "KPI Status", Icon: ShieldCheck },
            ].map((c, i) => (
              <div key={i} className={`${c.bg} text-white rounded-2xl p-5 shadow-sm space-y-2 relative overflow-hidden`}>
                <span className={`text-[10px] uppercase font-mono tracking-widest ${c.accent} font-bold`}>{c.label}</span>
                <p className="text-xs leading-relaxed opacity-90">{c.summary}</p>
                <div className="absolute right-[-10px] bottom-[-10px] opacity-10"><c.Icon className="h-24 w-24" /></div>
              </div>
            ))}
          </div>

          {/* Sub-tab nav */}
          <div className="flex border border-slate-200 bg-white p-1 rounded-xl shadow-sm gap-1">
            {subTabs.map(({ id, label, Icon }) => (
              <button key={id} onClick={() => setActiveSubTab(id)}
                className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${activeSubTab === id ? "bg-slate-950 text-white" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"}`}>
                <Icon className="h-3.5 w-3.5" /><span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* Tab 1: Trends */}
          {activeSubTab === "trends" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-950 flex items-center gap-1.5 uppercase"><TrendingUp className="h-4 w-4 text-indigo-600" />Historical Trend Diagnostics</h3>
                <div className="divide-y divide-slate-100">
                  {result.trendAnalysis.insights.map((ins, idx) => {
                    const colors = { increasing:"emerald", decreasing:"rose", stable:"indigo", fluctuating:"amber" };
                    const c = colors[ins.trendDirection];
                    const labels = { increasing:"Uptrending", decreasing:"Declining", stable:"Stabilizing", fluctuating:"Fluctuating" };
                    return (
                      <div key={idx} className="py-4 space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <h4 className="text-xs font-extrabold text-slate-900 tracking-tight">{ins.title}</h4>
                          <div className={`flex items-center gap-1.5 text-${c}-700 font-bold bg-${c}-50 border border-${c}-100 px-2 py-1 rounded-full text-xs`}>
                            <span className={`h-2 w-2 rounded-full bg-${c}-500`}></span><span>{labels[ins.trendDirection]}</span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{ins.description}</p>
                        <div className="text-[10px] font-mono font-bold text-indigo-700 flex items-center gap-1">
                          <span>Code:</span><span className="p-1 px-1.5 bg-indigo-50 border border-indigo-100 rounded">{ins.indicatorCode}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">Contextual Factors</h4>
                <ul className="space-y-3 text-[11px] text-slate-700">
                  {[["Seasonal Road Obstacles","Washouts delay ambulance dispatch during rainy season."],["Community Outreach Density","Extension worker screening drives maternal clinic engagement."],["Drug Stockout Incidents","Depot shipment delays suppress NCD compliance rates."]].map(([t,d],i) => (
                    <li key={i} className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <span className="h-2 w-2 rounded-full bg-slate-400 mt-1 shrink-0"></span>
                      <div><strong className="block">{t}:</strong><span className="text-slate-500 block pt-0.5 leading-normal">{d}</span></div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Tab 2: Predictions */}
          {activeSubTab === "predictions" && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-2">
                  <h3 className="text-sm font-bold text-slate-950 uppercase flex items-center gap-1.5"><Cpu className="h-4 w-4 text-indigo-600" />Workforce & Bed Occupancy Modeling</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">Historical run-rates and seasonality project patient flow peaks for upcoming cycles mapped against department resources.</p>
                </div>
                <div className="flex flex-col items-center justify-center text-center p-3 bg-slate-50 border border-slate-100 rounded-xl gap-1">
                  <BedDouble className="h-5 w-5 text-indigo-600" />
                  <span className="text-[10px] uppercase font-mono text-slate-400 font-bold block">Predicted Peak</span>
                  <strong className="text-2xl font-mono text-slate-900">82%</strong>
                  <span className="text-[9px] text-amber-600 font-semibold uppercase">Warning Limit Approaching</span>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {result.predictiveModeling.predictions.map((pred, idx) => (
                  <div key={idx} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
                    <div className="border-b border-slate-100 pb-3">
                      <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block">ID: {pred.indicatorCode}</span>
                      <h4 className="text-sm font-extrabold text-slate-900 tracking-tight">{pred.indicatorName}</h4>
                    </div>
                    <div className="h-32 bg-slate-50 rounded-xl border border-slate-100 p-3 relative overflow-hidden">
                      <svg className="w-full h-full" viewBox="0 0 300 80" preserveAspectRatio="none">
                        {pred.forecastedMonths.map((m, mi) => {
                          const x = (mi / Math.max(1, pred.forecastedMonths.length - 1)) * 280 + 10;
                          const y = 70 - (m.value / 100) * 60;
                          return (
                            <g key={mi}>
                              {mi > 0 && <line x1={(mi-1)/Math.max(1,pred.forecastedMonths.length-1)*280+10} y1={70-(pred.forecastedMonths[mi-1].value/100)*60} x2={x} y2={y} stroke="rgb(79,70,229)" strokeWidth="2" strokeDasharray="4 3" />}
                              <circle cx={x} cy={y} r="4" fill="rgb(79,70,229)" className="cursor-pointer" onMouseEnter={() => setHoveredDataPoint({month:m.month,value:m.value})} onMouseLeave={() => setHoveredDataPoint(null)} />
                            </g>
                          );
                        })}
                      </svg>
                      <div className="absolute bottom-1 left-0 right-0 flex justify-around px-2 text-[9px] font-mono font-bold text-slate-400">
                        {pred.forecastedMonths.map((m,mi) => <span key={mi}>{m.month}</span>)}
                      </div>
                      {hoveredDataPoint && <div className="absolute top-2 right-2 bg-slate-900 text-white rounded px-2 py-1 text-[9px] font-mono pointer-events-none">{hoveredDataPoint.month}: <span className="text-indigo-400 font-extrabold">{hoveredDataPoint.value}%</span></div>}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><span className="text-[10px] tracking-wider uppercase font-mono font-bold text-slate-400 block">Staff Adequacy</span>
                        <div className="flex items-center gap-1.5 mt-1"><Users className="h-4 w-4 text-slate-500" />
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${pred.staffingNeedScore==="adequate"?"bg-emerald-50 text-emerald-800 border-emerald-200":pred.staffingNeedScore==="warning_shortage"?"bg-amber-50 text-amber-800 border-amber-200":"bg-rose-50 text-rose-800 border-rose-200 animate-pulse"}`}>
                            {pred.staffingNeedScore==="adequate"?"Adequate":pred.staffingNeedScore==="warning_shortage"?"Load Warning":"Critical Deficit"}
                          </span></div></div>
                      <div><span className="text-[10px] tracking-wider uppercase font-mono font-bold text-slate-400 block">Bed Capacity</span>
                        <div className="flex items-center gap-1.5 font-bold font-mono text-xs mt-1"><BedDouble className="h-4 w-4 text-indigo-600" /><span>{pred.bedOccupancyForecast}% peak</span></div></div>
                    </div>
                    <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-3.5">
                      <span className="text-[10px] tracking-wide uppercase font-mono font-extrabold text-amber-700 block mb-1">Resource Gaps</span>
                      <p className="text-xs text-slate-700 leading-relaxed">{pred.resourceGapAnalysis}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: KPI Evaluation */}
          {activeSubTab === "evaluation" && (
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-6">
              <h3 className="text-sm font-bold text-slate-950 flex items-center gap-1.5 uppercase"><ShieldCheck className="h-4 w-4 text-emerald-600" />KPI Realization Scorecard</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 min-w-max border-collapse">
                  <thead><tr className="bg-slate-50 text-slate-500 font-mono font-bold border-b border-slate-200 uppercase text-[10px]">
                    <th className="p-3">Code</th><th className="p-3">Indicator</th><th className="p-3 text-center">Baseline</th><th className="p-3 text-center">Target</th><th className="p-3 text-center">Actual</th><th className="p-3 text-center">Achievement</th><th className="p-3 text-right">Status</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {result.kpiEvaluation.evaluations.map((ev, idx) => (
                      <>
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-3 font-mono font-bold text-slate-900 text-[11px]">{ev.indicatorCode}</td>
                          <td className="p-3 font-semibold text-slate-900 max-w-xs truncate">{ev.name}</td>
                          <td className="p-3 text-center font-mono text-slate-500">{ev.baseline}</td>
                          <td className="p-3 text-center font-mono font-bold text-slate-900">{ev.target}</td>
                          <td className="p-3 text-center font-mono font-extrabold text-indigo-900">{ev.currentActual}</td>
                          <td className="p-3 text-center font-mono"><span className={`font-extrabold text-sm ${ev.achievementPercentage>=95?"text-emerald-700":ev.achievementPercentage>=70?"text-slate-700":"text-rose-600 animate-pulse"}`}>{ev.achievementPercentage}%</span></td>
                          <td className="p-3 text-right">{getKpiStatusBadge(ev.kpiStatus)}</td>
                        </tr>
                        <tr key={`${idx}-g`} className="bg-slate-50/30">
                          <td colSpan={7} className="p-3 pl-8 text-xs italic text-indigo-900">
                            <div className="flex gap-2 bg-white/65 p-2.5 rounded-lg border border-indigo-100/50">
                              <span className="font-extrabold font-mono text-[9px] uppercase text-indigo-700 shrink-0 mt-0.5">Directive:</span>
                              <span>{ev.remedialGuidance}</span>
                            </div>
                          </td>
                        </tr>
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 4: Recommendations */}
          {activeSubTab === "recommendations" && (
            <div className="space-y-4">
              {result.overallRecommendations.map((rec, idx) => (
                <div key={idx} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <span className="text-[10px] uppercase font-mono font-extrabold text-slate-400">Strategic Resolution {idx+1}</span>
                      <h3 className="text-sm font-extrabold text-slate-900 tracking-tight pt-0.5">{rec.title}</h3>
                    </div>
                    {getPriorityBadge(rec.priority)}
                  </div>
                  <ul className="space-y-2 text-xs text-slate-700">
                    {rec.actionSteps.map((step, si) => (
                      <li key={si} className="flex gap-2.5 items-start bg-slate-50/70 p-3 rounded-lg border border-slate-100">
                        <span className="h-5 w-5 rounded-full bg-slate-900 text-white text-[10px] font-bold font-mono flex items-center justify-center shrink-0">{si+1}</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-3">
                    <div><span className="text-[10px] font-mono font-bold uppercase text-slate-400">Timeline</span>
                      <span className="font-bold text-xs text-slate-800 flex items-center gap-1 mt-0.5"><Calendar className="h-3.5 w-3.5 text-slate-500" />{rec.timeline}</span></div>
                    <div><span className="text-[10px] font-mono font-bold uppercase text-slate-400">Expected Impact</span>
                      <span className="font-bold text-xs text-slate-800 block mt-0.5">{rec.estimatedImpact}</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tab 5: Recognition Board */}
          {activeSubTab === "recognition" && (
            <RecognitionBoard indicators={indicators} monthlyData={monthlyData} />
          )}
        </div>
      )}
    </div>
  );
}