import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: number;
  suffix?: string;
  variant?: "default" | "success" | "warning" | "destructive";
  className?: string;
}

export const MetricCard = ({
  title,
  value,
  icon: Icon,
  trend,
  suffix = "",
  variant = "default",
  className,
}: MetricCardProps) => {
  const variantStyles = {
    default: "border-primary/20 bg-card/50",
    success: "border-success/20 bg-success/5",
    warning: "border-warning/20 bg-warning/5",
    destructive: "border-destructive/20 bg-destructive/5",
  };

  const iconStyles = {
    default: "text-primary",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  };

  return (
    <Card className="animate-fade-in border border-border/50 transition-all hover:scale-[1.02] hover:shadow-lg bg-card/50 backdrop-blur-sm">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-3 flex-1">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-semibold tracking-tight">
                {value}{suffix}
              </p>
              {trend !== undefined && (
                <span className={cn(
                  "text-sm font-medium",
                  trend > 0 ? "text-success" : trend < 0 ? "text-destructive" : "text-muted-foreground"
                )}>
                  {trend > 0 ? "+" : ""}{trend}%
                </span>
              )}
            </div>
          </div>
          <div className={cn("rounded-lg p-3", iconStyles[variant], "bg-muted/30")}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
