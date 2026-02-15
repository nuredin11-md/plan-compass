import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle, AlertTriangle, XCircle, Clock } from "lucide-react";
import { type MonthlyEntry } from "@/data/hospitalIndicators";

interface Props {
  monthlyData: MonthlyEntry[];
}

const dimensions = [
  { label: "Completeness", icon: CheckCircle, score: null, color: "text-success", bg: "bg-success/10" },
  { label: "Consistency", icon: AlertTriangle, score: null, color: "text-warning", bg: "bg-warning/10" },
  { label: "Accuracy", icon: XCircle, score: null, color: "text-destructive", bg: "bg-destructive/10" },
  { label: "Timeliness", icon: Clock, score: null, color: "text-info", bg: "bg-info/10" },
];

export default function DataQualityTab({ monthlyData }: Props) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Data Quality Analysis</h1>
        <p className="text-muted-foreground">AI-powered analysis of your health data quality.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {dimensions.map((d) => (
          <Card key={d.label} className="glass-card text-center">
            <CardContent className="pt-6">
              <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg ${d.bg}`}>
                <d.icon className={`h-6 w-6 ${d.color}`} />
              </div>
              <p className="text-sm font-medium">{d.label}</p>
              <p className="mt-1 text-2xl font-bold">{d.score ?? "—"}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Analysis Results</CardTitle>
          <CardDescription>Upload data first to run AI-powered quality analysis.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No analysis results available. Upload a dataset and run analysis to see findings.</p>
        </CardContent>
      </Card>
    </div>
  );
}
