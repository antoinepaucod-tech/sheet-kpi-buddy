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
      <CardContent className="p-3 sm:p-6">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-2 sm:space-y-3 flex-1 min-w-0">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider truncate">{title}</p>
            <div className="flex items-baseline gap-1 sm:gap-2 flex-wrap">
              <p className="text-xl sm:text-3xl font-semibold tracking-tight">
                {typeof value === 'string' && value.startsWith('CHF') ? (
                  <>
                    <span className="text-xs sm:text-sm font-normal text-muted-foreground mr-1">CHF</span>
                    {value.replace('CHF ', '')}
                  </>
                ) : (
                  value
                )}
                {suffix}
              </p>
              {trend !== undefined && (
                <span className={cn(
                  "text-xs sm:text-sm font-medium whitespace-nowrap",
                  trend > 0 ? "text-success" : trend < 0 ? "text-destructive" : "text-muted-foreground"
                )}>
                  {trend > 0 ? "+" : ""}{trend}%
                </span>
              )}
            </div>
          </div>
          <div className={cn("rounded-lg p-2 sm:p-3 flex-shrink-0", iconStyles[variant], "bg-muted/30")}>
            <Icon className="h-4 w-4 sm:h-6 sm:w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
