import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { format, addMonths, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { Bell, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Member {
  id: string;
  name: string;
  membership: string;
  member_type: string | null;
  contract_signed_date: string | null;
  subscription_end_date: string | null;
  exit_date: string | null;
}

const ExpiringSubscriptions = () => {
  const { t } = useLanguage();
  const [expiringMembers, setExpiringMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadExpiringSubscriptions();
  }, []);

  const loadExpiringSubscriptions = async () => {
    setIsLoading(true);
    
    const today = startOfDay(new Date());
    const oneMonthFromNow = endOfDay(addMonths(today, 1));

    // Fetch all active members with subscription_end_date
    const { data, error } = await supabase
      .from('customer_members')
      .select('*')
      .not('subscription_end_date', 'is', null)
      .or('exit_date.is.null,exit_date.gt.' + format(today, 'yyyy-MM-dd'));

    if (error) {
      console.error("Error loading expiring subscriptions:", error);
      setIsLoading(false);
      return;
    }

    // Filter members whose subscription ends within the next month
    const expiring = (data || []).filter(member => {
      if (!member.subscription_end_date) return false;
      
      const endDate = new Date(member.subscription_end_date);
      return isWithinInterval(endDate, { start: today, end: oneMonthFromNow });
    });

    // Sort by subscription_end_date (soonest first)
    expiring.sort((a, b) => {
      const dateA = new Date(a.subscription_end_date!).getTime();
      const dateB = new Date(b.subscription_end_date!).getTime();
      return dateA - dateB;
    });

    setExpiringMembers(expiring);
    setIsLoading(false);
  };

  const getDaysUntilExpiry = (endDate: string): number => {
    const today = startOfDay(new Date());
    const expiry = startOfDay(new Date(endDate));
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getExpiryBadgeVariant = (daysUntil: number): "destructive" | "default" | "secondary" => {
    if (daysUntil <= 7) return "destructive";
    if (daysUntil <= 14) return "default";
    return "secondary";
  };

  const handleRenewSubscription = async (member: Member, renewalMonths: number = 12) => {
    if (!member.subscription_end_date) return;

    const currentEndDate = new Date(member.subscription_end_date);
    const newEndDate = addMonths(currentEndDate, renewalMonths);

    const { error } = await supabase
      .from('customer_members')
      .update({ subscription_end_date: format(newEndDate, 'yyyy-MM-dd') })
      .eq('id', member.id);

    if (error) {
      console.error("Error renewing subscription:", error);
      toast.error("Erreur lors du renouvellement");
      return;
    }

    toast.success(`Abonnement renouvelé jusqu'au ${format(newEndDate, "dd MMMM yyyy", { locale: fr })}`);
    loadExpiringSubscriptions();
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Bell className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Abonnements Proches de l'Échéance</h1>
          <p className="text-muted-foreground">
            Membres dont l'abonnement expire dans les 30 prochains jours
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Alertes d'Expiration
          </CardTitle>
          <CardDescription>
            {isLoading
              ? "Chargement..."
              : `${expiringMembers.length} abonnement${expiringMembers.length !== 1 ? 's' : ''} à renouveler prochainement`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Chargement des abonnements...
            </div>
          ) : expiringMembers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucun abonnement ne nécessite de renouvellement dans les 30 prochains jours.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Membre</TableHead>
                    <TableHead>Membership</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date de Signature</TableHead>
                    <TableHead>Date d'Expiration</TableHead>
                    <TableHead className="text-right">Jours Restants</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expiringMembers.map((member) => {
                    const daysUntil = getDaysUntilExpiry(member.subscription_end_date!);
                    return (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">{member.name}</TableCell>
                        <TableCell>{member.membership}</TableCell>
                        <TableCell>
                          {member.member_type ? (
                            <Badge variant="outline">{member.member_type}</Badge>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {member.contract_signed_date
                            ? format(new Date(member.contract_signed_date), "dd MMM yyyy", { locale: fr })
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {format(new Date(member.subscription_end_date!), "dd MMM yyyy", { locale: fr })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={getExpiryBadgeVariant(daysUntil)}>
                            {daysUntil === 0 ? "Aujourd'hui" : `${daysUntil} jour${daysUntil !== 1 ? 's' : ''}`}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRenewSubscription(member)}
                            className="gap-2"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Renouveler (12 mois)
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ExpiringSubscriptions;
