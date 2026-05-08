import { useState, useMemo, useRef, useEffect } from "react";
import { indicators as defaultIndicators, getStatus, getActualYTD, getProgramAreas, type MonthlyEntry, type Indicator } from "@/data/hospitalIndicators";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Pencil, Save, X, Plus, Trash2 } from "lucide-react";
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  
  // Add indicator dialog state
  const [newIndicator, setNewIndicator] = useState({
    code: "",
    indicator: "",
    unit: "",
    baseline: 0,
    target: 0,
  });
  
  // Edit indicator dialog state
  const [editingIndicator, setEditingIndicator] = useState<Indicator | null>(null);
  const [isEditingIndicatorDialog, setIsEditingIndicatorDialog] = useState(false);
  const [editIndicatorForm, setEditIndicatorForm] = useState({
    code: "",
    indicator: "",
    programArea: "",
    subProgram: "",
    unit: "",
    baseline: 0,
    target: 0,
  });
  
  // Year-specific overrides for targets and baselines
  const [yearOverrides, setYearOverrides] = useState<Record<number, Record<string, { target?: number; baseline?: number }>>>({});
  const [customIndicators, setCustomIndicators] = useState<Indicator[]>([]);
  const [editTarget, setEditTarget] = useState("");
  const [editBaseline, setEditBaseline] = useState("");

  const indicatorsForYear = useMemo(() => {
    const overrides = yearOverrides[selectedYear] || {};
    const allIndicators = [...defaultIndicators, ...customIndicators];
    return allIndicators.map((ind) => ({
      ...ind,
      target: overrides[ind.code]?.target ?? ind.target,
      baseline: overrides[ind.code]?.baseline ?? ind.baseline,
    }));
  }, [selectedYear, yearOverrides, customIndicators]);

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

  // Handle horizontal scroll
  useEffect(() => {
    const handleScroll = () => {
      if (scrollContainerRef.current) {
        setScrollPosition(scrollContainerRef.current.scrollLeft);
      }
    };

    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, []);

  const startEdit = (ind: Indicator) => {
    setEditingCode(ind.code);
    setEditTarget(String(ind.target));
    // Auto-fill baseline from previous year's actual performance
    const prevYearActual = getActualYTD(ind.code, previousYearData);
    setEditBaseline(prevYearActual > 0 ? String(prevYearActual) : String(ind.baseline));
  };

  const saveEdit = async (code: string) => {
    try {
      const indicator = indicatorsForYear.find((ind) => ind.code === code);
      if (!indicator) return;

      const newTarget = editTarget === "" ? 0 : Number(editTarget);
      const newBaseline = editBaseline === "" ? 0 : Number(editBaseline);

      // Save to database
      await upsertAnnualPlan(
        selectedYear,
        code,
        indicator.programArea,
        indicator.subProgram,
        indicator.indicator,
        indicator.unit,
        newBaseline,
        newTarget,
        user?.id || null
      );

      // Update local state
      setYearOverrides((prev) => ({
        ...prev,
        [selectedYear]: {
          ...(prev[selectedYear] || {}),
          [code]: {
            target: newTarget,
            baseline: newBaseline,
          },
        },
      }));

      setEditingCode(null);
      toast.success("Plan saved successfully");
    } catch (error) {
      if (import.meta.env.DEV) console.error("Error saving plan:", error);
      toast.error("Failed to save plan");
    }
  };

  const handleAddIndicator = async () => {
    if (!newIndicator.code || !newIndicator.indicator) {
      toast.error("Code and Indicator name are required");
      return;
    }

    try {
      const indicator: Indicator = {
        code: newIndicator.code,
        indicator: newIndicator.indicator,
        unit: newIndicator.unit || "#",
        baseline: newIndicator.baseline,
        target: newIndicator.target,
        programArea: "Custom",
        subProgram: "Custom Indicator",
      };

      // Save to database
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

      // Update local state
      setCustomIndicators((prev) => [...prev, indicator]);
      setNewIndicator({ code: "", indicator: "", unit: "", baseline: 0, target: 0 });
      setIsAddDialogOpen(false);
      toast.success("Indicator added successfully");
    } catch (error) {
      if (import.meta.env.DEV) console.error("Error adding indicator:", error);
      toast.error("Failed to add indicator");
    }
  };

  const startEditIndicator = (ind: Indicator) => {
    setEditingIndicator(ind);
    setEditIndicatorForm({
      code: ind.code,
      indicator: ind.indicator,
      programArea: ind.programArea,
      subProgram: ind.subProgram,
      unit: ind.unit,
      baseline: ind.baseline,
      target: ind.target,
    });
    setIsEditingIndicatorDialog(true);
  };

  const handleEditIndicator = async () => {
    if (!editingIndicator || !editIndicatorForm.code || !editIndicatorForm.indicator) {
      toast.error("Code and Indicator name are required");
      return;
    }

    try {
      const updatedIndicator: Indicator = {
        ...editingIndicator,
        code: editIndicatorForm.code,
        indicator: editIndicatorForm.indicator,
        programArea: editIndicatorForm.programArea,
        subProgram: editIndicatorForm.subProgram,
        unit: editIndicatorForm.unit || "#",
        baseline: editIndicatorForm.baseline,
        target: editIndicatorForm.target,
      };

      // Save to database
      await upsertAnnualPlan(
        selectedYear,
        editIndicatorForm.code,
        editIndicatorForm.programArea,
        editIndicatorForm.subProgram,
        editIndicatorForm.indicator,
        editIndicatorForm.unit || "#",
        editIndicatorForm.baseline,
        editIndicatorForm.target,
        user?.id || null
      );

      // Update in custom indicators
      setCustomIndicators((prev) =>
        prev.map((ind) => (ind.code === editingIndicator.code ? updatedIndicator : ind))
      );

      // If code changed, update overrides
      if (editIndicatorForm.code !== editingIndicator.code) {
        setYearOverrides((prev) => {
          const newOverrides = { ...prev };
          if (newOverrides[selectedYear] && newOverrides[selectedYear][editingIndicator.code]) {
            newOverrides[selectedYear][editIndicatorForm.code] = newOverrides[selectedYear][editingIndicator.code];
            delete newOverrides[selectedYear][editingIndicator.code];
          }
          return newOverrides;
        });
      }

      setEditingIndicator(null);
      setIsEditingIndicatorDialog(false);
      toast.success("Indicator updated successfully");
    } catch (error) {
      if (import.meta.env.DEV) console.error("Error updating indicator:", error);
      toast.error("Failed to update indicator");
    }
  };

  const handleDeleteIndicator = async (code: string) => {
    const confirmed = window.confirm("Are you sure you want to delete this indicator? This action cannot be undone.");
    if (!confirmed) return;

    try {
      // Delete from database for all years
      await deleteAnnualPlan(selectedYear, code);

      // Remove from custom indicators
      setCustomIndicators((prev) => prev.filter((ind) => ind.code !== code));

      // Remove from year overrides if exists
      setYearOverrides((prev) => {
        const newOverrides = { ...prev };
        if (newOverrides[selectedYear] && newOverrides[selectedYear][code]) {
          delete newOverrides[selectedYear][code];
        }
        return newOverrides;
      });

      toast.success("Indicator deleted successfully");
    } catch (error) {
      if (import.meta.env.DEV) console.error("Error deleting indicator:", error);
      toast.error("Failed to delete indicator");
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with Filters and Add Button */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end justify-between">
          <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full sm:w-auto">
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
                {customIndicators.some((ind) => ind.programArea === "Custom") && (
                  <SelectItem value="Custom">Custom</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Add Indicator Button */}
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto bg-primary hover:bg-primary/90 gap-2">
                <Plus className="h-4 w-4" />
                Add New Indicator
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add New Indicator</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="code" className="text-sm font-medium">
                    Indicator Code *
                  </Label>
                  <Input
                    id="code"
                    placeholder="e.g., CUSTOM_01"
                    value={newIndicator.code}
                    onChange={(e) => setNewIndicator({ ...newIndicator, code: e.target.value.toUpperCase() })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="indicator" className="text-sm font-medium">
                    Indicator Name *
                  </Label>
                  <Input
                    id="indicator"
                    placeholder="e.g., Number of patients treated"
                    value={newIndicator.indicator}
                    onChange={(e) => setNewIndicator({ ...newIndicator, indicator: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="unit" className="text-sm font-medium">
                    Unit
                  </Label>
                  <Input
                    id="unit"
                    placeholder="e.g., # or %"
                    value={newIndicator.unit}
                    onChange={(e) => setNewIndicator({ ...newIndicator, unit: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="baseline" className="text-sm font-medium">
                      Baseline
                    </Label>
                    <Input
                      id="baseline"
                      type="number"
                      value={newIndicator.baseline}
                      onChange={(e) => setNewIndicator({ ...newIndicator, baseline: Number(e.target.value) })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="target" className="text-sm font-medium">
                      Target
                    </Label>
                    <Input
                      id="target"
                      type="number"
                      value={newIndicator.target}
                      onChange={(e) => setNewIndicator({ ...newIndicator, target: Number(e.target.value) })}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleAddIndicator}
                    className="bg-primary hover:bg-primary/90"
                  >
                    Add Indicator
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Edit Indicator Dialog */}
          <Dialog open={isEditingIndicatorDialog} onOpenChange={(open) => {
            if (!open) {
              setEditingIndicator(null);
              setIsEditingIndicatorDialog(false);
            }
          }}>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Edit Indicator</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-code" className="text-sm font-medium">
                    Indicator Code *
                  </Label>
                  <Input
                    id="edit-code"
                    placeholder="e.g., CUSTOM_01"
                    value={editIndicatorForm.code}
                    onChange={(e) => setEditIndicatorForm({ ...editIndicatorForm, code: e.target.value.toUpperCase() })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-indicator" className="text-sm font-medium">
                    Indicator Name *
                  </Label>
                  <Input
                    id="edit-indicator"
                    placeholder="e.g., Number of patients treated"
                    value={editIndicatorForm.indicator}
                    onChange={(e) => setEditIndicatorForm({ ...editIndicatorForm, indicator: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="edit-programArea" className="text-sm font-medium">
                      Program Area
                    </Label>
                    <Input
                      id="edit-programArea"
                      placeholder="e.g., Quality & Patient Safety"
                      value={editIndicatorForm.programArea}
                      onChange={(e) => setEditIndicatorForm({ ...editIndicatorForm, programArea: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-subProgram" className="text-sm font-medium">
                      Sub-program
                    </Label>
                    <Input
                      id="edit-subProgram"
                      placeholder="e.g., Patient Safety"
                      value={editIndicatorForm.subProgram}
                      onChange={(e) => setEditIndicatorForm({ ...editIndicatorForm, subProgram: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="edit-unit" className="text-sm font-medium">
                    Unit
                  </Label>
                  <Input
                    id="edit-unit"
                    placeholder="e.g., # or %"
                    value={editIndicatorForm.unit}
                    onChange={(e) => setEditIndicatorForm({ ...editIndicatorForm, unit: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="edit-baseline" className="text-sm font-medium">
                      Baseline
                    </Label>
                    <Input
                      id="edit-baseline"
                      type="number"
                      value={editIndicatorForm.baseline}
                      onChange={(e) => setEditIndicatorForm({ ...editIndicatorForm, baseline: Number(e.target.value) })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-target" className="text-sm font-medium">
                      Target
                    </Label>
                    <Input
                      id="edit-target"
                      type="number"
                      value={editIndicatorForm.target}
                      onChange={(e) => setEditIndicatorForm({ ...editIndicatorForm, target: Number(e.target.value) })}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingIndicator(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleEditIndicator}
                    className="bg-primary hover:bg-primary/90"
                  >
                    Update Indicator
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <p className="text-sm text-muted-foreground">
          Showing data for <strong>{selectedYear}</strong>. Click the edit icon to update targets and baselines.
          Baseline auto-fills from <strong>{selectedYear - 1}</strong> actual performance when editing.
        </p>
      </div>

      {/* Scrollable Table Container */}
<div className="relative w-full">
  {/* Left Gradient Shadow */}
  <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-background to-transparent pointer-events-none z-40" />

  {/* Right Gradient Shadow */}
  <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-background to-transparent pointer-events-none z-40" />

  <div
    ref={scrollContainerRef}
    className="
      rounded-xl
      border
      bg-card
      overflow-auto
      scroll-smooth
      w-full
      shadow-sm
    "
    style={{
      maxHeight: "calc(100vh - 280px)",
      scrollbarWidth: "thin",
    }}
  >
    <table
      ref={tableRef}
      className="
        w-full
        text-sm
        border-collapse
        min-w-[1500px]
      "
    >
      <thead>
        <tr className="border-b bg-muted/50 sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-background/90">
          {/* CODE */}
          <th
            className="
              sticky left-0 z-30
              bg-background
              border-r-2 border-border
              text-left
              p-3
              min-w-[110px]
              font-semibold
              shadow-sm
            "
          >
            Code
          </th>

          {/* INDICATOR */}
          <th
            className="
              sticky left-[110px]
              z-20
              bg-background
              border-r border-border
              text-left
              p-3
              min-w-[500px]
              font-semibold
              shadow-sm
            "
          >
            Indicator Name
          </th>

          <th className="table-header text-left p-3 min-w-[180px] font-semibold">
            Program Area
          </th>

          <th className="table-header text-left p-3 min-w-[180px] font-semibold">
            Sub-program
          </th>

          <th className="table-header text-center p-3 min-w-[90px] font-semibold">
            Unit
          </th>

          <th className="table-header text-right p-3 min-w-[110px] font-semibold">
            Baseline
          </th>

          <th className="table-header text-right p-3 min-w-[110px] font-semibold">
            Target
          </th>

          <th className="table-header text-right p-3 min-w-[120px] font-semibold">
            Actual (YTD)
          </th>

          <th className="table-header text-right p-3 min-w-[120px] font-semibold">
            % Achieved
          </th>

          <th className="table-header text-center p-3 min-w-[130px] font-semibold">
            Status
          </th>

          <th className="table-header text-center p-3 min-w-[150px] font-semibold">
            Actions
          </th>
        </tr>
      </thead>

      <tbody>
        {filtered.map((ind, i) => {
          const actual = getActualYTD(ind.code, monthlyData);

          const percent =
            ind.target === 0
              ? 0
              : Math.round((actual / ind.target) * 100);

          const isEditing = editingCode === ind.code;

          const isCustom = customIndicators.some(
            (ci) => ci.code === ind.code
          );

          return (
            <tr
              key={ind.code}
              className={`
                border-b
                last:border-0
                hover:bg-primary/5
                transition-colors
                ${i % 2 === 0 ? "" : "bg-muted/5"}
              `}
            >
              {/* CODE */}
              <td
                className="
                  sticky left-0 z-20
                  bg-background
                  border-r-2 border-border
                  p-3
                  font-mono
                  text-xs
                  font-semibold
                  text-primary
                  whitespace-normal
                  break-words
                  align-top
                  shadow-sm
                  min-w-[110px]
                "
              >
                {ind.code}
              </td>

              {/* INDICATOR */}
              <td
                className="
                  sticky left-[110px]
                  z-10
                  bg-background
                  border-r border-border
                  p-3
                  font-medium
                  text-sm
                  whitespace-normal
                  break-words
                  align-top
                  min-w-[500px]
                  max-w-[500px]
                "
              >
                <div className="leading-relaxed">
                  {ind.indicator}
                </div>
              </td>

              {/* PROGRAM AREA */}
              <td className="p-3 text-sm whitespace-normal break-words align-top min-w-[180px]">
                {ind.programArea}
              </td>

              {/* SUB PROGRAM */}
              <td className="p-3 text-sm text-muted-foreground whitespace-normal break-words align-top min-w-[180px]">
                {ind.subProgram}
              </td>

              {/* UNIT */}
              <td className="p-3 text-center text-sm text-muted-foreground align-top">
                {ind.unit}
              </td>

              {/* BASELINE */}
              <td className="p-3 text-right font-mono text-sm align-top">
                {isEditing ? (
                  <Input
                    type="number"
                    value={editBaseline}
                    onChange={(e) =>
                      setEditBaseline(e.target.value)
                    }
                    className="w-24 text-right font-mono ml-auto text-xs"
                  />
                ) : (
                  <span>{ind.baseline}</span>
                )}
              </td>

              {/* TARGET */}
              <td className="p-3 text-right font-mono text-sm font-semibold align-top">
                {isEditing ? (
                  <Input
                    type="number"
                    value={editTarget}
                    onChange={(e) =>
                      setEditTarget(e.target.value)
                    }
                    className="w-24 text-right font-mono ml-auto text-xs"
                  />
                ) : (
                  <span>{ind.target}</span>
                )}
              </td>

              {/* ACTUAL */}
              <td className="p-3 text-right font-mono text-sm font-semibold text-primary align-top">
                {actual}
              </td>

              {/* PERCENT */}
              <td className="p-3 text-right font-mono text-sm font-semibold text-secondary align-top">
                {percent}%
              </td>

              {/* STATUS */}
              <td className="p-3 text-center align-top">
                <StatusBadge percent={percent} />
              </td>

              {/* ACTIONS */}
              <td className="p-3 text-center align-top min-w-[150px]">
                <div className="flex items-center justify-center gap-1">
                  {isEditing ? (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 hover:bg-green-100 dark:hover:bg-green-900"
                        onClick={() => saveEdit(ind.code)}
                        title="Save changes"
                      >
                        <Save className="h-4 w-4 text-green-600" />
                      </Button>

                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 hover:bg-red-100 dark:hover:bg-red-900"
                        onClick={() => setEditingCode(null)}
                        title="Cancel editing"
                      >
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  ) : (
                    <>
                      {/* Edit Target/Baseline */}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 hover:bg-blue-100 dark:hover:bg-blue-900"
                        onClick={() => startEdit(ind)}
                        title="Edit target/baseline"
                      >
                        <Pencil className="h-4 w-4 text-blue-600" />
                      </Button>

                      {/* Edit Indicator */}
                      {isCustom && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 hover:bg-orange-100 dark:hover:bg-orange-900"
                            onClick={() =>
                              startEditIndicator(ind)
                            }
                            title="Edit indicator details"
                          >
                            <Pencil className="h-4 w-4 text-orange-600" />
                          </Button>

                          {/* Delete */}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 hover:bg-red-100 dark:hover:bg-red-900"
                            onClick={() =>
                              handleDeleteIndicator(ind.code)
                            }
                            title="Delete indicator"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
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

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {indicatorsForYear.length} indicators
      </p>
    </div>
  );
}
