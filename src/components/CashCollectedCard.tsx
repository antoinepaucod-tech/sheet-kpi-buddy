import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Wallet, TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import { parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import type { Member } from "@/hooks/useCustomerMembers";

interface CashCollectedCardProps {
  members: Member[];
  selectedYear: number | "all";
  selectedMonth: number | "all";
  isCoachMembership: (membership: string) => boolean;
}

interface CategoryBreakdown {
  name: string;
  amount: number;
}

export const CashCollectedCard = ({ 
  members, 
  selectedYear, 
  selectedMonth,
  isCoachMembership 
}: CashCollectedCardProps) => {
  
  const { currentPeriodCash, previousPeriodCash, categoryBreakdown, periodLabel, newMembersCount } = useMemo(() => {
    const today = new Date();
    
    const targetYear = selectedYear === "all" ? today.getFullYear() : selectedYear;
    const targetMonth = selectedMonth === "all" ? today.getMonth() : selectedMonth;
    
    let prevYear = targetYear;
    let prevMonth = targetMonth - 1;
    if (prevMonth < 0) {
      prevMonth = 11;
      prevYear = targetYear - 1;
    }
    
    const filterByPeriod = (member: Member, year: number, month: number, isAllYear: boolean) => {
      if (!member.contract_signed_date) return false;
      if (!member.is_primary_subscriber) return false;
      if (isCoachMembership(member.membership)) return false;
      
      const contractDate = parseISO(member.contract_signed_date);
      const contractYear = contractDate.getFullYear();
      const contractMonth = contractDate.getMonth();
      
      if (isAllYear) {
        return contractYear === year;
      }
      return contractYear === year && contractMonth === month;
    };
    
    const isAllYear = selectedYear !== "all" && selectedMonth === "all";
    const useCurrentMonth = selectedYear === "all" && selectedMonth === "all";
    
    const effectiveYear = useCurrentMonth ? today.getFullYear() : targetYear;
    const effectiveMonth = useCurrentMonth ? today.getMonth() : targetMonth;
    
    const currentPeriodMembers = members.filter(m => 
      filterByPeriod(m, effectiveYear, effectiveMonth, isAllYear)
    );
    
    const previousPeriodMembers = members.filter(m => 
      filterByPeriod(m, isAllYear ? prevYear : prevYear, isAllYear ? prevYear : prevMonth, isAllYear)
    );
    
    const currentCash = currentPeriodMembers.reduce((sum, m) => sum + (m.cash_collected || 0), 0);
    const previousCash = previousPeriodMembers.reduce((sum, m) => sum + (m.cash_collected || 0), 0);
    
    // Category breakdown
    const categoryMap = new Map<string, number>();
    currentPeriodMembers.forEach(member => {
      const existing = categoryMap.get(member.membership) || 0;
      categoryMap.set(member.membership, existing + (member.cash_collected || 0));
    });
    
    const breakdown: CategoryBreakdown[] = Array.from(categoryMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .filter(cat => cat.amount > 0)
      .sort((a, b) => b.amount - a.amount);
    
    // Period label
    const monthNames = [
      "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
      "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
    ];
    
    let label = "";
    if (useCurrentMonth) {
      label = `${monthNames[today.getMonth()]} ${today.getFullYear()}`;
    } else if (isAllYear) {
      label = `${targetYear}`;
    } else {
      label = `${monthNames[targetMonth]} ${targetYear}`;
    }
    
    return {
      currentPeriodCash: currentCash,
      previousPeriodCash: previousCash,
      categoryBreakdown: breakdown,
      periodLabel: label,
      newMembersCount: currentPeriodMembers.length
    };
  }, [members, selectedYear, selectedMonth, isCoachMembership]);
  
  // Trend calculation
  const trendPercent = previousPeriodCash > 0 
    ? ((currentPeriodCash - previousPeriodCash) / previousPeriodCash) * 100 
    : 0;
  const isPositive = trendPercent > 0;
  const showTrend = previousPeriodCash > 0 && Math.abs(trendPercent) >= 0.5;
  
  return (
    <Card className="p-4 bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
      <div className="space-y-3">
        {/* Header with icon and period badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-green-500/20">
              <Wallet className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Cash Collecté</span>
          </div>
          <Badge variant="secondary" className="text-xs">
            {periodLabel}
          </Badge>
        </div>
        
        {/* Main value with trend */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">
              {currentPeriodCash.toLocaleString()}
              <span className="text-lg font-medium ml-1">CHF</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {newMembersCount} nouveau{newMembersCount > 1 ? "x" : ""} membre{newMembersCount > 1 ? "s" : ""}
            </p>
          </div>
          
          {showTrend && (
            <div className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
              isPositive 
                ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
                : "bg-rose-500/20 text-rose-600 dark:text-rose-400"
            )}>
              {isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>{isPositive ? "+" : ""}{trendPercent.toFixed(0)}%</span>
            </div>
          )}
        </div>
        
        {/* Category breakdown - top 3 */}
        {categoryBreakdown.length > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="pt-2 border-t border-border/50 cursor-help">
                  <div className="flex items-center gap-1 mb-2">
                    <span className="text-xs text-muted-foreground">Répartition</span>
                    <Info className="h-3 w-3 text-muted-foreground/50" />
                  </div>
                  <div className="space-y-1.5">
                    {categoryBreakdown.slice(0, 3).map((cat) => (
                      <div key={cat.name} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground truncate max-w-[140px]">{cat.name}</span>
                        <span className="font-medium">{cat.amount.toLocaleString()} CHF</span>
                      </div>
                    ))}
                    {categoryBreakdown.length > 3 && (
                      <p className="text-xs text-muted-foreground/70">
                        +{categoryBreakdown.length - 3} autre{categoryBreakdown.length - 3 > 1 ? "s" : ""}...
                      </p>
                    )}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <div className="space-y-2">
                  <p className="font-medium">Toutes les catégories</p>
                  <div className="space-y-1">
                    {categoryBreakdown.map((cat) => (
                      <div key={cat.name} className="flex justify-between gap-4 text-sm">
                        <span className="truncate">{cat.name}</span>
                        <span className="font-medium">{cat.amount.toLocaleString()} CHF</span>
                      </div>
                    ))}
                  </div>
                  {previousPeriodCash > 0 && (
                    <p className="text-xs text-muted-foreground border-t pt-2 mt-2">
                      Période précédente : {previousPeriodCash.toLocaleString()} CHF
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </Card>
  );
};
