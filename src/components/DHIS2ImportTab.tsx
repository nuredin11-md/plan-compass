import { useState, useCallback, useMemo } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { indicators, MONTHS, type MonthlyEntry } from "@/data/hospitalIndicators";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, FileText, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { InputValidator, AuditLogger, DataValidator } from "@/lib/securityUtils";

interface Props {
  monthlyData: MonthlyEntry[];
  setMonthlyData: React.Dispatch<React.SetStateAction<MonthlyEntry[]>>;
}

interface ParsedRow {
  code?: string;
  indicator?: string;
  month?: string;
  actual?: number;
  remarks?: string;
  [key: string]: unknown;
}

export default function DHIS2ImportTab({ monthlyData, setMonthlyData }: Props) {
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [mappedMonth, setMappedMonth] = useState("");
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [step, setStep] = useState<"upload" | "map" | "preview" | "done">("upload");

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File size exceeds 10MB limit");
      AuditLogger.logSecurityEvent("system", "FILE_UPLOAD_REJECTED", `File size ${file.size} exceeds limit`);
      return;
    }

    setFileName(file.name);

    const ext = file.name.split(".").pop()?.toLowerCase();
    
    // Validate file extension
    if (!["csv", "xlsx", "xls"].includes(ext || "")) {
      toast.error("Please upload a CSV or Excel (.xlsx) file");
      AuditLogger.logSecurityEvent("system", "FILE_UPLOAD_REJECTED", `Invalid file type: ${ext}`);
      return;
    }

    if (ext === "csv") {
      Papa.parse<ParsedRow>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setParsedData(results.data);
          setAvailableColumns(results.meta.fields || []);
          setStep("map");
          toast.success(`Parsed ${results.data.length} rows from CSV`);
          AuditLogger.logAction("system", "FILE_IMPORT_PARSED", "csv_file", "success", { 
            rowCount: results.data.length,
            fileName: file.name
          });
        },
        error: (error) => {
          toast.error("Failed to parse CSV file");
          AuditLogger.logSecurityEvent("system", "FILE_PARSE_ERROR", `CSV parse error: ${error?.message || "unknown"}`);
        }
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const wb = XLSX.read(evt.target?.result, { type: "binary" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json<ParsedRow>(ws);
          const cols = data.length > 0 ? Object.keys(data[0]) : [];
          setParsedData(data);
          setAvailableColumns(cols);
          setStep("map");
          toast.success(`Parsed ${data.length} rows from Excel`);
          AuditLogger.logAction("system", "FILE_IMPORT_PARSED", "excel_file", "success", { 
            rowCount: data.length,
            fileName: file.name
          });
        } catch (error) {
          toast.error("Failed to parse Excel file");
          AuditLogger.logSecurityEvent("system", "FILE_PARSE_ERROR", `Excel parse error: ${String(error)}`);
        }
      };
      reader.readAsBinaryString(file);
    }
  }, []);

  const matchedRows = useMemo(() => {
    if (!columnMapping.code || !columnMapping.actual) return [];
    return parsedData.map((row) => {
      const rawCode = String(row[columnMapping.code] ?? "").trim();
      const actual = Number(row[columnMapping.actual]) || 0;
      const remarks = columnMapping.remarks ? String(row[columnMapping.remarks] ?? "") : "";

      // Try to match by code or partial indicator name
      const matched = indicators.find(
        (ind) =>
          ind.code.toLowerCase() === rawCode.toLowerCase() ||
          ind.indicator.toLowerCase().includes(rawCode.toLowerCase()) ||
          rawCode.toLowerCase().includes(ind.code.toLowerCase())
      );

      return {
        rawCode,
        actual,
        remarks,
        matchedCode: matched?.code,
        matchedName: matched?.indicator,
        matched: !!matched,
      };
    });
  }, [parsedData, columnMapping]);

  const matchCount = matchedRows.filter((r) => r.matched).length;

  const handleImport = () => {
    if (!mappedMonth) {
      toast.error("Please select a month for this data");
      return;
    }

    // Validate imported data before applying
    const dataToImport = matchedRows
      .filter((r) => r.matched && r.matchedCode)
      .map((r) => ({
        code: r.matchedCode!,
        month: mappedMonth,
        actual: r.actual,
        remarks: r.remarks,
      } as MonthlyEntry));

    // Validate each entry
    const validationErrors: string[] = [];
    dataToImport.forEach((entry) => {
      const { valid, errors } = DataValidator.validateMonthlyEntry(entry);
      if (!valid) {
        validationErrors.push(...errors);
      }
    });

    if (validationErrors.length > 0) {
      toast.error(`Validation failed: ${validationErrors[0]}`);
      AuditLogger.logSecurityEvent("system", "IMPORT_VALIDATION_FAILED", `${validationErrors.length} validation errors: ${validationErrors[0]}`);
      return;
    }

    // Perform the import
    setMonthlyData((prev) => {
      const copy = [...prev];
      dataToImport.forEach((entry) => {
        const idx = copy.findIndex((e) => e.code === entry.code && e.month === entry.month);
        if (idx >= 0) {
          copy[idx] = { ...copy[idx], actual: entry.actual, remarks: entry.remarks || copy[idx].remarks };
        } else {
          copy.push(entry);
        }
      });
      return copy;
    });

    toast.success(`Imported ${matchCount} indicators for ${mappedMonth}`);
    
    // Log successful import
    AuditLogger.logAction("system", "DATA_IMPORT", "monthly_indicators", "success", { 
      count: matchCount,
      month: mappedMonth,
      source: "file_upload"
    });

    setStep("done");
  };

  const resetImport = () => {
    setParsedData([]);
    setFileName("");
    setColumnMapping({});
    setAvailableColumns([]);
    setMappedMonth("");
    setStep("upload");
  };

  return (
    <div className="space-y-6">
      {/* Steps indicator */}
      <div className="flex items-center gap-2 text-sm">
        {["Upload File", "Map Columns", "Preview & Import", "Complete"].map((label, i) => {
          const stepKeys = ["upload", "map", "preview", "done"] as const;
          const isActive = stepKeys.indexOf(step) >= i;
          return (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="rounded-lg border-2 border-dashed bg-card p-12 text-center">
          <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold text-lg mb-2">Import DHIS2 Monthly Data</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Upload a CSV or Excel file exported from DHIS2. The file should contain indicator codes/names and their monthly values.
          </p>
          <label className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium cursor-pointer hover:opacity-90 transition-opacity">
            <FileSpreadsheet className="h-5 w-5" />
            Choose File (CSV / Excel)
            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden" />
          </label>
          <div className="mt-8 rounded-lg bg-muted/50 p-4 text-left max-w-lg mx-auto">
            <h4 className="font-medium text-sm mb-2">Expected File Format:</h4>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• <strong>Indicator Code/Name column</strong> — matches to system indicator codes (e.g., MCH_FP_01)</p>
              <p>• <strong>Value/Actual column</strong> — the monthly numeric value</p>
              <p>• <strong>Remarks column</strong> (optional) — notes or observations</p>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Map columns */}
      {step === "map" && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Map Columns — {fileName}</h3>
              <span className="text-xs text-muted-foreground">({parsedData.length} rows)</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Map your file columns to the required fields:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Indicator Code/Name *</label>
                <Select value={columnMapping.code || ""} onValueChange={(v) => setColumnMapping((p) => ({ ...p, code: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select column" /></SelectTrigger>
                  <SelectContent>
                    {availableColumns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Actual Value *</label>
                <Select value={columnMapping.actual || ""} onValueChange={(v) => setColumnMapping((p) => ({ ...p, actual: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select column" /></SelectTrigger>
                  <SelectContent>
                    {availableColumns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Remarks (optional)</label>
                <Select value={columnMapping.remarks || ""} onValueChange={(v) => setColumnMapping((p) => ({ ...p, remarks: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select column" /></SelectTrigger>
                  <SelectContent>
                    {availableColumns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Month *</label>
                <Select value={mappedMonth} onValueChange={setMappedMonth}>
                  <SelectTrigger><SelectValue placeholder="Select month" /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={resetImport}>Back</Button>
              <Button
                onClick={() => setStep("preview")}
                disabled={!columnMapping.code || !columnMapping.actual || !mappedMonth}
              >
                Preview Mapping
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === "preview" && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Preview Import — {mappedMonth}</h3>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-status-green font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> {matchCount} matched
                </span>
                <span className="text-status-red font-medium flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" /> {matchedRows.length - matchCount} unmatched
                </span>
              </div>
            </div>

            <div className="rounded-lg border overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0">
                  <tr className="border-b bg-muted/50">
                    <th className="table-header text-left p-2">Source Value</th>
                    <th className="table-header text-left p-2">Matched Code</th>
                    <th className="table-header text-left p-2">Indicator</th>
                    <th className="table-header text-right p-2">Actual</th>
                    <th className="table-header text-center p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {matchedRows.map((r, i) => (
                    <tr key={i} className={`border-b ${r.matched ? "" : "bg-status-red-bg"}`}>
                      <td className="p-2 font-mono text-xs">{r.rawCode}</td>
                      <td className="p-2 font-mono text-xs text-primary">{r.matchedCode ?? "—"}</td>
                      <td className="p-2 text-xs">{r.matchedName ?? "No match found"}</td>
                      <td className="p-2 text-right font-mono">{r.actual}</td>
                      <td className="p-2 text-center">
                        {r.matched ? (
                          <span className="status-badge-green">Match</span>
                        ) : (
                          <span className="status-badge-red">No Match</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3 mt-4">
              <Button variant="outline" onClick={() => setStep("map")}>Back</Button>
              <Button onClick={handleImport} disabled={matchCount === 0}>
                Import {matchCount} Indicators
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Done */}
      {step === "done" && (
        <div className="rounded-lg border bg-card p-12 text-center">
          <CheckCircle2 className="h-16 w-16 mx-auto text-status-green mb-4" />
          <h3 className="font-semibold text-lg mb-2">Import Complete!</h3>
          <p className="text-muted-foreground mb-6">
            Successfully imported <strong>{matchCount}</strong> indicator values for <strong>{mappedMonth}</strong>.
          </p>
          <Button onClick={resetImport}>Import Another File</Button>
        </div>
      )}
    </div>
  );
}
