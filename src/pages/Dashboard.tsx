import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { 
  TrendingUp, 
  Users, 
  Calendar, 
  Receipt, 
  Plus,
  DollarSign,
  UserPlus,
  CalendarPlus,
  FileText,
  ArrowRight,
  BarChart3,
  Sparkles,
  Loader2,
  Dumbbell
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useMonthlyKPIData } from "@/hooks/useMonthlyKPIData";
import { useCustomerMembers } from "@/hooks/useCustomerMembers";
import { useCourseKPIData } from "@/hooks/useCourseKPIData";
import { useAccountingTransactions } from "@/hooks/useAccountingTransactions";
import { useTranslations } from "@/hooks/useTranslations";
import { useCoachMembership } from "@/hooks/useCoachMembership";
import { useMemo, useState, useEffect } from "react";
import { KPIChart } from "@/components/KPIChart";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

const Dashboard = () => {
  const navigate = useNavigate();
  const { t } = useTranslations();
  const { monthlyData, currentYear } = useMonthlyKPIData();
  const { members } = useCustomerMembers();
  const { courses } = useCourseKPIData(currentYear, new Date().getMonth() + 1);
  const { transactions } = useAccountingTransactions(currentYear, new Date().getMonth());
  const { isCoachMembership } = useCoachMembership();

  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);

  // Calculate current month KPIs
  const currentMonthData = monthlyData[new Date().getMonth()];
  
  // Calculate REAL active members from customer_members (not transactions)
  const { activeMembersCount, activeCoachesCount } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const activeMembers = members.filter(m => {
      // Check if member is still active (no exit_date or exit_date in future)
      if (m.exit_date) {
        const exitDate = new Date(m.exit_date);
        if (exitDate < today) return false;
      }
      // Also check subscription_end_date as fallback
      if (!m.exit_date && m.subscription_end_date) {
        const endDate = new Date(m.subscription_end_date);
        if (endDate < today) return false;
      }
      return true;
    });
    
    const clubMembers = activeMembers.filter(m => !isCoachMembership(m.membership));
    const coaches = activeMembers.filter(m => isCoachMembership(m.membership));
    
    return {
      activeMembersCount: clubMembers.length,
      activeCoachesCount: coaches.length,
    };
  }, [members, isCoachMembership]);
  
  // Separate revenue for members vs coaches (from transactions)
  const { monthlyRevenue, coachRevenue, memberRevenue, coachCount, memberCount, unpaidCount, unpaidMemberCount, unpaidCoachCount } = useMemo(() => {
    const revenueTransactions = transactions.filter(t => t.transaction_type === 'revenue');
    
    const coachTxs = revenueTransactions.filter(t => isCoachMembership(t.category));
    const memberTxs = revenueTransactions.filter(t => !isCoachMembership(t.category));
    
    return {
      monthlyRevenue: revenueTransactions.reduce((sum, t) => sum + (t.amount_received || 0), 0),
      coachRevenue: coachTxs.reduce((sum, t) => sum + (t.amount_received || 0), 0),
      memberRevenue: memberTxs.reduce((sum, t) => sum + (t.amount_received || 0), 0),
      coachCount: coachTxs.length,
      memberCount: memberTxs.length,
      unpaidCount: revenueTransactions.filter(t => (t.amount_received || 0) < t.amount).length,
      unpaidMemberCount: memberTxs.filter(t => (t.amount_received || 0) < t.amount).length,
      unpaidCoachCount: coachTxs.filter(t => (t.amount_received || 0) < t.amount).length,
    };
  }, [transactions, isCoachMembership]);

  const monthlyExpenses = useMemo(() => {
    return transactions
      .filter(t => t.transaction_type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  // Load AI analysis on mount
  useEffect(() => {
    if (monthlyData.length > 0 && transactions.length > 0) {
      loadAiAnalysis();
    }
  }, [monthlyData.length, activeMembersCount, monthlyRevenue, monthlyExpenses, courses.length]);

  const loadAiAnalysis = async () => {
    setIsLoadingAnalysis(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-business', {
        body: {
          monthlyData,
          activeMembers: activeMembersCount,
          monthlyRevenue,
          monthlyExpenses,
          courses: courses.length
        }
      });

      if (error) throw error;
      if (data?.analysis) {
        setAiAnalysis(data.analysis);
      }
    } catch (error: any) {
      console.error('Error loading AI analysis:', error);
      if (error.message?.includes('429')) {
        toast.error("Trop de requêtes. Veuillez patienter quelques instants.");
      } else if (error.message?.includes('402')) {
        toast.error("Crédits AI épuisés. Ajoutez des crédits dans les paramètres.");
      } else {
        toast.error("Erreur lors du chargement de l'analyse");
      }
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  // Chart data for revenue trends
  const revenueChartData = useMemo(() => {
    return monthlyData.map((data, index) => ({
      name: t(`month.${index}`),
      revenue: data.total_revenue || 0,
      expenses: data.total_expenses || 0,
      profit: data.profit || 0,
    }));
  }, [monthlyData, t]);

  const shortcuts = [
    {
      title: "Ajouter un membre",
      description: "Nouveau membre au parcours client",
      icon: UserPlus,
      onClick: () => navigate("/customer-journey"),
      color: "text-primary"
    },
    {
      title: "Ajouter une transaction",
      description: "Revenu ou dépense",
      icon: Plus,
      onClick: () => navigate("/accounting"),
      color: "text-success"
    },
    {
      title: "Gérer les cours",
      description: "Planning de base",
      icon: CalendarPlus,
      onClick: () => navigate("/course-kpi?tab=schedule-templates"),
      color: "text-primary"
    },
    {
      title: "KPI Client",
      description: "Analyser l'activité",
      icon: FileText,
      onClick: () => navigate("/kpi-client"),
      color: "text-warning"
    },
  ];

  const formatCurrency = (value: number) => {
    return `CHF ${value.toFixed(2)}`;
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-[1800px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold">Tableau de Bord</h1>
            <p className="text-muted-foreground mt-1">
              Vue d'ensemble de votre activité · {MONTHS[new Date().getMonth()]} {currentYear}
            </p>
          </div>
          <div className="flex gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>

        {/* Main KPIs - Membres */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Membres</h2>
            <Badge variant="secondary" className="text-xs">{memberCount} transactions</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-primary">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Revenus Membres
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary">
                  {formatCurrency(memberRevenue)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Cash collecté membres
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-primary/70">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Membres Actifs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary">
                  {activeMembersCount}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Inscrits actuellement
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-muted-foreground">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Cours Actifs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {courses.length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Ce mois-ci
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-destructive">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Impayés Membres
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-destructive">
                  {unpaidMemberCount}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Transactions à valider
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* KPIs - Coachs */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5 text-warning" />
            <h2 className="text-lg font-semibold">Coachs</h2>
            <Badge variant="outline" className="text-xs border-warning/50 text-warning">{coachCount} transactions</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-warning">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Revenus Coachs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-warning">
                  {formatCurrency(coachRevenue)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Cash collecté coachs
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-warning/70">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Dumbbell className="h-4 w-4" />
                  Coachs Actifs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-warning">
                  {activeCoachesCount}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Abonnés actuellement
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-destructive/70">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Impayés Coachs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-destructive">
                  {unpaidCoachCount}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Transactions à valider
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Totaux globaux */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-muted/30">
            <CardContent className="pt-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Revenus Totaux</span>
                <span className="text-xl font-bold">{formatCurrency(monthlyRevenue)}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-muted/30">
            <CardContent className="pt-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Dépenses</span>
                <span className="text-xl font-bold text-destructive">{formatCurrency(monthlyExpenses)}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-muted/30">
            <CardContent className="pt-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Profit</span>
                <span className={`text-xl font-bold ${(monthlyRevenue - monthlyExpenses) >= 0 ? "text-success" : "text-destructive"}`}>
                  {formatCurrency(monthlyRevenue - monthlyExpenses)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Financial Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Évolution Financière
              </CardTitle>
            </CardHeader>
            <CardContent>
              <KPIChart
                data={revenueChartData}
                title=""
                dataKeys={[
                  { key: "revenue", name: "Revenus", color: "hsl(var(--primary))" },
                  { key: "expenses", name: "Dépenses", color: "hsl(var(--destructive))" },
                  { key: "profit", name: "Profit", color: "hsl(var(--success))" },
                ]}
                type="line"
                showFilter={false}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Résumé Financier</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Revenus Membres</span>
                  <span className="font-semibold text-primary">
                    {formatCurrency(memberRevenue)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Revenus Coachs</span>
                  <span className="font-semibold text-warning">
                    {formatCurrency(coachRevenue)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Revenus</span>
                  <span className="font-semibold">
                    {formatCurrency(monthlyRevenue)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Dépenses</span>
                  <span className="font-semibold text-destructive">
                    {formatCurrency(monthlyExpenses)}
                  </span>
                </div>
                <div className="h-px bg-border my-2" />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Profit</span>
                  <span className={`font-bold text-lg ${
                    (monthlyRevenue - monthlyExpenses) >= 0 
                      ? "text-success" 
                      : "text-destructive"
                  }`}>
                    {formatCurrency(monthlyRevenue - monthlyExpenses)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Actions Rapides</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {shortcuts.map((shortcut) => (
              <Card 
                key={shortcut.title} 
                className="hover:shadow-lg transition-all cursor-pointer group"
                onClick={shortcut.onClick}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <shortcut.icon className={`h-8 w-8 ${shortcut.color}`} />
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                  </div>
                  <CardTitle className="text-lg">{shortcut.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{shortcut.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* AI-Powered Forecast & Goals */}
        <Card className="border-t-4 border-t-primary">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Prévisions & Objectifs
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadAiAnalysis}
                disabled={isLoadingAnalysis}
              >
                {isLoadingAnalysis ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyse en cours...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Actualiser
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingAnalysis ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : aiAnalysis ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="text-foreground whitespace-pre-line leading-relaxed">
                  {aiAnalysis}
                </p>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Cliquez sur "Actualiser" pour obtenir une analyse intelligente de vos performances</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
