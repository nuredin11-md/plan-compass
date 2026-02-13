import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateSampleMonthlyData, type MonthlyEntry } from "@/data/hospitalIndicators";
import MasterPlanTab from "@/components/MasterPlanTab";
import MonthlyDataTab from "@/components/MonthlyDataTab";
import DashboardTab from "@/components/DashboardTab";
import DHIS2ImportTab from "@/components/DHIS2ImportTab";
import FeedbackTab from "@/components/FeedbackTab";
import AnalysisTab from "@/components/AnalysisTab";
import ExportButton from "@/components/ExportButton";
import { Activity, ClipboardList, CalendarDays, BarChart3, Upload, MessageSquareText, TrendingUp } from "lucide-react";

const Index = () => {
  const [monthlyData, setMonthlyData] = useState<MonthlyEntry[]>(() => generateSampleMonthlyData());
  const [activeTab, setActiveTab] = useState("dashboard");

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
            <div className="flex items-center gap-2">
              {(activeTab === "masterplan" || activeTab === "monthly") && (
                <ExportButton monthlyData={monthlyData} type={activeTab === "masterplan" ? "masterplan" : "monthly"} />
              )}
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
            <TabsTrigger value="feedback" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <MessageSquareText className="h-4 w-4" /> Dept. Feedback
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard"><DashboardTab monthlyData={monthlyData} /></TabsContent>
          <TabsContent value="masterplan"><MasterPlanTab monthlyData={monthlyData} /></TabsContent>
          <TabsContent value="monthly"><MonthlyDataTab monthlyData={monthlyData} setMonthlyData={setMonthlyData} /></TabsContent>
          <TabsContent value="import"><DHIS2ImportTab monthlyData={monthlyData} setMonthlyData={setMonthlyData} /></TabsContent>
          <TabsContent value="analysis"><AnalysisTab monthlyData={monthlyData} /></TabsContent>
          <TabsContent value="feedback"><FeedbackTab monthlyData={monthlyData} /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
