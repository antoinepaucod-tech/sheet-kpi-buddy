import { useMemo } from 'react';
import { useAnnualKPIData } from '@/hooks/useAnnualKPIData';
import { useTranslations } from '@/hooks/useTranslations';
import { MetricCard } from '@/components/MetricCard';
import { InteractiveChart } from '@/components/InteractiveChart';
import { KPISummaryCard } from '@/components/KPISummaryCard';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  DollarSign, 
  Users, 
  TrendingUp, 
  Activity,
  UserPlus,
  UserMinus,
  Target,
  Wallet,
  PiggyBank,
  ArrowLeft,
  BarChart3,
  PieChart
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useState } from 'react';

const Annual = () => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const { annualData, monthlyData, isLoading } = useAnnualKPIData(selectedYear);
  const { t } = useTranslations();

  const formatCurrency = (value: number) => {
    return `${t('currency')} ${new Intl.NumberFormat('fr-CH', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)}`;
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  // Calculated metrics
  const closeRate = annualData && annualData.show > 0 ? (annualData.close / annualData.show) * 100 : 0;
  const profitMargin = annualData && annualData.totalRevenue > 0 ? (annualData.profit / annualData.totalRevenue) * 100 : 0;
  const roAds = annualData && annualData.adSpend > 0 ? (annualData.cashCollected / annualData.adSpend) * 100 : 0;
  const avgPerSale = annualData && annualData.close > 0 ? annualData.cashCollected / annualData.close : 0;

  // Summary items
  const summaryItems = useMemo(() => {
    if (!annualData) return [];
    return [
      {
        label: "Revenus Totaux",
        value: formatCurrency(annualData.totalRevenue),
        currentValue: annualData.totalRevenue,
        previousValue: 0,
      },
      {
        label: "Profit",
        value: formatCurrency(annualData.profit),
        currentValue: annualData.profit,
        previousValue: 0,
      },
      {
        label: "Membres Actifs",
        value: annualData.totalActiveMembers,
        currentValue: annualData.totalActiveMembers,
        previousValue: 0,
      },
      {
        label: "Conversions",
        value: annualData.close,
        currentValue: annualData.close,
        previousValue: 0,
      },
      {
        label: "Cash Collecté",
        value: formatCurrency(annualData.cashCollected),
        currentValue: annualData.cashCollected,
        previousValue: 0,
      },
      {
        label: "ROI Ads",
        value: `${roAds.toFixed(0)}%`,
        currentValue: roAds,
        previousValue: 0,
      },
    ];
  }, [annualData, roAds]);

  // Chart data
  const revenueChartData = useMemo(() => monthlyData.map((month) => ({
    month: month.month_name,
    totalRevenue: Number(month.total_revenue || 0),
    profit: Number(month.profit || 0),
    expenses: Number(month.total_expenses || 0),
  })), [monthlyData]);

  const expensesChartData = useMemo(() => monthlyData.map((month) => ({
    month: month.month_name,
    adSpend: Number(month.ad_spend || 0),
    rent: Number(month.rent || 0),
    software: Number(month.computer_software || 0),
    salaries: Number(month.salaries || 0),
    salariesCoach: Number(month.salaries_coach || 0),
  })), [monthlyData]);

  const membersChartData = useMemo(() => monthlyData.map((month) => ({
    month: month.month_name,
    recurringGeneralMembers: Number(month.recurring_general_members || 0),
    ptMembers: Number(month.pt_members || 0),
    pifMembers: Number(month.pif_members || 0),
  })), [monthlyData]);

  const funnelChartData = useMemo(() => monthlyData.map((month) => ({
    month: month.month_name,
    leads: Number(month.leads || 0),
    scheduled: Number(month.scheduled || 0),
    show: Number(month.show || 0),
    close: Number(month.close || 0),
  })), [monthlyData]);

  const churnChartData = useMemo(() => monthlyData.map((month) => ({
    month: month.month_name,
    pifChurn: Number(month.pif_churn || 0),
    generalChurn: Number(month.general_churn || 0),
    ptChurn: Number(month.pt_churn || 0),
  })), [monthlyData]);

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
          <p className="text-lg">{t('empty.noData')} {selectedYear}</p>
          <Link to="/kpi-revenue">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('button.back')}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-md sticky top-0 z-10 bg-background/95">
        <div className="container mx-auto px-3 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1 flex items-center gap-4">
              <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                <SelectTrigger className="w-[100px] bg-muted/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2027">2027</SelectItem>
                </SelectContent>
              </Select>
              
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-display mb-1">
                  {t('annual.title')} {selectedYear}
                </h1>
                <p className="text-muted-foreground text-xs sm:text-sm tracking-wide">
                  {t('annual.subtitle')}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2">
              <Link to="/kpi-revenue">
                <Button variant="outline" size="sm" className="whitespace-nowrap border-foreground/20 hover:bg-foreground/5">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">{t('header.monthlyView')}</span>
                  <span className="sm:hidden">Mensuel</span>
                </Button>
              </Link>
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-6 py-4 sm:py-8 space-y-6">
        {/* Summary Card */}
        <KPISummaryCard 
          items={summaryItems} 
          title={`Résumé Annuel ${selectedYear}`} 
        />

        {/* Tabs Navigation */}
        <Tabs defaultValue="revenue" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 h-auto p-1">
            <TabsTrigger value="revenue" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm py-2">
              <DollarSign className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Revenus</span>
              <span className="sm:hidden">€</span>
            </TabsTrigger>
            <TabsTrigger value="funnel" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm py-2">
              <Target className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Funnel</span>
              <span className="sm:hidden">F</span>
            </TabsTrigger>
            <TabsTrigger value="members" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm py-2">
              <Users className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Membres</span>
              <span className="sm:hidden">M</span>
            </TabsTrigger>
            <TabsTrigger value="metrics" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm py-2">
              <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Métriques</span>
              <span className="sm:hidden">KPI</span>
            </TabsTrigger>
          </TabsList>

          {/* Revenue Tab */}
          <TabsContent value="revenue" className="space-y-4">
            <CollapsibleSection 
              title="Métriques Clés" 
              icon={Wallet}
              badge={formatCurrency(annualData.totalRevenue)}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <MetricCard
                  title={t('metric.totalRevenue')}
                  value={formatCurrency(annualData.totalRevenue)}
                  icon={DollarSign}
                  variant="default"
                />
                <MetricCard
                  title={t('metric.profit')}
                  value={formatCurrency(annualData.profit)}
                  icon={TrendingUp}
                  variant={annualData.profit > 0 ? "success" : "destructive"}
                  suffix={` (${formatPercentage(profitMargin)})`}
                />
                <MetricCard
                  title="Cash Collecté"
                  value={formatCurrency(annualData.cashCollected)}
                  icon={Wallet}
                  variant="default"
                />
                <MetricCard
                  title="Dépenses"
                  value={formatCurrency(annualData.totalExpenses)}
                  icon={PieChart}
                  variant="warning"
                />
              </div>
            </CollapsibleSection>

            <CollapsibleSection 
              title="Évolution Revenus/Profit/Dépenses" 
              icon={TrendingUp}
            >
              <InteractiveChart
                data={revenueChartData}
                title=""
                type="line"
                height={350}
                showComparison
                comparisonLabel="Moyenne"
                dataKeys={[
                  { key: 'totalRevenue', name: 'Revenus', color: 'hsl(220, 90%, 56%)' },
                  { key: 'profit', name: 'Profit', color: 'hsl(142, 76%, 36%)' },
                  { key: 'expenses', name: 'Dépenses', color: 'hsl(0, 84%, 60%)' },
                ]}
              />
            </CollapsibleSection>

            <CollapsibleSection 
              title="Détail des Revenus" 
              icon={DollarSign}
              defaultOpen={false}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
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
                  title="Moyenne/Vente"
                  value={formatCurrency(avgPerSale)}
                  icon={PiggyBank}
                  variant="default"
                />
              </div>
            </CollapsibleSection>

            <CollapsibleSection 
              title="Détail des Dépenses" 
              icon={PieChart}
              defaultOpen={false}
            >
              <InteractiveChart
                data={expensesChartData}
                title=""
                type="bar"
                height={350}
                dataKeys={[
                  { key: 'adSpend', name: 'Publicité', color: 'hsl(0, 84%, 60%)' },
                  { key: 'rent', name: 'Loyer', color: 'hsl(221, 83%, 53%)' },
                  { key: 'software', name: 'Software', color: 'hsl(262, 83%, 58%)' },
                  { key: 'salaries', name: 'Salaires', color: 'hsl(173, 58%, 39%)' },
                  { key: 'salariesCoach', name: 'Salaires Coach', color: 'hsl(142, 71%, 45%)' },
                ]}
              />
            </CollapsibleSection>
          </TabsContent>

          {/* Funnel Tab */}
          <TabsContent value="funnel" className="space-y-4">
            <CollapsibleSection 
              title="Entonnoir de Vente" 
              icon={Target}
              badge={`${annualData.close} conversions`}
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <MetricCard
                  title={t('metric.leads')}
                  value={annualData.leads}
                  icon={UserPlus}
                  variant="default"
                />
                <MetricCard
                  title={t('metric.scheduled')}
                  value={annualData.scheduled}
                  icon={Activity}
                  suffix={annualData.leads > 0 ? ` (${Math.round((annualData.scheduled / annualData.leads) * 100)}%)` : ''}
                  variant="default"
                />
                <MetricCard
                  title={t('metric.show')}
                  value={annualData.show}
                  icon={Target}
                  suffix={annualData.scheduled > 0 ? ` (${Math.round((annualData.show / annualData.scheduled) * 100)}%)` : ''}
                  variant="default"
                />
                <MetricCard
                  title={t('metric.close')}
                  value={annualData.close}
                  icon={TrendingUp}
                  suffix={annualData.show > 0 ? ` (${Math.round((annualData.close / annualData.show) * 100)}%)` : ''}
                  variant="success"
                />
              </div>
            </CollapsibleSection>

            <CollapsibleSection 
              title="Évolution Funnel" 
              icon={BarChart3}
            >
              <InteractiveChart
                data={funnelChartData}
                title=""
                type="bar"
                height={350}
                dataKeys={[
                  { key: 'leads', name: 'Leads', color: 'hsl(220, 90%, 56%)' },
                  { key: 'scheduled', name: 'RDV', color: 'hsl(262, 83%, 58%)' },
                  { key: 'show', name: 'Présents', color: 'hsl(48, 96%, 53%)' },
                  { key: 'close', name: 'Ventes', color: 'hsl(142, 76%, 36%)' },
                ]}
              />
            </CollapsibleSection>

            <CollapsibleSection 
              title="Métriques Publicitaires" 
              icon={DollarSign}
              defaultOpen={false}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <MetricCard
                  title={t('metric.adSpend')}
                  value={formatCurrency(annualData.adSpend)}
                  icon={DollarSign}
                  variant="destructive"
                />
                <MetricCard
                  title="CPL"
                  value={formatCurrency(annualData.cpl)}
                  icon={DollarSign}
                  variant="default"
                />
                <MetricCard
                  title="CPR"
                  value={formatCurrency(annualData.cpr)}
                  icon={DollarSign}
                  variant="default"
                />
                <MetricCard
                  title="ROI Ads"
                  value={formatPercentage(roAds)}
                  icon={TrendingUp}
                  variant={roAds > 200 ? "success" : roAds > 100 ? "warning" : "destructive"}
                />
              </div>
            </CollapsibleSection>

            <CollapsibleSection 
              title="Organique & Essais" 
              icon={UserPlus}
              defaultOpen={false}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
                  variant="default"
                />
                <MetricCard
                  title={t('metric.organicCash')}
                  value={formatCurrency(annualData.organicCashCollected)}
                  icon={Wallet}
                  variant="default"
                />
                <MetricCard
                  title="En Essai"
                  value={annualData.inTrial}
                  icon={Users}
                  variant="default"
                />
              </div>
            </CollapsibleSection>
          </TabsContent>

          {/* Members Tab */}
          <TabsContent value="members" className="space-y-4">
            <CollapsibleSection 
              title="Membres Actifs" 
              icon={Users}
              badge={`${annualData.totalActiveMembers} membres`}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
            </CollapsibleSection>

            <CollapsibleSection 
              title="Évolution Membres" 
              icon={TrendingUp}
            >
              <InteractiveChart
                data={membersChartData}
                title=""
                type="bar"
                height={350}
                dataKeys={[
                  { key: 'recurringGeneralMembers', name: 'Général', color: 'hsl(220, 90%, 56%)' },
                  { key: 'ptMembers', name: 'PT', color: 'hsl(262, 83%, 58%)' },
                  { key: 'pifMembers', name: 'PIF', color: 'hsl(142, 76%, 36%)' },
                ]}
              />
            </CollapsibleSection>

            <CollapsibleSection 
              title="Sorties" 
              icon={UserMinus}
              defaultOpen={false}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
            </CollapsibleSection>

            <CollapsibleSection 
              title="Taux de Churn" 
              icon={Activity}
              defaultOpen={false}
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4">
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
              <InteractiveChart
                data={churnChartData}
                title=""
                type="line"
                height={300}
                dataKeys={[
                  { key: 'pifChurn', name: 'Churn PIF', color: 'hsl(0, 84%, 60%)' },
                  { key: 'generalChurn', name: 'Churn Général', color: 'hsl(48, 96%, 53%)' },
                  { key: 'ptChurn', name: 'Churn PT', color: 'hsl(262, 83%, 58%)' },
                ]}
              />
            </CollapsibleSection>
          </TabsContent>

          {/* Metrics Tab */}
          <TabsContent value="metrics" className="space-y-4">
            <CollapsibleSection 
              title="Performance Financière" 
              icon={PiggyBank}
              badge={formatCurrency(annualData.profit)}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                <MetricCard
                  title={t('metric.profit')}
                  value={formatCurrency(annualData.profit)}
                  icon={PiggyBank}
                  suffix={` (${formatPercentage(profitMargin)})`}
                  variant={annualData.profit > 0 ? "success" : "destructive"}
                />
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
                  variant="warning"
                />
                <MetricCard
                  title="CAC"
                  value={formatCurrency(annualData.close > 0 ? annualData.adSpend / annualData.close : 0)}
                  icon={DollarSign}
                  variant="default"
                />
                <MetricCard
                  title="ROI Ads"
                  value={formatPercentage(roAds)}
                  icon={TrendingUp}
                  variant={roAds > 200 ? "success" : roAds > 100 ? "warning" : "destructive"}
                />
              </div>
            </CollapsibleSection>

            <CollapsibleSection 
              title="Métriques Avancées" 
              icon={BarChart3}
              defaultOpen={false}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
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
                  title={t('metric.totalClasses')}
                  value={annualData.totalClasses}
                  icon={Activity}
                  variant="default"
                />
              </div>
            </CollapsibleSection>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Annual;