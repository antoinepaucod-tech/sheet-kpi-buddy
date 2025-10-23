import { useAnnualKPIData } from '@/hooks/useAnnualKPIData';
import { MetricCard } from '@/components/MetricCard';
import { KPIChart } from '@/components/KPIChart';
import { ThemeToggle } from '@/components/ThemeToggle';
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

const Annual = () => {
  const { annualData, monthlyData, isLoading } = useAnnualKPIData();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-lg">Chargement des données annuelles...</div>
      </div>
    );
  }

  if (!annualData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-lg">Aucune donnée disponible pour l'année {new Date().getFullYear()}</p>
          <Link to="/">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour au tableau de bord
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const callRate = annualData.leads > 0 ? (annualData.callsMade / annualData.leads) * 100 : 0;
  const schedRate = annualData.callsMade > 0 ? (annualData.scheduled / annualData.callsMade) * 100 : 0;
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
        <div className="container mx-auto px-4 py-8 space-y-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-4xl font-bold text-heading tracking-tight">
                Synthèse Annuelle {annualData.year}
              </h1>
              <p className="text-muted-foreground mt-2">Vue d'ensemble de l'année complète</p>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/">
                <Button variant="outline">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Mensuel
                </Button>
              </Link>
              <ThemeToggle />
            </div>
          </div>

          {/* Key Metrics Overview */}
          <section className="space-y-6">
            <h2 className="text-2xl font-medium text-heading tracking-tight">Métriques Clés</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Revenu Total"
                value={formatCurrency(annualData.totalRevenue)}
                icon={DollarSign}
                variant="default"
              />
              <MetricCard
                title="Profit"
                value={formatCurrency(annualData.profit)}
                icon={PiggyBank}
                trend={profitMargin}
                suffix={` (${formatPercentage(profitMargin)})`}
                variant={annualData.profit > 0 ? "success" : "destructive"}
              />
              <MetricCard
                title="Membres Actifs"
                value={annualData.totalActiveMembers}
                icon={Users}
                variant="default"
              />
              <MetricCard
                title="Taux de Conversion"
                value={formatPercentage(closeRate)}
                icon={Target}
                variant={closeRate > 50 ? "success" : "warning"}
              />
            </div>
          </section>

          {/* Revenue Breakdown */}
          <section className="space-y-6">
            <h2 className="text-2xl font-medium text-heading tracking-tight">Détail des Revenus</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Revenu General EFT"
                value={formatCurrency(annualData.generalEFTRevenue)}
                icon={DollarSign}
                variant="default"
              />
              <MetricCard
                title="Revenu PT"
                value={formatCurrency(annualData.ptRevenue)}
                icon={DollarSign}
                variant="default"
              />
              <MetricCard
                title="Revenu Retail"
                value={formatCurrency(annualData.retailRevenue)}
                icon={DollarSign}
                variant="default"
              />
              <MetricCard
                title="Cash Collecté"
                value={formatCurrency(annualData.cashCollected)}
                icon={Wallet}
                variant="default"
              />
            </div>
            {revenueChartData.length > 0 && (
              <KPIChart
                title="Évolution Mensuelle des Revenus"
                data={revenueChartData}
                type="bar"
                dataKeys={[
                  { key: "revenuTotal", name: "Revenu Total", color: "hsl(var(--primary))" },
                  { key: "generalEFT", name: "General EFT", color: "hsl(var(--chart-1))" },
                  { key: "pt", name: "PT", color: "hsl(var(--chart-2))" },
                  { key: "retail", name: "Retail", color: "hsl(var(--chart-3))" },
                  { key: "cashCollecte", name: "Cash Collecté", color: "hsl(var(--chart-4))" },
                ]}
              />
            )}
          </section>

          {/* Members Overview */}
          <section className="space-y-6">
            <h2 className="text-2xl font-medium text-heading tracking-tight">Membres</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Membres Actifs"
                value={annualData.totalActiveMembers}
                icon={Users}
                variant="default"
              />
              <MetricCard
                title="Membres PIF"
                value={annualData.pifMembers}
                icon={Users}
                variant="default"
              />
              <MetricCard
                title="Membres Général"
                value={annualData.recurringGeneralMembers}
                icon={Users}
                variant="default"
              />
              <MetricCard
                title="Membres PT"
                value={annualData.ptMembers}
                icon={Users}
                variant="default"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Total Sorties"
                value={annualData.totalExits}
                icon={UserMinus}
                variant="destructive"
              />
              <MetricCard
                title="Sorties PIF"
                value={annualData.pifExits}
                icon={UserMinus}
                variant="destructive"
              />
              <MetricCard
                title="Sorties Général"
                value={annualData.generalExits}
                icon={UserMinus}
                variant="destructive"
              />
              <MetricCard
                title="Sorties PT"
                value={annualData.ptExits}
                icon={UserMinus}
                variant="destructive"
              />
            </div>
            {membersChartData.length > 0 && (
              <KPIChart
                title="Évolution Mensuelle des Membres"
                data={membersChartData}
                type="bar"
                dataKeys={[
                  { key: "totalActifs", name: "Total Actifs", color: "hsl(var(--primary))" },
                  { key: "pif", name: "PIF", color: "hsl(var(--chart-1))" },
                  { key: "general", name: "Général", color: "hsl(var(--chart-2))" },
                  { key: "pt", name: "PT", color: "hsl(var(--chart-3))" },
                ]}
              />
            )}
          </section>

          {/* Sales Funnel */}
          <section className="space-y-6">
            <h2 className="text-2xl font-medium text-heading tracking-tight">Entonnoir de Ventes</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Leads"
                value={annualData.leads}
                icon={UserPlus}
                variant="default"
              />
              <MetricCard
                title="Appels"
                value={annualData.callsMade}
                icon={Phone}
                trend={callRate}
                suffix={` (${formatPercentage(callRate)})`}
                variant="default"
              />
              <MetricCard
                title="Rendez-vous"
                value={annualData.scheduled}
                icon={Calendar}
                trend={schedRate}
                suffix={` (${formatPercentage(schedRate)})`}
                variant="default"
              />
              <MetricCard
                title="Présents"
                value={annualData.show}
                icon={Eye}
                trend={showRate}
                suffix={` (${formatPercentage(showRate)})`}
                variant="default"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <MetricCard
                title="Ventes Fermées"
                value={annualData.close}
                icon={Target}
                trend={closeRate}
                suffix={` (${formatPercentage(closeRate)})`}
                variant={closeRate > 50 ? "success" : "default"}
              />
              <MetricCard
                title="Cash Collecté"
                value={formatCurrency(annualData.cashCollected)}
                icon={Wallet}
                variant="default"
              />
              <MetricCard
                title="Avg Par Vente"
                value={formatCurrency(avgPerSale)}
                icon={DollarSign}
                variant="default"
              />
            </div>
            {salesFunnelChartData.length > 0 && (
              <KPIChart
                title="Évolution Mensuelle de l'Entonnoir de Ventes"
                data={salesFunnelChartData}
                type="bar"
                dataKeys={[
                  { key: "leads", name: "Leads", color: "hsl(var(--chart-1))" },
                  { key: "appels", name: "Appels", color: "hsl(var(--chart-2))" },
                  { key: "rdv", name: "RDV", color: "hsl(var(--chart-3))" },
                  { key: "presents", name: "Présents", color: "hsl(var(--chart-4))" },
                  { key: "ventes", name: "Ventes", color: "hsl(var(--primary))" },
                ]}
              />
            )}
          </section>

          {/* Organic & Trials */}
          <section className="space-y-6">
            <h2 className="text-2xl font-medium text-heading tracking-tight">Organique & Essais</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Leads Organiques"
                value={annualData.organicLeads}
                icon={UserPlus}
                variant="default"
              />
              <MetricCard
                title="Ventes Organiques"
                value={annualData.organicClose}
                icon={Target}
                trend={organicCloseRate}
                suffix={` (${formatPercentage(organicCloseRate)})`}
                variant="default"
              />
              <MetricCard
                title="Cash Organique"
                value={formatCurrency(annualData.organicCashCollected)}
                icon={Wallet}
                variant="default"
              />
              <MetricCard
                title="Essais Convertis"
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
            <h2 className="text-2xl font-medium text-heading tracking-tight">Résumé Financier</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <MetricCard
                title="Dépenses Pub"
                value={formatCurrency(annualData.adSpend)}
                icon={DollarSign}
                variant="destructive"
              />
              <MetricCard
                title="Dépenses Totales"
                value={formatCurrency(annualData.totalExpenses)}
                icon={DollarSign}
                variant="destructive"
              />
              <MetricCard
                title="Profit"
                value={formatCurrency(annualData.profit)}
                icon={PiggyBank}
                trend={profitMargin}
                suffix={` (${formatPercentage(profitMargin)})`}
                variant={annualData.profit > 0 ? "success" : "destructive"}
              />
              <MetricCard
                title="CAC"
                value={formatCurrency(cac)}
                icon={DollarSign}
                variant={cac < 100 ? "success" : "warning"}
              />
              <MetricCard
                title="RoAds"
                value={formatPercentage(roAds)}
                icon={TrendingUp}
                variant={roAds > 200 ? "success" : roAds > 100 ? "warning" : "destructive"}
              />
            </div>
            {financialChartData.length > 0 && (
              <KPIChart
                title="Évolution Mensuelle Financière"
                data={financialChartData}
                type="bar"
                dataKeys={[
                  { key: "revenu", name: "Revenu", color: "hsl(var(--chart-1))" },
                  { key: "depenses", name: "Dépenses", color: "hsl(var(--destructive))" },
                  { key: "profit", name: "Profit", color: "hsl(var(--primary))" },
                ]}
              />
            )}
          </section>

          {/* Additional Metrics */}
          <section className="space-y-6">
            <h2 className="text-2xl font-medium text-heading tracking-tight">Métriques Additionnelles</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Classes Totales"
                value={annualData.totalClasses}
                icon={Activity}
                variant="default"
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
                title="En Essai"
                value={annualData.inTrial}
                icon={Users}
                variant="default"
              />
            </div>
          </section>

          {/* Churn Rates */}
          <section className="space-y-6">
            <h2 className="text-2xl font-medium text-heading tracking-tight">Taux de Désabonnement (Churn)</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard
                title="PIF Churn"
                value={formatPercentage(annualData.pifChurn)}
                icon={Users}
                variant={annualData.pifChurn < 5 ? "success" : annualData.pifChurn < 10 ? "warning" : "destructive"}
              />
              <MetricCard
                title="General Churn"
                value={formatPercentage(annualData.generalChurn)}
                icon={Users}
                variant={annualData.generalChurn < 5 ? "success" : annualData.generalChurn < 10 ? "warning" : "destructive"}
              />
              <MetricCard
                title="PT Churn"
                value={formatPercentage(annualData.ptChurn)}
                icon={Users}
                variant={annualData.ptChurn < 5 ? "success" : annualData.ptChurn < 10 ? "warning" : "destructive"}
              />
            </div>
            {churnChartData.length > 0 && (
              <KPIChart
                title="Évolution Mensuelle du Churn"
                data={churnChartData}
                type="line"
                dataKeys={[
                  { key: "pifChurn", name: "PIF Churn", color: "hsl(var(--chart-1))" },
                  { key: "generalChurn", name: "General Churn", color: "hsl(var(--chart-2))" },
                  { key: "ptChurn", name: "PT Churn", color: "hsl(var(--chart-3))" },
                ]}
              />
            )}
          </section>

          {/* Advanced Metrics */}
          <section className="space-y-6">
            <h2 className="text-2xl font-medium text-heading tracking-tight">Métriques Avancées (LTV & ACRM)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <MetricCard
                title="General ACRM"
                value={formatCurrency(annualData.generalACRM)}
                icon={DollarSign}
                variant="default"
              />
              <MetricCard
                title="General LTV"
                value={formatCurrency(annualData.generalLTV)}
                icon={TrendingUp}
                variant="success"
              />
              <MetricCard
                title="PT ACRM"
                value={formatCurrency(annualData.ptACRM)}
                icon={DollarSign}
                variant="default"
              />
              <MetricCard
                title="PT LTV"
                value={formatCurrency(annualData.ptLTV)}
                icon={TrendingUp}
                variant="success"
              />
              <MetricCard
                title="Gym Floor SQFT"
                value={annualData.gymFloorSQFT}
                icon={Activity}
                variant="default"
              />
            </div>
          </section>
        </div>
    </div>
  );
};

export default Annual;
