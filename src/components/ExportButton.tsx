import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FileDown, FileSpreadsheet, FileText } from "lucide-react";
import { exportToCSV, exportToExcel, exportToPDF, getMasterPlanExportData, getMonthlyExportData } from "@/lib/exportUtils";
import { type MonthlyEntry } from "@/data/hospitalIndicators";

interface Props {
  monthlyData: MonthlyEntry[];
  type: "masterplan" | "monthly";
}

export default function ExportButton({ monthlyData, type }: Props) {
  const handleExport = (format: "csv" | "excel" | "pdf") => {
    if (type === "masterplan") {
      const data = getMasterPlanExportData(monthlyData);
      const filename = `Hospital_Master_Plan_${new Date().toISOString().split("T")[0]}`;

      if (format === "csv") {
        exportToCSV(data, filename);
      } else if (format === "excel") {
        const monthlyExport = getMonthlyExportData(monthlyData);
        exportToExcel(
          [
            { name: "Master Plan", data },
            { name: "Monthly Data", data: monthlyExport },
          ],
          filename
        );
      } else {
        const headers = ["Code", "Program Area", "Sub-program", "Indicator", "Unit", "Baseline", "Target", "Actual (YTD)", "% Achieved", "Status"];
        const rows = data.map((d) => [d.Code, d["Program Area"], d["Sub-program"], d.Indicator, d.Unit, d.Baseline, d.Target, d["Actual (YTD)"], d["% Achieved"], d.Status]);
        exportToPDF("Hospital Annual Plan – Master Plan Report", headers, rows, filename);
      }
    } else {
      const data = getMonthlyExportData(monthlyData);
      const filename = `Hospital_Monthly_Data_${new Date().toISOString().split("T")[0]}`;

      if (format === "csv") {
        exportToCSV(data, filename);
      } else if (format === "excel") {
        exportToExcel([{ name: "Monthly Data", data }], filename);
      } else {
        const headers = ["Code", "Month", "Actual", "Remarks"];
        const rows = data.map((d) => [d.Code, d.Month, d.Actual, d.Remarks]);
        exportToPDF("Hospital Monthly Data Report", headers, rows, filename, "portrait");
      }
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <FileDown className="h-4 w-4" /> Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("csv")} className="gap-2">
          <FileText className="h-4 w-4" /> Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("excel")} className="gap-2">
          <FileSpreadsheet className="h-4 w-4" /> Export as Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("pdf")} className="gap-2">
          <FileDown className="h-4 w-4" /> Export as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
