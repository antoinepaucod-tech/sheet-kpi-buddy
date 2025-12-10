import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCustomerMembers } from "@/hooks/useCustomerMembers";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft,
  Users,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpDown,
  Flame,
  Calendar,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { startOfMonth, endOfMonth, getWeek } from "date-fns";
import { MemberActivityDialog } from "@/components/MemberActivityDialog";

// Membership categories for filtering
const membershipCategories = [
  { value: "all", label: "Tous les abonnements" },
  { value: "hybrid", label: "Hybrid" },
  { value: "unlimited", label: "Unlimited Access" },
  { value: "open_gym", label: "Open Gym" },
  { value: "pt", label: "Personal Training" },
  { value: "pack", label: "Packs" },
  { value: "challenge", label: "6 Weeks Challenge" },
  { value: "other", label: "Autres" },
];

const getMembershipCategory = (membership: string): string => {
  const lower = membership.toLowerCase();
  if (lower.includes("hybrid")) return "hybrid";
  if (lower.includes("unlimited access")) return "unlimited";
  if (lower.includes("open gym")) return "open_gym";
  if (lower.includes("personal training") || lower.includes("pt ")) return "pt";
  if (lower.includes("pack")) return "pack";
  if (lower.includes("6 weeks") || lower.includes("challenge")) return "challenge";
  return "other";
};

// Engagement level calculation based on average trainings per week
type EngagementLevel = "high" | "medium" | "low" | "at-risk";

const getEngagementLevel = (averagePerWeek: number): EngagementLevel => {
  if (Math.round(averagePerWeek) === 0) return "at-risk";
  if (Math.round(averagePerWeek) === 1) return "low";
  if (Math.round(averagePerWeek) === 2) return "medium";
  return "high";
};

const engagementStyles: Record<EngagementLevel, { bg: string; text: string; label: string; icon: typeof CheckCircle2 }> = {
  high: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", label: "Élevé (3+ séances/sem.)", icon: CheckCircle2 },
  medium: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", label: "Moyen (2 séances)", icon: Clock },
  low: { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", label: "Faible (1 séance)", icon: AlertTriangle },
  "at-risk": { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", label: "À risque (0 séance)", icon: XCircle },
};

// Helper to get week numbers for a specific month
const getWeeksInMonth = (year: number, month: number): number[] => {
  const weeks: number[] = [];
  const start = startOfMonth(new Date(year, month - 1));
  const end = endOfMonth(new Date(year, month - 1));
  
  let current = start;
  while (current <= end) {
    const weekNum = getWeek(current, { weekStartsOn: 1 });
    if (!weeks.includes(weekNum)) {
      weeks.push(weekNum);
    }
    current = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  return weeks;
};

const months = [
  { value: "annual", label: "Vue annuelle" },
  { value: "1", label: "Janvier" },
  { value: "2", label: "Février" },
  { value: "3", label: "Mars" },
  { value: "4", label: "Avril" },
  { value: "5", label: "Mai" },
  { value: "6", label: "Juin" },
  { value: "7", label: "Juillet" },
  { value: "8", label: "Août" },
  { value: "9", label: "Septembre" },
  { value: "10", label: "Octobre" },
  { value: "11", label: "Novembre" },
  { value: "12", label: "Décembre" },
];

export default function KPIClient() {
  const navigate = useNavigate();
  const { members, weeklyTrainings, isLoading } = useCustomerMembers();
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [membershipFilter, setMembershipFilter] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string>("annual");
  const [trackingMemberships, setTrackingMemberships] = useState<string[]>([]);

  // Fetch memberships that require training tracking from accounting_categories
  useEffect(() => {
    const fetchTrackingMemberships = async () => {
      const { data, error } = await supabase
        .from('accounting_categories')
        .select('name')
        .eq('type', 'revenue')
        .eq('requires_training_tracking', true);
      
      if (data && !error) {
        setTrackingMemberships(data.map(cat => cat.name));
      }
    };
    fetchTrackingMemberships();
  }, []);

  const requiresTrainingTracking = (membership: string): boolean => {
    return trackingMemberships.some(tm => 
      membership.toUpperCase().includes(tm.toUpperCase()) || 
      tm.toUpperCase().includes(membership.toUpperCase())
    );
  };

  const selectedMember = useMemo(() => {
    if (!selectedMemberId) return null;
    return members.find(m => m.id === selectedMemberId) || null;
  }, [selectedMemberId, members]);

  // Calculate member stats with optional month filtering
  const memberStats = useMemo(() => {
    if (!members || !weeklyTrainings) return [];

    // Determine which calendar weeks to include based on selected period
    let targetWeeks: number[] = [];
    if (selectedMonth === "annual") {
      // For annual view, include all weeks (1-53)
      targetWeeks = Array.from({ length: 53 }, (_, i) => i + 1);
    } else {
      // For monthly view, get the calendar weeks that fall in that month
      targetWeeks = getWeeksInMonth(selectedYear, parseInt(selectedMonth));
    }

    return members
      .filter(member => {
        // Filter out members without training tracking
        if (!requiresTrainingTracking(member.membership)) return false;
        
        // Filter by membership category
        if (membershipFilter !== "all") {
          return getMembershipCategory(member.membership) === membershipFilter;
        }
        return true;
      })
      .map(member => {
        // Get trainings for this member filtered by the target calendar weeks
        const memberTrainings = weeklyTrainings.filter(t => 
          t.member_id === member.id && targetWeeks.includes(t.week_number)
        );
        
        const totalTrainings = memberTrainings.reduce((sum, t) => sum + t.trainings_count, 0);
        const weeksWithData = memberTrainings.length;
        
        // Calculate average per week based on weeks with data or target weeks count
        const averagePerWeek = weeksWithData > 0 
          ? totalTrainings / weeksWithData 
          : 0;
        
        const engagement = getEngagementLevel(averagePerWeek);

        return {
          id: member.id,
          name: member.name,
          membership: member.membership,
          totalTrainings,
          weeksWithData,
          averagePerWeek,
          engagement,
          contractSignedDate: member.contract_signed_date,
        };
      })
      .sort((a, b) => {
        if (sortOrder === "desc") {
          return b.averagePerWeek - a.averagePerWeek;
        }
        return a.averagePerWeek - b.averagePerWeek;
      });
  }, [members, weeklyTrainings, sortOrder, membershipFilter, trackingMemberships, selectedYear, selectedMonth]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const total = memberStats.length;
    const engagementCounts = {
      high: memberStats.filter(m => m.engagement === "high").length,
      medium: memberStats.filter(m => m.engagement === "medium").length,
      low: memberStats.filter(m => m.engagement === "low").length,
      "at-risk": memberStats.filter(m => m.engagement === "at-risk").length,
    };
    
    const totalTrainings = memberStats.reduce((sum, m) => sum + m.totalTrainings, 0);
    const averageTrainings = total > 0 ? totalTrainings / total : 0;

    return {
      total,
      engagementCounts,
      totalTrainings,
      averageTrainings,
    };
  }, [memberStats]);

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear];

  const periodLabel = selectedMonth === "annual" 
    ? `Année ${selectedYear}` 
    : `${months.find(m => m.value === selectedMonth)?.label} ${selectedYear}`;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">KPI Client</h1>
              <p className="text-sm text-muted-foreground">
                Suivi de l'engagement des membres - {periodLabel}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Year selector */}
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-[100px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Month selector */}
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[150px]">
                <BarChart3 className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map(month => (
                  <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Membership filter */}
            <Select value={membershipFilter} onValueChange={setMembershipFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrer par abonnement" />
              </SelectTrigger>
              <SelectContent>
                {membershipCategories.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summaryStats.total}</p>
                  <p className="text-xs text-muted-foreground">Membres suivis</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-600">{summaryStats.engagementCounts.high}</p>
                  <p className="text-xs text-muted-foreground">Engagement élevé</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600">{summaryStats.engagementCounts.medium}</p>
                  <p className="text-xs text-muted-foreground">Engagement moyen</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-orange-600">{summaryStats.engagementCounts.low}</p>
                  <p className="text-xs text-muted-foreground">Engagement faible</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-rose-500/10">
                  <XCircle className="h-5 w-5 text-rose-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-rose-600">{summaryStats.engagementCounts["at-risk"]}</p>
                  <p className="text-xs text-muted-foreground">À risque</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Flame className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summaryStats.averageTrainings.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">Moy. séances/membre</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Members Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-medium">Détail des membres</CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
                className="gap-2"
              >
                <ArrowUpDown className="h-4 w-4" />
                {sortOrder === "desc" ? "Plus actifs" : "Moins actifs"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Membre</TableHead>
                    <TableHead>Abonnement</TableHead>
                    <TableHead className="text-center">Séances ({periodLabel})</TableHead>
                    <TableHead className="text-center">Sem. actives</TableHead>
                    <TableHead className="text-center">Moy./sem.</TableHead>
                    <TableHead className="text-center">Engagement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {memberStats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Aucun membre avec suivi d'entraînement pour cette période
                      </TableCell>
                    </TableRow>
                  ) : (
                    memberStats.map((stat) => {
                      const style = engagementStyles[stat.engagement];
                      const Icon = style.icon;
                      
                      return (
                        <TableRow 
                          key={stat.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedMemberId(stat.id)}
                        >
                          <TableCell className="font-medium">{stat.name}</TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">{stat.membership}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="font-semibold">{stat.totalTrainings}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-muted-foreground">{stat.weeksWithData}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="font-medium">{stat.averagePerWeek.toFixed(1)}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge 
                              variant="outline" 
                              className={cn("gap-1", style.bg, style.text, "border-0")}
                            >
                              <Icon className="h-3 w-3" />
                              {style.label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Member Activity Dialog */}
        {selectedMember && (
          <MemberActivityDialog
            member={selectedMember}
            isOpen={!!selectedMemberId}
            onClose={() => setSelectedMemberId(null)}
          />
        )}
      </div>
    </div>
  );
}
