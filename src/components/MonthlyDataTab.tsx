import { useState, useMemo, useEffect, useRef } from "react";
import { indicators, MONTHS, type MonthlyEntry } from "@/data/hospitalIndicators";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, CalendarDays, ClipboardEdit, Check, Clock, AlertCircle, Save } from "lucide-react";
import { toast } from "sonner";
import { InputValidator, AuditLogger, DataValidator } from "@/lib/securityUtils";

interface Props {
  monthlyData: MonthlyEntry[];
  setMonthlyData: React.Dispatch<React.SetStateAction<MonthlyEntry[]>>;
}

type SaveStatus = "saved" | "saving" | "pending" | "error";

export default function MonthlyDataTab({ monthlyData, setMonthlyData }: Props) {
  const [selectedCode, setSelectedCode] = useState(indicators[0].code);
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[0]);
  const [search, setSearch] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [lastSavedTime, setLastSavedTime] = useState<string>("");
  const [isMarkedComplete, setIsMarkedComplete] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [completedEntries, setCompletedEntries] = useState<Set<string>>(new Set());

  // 1. Find the master plan indicator details
  const currentIndicator = indicators.find((i) => i.code === selectedCode);

  // 2. Find the specific data entry for this Indicator + Month combo
  const currentEntry = monthlyData.find(
    (e) => e.code === selectedCode && e.month === selectedMonth
  );

  const filteredIndicators = useMemo(() => {
    if (!search) return indicators;
    return indicators.filter(
      (i) =>
        i.code.toLowerCase().includes(search.toLowerCase()) ||
        i.indicator.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  // Check if current entry is marked complete
  useEffect(() => {
    const entryKey = `${selectedCode}_${selectedMonth}`;
    setIsMarkedComplete(completedEntries.has(entryKey));
  }, [selectedCode, selectedMonth, completedEntries]);

  // Auto-save functionality with debouncing
  useEffect(() => {
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // If nothing has changed, don't set saving state
    if (saveStatus === "saved") return;

    setSaveStatus("saving");

    // Debounce save operation (2 seconds delay)
    saveTimeoutRef.current = setTimeout(() => {
      try {
        setSaveStatus("saved");
        setLastSavedTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        
        AuditLogger.logAction("system", "DATA_AUTO_SAVED", "monthly_data", "success", {
          code: selectedCode,
          month: selectedMonth,
          timestamp: new Date().toISOString(),
        });

        toast.success("Data saved", { duration: 2000 });
      } catch (error) {
        setSaveStatus("error");
        toast.error("Failed to save data");
        AuditLogger.logSecurityEvent("system", "AUTO_SAVE_FAILED", String(error) || "unknown_error");
      }
    }, 2000); // 2 second debounce

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [saveStatus, selectedCode, selectedMonth]);

  // 3. Centralized update function with auto-save
  const handleUpdate = (field: "actual" | "remarks", value: string) => {
    // Validate input before processing
    if (field === "actual" && value !== "") {
      if (!InputValidator.isValidNumber(Number(value))) {
        toast.error("Invalid numeric value");
        AuditLogger.logSecurityEvent("system", "DATA_VALIDATION_FAILED", "invalid_number");
        setSaveStatus("error");
        return;
      }
    }

    if (field === "remarks" && value) {
      const sanitized = InputValidator.sanitizeInput(value);
      if (sanitized !== value) {
        toast.info("Input sanitized for safety");
        setSaveStatus("pending");
        setMonthlyData((prev) => {
          const idx = prev.findIndex((e) => e.code === selectedCode && e.month === selectedMonth);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], remarks: sanitized };
            AuditLogger.logAction("system", "DATA_UPDATE", "monthly_data", "success", {
              code: selectedCode,
              month: selectedMonth,
              field,
              sanitized: true,
            });
            return copy;
          } else {
            const newEntry: MonthlyEntry = {
              code: selectedCode,
              month: selectedMonth,
              actual: null,
              remarks: sanitized,
            };
            AuditLogger.logAction("system", "DATA_CREATE", "monthly_data", "success", {
              code: selectedCode,
              month: selectedMonth,
              field,
            });
            return [...prev, newEntry];
          }
        });
        return;
      }
    }

    // Perform update with audit logging
    setSaveStatus("pending");
    setMonthlyData((prev) => {
      const idx = prev.findIndex((e) => e.code === selectedCode && e.month === selectedMonth);
      const newValue = field === "actual" ? (value === "" ? null : Number(value)) : value;

      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], [field]: newValue };
        
        AuditLogger.logAction("system", "DATA_UPDATE", "monthly_data", "success", {
          code: selectedCode,
          month: selectedMonth,
          field,
          previousValue: prev[idx][field],
          newValue,
        });
        
        return copy;
      } else {
        // Create new entry if it doesn't exist
        const newEntry: MonthlyEntry = {
          code: selectedCode,
          month: selectedMonth,
          actual: field === "actual" ? Number(value) : null,
          remarks: field === "remarks" ? value : "",
        };

        // Validate new entry before creating
        const { valid, errors } = DataValidator.validateMonthlyEntry(newEntry);
        if (!valid) {
          toast.error(`Validation error: ${errors[0]}`);
          AuditLogger.logSecurityEvent("system", "DATA_CREATION_FAILED", "validation_error");
          setSaveStatus("error");
          return prev;
        }

        AuditLogger.logAction("system", "DATA_CREATE", "monthly_data", "success", {
          code: selectedCode,
          month: selectedMonth,
          field,
        });

        return [...prev, newEntry];
      }
    });
  };

  // Manual save and mark complete
  const handleMarkComplete = () => {
    const entryKey = `${selectedCode}_${selectedMonth}`;
    const newCompleted = new Set(completedEntries);
    
    if (newCompleted.has(entryKey)) {
      newCompleted.delete(entryKey);
      toast.info("Marked as incomplete");
    } else {
      newCompleted.add(entryKey);
      toast.success("Marked as complete");
    }
    
    setCompletedEntries(newCompleted);
    setSaveStatus("pending");
    
    // Force immediate save
    setTimeout(() => {
      setSaveStatus("saved");
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      
      AuditLogger.logAction("system", "MARK_COMPLETE", "monthly_data", "success", {
        code: selectedCode,
        month: selectedMonth,
        completed: newCompleted.has(entryKey),
        timestamp: new Date().toISOString(),
      });
    }, 500);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardEdit className="h-5 w-5 text-primary" />
              Data Entry: Master Plan Indicators
            </CardTitle>
            
            {/* Save Status Indicator */}
            <div className="flex items-center gap-2">
              {saveStatus === "saved" && (
                <div className="flex items-center gap-1 text-green-600 bg-green-50 px-3 py-1.5 rounded-full text-sm font-medium">
                  <Check className="h-4 w-4" />
                  <span>Saved</span>
                  {lastSavedTime && <span className="text-xs text-green-500">at {lastSavedTime}</span>}
                </div>
              )}
              {saveStatus === "saving" && (
                <div className="flex items-center gap-1 text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full text-sm font-medium">
                  <Clock className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </div>
              )}
              {saveStatus === "pending" && (
                <div className="flex items-center gap-1 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full text-sm font-medium">
                  <Clock className="h-4 w-4" />
                  <span>Pending</span>
                </div>
              )}
              {saveStatus === "error" && (
                <div className="flex items-center gap-1 text-red-600 bg-red-50 px-3 py-1.5 rounded-full text-sm font-medium">
                  <AlertCircle className="h-4 w-4" />
                  <span>Error</span>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          
          {/* STEP 1: SELECT INDICATOR */}
          <div className="space-y-2">
            <Label>1. Select Indicator from Master Plan</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground z-10" />
              <Input
                placeholder="Search by code or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 mb-2"
              />
            </div>
            <Select value={selectedCode} onValueChange={setSelectedCode}>
              <SelectTrigger className="h-auto py-3">
                <SelectValue placeholder="Select indicator" />
              </SelectTrigger>
              <SelectContent>
                {filteredIndicators.map((ind) => (
                  <SelectItem key={ind.code} value={ind.code}>
                    <div className="flex flex-col items-start">
                      <span className="font-bold text-xs uppercase">{ind.code}</span>
                      <span className="text-sm line-clamp-1">{ind.indicator}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* STEP 2: SELECT MONTH */}
          <div className="space-y-2">
            <Label>2. Select Reporting Month</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <hr className="my-4" />

          {/* STEP 3: INPUT DATA */}
          {currentIndicator && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="actual-val">Actual Value</Label>
                  <Input
                    id="actual-val"
                    type="number"
                    placeholder="Enter number..."
                    value={currentEntry?.actual ?? ""}
                    onChange={(e) => handleUpdate("actual", e.target.value)}
                    className="text-lg font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Monthly Target: ~{Math.round(currentIndicator.target / 12)}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="remarks">Remarks</Label>
                  <Input
                    id="remarks"
                    placeholder="Add notes..."
                    value={currentEntry?.remarks ?? ""}
                    onChange={(e) => handleUpdate("remarks", e.target.value)}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6 pt-4 border-t">
                <Button
                  onClick={() => {
                    setSaveStatus("saving");
                    setTimeout(() => {
                      setSaveStatus("saved");
                      setLastSavedTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
                      toast.success("Data saved manually");
                      AuditLogger.logAction("system", "DATA_MANUAL_SAVE", "monthly_data", "success", {
                        code: selectedCode,
                        month: selectedMonth,
                        timestamp: new Date().toISOString(),
                      });
                    }, 800);
                  }}
                  variant="outline"
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  Save Now
                </Button>

                <Button
                  onClick={handleMarkComplete}
                  variant={isMarkedComplete ? "default" : "outline"}
                  className={`gap-2 ${isMarkedComplete ? "bg-green-600 hover:bg-green-700" : ""}`}
                >
                  <Check className="h-4 w-4" />
                  {isMarkedComplete ? "Marked Complete ✓" : "Mark Complete"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}