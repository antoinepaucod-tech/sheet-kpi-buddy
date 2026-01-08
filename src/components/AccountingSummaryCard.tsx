import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, Receipt, PiggyBank } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccountingSummaryCardProps {
  totalRevenue: number;
  totalRevenueReceived: number;
  totalExpenses: number;
  profit: number;
  unpaidCount: number;
}

export const AccountingSummaryCard = ({
  totalRevenue,
  totalRevenueReceived,
  totalExpenses,
  profit,
  unpaidCount,
}: AccountingSummaryCardProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-CH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 animate-fade-in">
      {/* Revenus Attendus */}
      <Card className="border-l-4 border-l-blue-500 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Receipt className="h-4 w-4" />
            <span>Revenus attendus</span>
          </div>
          <p className="text-xl font-bold text-foreground">
            {formatCurrency(totalRevenue)} <span className="text-xs font-normal text-muted-foreground">CHF</span>
          </p>
        </CardContent>
      </Card>

      {/* Revenus Encaissés */}
      <Card className="border-l-4 border-l-emerald-500 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Wallet className="h-4 w-4" />
            <span>Encaissé</span>
          </div>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(totalRevenueReceived)} <span className="text-xs font-normal text-muted-foreground">CHF</span>
          </p>
        </CardContent>
      </Card>

      {/* Dépenses */}
      <Card className="border-l-4 border-l-orange-500 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <TrendingDown className="h-4 w-4" />
            <span>Dépenses</span>
          </div>
          <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
            {formatCurrency(totalExpenses)} <span className="text-xs font-normal text-muted-foreground">CHF</span>
          </p>
        </CardContent>
      </Card>

      {/* Solde/Profit */}
      <Card className={cn(
        "border-l-4 bg-card/50 backdrop-blur-sm",
        profit >= 0 ? "border-l-green-500" : "border-l-red-500"
      )}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <PiggyBank className="h-4 w-4" />
            <span>Solde</span>
          </div>
          <p className={cn(
            "text-xl font-bold",
            profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          )}>
            {profit >= 0 ? "+" : ""}{formatCurrency(profit)} <span className="text-xs font-normal text-muted-foreground">CHF</span>
          </p>
        </CardContent>
      </Card>

      {/* Impayés */}
      <Card className={cn(
        "border-l-4 bg-card/50 backdrop-blur-sm",
        unpaidCount > 0 ? "border-l-red-500" : "border-l-green-500"
      )}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <TrendingUp className="h-4 w-4" />
            <span>Impayés</span>
          </div>
          <p className={cn(
            "text-xl font-bold",
            unpaidCount > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
          )}>
            {unpaidCount} <span className="text-xs font-normal text-muted-foreground">transactions</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
