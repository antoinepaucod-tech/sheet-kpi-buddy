import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCustomerMembers } from "@/hooks/useCustomerMembers";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { startOfMonth, subMonths, parseISO, differenceInWeeks, differenceInMonths, format, startOfWeek, addWeeks } from "date-fns";
import { fr } from "date-fns/locale";
import { ExternalLink } from "lucide-react";

export default function KPIClient() {
  const navigate = useNavigate();
  const { members, weeklyTrainings, isLoading } = useCustomerMembers();
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  const memberStats = useMemo(() => {
    const now = new Date();
    const twelveMonthsAgo = subMonths(now, 12);

    return members.map(member => {
      if (!member.contract_signed_date) {
        return {
          id: member.id,
          name: member.name,
          totalTrainings: 0,
          averagePerMonth: 0,
          averagePerWeek: 0,
          monthsSinceSignature: 0,
          weeksSinceSignature: 0,
        };
      }

      const signatureDate = parseISO(member.contract_signed_date);
      const startDate = signatureDate > twelveMonthsAgo ? signatureDate : twelveMonthsAgo;
      
      // Calculate time periods
      const monthsSinceStart = differenceInMonths(now, startDate);
      const weeksSinceStart = differenceInWeeks(now, startDate);
      
      // Get trainings for this member in the last 12 months
      const memberTrainings = weeklyTrainings.filter(wt => wt.member_id === member.id);
      
      // Calculate total trainings in the last 12 months
      const totalTrainings = memberTrainings.reduce((sum, wt) => sum + wt.trainings_count, 0);
      
      // Calculate averages
      const averagePerMonth = monthsSinceStart > 0 ? totalTrainings / monthsSinceStart : 0;
      const averagePerWeek = weeksSinceStart > 0 ? totalTrainings / weeksSinceStart : 0;

      return {
        id: member.id,
        name: member.name,
        totalTrainings,
        averagePerMonth,
        averagePerWeek,
        monthsSinceSignature: monthsSinceStart,
        weeksSinceSignature: weeksSinceStart,
      };
    });
  }, [members, weeklyTrainings]);

  // Sort by total trainings
  const sortedStats = useMemo(() => {
    const sorted = [...memberStats].sort((a, b) => b.totalTrainings - a.totalTrainings);
    return sortOrder === "asc" ? sorted.reverse() : sorted;
  }, [memberStats, sortOrder]);

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="text-center">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2">KPI Client</h1>
          <p className="text-muted-foreground">
            Statistiques d'entraînement par membre sur les 12 derniers mois
          </p>
        </div>
        <ThemeToggle />
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Liste des membres</h3>
          <Select value={sortOrder} onValueChange={(value: "desc" | "asc") => setSortOrder(value)}>
            <SelectTrigger className="w-[280px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Plus actifs → Moins actifs</SelectItem>
              <SelectItem value="asc">Moins actifs → Plus actifs</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead className="text-right">Total Entraînements (12 mois)</TableHead>
              <TableHead className="text-right">Moyenne / Mois</TableHead>
              <TableHead className="text-right">Moyenne / Semaine</TableHead>
              <TableHead className="text-right">Mois depuis signature</TableHead>
              <TableHead className="text-right">Semaines depuis signature</TableHead>
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
              sortedStats.map((stat) => (
                <TableRow key={stat.id}>
                  <TableCell 
                    className="font-medium cursor-pointer hover:text-primary hover:underline transition-colors"
                    onClick={() => setSelectedMemberId(stat.id)}
                  >
                    {stat.name}
                  </TableCell>
                  <TableCell className="text-right">{stat.totalTrainings}</TableCell>
                  <TableCell className="text-right">{stat.averagePerMonth.toFixed(1)}</TableCell>
                  <TableCell className="text-right">{stat.averagePerWeek.toFixed(1)}</TableCell>
                  <TableCell className="text-right">{stat.monthsSinceSignature}</TableCell>
                  <TableCell className="text-right">{stat.weeksSinceSignature}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Card className="p-6 bg-muted/50">
        <h3 className="font-semibold mb-2">Statistiques Globales</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Moyenne globale / Mois</p>
            <p className="text-2xl font-bold">
              {memberStats.length > 0
                ? (memberStats.reduce((sum, s) => sum + s.averagePerMonth, 0) / memberStats.length).toFixed(1)
                : "0.0"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Moyenne globale / Semaine</p>
            <p className="text-2xl font-bold">
              {memberStats.length > 0
                ? (memberStats.reduce((sum, s) => sum + s.averagePerWeek, 0) / memberStats.length).toFixed(1)
                : "0.0"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total membres actifs</p>
            <p className="text-2xl font-bold">{memberStats.length}</p>
          </div>
        </div>
      </Card>

      {selectedMemberId && (() => {
        const member = members.find(m => m.id === selectedMemberId);
        const memberStat = memberStats.find(s => s.id === selectedMemberId);
        const memberWeeklyData = weeklyTrainings
          .filter(wt => wt.member_id === selectedMemberId)
          .sort((a, b) => b.week_number - a.week_number)
          .slice(0, 12);

        if (!member || !memberStat) return null;

        return (
          <Dialog open={true} onOpenChange={() => setSelectedMemberId(null)}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl">Synthèse d'activité - {member.name}</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-6 mt-4">
                <Card className="p-4 bg-muted/30">
                  <h3 className="font-semibold mb-3">Informations Générales</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Abonnement</p>
                      <p className="font-medium">{member.membership}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Date de signature</p>
                      <p className="font-medium">
                        {member.contract_signed_date 
                          ? format(parseISO(member.contract_signed_date), "dd MMMM yyyy", { locale: fr })
                          : "Non définie"}
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 bg-primary/5">
                  <h3 className="font-semibold mb-3">Statistiques (12 derniers mois)</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="text-2xl font-bold text-primary">{memberStat.totalTrainings}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Moy. / Mois</p>
                      <p className="text-2xl font-bold">{memberStat.averagePerMonth.toFixed(1)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Moy. / Semaine</p>
                      <p className="text-2xl font-bold">{memberStat.averagePerWeek.toFixed(1)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Semaines</p>
                      <p className="text-2xl font-bold">{memberStat.weeksSinceSignature}</p>
                    </div>
                  </div>
                </Card>

                <div>
                  <h3 className="font-semibold mb-3">Activité Hebdomadaire (12 dernières semaines)</h3>
                  {memberWeeklyData.length > 0 ? (
                    <div className="space-y-2">
                      {memberWeeklyData.map((wt) => (
                        <div key={wt.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group">
                          <span className="text-sm font-medium">Semaine {wt.week_number}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold">{wt.trainings_count}</span>
                            <div 
                              className={`w-3 h-3 rounded-full ${
                                wt.trainings_count >= 3 ? "bg-green-500" :
                                wt.trainings_count === 2 ? "bg-yellow-500" :
                                wt.trainings_count === 1 ? "bg-orange-500" :
                                "bg-red-500"
                              }`}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                if (!member.contract_signed_date) return;
                                
                                // Calculate the actual date of this member's relative week
                                const signatureDate = parseISO(member.contract_signed_date);
                                const weekDate = addWeeks(signatureDate, wt.week_number - 1);
                                
                                // Find the calendar year and week for this date
                                const year = weekDate.getFullYear();
                                const jan1 = new Date(year, 0, 1);
                                const firstMonday = startOfWeek(jan1, { weekStartsOn: 1 });
                                const weekStart = startOfWeek(weekDate, { weekStartsOn: 1 });
                                const calendarWeek = differenceInWeeks(weekStart, firstMonday) + 1;
                                
                                // Navigate with year and calendar week
                                navigate(`/customer-journey?week=${calendarWeek}&year=${year}&memberId=${selectedMemberId}`);
                                setSelectedMemberId(null);
                              }}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">Aucune donnée d'entraînement disponible</p>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}
