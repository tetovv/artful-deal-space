import { BarChart3, LineChart, AreaChart, PieChart } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChartType = "area" | "bar" | "line";

const CHART_TYPES: { type: ChartType; icon: React.ElementType; label: string }[] = [
  { type: "area", icon: AreaChart, label: "Область" },
  { type: "bar", icon: BarChart3, label: "Столбцы" },
  { type: "line", icon: LineChart, label: "Линия" },
];

interface ChartTypeSelectorProps {
  value: ChartType;
  onChange: (type: ChartType) => void;
  className?: string;
}

export function ChartTypeSelector({ value, onChange, className }: ChartTypeSelectorProps) {
  return (
    <div className={cn("flex items-center gap-0.5 bg-muted rounded-lg p-0.5", className)}>
      {CHART_TYPES.map((ct) => (
        <button
          key={ct.type}
          onClick={() => onChange(ct.type)}
          title={ct.label}
          className={cn(
            "h-7 w-7 rounded-md flex items-center justify-center transition-all",
            value === ct.type
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <ct.icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
