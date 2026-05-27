import { AlertCircle, Database } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyDataStateProps {
  type: "indicator" | "department" | "period";
  period?: string;
  name?: string;
  showActionButton?: boolean;
  onRetry?: () => void;
}

export function EmptyDataState({ type, period, name, showActionButton = false, onRetry }: EmptyDataStateProps) {
  const getMessage = (): { title: string; description: string } => {
    const periodText = period ? ` for the selected ${period}` : "";
    const nameText = name ? ` (${name})` : "";

    switch (type) {
      case "indicator":
        return {
          title: "No Entry Recorded",
          description: `Data entry has not been completed for this indicator${periodText}. Please submit the required data to proceed with analysis.`,
        };
      case "department":
        return {
          title: "Insufficient Department Data",
          description: `Data submission is incomplete for this department${nameText}${periodText}. Please ensure all required indicators have entries before generating feedback.`,
        };
      case "period":
        return {
          title: "No Data Available",
          description: `No data has been recorded for the selected ${period || "timeframe"}${periodText}. Please select a different period or ensure data entry is completed.`,
        };
      default:
        return { title: "No Data Available", description: "Please submit the required data." };
    }
  };

  const { title, description } = getMessage();

  return (
    <div className="rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 p-8 text-center">
      <div className="flex justify-center mb-4">
        <div className="rounded-full bg-muted p-4">
          <Database className="h-8 w-8 text-muted-foreground" />
        </div>
      </div>

      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto leading-relaxed">{description}</p>

      {showActionButton && onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-1">
          <AlertCircle className="h-3.5 w-3.5" />
          Refresh Data
        </Button>
      )}

      <div className="mt-6 p-3 rounded-lg bg-background/50 border border-muted">
        <p className="text-xs text-muted-foreground font-mono">
          💡 Tip: Check that all data entries are submitted before proceeding with analysis.
        </p>
      </div>
    </div>
  );
}
