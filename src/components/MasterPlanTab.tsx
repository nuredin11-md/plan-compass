import React, { useState, useMemo, useEffect } from "react";
import { type MonthlyEntry, type Indicator } from "@/data/hospitalIndicators";
import { useIndicators } from "@/context/IndicatorsContext";
import { 
  Search, Filter, Plus, Trash2, Edit2, Check, X, Maximize2, Minimize2, 
  HelpCircle, Sparkles, ArrowUpDown, CalendarRange, TrendingUp, Landmark, ShieldCheck,
  Trophy, Settings, Activity, CheckSquare, Info, Save, RefreshCw, Sliders, ListTodo, BadgeAlert
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  monthlyData: MonthlyEntry[];
  selectedYear: number;
  previousYearData: MonthlyEntry[];
}

// Department list from the app
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

// ── Recognition Board Weights Configuration ───────────────────────────────────

const DEFAULT_WEIGHTS: { label: string; weight: number; color: string }[] = [
  { label: "Programme Performance", weight: 35, color: "#0ea5e9" },
  { label: "EHSIG Score", weight: 25, color: "#8b5cf6" },
  { label: "IPC Practices", weight: 20, color: "#10b981" },
  { label: "Data Quality", weight: 20, color: "#f59e0b" },
];

// ── Main Component ────────────────────────────────────────────────────────────

export default function MasterPlanTab({ monthlyData, selectedYear, previousYearData }: Props) {
  const { indicators } = useIndicators();
  
  // Filters & State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedDepartment, setSelectedDepartment] = useState("All");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sortBy, setSortBy] = useState<"code" | "name">("code");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Sub-tab selection: "indicators" or "recognition"
  const [activeSubTab, setActiveSubTab] = useState<"indicators" | "recognition">("indicators");

  // Recognition weights configuration
  const [weights, setWeights] = useState<{ label: string; weight: number; color: string }[]>(() => {
    const cached = localStorage.getItem("plan_compass_recognition_criteria");
    if (cached) {
      try { return JSON.parse(cached); } catch (e) { console.error(e); }
    }
    return DEFAULT_WEIGHTS;
  });

  // Selected indicator codes per department
  const [selectedIndicatorsByDept, setSelectedIndicatorsByDept] = useState<Record<string, string[]>>(() => {
    const cached = localStorage.getItem("plan_compass_selected_indicators_by_dept");
    if (cached) {
      try { return JSON.parse(cached); } catch (e) { console.error(e); }
    }
    const defaultObj: Record<string, string[]> = {};
    DEPARTMENTS.forEach(dept => {
      defaultObj[dept] = [];
    });
    return defaultObj;
  });

  const [selectedYearFilter, setSelectedYearFilter] = useState("All");
  const [selectedIndicatorCode, setSelectedIndicatorCode] = useState("All");

  const [evalSetupYear, setEvalSetupYear] = useState(() => {
    return localStorage.getItem("plan_compass_setup_year") || "2018";
  });
  const [evalSetupInterval, setEvalSetupInterval] = useState<"annual" | "six-month" | "quarterly">(() => {
    return (localStorage.getItem("plan_compass_setup_interval") as any) || "annual";
  });
  const [evalSetupRef, setEvalSetupRef] = useState(() => {
    return localStorage.getItem("plan_compass_setup_ref") || "Annual";
  });

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Inline edit state
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editTarget, setEditTarget] = useState(0);

  // Add Indicator form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("count");
  const [newTarget, setNewTarget] = useState(0);

  // Handle Sort Toggle
  const toggleSort = (field: "code" | "name") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  // Extract unique categories for filter
  const categories = useMemo(() => {
    const cats = new Set(indicators.map((ind) => ind.category || ind.programArea));
    return ["All", ...Array.from(cats)];
  }, [indicators]);

  // Segment indicators dynamically by departments
  const deptIndicatorsMap = useMemo(() => {
    const map: Record<string, Indicator[]> = {};
    DEPARTMENTS.forEach((dept) => {
      map[dept] = [];
    });
    indicators.forEach((ind) => {
      const dept = ind.department || ind.programArea;
      if (map[dept] !== undefined) {
        map[dept].push(ind);
      }
    });
    return map;
  }, [indicators]);

  // Sum of weights validation
  const totalWeightSum = useMemo(() => {
    return weights.reduce((sum, item) => sum + item.weight, 0);
  }, [weights]);

  // Filtered & Sorted indicators
  const filteredIndicators = useMemo(() => {
    let result = indicators.filter((ind) => {
      const matchesSearch = 
        ind.indicator.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ind.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === "All" || (ind.category || ind.programArea) === selectedCategory;
      const matchesDept = selectedDepartment === "All" || (ind.department || ind.programArea) === selectedDepartment;
      const matchesIndicator = selectedIndicatorCode === "All" || ind.code === selectedIndicatorCode;
      
      return matchesSearch && matchesCategory && matchesDept && matchesIndicator;
    });

    result.sort((a, b) => {
      let valA: any = sortBy === "code" ? a.code : a.indicator;
      let valB: any = sortBy === "code" ? b.code : b.indicator;

      if (typeof valA === "string") {
        return sortOrder === "asc" 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      } else {
        return sortOrder === "asc" 
          ? (valA as number) - (valB as number) 
          : (valB as number) - (valA as number);
      }
    });

    return result;
  }, [indicators, searchTerm, selectedCategory, selectedDepartment, selectedIndicatorCode, sortBy, sortOrder]);

  // Methods
  const startEdit = (ind: Indicator) => {
    setEditingCode(ind.code);
    setEditName(ind.indicator);
    setEditUnit(ind.unit);
    setEditTarget(ind.target || 0);
  };

  const saveEdit = (ind: Indicator) => {
    const updated: Indicator = {
      ...ind,
      indicator: editName,
      unit: editUnit,
      target: Number(editTarget),
    };
    setEditingCode(null);
  };

  const deleteIndicator = (code: string) => {
    if (confirm(`Are you sure you want to delete indicator \"${code}\"?`)) {
    }
  };

  const submitAddForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (indicators.some(ind => ind.code.toLowerCase() === newCode.trim().toLowerCase())) {
      alert(`Error: An indicator with the Code \"${newCode.toUpperCase()}\" already exists.`);
      return;
    }

    const created: Indicator = {
      code: newCode.trim().toUpperCase(),
      indicator: newName.trim(),
      unit: newUnit,
      target: Number(newTarget),
      programArea: selectedDepartment !== "All" ? selectedDepartment : "Other",
      baseline: 0,
      category: selectedCategory !== "All" ? selectedCategory : "General",
      subProgram: "General",
      actualPerformance: 0,
      achievement: 0,
    };
    
    setNewCode("");
    setNewName("");
    setNewTarget(0);
    setShowAddForm(false);
  };

  // Configuration handlers for Recognition Board
  const handleWeightChange = (index: number, val: number) => {
    const updated = [...weights];
    updated[index].weight = isNaN(val) ? 0 : val;
    setWeights(updated);
  };

  const handleEqualizeWeights = () => {
    const equalized = weights.map((w) => ({
      ...w,
      weight: 25
    }));
    setWeights(equalized);
  };

  const toggleIndicatorSelection = (dept: string, code: string) => {
    setSelectedIndicatorsByDept((prev) => {
      const currentCodes = prev[dept] || [];
      const updatedCodes = currentCodes.includes(code)
        ? currentCodes.filter((c) => c !== code)
        : [...currentCodes, code];
      
      return {
        ...prev,
        [dept]: updatedCodes
      };
    });
  };

  const handleSelectAllInDept = (dept: string) => {
    const allCodes = (deptIndicatorsMap[dept] || []).map((i) => i.code);
    setSelectedIndicatorsByDept((prev) => ({
      ...prev,
      [dept]: allCodes
    }));
  };

  const handleClearAllInDept = (dept: string) => {
    setSelectedIndicatorsByDept((prev) => ({
      ...prev,
      [dept]: []
    }));
  };

  const saveRecognitionSettings = () => {
    if (totalWeightSum !== 100) {
      setErrorMsg("Error: Sum of Criteria Weights must equal exactly 100% to save settings.");
      setSaveSuccess(false);
      return;
    }

    try {
      localStorage.setItem("plan_compass_recognition_criteria", JSON.stringify(weights));
      localStorage.setItem("plan_compass_selected_indicators_by_dept", JSON.stringify(selectedIndicatorsByDept));
      localStorage.setItem("plan_compass_setup_year", evalSetupYear);
      localStorage.setItem("plan_compass_setup_interval", evalSetupInterval);
      localStorage.setItem("plan_compass_setup_ref", evalSetupRef);
      setErrorMsg("");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (e: any) {
      setErrorMsg(`Failed to save: ${e.message}`);
    }
  };

  const filteredIndicatorListForDropdown = useMemo(() => {
    return indicators.filter(ind => selectedDepartment === "All" || (ind.department || ind.programArea) === selectedDepartment);
  }, [indicators, selectedDepartment]);

  return (
    <div className={`transition-all duration-300 ${isFullscreen ? "fixed inset-0 z-50 bg-slate-50 p-6 overflow-y-auto" : "relative"} space-y-6 animate-fadeIn`}>
      
      {/* Informative Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-lg border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-indigo-500/25 border border-indigo-400/40 text-indigo-200 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Master Plan Management
              </span>
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Strategic Objectives
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight font-sans text-white leading-none">
              Strategic Master Plan Indicators &amp; Recognition Configuration
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-3xl">
              Manage performance indicators and configure department recognition criteria weights and focus areas.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 self-start md:self-center">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="h-10 px-4 border border-slate-700 bg-slate-800/80 hover:bg-slate-850 text-slate-200 hover:text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              <span>{isFullscreen ? "Normal Screen" : "Maximize Screen"}</span>
            </button>

            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="h-10 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer hover:scale-[1.02]"
            >
              <Plus className="h-4 w-4" />
              <span>Add Indicator</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div className="flex border-b border-rose-100 bg-white/50 backdrop-blur-md p-1.5 rounded-xl gap-2 shadow-sm border">
        <button
          type="button"
          onClick={() => setActiveSubTab("indicators")}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeSubTab === "indicators"
              ? "bg-indigo-600 text-white shadow-md font-extrabold"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
          }`}
        >
          <Landmark className="h-4 w-4" />
          <span>📊 Indicators Management</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("recognition")}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeSubTab === "recognition"
              ? "bg-amber-500 text-white shadow-md font-extrabold"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
          }`}
        >
          <Trophy className="h-4 w-4" />
          <span>🏆 Recognition Setup</span>
        </button>
      </div>

      {activeSubTab === "indicators" ? (
        <>
          {/* Add Indicator Form */}
          {showAddForm && (
            <div className="bg-white rounded-2xl border border-indigo-150 p-6 animate-slideDown shadow-md">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-500 animate-pulse" />
                  <span>Add New Performance Indicator</span>
                </h3>
                <button onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded hover:bg-slate-100">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={submitAddForm} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">Indicator Code</label>
                    <input
                      type="text"
                      placeholder="e.g. MCH_ANC_04"
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value)}
                      className="w-full h-10 px-3 border border-slate-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-indigo-500"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">Unit of Measure</label>
                    <input
                      type="text"
                      placeholder="e.g. %, count, Rate"
                      value={newUnit}
                      onChange={(e) => setNewUnit(e.target.value)}
                      className="w-full h-10 px-3 border border-slate-300 rounded-lg text-xs bg-white"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">Annual Target</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={newTarget}
                      onChange={(e) => setNewTarget(Number(e.target.value))}
                      className="w-full h-10 px-3 border border-slate-300 rounded-lg text-xs bg-white"
                      required
                    />
                  </div>

                  <div className="space-y-1 md:col-span-3">
                    <label className="block text-xs font-bold text-slate-700">Indicator Description</label>
                    <input
                      type="text"
                      placeholder="Clear description of what this indicator measures..."
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full h-10 px-3 border border-slate-300 rounded-lg text-xs bg-white"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white rounded-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="h-4 w-4" />
                    <span>Save Indicator</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Filter and Search Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
              <div className="relative w-full lg:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by code or name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-10 pl-9 pr-4 text-xs bg-slate-50 border border-slate-205 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
                <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-405 pr-1">
                  <Filter className="h-3.5 w-3.5 text-slate-400" />
                  <span>Filters</span>
                </div>

                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="h-10 px-3 border border-slate-205 rounded-xl text-xs bg-slate-50 text-slate-800 font-bold focus:outline-none cursor-pointer"
                >
                  <option value="All">Category: All</option>
                  {categories.filter(c => c !== "All").map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <select
                  value={selectedDepartment}
                  onChange={(e) => {
                    setSelectedDepartment(e.target.value);
                    setSelectedIndicatorCode("All");
                  }}
                  className="h-10 px-3 border border-slate-205 rounded-xl text-xs bg-slate-50 text-slate-800 font-bold focus:outline-none cursor-pointer"
                >
                  <option value="All">Department: All</option>
                  {DEPARTMENTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>

                <select
                  value={selectedIndicatorCode}
                  onChange={(e) => setSelectedIndicatorCode(e.target.value)}
                  className="h-10 px-3 border border-slate-205 rounded-xl text-xs bg-slate-50 text-slate-800 font-bold focus:outline-none cursor-pointer max-w-[200px]"
                >
                  <option value="All">Indicator: All</option>
                  {filteredIndicatorListForDropdown.map((ind) => (
                    <option key={ind.code} value={ind.code}>
                      [{ind.code}] {ind.indicator.length > 30 ? `${ind.indicator.slice(0, 30)}...` : ind.indicator}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Main Data Grid */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-150 text-left text-xs font-sans">
                <thead className="bg-slate-50 font-bold text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-150">
                  <tr>
                    <th 
                      onClick={() => toggleSort("code")}
                      className="px-4 py-3 select-none cursor-pointer hover:bg-slate-100 transition-colors font-mono"
                    >
                      <div className="flex items-center gap-1 font-extrabold text-slate-900">
                        <span>CODE</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    
                    <th className="px-5 py-3 min-w-[300px]">INDICATOR DESCRIPTION</th>
                    
                    <th className="px-3 py-3 text-center">UNIT</th>
                    
                    <th className="px-3 py-3 text-right">TARGET</th>
                    
                    <th className="px-3 py-3 text-center">DEPARTMENT</th>

                    <th className="px-4 py-3 text-center">ACTIONS</th>
                  </tr>
                </thead>
                
                <tbody className="divide-y divide-slate-100 bg-white text-slate-700 font-medium">
                  {filteredIndicators.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-16 text-slate-400">
                        <p className="font-bold text-slate-800 text-sm">No Indicators Found</p>
                        <p className="text-xs text-slate-400 mt-1">Add a new indicator or adjust your search.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredIndicators.map((ind) => {
                      const isEditing = editingCode === ind.code;
                      return (
                        <tr 
                          key={ind.code}
                          className={`hover:bg-slate-50/60 transition-colors ${isEditing ? "bg-indigo-50/30 hover:bg-indigo-50/30" : ""}`}
                        >
                          <td className="px-4 py-3.5 font-mono font-bold text-slate-900 border-r border-slate-100">
                            {ind.code}
                          </td>

                          <td className="px-5 py-3.5">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full p-2 border border-indigo-300 rounded-lg text-xs bg-white text-slate-900 font-medium focus:ring-1 focus:ring-indigo-500"
                              />
                            ) : (
                              <p className="font-semibold text-slate-900 leading-snug">{ind.indicator}</p>
                            )}
                          </td>

                          <td className="px-3 py-3.5 text-center text-slate-500">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editUnit}
                                onChange={(e) => setEditUnit(e.target.value)}
                                className="w-16 p-1 border border-indigo-300 rounded text-center text-xs"
                              />
                            ) : (
                              <span className="font-mono text-slate-650">{ind.unit}</span>
                            )}
                          </td>

                          <td className="px-3 py-3.5 text-right font-mono text-slate-900 font-bold">
                            {isEditing ? (
                              <input
                                type="number"
                                value={editTarget}
                                onChange={(e) => setEditTarget(Number(e.target.value))}
                                className="w-24 p-1 border border-indigo-300 text-right text-xs rounded"
                              />
                            ) : (
                              <span>{ind.target || 0}</span>
                            )}
                          </td>

                          <td className="px-3 py-3.5 text-center">
                            <span className="text-[9px] tracking-wide uppercase px-1.5 py-0.5 bg-indigo-50 text-indigo-750 font-bold rounded">
                              {ind.department || ind.programArea}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {isEditing ? (
                                <>
                                  <button
                                    onClick={() => saveEdit(ind)}
                                    className="h-7 w-7 rounded-lg bg-emerald-100 hover:bg-emerald-250 text-emerald-800 flex items-center justify-center transition-colors cursor-pointer"
                                    title="Save changes"
                                  >
                                    <Check className="h-4 w-4" />
                                  </button>
                                  
                                  <button
                                    onClick={() => setEditingCode(null)}
                                    className="h-7 w-7 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 flex items-center justify-center transition-colors cursor-pointer"
                                    title="Cancel editing"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => startEdit(ind)}
                                    className="h-7 w-7 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-indigo-650 flex items-center justify-center cursor-pointer transition-transform hover:scale-105"
                                    title="Edit indicator"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </button>

                                  <button
                                    onClick={() => deleteIndicator(ind.code)}
                                    className="h-7 w-7 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center cursor-pointer transition-transform hover:scale-105"
                                    title="Delete indicator"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-6 animate-fadeIn">
          {/* Active Period Evaluation Setup */}
          <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-2xl p-5 text-white shadow-sm border border-amber-400/30">
            <div className="flex items-start gap-3">
              <CalendarRange className="h-6 w-6 mt-0.5 animate-pulse" />
              <div className="space-y-2 flex-1">
                <h3 className="text-sm font-black font-sans uppercase tracking-wider">Evaluation Period Configuration</h3>
                <p className="text-xs text-amber-50">
                  Configure the evaluation cycle and reference period for department recognition scoring.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold uppercase text-amber-100">Evaluation Year</label>
                    <select
                      value={evalSetupYear}
                      onChange={(e) => setEvalSetupYear(e.target.value)}
                      className="w-full h-9 px-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-xs font-bold text-white focus:outline-none cursor-pointer"
                    >
                      <option className="text-slate-800" value="2016">2016 EFY</option>
                      <option className="text-slate-800" value="2017">2017 EFY</option>
                      <option className="text-slate-800" value="2018">2018 EFY</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold uppercase text-amber-100">Evaluation Interval</label>
                    <select
                      value={evalSetupInterval}
                      onChange={(e) => {
                        const newInt = e.target.value as any;
                        setEvalSetupInterval(newInt);
                        if (newInt === "annual") setEvalSetupRef("Annual");
                      }}
                      className="w-full h-9 px-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-xs font-bold text-white focus:outline-none cursor-pointer"
                    >
                      <option className="text-slate-800" value="annual">Annually</option>
                      <option className="text-slate-800" value="six-month">Semi-Annually</option>
                      <option className="text-slate-800" value="quarterly">Quarterly</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold uppercase text-amber-100">Period Reference</label>
                    <input
                      type="text"
                      value={evalSetupRef}
                      onChange={(e) => setEvalSetupRef(e.target.value)}
                      className="w-full h-9 px-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-xs font-bold text-white focus:outline-none"
                      placeholder="e.g., Annual, H1, Q1"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recognition Board Weights Configuration */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 mb-6 gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-indigo-650" />
                  <span>Department Recognition Criteria Weights</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Configure the relative priority of each scoring dimension for department rankings.
                </p>
              </div>
              <div className="flex items-center gap-3 font-sans">
                <button
                  type="button"
                  onClick={handleEqualizeWeights}
                  className="h-9 px-3 border border-slate-300 bg-slate-50 text-slate-705 hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Equalize (25% each)</span>
                </button>
                <button
                  type="button"
                  disabled={totalWeightSum !== 100}
                  onClick={saveRecognitionSettings}
                  className={`h-9 px-4 rounded-lg text-xs font-bold flex items-center gap-2 shadow transition-all cursor-pointer ${
                    totalWeightSum === 100
                      ? "bg-amber-500 hover:bg-amber-600 text-white"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  <Save className="h-4 w-4" />
                  <span>Save Configuration</span>
                </button>
              </div>
            </div>

            {saveSuccess && (
              <div className="bg-emerald-50 border border-emerald-250 text-emerald-800 rounded-xl p-4 flex items-start gap-2.5 mb-6 animate-slideDown">
                <Check className="h-5 w-5 text-emerald-600 mt-0.5" />
                <div>
                  <p className="text-xs font-bold">Settings Saved Successfully!</p>
                  <p className="text-[11px] text-emerald-700 mt-0.5">Recognition Board rankings will update instantly.</p>
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-4 flex items-start gap-2.5 mb-6 animate-slideDown">
                <BadgeAlert className="h-5 w-5 text-rose-600 mt-0.5" />
                <div>
                  <p className="text-xs font-bold">Configuration Error</p>
                  <p className="text-[11px] text-rose-700 mt-0.5">{errorMsg}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {weights.map((item, idx) => (
                <div key={item.label} className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 font-sans">{item.label}</span>
                    <span
                      className="text-xs font-mono font-extrabold px-2 py-0.5 rounded-md"
                      style={{ color: item.color, backgroundColor: `${item.color}15` }}
                    >
                      {item.weight}%
                    </span>
                  </div>
                  <div className="space-y-1">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={item.weight}
                      onChange={(e) => handleWeightChange(idx, parseInt(e.target.value))}
                      className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-indigo-600 bg-slate-200"
                    />
                    <div className="flex justify-between text-[10px] text-slate-405 font-mono">
                      <span>0%</span>
                      <span>50%</span>
                      <span>100%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between bg-slate-50 rounded-xl p-3 border border-slate-150">
              <span className="text-xs font-semibold text-slate-650 flex items-center gap-1.5">
                <Info className="h-4 w-4 text-slate-400" />
                Total Weight Sum:
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-mono font-black ${totalWeightSum === 100 ? "text-emerald-600" : "text-amber-600"}`}>
                  {totalWeightSum}%
                </span>
                {totalWeightSum === 100 ? (
                  <span className="bg-emerald-100 border border-emerald-200 text-emerald-800 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase">
                    ✓ Balanced
                  </span>
                ) : (
                  <span className="bg-rose-100 border border-rose-250 text-rose-800 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase">
                    ⚠ Imbalance
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Department Indicator Focus List */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ListTodo className="h-4 w-4 text-indigo-650" />
                <span>Department Indicator Focus Areas</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Select specific indicators for each department to be used in recognition scoring. Leave blank to use all indicators.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {Object.keys(deptIndicatorsMap).map((deptName) => {
                const list = deptIndicatorsMap[deptName] || [];
                const selectedCodes = selectedIndicatorsByDept[deptName] || [];
                
                return (
                  <div key={deptName} className="border border-slate-200 rounded-2xl p-4 bg-slate-50/20 flex flex-col h-[340px]">
                    <div className="flex items-start justify-between border-b border-slate-100 pb-3 mb-3">
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-black text-slate-800 truncate">{deptName}</h4>
                        <span className="text-[10px] font-bold text-slate-400">
                          {selectedCodes.length > 0 ? `${selectedCodes.length} of ${list.length}` : `All ${list.length} indicators`}
                        </span>
                      </div>
                      <Trophy className="h-4 w-4 text-amber-500 animate-bounce" />
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => handleSelectAllInDept(deptName)}
                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] rounded font-bold cursor-pointer"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => handleClearAllInDept(deptName)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] rounded font-bold cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1 space-y-2 border border-slate-100 bg-white rounded-lg p-2">
                      {list.length === 0 ? (
                        <p className="text-[10px] text-slate-400 italic text-center py-8">No indicators</p>
                      ) : (
                        list.map((ind) => {
                          const isChecked = selectedCodes.includes(ind.code);
                          return (
                            <label
                              key={ind.code}
                              className={`flex items-start gap-2.5 p-2 rounded-lg text-[10px] cursor-pointer border transition-all ${
                                isChecked
                                  ? "bg-indigo-50/40 border-indigo-250"
                                  : "bg-white border-slate-100 hover:bg-slate-55"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleIndicatorSelection(deptName, ind.code)}
                                className="mt-0.5 h-3.5 w-3.5"
                              />
                              <div className="space-y-0.5 flex-1">
                                <span className="font-extrabold text-indigo-700">{ind.code}</span>
                                <span className="text-slate-700 block">{ind.indicator.slice(0, 40)}</span>
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end border-t border-slate-100 pt-5">
              <button
                type="button"
                disabled={totalWeightSum !== 100}
                onClick={saveRecognitionSettings}
                className={`px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-md transition-all cursor-pointer ${
                  totalWeightSum === 100
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                }`}
              >
                <Save className="h-4 w-4" />
                <span>Save Recognition Configuration</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help Banner */}
      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-205 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-indigo-600 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-slate-650 leading-relaxed space-y-1">
          <p><strong>Real-Time Synchronization:</strong> All changes propagate instantly across the application. Indicator updates, weight adjustments, and focus areas sync automatically.</p>
          <p className="text-[11px] text-slate-405">Year: {selectedYear} | Evaluation Period: {evalSetupYear}</p>
        </div>
      </div>
    </div>
  );
}