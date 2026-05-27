import React, { useState, useMemo } from 'react';
import { KPIDefinition, KPIRecord } from '../types';
import { calculateKPIScore, formatPeriod, getFiscalYear, getPeriodType } from '../data';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Save, 
  Calendar, 
  Plus, 
  HelpCircle, 
  Info, 
  CheckCircle2, 
  XCircle, 
  Download,
  RotateCcw,
  Search,
  Filter
} from 'lucide-react';

interface KPIRecordsPanelProps {
  kpis: KPIDefinition[];
  records: KPIRecord[];
  onUpdateActual: (month: string, kpiId: number, actualValue: number) => void;
  onAddMonth: (month: string) => void;
  onResetToDefaults: () => void;
}

export default function KPIRecordsPanel({ 
  kpis, 
  records, 
  onUpdateActual, 
  onAddMonth,
  onResetToDefaults
}: KPIRecordsPanelProps) {
  
  // States
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // States for period-type and fiscal-year filtering the selector itself
  const [fiscalYearFilter, setFiscalYearFilter] = useState<string>('All');
  const [periodTypeFilter, setPeriodTypeFilter] = useState<string>('All');

  // Find all unique periods in records
  const uniqueMonths = useMemo(() => {
    const list = Array.from(new Set(records.map(r => r.month)));
    return list.sort();
  }, [records]);

  // Dynamically extract all available fiscal years
  const availableFiscalYears = useMemo(() => {
    const years = Array.from(new Set(records.map(r => getFiscalYear(r.month))));
    return years.filter(y => y !== 'N/A').sort();
  }, [records]);

  // Filtered available periods list
  const filteredPeriods = useMemo(() => {
    return uniqueMonths.filter(p => {
      const matchType = periodTypeFilter === 'All' || getPeriodType(p) === periodTypeFilter;
      const matchYear = fiscalYearFilter === 'All' || getFiscalYear(p) === fiscalYearFilter;
      return matchType && matchYear;
    });
  }, [uniqueMonths, periodTypeFilter, fiscalYearFilter]);

  // Selected month state
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    if (uniqueMonths.length > 0) {
      return uniqueMonths[uniqueMonths.length - 1];
    }
    return new Date().toISOString().slice(0, 7); // YYYY-MM
  });

  // activePeriod ensures that if current selected month is out of filtered range, we fallback gracefully
  const activePeriod = useMemo(() => {
    if (filteredPeriods.includes(selectedMonth)) {
      return selectedMonth;
    }
    return filteredPeriods[0] || selectedMonth;
  }, [filteredPeriods, selectedMonth]);

  // State to manage new period custom builder
  const [isAddingMonth, setIsAddingMonth] = useState(false);
  const [addMonthError, setAddMonthError] = useState('');
  const [newPeriodType, setNewPeriodType] = useState<'Monthly' | 'Quarterly' | 'Annually'>('Monthly');
  const [newPeriodYear, setNewPeriodYear] = useState<number>(2026);
  const [newPeriodMonth, setNewPeriodMonth] = useState<string>('01');
  const [newPeriodQuarter, setNewPeriodQuarter] = useState<string>('Q1');

  // Handle adding a new reporting period
  const handleAddNewPeriod = () => {
    setAddMonthError('');
    let periodCode = '';

    if (newPeriodType === 'Monthly') {
      periodCode = `${newPeriodYear}-${newPeriodMonth}`;
    } else if (newPeriodType === 'Quarterly') {
      periodCode = `${newPeriodYear}-${newPeriodQuarter}`;
    } else {
      periodCode = `${newPeriodYear}-Year`;
    }

    if (uniqueMonths.includes(periodCode)) {
      setAddMonthError(`This period (${formatPeriod(periodCode)}) is already initialized!`);
      return;
    }

    onAddMonth(periodCode);
    setSelectedMonth(periodCode);
    setIsAddingMonth(false);
  };

  // Group KPIs into hospital sectors
  const getKPIGroup = (kpiName: string): string => {
    const name = kpiName.toLowerCase();
    if (
      name.includes("audit") || 
      name.includes("graduated") || 
      name.includes("ipc") || 
      name.includes("satisfaction") || 
      name.includes("haq") || 
      name.includes("ehsig") || 
      name.includes("completeness")
    ) {
      return "Clinical Quality & Safety";
    } else if (
      name.includes("laboratory") || 
      name.includes("imaging") || 
      name.includes("table efficiency") || 
      name.includes("occupancy") || 
      name.includes("oxygen") || 
      name.includes("stay")
    ) {
      return "Resources & Capacity";
    } else {
      return "Emergency & OPD";
    }
  };

  // Filter and search KPIs
  const filteredKPIs = useMemo(() => {
    return kpis.filter(kpi => {
      const category = getKPIGroup(kpi.name);
      const matchesCategory = filterCategory === 'All' || category === filterCategory;
      const matchesSearch = kpi.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [kpis, filterCategory, searchQuery]);

  // Map of currently selected period's records
  const currentMonthRecordsMap = useMemo(() => {
    const map = new Map<number, KPIRecord>();
    records.filter(r => r.month === activePeriod).forEach(r => {
      map.set(r.kpiId, r);
    });
    return map;
  }, [records, activePeriod]);

  // Handle immediate input change
  const handleInputChange = (kpiId: number, valueStr: string) => {
    const val = valueStr === '' ? 0 : parseFloat(valueStr);
    if (!isNaN(val)) {
      onUpdateActual(activePeriod, kpiId, val);
    }
  };

  // Export report as CSV directly from the client
  const handleExportCSV = () => {
    const monthRecords = records.filter(r => r.month === activePeriod);
    if (monthRecords.length === 0) {
      alert("No records to export for this period.");
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "KPI ID,KPI Name,Category,Target,Weight,Actual Measurement,Calculated Score (%),Performance Gap,Status\r\n";

    kpis.forEach(kpi => {
      const rec = currentMonthRecordsMap.get(kpi.id);
      const groupName = getKPIGroup(kpi.name);
      
      const actualVal = rec ? rec.actualValue : "N/A";
      const calcScore = rec ? `${rec.calculatedScore}%` : "N/A";
      const gap = rec ? rec.gap : "N/A";
      const status = rec ? rec.status : "Pending";

      csvContent += `"${kpi.id}","${kpi.name}","${groupName}","${kpi.target}","${kpi.weight}","${actualVal}","${calcScore}","${gap}","${status}"\r\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Hospital_KPI_Report_${activePeriod}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="kpi-records-panel" className="space-y-6">
      
      {/* Search, Filter & Month Controls panel */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-50 text-indigo-600 p-2.5 rounded-xl border border-indigo-100">
              <Calendar className="w-5 h-5 text-gold" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-display text-slate-800">Operational Performance Register</h2>
              <p className="text-xs text-slate-400">Input and update actual indicator metrics across flexible calendar limits.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filtering Controls for selecting periods */}
            <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-150">
              {/* Type Filter */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Type:</span>
                <select 
                  value={periodTypeFilter}
                  onChange={(e) => {
                    setPeriodTypeFilter(e.target.value);
                    setSelectedMonth(''); // reset selection to fallback properly
                  }}
                  className="bg-white border text-xs font-bold text-slate-700 px-2 py-1 rounded max-w-[110px]"
                >
                  <option value="All">All Intervals</option>
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
                    setSelectedMonth(''); // reset selection to fallback properly
                  }}
                  className="bg-white border text-xs font-bold text-slate-700 px-2 py-1 rounded max-w-[110px]"
                >
                  <option value="All">All Years</option>
                  {availableFiscalYears.map(fy => (
                    <option key={fy} value={fy}>{fy}</option>
                  ))}
                </select>
              </div>

              {/* Selected Month selector */}
              <div className="flex items-center bg-white border rounded p-1 gap-1">
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest px-1">Period:</span>
                <select 
                  value={activePeriod}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-slate-50 border-0 text-xs font-bold text-slate-800 px-2 py-1 rounded focus:ring-1 focus:ring-indigo-500 max-w-[160px]"
                >
                  {filteredPeriods.map(m => (
                    <option key={m} value={m}>{formatPeriod(m)}</option>
                  ))}
                  {filteredPeriods.length === 0 && (
                    <option value="">No Periods Found</option>
                  )}
                </select>
              </div>

              {/* Add New Month button */}
              <button 
                onClick={() => setIsAddingMonth(true)}
                className="p-1 px-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                title="Initialize New Period"
              >
                <Plus className="w-3.5 h-3.5" /> Initialize Period
              </button>
            </div>

            {/* Direct CSV Export */}
            <button 
              onClick={handleExportCSV}
              className="py-1.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>

            {/* Reset to defaults button */}
            <button 
              onClick={() => {
                if (window.confirm("Are you sure you want to reset all data and monthly values back to initial defaults? Any unsaved custom work will be replaced.")) {
                  onResetToDefaults();
                }
              }}
              className="py-1.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold text-xs rounded-xl flex items-center gap-1 transition-colors border border-rose-100 cursor-pointer"
              title="Reset Database to original parameters"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Default Database
            </button>
          </div>
        </div>

        {/* New Period creation inline widget */}
        <AnimatePresence>
          {isAddingMonth && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="p-4 bg-slate-100 border border-slate-200 rounded-2xl overflow-hidden shadow-inner space-y-3"
            >
              <div className="text-xs font-bold text-slate-600 uppercase tracking-widest border-b border-slate-200 pb-2 flex justify-between items-center">
                <span>Setup Reporting Cycle Interval</span>
                <span className="text-[10px] font-normal text-slate-400">Creates a new column/record grid template</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                {/* Period Type Selection */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">Reporting Interval</label>
                  <select
                    value={newPeriodType}
                    onChange={(e) => setNewPeriodType(e.target.value as any)}
                    className="w-full bg-white text-xs rounded-xl font-bold py-2 px-3 border border-slate-250 text-slate-700"
                  >
                    <option value="Monthly">Monthly Cycle</option>
                    <option value="Quarterly">Quarterly Cycle</option>
                    <option value="Annually">Annual (Fiscal Year)</option>
                  </select>
                </div>

                {/* Metric Specific Selection */}
                {newPeriodType === 'Monthly' && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">Select Month</label>
                    <select
                      value={newPeriodMonth}
                      onChange={(e) => setNewPeriodMonth(e.target.value)}
                      className="w-full bg-white text-xs rounded-xl font-bold py-2 px-3 border border-slate-250 text-slate-700"
                    >
                      {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(m => (
                        <option key={m} value={m}>{formatPeriod(`2026-${m}`).split(' ')[0]}</option>
                      ))}
                    </select>
                  </div>
                )}

                {newPeriodType === 'Quarterly' && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">Select Quarter</label>
                    <select
                      value={newPeriodQuarter}
                      onChange={(e) => setNewPeriodQuarter(e.target.value)}
                      className="w-full bg-white text-xs rounded-xl font-bold py-2 px-3 border border-slate-250 text-slate-700"
                    >
                      <option value="Q1">1st Quarter (Q1)</option>
                      <option value="Q2">2nd Quarter (Q2)</option>
                      <option value="Q3">3rd Quarter (Q3)</option>
                      <option value="Q4">4th Quarter (Q4)</option>
                    </select>
                  </div>
                )}

                {/* Fiscal Year Input */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">Fiscal Year (EFY / Gregorian)</label>
                  <input
                    type="number"
                    min="2020"
                    max="2035"
                    value={newPeriodYear}
                    onChange={(e) => setNewPeriodYear(parseInt(e.target.value) || 2026)}
                    className="w-full bg-white text-xs rounded-xl font-mono font-bold py-2 px-3 border border-slate-250 text-slate-700"
                  />
                </div>

                {/* Submission Actions */}
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleAddNewPeriod}
                    className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
                  >
                    Load & Initialize
                  </button>
                  <button 
                    onClick={() => setIsAddingMonth(false)}
                    className="py-2 px-3 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              {addMonthError && (
                <div className="text-xs text-rose-600 font-bold pt-1">{addMonthError}</div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filter Categories tabs & Search input */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-100">
          <div className="flex items-center flex-wrap gap-1 bg-slate-50 p-1 rounded-xl border border-slate-150">
            {['All', 'Clinical Quality & Safety', 'Resources & Capacity', 'Emergency & OPD'].map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  filterCategory === cat 
                    ? 'bg-white text-slate-800 shadow-sm font-bold' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search box */}
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Search indicators..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-50 border border-slate-150 text-xs rounded-xl pl-9 pr-4 py-2 w-full focus:bg-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Registers Grid List */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="hidden lg:grid lg:grid-cols-12 bg-slate-50 p-4 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-widest">
          <div className="col-span-5">KPI Indicator Name</div>
          <div className="col-span-1 text-center">Weight</div>
          <div className="col-span-2 text-center">Target</div>
          <div className="col-span-2 text-center">Actual Entry</div>
          <div className="col-span-2 text-right">Calculated Score</div>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredKPIs.map(kpi => {
            const rec = currentMonthRecordsMap.get(kpi.id);
            const isModified = !!rec;
            const category = getKPIGroup(kpi.name);
            
            // Calculate a temporary preview if not loaded
            const actualValue = rec ? rec.actualValue : 0;
            const scoring = rec ? rec : calculateKPIScore(kpi, 0);

            return (
              <div 
                key={kpi.id}
                className={`p-4 lg:grid lg:grid-cols-12 items-center gap-4 transition-colors ${
                  !isModified ? 'opacity-70 bg-slate-50/20' : 
                  scoring.status === 'GAP' ? 'bg-rose-50/10' : ''
                }`}
              >
                {/* Mobile description/Info block */}
                <div className="col-span-5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full font-mono">
                      #{kpi.id}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      category === "Clinical Quality & Safety" ? "bg-indigo-50 text-indigo-700" :
                      category === "Resources & Capacity" ? "bg-teal-50 text-teal-700" : "bg-amber-50 text-amber-700"
                    }`}>
                      {category}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-800" title={kpi.name}>
                    {kpi.name}
                  </h4>
                </div>

                {/* KPI Weight */}
                <div className="col-span-1 text-center mt-2 lg:mt-0">
                  <div className="lg:hidden text-xs text-slate-400 font-semibold mb-1">Weight</div>
                  <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg font-mono">
                    w{kpi.weight}
                  </span>
                </div>

                {/* Target Description */}
                <div className="col-span-2 text-center mt-2 lg:mt-0">
                  <div className="lg:hidden text-xs text-slate-400 font-semibold mb-1">Target</div>
                  <div className="inline-flex flex-col items-center">
                    <span className="text-xs font-bold text-slate-800 font-mono">
                      {kpi.target} {kpi.measure ? `(${kpi.measure})` : '%'}
                    </span>
                    {kpi.type === 'cat' && (
                      <span className="text-[9px] text-slate-400 font-medium">Categorical Rules</span>
                    )}
                  </div>
                </div>

                {/* Actual value Input */}
                <div className="col-span-2 mt-3 lg:mt-0">
                  <div className="lg:hidden text-xs text-slate-400 font-semibold mb-1">Actual Measurement</div>
                  <div className="flex items-center justify-center gap-1.5">
                    <input 
                      type="number" 
                      step="any"
                      placeholder="Enter value"
                      value={isModified ? rec.actualValue : ""}
                      onChange={(e) => handleInputChange(kpi.id, e.target.value)}
                      className={`text-center font-mono font-bold text-sm rounded-xl px-2 py-1.5 w-28 border ${
                        scoring.status === 'GAP' 
                          ? 'border-rose-300 focus:border-rose-500 bg-rose-50/30' 
                          : 'border-slate-200 focus:border-indigo-500 bg-white'
                      }`}
                    />
                    
                    {/* Measurement unit info */}
                    <span className="text-[10px] text-slate-400 font-medium lowercase shrink-0">
                      {kpi.measure || '%'}
                    </span>
                  </div>
                </div>

                {/* Calculated Score */}
                <div className="col-span-2 mt-3 lg:mt-0 text-right">
                  <div className="lg:hidden text-xs text-slate-400 font-semibold mb-1">Calculated Score</div>
                  
                  {isModified ? (
                    <div className="inline-flex flex-col items-end">
                      <div className="flex items-center gap-1.5">
                        {scoring.status === 'GAP' ? (
                          <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        )}
                        <span className={`font-mono font-bold text-sm ${scoring.status === 'GAP' ? 'text-rose-600' : 'text-emerald-700'}`}>
                          {scoring.calculatedScore}%
                        </span>
                      </div>
                      <span className="text-[10px] font-medium text-slate-400 font-mono">
                        {scoring.status === 'GAP' ? `GAP: ${scoring.gap}` : 'Cleared'}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-300 italic">No entry loaded</span>
                  )}
                </div>

              </div>
            );
          })}

          {filteredKPIs.length === 0 && (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <Info className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-600">No Indicators Found</p>
              <p className="text-xs">Try adjusting your filters or search queries.</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
