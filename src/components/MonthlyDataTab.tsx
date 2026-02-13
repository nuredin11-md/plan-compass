import { useState, useMemo } from "react";
import { indicators, MONTHS, type MonthlyEntry } from "@/data/hospitalIndicators";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

interface Props {
  monthlyData: MonthlyEntry[];
  setMonthlyData: React.Dispatch<React.SetStateAction<MonthlyEntry[]>>;
}

export default function MonthlyDataTab({ monthlyData, setMonthlyData }: Props) {
  const [selectedCode, setSelectedCode] = useState(indicators[0].code);
  const [search, setSearch] = useState("");

  const currentIndicator = indicators.find((i) => i.code === selectedCode);

  const filteredIndicators = useMemo(() => {
    if (!search) return indicators;
    return indicators.filter(
      (i) =>
        i.code.toLowerCase().includes(search.toLowerCase()) ||
        i.indicator.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  const rows = useMemo(() => {
    return MONTHS.map((month) => {
      const entry = monthlyData.find((e) => e.code === selectedCode && e.month === month);
      return { month, actual: entry?.actual ?? null, remarks: entry?.remarks ?? "" };
    });
  }, [selectedCode, monthlyData]);

  const updateEntry = (month: string, field: "actual" | "remarks", value: string) => {
    setMonthlyData((prev) => {
      const copy = [...prev];
      const idx = copy.findIndex((e) => e.code === selectedCode && e.month === month);
      if (idx >= 0) {
        copy[idx] = {
          ...copy[idx],
          [field]: field === "actual" ? (value === "" ? null : Number(value)) : value,
        };
      }
      return copy;
    });
  };

  const ytdTotal = rows.reduce((s, r) => s + (r.actual ?? 0), 0);
  const monthlyTarget = currentIndicator ? Math.round(currentIndicator.target / 12) : 0;

  return (
    <div className="space-y-4">
      {/* Selector */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search indicators..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedCode} onValueChange={setSelectedCode}>
          <SelectTrigger className="w-full sm:w-[400px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {filteredIndicators.map((ind) => (
              <SelectItem key={ind.code} value={ind.code}>
                <span className="font-mono text-xs">{ind.code}</span>
                <span className="ml-2 text-xs text-muted-foreground truncate">{ind.indicator.substring(0, 50)}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Current indicator info */}
      {currentIndicator && (
        <div className="rounded-lg border bg-secondary/50 p-4 space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-primary">{currentIndicator.code}</span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-sm text-muted-foreground">{currentIndicator.programArea} → {currentIndicator.subProgram}</span>
          </div>
          <p className="font-medium">{currentIndicator.indicator}</p>
          <div className="flex gap-6 text-sm">
            <span>Annual Target: <strong>{currentIndicator.target}</strong></span>
            <span>Monthly Target: <strong>~{monthlyTarget}</strong></span>
            <span>YTD Actual: <strong className="text-primary">{ytdTotal}</strong></span>
          </div>
        </div>
      )}

      {/* Monthly table */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="table-header text-left p-3">Month</th>
              <th className="table-header text-right p-3 w-32">Actual</th>
              <th className="table-header text-left p-3">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.month} className={`border-b last:border-0 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                <td className="p-3 font-medium">{row.month}</td>
                <td className="p-3">
                  <Input
                    type="number"
                    value={row.actual ?? ""}
                    onChange={(e) => updateEntry(row.month, "actual", e.target.value)}
                    className="text-right font-mono w-28 ml-auto"
                    placeholder="—"
                  />
                </td>
                <td className="p-3">
                  <Input
                    value={row.remarks}
                    onChange={(e) => updateEntry(row.month, "remarks", e.target.value)}
                    placeholder="Add remarks..."
                    className="text-sm"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
