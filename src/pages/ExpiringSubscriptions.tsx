import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { format, addMonths, addWeeks, isWithinInterval, startOfDay, endOfDay, addDays, isBefore } from "date-fns";
import { fr } from "date-fns/locale";
import { Bell, RefreshCw, Banknote, Clock, AlertTriangle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MemberActivityDialog } from "@/components/MemberActivityDialog";
import type { Member as CustomerMember, WeeklyTraining } from "@/hooks/useCustomerMembers";

interface Member {
  id: string;
  name: string;
  membership: string;
  member_type: string | null;
  cash_collected: number | null;
  contract_signed_date: string | null;
  subscription_end_date: string | null;
  exit_date: string | null;
}

interface MembershipCategory {
  id: string;
  name: string;
}

const ExpiringSubscriptions = () => {
  const { t } = useLanguage();
  const [upcomingMembers, setUpcomingMembers] = useState<Member[]>([]);
  const [expiredMembers, setExpiredMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [membershipCategories, setMembershipCategories] = useState<MembershipCategory[]>([]);
  const [activeTab, setActiveTab] = useState("upcoming");
  
  // Renewal dialog state
  const [renewalDialogOpen, setRenewalDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [renewalMonths, setRenewalMonths] = useState("12");
  const [changeMembership, setChangeMembership] = useState(false);
  const [newMembership, setNewMembership] = useState("");
  const [renewalStartDate, setRenewalStartDate] = useState<Date | undefined>(undefined);
  const [renewalMemberType, setRenewalMemberType] = useState<string>("recurring");
  const [renewalCashCollected, setRenewalCashCollected] = useState<string>("0");
  const [cashCollectionDate, setCashCollectionDate] = useState<Date | undefined>(undefined);
  
  // Activity dialog state
  const [activityMember, setActivityMember] = useState<CustomerMember | null>(null);
  const [weeklyTrainings, setWeeklyTrainings] = useState<WeeklyTraining[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadSubscriptions();
    loadMembershipCategories();
  }, []);

  const loadMembershipCategories = async () => {
    const { data, error } = await supabase
      .from('accounting_categories')
      .select('id, name')
      .eq('type', 'revenue')
      .eq('revenue_type', 'membre')
      .order('name');

    if (error) {
      console.error("Error loading membership categories:", error);
      return;
    }

    setMembershipCategories(data || []);
  };

  const loadSubscriptions = async () => {
    setIsLoading(true);
    
    const today = startOfDay(new Date());
    const oneMonthFromNow = endOfDay(addMonths(today, 1));

    const { data, error } = await supabase
      .from('customer_members')
      .select('*')
      .not('subscription_end_date', 'is', null);

    if (error) {
      console.error("Error loading subscriptions:", error);
      setIsLoading(false);
      return;
    }

    const upcoming: Member[] = [];
    const expired: Member[] = [];

    (data || []).forEach(member => {
      if (!member.subscription_end_date) return;
      
      const endDate = startOfDay(new Date(member.subscription_end_date));
      
      // Check if expired (end date is before today)
      if (isBefore(endDate, today)) {
        expired.push(member);
      }
      // Check if upcoming (within next 30 days)
      else if (isWithinInterval(endDate, { start: today, end: oneMonthFromNow })) {
        upcoming.push(member);
      }
    });

    // Sort upcoming by expiration date (soonest first)
    upcoming.sort((a, b) => {
      const dateA = new Date(a.subscription_end_date!).getTime();
      const dateB = new Date(b.subscription_end_date!).getTime();
      return dateA - dateB;
    });

    // Sort expired by expiration date (most recent first)
    expired.sort((a, b) => {
      const dateA = new Date(a.subscription_end_date!).getTime();
      const dateB = new Date(b.subscription_end_date!).getTime();
      return dateB - dateA;
    });

    setUpcomingMembers(upcoming);
    setExpiredMembers(expired);
    setIsLoading(false);
  };

  const getDaysUntilExpiry = (endDate: string): number => {
    const today = startOfDay(new Date());
    const expiry = startOfDay(new Date(endDate));
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getDaysSinceExpiry = (endDate: string): number => {
    const today = startOfDay(new Date());
    const expiry = startOfDay(new Date(endDate));
    const diffTime = today.getTime() - expiry.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getExpiryBadgeVariant = (daysUntil: number): "destructive" | "default" | "secondary" => {
    if (daysUntil <= 7) return "destructive";
    if (daysUntil <= 14) return "default";
    return "secondary";
  };

  const getExpiredBadgeVariant = (daysSince: number): "destructive" | "default" | "secondary" => {
    if (daysSince > 30) return "destructive";
    if (daysSince > 14) return "default";
    return "secondary";
  };

  const openRenewalDialog = (member: Member) => {
    setSelectedMember(member);
    setRenewalMonths("12");
    setChangeMembership(false);
    setNewMembership(member.membership);
    // Par défaut, la date de prise d'effet est le lendemain de la date d'expiration actuelle
    const defaultStartDate = member.subscription_end_date 
      ? addDays(new Date(member.subscription_end_date), 1)
      : new Date();
    setRenewalStartDate(defaultStartDate);
    // Conserver le type de membre actuel ou "recurring" par défaut
    setRenewalMemberType(member.member_type || "recurring");
    setRenewalCashCollected("0");
    setCashCollectionDate(new Date()); // Default to today's date (independent from renewal start date)
    setRenewalDialogOpen(true);
  };

  const openActivityDialog = async (member: Member) => {
    // Load full member data with onboarding fields
    const { data: fullMember, error } = await supabase
      .from('customer_members')
      .select('*')
      .eq('id', member.id)
      .single();

    if (error || !fullMember) {
      toast.error("Erreur lors du chargement des données du membre");
      return;
    }

    // Load weekly trainings for this member
    const { data: trainings } = await supabase
      .from('weekly_trainings')
      .select('*')
      .eq('member_id', member.id);

    setWeeklyTrainings(trainings || []);
    setActivityMember(fullMember as CustomerMember);
  };

  const getNewEndDate = (): Date | null => {
    if (!renewalStartDate) return null;
    const durationValue = parseFloat(renewalMonths);
    // Handle 6 weeks (1.5 months equivalent)
    if (durationValue === 1.5) {
      return addWeeks(renewalStartDate, 6);
    }
    return addMonths(renewalStartDate, durationValue);
  };

  const handleRenewSubscription = async () => {
    if (!selectedMember || !renewalStartDate) return;

    const newEndDate = getNewEndDate();
    if (!newEndDate) return;

    const cashCollectedValue = parseFloat(renewalCashCollected) || 0;
    const finalMembership = changeMembership && newMembership ? newMembership : selectedMember.membership;

    // Mise à jour du membre avec les nouvelles infos
    const updateData: { 
      subscription_end_date: string; 
      membership?: string;
      member_type: string;
      cash_collected: number;
      contract_signed_date: string;
    } = {
      subscription_end_date: format(newEndDate, 'yyyy-MM-dd'),
      member_type: renewalMemberType,
      cash_collected: (selectedMember.cash_collected || 0) + cashCollectedValue,
      contract_signed_date: format(renewalStartDate, 'yyyy-MM-dd')
    };

    if (changeMembership && newMembership && newMembership !== selectedMember.membership) {
      updateData.membership = newMembership;
    }

    const { error } = await supabase
      .from('customer_members')
      .update(updateData)
      .eq('id', selectedMember.id);

    if (error) {
      console.error("Error renewing subscription:", error);
      toast.error("Erreur lors du renouvellement");
      return;
    }

    // Get current user email for audit trail
    const { data: { user } } = await supabase.auth.getUser();
    const performedBy = user?.email?.split('@')[0] || 'unknown';

    // Create accounting transaction for renewal if cash collected > 0
    if (cashCollectedValue > 0 && cashCollectionDate) {
      const transactionMonth = cashCollectionDate.getMonth() + 1;
      const transactionYear = cashCollectionDate.getFullYear();
      const monthName = new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(cashCollectionDate);
      
      // Map member type to product description
      let productDescription = "Revenu EFT Général";
      if (renewalMemberType === "pif" || renewalMemberType === "Membres PIF") {
        productDescription = "Membre PIF";
      } else if (renewalMemberType === "Membres PT") {
        productDescription = "Revenu PT";
      }
      
      await supabase
        .from('accounting_transactions')
        .insert({
          transaction_date: format(cashCollectionDate, "yyyy-MM-dd"),
          transaction_type: "revenue",
          category: finalMembership,
          client_name: selectedMember.name,
          service_description: finalMembership,
          product_description: productDescription,
          amount: cashCollectedValue,
          amount_received: cashCollectedValue,
          payment_method: "Prélèvement Automatique",
          notes: "Renouvellement depuis Échéances",
          year: transactionYear,
          month: transactionMonth,
          month_name: monthName,
        });
    }

    // Record renewal in history
    const durationValue = parseFloat(renewalMonths);
    const durationLabel = durationValue === 1.5 ? "6 semaines" : `${renewalMonths} mois`;
    
    await supabase.from('member_renewal_history').insert({
      member_id: selectedMember.id,
      previous_end_date: selectedMember.subscription_end_date,
      new_end_date: format(newEndDate, "yyyy-MM-dd"),
      renewal_duration: durationLabel,
      performed_by: performedBy,
      notes: `Renouvellement via page Échéances${changeMembership && newMembership !== selectedMember.membership ? ` - Changement: ${newMembership}` : ''}`
    });

    const membershipMessage = changeMembership && newMembership !== selectedMember.membership
      ? ` avec nouveau type: ${newMembership}`
      : "";
    
    const cashMessage = cashCollectedValue > 0 
      ? ` | Cash collecté: CHF ${cashCollectedValue.toFixed(2)}`
      : "";

    toast.success(`Abonnement renouvelé jusqu'au ${format(newEndDate, "dd MMMM yyyy", { locale: fr })}${membershipMessage}${cashMessage}`);
    setRenewalDialogOpen(false);
    loadSubscriptions();
  };

  const renderMemberTable = (members: Member[], isExpired: boolean) => {
    if (members.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          {isExpired 
            ? "Aucun abonnement expiré."
            : "Aucun abonnement ne nécessite de renouvellement dans les 30 prochains jours."}
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Membre</TableHead>
              <TableHead>Membership</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Date de Signature</TableHead>
              <TableHead>Date d'Expiration</TableHead>
              <TableHead className="text-right">
                {isExpired ? "Expiré depuis" : "Jours Restants"}
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const days = isExpired 
                ? getDaysSinceExpiry(member.subscription_end_date!)
                : getDaysUntilExpiry(member.subscription_end_date!);
              
              return (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                    <button
                      onClick={() => openActivityDialog(member)}
                      className="text-left hover:text-primary hover:underline transition-colors cursor-pointer"
                    >
                      {member.name}
                    </button>
                  </TableCell>
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
                    {isExpired ? (
                      <Badge variant={getExpiredBadgeVariant(days)}>
                        {days === 0 ? "Aujourd'hui" : `${days} jour${days !== 1 ? 's' : ''}`}
                      </Badge>
                    ) : (
                      <Badge variant={getExpiryBadgeVariant(days)}>
                        {days === 0 ? "Aujourd'hui" : `${days} jour${days !== 1 ? 's' : ''}`}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openRenewalDialog(member)}
                      className="gap-2"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Renouveler
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 bg-background min-h-screen">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Gestion des Échéances</h1>
            <p className="text-muted-foreground">
              Suivez et renouvelez les abonnements de vos membres
            </p>
          </div>
        </div>
        <ThemeToggle />
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un membre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="upcoming" className="gap-2">
              <Clock className="h-4 w-4" />
              À venir
              {upcomingMembers.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {upcomingMembers.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="expired" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Expirés
              {expiredMembers.length > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {expiredMembers.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">

        <TabsContent value="upcoming" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Abonnements à renouveler
              </CardTitle>
              <CardDescription>
                {isLoading
                  ? "Chargement..."
                  : `${upcomingMembers.length} abonnement${upcomingMembers.length !== 1 ? 's' : ''} expire${upcomingMembers.length !== 1 ? 'nt' : ''} dans les 30 prochains jours`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Chargement des abonnements...
                </div>
              ) : (
                renderMemberTable(
                  upcomingMembers.filter(m => 
                    m.name.toLowerCase().includes(searchQuery.toLowerCase())
                  ), 
                  false
                )
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expired" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Abonnements expirés
              </CardTitle>
              <CardDescription>
                {isLoading
                  ? "Chargement..."
                  : `${expiredMembers.length} abonnement${expiredMembers.length !== 1 ? 's' : ''} expiré${expiredMembers.length !== 1 ? 's' : ''} nécessitant une action`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Chargement des abonnements...
                </div>
              ) : (
                renderMemberTable(
                  expiredMembers.filter(m => 
                    m.name.toLowerCase().includes(searchQuery.toLowerCase())
                  ), 
                  true
                )
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Renewal Dialog */}
      <Dialog open={renewalDialogOpen} onOpenChange={setRenewalDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Renouveler l'abonnement</DialogTitle>
            <DialogDescription>
              {selectedMember && (
                <>
                  <span className="font-medium text-foreground">{selectedMember.name}</span>
                  <span className="block text-xs mt-1">
                    Abonnement actuel: {selectedMember.membership}
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Renewal Start Date Selection */}
            <div className="space-y-2">
              <Label>Date de prise d'effet</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !renewalStartDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {renewalStartDate ? format(renewalStartDate, "dd MMMM yyyy", { locale: fr }) : "Sélectionner une date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={renewalStartDate}
                    onSelect={(date) => {
                      setRenewalStartDate(date);
                      // Also update cash collection date if it hasn't been manually changed
                      if (!cashCollectionDate || cashCollectionDate.getTime() === renewalStartDate?.getTime()) {
                        setCashCollectionDate(date);
                      }
                    }}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Duration Selection */}
            <div className="space-y-2">
              <Label>Durée du renouvellement</Label>
              <Select value={renewalMonths} onValueChange={setRenewalMonths}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner la durée" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="1.5">6 semaines</SelectItem>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((months) => (
                    <SelectItem key={months} value={months.toString()}>
                      {months} mois
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {renewalStartDate && (
                <p className="text-xs text-muted-foreground">
                  Nouvelle date d'expiration: {format(
                    getNewEndDate() || renewalStartDate,
                    "dd MMMM yyyy",
                    { locale: fr }
                  )}
                </p>
              )}
            </div>

            {/* Member Type Selection */}
            <div className="space-y-2">
              <Label>Type de membre</Label>
              <Select value={renewalMemberType} onValueChange={setRenewalMemberType}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner le type" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="recurring">Récurrent (paiement mensuel)</SelectItem>
                  <SelectItem value="pif">PIF (paiement intégral)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Cash Collected */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Banknote className="h-4 w-4" />
                Cash collecté lors du renouvellement (CHF)
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={renewalCashCollected}
                onChange={(e) => setRenewalCashCollected(e.target.value)}
                placeholder="0.00"
              />
            </div>

            {/* Cash Collection Date */}
            <div className="space-y-2">
              <Label>Date d'encaissement</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !cashCollectionDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {cashCollectionDate ? format(cashCollectionDate, "dd MMMM yyyy", { locale: fr }) : "Sélectionner une date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={cashCollectionDate}
                    onSelect={setCashCollectionDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Date à laquelle le montant est encaissé (peut différer de la date de renouvellement)
              </p>
            </div>

            {/* Change Membership Toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="change-membership" className="cursor-pointer">
                Changer de type d'abonnement
              </Label>
              <Switch
                id="change-membership"
                checked={changeMembership}
                onCheckedChange={setChangeMembership}
              />
            </div>

            {/* New Membership Selection */}
            {changeMembership && (
              <div className="space-y-2">
                <Label>Nouveau type d'abonnement</Label>
                <Select value={newMembership} onValueChange={setNewMembership}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner le type" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    {membershipCategories.map((category) => (
                      <SelectItem key={category.id} value={category.name}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRenewalDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleRenewSubscription}>
              Confirmer le renouvellement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Member Activity Dialog */}
      {activityMember && (
        <MemberActivityDialog
          member={activityMember}
          weeklyTrainings={weeklyTrainings}
          onClose={() => setActivityMember(null)}
          onMemberUpdated={() => {
            loadSubscriptions();
            setActivityMember(null);
          }}
        />
      )}
    </div>
  );
};

export default ExpiringSubscriptions;
