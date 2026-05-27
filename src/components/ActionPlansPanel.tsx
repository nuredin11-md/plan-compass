import React, { useState, useMemo } from 'react';
import { KPIDefinition, KPIRecord, ActionPlan } from '../types';
import { formatPeriod } from '../data';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  User, 
  Clock, 
  CheckCircle, 
  HelpCircle, 
  AlertCircle, 
  Plus, 
  Check, 
  FileText,
  AlertTriangle,
  Loader2,
  ListFilter
} from 'lucide-react';

interface ActionPlansPanelProps {
  kpis: KPIDefinition[];
  records: KPIRecord[];
  actionPlans: ActionPlan[];
  initialSelectedKpiId: number | null;
  onSaveActionPlan: (plan: ActionPlan) => void;
  onDeleteActionPlan: (id: string) => void;
}

export default function ActionPlansPanel({ 
  kpis, 
  records, 
  actionPlans, 
  initialSelectedKpiId,
  onSaveActionPlan,
  onDeleteActionPlan
}: ActionPlansPanelProps) {
  
  // Find all record GAPs across all months
  const kpiGaps = useMemo(() => {
    return records.filter(r => r.status === 'GAP').map(rec => {
      const kpi = kpis.find(k => k.id === rec.kpiId);
      const plan = actionPlans.find(p => p.kpiId === rec.kpiId && p.month === rec.month);
      return {
        rec,
        kpi,
        plan
      };
    }).filter(item => item.kpi !== undefined); // Ensure valid KPI data
  }, [records, kpis, actionPlans]);

  // Selected GAP from the list, default to the one navigated to if available, or first GAP
  const [selectedKpiId, setSelectedKpiId] = useState<number | null>(() => {
    if (initialSelectedKpiId !== null) return initialSelectedKpiId;
    if (kpiGaps.length > 0) return kpiGaps[0].kpi?.id || null;
    return null;
  });

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    if (initialSelectedKpiId !== null) {
      const matchingGap = kpiGaps.find(g => g.kpi?.id === initialSelectedKpiId);
      if (matchingGap) return matchingGap.rec.month;
    }
    if (kpiGaps.length > 0) return kpiGaps[0].rec.month;
    return new Date().toISOString().slice(0, 7);
  });

  // Filters
  const [filterProgress, setFilterProgress] = useState<string>('All GAPs');

  // Currently active GAP details
  const activeGap = useMemo(() => {
    return kpiGaps.find(g => g.kpi?.id === selectedKpiId && g.rec.month === selectedMonth);
  }, [kpiGaps, selectedKpiId, selectedMonth]);

  // Form states
  const [rootCause, setRootCause] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [responsiblePerson, setResponsiblePerson] = useState('');
  const [deadline, setDeadline] = useState('');
  const [progress, setProgress] = useState<'Not started' | 'In progress' | 'Completed'>('Not started');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiNote, setAiNote] = useState('');

  // Handle GAP selection
  const selectGap = (kpiId: number, month: string) => {
    setSelectedKpiId(kpiId);
    setSelectedMonth(month);
    
    // Load existing action plan if it exists
    const plan = actionPlans.find(p => p.kpiId === kpiId && p.month === month);
    if (plan) {
      setRootCause(plan.rootCause);
      setCorrectiveAction(plan.correctiveAction);
      setResponsiblePerson(plan.responsiblePerson);
      setDeadline(plan.deadline);
      setProgress(plan.progress);
    } else {
      // Clear form for new plan
      setRootCause('');
      setCorrectiveAction('');
      setResponsiblePerson('');
      setDeadline('');
      setProgress('Not started');
    }
    setAiNote('');
  };

  // Initial form load on first selection or change of GAP
  React.useEffect(() => {
    if (activeGap) {
      if (activeGap.plan) {
        setRootCause(activeGap.plan.rootCause);
        setCorrectiveAction(activeGap.plan.correctiveAction);
        setResponsiblePerson(activeGap.plan.responsiblePerson);
        setDeadline(activeGap.plan.deadline);
        setProgress(activeGap.plan.progress);
      } else {
        setRootCause('');
        setCorrectiveAction('');
        setResponsiblePerson('');
        setDeadline('');
        setProgress('Not started');
      }
      setAiNote('');
    }
  }, [selectedKpiId, selectedMonth]);

  // Ask AI for clinical suggestions using the server-side proxy
  const askAiCopilot = async () => {
    if (!activeGap || !activeGap.kpi) return;
    
    setIsAiLoading(true);
    setAiNote('');

    try {
      const gapDescription = `Actual performance on ${activeGap.kpi.name} is ${activeGap.rec.actualValue} vs. target threshold ${activeGap.kpi.target} (${activeGap.kpi.measure || 'units'}) during ${selectedMonth}. Difference is ${activeGap.rec.gap}.`;

      const response = await fetch("/api/gemini/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kpiName: activeGap.kpi.name,
          gapDescription,
          targetValue: activeGap.kpi.target,
          actualValue: activeGap.rec.actualValue,
          measure: activeGap.kpi.measure
        })
      });

      const data = await response.json();
      if (response.ok) {
        setRootCause(data.rootCause || "Analysis missing");
        setCorrectiveAction(data.correctiveAction || "Action items missing");
        setResponsiblePerson(data.suggestedResponsible || "Coordinator");
        setDeadline(data.suggestedDeadline || new Date().toISOString().slice(0, 10));
        
        if (data.note) {
          setAiNote(data.note);
        } else {
          setAiNote("Successfully generated high-accuracy root causes and actions using Gemini 3.5 Copilot.");
        }
      } else {
        alert(`Failed to retrieve AI suggestion: ${data.error || "Unknown response"}`);
      }
    } catch (e: any) {
      console.error(e);
      alert(`API network error requesting AI suggestions: ${e.message}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Save changes
  const handleSave = () => {
    if (!activeGap || !activeGap.kpi) {
      alert("Please select a valid GAP from the index first.");
      return;
    }

    const gapDescription = `Actual performance on ${activeGap.kpi.name} is ${activeGap.rec.actualValue} vs. target ${activeGap.kpi.target} (${activeGap.kpi.measure || 'units'}) for ${selectedMonth}.`;

    const plan: ActionPlan = {
      id: activeGap.plan?.id || `plan_${selectedMonth}_${activeGap.kpi.id}`,
      kpiId: activeGap.kpi.id,
      month: selectedMonth,
      gapDescription,
      rootCause,
      correctiveAction,
      responsiblePerson,
      deadline,
      progress
    };

    onSaveActionPlan(plan);
    alert("Action Plan updated successfully.");
  };

  // Filter GAPs list based on progress
  const filteredGaps = useMemo(() => {
    return kpiGaps.filter(g => {
      if (filterProgress === 'All GAPs') return true;
      if (filterProgress === 'No Action Plan') return !g.plan;
      if (filterProgress === 'In progress') return g.plan && g.plan.progress === 'In progress';
      if (filterProgress === 'Completed') return g.plan && g.plan.progress === 'Completed';
      return true;
    });
  }, [kpiGaps, filterProgress]);

  return (
    <div id="action-plans-panel" className="relative">
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left column: GAP Alert Sidebar Index (4 columns) */}
        <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-rose-50 text-rose-500 rounded-lg">
                <AlertTriangle className="w-4 h-4 animate-bounce" />
              </span>
              <h3 className="font-bold font-display text-sm text-slate-800">Hospital Deficit Index</h3>
            </div>
            <span className="text-xs bg-slate-100 text-slate-600 font-mono font-bold px-2 py-0.5 rounded-full">
              {kpiGaps.length} GAPs
            </span>
          </div>

          {/* Quick status filter select */}
          <div className="relative">
            <ListFilter className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <select
              value={filterProgress}
              onChange={(e) => setFilterProgress(e.target.value)}
              className="bg-slate-50 border border-slate-150 text-xs rounded-xl pl-9 pr-4 py-2 w-full focus:bg-white focus:ring-1 focus:ring-emerald-500"
            >
              <option value="All GAPs">Show All GAPs</option>
              <option value="No Action Plan">Show Lacking Action Plan</option>
              <option value="In progress">In Progress Resolutions</option>
              <option value="Completed">Completed Resolutions</option>
            </select>
          </div>

          <div className="divide-y divide-slate-100 overflow-y-auto max-h-[500px] pr-1 space-y-2 pt-1">
            {filteredGaps.map(item => {
              const rec = item.rec;
              const kpi = item.kpi!;
              const plan = item.plan;
              
              const isSelected = selectedKpiId === kpi.id && selectedMonth === rec.month;

              return (
                <button
                  key={`${rec.month}_${kpi.id}`}
                  onClick={() => selectGap(kpi.id, rec.month)}
                  className={`w-full text-left p-3.5 rounded-xl transition-all border flex flex-col gap-1.5 focus:outline-none cursor-pointer mt-1 ${
                    isSelected 
                      ? 'bg-slate-950 text-white border-slate-900 shadow-md' 
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`}>
                      Period: {formatPeriod(rec.month)}
                    </span>
                    
                    {plan ? (
                      <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                        plan.progress === 'Completed' ? 'bg-emerald-100 text-emerald-900' :
                        plan.progress === 'In progress' ? 'bg-blue-100 text-blue-900' : 'bg-slate-200 text-slate-800'
                      }`}>
                        {plan.progress}
                      </span>
                    ) : (
                      <span className="text-[8px] font-extrabold bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-0.5">
                        Lacking Plan
                      </span>
                    )}
                  </div>

                  <h4 className="font-bold text-xs truncate w-full" title={kpi.name}>
                    {kpi.name}
                  </h4>

                  <div className="flex items-center justify-between w-full text-[10px] pt-1 border-t border-slate-100/10">
                    <span className={isSelected ? 'text-slate-400' : 'text-slate-400'}>
                      Actual: <span className="font-semibold">{rec.actualValue}</span>
                    </span>
                    <span className={`font-mono font-bold ${isSelected ? 'text-rose-400' : 'text-rose-600'}`}>
                      Gap: {rec.gap > 0 ? `+${rec.gap}` : rec.gap}
                    </span>
                  </div>
                </button>
              );
            })}

            {filteredGaps.length === 0 && (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto" />
                <p className="text-xs font-semibold text-slate-600">No matching gaps found</p>
                <p className="text-[11px]">All checked parameters are clean or actions match this filter query.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right column: Action Plan Editor & AI Suggestion Copilot (8 columns) */}
        <div className="lg:col-span-8 space-y-6">
          
          {activeGap ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
              
              {/* Gap overview header */}
              <div className="pb-4 border-b border-slate-100 flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-rose-500 font-bold bg-rose-50 px-2 py-0.5 rounded-full inline-block uppercase tracking-wider mb-2">
                    Period: {formatPeriod(selectedMonth)} Gap Alert
                  </div>
                  <h3 className="text-lg font-bold font-display text-slate-800">
                    Resolution Plan: {activeGap.kpi?.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Calculate Gap Value: <span className="font-mono font-bold text-rose-600">{activeGap.rec.gap}</span> (Score calculated as <span className="font-mono text-slate-600 font-semibold">{activeGap.rec.calculatedScore}%</span>)
                  </p>
                </div>

                {/* Ask AI Copilot button - leverages our server side Gemini suggestor */}
                <button
                  onClick={askAiCopilot}
                  disabled={isAiLoading}
                  className="py-2.5 px-4.5 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-700 hover:to-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all self-start md:self-auto uppercase tracking-wide group"
                >
                  {isAiLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Synthesizing Actions...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 group-hover:scale-110 transition-transform" /> Ask Gemini AI Copilot
                    </>
                  )}
                </button>
              </div>

              {/* AI note / disclaimer block */}
              {aiNote && (
                <div className="p-3 bg-indigo-50/50 border border-indigo-100 text-[11px] text-indigo-800 rounded-xl flex items-start gap-2 animate-fadeIn">
                  <Sparkles className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <div>
                    {aiNote}
                  </div>
                </div>
              )}

              {/* Action Plan Form */}
              <div className="space-y-4">
                
                {/* Automatically prebuilt GAP description */}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Gap Indicator / Target Check</label>
                  <p className="text-xs bg-slate-50 p-2.5 border border-slate-100 rounded-xl text-slate-600 font-medium">
                    Actual score is <span className="font-bold text-slate-700 font-mono">{activeGap.rec.actualValue}</span> vs. target threshold of <span className="font-bold text-slate-700 font-mono">{activeGap.kpi?.target}</span> (Calculated score: <span className="font-mono text-indigo-600 font-bold">{activeGap.rec.calculatedScore}%</span>)
                  </p>
                </div>

                {/* Root Cause Analysis area */}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Root Cause Analysis (Why did this happen?)</label>
                  <textarea
                    rows={3}
                    placeholder="Provide detailed clinical or administrative root cause analysis (e.g. staff ratios, document backlogs, drug pipeline stockouts)..."
                    value={rootCause}
                    onChange={(e) => setRootCause(e.target.value)}
                    className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-xl p-3 text-sm focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* Corrective Action suggestions */}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Proposed Corrective Action Plan</label>
                  <textarea
                    rows={4}
                    placeholder="Outline step-by-step corrective resolutions with clear execution milestones..."
                    value={correctiveAction}
                    onChange={(e) => setCorrectiveAction(e.target.value)}
                    className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-xl p-3 text-sm focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* Layout for Responsible Person and Deadline */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Designated Responsible Person/Role</label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="e.g. Emergency Dept Head"
                        value={responsiblePerson}
                        onChange={(e) => setResponsiblePerson(e.target.value)}
                        className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-xl pl-9 pr-4 py-2.5 text-xs font-bold focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Action Resolution Deadline</label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <input
                        type="date"
                        value={deadline}
                        onChange={(e) => setDeadline(e.target.value)}
                        className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-xl pl-9 pr-4 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Progress selectors */}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Resolution Progress Status</label>
                  <div className="flex flex-wrap gap-3">
                    {['Not started', 'In progress', 'Completed'].map((prog) => {
                      const isSelected = progress === prog;
                      return (
                        <button
                          key={prog}
                          onClick={() => setProgress(prog as any)}
                          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all border shrink-0 cursor-pointer ${
                            isSelected 
                              ? prog === 'Completed' ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm' :
                                prog === 'In progress' ? 'bg-blue-600 text-white border-blue-700 shadow-sm' :
                                'bg-slate-800 text-white border-slate-900 shadow-sm'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-150'
                          }`}
                        >
                          {prog === 'Completed' && isSelected && '✓ '}
                          {prog}
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* Form Save Button actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div>
                  {activeGap.plan ? (
                    <button
                      onClick={() => {
                        if (window.confirm("Are you sure you want to delete this actions plan?")) {
                          onDeleteActionPlan(activeGap.plan!.id);
                          setRootCause('');
                          setCorrectiveAction('');
                          setResponsiblePerson('');
                          setDeadline('');
                          setProgress('Not started');
                        }
                      }}
                      className="px-4 py-2 border border-rose-100 text-rose-600 bg-rose-50 hover:bg-rose-100 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      Delete Resolution Plan
                    </button>
                  ) : null}
                </div>

                <button
                  onClick={handleSave}
                  className="px-6 py-2.5 bg-slate-950 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-colors shadow-md cursor-pointer flex items-center gap-1"
                >
                  <Check className="w-4 h-4" /> Save Resolution Action Plan
                </button>
              </div>

            </div>
          ) : (
            <div className="bg-white p-12 rounded-2xl border border-slate-100 shadow-sm text-center space-y-4">
              <FileText className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-700">No performance GAPs selected</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                First, select an indicator on the left side panel to view clinical root causes or build new corrective action plans.
              </p>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
