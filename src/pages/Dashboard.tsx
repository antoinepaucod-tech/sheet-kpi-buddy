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
  BarChart3
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useMonthlyKPIData } from "@/hooks/useMonthlyKPIData";
import { useCustomerMembers } from "@/hooks/useCustomerMembers";
import { useCourseKPIData } from "@/hooks/useCourseKPIData";
import { useAccountingTransactions } from "@/hooks/useAccountingTransactions";
import { useTranslations } from "@/hooks/useTranslations";
import { useMemo } from "react";
import { KPIChart } from "@/components/KPIChart";

const Dashboard = () => {
  const navigate = useNavigate();
  const { t } = useTranslations();
  const { monthlyData, currentYear } = useMonthlyKPIData();
  const { members } = useCustomerMembers();
  const { courses } = useCourseKPIData(currentYear, new Date().getMonth() + 1);
  const { transactions } = useAccountingTransactions(currentYear, new Date().getMonth() + 1);

  // Calculate current month KPIs
  const currentMonthData = monthlyData[new Date().getMonth()];
  const activeMembers = members.filter(m => !m.exit_date || new Date(m.exit_date) > new Date()).length;
  
  const monthlyRevenue = useMemo(() => {
    return transactions
      .filter(t => t.transaction_type === 'revenue')
      .reduce((sum, t) => sum + (t.amount_received || 0), 0);
  }, [transactions]);

  const monthlyExpenses = useMemo(() => {
    return transactions
      .filter(t => t.transaction_type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  const unpaidCount = useMemo(() => {
    return transactions.filter(t => 
      t.transaction_type === 'revenue' && 
      (t.amount_received || 0) < t.amount
    ).length;
  }, [transactions]);

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
      color: "text-blue-600 dark:text-blue-400"
    },
    {
      title: "Ajouter une transaction",
      description: "Revenu ou dépense",
      icon: Plus,
      onClick: () => navigate("/accounting"),
      color: "text-green-600 dark:text-green-400"
    },
    {
      title: "Gérer les cours",
      description: "Planning et présences",
      icon: CalendarPlus,
      onClick: () => navigate("/course-kpi"),
      color: "text-purple-600 dark:text-purple-400"
    },
    {
      title: "KPI Client",
      description: "Analyser l'activité",
      icon: FileText,
      onClick: () => navigate("/kpi-client"),
      color: "text-orange-600 dark:text-orange-400"
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
            <p className="text-muted-foreground mt-1">Vue d'ensemble de votre activité</p>
          </div>
          <div className="flex gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>

        {/* Main KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-emerald-500 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/kpi-revenue")}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Revenus du Mois
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(monthlyRevenue)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Cash collecté
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/customer-journey")}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Membres Actifs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {activeMembers}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Inscrits actuellement
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/course-kpi")}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Cours Actifs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                {courses.length}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Ce mois-ci
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/accounting")}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Impayés
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                {unpaidCount}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Transactions à valider
              </p>
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
                  { key: "revenue", name: "Revenus", color: "#10b981" },
                  { key: "expenses", name: "Dépenses", color: "#f59e0b" },
                  { key: "profit", name: "Profit", color: "#3b82f6" },
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
                  <span className="text-sm text-muted-foreground">Revenus</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(monthlyRevenue)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Dépenses</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                    {formatCurrency(monthlyExpenses)}
                  </span>
                </div>
                <div className="h-px bg-border my-2" />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Profit</span>
                  <span className={`font-bold text-lg ${
                    (monthlyRevenue - monthlyExpenses) >= 0 
                      ? "text-emerald-600 dark:text-emerald-400" 
                      : "text-rose-600 dark:text-rose-400"
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

        {/* Navigation to detailed pages */}
        <Card>
          <CardHeader>
            <CardTitle>Accès aux Modules</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Button 
              variant="outline" 
              className="justify-start h-auto py-3"
              onClick={() => navigate("/kpi-revenue")}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              <div className="text-left">
                <div className="font-medium">KPI Revenu</div>
                <div className="text-xs text-muted-foreground">Analyse mensuelle détaillée</div>
              </div>
            </Button>
            
            <Button 
              variant="outline" 
              className="justify-start h-auto py-3"
              onClick={() => navigate("/kpi-client")}
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              <div className="text-left">
                <div className="font-medium">KPI Client</div>
                <div className="text-xs text-muted-foreground">Activité des membres</div>
              </div>
            </Button>
            
            <Button 
              variant="outline" 
              className="justify-start h-auto py-3"
              onClick={() => navigate("/course-kpi")}
            >
              <Calendar className="h-4 w-4 mr-2" />
              <div className="text-left">
                <div className="font-medium">KPI Cours</div>
                <div className="text-xs text-muted-foreground">Gestion des cours</div>
              </div>
            </Button>
            
            <Button 
              variant="outline" 
              className="justify-start h-auto py-3"
              onClick={() => navigate("/customer-journey")}
            >
              <Users className="h-4 w-4 mr-2" />
              <div className="text-left">
                <div className="font-medium">Parcours Client</div>
                <div className="text-xs text-muted-foreground">Suivi individuel</div>
              </div>
            </Button>
            
            <Button 
              variant="outline" 
              className="justify-start h-auto py-3"
              onClick={() => navigate("/accounting")}
            >
              <Receipt className="h-4 w-4 mr-2" />
              <div className="text-left">
                <div className="font-medium">Comptabilité</div>
                <div className="text-xs text-muted-foreground">Revenus et dépenses</div>
              </div>
            </Button>
            
            <Button 
              variant="outline" 
              className="justify-start h-auto py-3"
              onClick={() => navigate("/annual")}
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              <div className="text-left">
                <div className="font-medium">Vue Annuelle</div>
                <div className="text-xs text-muted-foreground">Synthèse de l'année</div>
              </div>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
