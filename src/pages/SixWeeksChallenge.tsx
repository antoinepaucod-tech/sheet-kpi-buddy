import { useState, useMemo } from "react";
import { format, parseISO, addWeeks } from "date-fns";
import { fr } from "date-fns/locale";
import { Trophy, Users, CheckCircle2, AlertTriangle, Activity, Calendar, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useChallengeMembers, type ChallengeMember } from "@/hooks/useChallengeMembers";
import { MemberActivityDialog } from "@/components/MemberActivityDialog";
import type { Member } from "@/hooks/useCustomerMembers";

const SixWeeksChallenge = () => {
  const {
    members,
    trainings,
    isLoading,
    updateCheckin,
    getCheckin,
    getTraining,
    getChallengeProgress,
    getEngagementLevel,
    getCheckinRate,
    refresh,
  } = useChallengeMembers();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMember, setSelectedMember] = useState<ChallengeMember | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed" | "upcoming">("all");

  // Filter members
  const filteredMembers = useMemo(() => {
    return members.filter(member => {
      // Search filter
      if (searchTerm && !member.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      // Status filter
      const progress = getChallengeProgress(member);
      if (statusFilter === "active" && !progress.isActive) return false;
      if (statusFilter === "completed" && !progress.isCompleted) return false;
      if (statusFilter === "upcoming" && (progress.isActive || progress.isCompleted)) return false;

      return true;
    });
  }, [members, searchTerm, statusFilter, getChallengeProgress]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const active = members.filter(m => getChallengeProgress(m).isActive).length;
    const completed = members.filter(m => getChallengeProgress(m).isCompleted).length;
    const upcoming = members.filter(m => {
      const progress = getChallengeProgress(m);
      return !progress.isActive && !progress.isCompleted;
    }).length;

    return { total: members.length, active, completed, upcoming };
  }, [members, getChallengeProgress]);

  const getEngagementBadge = (level: string) => {
    switch (level) {
      case 'high':
        return <Badge className="bg-success/20 text-success border-success/30">Élevé</Badge>;
      case 'medium':
        return <Badge className="bg-warning/20 text-warning border-warning/30">Moyen</Badge>;
      case 'low':
        return <Badge className="bg-orange-500/20 text-orange-500 border-orange-500/30">Faible</Badge>;
      case 'at-risk':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">À risque</Badge>;
      default:
        return <Badge variant="secondary">N/A</Badge>;
    }
  };

  const getStatusBadge = (member: ChallengeMember) => {
    const progress = getChallengeProgress(member);
    if (progress.isCompleted) {
      return <Badge variant="outline" className="border-muted-foreground text-muted-foreground">Terminé</Badge>;
    }
    if (progress.isActive) {
      return <Badge className="bg-primary/20 text-primary border-primary/30">En cours</Badge>;
    }
    return <Badge variant="secondary">À venir</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Trophy className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
              6 Weeks Challenge
            </h1>
            <p className="text-sm text-muted-foreground">
              Suivi des participants au programme de 6 semaines
            </p>
          </div>
        </div>
        <ThemeToggle />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" />
              En cours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.active}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Terminés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.completed}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              À venir
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{stats.upcoming}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Input
          placeholder="Rechercher un participant..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="active">En cours</SelectItem>
            <SelectItem value="completed">Terminés</SelectItem>
            <SelectItem value="upcoming">À venir</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Main Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold">Participant</TableHead>
                  <TableHead className="font-semibold">Début</TableHead>
                  <TableHead className="font-semibold">Fin</TableHead>
                  <TableHead className="font-semibold">Statut</TableHead>
                  <TableHead className="font-semibold">Progression</TableHead>
                  <TableHead className="font-semibold">Engagement</TableHead>
                  <TableHead className="font-semibold text-center" colSpan={6}>
                    Check-ins (S1-S6)
                  </TableHead>
                  <TableHead className="font-semibold">Assiduité</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center text-muted-foreground py-8">
                      Aucun participant trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMembers.map((member) => {
                    const progress = getChallengeProgress(member);
                    const engagement = getEngagementLevel(member.id, progress.currentWeek);
                    const checkinRate = getCheckinRate(member.id, progress.currentWeek);
                    const startDate = member.contract_signed_date ? parseISO(member.contract_signed_date) : null;
                    const endDate = startDate ? addWeeks(startDate, 6) : null;

                    return (
                      <TableRow key={member.id} className="hover:bg-muted/50">
                        <TableCell>
                          <button
                            onClick={() => setSelectedMember(member)}
                            className="font-medium text-left hover:text-primary hover:underline transition-colors cursor-pointer"
                          >
                            {member.name}
                          </button>
                        </TableCell>
                        <TableCell>
                          {startDate ? format(startDate, "dd/MM/yyyy", { locale: fr }) : "-"}
                        </TableCell>
                        <TableCell>
                          {endDate ? format(endDate, "dd/MM/yyyy", { locale: fr }) : "-"}
                        </TableCell>
                        <TableCell>{getStatusBadge(member)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <Progress 
                              value={(progress.currentWeek / progress.totalWeeks) * 100} 
                              className="h-2 flex-1"
                            />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              S{progress.currentWeek}/6
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{getEngagementBadge(engagement)}</TableCell>
                        {[1, 2, 3, 4, 5, 6].map((week) => {
                          const isChecked = getCheckin(member.id, week);
                          const isPastOrCurrent = week <= progress.currentWeek;
                          const weekTrainings = getTraining(member.id, week);
                          
                          return (
                            <TableCell key={week} className="text-center">
                              <div className="flex flex-col items-center gap-1">
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={(checked) => 
                                    updateCheckin(member.id, week, checked as boolean)
                                  }
                                  disabled={!isPastOrCurrent}
                                  className={cn(
                                    "transition-all",
                                    !isPastOrCurrent && "opacity-30"
                                  )}
                                />
                                {isPastOrCurrent && (
                                  <span className={cn(
                                    "text-[10px]",
                                    weekTrainings >= 3 ? "text-success" : 
                                    weekTrainings >= 2 ? "text-warning" : 
                                    weekTrainings >= 1 ? "text-orange-500" : 
                                    "text-destructive"
                                  )}>
                                    {weekTrainings}/3
                                  </span>
                                )}
                              </div>
                            </TableCell>
                          );
                        })}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-sm font-medium",
                              checkinRate >= 80 ? "text-success" :
                              checkinRate >= 60 ? "text-warning" :
                              "text-destructive"
                            )}>
                              {checkinRate}%
                            </span>
                            {checkinRate >= 80 && <TrendingUp className="h-4 w-4 text-success" />}
                            {checkinRate < 60 && <AlertTriangle className="h-4 w-4 text-destructive" />}
                          </div>
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
          member={{
            ...selectedMember,
            onboarding_bsport: false,
            onboarding_hubfit: false,
            onboarding_nutrition: false,
            questionnaire_coaching: false,
            session_introduction: false,
          } as Member}
          weeklyTrainings={trainings.map(t => ({
            ...t,
            id: t.id || '',
            created_at: '',
            updated_at: '',
          }))}
          onClose={() => setSelectedMember(null)}
          onMemberUpdated={() => {
            refresh();
            setSelectedMember(null);
          }}
        />
      )}
    </div>
  );
};

export default SixWeeksChallenge;
