import React, { useState, useMemo } from 'react';
import { KPIDefinition, KPIRecord, ActionPlan } from '../types';
import { calculateKPIScore, formatPeriod, getFiscalYear, getPeriodType } from '../data';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  FileText, 
  Calendar, 
  ChevronRight, 
  Activity, 
  ThumbsUp,
  Percent,
  AlertCircle
} from 'lucide-react';

interface DashboardPanelProps {
  kpis: KPIDefinition[];
  records: KPIRecord[];
  actionPlans: ActionPlan[];
  onNavigate: (tab: string, kpiId?: number) => void;
}

export default function DashboardPanel({ kpis, records, actionPlans, onNavigate }: DashboardPanelProps) {
  // Find all unique periods in records
  const uniqueMonths = useMemo(() => {
    const list = Array.from(new Set(records.map(r => r.month)));
    return list.sort();
  }, [records]);

  // States to filter the dashboard calculations and selector
  const [fiscalYearFilter, setFiscalYearFilter] = useState<string>('All');
  const [periodTypeFilter, setPeriodTypeFilter] = useState<string>('All');

  // Dynamically extract available fiscal years
  const availableFiscalYears = useMemo(() => {
    const years = Array.from(new Set(records.map(r => getFiscalYear(r.month))));
    return years.filter(y => y !== 'N/A').sort();
  }, [records]);

  // Filter available periods for selector and stats
  const filteredPeriods = useMemo(() => {
    return uniqueMonths.filter(p => {
      const matchType = periodTypeFilter === 'All' || getPeriodType(p) === periodTypeFilter;
      const matchYear = fiscalYearFilter === 'All' || getFiscalYear(p) === fiscalYearFilter;
      return matchType && matchYear;
    });
  }, [uniqueMonths, periodTypeFilter, fiscalYearFilter]);

  // Selected period state
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    if (uniqueMonths.length > 0) {
      return uniqueMonths[uniqueMonths.length - 1];
    }
    return new Date().toISOString().slice(0, 7); // YYYY-MM
  });

  // Active period fallback
  const activePeriod = useMemo(() => {
    if (filteredPeriods.includes(selectedMonth)) {
      return selectedMonth;
    }
    return filteredPeriods[filteredPeriods.length - 1] || selectedMonth;
  }, [filteredPeriods, selectedMonth]);

  // Calculate monthly/periodic stats
  const monthlyStats = useMemo(() => {
    const monthRecords = records.filter(r => r.month === activePeriod);
    let totalAssignedWeight = 0;
    let weightedScoreSum = 0;
    
    // We want to count how many KPIs are set and their performance
    let totalKpis = monthRecords.length;
    let okKpisCount = monthRecords.filter(r => r.status === 'OK').length;
    let targetMetPercent = totalKpis > 0 ? Math.round((okKpisCount / totalKpis) * 100) : 0;
    
    monthRecords.forEach(rec => {
      const kpi = kpis.find(k => k.id === rec.kpiId);
      if (kpi) {
        totalAssignedWeight += kpi.weight;
        weightedScoreSum += (rec.calculatedScore * kpi.weight);
      }
    });

    const averageWeightedScore = totalAssignedWeight > 0 
      ? parseFloat((weightedScoreSum / totalAssignedWeight).toFixed(2)) 
      : 0;

    return {
      averageWeightedScore,
      totalKpis,
      okKpisCount,
      gapKpisCount: totalKpis - okKpisCount,
      targetMetPercent,
      totalWeight: totalAssignedWeight
    };
  }, [records, activePeriod, kpis]);

  // Historical performance trend line (respecting interval type for geometric safety)
  const historicalTrend = useMemo(() => {
    const trendPeriods = uniqueMonths.filter(p => {
      const matchType = periodTypeFilter === 'All' || getPeriodType(p) === periodTypeFilter;
      const matchYear = fiscalYearFilter === 'All' || getFiscalYear(p) === fiscalYearFilter;
      return matchType && matchYear;
    });

    return trendPeriods.map(month => {
      const monthRecords = records.filter(r => r.month === month);
      let totalWeight = 0;
      let weightedSum = 0;
      monthRecords.forEach(rec => {
        const kpi = kpis.find(k => k.id === rec.kpiId);
        if (kpi) {
          totalWeight += kpi.weight;
          weightedSum += (rec.calculatedScore * kpi.weight);
        }
      });
      const score = totalWeight > 0 ? parseFloat((weightedSum / totalWeight).toFixed(1)) : 0;
      return { month, score };
    });
  }, [records, uniqueMonths, kpis, periodTypeFilter, fiscalYearFilter]);

  // Action status counts
  const plansStats = useMemo(() => {
    let completed = actionPlans.filter(p => p.progress === 'Completed').length;
    let inProgress = actionPlans.filter(p => p.progress === 'In progress').length;
    let notStarted = actionPlans.filter(p => p.progress === 'Not started').length;
    return { completed, inProgress, notStarted, total: actionPlans.length };
  }, [actionPlans]);

  // Extract critical gaps for the selected period
  const criticalGapsForMonth = useMemo(() => {
    const monthGaps = records.filter(r => r.month === activePeriod && r.status === 'GAP');
    return monthGaps.map(rec => {
      const kpi = kpis.find(k => k.id === rec.kpiId);
      const plan = actionPlans.find(p => p.kpiId === rec.kpiId && p.month === activePeriod);
      return {
        rec,
        kpi,
        hasPlan: !!plan,
        planStatus: plan ? plan.progress : null
      };
    });
  }, [records, activePeriod, kpis, actionPlans]);

  return (
    <div id="dashboard-panel" className="space-y-6">
      
      {/* Top Banner with Stats */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-white p-6 rounded-2xl border border-slate-100 shadow-sm gap-4">
        <div>
          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
            Chefa Robit Hospital
          </span>
          <h1 className="text-2xl font-bold font-display text-slate-800 mt-2">
            Performance Coordination Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Tracking hospital indicators, identifying gaps, and facilitating active operational resolutions.
          </p>
        </div>

        {/* Flexible Period and Fiscal Year Controls */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-150 self-start md:self-auto">
          {/* Interval Type Selector */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Type:</span>
            <select 
              value={periodTypeFilter}
              onChange={(e) => {
                setPeriodTypeFilter(e.target.value);
                setSelectedMonth(''); // reset state
              }}
              className="bg-white border text-xs font-bold text-slate-700 px-2.5 py-1 rounded-lg"
            >
              <option value="All">All Scales</option>
              <option value="Monthly">Monthly</option>
              <option value="Quarterly">Quarterly</option>
              <option value="Annually">Annually</option>
            </select>
          </div>

          {/* Fiscal Year Filter */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Year:</span>
            <select 
              value={fiscalYearFilter}
              onChange={(e) => {
                setFiscalYearFilter(e.target.value);
                setSelectedMonth(''); // reset state
              }}
              className="bg-white border text-xs font-bold text-slate-700 px-2.5 py-1 rounded-lg"
            >
              <option value="All">All Years</option>
              {availableFiscalYears.map(fy => (
                <option key={fy} value={fy}>{fy}</option>
              ))}
            </select>
          </div>

          {/* Active Period Selector */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 px-2 gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <select 
              value={activePeriod}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent border-0 text-xs font-bold text-slate-800 focus:ring-0 cursor-pointer min-w-[110px]"
            >
              {filteredPeriods.map(m => (
                <option key={m} value={m}>{formatPeriod(m)}</option>
              ))}
              {filteredPeriods.length === 0 && (
                <option value="">No Periods Found</option>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Analytics Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Core Score card (Circular SVG Gauge) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center">
          <span className="text-xs font-medium text-slate-400 self-start">Compliance Index</span>
          
          <div className="relative w-36 h-36 flex items-center justify-center mt-3">
            {/* SVG Circular Gauge */}
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle 
                cx="50" 
                cy="50" 
                r="40" 
                fill="transparent" 
                stroke="rgba(255,255,255,0.08)" 
                strokeWidth="8" 
              />
              {/* Animated Progress Circle */}
              <motion.circle 
                cx="50" 
                cy="50" 
                r="40" 
                fill="transparent" 
                stroke="#C5A059" 
                strokeWidth="8" 
                strokeDasharray={2 * Math.PI * 40}
                initial={{ strokeDashoffset: 2 * Math.PI * 40 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 40 * (1 - monthlyStats.averageWeightedScore / 100) }}
                transition={{ duration: 1, ease: "easeOut" }}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-3xl font-bold font-mono text-slate-800">
                {monthlyStats.averageWeightedScore}%
              </span>
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mt-1">
                Weighted Index
              </span>
            </div>
          </div>
          
          <div className="text-xs text-slate-400 text-center mt-3 font-medium">
            Based on {monthlyStats.totalKpis} active metrics in {formatPeriod(activePeriod)}
          </div>
        </div>

        {/* Target Met percentage */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Target Met Rate</span>
            <span className="bg-emerald-50 text-emerald-600 p-2 rounded-xl">
              <CheckCircle className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-4xl font-bold text-slate-800 font-mono">
              {monthlyStats.targetMetPercent}%
            </h3>
            <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
              <motion.div 
                className="bg-emerald-500 h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${monthlyStats.targetMetPercent}%` }}
                transition={{ duration: 0.8 }}
              />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3 font-medium">
            {monthlyStats.okKpisCount} KPIs cleared targets, {monthlyStats.gapKpisCount} needing attention
          </p>
        </div>

        {/* Active GAPs Info */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Performance GAPs</span>
            <span className="bg-amber-50 text-amber-600 p-2 rounded-xl">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-4xl font-bold text-slate-800 font-mono">
              {monthlyStats.gapKpisCount}
            </h3>
            <p className="text-sm font-semibold text-slate-600 mt-2">
              Unresolved KPI Gaps
            </p>
          </div>
          <p className="text-xs text-slate-400 mt-3 font-medium">
            Deficits require clinical quality corrective action plans.
          </p>
        </div>

        {/* Action Plans Stats */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Action Resolutions</span>
            <span className="bg-blue-50 text-blue-600 p-2 rounded-xl">
              <FileText className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-4 space-y-1">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-emerald-600">Completed</span>
              <span className="font-mono text-slate-700">{plansStats.completed}</span>
            </div>
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-blue-600">In Progress</span>
              <span className="font-mono text-slate-700">{plansStats.inProgress}</span>
            </div>
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-400">Not Started</span>
              <span className="font-mono text-slate-700">{plansStats.notStarted}</span>
            </div>
          </div>
          <div className="text-xs text-slate-400 pt-3 border-t border-slate-100 flex justify-between items-center font-medium">
            <span>Total Action Plans:</span>
            <span className="font-bold font-mono text-slate-600">{plansStats.total}</span>
          </div>
        </div>

      </div>

      {/* Charts section: Trend line card & Comparative bar chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Trend Line Chart (7 columns) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm lg:col-span-7 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold font-display text-slate-800">
                Hospital Weighted Score History
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Average compliance trend across all monitored quarters.</p>
            </div>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>

          <div className="relative h-60 w-full mt-4 flex items-end">
            {/* Draw a neat responsive Line Graph as an SVG */}
            {historicalTrend.length > 0 ? (
              <svg className="w-full h-full overflow-visible" viewBox="0 0 500 240" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="chart-glow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C5A059" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#C5A059" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Y-axis grid lines */}
                {[0, 25, 50, 75, 100].map((yVal, idx) => {
                  const y = 240 - (yVal / 100) * 190 - 20;
                  return (
                    <g key={yVal}>
                      <line x1="0" y1={y} x2="500" y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="3,3" />
                      <text x="-8" y={y + 4} fill="#8a8885" fontSize="10" className="font-mono text-right" textAnchor="end">
                        {yVal}%
                      </text>
                    </g>
                  );
                })}

                {/* Generate Line Points */}
                {(() => {
                  const paddingX = 40;
                  const chartWidth = 420;
                  const stepX = historicalTrend.length > 1 ? chartWidth / (historicalTrend.length - 1) : chartWidth;
                  
                  const points = historicalTrend.map((t, idx) => {
                    const x = paddingX + idx * stepX;
                    const y = 240 - (t.score / 100) * 190 - 20;
                    return { x, y, label: t.month, score: t.score };
                  });

                  const pathD = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                  const areaD = `${pathD} L ${points[points.length - 1].x} 220 L ${points[0].x} 220 Z`;

                  return (
                    <>
                      {/* Area Glow */}
                      <path d={areaD} fill="url(#chart-glow)" />

                      {/* Smooth Trend Line */}
                      <motion.path 
                        d={pathD} 
                        fill="none" 
                        stroke="#C5A059" 
                        strokeWidth="3" 
                        strokeLinecap="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.2, ease: "easeInOut" }}
                      />

                      {/* Vertices & tooltips */}
                      {points.map((p, idx) => (
                        <g key={idx} className="group cursor-pointer">
                          <circle cx={p.x} cy={p.y} r="5" className="fill-gold stroke-[#121212] stroke-2" />
                          {/* Inner hover circle */}
                          <circle cx={p.x} cy={p.y} r="8" className="fill-transparent hover:fill-gold/20" />
                          
                          {/* Text Score Value */}
                          <text x={p.x} y={p.y - 12} fill="#e3deda" fontSize="11" fontWeight="bold" className="font-mono" textAnchor="middle">
                            {p.score}%
                          </text>

                          {/* X-axis labels */}
                          <text x={p.x} y="236" fill="#8a8885" fontSize="10" fontWeight="medium" textAnchor="middle">
                            {p.label}
                          </text>
                        </g>
                      ))}
                    </>
                  );
                })()}
              </svg>
            ) : (
              <div className="flex items-center justify-center h-full w-full text-sm text-slate-400">
                No monthly data recorded yet to draw history.
              </div>
            )}
          </div>
        </div>

        {/* Mini Actual vs. Target Comparative bar (5 columns) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm lg:col-span-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold font-display text-slate-800">
                Recorded KPI Target vs. Score
              </h3>
              <Activity className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-xs text-slate-400">Comparing calculated scores against the standard target (100%) for selected period.</p>
          </div>

          <div className="space-y-4 my-6 overflow-y-auto max-h-48 pr-1">
            {records.filter(r => r.month === activePeriod).map((rec) => {
              const kpi = kpis.find(k => k.id === rec.kpiId);
              if (!kpi) return null;
              
              const isGap = rec.status === 'GAP';
              const displayVal = kpi.type === 'prop' ? `${rec.actualValue}%` : `${rec.actualValue} (${kpi.measure})`;

              return (
                <div key={rec.id} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-700 truncate max-w-[200px]">{kpi.name}</span>
                    <span className={`font-semibold ${isGap ? 'text-rose-600' : 'text-emerald-600'} font-mono`}>
                      {displayVal} (Score: {rec.calculatedScore}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full relative overflow-hidden">
                    {/* Background Target Line indicator (dashed vertical bar) */}
                    <div className="absolute right-[15%] top-0 bottom-0 border-l border-indigo-400/55 border-dashed pointer-events-none" title="Avg Target Barrier" />
                    
                    <motion.div 
                      className={`h-full rounded-full ${isGap ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${rec.calculatedScore}%` }}
                      transition={{ duration: 0.8 }}
                    />
                  </div>
                </div>
              );
            })}

            {records.filter(r => r.month === activePeriod).length === 0 && (
              <div className="h-full flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="w-8 h-8 text-slate-300 mb-2" />
                <span className="text-xs text-slate-400">No KPIs loaded for this period.</span>
              </div>
            )}
          </div>

          <button 
            onClick={() => onNavigate('records')}
            className="w-full py-2 bg-slate-50 hover:bg-slate-100 border border-slate-150 rounded-xl text-xs font-semibold text-slate-600 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            Manage Performance Records <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

      {/* Critical Deficits lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Urgent GAP Alerts */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-rose-50 rounded-lg text-rose-500">
                <AlertCircle className="w-4 h-4" />
              </span>
              <h3 className="text-base font-bold font-display text-slate-800">
                Target GAPs Needing Attention
              </h3>
            </div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">
              Period: {formatPeriod(activePeriod)}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[300px] space-y-3">
            {criticalGapsForMonth.map(({ rec, kpi, hasPlan, planStatus }) => {
              if (!kpi) return null;
              
              return (
                <div 
                  key={rec.id}
                  className="flex items-start justify-between p-4 rounded-xl border border-rose-100 bg-rose-50/20 hover:bg-rose-50/40 transition-colors gap-3"
                >
                  <div className="space-y-1 flex-1">
                    <span className="text-xs text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded-full">
                      GAP: {rec.gap > 0 ? `+${rec.gap}` : rec.gap} {kpi.measure ? `(${kpi.measure})` : ''}
                    </span>
                    <div className="font-semibold text-sm text-slate-800 pt-1">
                      {kpi.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      Actual: <span className="font-mono font-bold text-slate-700">{rec.actualValue}</span> vs. Target: <span className="font-mono text-slate-700">{kpi.target}</span> (Score calculated as <span className="font-mono text-indigo-600 font-semibold">{rec.calculatedScore}%</span>)
                    </div>
                  </div>

                  <div className="flex flex-col items-end justify-center self-stretch gap-2 shrink-0">
                    {hasPlan ? (
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider ${
                        planStatus === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                        planStatus === 'In progress' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        Plan: {planStatus}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> No Action Plan
                      </span>
                    )}

                    <button
                      onClick={() => onNavigate('actions', kpi.id)}
                      className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors"
                    >
                      {hasPlan ? 'Edit Action' : 'Build Action'} <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}

            {criticalGapsForMonth.length === 0 && (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <ThumbsUp className="w-10 h-10 text-emerald-400 mx-auto" />
                <p className="text-sm font-semibold text-slate-600">All Metrics Target Met!</p>
                <p className="text-xs">Congratulations, every monitored KPI is currently clear of deficit for this period.</p>
              </div>
            )}
          </div>
        </div>

        {/* Operational Guidelines & Seeding */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-base font-bold font-display text-slate-800">
              Coordinator System Notes
            </h3>
            
            <div className="space-y-3 text-xs text-slate-600">
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                <span className="p-1 bg-indigo-50 text-indigo-600 rounded-lg mt-0.5 shrink-0">
                  <Percent className="w-4 h-4" />
                </span>
                <div>
                  <h4 className="font-bold text-slate-700">Proportional Calculations</h4>
                  <p className="text-slate-500 mt-0.5">Calculated score is <code className="font-mono bg-slate-100 text-indigo-600 px-1 py-0.5 rounded">(actual / target) * 100</code>, capped at 100%.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                <span className="p-1 bg-teal-50 text-teal-600 rounded-lg mt-0.5 shrink-0">
                  <Activity className="w-4 h-4" />
                </span>
                <div>
                  <h4 className="font-bold text-slate-700">Categorical rules (Scale Tables)</h4>
                  <p className="text-slate-500 mt-0.5">Uses strict thresholds mapped to standard raw indexes. This automatically calculates points, e.g. for <span className="font-semibold text-slate-700">Bed Occupancy Rate</span> score values.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                <span className="p-1 bg-amber-50 text-amber-600 rounded-lg mt-0.5 shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </span>
                <div>
                  <h4 className="font-bold text-slate-700">Automated Gap Identification</h4>
                  <p className="text-slate-500 mt-0.5">GAPs are computed instantly upon actual input entry, signaling an immediate notification alerting the Coordination office.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-2 mt-4">
            <div className="text-xs text-slate-400">
              Active Hospital Coordination Unit: <span className="font-semibold text-slate-600">Chefa Robit Regional Office</span>.
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
