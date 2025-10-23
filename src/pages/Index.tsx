import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useKPIData } from "@/hooks/useKPIData";
import { MetricCard } from "@/components/MetricCard";
import { KPIChart } from "@/components/KPIChart";
import { DataInputDialog } from "@/components/DataInputDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  Users,
  TrendingUp,
  Target,
  ChevronLeft,
  ChevronRight,
  Activity,
  Percent,
  Calendar,
} from "lucide-react";
import { MONTHS } from "@/types/kpi";

const Index = () => {
  const navigate = useNavigate();
  const { kpiData, currentMonthIndex, setCurrentMonthIndex, updateKPI, getCurrentMonthData } = useKPIData();
  const currentMonth = getCurrentMonthData();

  const goToPreviousMonth = () => {
    setCurrentMonthIndex((prev) => (prev === 0 ? 11 : prev - 1));
  };

  const goToNextMonth = () => {
    setCurrentMonthIndex((prev) => (prev === 11 ? 0 : prev + 1));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  Tableau de Bord KPI
                </h1>
                <p className="text-muted-foreground mt-1">Suivi de performance mensuel</p>
              </div>
              <Button variant="outline" onClick={() => navigate('/weekly')}>
                📅 Vue Hebdomadaire
              </Button>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToPreviousMonth}
                  className="h-8 w-8"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-2 px-4">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="font-semibold min-w-[100px] text-center">
                    {MONTHS[currentMonthIndex]}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToNextMonth}
                  className="h-8 w-8"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <DataInputDialog
                monthData={currentMonth}
                monthName={MONTHS[currentMonthIndex]}
                onSave={(data) => updateKPI(currentMonthIndex, data)}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Key Metrics */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Métriques Clés</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Revenu Total"
              value={formatCurrency(currentMonth.totalRevenue)}
              icon={DollarSign}
              variant="default"
            />
            <MetricCard
              title="Profit"
              value={formatCurrency(currentMonth.profit)}
              icon={TrendingUp}
              variant={currentMonth.profit > 0 ? "success" : "destructive"}
              suffix={` (${currentMonth.profitPercentage}%)`}
            />
            <MetricCard
              title="Membres Actifs"
              value={currentMonth.recurringGeneralMembers + currentMonth.pifMembers}
              icon={Users}
              variant="default"
            />
            <MetricCard
              title="Taux de Conversion"
              value={currentMonth.closePercentage}
              icon={Target}
              suffix="%"
              variant={currentMonth.closePercentage > 50 ? "success" : "warning"}
            />
          </div>
        </section>

        {/* Revenue & Expenses Chart */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <KPIChart
            data={kpiData}
            title="Évolution du Revenu"
            type="line"
            dataKeys={[
              { key: 'totalRevenue', name: 'Revenu Total', color: 'hsl(var(--primary))' },
              { key: 'profit', name: 'Profit', color: 'hsl(var(--success))' },
            ]}
          />
          <KPIChart
            data={kpiData}
            title="Dépenses Mensuelles"
            type="bar"
            dataKeys={[
              { key: 'totalExpenses', name: 'Dépenses Totales', color: 'hsl(var(--destructive))' },
              { key: 'adSpend', name: 'Publicité', color: 'hsl(var(--warning))' },
            ]}
          />
        </section>

        {/* Sales Funnel */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Entonnoir de Vente</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <MetricCard
              title="Leads"
              value={currentMonth.leads}
              icon={Activity}
              variant="default"
            />
            <MetricCard
              title="Scheduled"
              value={currentMonth.scheduled}
              icon={Calendar}
              suffix={` (${currentMonth.schedPercentage}%)`}
              variant="default"
            />
            <MetricCard
              title="Show"
              value={currentMonth.show}
              icon={Target}
              suffix={` (${currentMonth.showPercentage}%)`}
              variant="default"
            />
            <MetricCard
              title="Close"
              value={currentMonth.close}
              icon={TrendingUp}
              suffix={` (${currentMonth.closePercentage}%)`}
              variant={currentMonth.closePercentage > 30 ? "success" : "warning"}
            />
            <MetricCard
              title="Avg Par Vente"
              value={formatCurrency(currentMonth.avgPerSale)}
              icon={DollarSign}
              variant="success"
            />
          </div>
        </section>

        {/* Members Chart */}
        <section>
          <KPIChart
            data={kpiData}
            title="Évolution des Membres"
            type="line"
            dataKeys={[
              { key: 'recurringGeneralMembers', name: 'Membres Généraux', color: 'hsl(var(--chart-1))' },
              { key: 'ptMembers', name: 'Membres PT', color: 'hsl(var(--chart-2))' },
              { key: 'pifMembers', name: 'Membres PIF', color: 'hsl(var(--chart-3))' },
            ]}
          />
        </section>

        {/* Additional Metrics */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Métriques Additionnelles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Classes Totales"
              value={currentMonth.totalClasses}
              icon={Activity}
              variant="default"
            />
            <MetricCard
              title="RoAds"
              value={currentMonth.roAds.toFixed(2)}
              icon={TrendingUp}
              suffix="x"
              variant={currentMonth.roAds > 2 ? "success" : "warning"}
            />
            <MetricCard
              title="CPL"
              value={formatCurrency(currentMonth.cpl)}
              icon={DollarSign}
              variant="default"
            />
            <MetricCard
              title="CAC"
              value={formatCurrency(currentMonth.cac)}
              icon={Target}
              variant="default"
            />
          </div>
        </section>

        {/* Sales Performance Chart */}
        <section>
          <KPIChart
            data={kpiData}
            title="Performance des Ventes"
            type="bar"
            dataKeys={[
              { key: 'leads', name: 'Leads', color: 'hsl(var(--chart-1))' },
              { key: 'scheduled', name: 'Scheduled', color: 'hsl(var(--chart-2))' },
              { key: 'show', name: 'Show', color: 'hsl(var(--chart-3))' },
              { key: 'close', name: 'Close', color: 'hsl(var(--success))' },
            ]}
          />
        </section>
      </main>
    </div>
  );
};

export default Index;
