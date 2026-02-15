import { useState, useMemo } from "react";
import { indicators, MONTHS, type MonthlyEntry } from "@/data/hospitalIndicators";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, CalendarDays, ClipboardEdit } from "lucide-react";

interface Props {
  monthlyData: MonthlyEntry[];
  setMonthlyData: React.Dispatch<React.SetStateAction<MonthlyEntry[]>>;
}

export default function MonthlyDataTab({ monthlyData, setMonthlyData }: Props) {
  const [selectedCode, setSelectedCode] = useState(indicators[0].code);
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[0]);
  const [search, setSearch] = useState("");

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

  // 3. Centralized update function
  const handleUpdate = (field: "actual" | "remarks", value: string) => {
    setMonthlyData((prev) => {
      const idx = prev.findIndex((e) => e.code === selectedCode && e.month === selectedMonth);
      const newValue = field === "actual" ? (value === "" ? null : Number(value)) : value;

      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], [field]: newValue };
        return copy;
      } else {
        // Create new entry if it doesn't exist
        return [
          ...prev,
          {
            code: selectedCode,
            month: selectedMonth,
            actual: field === "actual" ? Number(value) : null,
            remarks: field === "remarks" ? value : "",
          } as MonthlyEntry,
        ];
      }
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardEdit className="h-5 w-5 text-primary" />
            Data Entry: Master Plan Indicators
          </CardTitle>
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}