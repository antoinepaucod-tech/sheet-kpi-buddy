import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, DollarSign, Users, Target, Percent, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface SummaryItem {
  label: string;
  value: string | number;
  previousValue?: number;
  currentValue?: number;
  suffix?: string;
  type?: "currency" | "number" | "percentage";
}

interface KPISummaryCardProps {
  items: SummaryItem[];
  title?: string;
}

const TrendIndicator = ({ current, previous }: { current?: number; previous?: number }) => {
  if (current === undefined || previous === undefined || previous === 0) {
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  }
  
  const percentChange = ((current - previous) / previous) * 100;
  const isPositive = percentChange > 0;
  const isNeutral = Math.abs(percentChange) < 0.5;
  
  if (isNeutral) {
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  }
  
  return (
    <div className={cn(
      "flex items-center gap-1 text-xs font-medium",
      isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
    )}>
      {isPositive ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      <span>{isPositive ? "+" : ""}{percentChange.toFixed(1)}%</span>
    </div>
  );
};

export const KPISummaryCard = ({ items, title = "Résumé du Mois" }: KPISummaryCardProps) => {
  return (
    <Card className="bg-gradient-to-br from-primary/5 via-background to-primary/10 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {items.map((item, index) => {
            const isCoachItem = item.label === "Coachs";
            const isMemberItem = item.label === "Membres";
            
            return (
              <div key={index} className="space-y-1">
                <p className={cn(
                  "text-xs truncate flex items-center gap-1",
                  isCoachItem ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground"
                )}>
                  {isCoachItem && <Activity className="h-3 w-3" />}
                  {isMemberItem && <Users className="h-3 w-3" />}
                  {item.label}
                </p>
                <div className="flex items-baseline gap-2">
                  <span className={cn(
                    "text-lg font-bold",
                    isCoachItem && "text-amber-600 dark:text-amber-400"
                  )}>
                    {item.value}{item.suffix}
                  </span>
                  <TrendIndicator current={item.currentValue} previous={item.previousValue} />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
