import { useState, useEffect, useCallback } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { type MonthlyEntry, setIndicatorsFromDB } from "@/data/hospitalIndicators";
import { useAuth } from "@/hooks/useAuth";
import { useDatabase } from "@/hooks/useDatabase";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import MasterPlanTab from "@/components/MasterPlanTab";
import MonthlyDataTab from "@/components/MonthlyDataTab";
import DashboardTab from "@/components/DashboardTab";
import DHIS2ImportTab from "@/components/DHIS2ImportTab";
import FeedbackTab from "@/components/FeedbackTab";
import DistributionTab from "@/components/DistributionTab";
import BackupRecoveryTab from "@/components/BackupRecoveryTab";
import YearComparisonTab from "@/components/YearComparisonTab";
import ExportButton from "@/components/ExportButton";
import AboutUsTab from "@/components/AboutUsTab";
import WorkspaceTab from "@/components/WorkspaceTab";
import Aianalysistab from "@/components/Aianalysistab";
import { BackupManager } from "@/lib/backupUtils";
import { AuditLogger } from "@/lib/securityUtils";
import { mergeMonthlyData, convertMonthlyDataToEntries } from "@/lib/databaseSync";
import { mapToIndicators } from "../../hospitalDataSync";
import { useIndicators } from "@/context/IndicatorsContext";
import {
  AVAILABLE_EFY_YEARS,
  getCurrentEFY,
  getPreviousEFY,
  formatEFYDisplay,
  getEFYNumber,
} from "@/lib/ethiopianCalendar";
import { LogOut, User, Cloud, CloudOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const Index = () => {
  const { user, profile, role, signOut } = useAuth();
  const { fetchMonthlyData, fetchHospitalPerformanceData } = useDatabase();
  const { indicators } = useIndicators();
  const { isOnline, isSyncing, syncError, pendingSyncCount, manualSync, isDatabaseAvailable } = useOfflineSync();

  // ── EFY year state (replaces Gregorian selectedYear) ─────────────────────────
  const [selectedEFY, setSelectedEFY] = useState<string>(getCurrentEFY());
  const [compareEFY, setCompareEFY] = useState<string | null>(null);

  // Keep a numeric version for components that still need it
  const selectedYear = getEFYNumber(selectedEFY);
  const compareYear = compareEFY ? getEFYNumber(compareEFY) : null;

  const [yearlyData, setYearlyData] = useState<Record<string, MonthlyEntry[]>>({});
  const [hospitalPerformanceData, setHospitalPerformanceData] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isLoadingData, setIsLoadingData] = useState(true);

  const monthlyData = yearlyData[selectedEFY] || [];
  const compareData = compareEFY ? yearlyData[compareEFY] : undefined;

  // Available EFY years that have data loaded
  const availableEFYYears = AVAILABLE_EFY_YEARS;

  const setMonthlyData = useCallback(
    (updater: React.SetStateAction<MonthlyEntry[]>) => {
      setYearlyData((prev) => ({
        ...prev,
        [selectedEFY]:
          typeof updater === "function"
            ? updater(prev[selectedEFY] || [])
            : updater,
      }));
    },
    [selectedEFY]
  );

  // Load data for a specific EFY year
  const loadYearData = useCallback(
    async (efyYear: string) => {
      try {
        const perfData = await fetchHospitalPerformanceData({
          fiscal_year: efyYear,
        });

        const indicatorSource = mapToIndicators(perfData as any);

        // Convert performance data to MonthlyEntry format for this EFY year
        const entries: MonthlyEntry[] = perfData
          .filter((row) => row.metric_type === "Performance")
          .map((row) => {
            const code = row.indicator_name
              .toUpperCase()
              .replace(/[^A-Z0-9]+/g, "_")
              .replace(/^_+|_+$/g, "")
              .slice(0, 40);
            const match = indicatorSource.find((ind) => ind.code === code);
            return {
              code,
              month: "Annual",
              actual: row.metric_value ?? 0,
              remarks: row.remark ?? "",
              target: match?.target,
              baseline: match?.baseline,
            } as MonthlyEntry;
          });

        setYearlyData((prev) => ({
          ...prev,
          [efyYear]: entries,
        }));

        AuditLogger.logAction(
          user?.id || "system",
          "DATA_LOADED",
          "hospital_plan_and_performance",
          "success",
          {
            efyYear,
            recordCount: perfData.length,
            timestamp: new Date().toISOString(),
          }
        );
      } catch (error) {
        console.error(`Failed to load data for ${efyYear}:`, error);
        setYearlyData((prev) => ({ ...prev, [efyYear]: [] }));
        toast.error(`Failed to load data for ${efyYear}`);
      }
    },
    [fetchHospitalPerformanceData, indicators, user?.id]
  );

  // Load current and previous EFY on mount
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoadingData(true);
      try {
        const currentEFY = getCurrentEFY();
        const prevEFY = getPreviousEFY(currentEFY);
        await loadYearData(currentEFY);
        await loadYearData(prevEFY);

        // Load all hospital performance data (unfiltered) for indicators
        const performanceData = await fetchHospitalPerformanceData();
        setHospitalPerformanceData(performanceData);
      } finally {
        setIsLoadingData(false);
      }
    };
    loadInitialData();
  }, [loadYearData, fetchHospitalPerformanceData]);

  // Sync indicator targets when indicators change
  useEffect(() => {
    if (indicators.length === 0) return;
    setYearlyData((prev) => {
      const updated: Record<string, MonthlyEntry[]> = {};
      for (const [efy, entries] of Object.entries(prev)) {
        updated[efy] = entries.map((entry) => {
          const match = indicators.find((ind) => ind.code === entry.code);
          return match
            ? { ...entry, target: match.target, baseline: match.baseline }
            : entry;
        });
      }
      return updated;
    });
  }, [indicators]);

  const handleEFYChange = async (newEFY: string) => {
    setSelectedEFY(newEFY);
    if (!yearlyData[newEFY]) {
      await loadYearData(newEFY);
    }
  };

  // Auto-backup every 30 minutes
  useEffect(() => {
    const autoBackupInterval = setInterval(() => {
      try {
        if (monthlyData && monthlyData.length > 0) {
          const backupData = { monthlyData } as Record<string, unknown>;
          BackupManager.createBackup(
            backupData,
            "system",
            `Auto-backup at ${new Date().toLocaleString()}`
          );
        }
      } catch (error) {
        AuditLogger.logSecurityEvent("system", "AUTO_BACKUP_FAILED", String(error));
      }
    }, 30 * 60 * 1000);

    return () => clearInterval(autoBackupInterval);
  }, [monthlyData]);

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardTab />;
      case "workspace":
        return <WorkspaceTab monthlyData={monthlyData} />;
      case "masterplan":
        return (
          <MasterPlanTab
            monthlyData={monthlyData}
            selectedYear={selectedYear}
            previousYearData={
              yearlyData[getPreviousEFY(selectedEFY)] || []
            }
          />
        );
      case "monthly":
        return (
          <MonthlyDataTab
            monthlyData={monthlyData}
            setMonthlyData={setMonthlyData}
            selectedYear={selectedYear}
          />
        );
      case "import":
        return (
          <DHIS2ImportTab
            monthlyData={monthlyData}
            setMonthlyData={setMonthlyData}
          />
        );
      case "distribution":
        return <DistributionTab monthlyData={monthlyData} />;
      case "aianalysis":
        return (
          <Aianalysistab
            indicators={indicators}
            monthlyData={monthlyData}
          />
        );
      case "backup":
        return (
          <BackupRecoveryTab
            monthlyData={monthlyData}
            setMonthlyData={setMonthlyData}
          />
        );
      case "comparison":
        return (
          <div>
            <div className="mb-4">
              <label className="text-sm font-medium mr-2">Compare with:</label>
              <Select
                value={compareEFY ?? ""}
                onValueChange={(v) => setCompareEFY(v || null)}
              >
                <SelectTrigger className="w-[180px] inline-flex">
                  <SelectValue placeholder="Select EFY year" />
                </SelectTrigger>
                <SelectContent>
                  {availableEFYYears
                    .filter((y) => y !== selectedEFY)
                    .map((y) => (
                      <SelectItem key={y} value={y}>
                        {formatEFYDisplay(y)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <YearComparisonTab
              monthlyData={monthlyData}
              compareData={compareData}
              currentYear={selectedYear}
              compareYear={compareYear ?? undefined}
            />
          </div>
        );
      case "feedback":
        return <FeedbackTab monthlyData={monthlyData} />;
      case "about":
        return <AboutUsTab />;
      default:
        return null;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="bg-[#0f172a] text-white sticky top-0 z-40 border-b border-white/10 shadow-lg">
            <div className="px-4 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <SidebarTrigger className="text-white hover:bg-white/20 transition-colors rounded-lg" />
                <div className="hidden sm:flex items-center gap-3">
                  <div className="h-8 w-8 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-md">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                    </svg>
                  </div>
                  <h1 className="text-xl font-bold tracking-tight text-white">
                    Hospital M&E Platform
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* EFY Year Selector */}
                <Select value={selectedEFY} onValueChange={handleEFYChange}>
                  <SelectTrigger className="w-[160px] bg-white/10 border-white/20 text-white hover:bg-white/15 transition-colors rounded-lg backdrop-blur-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableEFYYears.map((y) => (
                      <SelectItem key={y} value={y}>
                        {formatEFYDisplay(y)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {(activeTab === "masterplan" ||
                  activeTab === "monthly" ||
                  activeTab === "workspace") && (
                  <ExportButton
                    monthlyData={monthlyData}
                    type={
                      activeTab === "masterplan" ? "masterplan" : "monthly"
                    }
                  />
                )}

                <div className="hidden sm:flex items-center gap-2 text-sm text-white backdrop-blur-md bg-white/10 px-3 py-2 rounded-lg border border-white/10">
                  <User className="h-4 w-4 text-white" />
                  <span className="font-medium text-white">
                    {profile?.display_name || user?.email}
                  </span>
                  <span className="text-xs text-white/70">
                    ({profile?.department})
                  </span>
                </div>

                {/* Sync Status */}
                <div className="flex items-center gap-2">
                  {isOnline ? (
                    <div className="hidden sm:flex items-center gap-2 text-sm text-white backdrop-blur-md bg-green-500/20 px-3 py-2 rounded-lg border border-green-500/30">
                      <Cloud className="h-4 w-4 text-green-400" />
                      <span className="text-xs text-white">Online</span>
                    </div>
                  ) : (
                    <div className="hidden sm:flex items-center gap-2 text-sm text-white backdrop-blur-md bg-yellow-500/20 px-3 py-2 rounded-lg border border-yellow-500/30">
                      <CloudOff className="h-4 w-4 text-yellow-400" />
                      <span className="text-xs text-white">Offline</span>
                    </div>
                  )}

                  {pendingSyncCount > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={manualSync}
                      disabled={isSyncing || !isOnline}
                      className="text-xs gap-1 text-white bg-blue-500/20 border-blue-500/30 hover:bg-blue-500/30 hover:text-white"
                    >
                      <RefreshCw
                        className={`h-3 w-3 text-white ${isSyncing ? "animate-spin" : ""}`}
                      />
                      Sync ({pendingSyncCount})
                    </Button>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={signOut}
                  className="text-white hover:bg-white/20 transition-colors gap-1 rounded-lg border border-white/20 backdrop-blur-md"
                >
                  <LogOut className="h-4 w-4 text-white" /> Sign Out
                </Button>
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 p-6 overflow-auto bg-gradient-to-br from-background to-background/80">
            {isLoadingData ? (
              <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                  <p className="text-sm text-muted-foreground">
                    Loading {selectedEFY} data…
                  </p>
                </div>
              </div>
            ) : (
              renderContent()
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Index;