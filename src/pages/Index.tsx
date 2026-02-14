import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { generateSampleMonthlyData, type MonthlyEntry } from "@/data/hospitalIndicators";
import { useAuth } from "@/hooks/useAuth";
import MasterPlanTab from "@/components/MasterPlanTab";
import MonthlyDataTab from "@/components/MonthlyDataTab";
import DashboardTab from "@/components/DashboardTab";
import DHIS2ImportTab from "@/components/DHIS2ImportTab";
import FeedbackTab from "@/components/FeedbackTab";
import AnalysisTab from "@/components/AnalysisTab";
import YearComparisonTab from "@/components/YearComparisonTab";
import ExportButton from "@/components/ExportButton";
import { Activity, ClipboardList, CalendarDays, BarChart3, Upload, MessageSquareText, TrendingUp, GitCompareArrows, LogOut, User } from "lucide-react";

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
      setYearlyData((prev) => ({
        ...prev,
        [year]: generateSampleMonthlyData(),
      }));
    }
  };

  // Ensure at least prior year exists for comparison
  useEffect(() => {
    if (!yearlyData[currentCalendarYear - 1]) {
      addYear(currentCalendarYear - 1);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="header-gradient text-primary-foreground">
        <div className="container py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="h-8 w-8" />
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Hospital M&E Platform</h1>
                <p className="text-sm opacity-80">Monitor, Evaluate & Track Annual Performance Indicators</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Year selector */}
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

              {/* User info */}
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
        </div>
      </header>

      {/* Main content */}
      <main className="container py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-1 w-full justify-start bg-muted/50 p-1">
            <TabsTrigger value="dashboard" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <BarChart3 className="h-4 w-4" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="masterplan" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <ClipboardList className="h-4 w-4" /> Master Plan
            </TabsTrigger>
            <TabsTrigger value="monthly" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <CalendarDays className="h-4 w-4" /> Monthly Entry
            </TabsTrigger>
            <TabsTrigger value="import" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Upload className="h-4 w-4" /> DHIS2 Import
            </TabsTrigger>
            <TabsTrigger value="analysis" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <TrendingUp className="h-4 w-4" /> Analysis
            </TabsTrigger>
            <TabsTrigger value="comparison" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <GitCompareArrows className="h-4 w-4" /> YoY Compare
            </TabsTrigger>
            <TabsTrigger value="feedback" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <MessageSquareText className="h-4 w-4" /> Dept. Feedback
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard"><DashboardTab monthlyData={monthlyData} /></TabsContent>
          <TabsContent value="masterplan"><MasterPlanTab monthlyData={monthlyData} /></TabsContent>
          <TabsContent value="monthly"><MonthlyDataTab monthlyData={monthlyData} setMonthlyData={setMonthlyData} /></TabsContent>
          <TabsContent value="import"><DHIS2ImportTab monthlyData={monthlyData} setMonthlyData={setMonthlyData} /></TabsContent>
          <TabsContent value="analysis"><AnalysisTab monthlyData={monthlyData} /></TabsContent>
          <TabsContent value="comparison">
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
          </TabsContent>
          <TabsContent value="feedback"><FeedbackTab monthlyData={monthlyData} /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
