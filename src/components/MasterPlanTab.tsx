import { useState, useMemo } from "react";
import { indicators, getStatus, getActualYTD, getProgramAreas, type MonthlyEntry } from "@/data/hospitalIndicators";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

interface Props {
  monthlyData: MonthlyEntry[];
}

const StatusBadge = ({ percent }: { percent: number }) => {
  const status = getStatus(percent);
  const label = status === "green" ? "On Track" : status === "yellow" ? "At Risk" : "Off Track";
  return <span className={`status-badge-${status}`}>{label}</span>;
};

export default function MasterPlanTab({ monthlyData }: Props) {
  const [search, setSearch] = useState("");
  const [filterArea, setFilterArea] = useState("all");

  const filtered = useMemo(() => {
    return indicators.filter((ind) => {
      const matchesSearch =
        ind.code.toLowerCase().includes(search.toLowerCase()) ||
        ind.indicator.toLowerCase().includes(search.toLowerCase()) ||
        ind.subProgram.toLowerCase().includes(search.toLowerCase());
      const matchesArea = filterArea === "all" || ind.programArea === filterArea;
      return matchesSearch && matchesArea;
    });
  }, [search, filterArea]);

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
            </tr>
          </thead>
          <tbody>
            {filtered.map((ind, i) => {
              const actual = getActualYTD(ind.code, monthlyData);
              const percent = ind.target === 0 ? 0 : Math.round((actual / ind.target) * 100);
              return (
                <tr key={ind.code} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                  <td className="p-3 font-mono text-xs font-medium text-primary">{ind.code}</td>
                  <td className="p-3">{ind.programArea}</td>
                  <td className="p-3 text-muted-foreground">{ind.subProgram}</td>
                  <td className="p-3">{ind.indicator}</td>
                  <td className="p-3 text-center text-muted-foreground">{ind.unit}</td>
                  <td className="p-3 text-right font-mono">{ind.baseline}</td>
                  <td className="p-3 text-right font-mono font-semibold">{ind.target}</td>
                  <td className="p-3 text-right font-mono font-semibold text-primary">{actual}</td>
                  <td className="p-3 text-right font-mono font-semibold">{percent}%</td>
                  <td className="p-3 text-center"><StatusBadge percent={percent} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Showing {filtered.length} of {indicators.length} indicators</p>
    </div>
  );
}
