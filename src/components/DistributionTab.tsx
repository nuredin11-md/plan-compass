import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDown, Printer, AlertCircle, ShieldCheck } from "lucide-react";
import { type MonthlyEntry, indicators, getActualYTD, getStatus, getProgramAreas } from "@/data/hospitalIndicators";
import { toast } from "sonner";

interface Props {
  monthlyData: MonthlyEntry[];
}

export default function DistributionTab({ monthlyData }: Props) {
  const [loading, setLoading] = useState(false);

  const generateKPISummary = () => {
    let onTrack = 0, atRisk = 0, offTrack = 0;
    indicators.forEach((ind) => {
      const actual = getActualYTD(ind.code, monthlyData);
      const percent = ind.target === 0 ? 0 : Math.round((actual / ind.target) * 100);
      const s = getStatus(percent);
      if (s === "green") onTrack++;
      else if (s === "yellow") atRisk++;
      else offTrack++;
    });
    return { onTrack, atRisk, offTrack, total: indicators.length };
  };

  const areas = getProgramAreas();

  const deptBreakdown = areas.map((area) => {
    const areaInds = indicators.filter((i) => i.programArea === area);
    let green = 0, yellow = 0, red = 0;
    areaInds.forEach((ind) => {
      const actual = getActualYTD(ind.code, monthlyData);
      const percent = ind.target === 0 ? 0 : Math.round((actual / ind.target) * 100);
      const s = getStatus(percent);
      if (s === "green") green++;
      else if (s === "yellow") yellow++;
      else red++;
    });
    return { area, total: areaInds.length, onTrack: green, atRisk: yellow, offTrack: red };
  });

  const handlePrint = () => {
    setLoading(true);
    setTimeout(() => {
      window.print();
      setLoading(false);
      toast.success("Print dialog opened");
    }, 300);
  };

  const kpi = generateKPISummary();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Report Distribution</h1>
        <p className="text-muted-foreground">View and print KPI summary reports for internal use.</p>
      </div>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Internal Use Only</strong> — Report data is confidential and must not be shared via social media or external channels. Use the print option for authorized distribution only.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            Current KPI Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{kpi.onTrack}</p>
              <p className="text-xs text-muted-foreground">On Track</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">{kpi.atRisk}</p>
              <p className="text-xs text-muted-foreground">At Risk</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{kpi.offTrack}</p>
              <p className="text-xs text-muted-foreground">Off Track</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Department Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Department Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Department</th>
                  <th className="text-center p-3 font-medium">Total</th>
                  <th className="text-center p-3 font-medium">On Track</th>
                  <th className="text-center p-3 font-medium">At Risk</th>
                  <th className="text-center p-3 font-medium">Off Track</th>
                </tr>
              </thead>
              <tbody>
                {deptBreakdown.map((d, i) => (
                  <tr key={d.area} className={`border-b last:border-0 ${i % 2 !== 0 ? "bg-muted/10" : ""}`}>
                    <td className="p-3 font-medium">{d.area}</td>
                    <td className="p-3 text-center font-mono">{d.total}</td>
                    <td className="p-3 text-center"><span className="status-badge-green">{d.onTrack}</span></td>
                    <td className="p-3 text-center"><span className="status-badge-yellow">{d.atRisk}</span></td>
                    <td className="p-3 text-center"><span className="status-badge-red">{d.offTrack}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Print Only */}
      <div className="flex gap-3">
        <Button onClick={handlePrint} disabled={loading} className="gap-2">
          <Printer className="h-4 w-4" />
          Print Report
        </Button>
      </div>
    </div>
  );
}
