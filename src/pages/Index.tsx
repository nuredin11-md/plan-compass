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
import { BackupManager } from "@/lib/backupUtils";
import { AuditLogger } from "@/lib/securityUtils";
import { mergeMonthlyData, convertMonthlyDataToEntries } from "@/lib/databaseSync";
import { mapToIndicators } from "../../hospitalDataSync";
import { useIndicators } from "@/context/IndicatorsContext";
import { LogOut, User, Cloud, CloudOff, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const Index = () => {
  const { user, profile, role, signOut } = useAuth();
  const { fetchMonthlyData, fetchHospitalPerformanceData } = useDatabase();
  const { indicators } = useIndicators();
  const { isOnline, isSyncing, syncError, pendingSyncCount, manualSync, isDatabaseAvailable } = useOfflineSync();
  const currentCalendarYear = new Date().getFullYear();

  const [selectedYear, setSelectedYear] = useState(currentCalendarYear);
  const [compareYear, setCompareYear] = useState<number | null>(null);
  const [yearlyData, setYearlyData] = useState<Record<number, MonthlyEntry[]>>({});
  const [hospitalPerformanceData, setHospitalPerformanceData] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isLoadingData, setIsLoadingData] = useState(true);

  const monthlyData = yearlyData[selectedYear] || [];
  const compareData = compareYear ? yearlyData[compareYear] : undefined;

  const setMonthlyData = useCallback((updater: React.SetStateAction<MonthlyEntry[]>) => {
    setYearlyData((prev) => ({
      ...prev,
      [selectedYear]: typeof updater === "function" ? updater(prev[selectedYear] || []) : updater,
    }));
  }, [selectedYear]);

  const availableYears = Object.keys(yearlyData).map(Number).sort((a, b) => b - a);

  // Load data from database for a specific year
  const loadYearData = useCallback(
    async (year: number) => {
      try {
        // Use the current indicator catalog from context; fall back to plan rows for mapping only.
        const indicatorSource = indicators.length
          ? (indicators as any)
          : mapToIndicators(await fetchHospitalPerformanceData());

        // Fetch monthly_entries and convert to app MonthlyEntry[]
        const dbData = await fetchMonthlyData(year);
        const converted = convertMonthlyDataToEntries(dbData, indicatorSource);

        setYearlyData((prev) => ({
          ...prev,
          [year]: converted,
        }));

        AuditLogger.logAction(
          user?.id || "system",
          "DATA_LOADED",
          "monthly_data",
          "success",
          {
            year,
            recordCount: dbData.length,
            timestamp: new Date().toISOString(),
          }
        );
      } catch (error) {
        console.error(`Failed to load data for year ${year}:`, error);
        // Fall back to empty dataset if database load fails
        setYearlyData((prev) => ({
          ...prev,
          [year]: [],
        }));
        toast.error(`Failed to load data for ${year}`);
      }
    },
    [fetchMonthlyData, fetchHospitalPerformanceData, indicators, user?.id]
  );

  // Load current year and previous year on mount
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoadingData(true);
      try {
        await loadYearData(currentCalendarYear);
        await loadYearData(currentCalendarYear - 1);
          // Load hospital performance data
          const performanceData = await fetchHospitalPerformanceData();
          setHospitalPerformanceData(performanceData);
      } finally {
        setIsLoadingData(false);
      }
    };
    loadInitialData();
    }, [currentCalendarYear, loadYearData, fetchHospitalPerformanceData]);

  useEffect(() => {
    if (indicators.length === 0) return;

    setYearlyData((prev) => {
      const updated: Record<number, MonthlyEntry[]> = {};

      for (const [year, entries] of Object.entries(prev)) {
        updated[Number(year)] = entries.map((entry) => {
          const match = indicators.find((ind) => ind.code === entry.code);
          return match
            ? { ...entry, target: match.target, baseline: match.baseline }
            : entry;
        });
      }

      return updated;
    });
  }, [indicators]);

  const handleYearChange = async (newYear: number) => {
    setSelectedYear(newYear);
    
    // Load data for the new year if not already loaded
    if (!yearlyData[newYear]) {
      await loadYearData(newYear);
    }
  };
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
          AuditLogger.logAction(
            "system",
            "AUTO_BACKUP_CREATED",
            "backup_management",
            "success",
            {
              dataCount: monthlyData.length,
              timestamp: new Date().toISOString(),
            }
          );
        }
      } catch (error) {
        AuditLogger.logSecurityEvent("system", "AUTO_BACKUP_FAILED", String(error) || "unknown_error");
      }
    }, 30 * 60 * 1000); // 30 minutes

    // Create initial backup on mount
    if (monthlyData && monthlyData.length > 0) {
      try {
        const backupData = { monthlyData } as Record<string, unknown>;
        BackupManager.createBackup(backupData, "system", "Initial backup on app startup");
        AuditLogger.logAction(
          "system",
          "INITIAL_BACKUP_CREATED",
          "backup_management",
          "success",
          {
            dataCount: monthlyData.length,
          }
        );
      } catch (error) {
        AuditLogger.logSecurityEvent("system", "INITIAL_BACKUP_FAILED", String(error) || "unknown_error");
      }
    }

    // Cleanup: clear interval on unmount
    return () => clearInterval(autoBackupInterval);
  }, [monthlyData]);

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardTab monthlyData={monthlyData} />;
      case "workspace":
        return (
          <WorkspaceTab
            monthlyData={monthlyData}
            compareData={compareData}
            currentYear={selectedYear}
            compareYear={compareYear ?? undefined}
            onCompareYearChange={(year) => setCompareYear(year)}
            availableYears={availableYears}
          />
        );
      case "masterplan":
        return <MasterPlanTab monthlyData={monthlyData} selectedYear={selectedYear} previousYearData={yearlyData[selectedYear - 1] || []} />;
      case "monthly":
        return <MonthlyDataTab monthlyData={monthlyData} setMonthlyData={setMonthlyData} selectedYear={selectedYear} />;
      case "import":
        return <DHIS2ImportTab monthlyData={monthlyData} setMonthlyData={setMonthlyData} />;
      case "distribution":
        return <DistributionTab monthlyData={monthlyData} />;
      case "backup":
        return <BackupRecoveryTab monthlyData={monthlyData} setMonthlyData={setMonthlyData} />;
      case "comparison":
        return (
          <div>
            <div className="mb-4">
              <label className="text-sm font-medium mr-2">Compare with:</label>
              <Select value={compareYear ? String(compareYear) : ""} onValueChange={(v) => setCompareYear(v ? Number(v) : null)}>
                <SelectTrigger className="w-[150px] inline-flex">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.filter((y) => y !== selectedYear).map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
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
      case "performance":
        return null;
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
                  <h1 className="text-xl font-bold tracking-tight text-white">Hospital M&E Platform</h1>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Select value={String(selectedYear)} onValueChange={(v) => handleYearChange(Number(v))}>
                  <SelectTrigger className="w-[140px] bg-white/10 border-white/20 text-white hover:bg-white/15 transition-colors rounded-lg backdrop-blur-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                    <SelectItem value={String(currentCalendarYear + 1)}>
                      + {currentCalendarYear + 1}
                    </SelectItem>
                  </SelectContent>
                </Select>

                {(activeTab === "masterplan" || activeTab === "monthly" || activeTab === "workspace") && (
                  <ExportButton monthlyData={monthlyData} type={activeTab === "masterplan" ? "masterplan" : "monthly"} />
                )}

              <div className="hidden sm:flex items-center gap-2 text-sm text-white backdrop-blur-md bg-white/10 px-3 py-2 rounded-lg border border-white/10">
                  <User className="h-4 w-4 text-white" />
                  <span className="font-medium text-white">{profile?.display_name || user?.email}</span>
                  <span className="text-xs text-white/70">({profile?.department})</span>
                </div>

                {/* Sync Status Indicator */}
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
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={manualSync}
                        disabled={isSyncing || !isOnline}
                        className="text-xs gap-1 text-white bg-blue-500/20 border-blue-500/30 hover:bg-blue-500/30 hover:text-white"
                      >
                        <RefreshCw className={`h-3 w-3 text-white ${isSyncing ? 'animate-spin' : ''}`} />
                        Sync ({pendingSyncCount})
                      </Button>
                    </div>
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
            {renderContent()}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Index;
