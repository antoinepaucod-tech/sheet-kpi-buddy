import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCustomerMembers } from "@/hooks/useCustomerMembers";
import { useClubAttendance } from "@/hooks/useClubAttendance";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { KPIChart } from "@/components/KPIChart";
import { MemberActivityDialog } from "@/components/MemberActivityDialog";
import { Breadcrumbs } from "@/components/Breadcrumbs";
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
  ChevronDown,
  ChevronRight,
  Target,
  TrendingUp,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { startOfMonth, endOfMonth, getWeek, startOfWeek, getMonth, getYear } from "date-fns";
import { ThemeToggle } from "@/components/ThemeToggle";

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

const engagementStyles: Record<EngagementLevel, { bg: string; text: string; label: string; shortLabel: string; icon: typeof CheckCircle2 }> = {
  high: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", label: "Élevé (3+ séances/sem.)", shortLabel: "Élevé", icon: CheckCircle2 },
  medium: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", label: "Moyen (2 séances)", shortLabel: "Moyen", icon: Clock },
  low: { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", label: "Faible (1 séance)", shortLabel: "Faible", icon: AlertTriangle },
  "at-risk": { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", label: "À risque (0 séance)", shortLabel: "À risque", icon: XCircle },
};

// Helper to get week numbers for a specific month
// RULE: A week belongs to the month where it STARTS (Monday)
// This ensures each week is counted in only ONE month, avoiding overlaps
const getWeeksInMonth = (year: number, month: number): number[] => {
  const weeks: number[] = [];
  
  // Iterate through all 53 possible ISO weeks
  for (let weekNum = 1; weekNum <= 53; weekNum++) {
    // Find the Monday of this week
    // Start from Jan 4 which is always in week 1 by ISO definition
    const jan4 = new Date(year, 0, 4);
    const jan4Week = getWeek(jan4, { weekStartsOn: 1 });
    
    // Calculate the Monday of the target week
    const daysToAdd = (weekNum - jan4Week) * 7;
    const someDay = new Date(jan4.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    const monday = startOfWeek(someDay, { weekStartsOn: 1 });
    
    // Check if the Monday falls in the target month AND year
    const mondayMonth = getMonth(monday) + 1; // getMonth is 0-indexed
    const mondayYear = getYear(monday);
    
    if (mondayMonth === month && mondayYear === year) {
      weeks.push(weekNum);
    }
  }
  
  return weeks.sort((a, b) => a - b);
};

const months = [
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

interface WeeklyDetail {
  weekNumber: number;
  trainings: number;
}

interface MemberStat {
  id: string;
  name: string;
  membership: string;
  totalTrainings: number;
  weeksWithData: number;
  averagePerWeek: number;
  engagement: EngagementLevel;
  contractSignedDate: string | null;
  weeklyDetails: WeeklyDetail[];
}

export default function KPIClient() {
  const navigate = useNavigate();
  const { members, weeklyTrainings, isLoading } = useCustomerMembers();
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [membershipFilter, setMembershipFilter] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth() + 1 + "");
  const [trackingMemberships, setTrackingMemberships] = useState<string[]>([]);
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set());
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Club attendance data
  const { monthlyAttendance, annualSummary, isLoading: isLoadingAttendance } = useClubAttendance(selectedYear);

  // Current calendar week
  const currentWeek = useMemo(() => {
    return getWeek(new Date(), { weekStartsOn: 1 });
  }, []);

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

  // Get weeks for the selected month
  const targetWeeks = useMemo(() => {
    return getWeeksInMonth(selectedYear, parseInt(selectedMonth));
  }, [selectedYear, selectedMonth]);

  // Calculate member stats for the selected month using calendar weeks
  const memberStats = useMemo((): MemberStat[] => {
    if (!members || !weeklyTrainings) return [];

    // Calculate the end date of the selected month for active member filtering
    const monthEndDate = new Date(selectedYear, parseInt(selectedMonth), 0); // Last day of selected month
    const filterDate = monthEndDate.toISOString().split('T')[0];

    return members
      .filter(member => {
        // Filter out members without training tracking
        if (!requiresTrainingTracking(member.membership)) return false;
        
        // IMPORTANT: Filter for active members only based on exit_date and subscription_end_date
        // A member is excluded if their exit_date OR subscription_end_date is before the selected month
        const isActive = (
          (!member.exit_date || member.exit_date >= filterDate) &&
          (!member.subscription_end_date || member.subscription_end_date >= filterDate)
        );
        if (!isActive) return false;
        
        // Filter by membership category
        if (membershipFilter !== "all") {
          return getMembershipCategory(member.membership) === membershipFilter;
        }
        return true;
      })
      .map(member => {
        // Get trainings for this member filtered by calendar weeks for the selected year and month
        const memberTrainings = weeklyTrainings.filter(t => 
          t.member_id === member.id && 
          t.calendar_year === selectedYear &&
          t.calendar_week !== null &&
          t.calendar_week !== undefined &&
          targetWeeks.includes(t.calendar_week)
        );
        
        // Build weekly details using calendar weeks
        const weeklyDetails: WeeklyDetail[] = targetWeeks.map(weekNum => {
          const training = memberTrainings.find(t => t.calendar_week === weekNum);
          return {
            weekNumber: weekNum,
            trainings: training?.trainings_count || 0,
          };
        });
        
        const totalTrainings = memberTrainings.reduce((sum, t) => sum + t.trainings_count, 0);
        const weeksWithData = memberTrainings.filter(t => t.trainings_count > 0).length;
        
        // Calculate average per week based on weeks in the month
        const averagePerWeek = targetWeeks.length > 0 
          ? totalTrainings / targetWeeks.length 
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
          weeklyDetails,
        };
      })
      .sort((a, b) => {
        if (sortOrder === "desc") {
          return b.averagePerWeek - a.averagePerWeek;
        }
        return a.averagePerWeek - b.averagePerWeek;
      });
  }, [members, weeklyTrainings, sortOrder, membershipFilter, trackingMemberships, targetWeeks, selectedYear, selectedMonth]);

  // Filter by search query
  const filteredMemberStats = useMemo(() => {
    if (!searchQuery.trim()) return memberStats;
    return memberStats.filter(m => 
      m.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [memberStats, searchQuery]);

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

  const periodLabel = `${months.find(m => m.value === selectedMonth)?.label} ${selectedYear}`;

  const toggleMemberExpanded = (memberId: string) => {
    setExpandedMembers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(memberId)) {
        newSet.delete(memberId);
      } else {
        newSet.add(memberId);
      }
      return newSet;
    });
  };

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
            <ThemeToggle />
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

            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un membre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-[200px]"
              />
            </div>
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

        {/* Club Attendance Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <KPIChart
            data={monthlyAttendance}
            title="Fréquentation Club - Total séances/mois"
            dataKeys={[
              { key: "totalSessions", name: "Total séances", color: "hsl(var(--primary))" },
            ]}
            type="bar"
            showFilter={false}
            height={280}
          />
          <KPIChart
            data={monthlyAttendance}
            title="Moyenne séances par membre actif"
            dataKeys={[
              { key: "averagePerMember", name: "Moy. séances/membre", color: "hsl(142, 71%, 45%)" },
            ]}
            type="line"
            showFilter={false}
            height={280}
          />
        </div>

        {/* Annual Summary Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Résumé annuel {selectedYear}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{annualSummary.totalSessions}</p>
                <p className="text-sm text-muted-foreground">Total séances (année)</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{annualSummary.totalActiveMembers}</p>
                <p className="text-sm text-muted-foreground">Membres actifs (année)</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{annualSummary.averagePerMember.toFixed(1)}</p>
                <p className="text-sm text-muted-foreground">Moy. séances/membre</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{annualSummary.averageSessionsPerMonth.toFixed(0)}</p>
                <p className="text-sm text-muted-foreground">Moy. séances/mois</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Members Table with Expandable Weekly Details */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  Détail des membres
                  <Badge variant="outline" className="bg-primary/10 text-primary border-0 gap-1">
                    <Target className="h-3 w-3" />
                    Semaine actuelle : S{currentWeek}
                  </Badge>
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Semaines calendaires : {targetWeeks.map(w => w === currentWeek ? `[S${w}]` : `S${w}`).join(", ")} • Cliquez sur une ligne pour voir le détail
                </p>
              </div>
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
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Membre</TableHead>
                    <TableHead>Abonnement</TableHead>
                    <TableHead className="text-center">Total séances</TableHead>
                    <TableHead className="text-center">Moy./sem.</TableHead>
                    <TableHead className="text-center">Engagement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMemberStats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Aucun membre avec suivi d'entraînement pour cette période
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredMemberStats.map((stat) => {
                      const style = engagementStyles[stat.engagement];
                      const Icon = style.icon;
                      const isExpanded = expandedMembers.has(stat.id);
                      
                      return (
                        <Collapsible key={stat.id} open={isExpanded} onOpenChange={() => toggleMemberExpanded(stat.id)} asChild>
                          <>
                            <CollapsibleTrigger asChild>
                              <TableRow className="cursor-pointer hover:bg-muted/50">
                                <TableCell className="w-8">
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </TableCell>
                                <TableCell className="font-medium">
                                  <button 
                                    className="text-left hover:text-primary hover:underline transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const fullMember = members?.find(m => m.id === stat.id);
                                      if (fullMember) {
                                        setSelectedMember(fullMember);
                                      }
                                    }}
                                  >
                                    {stat.name}
                                  </button>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-muted-foreground">{stat.membership}</span>
                                </TableCell>
                                <TableCell className="text-center">
                                  <span className="font-semibold">{stat.totalTrainings}</span>
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
                                    {style.shortLabel}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            </CollapsibleTrigger>
                            <CollapsibleContent asChild>
                              <TableRow className="bg-muted/30 hover:bg-muted/30">
                                <TableCell colSpan={6} className="p-0">
                                  <div className="px-8 py-3">
                                    <div className="flex items-center gap-4 flex-wrap">
                                      <span className="text-sm font-medium text-muted-foreground">Détail par semaine :</span>
                                      {stat.weeklyDetails.map((week) => {
                                        const isCurrentWeek = week.weekNumber === currentWeek;
                                        return (
                                          <div 
                                            key={week.weekNumber} 
                                            className={cn(
                                              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm",
                                              isCurrentWeek && "ring-2 ring-primary ring-offset-1",
                                              week.trainings === 0 
                                                ? "bg-muted text-muted-foreground" 
                                                : week.trainings >= 3 
                                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                                  : week.trainings >= 2
                                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                                    : "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                                            )}
                                          >
                                            <span className="font-medium">S{week.weekNumber}</span>
                                            <span>{week.trainings} séance{week.trainings !== 1 ? "s" : ""}</span>
                                            {isCurrentWeek && <Target className="h-3 w-3" />}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            </CollapsibleContent>
                          </>
                        </Collapsible>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Member Activity Dialog */}
        <MemberActivityDialog
          member={selectedMember}
          weeklyTrainings={weeklyTrainings || []}
          onClose={() => setSelectedMember(null)}
        />
      </div>
    </div>
  );
}
