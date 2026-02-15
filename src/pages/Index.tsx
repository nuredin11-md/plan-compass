import { useState, useEffect, useCallback } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { generateSampleMonthlyData, type MonthlyEntry } from "@/data/hospitalIndicators";
import { useAuth } from "@/hooks/useAuth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import MasterPlanTab from "@/components/MasterPlanTab";
import MonthlyDataTab from "@/components/MonthlyDataTab";
import DashboardTab from "@/components/DashboardTab";
import DHIS2ImportTab from "@/components/DHIS2ImportTab";
import FeedbackTab from "@/components/FeedbackTab";
import AnalysisTab from "@/components/AnalysisTab";
import YearComparisonTab from "@/components/YearComparisonTab";
import ExportButton from "@/components/ExportButton";
import { LogOut, User } from "lucide-react";

const Index = () => {
  const { user, profile, role, signOut } = useAuth();
  const currentCalendarYear = new Date().getFullYear();

  const [selectedYear, setSelectedYear] = useState(currentCalendarYear);
  const [compareYear, setCompareYear] = useState<number | null>(null);
  const [yearlyData, setYearlyData] = useState<Record<number, MonthlyEntry[]>>(() => ({
    [currentCalendarYear]: generateSampleMonthlyData(),
  }));
  const [activeTab, setActiveTab] = useState("dashboard");

  const monthlyData = yearlyData[selectedYear] || [];
  const compareData = compareYear ? yearlyData[compareYear] : undefined;

  const setMonthlyData = useCallback((updater: React.SetStateAction<MonthlyEntry[]>) => {
    setYearlyData((prev) => ({
      ...prev,
      [selectedYear]: typeof updater === "function" ? updater(prev[selectedYear] || []) : updater,
    }));
  }, [selectedYear]);

  const availableYears = Object.keys(yearlyData).map(Number).sort((a, b) => b - a);

  const addYear = (year: number) => {
    if (!yearlyData[year]) {
      setYearlyData((prev) => ({ ...prev, [year]: generateSampleMonthlyData() }));
    }
  };

  useEffect(() => {
    if (!yearlyData[currentCalendarYear - 1]) {
      addYear(currentCalendarYear - 1);
    }
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardTab monthlyData={monthlyData} />;
      case "masterplan":
        return <MasterPlanTab monthlyData={monthlyData} selectedYear={selectedYear} />;
      case "monthly":
        return <MonthlyDataTab monthlyData={monthlyData} setMonthlyData={setMonthlyData} />;
      case "import":
        return <DHIS2ImportTab monthlyData={monthlyData} setMonthlyData={setMonthlyData} />;
      case "analysis":
        return <AnalysisTab monthlyData={monthlyData} />;
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
      case "feedback":
        return <FeedbackTab monthlyData={monthlyData} />;
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
          <header className="header-gradient text-primary-foreground">
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="text-primary-foreground hover:bg-primary-foreground/10" />
                <h1 className="text-lg font-bold tracking-tight hidden sm:block">Hospital M&E Platform</h1>
              </div>
              <div className="flex items-center gap-3">
                <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                  <SelectTrigger className="w-[120px] bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground">
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

                {(activeTab === "masterplan" || activeTab === "monthly") && (
                  <ExportButton monthlyData={monthlyData} type={activeTab === "masterplan" ? "masterplan" : "monthly"} />
                )}

                <div className="hidden sm:flex items-center gap-2 text-sm opacity-90">
                  <User className="h-4 w-4" />
                  <span>{profile?.display_name || user?.email}</span>
                  <span className="text-xs opacity-70">({profile?.department})</span>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={signOut}
                  className="text-primary-foreground hover:bg-primary-foreground/10 gap-1"
                >
                  <LogOut className="h-4 w-4" /> Sign Out
                </Button>
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 p-6 overflow-auto">
            {renderContent()}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Index;
