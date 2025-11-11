import { parseISO, format, addWeeks, startOfWeek, differenceInWeeks, differenceInMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import type { Member, WeeklyTraining } from "@/hooks/useCustomerMembers";

interface MemberActivityDialogProps {
  member: Member | null;
  weeklyTrainings: WeeklyTraining[];
  onClose: () => void;
  onNavigateToWeek?: (week: number, year: number, memberId: string) => void;
}

export function MemberActivityDialog({ 
  member, 
  weeklyTrainings, 
  onClose,
  onNavigateToWeek 
}: MemberActivityDialogProps) {
  if (!member) return null;

  const now = new Date();
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, now.getDate());

  let memberStat = {
    totalTrainings: 0,
    averagePerMonth: 0,
    averagePerWeek: 0,
    weeksSinceSignature: 0,
  };

  if (member.contract_signed_date) {
    const signatureDate = parseISO(member.contract_signed_date);
    const startDate = signatureDate > twelveMonthsAgo ? signatureDate : twelveMonthsAgo;
    
    const monthsSinceStart = differenceInMonths(now, startDate);
    const weeksSinceStart = differenceInWeeks(now, startDate);
    
    const memberTrainings = weeklyTrainings.filter(wt => wt.member_id === member.id);
    const totalTrainings = memberTrainings.reduce((sum, wt) => sum + wt.trainings_count, 0);
    
    const averagePerMonth = monthsSinceStart > 0 ? totalTrainings / monthsSinceStart : 0;
    const averagePerWeek = weeksSinceStart > 0 ? totalTrainings / weeksSinceStart : 0;

    memberStat = {
      totalTrainings,
      averagePerMonth,
      averagePerWeek,
      weeksSinceSignature: weeksSinceStart,
    };
  }

  const memberWeeklyData = weeklyTrainings
    .filter(wt => wt.member_id === member.id)
    .sort((a, b) => b.week_number - a.week_number)
    .slice(0, 12);

  const handleNavigateToWeek = (weekNumber: number) => {
    if (!member.contract_signed_date || !onNavigateToWeek) return;
    
    const signatureDate = parseISO(member.contract_signed_date);
    const memberWeekStartDate = addWeeks(signatureDate, weekNumber - 1);
    
    const targetYear = memberWeekStartDate.getFullYear();
    const jan1 = new Date(targetYear, 0, 1);
    const firstMonday = startOfWeek(jan1, { weekStartsOn: 1 });
    const memberWeekMonday = startOfWeek(memberWeekStartDate, { weekStartsOn: 1 });
    const calendarWeek = Math.floor(differenceInWeeks(memberWeekMonday, firstMonday)) + 1;
    
    onNavigateToWeek(calendarWeek, targetYear, member.id);
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Synthèse d'activité - {member.name}</DialogTitle>
          <DialogDescription className="sr-only">
            Détails d'activité hebdomadaire et statistiques du membre {member.name}
          </DialogDescription>
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

          <div className="space-y-3">
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => window.open("https://app.hubfit.io/clients", "_blank")}
              >
                <ExternalLink className="h-4 w-4" />
                Profil Hubfit
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => window.open("https://backoffice.bsport.io/member", "_blank")}
              >
                <ExternalLink className="h-4 w-4" />
                Profil Bsport
              </Button>
            </div>
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => window.open("https://link.localbestgyms.com/widget/bookings/antoine-paucod-personal-calendar-igmengorv", "_blank")}
              >
                <ExternalLink className="h-4 w-4" />
                RDV Antoine
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => window.open("https://link.localbestgyms.com/widget/bookings/jennifer-porraz-personal-calendar-0y_0v3kue", "_blank")}
              >
                <ExternalLink className="h-4 w-4" />
                RDV Jennifer
              </Button>
            </div>
          </div>

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
                      {onNavigateToWeek && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleNavigateToWeek(wt.week_number)}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
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
}
