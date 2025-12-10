import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCustomerMembers } from "@/hooks/useCustomerMembers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MemberActivityDialog } from "@/components/MemberActivityDialog";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { InteractiveChart } from "@/components/InteractiveChart";
import { 
  subMonths, 
  differenceInWeeks, 
  differenceInMonths, 
  differenceInDays, 
  parseISO,
  subWeeks,
  isAfter 
} from "date-fns";
import { 
  Users, 
  AlertTriangle, 
  TrendingUp, 
  Activity, 
  Filter,
  BarChart3,
  CheckCircle2,
  XCircle,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";

// Memberships that require training tracking
const trackingRequiredMemberships = [
  "Hybrid FULL - paiement tous les 28 jours YOUNG / STUDENT",
  "Hybrid FULL - paiement tous les 28 jours avec engagement",
  "Hybrid FULL - Paiement x1 Annuel",
  "Hybrid FULL DUO . Paiement x1 Annuel",
  "Unlimited Access (ancien membership)",
  "Unlimited Access 6 mois (ancien membership)",
  "Abonnement offert",
  "Hybrid FULL tous les 28 jours - sans engagement",
  "Pack 20 sessions",
  "Pack 10",
  "6 Weeks Challenge",
];

// Membership categories for filtering
const membershipCategories = [
  { value: "all", label: "Tous les abonnements" },
  { value: "hybrid", label: "Hybrid FULL" },
  { value: "unlimited", label: "Unlimited Access" },
  { value: "pack", label: "Packs (10/20 sessions)" },
  { value: "other", label: "Autres" },
];

const getMembershipCategory = (membership: string): string => {
  if (membership.toLowerCase().includes("hybrid")) return "hybrid";
  if (membership.toLowerCase().includes("unlimited")) return "unlimited";
  if (membership.toLowerCase().includes("pack")) return "pack";
  return "other";
};

const requiresTrainingTracking = (membership: string): boolean => {
  return trackingRequiredMemberships.includes(membership);
};

// Engagement level calculation based on average trainings per week
// Élevé: 3+ séances/semaine, Moyen: 2 séances, Faible: 1 séance, À risque: 0 séance
type EngagementLevel = "high" | "medium" | "low" | "at-risk";

const getEngagementLevel = (averagePerWeek: number, weeksSinceLastTraining: number): EngagementLevel => {
  // À risque si 0 séance par semaine (arrondi)
  if (Math.round(averagePerWeek) === 0) return "at-risk";
  // Faible si 1 séance par semaine
  if (Math.round(averagePerWeek) === 1) return "low";
  // Moyen si 2 séances par semaine
  if (Math.round(averagePerWeek) === 2) return "medium";
  // Élevé si 3+ séances par semaine
  return "high";
};

const engagementStyles: Record<EngagementLevel, { bg: string; text: string; label: string; icon: typeof CheckCircle2 }> = {
  high: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", label: "Élevé (3+ séances/sem.)", icon: CheckCircle2 },
  medium: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", label: "Moyen (2 séances)", icon: Clock },
  low: { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", label: "Faible (1 séance)", icon: AlertTriangle },
  "at-risk": { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", label: "À risque (0 séance)", icon: XCircle },
};

export default function KPIClient() {
  const navigate = useNavigate();
  const { members, weeklyTrainings, isLoading } = useCustomerMembers();
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [membershipFilter, setMembershipFilter] = useState<string>("all");

  const memberStats = useMemo(() => {
    const now = new Date();
    const twelveMonthsAgo = subMonths(now, 12);

    return members
      .filter(member => requiresTrainingTracking(member.membership))
      .map(member => {
        if (!member.contract_signed_date) {
          return {
            id: member.id,
            name: member.name,
            membership: member.membership,
            membershipCategory: getMembershipCategory(member.membership),
            totalTrainings: 0,
            averagePerMonth: 0,
            averagePerWeek: 0,
            monthsSinceSignature: 0,
            weeksSinceSignature: 0,
            weeksSinceLastTraining: 999,
            engagementLevel: "at-risk" as EngagementLevel,
          };
        }

        const signatureDate = parseISO(member.contract_signed_date);
        const startDate = signatureDate > twelveMonthsAgo ? signatureDate : twelveMonthsAgo;
        
        const daysSinceStart = differenceInDays(now, startDate);
        const monthsSinceStart = Math.max(1, daysSinceStart / 30.44);
        const weeksSinceStart = Math.max(1, daysSinceStart / 7);
        
        const monthsSinceSignature = differenceInMonths(now, startDate);
        const weeksSinceSignature = differenceInWeeks(now, startDate);
        
        const memberTrainings = weeklyTrainings.filter(wt => wt.member_id === member.id);
        const totalTrainings = memberTrainings.reduce((sum, wt) => sum + wt.trainings_count, 0);
        
        // Calculate current relative week for this member (weeks since contract_signed_date)
        const currentMemberWeek = Math.max(1, Math.ceil(differenceInDays(now, signatureDate) / 7));
        
        // Find last training week
        const lastTraining = memberTrainings
          .filter(t => t.trainings_count > 0)
          .sort((a, b) => b.week_number - a.week_number)[0];
        const weeksSinceLastTraining = lastTraining 
          ? Math.max(0, currentMemberWeek - lastTraining.week_number)
          : 999;
        
        const averagePerMonth = totalTrainings / monthsSinceStart;
        const averagePerWeek = totalTrainings / weeksSinceStart;

        return {
          id: member.id,
          name: member.name,
          membership: member.membership,
          membershipCategory: getMembershipCategory(member.membership),
          totalTrainings,
          averagePerMonth,
          averagePerWeek,
          monthsSinceSignature,
          weeksSinceSignature,
          weeksSinceLastTraining,
          engagementLevel: getEngagementLevel(averagePerWeek, weeksSinceLastTraining),
        };
      });
  }, [members, weeklyTrainings]);

  // Filter by membership category
  const filteredStats = useMemo(() => {
    if (membershipFilter === "all") return memberStats;
    return memberStats.filter(s => s.membershipCategory === membershipFilter);
  }, [memberStats, membershipFilter]);

  // Sort by total trainings
  const sortedStats = useMemo(() => {
    const sorted = [...filteredStats].sort((a, b) => b.totalTrainings - a.totalTrainings);
    return sortOrder === "asc" ? sorted.reverse() : sorted;
  }, [filteredStats, sortOrder]);

  // At-risk members (haven't trained in 3+ weeks)
  const atRiskMembers = useMemo(() => {
    return memberStats.filter(m => m.engagementLevel === "at-risk");
  }, [memberStats]);

  // Engagement distribution
  const engagementDistribution = useMemo(() => {
    const dist = { high: 0, medium: 0, low: 0, "at-risk": 0 };
    memberStats.forEach(m => dist[m.engagementLevel]++);
    return dist;
  }, [memberStats]);

  // Chart data - monthly average trainings
  const chartData = useMemo(() => {
    const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
    return months.map((month, index) => {
      const monthMembers = memberStats.filter(m => m.monthsSinceSignature >= (11 - index));
      const avgTrainings = monthMembers.length > 0
        ? monthMembers.reduce((sum, m) => sum + m.averagePerMonth, 0) / monthMembers.length
        : 0;
      return {
        month,
        moyenneEntrainements: parseFloat(avgTrainings.toFixed(1)),
        membresActifs: monthMembers.filter(m => m.engagementLevel !== "at-risk").length,
      };
    });
  }, [memberStats]);

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="text-center">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="container py-4 sm:py-8 px-3 sm:px-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-4xl font-bold mb-1 sm:mb-2">KPI Client</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Statistiques d'entraînement par membre sur les 12 derniers mois
          </p>
        </div>
        <ThemeToggle />
      </div>

      {/* At-Risk Alert */}
      {atRiskMembers.length > 0 && (
        <Card className="border-rose-500/50 bg-rose-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-5 w-5" />
              Membres à Risque ({atRiskMembers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Ces membres n'ont pas entraîné depuis 3 semaines ou plus
            </p>
            <div className="flex flex-wrap gap-2">
              {atRiskMembers.slice(0, 10).map(member => (
                <Badge 
                  key={member.id} 
                  variant="outline" 
                  className="cursor-pointer hover:bg-rose-500/10 border-rose-500/30"
                  onClick={() => setSelectedMemberId(member.id)}
                >
                  {member.name}
                </Badge>
              ))}
              {atRiskMembers.length > 10 && (
                <Badge variant="outline" className="border-rose-500/30">
                  +{atRiskMembers.length - 10} autres
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Engagement Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {(Object.entries(engagementDistribution) as [EngagementLevel, number][]).map(([level, count]) => {
          const style = engagementStyles[level];
          const Icon = style.icon;
          return (
            <Card key={level} className={cn("border", style.bg)}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{style.label}</p>
                    <p className={cn("text-2xl font-bold", style.text)}>{count}</p>
                  </div>
                  <Icon className={cn("h-6 w-6", style.text)} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Evolution Chart */}
      <CollapsibleSection 
        title="Évolution de l'Engagement" 
        icon={TrendingUp}
        defaultOpen={false}
      >
        <InteractiveChart
          data={chartData}
          title=""
          type="line"
          height={300}
          dataKeys={[
            { key: "moyenneEntrainements", name: "Moyenne Entraînements/Mois", color: "hsl(220, 90%, 56%)" },
            { key: "membresActifs", name: "Membres Actifs", color: "hsl(142, 76%, 36%)" },
          ]}
        />
      </CollapsibleSection>

      {/* Members Table */}
      <CollapsibleSection 
        title="Liste des Membres" 
        icon={Users}
        badge={`${sortedStats.length} membres`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div className="flex items-center gap-2 flex-1">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={membershipFilter} onValueChange={setMembershipFilter}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {membershipCategories.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Select value={sortOrder} onValueChange={(value: "desc" | "asc") => setSortOrder(value)}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Plus actifs → Moins actifs</SelectItem>
              <SelectItem value="asc">Moins actifs → Plus actifs</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto -mx-3 sm:mx-0">
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Engagement</TableHead>
                <TableHead className="text-right">Total (12 mois)</TableHead>
                <TableHead className="text-right">Moy./Mois</TableHead>
                <TableHead className="text-right">Moy./Sem.</TableHead>
                <TableHead className="text-right">Ancienneté</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedStats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Aucune donnée disponible
                  </TableCell>
                </TableRow>
              ) : (
                sortedStats.map((stat) => {
                  const style = engagementStyles[stat.engagementLevel];
                  const Icon = style.icon;
                  return (
                    <TableRow 
                      key={stat.id}
                      className={cn(
                        "transition-colors",
                        stat.engagementLevel === "at-risk" && "bg-rose-500/5",
                        stat.engagementLevel === "high" && "bg-emerald-500/5"
                      )}
                    >
                      <TableCell 
                        className="font-medium cursor-pointer hover:text-primary hover:underline transition-colors"
                        onClick={() => setSelectedMemberId(stat.id)}
                      >
                        {stat.name}
                      </TableCell>
                      <TableCell>
                        <div className={cn("flex items-center gap-1.5 text-xs font-medium", style.text)}>
                          <Icon className="h-3.5 w-3.5" />
                          {style.label}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{stat.totalTrainings}</TableCell>
                      <TableCell className="text-right">{stat.averagePerMonth.toFixed(1)}</TableCell>
                      <TableCell className="text-right">{stat.averagePerWeek.toFixed(1)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {stat.monthsSinceSignature} mois
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CollapsibleSection>

      {/* Global Statistics */}
      <CollapsibleSection 
        title="Statistiques Globales" 
        icon={BarChart3}
        defaultOpen={false}
      >
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 bg-muted/30 rounded-lg">
            <p className="text-xs sm:text-sm text-muted-foreground">Moyenne globale / Mois</p>
            <p className="text-xl sm:text-2xl font-bold">
              {memberStats.length > 0
                ? (memberStats.reduce((sum, s) => sum + s.averagePerMonth, 0) / memberStats.length).toFixed(1)
                : "0.0"}
            </p>
          </div>
          <div className="p-4 bg-muted/30 rounded-lg">
            <p className="text-xs sm:text-sm text-muted-foreground">Moyenne globale / Semaine</p>
            <p className="text-xl sm:text-2xl font-bold">
              {memberStats.length > 0
                ? (memberStats.reduce((sum, s) => sum + s.averagePerWeek, 0) / memberStats.length).toFixed(1)
                : "0.0"}
            </p>
          </div>
          <div className="p-4 bg-muted/30 rounded-lg">
            <p className="text-xs sm:text-sm text-muted-foreground">Total membres suivis</p>
            <p className="text-xl sm:text-2xl font-bold">{memberStats.length}</p>
          </div>
          <div className="p-4 bg-muted/30 rounded-lg">
            <p className="text-xs sm:text-sm text-muted-foreground">Taux d'engagement</p>
            <p className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {memberStats.length > 0
                ? Math.round(((engagementDistribution.high + engagementDistribution.medium) / memberStats.length) * 100)
                : 0}%
            </p>
          </div>
        </div>
      </CollapsibleSection>

      <MemberActivityDialog
        member={members.find(m => m.id === selectedMemberId) || null}
        weeklyTrainings={weeklyTrainings}
        onClose={() => setSelectedMemberId(null)}
        onNavigateToWeek={(week, year, memberId) => {
          navigate(`/customer-journey?week=${week}&year=${year}&memberId=${memberId}`);
        }}
      />
    </div>
  );
}
