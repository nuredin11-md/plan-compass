import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateSampleMonthlyData, type MonthlyEntry } from "@/data/hospitalIndicators";
import MasterPlanTab from "@/components/MasterPlanTab";
import MonthlyDataTab from "@/components/MonthlyDataTab";
import DashboardTab from "@/components/DashboardTab";
import { Activity, ClipboardList, CalendarDays, BarChart3 } from "lucide-react";

const Index = () => {
  const [monthlyData, setMonthlyData] = useState<MonthlyEntry[]>(() => generateSampleMonthlyData());

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="header-gradient text-primary-foreground">
        <div className="container py-6">
          <div className="flex items-center gap-3">
            <Activity className="h-8 w-8" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Hospital Annual Plan Tracker</h1>
              <p className="text-sm opacity-80">Monitor indicators, track progress, and achieve annual targets</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container py-6">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="dashboard" className="flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="masterplan" className="flex items-center gap-1.5">
              <ClipboardList className="h-4 w-4" />
              Master Plan
            </TabsTrigger>
            <TabsTrigger value="monthly" className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              Monthly Entry
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <DashboardTab monthlyData={monthlyData} />
          </TabsContent>
          <TabsContent value="masterplan">
            <MasterPlanTab monthlyData={monthlyData} />
          </TabsContent>
          <TabsContent value="monthly">
            <MonthlyDataTab monthlyData={monthlyData} setMonthlyData={setMonthlyData} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
