import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { 
  BarChart3, 
  ClipboardCheck, 
  FolderLock, 
  ArrowLeft,
  Activity,
  Award
} from "lucide-react";
import { 
  INITIAL_KPIS, 
  INITIAL_RECORDS, 
  INITIAL_ACTION_PLANS, 
  calculateKPIScore 
} from "../../data";
import { KPIDefinition, KPIRecord, ActionPlan } from "../../types";

import DashboardPanel from "../DashboardPanel";
import KPIRecordsPanel from "../KPIRecordsPanel";
import ActionPlansPanel from "../ActionPlansPanel";

export default function HospitalKPITracker() {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [selectedKpiId, setSelectedKpiId] = useState<number | null>(null);

  // States with LocalStorage Persistence
  const [kpis] = useState<KPIDefinition[]>(INITIAL_KPIS);
  const [records, setRecords] = useState<KPIRecord[]>(() => {
    const saved = localStorage.getItem("hospital_kpi_records");
    return saved ? JSON.parse(saved) : INITIAL_RECORDS;
  });
  const [actionPlans, setActionPlans] = useState<ActionPlan[]>(() => {
    const saved = localStorage.getItem("hospital_action_plans");
    return saved ? JSON.parse(saved) : INITIAL_ACTION_PLANS;
  });

  // Track state changes to sync with local storage
  useEffect(() => {
    localStorage.setItem("hospital_kpi_records", JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    localStorage.setItem("hospital_action_plans", JSON.stringify(actionPlans));
  }, [actionPlans]);

  // Handlers
  const handleNavigate = (tab: string, kpiId?: number) => {
    setActiveTab(tab);
    if (kpiId !== undefined) {
      setSelectedKpiId(kpiId);
    } else {
      setSelectedKpiId(null);
    }
  };

  const handleUpdateActual = (month: string, kpiId: number, actualValue: number) => {
    const kpi = kpis.find(k => k.id === kpiId);
    if (!kpi) return;

    const { score, gap, status } = calculateKPIScore(kpi, actualValue);

    setRecords(prev => {
      const existsIdx = prev.findIndex(r => r.month === month && r.kpiId === kpiId);
      if (existsIdx > -1) {
        const updated = [...prev];
        updated[existsIdx] = {
          ...updated[existsIdx],
          actualValue,
          calculatedScore: score,
          gap,
          status
        };
        return updated;
      } else {
        const newRecord: KPIRecord = {
          id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          kpiId,
          month,
          actualValue,
          calculatedScore: score,
          gap,
          status
        };
        return [...prev, newRecord];
      }
    });
  };

  const handleAddMonth = (month: string) => {
    setRecords(prev => {
      // Check if any records already exist for this month
      const exists = prev.some(r => r.month === month);
      if (exists) return prev;

      // Populate default empty records (actualValue = target value or 0 depending on KPI design)
      const newRecords: KPIRecord[] = kpis.map(kpi => {
        const actual = 0; // standard default
        const { score, gap, status } = calculateKPIScore(kpi, actual);
        return {
          id: `rec_${Date.now()}_${kpi.id}`,
          kpiId: kpi.id,
          month,
          actualValue: actual,
          calculatedScore: score,
          gap,
          status
        };
      });

      return [...prev, ...newRecords];
    });
  };

  const handleResetToDefaults = () => {
    if (window.confirm("Are you sure you want to reset all data back to the default hospital figures? This deletes your changes.")) {
      setRecords(INITIAL_RECORDS);
      setActionPlans(INITIAL_ACTION_PLANS);
      localStorage.removeItem("hospital_kpi_records");
      localStorage.removeItem("hospital_action_plans");
    }
  };

  const handleSaveActionPlan = (plan: ActionPlan) => {
    setActionPlans(prev => {
      const existsIdx = prev.findIndex(p => p.id === plan.id || (p.kpiId === plan.kpiId && p.month === plan.month));
      if (existsIdx > -1) {
        const updated = [...prev];
        updated[existsIdx] = plan;
        return updated;
      } else {
        return [...prev, plan];
      }
    });
  };

  const handleDeleteActionPlan = (id: string) => {
    setActionPlans(prev => prev.filter(p => p.id !== id));
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Tracker Menu Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-[#2aa13c] px-6 py-4 shadow-xs">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="text-slate-800 hover:bg-slate-100 transition-colors rounded-lg mr-1" />
            <div className="bg-emerald-500 text-white p-2 rounded-lg">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Hospital KPI & Quality Tracker</h1>
              <p className="text-xs text-muted-foreground">National Clinical Performance M&E Tool for Chefa Robit Hospital</p>
            </div>
          </div>

          {/* Sub Navigation */}
          <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => handleNavigate("dashboard")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "dashboard"
                  ? "bg-white text-emerald-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Dashboard
            </button>
            <button
              onClick={() => handleNavigate("records")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "records"
                  ? "bg-white text-emerald-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              KPI Records
            </button>
            <button
              onClick={() => handleNavigate("actions")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "actions"
                  ? "bg-white text-emerald-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Award className="h-3.5 w-3.5" />
              Action Plans
            </button>
          </nav>
        </div>
      </header>

      {/* Primary Panels Render */}
      <main className="flex-1 p-4 md:p-6 overflow-y-auto overflow-x-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="w-full"
          >
            {activeTab === "dashboard" && (
              <DashboardPanel
                kpis={kpis}
                records={records}
                actionPlans={actionPlans}
                onNavigate={handleNavigate}
              />
            )}

            {activeTab === "records" && (
              <KPIRecordsPanel
                kpis={kpis}
                records={records}
                onUpdateActual={handleUpdateActual}
                onAddMonth={handleAddMonth}
                onResetToDefaults={handleResetToDefaults}
              />
            )}

            {activeTab === "actions" && (
              <ActionPlansPanel
                kpis={kpis}
                records={records}
                actionPlans={actionPlans}
                initialSelectedKpiId={selectedKpiId}
                onSaveActionPlan={handleSaveActionPlan}
                onDeleteActionPlan={handleDeleteActionPlan}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
