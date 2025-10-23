import { useState } from 'react';
import { useAnnualKPIData } from '@/hooks/useAnnualKPIData';
import { MetricCard } from '@/components/MetricCard';
import { KPIChart } from '@/components/KPIChart';
import { ThemeToggle } from '@/components/ThemeToggle';
import { VideoSettings } from '@/components/VideoSettings';
import { VideoBackground } from '@/components/VideoBackground';
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
  const { annualData, isLoading } = useAnnualKPIData();
  
  const [videoConfig, setVideoConfig] = useState(() => {
    const saved = localStorage.getItem("video-config");
    return saved ? JSON.parse(saved) : { url: "", overlayOpacity: 0.7, enabled: false };
  });

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

  return (
    <VideoBackground
      videoUrl={videoConfig.enabled ? videoConfig.url : undefined}
      overlayOpacity={videoConfig.overlayOpacity}
    >
      <div className="min-h-screen">
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
              <Link to="/weekly">
                <Button variant="outline">Hebdomadaire</Button>
              </Link>
              <VideoSettings onConfigChange={setVideoConfig} />
              <ThemeToggle />
            </div>
          </div>

          {/* Revenue Overview */}
          <section className="space-y-6">
            <h2 className="text-2xl font-medium text-heading tracking-tight">Revenu Total</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <MetricCard
                title="Revenu Total"
                value={formatCurrency(annualData.totalRevenue)}
                icon={DollarSign}
                variant="default"
              />
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
                title="Fast Cash"
                value={formatCurrency(annualData.fastCashRevenue)}
                icon={DollarSign}
                variant="default"
              />
            </div>
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
          </section>

          {/* Additional Metrics */}
          <section className="space-y-6">
            <h2 className="text-2xl font-medium text-heading tracking-tight">Métriques Additionnelles</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <MetricCard
                title="Classes Totales"
                value={annualData.totalClasses}
                icon={Activity}
                variant="default"
              />
              <MetricCard
                title="En Essai"
                value={annualData.inTrial}
                icon={Users}
                variant="default"
              />
              <MetricCard
                title="Pauses"
                value={annualData.pauses}
                icon={Users}
                variant="default"
              />
            </div>
          </section>
        </div>
      </div>
    </VideoBackground>
  );
};

export default Annual;
