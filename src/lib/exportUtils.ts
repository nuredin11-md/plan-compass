import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { indicators, getActualYTD, getStatus, getProgramAreas, MONTHS, type MonthlyEntry, type Indicator } from "@/data/hospitalIndicators";

// Extend jsPDF type for autotable
declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: Record<string, unknown>) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

// ─── CSV Export ───
export function exportToCSV(rows: Record<string, string | number>[], filename: string) {
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((h) => {
        const val = String(row[h] ?? "");
        return val.includes(",") || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
      }).join(",")
    ),
  ].join("\n");

  downloadBlob(csvContent, `${filename}.csv`, "text/csv;charset=utf-8;");
}

// ─── Excel Export ───
export function exportToExcel(sheets: { name: string; data: Record<string, string | number>[] }[], filename: string) {
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, data }) => {
    const ws = XLSX.utils.json_to_sheet(data);
    // Auto-size columns
    const colWidths = Object.keys(data[0] || {}).map((key) => ({
      wch: Math.max(key.length, ...data.map((r) => String(r[key] ?? "").length)).valueOf(),
    }));
    ws["!cols"] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws, name.substring(0, 31));
  });
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ─── PDF Export ───
export function exportToPDF(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string,
  orientation: "portrait" | "landscape" = "landscape"
) {
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });

  // Header
  doc.setFillColor(14, 136, 168); // primary color
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 13);

  doc.setTextColor(0, 0, 0);

  doc.autoTable({
    head: [headers],
    body: rows,
    startY: 28,
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [14, 136, 168], textColor: 255, fontStyle: "bold", fontSize: 7 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    didParseCell: (data: Record<string, unknown>) => {
      const cell = data.cell as { text: string[]; styles: Record<string, unknown> };
      const column = data.column as { index: number };
      // Color the status column
      if (column.index === headers.length - 1) {
        const text = cell.text[0];
        if (text === "On Track") {
          cell.styles.textColor = [34, 139, 84];
          cell.styles.fontStyle = "bold";
        } else if (text === "At Risk") {
          cell.styles.textColor = [204, 128, 0];
          cell.styles.fontStyle = "bold";
        } else if (text === "Off Track") {
          cell.styles.textColor = [220, 38, 38];
          cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(128);
    doc.text(
      `Generated: ${new Date().toLocaleDateString()} | Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" }
    );
  }

  doc.save(`${filename}.pdf`);
}

// ─── Master Plan Export helpers ───
export function getMasterPlanExportData(monthlyData: MonthlyEntry[]) {
  return indicators.map((ind) => {
    const actual = getActualYTD(ind.code, monthlyData);
    const percent = ind.target === 0 ? 0 : Math.round((actual / ind.target) * 100);
    const status = getStatus(percent);
    return {
      Code: ind.code,
      "Program Area": ind.programArea,
      "Sub-program": ind.subProgram,
      Indicator: ind.indicator,
      Unit: ind.unit,
      Baseline: ind.baseline,
      Target: ind.target,
      "Actual (YTD)": actual,
      "% Achieved": percent,
      Status: status === "green" ? "On Track" : status === "yellow" ? "At Risk" : "Off Track",
    };
  });
}

export function getMonthlyExportData(monthlyData: MonthlyEntry[]) {
  return monthlyData
    .filter((e) => e.actual !== null)
    .map((e) => ({
      Code: e.code,
      Month: e.month,
      Actual: e.actual ?? 0,
      Remarks: e.remarks,
    }));
}

export function getDepartmentFeedbackData(monthlyData: MonthlyEntry[]) {
  return getProgramAreas().map((area) => {
    const areaInds = indicators.filter((i) => i.programArea === area);
    let totalPercent = 0;
    const details = areaInds.map((ind) => {
      const actual = getActualYTD(ind.code, monthlyData);
      const percent = ind.target === 0 ? 0 : Math.round((actual / ind.target) * 100);
      totalPercent += percent;
      return { ...ind, actual, percent, status: getStatus(percent) };
    });
    const avgPercent = areaInds.length > 0 ? Math.round(totalPercent / areaInds.length) : 0;
    return { area, avgPercent, details, status: getStatus(avgPercent) };
  });
}

// ─── Utility ───
function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
