import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Indicator, MonthlyEntry, UserProfile } from "../types";
import { useQuery } from "@tanstack/react-query";
import { DEPARTMENTS } from "../data/initialData";
import {
  Sparkles, TrendingUp, Cpu, Calendar, ShieldCheck, RefreshCw, AlertCircle, FileText, BedDouble, Users, Trophy
} from "lucide-react";
import RecognitionBoard from "./RecognitionBoard";

interface AiAnalysisTabProps {
  indicators: Indicator[];
  monthlyData: MonthlyEntry[];
  profile: UserProfile;
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
  trendAnalysis: {
    summary: string;
    insights: TrendInsight[];
  };
  predictiveModeling: {
    summary: string;
    predictions: PredictionData[];
  };
  kpiEvaluation: {
    summary: string;
    evaluations: KpiEval[];
  };
  overallRecommendations: Recommendation[];
}

export default function AiAnalysisTab({ indicators, monthlyData, profile }: AiAnalysisTabProps) {
  const [selectedDept, setSelectedDept] = useState<string>(
    profile.department !== "All" ? profile.department : "Maternal & Child Health"
  );
  const [loadingStep, setLoadingStep] = useState<string>("");
  const [resultsSource, setResultsSource] = useState<"gemini" | "mock">("gemini");
  const [activeSubTab, setActiveSubTab] = useState<"trends" | "predictions" | "evaluation" | "recommendations" | "recognition">("trends");
  const [hoveredDataPoint, setHoveredDataPoint] = useState<{ month: string; value: number; upper?: number; lower?: number } | null>(null);

  // Filter indicators to current selected department
  const filteredIndicators = useMemo(() => {
    return indicators.filter(ind => selectedDept === "All" || ind.department === selectedDept);
  }, [indicators, selectedDept]);

  // Use TanStack Query for robust data fetching
  const { data: result, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['aiAnalysis', selectedDept],
    queryFn: async () => {
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          indicators: filteredIndicators,
          monthlyData,
          profile: { ...profile, department: selectedDept }
        })
      });
      if (!response.ok) throw new Error("Analysis failed");
      const res = await response.json();
      
      if (res.source === "mock") setResultsSource("mock");
      return res.data as AiAnalysisResult;
    },
    enabled: !!filteredIndicators.length
  });

  const runAiAnalysis = useCallback(() => {
    refetch();
  }, [refetch]);

  // Local UI states for the "Loading Experience"
  useEffect(() => {
    if (isLoading) {
      const steps = [
        "Securing connection...",
        "Reading indicators...",
        "Extracting matrices...",
        "Benchmarking goals...",
        "Configuring grids...",
        "Polishing directives..."
      ];
      let idx = 0;
      setLoadingStep(steps[0]);
      const interval = setInterval(() => {
        idx = (idx + 1) % steps.length;
        setLoadingStep(steps[idx]);
      }, 800);
      return () => clearInterval(interval);
    }
  }, [isLoading]);

  // Render priority badges beautifully
  const getPriorityBadge = (priority: "critical" | "high" | "medium") => {
    switch (priority) {
      case "critical":
        return <span className="bg-rose-50 border border-rose-200 text-rose-700 px-2.5 py-1 rounded-md font-mono text-xs font-bold uppercase animate-pulse">🔥 Critical Priority</span>;
      case "high":
        return <span className="bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1 rounded-md font-mono text-xs font-bold uppercase">⚠️ High Priority</span>;
      default:
        return <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded-md font-mono text-xs font-bold uppercase">⚡ Medium Priority</span>;
    }
  };

  // Render trend direction indicators
  const getTrendIcon = (direction: "increasing" | "decreasing" | "stable" | "fluctuating") => {
    switch (direction) {
      case "increasing":
        return (
          <div className="flex items-center gap-1.5 text-emerald-700 font-bold bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-full text-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span>Uptrending</span>
          </div>
        );
      case "decreasing":
        return (
          <div className="flex items-center gap-1.5 text-rose-700 font-bold bg-rose-50 border border-rose-100 px-2 py-1 rounded-full text-xs">
            <span className="h-2 w-2 rounded-full bg-rose-500"></span>
            <span>Declining</span>
          </div>
        );
      case "stable":
        return (
          <div className="flex items-center gap-1.5 text-indigo-700 font-bold bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-full text-xs">
            <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
            <span>Stabilizing</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 text-amber-700 font-bold bg-amber-50 border border-amber-100 px-2 py-1 rounded-full text-xs">
            <span className="h-2 w-2 rounded-full bg-amber-500 font-sans">●</span>
            <span>Fluctuating</span>
          </div>
        );
    }
  };

  // Get KPI status badge
  const getKpiStatusBadge = (status: "exceeded" | "on_track" | "off_track" | "critical") => {
    switch (status) {
      case "exceeded":
        return <span className="bg-emerald-500 text-white font-mono font-bold text-[10px] px-2.5 py-1 rounded uppercase">EXCEEDED</span>;
      case "on_track":
        return <span className="bg-emerald-100 border border-emerald-200 text-emerald-800 font-mono font-bold text-[10px] px-2.5 py-1 rounded uppercase">ON TRACK</span>;
      case "off_track":
        return <span className="bg-amber-100 border border-amber-200 text-amber-800 font-mono font-bold text-[10px] px-2.5 py-1 rounded uppercase">OFF TRACK</span>;
      default:
        return <span className="bg-rose-600 text-white font-mono font-bold text-[10px] px-2.5 py-1 rounded uppercase animate-pulse">CRITICAL</span>;
    }
  };

  const getStaffingBadge = (score: "adequate" | "warning_shortage" | "critical_shortage") => {
    switch (score) {
      case "adequate":
        return <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold text-xs px-2 py-0.5 rounded-full">Adequate Resource Ratio</span>;
      case "warning_shortage":
        return <span className="bg-amber-50 text-amber-800 border border-amber-200 font-semibold text-xs px-2 py-0.5 rounded-full">Staffing Load Warning</span>;
      default:
        return <span className="bg-rose-50 text-rose-800 border border-rose-200 font-semibold text-xs px-2 py-0.5 rounded-full animate-pulse">Critical Staff Deficit</span>;
    }
  };

  return (
    <div className="space-y-6">

      {/* HEADER CONTROLS */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 bg-white p-5 border border-slate-200 rounded-2xl shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="bg-slate-900 text-indigo-400 p-1.5 rounded-lg">
              <Sparkles className="h-5 w-5 animate-pulse text-amber-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-950 flex items-center gap-1.5 leading-none">
                <span>AI Analytica & Forecasting Engine</span>
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">Synthesizes predictive modeling, clinical resource constraints, and structured KPI evaluations</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Department filter */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-slate-400">Department Unit:</span>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="h-10 px-3.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-800 font-bold focus:ring-1 focus:ring-slate-900 focus:outline-none"
            >
              {DEPARTMENTS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <button
            onClick={runAiAnalysis}
            disabled={isLoading}
            className="h-10 px-4 bg-slate-950 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer flex items-center gap-2 shadow disabled:bg-slate-300"
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
            <span>{isLoading ? "Analyzing..." : "Analyze Module"}</span>
          </button>
        </div>
      </div>

      {/* ERROR MESSAGE CARD */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex gap-3 text-rose-900">
          <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold leading-normal">Operational Analysis Halted</h4>
            <p className="text-xs text-rose-700 leading-relaxed">{(error as Error)?.message || "Analysis failed"}</p>
          </div>
        </div>
      )}

      {/* LOADING OVERLAY CARDS */}
      {isLoading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center space-y-6 flex flex-col items-center justify-center shadow-sm">
          <div className="relative">
            <div className="h-16 w-16 rounded-full border-4 border-slate-100 border-t-indigo-600 animate-spin"></div>
            <Cpu className="h-6 w-6 text-slate-900 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest font-mono">Running Predictive Intelligence Model</h3>
            <p className="text-xs text-slate-500 font-medium animate-pulse">{loadingStep}</p>
          </div>
          <div className="max-w-xs text-[10px] text-slate-400 font-medium leading-relaxed">
            Please remain on this screen. Plan Compass math libraries are formulating forecasting metrics for {selectedDept}.
          </div>
        </div>
      ) : (
        result && (
          <div className="space-y-6 animate-fadeIn">

            {/* SOURCE INTEGRITY INDICATOR BAR */}
            <div className="flex items-center justify-between text-[11px] bg-slate-100 border border-slate-200 p-3 rounded-xl font-mono text-slate-600">
              <div className="flex items-center gap-1">
                <span className={`h-2 w-2 rounded-full ${resultsSource === "gemini" ? "bg-indigo-600" : "bg-amber-500 animate-pulse"}`}></span>
                <span className="font-bold">
                  Data Processor: {resultsSource === "gemini" ? "Gemini 1.5 Pro Strategic Grounding Model" : "Plan Compass Math Engine"}
                </span>
              </div>
              <div>
                <span>Authority: {profile.region} Bureau compliance</span>
              </div>
            </div>

            {/* BENCHMARK GRID BANNER COGNITIVE SUMMARY */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              <div className="bg-indigo-950 text-white rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden">
                <div className="z-10 relative space-y-1">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-indigo-300 font-bold">Trend Analysis Verdict</span>
                  <p className="text-xs leading-relaxed text-indigo-100 line-clamp-4">
                    {result.trendAnalysis.summary}
                  </p>
                </div>
                <div className="absolute right-[-10px] bottom-[-10px] opacity-15 text-white pointer-events-none">
                  <TrendingUp className="h-24 w-24" />
                </div>
              </div>

              <div className="bg-slate-900 text-slate-100 rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden">
                <div className="z-10 relative space-y-1">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 font-bold">Forecasting Summary</span>
                  <p className="text-xs leading-relaxed text-slate-300 line-clamp-4">
                    {result.predictiveModeling.summary}
                  </p>
                </div>
                <div className="absolute right-[-10px] bottom-[-10px] opacity-15 text-white pointer-events-none">
                  <Cpu className="h-24 w-24" />
                </div>
              </div>

              <div className="bg-emerald-950 text-white rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden">
                <div className="z-10 relative space-y-1">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-emerald-300 font-bold">Strategic KPI Status</span>
                  <p className="text-xs leading-relaxed text-emerald-100 line-clamp-4">
                    {result.kpiEvaluation.summary}
                  </p>
                </div>
                <div className="absolute right-[-10px] bottom-[-10px] opacity-15 text-white pointer-events-none">
                  <ShieldCheck className="h-24 w-24" />
                </div>
              </div>

            </div>

            {/* NESTED RESULTS TAB SELECTOR */}
            <div className="flex flex-wrap border-b border-slate-200 bg-white p-1 rounded-xl shadow-sm border">
              <button
                onClick={() => setActiveSubTab("trends")}
                className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeSubTab === "trends"
                    ? "bg-slate-950 text-white"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <TrendingUp className="h-4 w-4" />
                <span>1. Trend Analysis</span>
              </button>

              <button
                onClick={() => setActiveSubTab("predictions")}
                className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeSubTab === "predictions"
                    ? "bg-slate-950 text-white"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <Cpu className="h-4 w-4" />
                <span>2. Predictive Modeling</span>
              </button>

              <button
                onClick={() => setActiveSubTab("evaluation")}
                className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeSubTab === "evaluation"
                    ? "bg-slate-950 text-white"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <ShieldCheck className="h-4 w-4" />
                <span>3. KPI Evaluation</span>
              </button>

              <button
                onClick={() => setActiveSubTab("recommendations")}
                className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeSubTab === "recommendations"
                    ? "bg-slate-950 text-white"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <FileText className="h-4 w-4" />
                <span>4. Action Directives</span>
              </button>

              <button
                onClick={() => setActiveSubTab("recognition")}
                className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeSubTab === "recognition"
                    ? "bg-slate-950 text-white"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <Trophy className="h-4 w-4" />
                <span>5. Recognition Board</span>
              </button>
            </div>

            {/* SUB-TABS CONTENT RENDERING */}
            <div className="space-y-6">

              {/* TAB 1: TREND ANALYTICS */}
              {activeSubTab === "trends" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                  {/* Left panel: Detailed Insight blocks */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
                      <div className="border-b border-slate-100 pb-3">
                        <h3 className="text-sm font-bold text-slate-950 flex items-center gap-1.5 font-sans uppercase">
                          <TrendingUp className="h-4 w-4 text-indigo-600" />
                          <span>Historical Trend Diagnostics</span>
                        </h3>
                        <p className="text-[11px] text-slate-400">Analysis detects behavioral and structural trends matching regional health datasets</p>
                      </div>

                      <div className="divide-y divide-slate-100">
                        {result.trendAnalysis.insights.map((ins, idx) => (
                          <div key={`${ins.indicatorCode}-${idx}`} className="py-4 first:pt-0 last:pb-0 space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 font-sans tracking-tight">
                                {ins.title}
                              </h4>
                              {getTrendIcon(ins.trendDirection)}
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed font-sans">
                              {ins.description}
                            </p>
                            <div className="text-[10px] font-mono font-bold text-indigo-700 flex items-center gap-1">
                              <span>Relevant Indicator Code:</span>
                              <span className="p-1 px-1.5 bg-indigo-50 border border-indigo-100 rounded">{ins.indicatorCode}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right panel: Static widget summaries */}
                  <div className="lg:col-span-1 space-y-4">
                    <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
                      <div className="border-b border-slate-100 pb-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">Clinically Mapped Factors</h4>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        The current data cycle records specific fluctuations. Highly correlated variables investigated by the analytical model:
                      </p>
                      <ul className="space-y-3 text-[11px] font-medium text-slate-700">
                        <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <span className="h-2 w-2 rounded-full bg-slate-400 mt-1 flex-shrink-0"></span>
                          <div>
                            <strong className="block text-slate-900">Seasonal Road Obstacles:</strong>
                            <span className="text-slate-500 block pt-0.5 font-sans leading-normal">Washouts from rainfall events delay ambulance dispatch.</span>
                          </div>
                        </li>
                        <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <span className="h-2 w-2 rounded-full bg-slate-400 mt-1 flex-shrink-0"></span>
                          <div>
                            <strong className="block text-slate-900">Community Outreach Density:</strong>
                            <span className="text-slate-500 block pt-0.5 font-sans leading-normal">Extension worker field screening results in heightened maternal clinics engagement.</span>
                          </div>
                        </li>
                        <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <span className="h-2 w-2 rounded-full bg-slate-400 mt-1 flex-shrink-0"></span>
                          <div>
                            <strong className="block text-slate-900">Drug Stockout Incidents:</strong>
                            <span className="text-slate-500 block pt-0.5 font-sans leading-normal">Intermittent depot shipments directly suppress hypertension compliance loops.</span>
                          </div>
                        </li>
                      </ul>
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 2: PREDICTIVE MODELING */}
              {activeSubTab === "predictions" && (
                <div className="space-y-6">

                  {/* Summary row */}
                  <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6 relative overflow-hidden">
                    <div className="md:col-span-2 space-y-2">
                      <h3 className="text-sm font-bold text-slate-950 uppercase tracking-tight flex items-center gap-1.5 font-sans">
                        <Cpu className="h-4 w-4 text-indigo-600" />
                        <span>Workforce & Bed Occupancy Predictive Modeling</span>
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Using historical monthly run-rates and seasonality factors, the model projects patient flow peaks for incoming cycles. We map these against department resources to project exact bed capacity margins and staffing ratios.
                      </p>
                    </div>

                    <div className="flex flex-col items-center justify-center text-center p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                      <BedDouble className="h-5 w-5 text-indigo-600" />
                      <span className="text-[10px] uppercase font-mono text-slate-400 font-bold block">Predicted Bed Occupancy</span>
                      <strong className="text-2xl font-mono text-slate-900">82% Peak</strong>
                      <span className="text-[9px] text-amber-600 font-semibold block uppercase">Warning Limit Approaching</span>
                    </div>
                  </div>

                  {/* Predictions detail list */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {result.predictiveModeling.predictions.map((pred) => (
                      <div key={pred.indicatorCode} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">

                        {/* Header metadata */}
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-100 pb-3">
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">ID: {pred.indicatorCode}</span>
                            <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 font-sans tracking-tight">{pred.indicatorName}</h4>
                          </div>
                        </div>

                        {/* Interactive custom SVG forecast chart */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-[10px] font-semibold text-slate-400 font-mono tracking-wider">
                            <span>FORECAST (NEXT 4 ETHIOPIAN MONTHS)</span>
                            <span className="text-indigo-600">CONFIDENCE RANGE ±8%</span>
                          </div>

                          {/* Chart display */}
                          <div className="h-40 bg-slate-50 rounded-xl relative border border-slate-100 px-8 pt-4 pb-6 overflow-hidden">
                            {/* Horizontal grid lines */}
                            {[100, 75, 50, 25, 0].map((grid, gIdx) => (
                              <div key={gIdx} className="absolute left-0 right-0 border-t border-slate-200/50" style={{ top: `${(gIdx * 25) + 12}px` }}>
                                <span className="absolute left-2 text-[8px] font-mono font-bold text-slate-400" style={{ transform: "translateY(-50%)" }}>{grid}%</span>
                              </div>
                            ))}

                            {/* SVG Forecast paths */}
                            <svg className="w-full h-full overflow-visible" viewBox="0 0 340 100" preserveAspectRatio="none">
                              {result.predictiveModeling.predictions.length > 0 && (() => {
                                const width = 340;
                                const height = 100;
                                const pts = pred.forecastedMonths.map((m, mIdx) => {
                                  const x = pred.forecastedMonths.length > 1 ? (mIdx / (pred.forecastedMonths.length - 1)) * width : 0;
                                  const y = height - (m.value / 100) * height;
                                  const yUpper = height - (m.confidenceIntervalUpper / 100) * height;
                                  const yLower = height - (m.confidenceIntervalLower / 100) * height;
                                  return { x, y, yUpper, yLower, month: m.month, value: m.value };
                                });

                                // Shaded bounds string
                                let boundsPath = "";
                                if (pts.length > 0) {
                                  boundsPath = `M ${pts[0].x} ${pts[0].yUpper} ` +
                                    pts.slice(1).map(p => `L ${p.x} ${p.yUpper}`).join(" ") +
                                    ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].yLower} ` +
                                    pts.slice().reverse().slice(1).map(p => `L ${p.x} ${p.yLower}`).join(" ") + " Z";
                                }

                                // Forecast line
                                const linePath = pts.length > 0
                                  ? `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ")
                                  : "";

                                return (
                                  <>
                                    {/* Shaded boundaries for confidence width */}
                                    {boundsPath && <path d={boundsPath} fill="rgb(79, 70, 229)" fillOpacity="0.08" />}

                                    {/* Center forecast line */}
                                    {linePath && <path d={linePath} fill="none" stroke="rgb(79, 70, 229)" strokeWidth="2.5" strokeDasharray="4 3" />}

                                    {/* Circles on dots hover trigger */}
                                    {pts.map((p, pIdx) => (
                                      <g key={pIdx}>
                                        <line x1={p.x} y1={0} x2={p.x} y2={height} stroke="rgba(0,0,0,0.03)" strokeWidth="4" />
                                        <circle
                                          cx={p.x}
                                          cy={p.y}
                                          r="4"
                                          fill="rgb(79, 70, 229)"
                                          className="cursor-pointer"
                                          onMouseEnter={() => setHoveredDataPoint({ month: p.month, value: p.value, upper: p.yUpper, lower: p.yLower })}
                                          onMouseLeave={() => setHoveredDataPoint(null)}
                                        />
                                      </g>
                                    ))}
                                  </>
                                );
                              })()}
                            </svg>

                            {/* X-Axis Month names bottom labels */}
                            <div className="absolute bottom-1 left-8 right-0 flex justify-between px-1 text-[9px] font-mono font-bold text-slate-400">
                              {pred.forecastedMonths.map((m) => (
                                <span key={m.month}>{m.month}</span>
                              ))}
                            </div>

                            {/* Hover Tooltip label */}
                            {hoveredDataPoint && (
                              <div className="absolute top-2 right-2 bg-slate-900/90 text-white rounded px-2 py-1 text-[9px] font-mono font-bold pointer-events-none shadow-sm flex gap-1">
                                <span className="truncate max-w-[60px]">{hoveredDataPoint.month}:</span>
                                <span className="text-indigo-400 font-extrabold">{hoveredDataPoint.value}%</span>
                              </div>
                            )}

                          </div>
                        </div>

                        {/* Diagnostics & Resource shortfall block */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                          <div className="space-y-1">
                            <span className="text-[10px] tracking-wider uppercase font-mono font-bold text-slate-400 block">Staff Adequacy Status</span>
                            <div className="flex items-center gap-1.5 pt-1">
                              <Users className="h-4 w-4 text-slate-500" />
                              {getStaffingBadge(pred.staffingNeedScore)}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[10px] tracking-wider uppercase font-mono font-bold text-slate-400 block">Estimated Bed Capacity</span>
                            <div className="flex items-center gap-1.5 font-bold font-mono text-xs pt-0.5 text-indigo-950">
                              <BedDouble className="h-4 w-4 text-indigo-600 block" />
                              <span>{pred.bedOccupancyForecast}% occupancy peak</span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3.5 mt-2 space-y-1">
                          <span className="text-[10px] tracking-wide uppercase font-mono font-extrabold text-amber-700 block">Critical Resource Gaps</span>
                          <p className="text-xs font-sans leading-relaxed text-slate-700">
                            {pred.resourceGapAnalysis}
                          </p>
                        </div>

                      </div>
                    ))}
                  </div>

                </div>
              )}

              {/* TAB 3: KPI EVALUATION */}
              {activeSubTab === "evaluation" && (
                <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-6">

                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-bold text-slate-950 flex items-center gap-1.5 uppercase font-sans">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      <span>KPI Realization & Action Plan Scorecard</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      Evaluates current month cumulative achievements against set baselines (2015) and EFY 2016 targets
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700 min-w-max border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-mono font-bold border-b border-slate-200 uppercase text-[10px]">
                          <th className="p-3">Indicator Code</th>
                          <th className="p-3">Metric description</th>
                          <th className="p-3 text-center">Baseline (2015)</th>
                          <th className="p-3 text-center">Current Target (2016)</th>
                          <th className="p-3 text-center">Current Actual</th>
                          <th className="p-3 text-center">Target achievement</th>
                          <th className="p-3 text-right">Strategic Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-sans">
                        {result.kpiEvaluation.evaluations.map((evalu) => (
                          <React.Fragment key={evalu.indicatorCode}>
                            <tr className="hover:bg-slate-50">
                              <td className="p-3 font-mono font-bold text-slate-900 text-[11px]">{evalu.indicatorCode}</td>
                              <td className="p-3 font-semibold text-slate-900 max-w-sm">
                                {evalu.name}
                              </td>
                              <td className="p-3 text-center font-mono font-medium text-slate-500">{evalu.baseline}%</td>
                              <td className="p-3 text-center font-mono font-bold text-slate-900">{evalu.target}%</td>
                              <td className="p-3 text-center font-mono font-extrabold text-indigo-900">{evalu.currentActual}%</td>
                              <td className="p-3 text-center font-mono">
                                <span className={`font-extrabold text-sm ${evalu.achievementPercentage >= 95 ? "text-emerald-700" : evalu.achievementPercentage >= 70 ? "text-slate-700" : "text-rose-600 animate-pulse"}`}>
                                  {evalu.achievementPercentage}%
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                {getKpiStatusBadge(evalu.kpiStatus)}
                              </td>
                            </tr>
                            <tr className="bg-slate-50">
                              <td colSpan={7} className="p-3 pl-8 text-xs italic text-indigo-900">
                                <div className="flex gap-2 bg-white p-2.5 rounded-lg border border-indigo-100">
                                  <span className="font-extrabold font-mono text-[9px] uppercase tracking-wider text-indigo-700 block mt-0.5 flex-shrink-0">Directive Plan:</span>
                                  <span>{evalu.remedialGuidance}</span>
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

              {/* TAB 4: ACTION DIRECTIVES */}
              {activeSubTab === "recommendations" && (
                <div className="space-y-4">

                  {result.overallRecommendations.map((rec, idx) => (
                    <div key={rec.title} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">

                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 pb-3">
                        <div className="space-y-0.5">
                          <span className="text-[10px] uppercase font-mono tracking-wider font-extrabold text-slate-400">Strategic Resolution {idx + 1}</span>
                          <h3 className="text-sm font-extrabold text-slate-900 tracking-tight leading-none pt-0.5">{rec.title}</h3>
                        </div>
                        <div>
                          {getPriorityBadge(rec.priority)}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <span className="text-[10px] tracking-wider uppercase font-mono font-bold text-slate-400 block">Structured Clinical Action steps</span>
                        <ul className="space-y-2 font-sans text-xs text-slate-700">
                          {rec.actionSteps.map((step, sIdx) => (
                            <li key={sIdx} className="flex gap-2.5 items-start leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100 shadow-inner">
                              <span className="h-5 w-5 rounded-full bg-slate-900 text-white text-[10px] font-bold font-mono flex items-center justify-center flex-shrink-0 mt-0.5">
                                {sIdx + 1}
                              </span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 border-t border-slate-100 pt-3">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-mono font-bold uppercase text-slate-400">Target Timeframe</span>
                          <span className="font-bold text-xs text-slate-800 flex items-center gap-1 block">
                            <Calendar className="h-3.5 w-3.5 text-slate-500" />
                            <span>{rec.timeline}</span>
                          </span>
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-[10px] font-mono font-bold uppercase text-slate-400">Projected Performance Impact</span>
                          <span className="font-bold text-xs text-slate-900 block">
                            {rec.estimatedImpact}
                          </span>
                        </div>
                      </div>

                    </div>
                  ))}

                </div>
              )}

              {/* TAB 5: RECOGNITION BOARD */}
              {activeSubTab === "recognition" && (
                <RecognitionBoard monthlyData={monthlyData} />
              )}

            </div>

          </div>
        )
      )}

    </div>
  );
}
