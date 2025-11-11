import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCustomerMembers } from "@/hooks/useCustomerMembers";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MemberActivityDialog } from "@/components/MemberActivityDialog";
import { subMonths, differenceInWeeks, differenceInMonths, parseISO } from "date-fns";

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

const requiresTrainingTracking = (membership: string): boolean => {
  return trackingRequiredMemberships.includes(membership);
};

export default function KPIClient() {
  const navigate = useNavigate();
  const { members, weeklyTrainings, isLoading } = useCustomerMembers();
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  const memberStats = useMemo(() => {
    const now = new Date();
    const twelveMonthsAgo = subMonths(now, 12);

    // Only calculate stats for members with tracking-required memberships
    return members
      .filter(member => requiresTrainingTracking(member.membership))
      .map(member => {
        if (!member.contract_signed_date) {
          return {
            id: member.id,
            name: member.name,
            membership: member.membership,
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
          membership: member.membership,
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
