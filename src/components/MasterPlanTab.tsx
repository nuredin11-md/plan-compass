import { useState, useMemo, useRef } from "react";
import {
  indicators as defaultIndicators,
  getStatus,
  getActualYTD,
  type MonthlyEntry,
  type Indicator,
} from "@/data/hospitalIndicators";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Search,
  Save,
  X,
  Plus,
  Trash2,
  Maximize2,
  Minimize2,
  Pencil,
} from "lucide-react";

import { useDatabase } from "@/hooks/useDatabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Props {
  monthlyData: MonthlyEntry[];
  selectedYear: number;
  previousYearData: MonthlyEntry[];
}

const StatusBadge = ({ percent }: { percent: number }) => {
  const status = getStatus(percent);
  const label = status === "green" ? "On Track" : status === "yellow" ? "At Risk" : "Off Track";
  return <span className={`status-badge-${status}`}>{label}</span>;
};

export default function MasterPlanTab({ monthlyData, selectedYear, previousYearData }: Props) {
  const { user } = useAuth();
  const { upsertAnnualPlan, deleteAnnualPlan } = useDatabase();

  const [search, setSearch] = useState("");
  const [filterArea, setFilterArea] = useState("all");
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [customIndicators, setCustomIndicators] = useState<Indicator[]>([]);
  const [editTarget, setEditTarget] = useState("");
  const [editBaseline, setEditBaseline] = useState("");
  const [editIndicatorName, setEditIndicatorName] = useState("");

  const [yearOverrides, setYearOverrides] = useState<Record<number, Record<string, { target?: number; baseline?: number }>>>({});

  const allIndicators = useMemo(() => [...defaultIndicators, ...customIndicators], [customIndicators]);

  const uniqueProgramAreas = useMemo(() => Array.from(new Set(allIndicators.map((i) => i.programArea))).sort(), [allIndicators]);
  const uniqueSubPrograms = useMemo(() => Array.from(new Set(allIndicators.map((i) => i.subProgram))).sort(), [allIndicators]);
  const uniqueCodes = useMemo(() => Array.from(new Set(allIndicators.map((i) => i.code))), [allIndicators]);

  const [newIndicator, setNewIndicator] = useState({
    code: "",
    indicator: "",
    unit: "",
    baseline: 0,
    target: 0,
    programArea: "",
    subProgram: "",
  });

  const indicatorsForYear = useMemo(() => {
    const overrides = yearOverrides[selectedYear] || {};
    return allIndicators.map((ind) => ({
      ...ind,
      target: overrides[ind.code]?.target ?? ind.target,
      baseline: overrides[ind.code]?.baseline ?? ind.baseline,
    }));
  }, [allIndicators, selectedYear, yearOverrides]);

  const filtered = useMemo(() => {
    return indicatorsForYear.filter((ind) => {
      const matchesSearch = ind.code.toLowerCase().includes(search.toLowerCase()) ||
        ind.indicator.toLowerCase().includes(search.toLowerCase());
      const matchesArea = filterArea === "all" || ind.programArea === filterArea;
      return matchesSearch && matchesArea;
    });
  }, [search, filterArea, indicatorsForYear]);

  const startEdit = (ind: Indicator) => {
    setEditingCode(ind.code);
    setEditTarget(String(ind.target));
    setEditBaseline(String(ind.baseline));
    setEditIndicatorName(ind.indicator);
  };

  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);

  const saveEdit = async (code: string) => {
    try {
      const indicator = indicatorsForYear.find((ind) => ind.code === code);
      if (!indicator) return;

      const newTarget = Number(editTarget);
      const newBaseline = Number(editBaseline);

      await upsertAnnualPlan(selectedYear, code, indicator.programArea, indicator.subProgram, editIndicatorName, indicator.unit, newBaseline, newTarget, user?.id || null);

      setYearOverrides((prev) => ({
        ...prev,
        [selectedYear]: { ...(prev[selectedYear] || {}), [code]: { target: newTarget, baseline: newBaseline } },
      }));

      setCustomIndicators((prev) => prev.map((item) => item.code === code ? { ...item, indicator: editIndicatorName } : item));
      setEditingCode(null);
      toast.success("Updated successfully");
    } catch (error) {
      toast.error("Update failed");
    }
  };

  const handleAddIndicator = async () => {
  if (!newIndicator.code || !newIndicator.indicator) {
    toast.error("Code and Name are required");
    return;
  }
  
  try {
    const indicator: Indicator = { 
      ...newIndicator, 
      unit: newIndicator.unit || "#",
      // እነዚህን ወደ ዜሮ አስጠጋቸው ዳታቤዝ ላይ ችግር እንዳይፈጥሩ
      baseline: Number(newIndicator.baseline) || 0,
      target: Number(newIndicator.target) || 0
    };

    // 1. ዳታቤዝ ላይ ሴቭ እናደርጋለን
    await upsertAnnualPlan(
      selectedYear, 
      indicator.code, 
      indicator.programArea, 
      indicator.subProgram, 
      indicator.indicator, 
      indicator.unit, 
      indicator.baseline, 
      indicator.target, 
      user?.id || null
    );

    // 2. ወዲያው ቴብሉ ላይ እንዲታይ State ውስጥ እንጨምራለን
    setCustomIndicators((prev) => [...prev, indicator]);
    
    // 3. ፎርሙን እናጸዳለን
    setIsAddDialogOpen(false);
    setNewIndicator({ code: "", indicator: "", unit: "", baseline: 0, target: 0, programArea: "", subProgram: "" });
    
    toast.success("Indicator added and saved successfully!");
  } catch (e) {
    console.error(e);
    toast.error("Error adding indicator to database");
  }
};
  return (
    <div className={`space-y-4 ${isFullscreen ? "fixed inset-0 z-50 bg-background p-6 overflow-hidden flex flex-col" : ""}`}>
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex flex-1 gap-3 w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search indicators..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={filterArea} onValueChange={setFilterArea}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Areas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Program Areas</SelectItem>
              {uniqueProgramAreas.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Add</Button></DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader><DialogTitle>New Indicator</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Code</Label>
                    <Input list="codes" value={newIndicator.code} onChange={(e) => setNewIndicator({...newIndicator, code: e.target.value.toUpperCase()})} />
                    <datalist id="codes">{uniqueCodes.map(c => <option key={c} value={c}/>)}</datalist>
                  </div>
                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <Input value={newIndicator.unit} onChange={(e) => setNewIndicator({...newIndicator, unit: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Indicator Name</Label>
                  <Input value={newIndicator.indicator} onChange={(e) => setNewIndicator({...newIndicator, indicator: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Program Area</Label>
                    <Select onValueChange={(v) => setNewIndicator({...newIndicator, programArea: v})}>
                      <SelectTrigger><SelectValue placeholder="Select Area" /></SelectTrigger>
                      <SelectContent>{uniqueProgramAreas.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Sub-program</Label>
                    <Select onValueChange={(v) => setNewIndicator({...newIndicator, subProgram: v})}>
                      <SelectTrigger><SelectValue placeholder="Select Sub" /></SelectTrigger>
                      <SelectContent>{uniqueSubPrograms.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Baseline</Label><Input type="number" onChange={(e) => setNewIndicator({...newIndicator, baseline: Number(e.target.value)})} /></div>
                  <div className="space-y-2"><Label>Target</Label><Input type="number" onChange={(e) => setNewIndicator({...newIndicator, target: Number(e.target.value)})} /></div>
                </div>
                <Button className="w-full" onClick={handleAddIndicator}>Save Indicator</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className={`flex-1 rounded-xl border bg-card overflow-hidden flex flex-col shadow-sm`}>
        <div ref={scrollContainerRef} className="overflow-auto flex-1">
          <table className="w-full min-w-[1400px] text-sm border-collapse">
            <thead className="sticky top-0 z-30 bg-muted/50 backdrop-blur-sm border-b">
              <tr>
                <th className="p-3 text-left border-r sticky left-0 bg-muted/50 z-40 w-[100px]">Code</th>
                <th className="p-3 text-left min-w-[350px]">Indicator Name</th>
                <th className="p-3 text-left">Program Area</th>
                <th className="p-3 text-left">Sub-program</th>
                <th className="p-3 text-center">Unit</th>
                <th className="p-3 text-right w-[100px]">Baseline</th>
                <th className="p-3 text-right w-[100px]">Target</th>
                <th className="p-3 text-right w-[100px]">Actual</th>
                <th className="p-3 text-right w-[80px]">%</th>
                <th className="p-3 text-center w-[120px]">Status</th>
                <th className="p-3 text-center w-[100px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ind) => {
                const actual = getActualYTD(ind.code, monthlyData);
                const percent = ind.target > 0 ? Math.round((actual / ind.target) * 100) : 0;
                const isEditing = editingCode === ind.code;
                const isCustom = customIndicators.some(ci => ci.code === ind.code);

                return (
                  <tr key={ind.code} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-3 border-r sticky left-0 bg-card font-mono text-primary font-bold z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      {ind.code}
                    </td>
                    <td className="p-3 font-medium">
                      {isEditing ? (
                        <Input value={editIndicatorName} onChange={(e) => setEditIndicatorName(e.target.value)} className="h-8 text-xs" />
                      ) : (
                        ind.indicator
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground">{ind.programArea}</td>
                    <td className="p-3 text-muted-foreground">{ind.subProgram}</td>
                    <td className="p-3 text-center text-muted-foreground">{ind.unit}</td>
                    <td className="p-3 text-right font-mono">
                      {isEditing ? (
                        <Input type="number" value={editBaseline} onChange={(e) => setEditBaseline(e.target.value)} className="w-20 h-8 text-right text-xs" />
                      ) : ind.baseline}
                    </td>
                    <td className="p-3 text-right font-mono font-semibold">
                      {isEditing ? (
                        <Input type="number" value={editTarget} onChange={(e) => setEditTarget(e.target.value)} className="w-20 h-8 text-right text-xs" />
                      ) : ind.target}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-primary">{actual}</td>
                    <td className="p-3 text-right font-mono font-bold">{percent}%</td>
                    <td className="p-3 text-center"><StatusBadge percent={percent} /></td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1">
                        {isEditing ? (
                          <>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveEdit(ind.code)}><Save className="h-3.5 w-3.5 text-green-600" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingCode(null)}><X className="h-3.5 w-3.5 text-destructive" /></Button>
                          </>
                        ) : (
                          <>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(ind)}><Pencil className="h-3.5 w-3.5 text-blue-600" /></Button>
                            {isCustom && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteAnnualPlan(selectedYear, ind.code)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}