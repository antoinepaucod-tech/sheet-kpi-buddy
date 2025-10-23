import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMonthlyKPIData } from "@/hooks/useMonthlyKPIData";
import { MetricCard } from "@/components/MetricCard";
import { KPIChart } from "@/components/KPIChart";
import { ThemeToggle } from "@/components/ThemeToggle";
import { VideoBackground } from "@/components/VideoBackground";
import { VideoSettings } from "@/components/VideoSettings";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  Users,
  TrendingUp,
  Target,
  ChevronLeft,
  ChevronRight,
  Activity,
  Calendar,
} from "lucide-react";
import { MONTHS } from "@/types/kpi";

const Index = () => {
  const navigate = useNavigate();
  const { 
    monthlyData, 
    currentMonthIndex, 
    setCurrentMonthIndex, 
    getCurrentMonthData,
    isLoading 
  } = useMonthlyKPIData();
  
  const currentMonth = getCurrentMonthData() || monthlyData[currentMonthIndex];
  
  const [videoConfig, setVideoConfig] = useState(() => {
    const saved = localStorage.getItem("video-config");
    return saved ? JSON.parse(saved) : { url: "", overlayOpacity: 0.7, enabled: false };
  });

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Chargement des données...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-md sticky top-0 z-10">
        <VideoBackground 
          videoUrl="/videos/fitness-background.mp4"
          overlayOpacity={0.4}
        >
          <div className="container mx-auto px-6 py-6">
            <div className="flex items-center justify-between gap-8">
              <div className="flex-1">
                <h1 className="text-4xl font-semibold tracking-tight text-display mb-2">
                  TABLEAU DE BORD KPI
                </h1>
                <p className="text-muted-foreground text-sm tracking-wide">
                  Suivi de performance mensuel
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <VideoSettings onConfigChange={setVideoConfig} />
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/weekly')}
                  className="whitespace-nowrap border-foreground/20 hover:bg-foreground/5"
                >
                  Vue Hebdomadaire
                </Button>
                <ThemeToggle />
              </div>
            </div>
            
            <div className="flex items-center justify-center gap-3 mt-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={goToPreviousMonth}
                className="h-10 w-10 hover:bg-foreground/5"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3 px-6 py-2 bg-muted/50 rounded-lg min-w-[180px] justify-center">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-lg tracking-wide">
                  {MONTHS[currentMonthIndex].toUpperCase()}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={goToNextMonth}
                className="h-10 w-10 hover:bg-foreground/5"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </VideoBackground>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8 space-y-10">
        {/* Key Metrics */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-medium text-heading tracking-tight">Métriques Clés</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Revenu Total"
              value={formatCurrency(currentMonth?.total_revenue || 0)}
              icon={DollarSign}
              variant="default"
            />
            <MetricCard
              title="Profit"
              value={formatCurrency(currentMonth?.profit || 0)}
              icon={TrendingUp}
              variant={(currentMonth?.profit || 0) > 0 ? "success" : "destructive"}
              suffix={currentMonth?.total_revenue && currentMonth.total_revenue > 0 
                ? ` (${Math.round((currentMonth.profit / currentMonth.total_revenue) * 100)}%)` 
                : ''}
            />
            <MetricCard
              title="Membres Actifs"
              value={(currentMonth?.recurring_general_members || 0) + (currentMonth?.pif_members || 0)}
              icon={Users}
              variant="default"
            />
            <MetricCard
              title="Taux de Conversion"
              value={currentMonth?.show && currentMonth.show > 0 
                ? Math.round((currentMonth.close / currentMonth.show) * 100) 
                : 0}
              icon={Target}
              suffix="%"
              variant={(currentMonth?.show && currentMonth.show > 0 
                ? Math.round((currentMonth.close / currentMonth.show) * 100) 
                : 0) > 50 ? "success" : "warning"}
            />
          </div>
        </section>

        {/* Revenue & Expenses Chart */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <KPIChart
            data={monthlyData.map(m => ({
              month: m.month_name,
              totalRevenue: m.total_revenue,
              profit: m.profit,
            }))}
            title="Évolution du Revenu"
            type="line"
            dataKeys={[
              { key: 'totalRevenue', name: 'Revenu Total', color: 'hsl(var(--chart-1))' },
              { key: 'profit', name: 'Profit', color: 'hsl(var(--success))' },
            ]}
          />
          <KPIChart
            data={monthlyData.map(m => ({
              month: m.month_name,
              totalExpenses: m.total_expenses,
              adSpend: m.ad_spend,
            }))}
            title="Dépenses Mensuelles"
            type="bar"
            dataKeys={[
              { key: 'totalExpenses', name: 'Dépenses Totales', color: 'hsl(var(--destructive))' },
              { key: 'adSpend', name: 'Publicité', color: 'hsl(var(--warning))' },
            ]}
          />
        </section>

        {/* Sales Funnel */}
        <section className="space-y-6">
          <h2 className="text-2xl font-medium text-heading tracking-tight">Entonnoir de Vente</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <MetricCard
              title="Leads"
              value={currentMonth?.leads || 0}
              icon={Activity}
              variant="default"
            />
            <MetricCard
              title="Scheduled"
              value={currentMonth?.scheduled || 0}
              icon={Calendar}
              suffix={currentMonth?.leads && currentMonth.leads > 0 
                ? ` (${Math.round((currentMonth.scheduled / currentMonth.leads) * 100)}%)` 
                : ''}
              variant="default"
            />
            <MetricCard
              title="Show"
              value={currentMonth?.show || 0}
              icon={Target}
              suffix={currentMonth?.scheduled && currentMonth.scheduled > 0 
                ? ` (${Math.round((currentMonth.show / currentMonth.scheduled) * 100)}%)` 
                : ''}
              variant="default"
            />
            <MetricCard
              title="Close"
              value={currentMonth?.close || 0}
              icon={TrendingUp}
              suffix={currentMonth?.show && currentMonth.show > 0 
                ? ` (${Math.round((currentMonth.close / currentMonth.show) * 100)}%)` 
                : ''}
              variant={(currentMonth?.show && currentMonth.show > 0 
                ? Math.round((currentMonth.close / currentMonth.show) * 100) 
                : 0) > 30 ? "success" : "warning"}
            />
            <MetricCard
              title="Avg Par Vente"
              value={formatCurrency(currentMonth?.close && currentMonth.close > 0 
                ? currentMonth.cash_collected / currentMonth.close 
                : 0)}
              icon={DollarSign}
              variant="success"
            />
          </div>
        </section>

        {/* Members Chart */}
        <section>
          <KPIChart
            data={monthlyData.map(m => ({
              month: m.month_name,
              recurringGeneralMembers: m.recurring_general_members,
              ptMembers: m.pt_members,
              pifMembers: m.pif_members,
            }))}
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
        <section className="space-y-6">
          <h2 className="text-2xl font-medium text-heading tracking-tight">Métriques Additionnelles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <MetricCard
              title="Classes Totales"
              value={currentMonth?.total_classes || 0}
              icon={Activity}
              variant="default"
            />
            <MetricCard
              title="CAC"
              value={formatCurrency(currentMonth?.close && currentMonth.close > 0 && currentMonth?.ad_spend
                ? currentMonth.ad_spend / currentMonth.close
                : 0)}
              icon={DollarSign}
              variant={(currentMonth?.close && currentMonth.close > 0 && currentMonth?.ad_spend
                ? currentMonth.ad_spend / currentMonth.close
                : 0) < 100 ? "success" : "warning"}
            />
            <MetricCard
              title="RoAds"
              value={(currentMonth?.total_revenue && currentMonth?.ad_spend && currentMonth.ad_spend > 0 
                ? (currentMonth.total_revenue / currentMonth.ad_spend).toFixed(2) 
                : '0.00')}
              icon={TrendingUp}
              suffix="x"
              variant={(currentMonth?.total_revenue && currentMonth?.ad_spend && currentMonth.ad_spend > 0 
                ? currentMonth.total_revenue / currentMonth.ad_spend 
                : 0) > 2 ? "success" : "warning"}
            />
            <MetricCard
              title="CPL"
              value={formatCurrency(currentMonth?.leads && currentMonth.leads > 0 && currentMonth?.ad_spend
                ? currentMonth.ad_spend / currentMonth.leads 
                : 0)}
              icon={DollarSign}
              variant="default"
            />
            <MetricCard
              title="Taux Conversion Trial"
              value={currentMonth?.trial_ending && currentMonth.trial_ending > 0 
                ? Math.round((currentMonth.converted / currentMonth.trial_ending) * 100) 
                : 0}
              icon={Target}
              suffix="%"
              variant="default"
            />
          </div>
        </section>

        {/* Sales Performance Chart */}
        <section>
          <KPIChart
            data={monthlyData.map(m => ({
              month: m.month_name,
              leads: m.leads,
              scheduled: m.scheduled,
              show: m.show,
              close: m.close,
            }))}
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
