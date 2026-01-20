import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMonthlyKPIData } from "@/hooks/useMonthlyKPIData";
import { useAccountingTransactions } from "@/hooks/useAccountingTransactions";
import { useCoachMembership } from "@/hooks/useCoachMembership";
import { useTranslations } from "@/hooks/useTranslations";
import { MetricCard } from "@/components/MetricCard";
import { MetricCardWithTooltip, KPI_TOOLTIPS } from "@/components/MetricCardWithTooltip";
import { InteractiveChart } from "@/components/InteractiveChart";
import { KPISummaryCard } from "@/components/KPISummaryCard";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { MonthlyDataInput } from "@/components/MonthlyDataInput";
import { EmailReminderButton } from "@/components/EmailReminderButton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  DollarSign,
  Users,
  TrendingUp,
  Target,
  ChevronLeft,
  ChevronRight,
  Activity,
  Calendar,
  Wallet,
  BarChart3,
  PieChart,
} from "lucide-react";
import { MONTHS } from "@/types/kpi";

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslations();
  const { isCoachCategory } = useCoachMembership();
  const { 
    monthlyData, 
    currentMonthIndex, 
    setCurrentMonthIndex, 
    getCurrentMonthData,
    isLoading,
    refreshData,
    currentYear,
    setCurrentYear 
  } = useMonthlyKPIData();
  
  // Get accounting transactions for current month to calculate member/coach split
  const { transactions } = useAccountingTransactions(currentYear, currentMonthIndex);
  
  const currentMonth = getCurrentMonthData() || monthlyData[currentMonthIndex];
  const previousMonth = monthlyData[currentMonthIndex === 0 ? 11 : currentMonthIndex - 1];
  
  // Calculate member vs coach transaction counts
  const { memberTransactionCount, coachTransactionCount } = useMemo(() => {
    const revenueTransactions = transactions.filter(t => t.transaction_type === 'revenue');
    const coachTxs = revenueTransactions.filter(t => isCoachCategory(t.category));
    const memberTxs = revenueTransactions.filter(t => !isCoachCategory(t.category));
    
    return {
      memberTransactionCount: memberTxs.length,
      coachTransactionCount: coachTxs.length,
    };
  }, [transactions, isCoachCategory]);

  const saveMonthData = async (data: any) => {
    const total_revenue = data.general_eft_revenue + data.pt_revenue + data.retail_revenue + data.fast_cash_revenue;
    const total_expenses = data.ad_spend + data.rent + data.repairs_maintenance +
                          data.computer_software + data.internet_telephone + 
                          data.subscriptions + data.bank_finance_charges +
                          data.insurance + (data.salaries || 0) + (data.salaries_coach || 0) + (data.food_expenses || 0) + (data.credit_repayment || 0);
    const profit = total_revenue - total_expenses;
    const total_active_members = (data.pif_members || 0) + (data.recurring_general_members || 0) + (data.pt_members || 0);

    const pif_churn = data.pif_members > 0 ? (data.pif_exits / data.pif_members) * 100 : 0;
    const general_churn = data.recurring_general_members > 0 ? (data.general_exits / data.recurring_general_members) * 100 : 0;
    const pt_churn = data.pt_members > 0 ? (data.pt_exits / data.pt_members) * 100 : 0;

    const cpl = data.leads > 0 ? data.ad_spend / data.leads : 0;
    const cpr = data.scheduled > 0 ? data.ad_spend / data.scheduled : 0;
    const cac = data.close > 0 ? data.ad_spend / data.close : 0;
    const ro_ads = data.ad_spend > 0 ? (data.cash_collected / data.ad_spend) * 100 : 0;

    const { error } = await supabase
      .from("monthly_kpis")
      .upsert({
        ...data,
        total_revenue,
        total_expenses,
        profit,
        total_active_members,
        pif_churn,
        general_churn,
        pt_churn,
        cpl,
        cpr,
        cac,
        ro_ads,
      }, {
        onConflict: 'year,month'
      });

    if (error) {
      toast({ title: t('toast.error'), description: t('toast.cannotSave'), variant: "destructive" });
    } else {
      toast({ title: t('toast.saved'), description: t('toast.dataUpdated') });
      refreshData();
    }
  };

  const goToPreviousMonth = () => {
    setCurrentMonthIndex((prev) => (prev === 0 ? 11 : prev - 1));
  };

  const goToNextMonth = () => {
    setCurrentMonthIndex((prev) => (prev === 11 ? 0 : prev + 1));
  };

  const formatCurrency = (value: number) => {
    return `${t('currency')} ${new Intl.NumberFormat('fr-CH', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)}`;
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  // Summary items with trends - now includes separate member/coach counts
  const summaryItems = useMemo(() => [
    {
      label: "Revenus",
      value: formatCurrency(currentMonth?.total_revenue || 0),
      currentValue: currentMonth?.total_revenue || 0,
      previousValue: previousMonth?.total_revenue || 0,
    },
    {
      label: "Profit",
      value: formatCurrency(currentMonth?.profit || 0),
      currentValue: currentMonth?.profit || 0,
      previousValue: previousMonth?.profit || 0,
    },
    {
      label: "Membres",
      value: memberTransactionCount,
      currentValue: memberTransactionCount,
      previousValue: 0,
    },
    {
      label: "Coachs",
      value: coachTransactionCount,
      currentValue: coachTransactionCount,
      previousValue: 0,
    },
    {
      label: "Cash Collecté",
      value: formatCurrency(currentMonth?.cash_collected || 0),
      currentValue: currentMonth?.cash_collected || 0,
      previousValue: previousMonth?.cash_collected || 0,
    },
    {
      label: "ROI Ads",
      value: `${(currentMonth?.ro_ads || 0).toFixed(0)}%`,
      currentValue: currentMonth?.ro_ads || 0,
      previousValue: previousMonth?.ro_ads || 0,
    },
  ], [currentMonth, previousMonth, memberTransactionCount, coachTransactionCount, t]);

  // Chart data
  const revenueChartData = useMemo(() => monthlyData.map(m => ({
    month: m.month_name,
    totalRevenue: m.total_revenue,
    profit: m.profit,
    expenses: m.total_expenses,
  })), [monthlyData]);

  const expensesChartData = useMemo(() => monthlyData.map(m => ({
    month: m.month_name,
    adSpend: m.ad_spend,
    rent: m.rent,
    software: m.computer_software,
    internet: m.internet_telephone,
    subscriptions: m.subscriptions,
    bankCharges: m.bank_finance_charges,
    salaries: m.salaries,
    salariesCoach: m.salaries_coach,
  })), [monthlyData]);

  const membersChartData = useMemo(() => monthlyData.map(m => ({
    month: m.month_name,
    recurringGeneralMembers: m.recurring_general_members,
    ptMembers: m.pt_members,
    pifMembers: m.pif_members,
  })), [monthlyData]);

  const funnelChartData = useMemo(() => monthlyData.map(m => ({
    month: m.month_name,
    leads: m.leads,
    scheduled: m.scheduled,
    show: m.show,
    close: m.close,
  })), [monthlyData]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">{t('loading.data')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-md sticky top-0 z-10 bg-background/95">
        <div className="container mx-auto px-3 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-display mb-1 sm:mb-2">
                {t('header.title')}
              </h1>
              <p className="text-muted-foreground text-xs sm:text-sm tracking-wide">
                {t('header.subtitle')}
              </p>
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
              <MonthlyDataInput 
                monthData={currentMonth} 
                monthLabel={MONTHS[currentMonthIndex]} 
                onSave={saveMonthData}
              />
              <EmailReminderButton />
              <Button 
                variant="outline" 
                onClick={() => navigate('/annual')}
                className="whitespace-nowrap border-foreground/20 hover:bg-foreground/5 text-xs sm:text-sm"
                size="sm"
              >
                <span className="hidden sm:inline">{t('header.annualView')}</span>
                <span className="sm:hidden">Annuel</span>
              </Button>
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mt-4 sm:mt-6">
            <Select value={currentYear.toString()} onValueChange={(value) => setCurrentYear(parseInt(value))}>
              <SelectTrigger className="w-[120px] bg-muted/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
                <SelectItem value="2027">2027</SelectItem>
              </SelectContent>
            </Select>
            
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={goToPreviousMonth}
                className="h-8 w-8 sm:h-10 sm:w-10 hover:bg-foreground/5"
              >
                <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-6 py-1.5 sm:py-2 bg-muted/50 rounded-lg min-w-[140px] sm:min-w-[180px] justify-center">
                <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                <span className="font-medium text-sm sm:text-lg tracking-wide">
                  {MONTHS[currentMonthIndex].toUpperCase()}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={goToNextMonth}
                className="h-8 w-8 sm:h-10 sm:w-10 hover:bg-foreground/5"
              >
                <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-6 py-4 sm:py-8 space-y-6">
        {/* Summary Card with Trends */}
        <KPISummaryCard 
          items={summaryItems} 
          title={`Résumé ${MONTHS[currentMonthIndex]} ${currentYear}`} 
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
              title={t('section.keyMetrics')} 
              icon={Wallet}
              badge={formatCurrency(currentMonth?.total_revenue || 0)}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <MetricCard
                  title={t('metric.totalRevenue')}
                  value={formatCurrency(currentMonth?.total_revenue || 0)}
                  icon={DollarSign}
                  variant="default"
                />
                <MetricCard
                  title={t('metric.profit')}
                  value={formatCurrency(currentMonth?.profit || 0)}
                  icon={TrendingUp}
                  variant={(currentMonth?.profit || 0) > 0 ? "success" : "destructive"}
                  suffix={currentMonth?.total_revenue && currentMonth.total_revenue > 0 
                    ? ` (${Math.round((currentMonth.profit / currentMonth.total_revenue) * 100)}%)` 
                    : ''}
                />
                <MetricCard
                  title="Cash Collecté"
                  value={formatCurrency(currentMonth?.cash_collected || 0)}
                  icon={Wallet}
                  variant="default"
                />
                <MetricCard
                  title="Dépenses"
                  value={formatCurrency(currentMonth?.total_expenses || 0)}
                  icon={PieChart}
                  variant="warning"
                />
              </div>
            </CollapsibleSection>

            <CollapsibleSection 
              title={t('section.revenueEvolution')} 
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
                  { key: 'totalRevenue', name: t('chart.totalRevenue'), color: 'hsl(220, 90%, 56%)' },
                  { key: 'profit', name: t('chart.profit'), color: 'hsl(142, 76%, 36%)' },
                  { key: 'expenses', name: 'Dépenses', color: 'hsl(0, 84%, 60%)' },
                ]}
              />
            </CollapsibleSection>

            <CollapsibleSection 
              title={t('section.monthlyExpenses')} 
              icon={PieChart}
              defaultOpen={false}
            >
              <InteractiveChart
                data={expensesChartData}
                title=""
                type="bar"
                height={400}
                dataKeys={[
                  { key: 'adSpend', name: t('chart.advertising'), color: 'hsl(0, 84%, 60%)' },
                  { key: 'rent', name: t('chart.rent'), color: 'hsl(221, 83%, 53%)' },
                  { key: 'software', name: t('chart.software'), color: 'hsl(262, 83%, 58%)' },
                  { key: 'salaries', name: 'Salaires', color: 'hsl(173, 58%, 39%)' },
                  { key: 'salariesCoach', name: 'Salaires Coach', color: 'hsl(142, 71%, 45%)' },
                  { key: 'subscriptions', name: t('chart.subscriptions'), color: 'hsl(48, 96%, 53%)' },
                ]}
              />
            </CollapsibleSection>
          </TabsContent>

          {/* Funnel Tab */}
          <TabsContent value="funnel" className="space-y-4">
            <CollapsibleSection 
              title={t('section.salesFunnel')} 
              icon={Target}
              badge={`${currentMonth?.close || 0} conversions`}
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                <MetricCard
                  title={t('metric.leads')}
                  value={currentMonth?.leads || 0}
                  icon={Activity}
                  variant="default"
                />
                <MetricCard
                  title={t('metric.scheduled')}
                  value={currentMonth?.scheduled || 0}
                  icon={Calendar}
                  suffix={currentMonth?.leads && currentMonth.leads > 0 
                    ? ` (${Math.round((currentMonth.scheduled / currentMonth.leads) * 100)}%)` 
                    : ''}
                  variant="default"
                />
                <MetricCard
                  title={t('metric.show')}
                  value={currentMonth?.show || 0}
                  icon={Target}
                  suffix={currentMonth?.scheduled && currentMonth.scheduled > 0 
                    ? ` (${Math.round((currentMonth.show / currentMonth.scheduled) * 100)}%)` 
                    : ''}
                  variant="default"
                />
                <MetricCard
                  title={t('metric.close')}
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
                  title={t('metric.avgPerSale')}
                  value={formatCurrency(currentMonth?.close && currentMonth.close > 0 
                    ? currentMonth.cash_collected / currentMonth.close 
                    : 0)}
                  icon={DollarSign}
                  variant="success"
                />
              </div>
            </CollapsibleSection>

            <CollapsibleSection 
              title="Évolution du Funnel" 
              icon={BarChart3}
            >
              <InteractiveChart
                data={funnelChartData}
                title=""
                type="line"
                height={350}
                dataKeys={[
                  { key: 'leads', name: 'Leads', color: 'hsl(220, 90%, 56%)' },
                  { key: 'scheduled', name: 'Planifiés', color: 'hsl(262, 83%, 58%)' },
                  { key: 'show', name: 'Présents', color: 'hsl(48, 96%, 53%)' },
                  { key: 'close', name: 'Conversions', color: 'hsl(142, 76%, 36%)' },
                ]}
              />
            </CollapsibleSection>

            <CollapsibleSection 
              title="Leads Organiques" 
              icon={Users}
              defaultOpen={false}
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <MetricCard
                  title="Leads Organiques"
                  value={currentMonth?.organic_leads || 0}
                  icon={Users}
                  variant="default"
                />
                <MetricCard
                  title="Conversions Organiques"
                  value={currentMonth?.organic_close || 0}
                  icon={TrendingUp}
                  suffix={currentMonth?.organic_leads && currentMonth.organic_leads > 0 
                    ? ` (${Math.round((currentMonth.organic_close / currentMonth.organic_leads) * 100)}%)` 
                    : ''}
                  variant="success"
                />
                <MetricCard
                  title="Cash Organique"
                  value={formatCurrency(currentMonth?.organic_cash_collected || 0)}
                  icon={DollarSign}
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
              badge={`${(currentMonth?.recurring_general_members || 0) + (currentMonth?.pif_members || 0)} membres`}
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <MetricCard
                  title="Membres Récurrents"
                  value={currentMonth?.recurring_general_members || 0}
                  icon={Users}
                  variant="default"
                />
                <MetricCard
                  title="Membres PT"
                  value={currentMonth?.pt_members || 0}
                  icon={Users}
                  variant="default"
                />
                <MetricCard
                  title="Membres PIF"
                  value={currentMonth?.pif_members || 0}
                  icon={Users}
                  variant="default"
                />
                <MetricCard
                  title="Total Actifs"
                  value={(currentMonth?.recurring_general_members || 0) + (currentMonth?.pif_members || 0)}
                  icon={Users}
                  variant="success"
                />
              </div>
            </CollapsibleSection>

            <CollapsibleSection 
              title={t('section.membersEvolution')} 
              icon={TrendingUp}
            >
              <InteractiveChart
                data={membersChartData}
                title=""
                type="line"
                height={350}
                showComparison
                comparisonLabel="Moyenne"
                dataKeys={[
                  { key: 'recurringGeneralMembers', name: t('chart.generalMembers'), color: 'hsl(220, 90%, 56%)' },
                  { key: 'ptMembers', name: t('chart.ptMembers'), color: 'hsl(262, 83%, 58%)' },
                  { key: 'pifMembers', name: t('chart.pifMembers'), color: 'hsl(142, 76%, 36%)' },
                ]}
              />
            </CollapsibleSection>

            <CollapsibleSection 
              title={t('section.churnRates')} 
              icon={TrendingUp}
              defaultOpen={false}
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4">
                <MetricCard
                  title={t('metric.pifChurn')}
                  value={formatPercentage(currentMonth?.pif_churn || 0)}
                  icon={Users}
                  variant={(currentMonth?.pif_churn || 0) < 5 ? "success" : (currentMonth?.pif_churn || 0) < 10 ? "warning" : "destructive"}
                />
                <MetricCard
                  title={t('metric.generalChurn')}
                  value={formatPercentage(currentMonth?.general_churn || 0)}
                  icon={Users}
                  variant={(currentMonth?.general_churn || 0) < 5 ? "success" : (currentMonth?.general_churn || 0) < 10 ? "warning" : "destructive"}
                />
                <MetricCard
                  title={t('metric.ptChurn')}
                  value={formatPercentage(currentMonth?.pt_churn || 0)}
                  icon={Users}
                  variant={(currentMonth?.pt_churn || 0) < 5 ? "success" : (currentMonth?.pt_churn || 0) < 10 ? "warning" : "destructive"}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <MetricCard
                  title="Sorties PIF"
                  value={currentMonth?.pif_exits || 0}
                  icon={Users}
                  variant="destructive"
                />
                <MetricCard
                  title="Sorties Générales"
                  value={currentMonth?.general_exits || 0}
                  icon={Users}
                  variant="destructive"
                />
                <MetricCard
                  title="Sorties PT"
                  value={currentMonth?.pt_exits || 0}
                  icon={Users}
                  variant="destructive"
                />
              </div>
            </CollapsibleSection>

            <CollapsibleSection 
              title="Essais & Conversions" 
              icon={Target}
              defaultOpen={false}
            >
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4">
                <MetricCard
                  title="En Essai"
                  value={currentMonth?.in_trial || 0}
                  icon={Users}
                  variant="default"
                />
                <MetricCard
                  title="Essais Terminant"
                  value={currentMonth?.trial_ending || 0}
                  icon={Calendar}
                  variant="warning"
                />
                <MetricCard
                  title="Convertis"
                  value={currentMonth?.converted || 0}
                  icon={TrendingUp}
                  variant="success"
                />
                <MetricCard
                  title={t('metric.trialConversionRate')}
                  value={currentMonth?.trial_ending && currentMonth.trial_ending > 0 
                    ? Math.round((currentMonth.converted / currentMonth.trial_ending) * 100) 
                    : 0}
                  icon={Target}
                  suffix="%"
                  variant={(currentMonth?.trial_ending && currentMonth.trial_ending > 0 
                    ? Math.round((currentMonth.converted / currentMonth.trial_ending) * 100) 
                    : 0) > 50 ? "success" : "default"}
                />
              </div>
            </CollapsibleSection>
          </TabsContent>

          {/* Metrics Tab */}
          <TabsContent value="metrics" className="space-y-4">
            <CollapsibleSection 
              title={t('section.additionalMetrics')} 
              icon={BarChart3}
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                <MetricCard
                  title={t('metric.totalClasses')}
                  value={currentMonth?.total_classes || 0}
                  icon={Activity}
                  variant="default"
                />
                <MetricCardWithTooltip
                  title={t('metric.cac')}
                  value={formatCurrency(currentMonth?.cac || 0)}
                  icon={DollarSign}
                  variant={(currentMonth?.cac || 0) < 100 ? "success" : "warning"}
                  tooltip={KPI_TOOLTIPS.cac}
                />
                <MetricCardWithTooltip
                  title={t('metric.cpl')}
                  value={formatCurrency(currentMonth?.cpl || 0)}
                  icon={DollarSign}
                  variant="default"
                  tooltip={KPI_TOOLTIPS.cpl}
                />
                <MetricCardWithTooltip
                  title={t('metric.cpr')}
                  value={formatCurrency(currentMonth?.cpr || 0)}
                  icon={DollarSign}
                  variant="default"
                  tooltip={KPI_TOOLTIPS.cpr}
                />
                <MetricCardWithTooltip
                  title={t('metric.roAds')}
                  value={formatPercentage(currentMonth?.ro_ads || 0)}
                  icon={TrendingUp}
                  variant={(currentMonth?.ro_ads || 0) > 200 ? "success" : (currentMonth?.ro_ads || 0) > 100 ? "warning" : "destructive"}
                  tooltip={KPI_TOOLTIPS.roAds}
                />
                <MetricCard
                  title={t('metric.conversionRate')}
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
            </CollapsibleSection>

            <CollapsibleSection 
              title="Coûts Marketing" 
              icon={DollarSign}
              defaultOpen={false}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <MetricCard
                  title="Dépenses Pub"
                  value={formatCurrency(currentMonth?.ad_spend || 0)}
                  icon={DollarSign}
                  variant="default"
                />
                <MetricCard
                  title="Coût/Lead (CPL)"
                  value={formatCurrency(currentMonth?.cpl || 0)}
                  icon={DollarSign}
                  variant={(currentMonth?.cpl || 0) < 20 ? "success" : "warning"}
                />
                <MetricCard
                  title="Coût/RDV (CPR)"
                  value={formatCurrency(currentMonth?.cpr || 0)}
                  icon={DollarSign}
                  variant={(currentMonth?.cpr || 0) < 50 ? "success" : "warning"}
                />
                <MetricCard
                  title="Coût/Acquisition (CAC)"
                  value={formatCurrency(currentMonth?.cac || 0)}
                  icon={DollarSign}
                  variant={(currentMonth?.cac || 0) < 100 ? "success" : "warning"}
                />
              </div>
            </CollapsibleSection>

            <CollapsibleSection 
              title="LTV & ACRM" 
              icon={TrendingUp}
              defaultOpen={false}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <MetricCardWithTooltip
                  title="LTV Général"
                  value={formatCurrency(currentMonth?.general_ltv || 0)}
                  icon={DollarSign}
                  variant="default"
                  tooltip={KPI_TOOLTIPS.ltv}
                />
                <MetricCardWithTooltip
                  title="ACRM Général"
                  value={formatCurrency(currentMonth?.general_acrm || 0)}
                  icon={DollarSign}
                  variant="default"
                  tooltip={KPI_TOOLTIPS.acrm}
                />
                <MetricCardWithTooltip
                  title="LTV PT"
                  value={formatCurrency(currentMonth?.pt_ltv || 0)}
                  icon={DollarSign}
                  variant="default"
                  tooltip={KPI_TOOLTIPS.ltv}
                />
                <MetricCardWithTooltip
                  title="ACRM PT"
                  value={formatCurrency(currentMonth?.pt_acrm || 0)}
                  icon={DollarSign}
                  variant="default"
                  tooltip={KPI_TOOLTIPS.acrm}
                />
              </div>
            </CollapsibleSection>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
