import { useState, useMemo } from "react";
import { indicators as defaultIndicators, getStatus, getActualYTD, getProgramAreas, type MonthlyEntry, type Indicator } from "@/data/hospitalIndicators";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, Pencil, Save, X } from "lucide-react";

interface Props {
  monthlyData: MonthlyEntry[];
  selectedYear: number;
}

const StatusBadge = ({ percent }: { percent: number }) => {
  const status = getStatus(percent);
  const label = status === "green" ? "On Track" : status === "yellow" ? "At Risk" : "Off Track";
  return <span className={`status-badge-${status}`}>{label}</span>;
};

export default function MasterPlanTab({ monthlyData, selectedYear }: Props) {
  const [search, setSearch] = useState("");
  const [filterArea, setFilterArea] = useState("all");
  const [editingCode, setEditingCode] = useState<string | null>(null);
  
  // Year-specific overrides for targets and baselines
  const [yearOverrides, setYearOverrides] = useState<Record<number, Record<string, { target?: number; baseline?: number }>>>({});
  const [editTarget, setEditTarget] = useState("");
  const [editBaseline, setEditBaseline] = useState("");

  const indicatorsForYear = useMemo(() => {
    const overrides = yearOverrides[selectedYear] || {};
    return defaultIndicators.map((ind) => ({
      ...ind,
      target: overrides[ind.code]?.target ?? ind.target,
      baseline: overrides[ind.code]?.baseline ?? ind.baseline,
    }));
  }, [selectedYear, yearOverrides]);

  const filtered = useMemo(() => {
    return indicatorsForYear.filter((ind) => {
      const matchesSearch =
        ind.code.toLowerCase().includes(search.toLowerCase()) ||
        ind.indicator.toLowerCase().includes(search.toLowerCase()) ||
        ind.subProgram.toLowerCase().includes(search.toLowerCase());
      const matchesArea = filterArea === "all" || ind.programArea === filterArea;
      return matchesSearch && matchesArea;
    });
  }, [search, filterArea, indicatorsForYear]);

  const startEdit = (ind: Indicator) => {
    setEditingCode(ind.code);
    setEditTarget(String(ind.target));
    setEditBaseline(String(ind.baseline));
  };

  const saveEdit = (code: string) => {
    setYearOverrides((prev) => ({
      ...prev,
      [selectedYear]: {
        ...(prev[selectedYear] || {}),
        [code]: {
          target: editTarget === "" ? 0 : Number(editTarget),
          baseline: editBaseline === "" ? 0 : Number(editBaseline),
        },
      },
    }));
    setEditingCode(null);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by code, indicator, or sub-program..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterArea} onValueChange={setFilterArea}>
          <SelectTrigger className="w-full sm:w-[240px]">
            <SelectValue placeholder="All Program Areas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Program Areas</SelectItem>
            {getProgramAreas().map((area) => (
              <SelectItem key={area} value={area}>{area}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground">
        Showing data for <strong>{selectedYear}</strong>. Click the edit icon to update targets and baselines for this year.
      </p>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="table-header text-left p-3">Code</th>
              <th className="table-header text-left p-3">Program Area</th>
              <th className="table-header text-left p-3">Sub-program</th>
              <th className="table-header text-left p-3 min-w-[250px]">Indicator</th>
              <th className="table-header text-center p-3">Unit</th>
              <th className="table-header text-right p-3">Baseline</th>
              <th className="table-header text-right p-3">Target</th>
              <th className="table-header text-right p-3">Actual (YTD)</th>
              <th className="table-header text-right p-3">% Achieved</th>
              <th className="table-header text-center p-3">Status</th>
              <th className="table-header text-center p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((ind, i) => {
              const actual = getActualYTD(ind.code, monthlyData);
              const percent = ind.target === 0 ? 0 : Math.round((actual / ind.target) * 100);
              const isEditing = editingCode === ind.code;
              return (
                <tr key={ind.code} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                  <td className="p-3 font-mono text-xs font-medium text-primary">{ind.code}</td>
                  <td className="p-3">{ind.programArea}</td>
                  <td className="p-3 text-muted-foreground">{ind.subProgram}</td>
                  <td className="p-3">{ind.indicator}</td>
                  <td className="p-3 text-center text-muted-foreground">{ind.unit}</td>
                  <td className="p-3 text-right font-mono">
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editBaseline}
                        onChange={(e) => setEditBaseline(e.target.value)}
                        className="w-20 text-right font-mono ml-auto"
                      />
                    ) : ind.baseline}
                  </td>
                  <td className="p-3 text-right font-mono font-semibold">
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editTarget}
                        onChange={(e) => setEditTarget(e.target.value)}
                        className="w-20 text-right font-mono ml-auto"
                      />
                    ) : ind.target}
                  </td>
                  <td className="p-3 text-right font-mono font-semibold text-primary">{actual}</td>
                  <td className="p-3 text-right font-mono font-semibold">{percent}%</td>
                  <td className="p-3 text-center"><StatusBadge percent={percent} /></td>
                  <td className="p-3 text-center">
                    {isEditing ? (
                      <div className="flex items-center justify-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveEdit(ind.code)}>
                          <Save className="h-3.5 w-3.5 text-primary" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingCode(null)}>
                          <X className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    ) : (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(ind)}>
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Showing {filtered.length} of {defaultIndicators.length} indicators</p>
    </div>
  );
}
