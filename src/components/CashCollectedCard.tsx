import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Wallet, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  color: string;
}

export const CashCollectedCard = ({ 
  members, 
  selectedYear, 
  selectedMonth,
  isCoachMembership 
}: CashCollectedCardProps) => {
  
  const { currentPeriodCash, previousPeriodCash, categoryBreakdown, periodLabel } = useMemo(() => {
    const today = new Date();
    
    // Determine the period to calculate
    const targetYear = selectedYear === "all" ? today.getFullYear() : selectedYear;
    const targetMonth = selectedMonth === "all" ? today.getMonth() : selectedMonth;
    
    // Previous period
    let prevYear = targetYear;
    let prevMonth = targetMonth - 1;
    if (prevMonth < 0) {
      prevMonth = 11;
      prevYear = targetYear - 1;
    }
    
    // Filter members for current period (contract_signed_date in selected month/year)
    const currentPeriodMembers = members.filter(member => {
      if (!member.contract_signed_date) return false;
      if (!member.is_primary_subscriber) return false;
      if (isCoachMembership(member.membership)) return false;
      
      const contractDate = parseISO(member.contract_signed_date);
      const contractYear = contractDate.getFullYear();
      const contractMonth = contractDate.getMonth();
      
      if (selectedYear === "all" && selectedMonth === "all") {
        // Show current month only
        return contractYear === today.getFullYear() && contractMonth === today.getMonth();
      }
      
      if (selectedYear !== "all" && selectedMonth === "all") {
        // Show full year
        return contractYear === targetYear;
      }
      
      return contractYear === targetYear && contractMonth === targetMonth;
    });
    
    // Filter members for previous period
    const previousPeriodMembers = members.filter(member => {
      if (!member.contract_signed_date) return false;
      if (!member.is_primary_subscriber) return false;
      if (isCoachMembership(member.membership)) return false;
      
      const contractDate = parseISO(member.contract_signed_date);
      const contractYear = contractDate.getFullYear();
      const contractMonth = contractDate.getMonth();
      
      if (selectedYear === "all" && selectedMonth === "all") {
        // Previous month
        return contractYear === prevYear && contractMonth === prevMonth;
      }
      
      if (selectedYear !== "all" && selectedMonth === "all") {
        // Previous year
        return contractYear === prevYear;
      }
      
      return contractYear === prevYear && contractMonth === prevMonth;
    });
    
    // Calculate totals
    const currentCash = currentPeriodMembers.reduce((sum, m) => sum + (m.cash_collected || 0), 0);
    const previousCash = previousPeriodMembers.reduce((sum, m) => sum + (m.cash_collected || 0), 0);
    
    // Category breakdown
    const categoryMap = new Map<string, number>();
    currentPeriodMembers.forEach(member => {
      const existing = categoryMap.get(member.membership) || 0;
      categoryMap.set(member.membership, existing + (member.cash_collected || 0));
    });
    
    // Color mapping for categories
    const colorMap: Record<string, string> = {
      "UNLIMITED ACCESS": "bg-blue-500",
      "UNLIMITED ACCESS DUO": "bg-blue-400",
      "OPEN GYM": "bg-emerald-500",
      "HYBRID MATIN": "bg-green-500",
      "PACK 20": "bg-purple-500",
      "6 WEEKS CHALLENGE": "bg-red-500",
      "PT": "bg-amber-500",
    };
    
    const breakdown: CategoryBreakdown[] = Array.from(categoryMap.entries())
      .map(([name, amount]) => ({
        name,
        amount,
        color: Object.entries(colorMap).find(([key]) => 
          name.toUpperCase().includes(key)
        )?.[1] || "bg-gray-500"
      }))
      .sort((a, b) => b.amount - a.amount);
    
    // Period label
    const monthNames = [
      "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
      "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
    ];
    
    let label = "";
    if (selectedYear === "all" && selectedMonth === "all") {
      label = `${monthNames[today.getMonth()]} ${today.getFullYear()}`;
    } else if (selectedYear !== "all" && selectedMonth === "all") {
      label = `Année ${targetYear}`;
    } else {
      label = `${monthNames[targetMonth]} ${targetYear}`;
    }
    
    return {
      currentPeriodCash: currentCash,
      previousPeriodCash: previousCash,
      categoryBreakdown: breakdown,
      periodLabel: label
    };
  }, [members, selectedYear, selectedMonth, isCoachMembership]);
  
  // Calculate trend
  const trendPercent = previousPeriodCash > 0 
    ? ((currentPeriodCash - previousPeriodCash) / previousPeriodCash) * 100 
    : 0;
  const isPositive = trendPercent > 0;
  const isNeutral = Math.abs(trendPercent) < 0.5 || previousPeriodCash === 0;
  
  // Calculate total for percentage bars
  const totalForBars = categoryBreakdown.reduce((sum, cat) => sum + cat.amount, 0);
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card className="p-4 bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20 cursor-help">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <Wallet className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground truncate">Cash Collecté</p>
                  <span className="text-xs text-muted-foreground/70 truncate">({periodLabel})</span>
                </div>
                
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {currentPeriodCash.toLocaleString()} CHF
                  </p>
                  
                  {/* Trend indicator */}
                  {!isNeutral && (
                    <div className={cn(
                      "flex items-center gap-0.5 text-xs font-medium",
                      isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                    )}>
                      {isPositive ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      <span>{isPositive ? "+" : ""}{trendPercent.toFixed(0)}%</span>
                    </div>
                  )}
                  {isNeutral && previousPeriodCash > 0 && (
                    <Minus className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
                
                {/* Category breakdown bars */}
                {categoryBreakdown.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {categoryBreakdown.slice(0, 3).map((cat) => (
                      <div key={cat.name} className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={cn("h-full rounded-full", cat.color)}
                            style={{ width: `${totalForBars > 0 ? (cat.amount / totalForBars) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground truncate max-w-[60px]">
                          {cat.amount.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2">
            <p className="font-medium">Répartition par catégorie</p>
            {categoryBreakdown.length > 0 ? (
              <div className="space-y-1">
                {categoryBreakdown.map((cat) => (
                  <div key={cat.name} className="flex justify-between gap-4 text-sm">
                    <span className="truncate">{cat.name}</span>
                    <span className="font-medium">{cat.amount.toLocaleString()} CHF</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune donnée pour cette période</p>
            )}
            {previousPeriodCash > 0 && (
              <p className="text-xs text-muted-foreground border-t pt-2 mt-2">
                Période précédente : {previousPeriodCash.toLocaleString()} CHF
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
