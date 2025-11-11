import { useAnnualKPIData } from '@/hooks/useAnnualKPIData';
import { useTranslations } from '@/hooks/useTranslations';
import { MetricCard } from '@/components/MetricCard';
import { KPIChart } from '@/components/KPIChart';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { VideoBackground } from '@/components/VideoBackground';
import { VideoSettings } from '@/components/VideoSettings';
import { 
  DollarSign, 
  Users, 
  TrendingUp, 
  Activity,
  UserPlus,
  UserMinus,
  Phone,
  Calendar,
  Eye,
  Target,
  Wallet,
  PiggyBank,
  ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useState } from 'react';

const Annual = () => {
  const { annualData, monthlyData, isLoading } = useAnnualKPIData();
  const { t } = useTranslations();
  
  const [videoConfig, setVideoConfig] = useState(() => {
    const saved = localStorage.getItem("video-config");
    return saved ? JSON.parse(saved) : { url: "", overlayOpacity: 0.7, enabled: false };
  });

  const formatCurrency = (value: number) => {
    return `${t('currency')} ${new Intl.NumberFormat('fr-CH', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)}`;
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-lg">{t('loading.annualData')}</div>
      </div>
    );
  }

  if (!annualData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-lg">{t('empty.noData')} {new Date().getFullYear()}</p>
          <Link to="/">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('button.back')}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const schedRate = annualData.leads > 0 ? (annualData.scheduled / annualData.leads) * 100 : 0;
  const showRate = annualData.scheduled > 0 ? (annualData.show / annualData.scheduled) * 100 : 0;
  const closeRate = annualData.show > 0 ? (annualData.close / annualData.show) * 100 : 0;
  const avgPerSale = annualData.close > 0 ? annualData.cashCollected / annualData.close : 0;
  const organicCloseRate = annualData.organicLeads > 0 ? (annualData.organicClose / annualData.organicLeads) * 100 : 0;
  const conversionRate = annualData.trialEnding > 0 ? (annualData.converted / annualData.trialEnding) * 100 : 0;
  const profitMargin = annualData.totalRevenue > 0 ? (annualData.profit / annualData.totalRevenue) * 100 : 0;
  const cac = annualData.close > 0 ? annualData.adSpend / annualData.close : 0;
  const roAds = annualData.adSpend > 0 ? (annualData.cashCollected / annualData.adSpend) * 100 : 0;

  // Prepare chart data
  const revenueChartData = monthlyData.map((month) => ({
    month: month.month_name,
    revenuTotal: Number(month.total_revenue || 0),
    generalEFT: Number(month.general_eft_revenue || 0),
    pt: Number(month.pt_revenue || 0),
    retail: Number(month.retail_revenue || 0),
    cashCollecte: Number(month.cash_collected || 0),
  }));

  const membersChartData = monthlyData.map((month) => ({
    month: month.month_name,
    totalActifs: Number(month.total_active_members || 0),
    pif: Number(month.pif_members || 0),
    general: Number(month.recurring_general_members || 0),
    pt: Number(month.pt_members || 0),
  }));

  const salesFunnelChartData = monthlyData.map((month) => ({
    month: month.month_name,
    leads: Number(month.leads || 0),
    appels: Number(month.calls_made || 0),
    rdv: Number(month.scheduled || 0),
    presents: Number(month.show || 0),
    ventes: Number(month.close || 0),
  }));

  const financialChartData = monthlyData.map((month) => ({
    month: month.month_name,
    revenu: Number(month.total_revenue || 0),
    depenses: Number(month.total_expenses || 0),
    profit: Number(month.profit || 0),
  }));

  const churnChartData = monthlyData.map((month) => ({
    month: month.month_name,
    pifChurn: Number(month.pif_churn || 0),
    generalChurn: Number(month.general_churn || 0),
    ptChurn: Number(month.pt_churn || 0),
  }));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-md sticky top-0 z-10">
        <VideoBackground 
          videoUrl="/videos/fitness-background.mp4"
          overlayOpacity={0.4}
        >
          <div className="container mx-auto px-6 py-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex-1">
                <h1 className="text-4xl font-semibold tracking-tight text-display mb-2">
                  {t('annual.title')} {annualData.year}
                </h1>
                <p className="text-muted-foreground text-sm tracking-wide">
                  {t('annual.subtitle')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link to="/">
                  <Button variant="outline" className="border-foreground/20 hover:bg-foreground/5">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {t('header.monthlyView')}
                  </Button>
                </Link>
                <VideoSettings onConfigChange={setVideoConfig} />
                <LanguageToggle />
                <ThemeToggle />
              </div>
            </div>
          </div>
        </VideoBackground>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8 space-y-10">

          {/* Key Metrics Overview */}
          <section className="space-y-6">
            <h2 className="text-2xl font-medium text-heading tracking-tight">{t('section.keyMetrics')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title={t('metric.totalRevenue')}
                value={formatCurrency(annualData.totalRevenue)}
                icon={DollarSign}
                variant="default"
              />
              <MetricCard
                title={t('metric.profit')}
                value={formatCurrency(annualData.profit)}
                icon={PiggyBank}
                trend={profitMargin}
                suffix={` (${formatPercentage(profitMargin)})`}
                variant={annualData.profit > 0 ? "success" : "destructive"}
              />
              <MetricCard
                title={t('metric.activeMembers')}
                value={annualData.totalActiveMembers}
                icon={Users}
                variant="default"
              />
              <MetricCard
                title={t('metric.conversionRate')}
                value={formatPercentage(closeRate)}
                icon={Target}
                variant={closeRate > 50 ? "success" : "warning"}
              />
            </div>
          </section>

          {/* Revenue Breakdown */}
          <section className="space-y-6">
            <h2 className="text-2xl font-medium text-heading tracking-tight">{t('section.revenueBreakdown')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title={t('metric.generalEftRevenue')}
                value={formatCurrency(annualData.generalEFTRevenue)}
                icon={DollarSign}
                variant="default"
              />
              <MetricCard
                title={t('metric.ptRevenue')}
                value={formatCurrency(annualData.ptRevenue)}
                icon={DollarSign}
                variant="default"
              />
              <MetricCard
                title={t('metric.retailRevenue')}
                value={formatCurrency(annualData.retailRevenue)}
                icon={DollarSign}
                variant="default"
              />
              <MetricCard
                title={t('metric.cashCollected')}
                value={formatCurrency(annualData.cashCollected)}
                icon={Wallet}
                variant="default"
              />
            </div>
            {revenueChartData.length > 0 && (
              <KPIChart
                title={t('annual.monthlyEvolutionRevenue')}
                data={revenueChartData}
                type="bar"
                dataKeys={[
                  { key: "revenuTotal", name: t('chart.totalRevenue'), color: "hsl(var(--primary))" },
                  { key: "generalEFT", name: t('chart.generalEFT'), color: "hsl(var(--chart-1))" },
                  { key: "pt", name: t('chart.pt'), color: "hsl(var(--chart-2))" },
                  { key: "retail", name: t('chart.retail'), color: "hsl(var(--chart-3))" },
                  { key: "cashCollecte", name: t('chart.cashCollected'), color: "hsl(var(--chart-4))" },
                ]}
              />
            )}
          </section>

          {/* Members Overview */}
          <section className="space-y-6">
            <h2 className="text-2xl font-medium text-heading tracking-tight">{t('section.members')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title={t('metric.activeMembers')}
                value={annualData.totalActiveMembers}
                icon={Users}
                variant="default"
              />
              <MetricCard
                title={t('metric.pifMembers')}
                value={annualData.pifMembers}
                icon={Users}
                variant="default"
              />
              <MetricCard
                title={t('metric.generalMembers')}
                value={annualData.recurringGeneralMembers}
                icon={Users}
                variant="default"
              />
              <MetricCard
                title={t('metric.ptMembers')}
                value={annualData.ptMembers}
                icon={Users}
                variant="default"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title={t('metric.totalExits')}
                value={annualData.totalExits}
                icon={UserMinus}
                variant="destructive"
              />
              <MetricCard
                title={t('metric.pifExits')}
                value={annualData.pifExits}
                icon={UserMinus}
                variant="destructive"
              />
              <MetricCard
                title={t('metric.generalExits')}
                value={annualData.generalExits}
                icon={UserMinus}
                variant="destructive"
              />
              <MetricCard
                title={t('metric.ptExits')}
                value={annualData.ptExits}
                icon={UserMinus}
                variant="destructive"
              />
            </div>
            {membersChartData.length > 0 && (
              <KPIChart
                title={t('annual.monthlyEvolutionMembers')}
                data={membersChartData}
                type="bar"
                dataKeys={[
                  { key: "totalActifs", name: t('chart.totalActive'), color: "hsl(var(--primary))" },
                  { key: "pif", name: t('chart.pif'), color: "hsl(var(--chart-1))" },
                  { key: "general", name: t('chart.general'), color: "hsl(var(--chart-2))" },
                  { key: "pt", name: t('chart.pt'), color: "hsl(var(--chart-3))" },
                ]}
              />
            )}
          </section>

          {/* Sales Funnel */}
          <section className="space-y-6">
            <h2 className="text-2xl font-medium text-heading tracking-tight">{t('section.salesFunnel')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title={t('metric.leads')}
                value={annualData.leads}
                icon={UserPlus}
                variant="default"
              />
              <MetricCard
                title={t('metric.calls')}
                value={annualData.callsMade}
                icon={Phone}
                variant="default"
              />
              <MetricCard
                title={t('metric.appointments')}
                value={annualData.scheduled}
                icon={Calendar}
                trend={schedRate}
                suffix={` (${formatPercentage(schedRate)})`}
                variant="default"
              />
              <MetricCard
                title={t('metric.present')}
                value={annualData.show}
                icon={Eye}
                trend={showRate}
                suffix={` (${formatPercentage(showRate)})`}
                variant="default"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <MetricCard
                title={t('metric.salesClosed')}
                value={annualData.close}
                icon={Target}
                trend={closeRate}
                suffix={` (${formatPercentage(closeRate)})`}
                variant={closeRate > 50 ? "success" : "default"}
              />
              <MetricCard
                title={t('metric.cashCollected')}
                value={formatCurrency(annualData.cashCollected)}
                icon={Wallet}
                variant="default"
              />
              <MetricCard
                title={t('metric.avgPerSale')}
                value={formatCurrency(avgPerSale)}
                icon={DollarSign}
                variant="default"
              />
            </div>
            {salesFunnelChartData.length > 0 && (
              <KPIChart
                title={t('annual.monthlyEvolutionSales')}
                data={salesFunnelChartData}
                type="bar"
                dataKeys={[
                  { key: "leads", name: t('chart.leads'), color: "hsl(var(--chart-1))" },
                  { key: "appels", name: t('chart.calls'), color: "hsl(var(--chart-2))" },
                  { key: "rdv", name: t('chart.rdv'), color: "hsl(var(--chart-3))" },
                  { key: "presents", name: t('chart.present'), color: "hsl(var(--chart-4))" },
                  { key: "ventes", name: t('chart.sales'), color: "hsl(var(--primary))" },
                ]}
              />
            )}
          </section>

          {/* Organic & Trials */}
          <section className="space-y-6">
            <h2 className="text-2xl font-medium text-heading tracking-tight">{t('section.organicTrials')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title={t('metric.organicLeads')}
                value={annualData.organicLeads}
                icon={UserPlus}
                variant="default"
              />
              <MetricCard
                title={t('metric.organicSales')}
                value={annualData.organicClose}
                icon={Target}
                trend={organicCloseRate}
                suffix={` (${formatPercentage(organicCloseRate)})`}
                variant="default"
              />
              <MetricCard
                title={t('metric.organicCash')}
                value={formatCurrency(annualData.organicCashCollected)}
                icon={Wallet}
                variant="default"
              />
              <MetricCard
                title={t('metric.trialsConverted')}
                value={annualData.converted}
                icon={TrendingUp}
                trend={conversionRate}
                suffix={` (${formatPercentage(conversionRate)})`}
                variant={conversionRate > 50 ? "success" : "default"}
              />
            </div>
          </section>

          {/* Financial Summary */}
          <section className="space-y-6">
            <h2 className="text-2xl font-medium text-heading tracking-tight">{t('section.financialSummary')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <MetricCard
                title={t('metric.adSpend')}
                value={formatCurrency(annualData.adSpend)}
                icon={DollarSign}
                variant="destructive"
              />
              <MetricCard
                title={t('metric.totalExpenses')}
                value={formatCurrency(annualData.totalExpenses)}
                icon={DollarSign}
                variant="destructive"
              />
              <MetricCard
                title={t('metric.profit')}
                value={formatCurrency(annualData.profit)}
                icon={PiggyBank}
                trend={profitMargin}
                suffix={` (${formatPercentage(profitMargin)})`}
                variant={annualData.profit > 0 ? "success" : "destructive"}
              />
              <MetricCard
                title={t('metric.cac')}
                value={formatCurrency(cac)}
                icon={DollarSign}
                variant={cac < 100 ? "success" : "warning"}
              />
              <MetricCard
                title={t('metric.roAds')}
                value={formatPercentage(roAds)}
                icon={TrendingUp}
                variant={roAds > 200 ? "success" : roAds > 100 ? "warning" : "destructive"}
              />
            </div>
            {financialChartData.length > 0 && (
              <KPIChart
                title={t('annual.monthlyFinancial')}
                data={financialChartData}
                type="bar"
                dataKeys={[
                  { key: "revenu", name: t('chart.revenue'), color: "hsl(var(--chart-1))" },
                  { key: "depenses", name: t('chart.expenses'), color: "hsl(var(--destructive))" },
                  { key: "profit", name: t('chart.profit'), color: "hsl(var(--primary))" },
                ]}
              />
            )}
          </section>

          {/* Additional Metrics */}
          <section className="space-y-6">
            <h2 className="text-2xl font-medium text-heading tracking-tight">{t('section.additionalMetrics')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title={t('metric.totalClasses')}
                value={annualData.totalClasses}
                icon={Activity}
                variant="default"
              />
              <MetricCard
                title={t('metric.cpl')}
                value={formatCurrency(annualData.cpl)}
                icon={DollarSign}
                variant="default"
              />
              <MetricCard
                title={t('metric.cpr')}
                value={formatCurrency(annualData.cpr)}
                icon={DollarSign}
                variant="default"
              />
              <MetricCard
                title={t('metric.inTrial')}
                value={annualData.inTrial}
                icon={Users}
                variant="default"
              />
            </div>
          </section>

          {/* Churn Rates */}
          <section className="space-y-6">
            <h2 className="text-2xl font-medium text-heading tracking-tight">{t('section.churnRates')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard
                title={t('metric.pifChurn')}
                value={formatPercentage(annualData.pifChurn)}
                icon={Users}
                variant={annualData.pifChurn < 5 ? "success" : annualData.pifChurn < 10 ? "warning" : "destructive"}
              />
              <MetricCard
                title={t('metric.generalChurn')}
                value={formatPercentage(annualData.generalChurn)}
                icon={Users}
                variant={annualData.generalChurn < 5 ? "success" : annualData.generalChurn < 10 ? "warning" : "destructive"}
              />
              <MetricCard
                title={t('metric.ptChurn')}
                value={formatPercentage(annualData.ptChurn)}
                icon={Users}
                variant={annualData.ptChurn < 5 ? "success" : annualData.ptChurn < 10 ? "warning" : "destructive"}
              />
            </div>
            {churnChartData.length > 0 && (
              <KPIChart
                title={t('annual.monthlyChurn')}
                data={churnChartData}
                type="line"
                dataKeys={[
                  { key: "pifChurn", name: t('chart.pifChurn'), color: "hsl(var(--chart-1))" },
                  { key: "generalChurn", name: t('chart.generalChurn'), color: "hsl(var(--chart-2))" },
                  { key: "ptChurn", name: t('chart.ptChurn'), color: "hsl(var(--chart-3))" },
                ]}
              />
            )}
          </section>

          {/* Advanced Metrics */}
          <section className="space-y-6">
            <h2 className="text-2xl font-medium text-heading tracking-tight">{t('section.advancedMetrics')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <MetricCard
                title={t('metric.generalAcrm')}
                value={formatCurrency(annualData.generalACRM)}
                icon={DollarSign}
                variant="default"
              />
              <MetricCard
                title={t('metric.generalLtv')}
                value={formatCurrency(annualData.generalLTV)}
                icon={TrendingUp}
                variant="success"
              />
              <MetricCard
                title={t('metric.ptAcrm')}
                value={formatCurrency(annualData.ptACRM)}
                icon={DollarSign}
                variant="default"
              />
              <MetricCard
                title={t('metric.ptLtv')}
                value={formatCurrency(annualData.ptLTV)}
                icon={TrendingUp}
                variant="success"
              />
              <MetricCard
                title={t('metric.gymFloorSqft')}
                value={annualData.gymFloorSQFT}
                icon={Activity}
                variant="default"
              />
            </div>
          </section>
        </main>
    </div>
  );
};

export default Annual;
