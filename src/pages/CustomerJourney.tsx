import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { format, differenceInWeeks, startOfWeek, parseISO, addWeeks, startOfYear } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { MemberActivityDialog } from "@/components/MemberActivityDialog";
import { AddMemberDialog, type MemberFormData } from "@/components/AddMemberDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, X } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useTranslations } from "@/hooks/useTranslations";
import { useAccountingCategories } from "@/hooks/useAccountingCategories";
import { cn } from "@/lib/utils";
import { useCustomerMembers } from "@/hooks/useCustomerMembers";
import type { Member } from "@/hooks/useCustomerMembers";

const CustomerJourney = () => {
  const { t } = useTranslations();
  const { revenueCategories, isLoading: categoriesLoading } = useAccountingCategories();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedView, setSelectedView] = useState("index");
  const [selectedYear, setSelectedYear] = useState<number | "all">(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [memberStatus, setMemberStatus] = useState<"active" | "exited" | "all">("active");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const {
    members,
    weeklyTrainings,
    isLoading,
    addMember: addMemberToDb,
    updateMember: updateMemberInDb,
    deleteMember: deleteMemberFromDb,
    updateWeeklyTraining: updateWeeklyTrainingInDb,
    getWeeklyTraining,
  } = useCustomerMembers();

  // Dynamic membership types from accounting categories
  const membershipTypes = revenueCategories.map(cat => cat.name);

  // Memberships that require training tracking (updated names)
  const trackingRequiredMemberships = [
    "THE COACH PASS MENSUEL",
    "HUBFIT",
    "UNLIMITED ACCESS - PAIEMENT MENSUEL",
    "UNLIMITED ACCESS - PAIEMENT X1 - ANNUEL",
    "UNLIMITED ACCESS DUO - PAIEMENT MENSUEL",
    "UNLIMITED ACCESS DUO - PAIEMENT ANNUEL X1",
    "OFFRE 6 MOIS - 499 CHF",
    "UNLIMITED ACCESS SANS EMGAGEMENT - PAIEMENT MENSUEL",
    "PT ANTOINE",
    "OFFRE 3 MOIS",
  ];

  const requiresTrainingTracking = (membership: string): boolean => {
    return trackingRequiredMemberships.includes(membership);
  };

  // Note: membership is now directly used as revenue category (1:1 mapping)
  
  // Handle navigation from KPI Client
  useEffect(() => {
    const weekParam = searchParams.get('week');
    const yearParam = searchParams.get('year');
    const memberIdParam = searchParams.get('memberId');
    
    if (weekParam && yearParam && memberIdParam) {
      const year = parseInt(yearParam);
      const week = parseInt(weekParam);
      
      setSelectedYear(year);
      setSelectedView(`week-${week}`);
      
      const member = members.find(m => m.id === memberIdParam);
      if (member) {
        setSearchTerm(member.name);
      }
      
      // Clear params after navigation
      setSearchParams({});
    }
  }, [searchParams, members, setSearchParams]);

  // Generate week labels with dates for selected year
  const weekLabels = useMemo(() => {
    const year = selectedYear === "all" ? new Date().getFullYear() : selectedYear;
    
    // Start from the first Monday of the year (or last Monday of previous year if Jan 1 is early in the week)
    const jan1 = new Date(year, 0, 1);
    const firstMonday = startOfWeek(jan1, { weekStartsOn: 1 });
    
    // End date is the last day that belongs to this year (accounting for weeks that span into next year)
    const dec31 = new Date(year, 11, 31);
    const lastMondayOfYear = startOfWeek(dec31, { weekStartsOn: 1 });
    
    const weeks = [];
    let weekNumber = 1;
    let currentWeekStart = new Date(firstMonday);
    
    // Generate weeks while the week start is before or on the last Monday that contains a day in our year
    while (currentWeekStart <= lastMondayOfYear && weekNumber <= 53) {
      const formattedDate = format(currentWeekStart, "EEEE dd/MM", { locale: fr });
      weeks.push({
        value: `week-${weekNumber}`,
        label: `S${weekNumber} : ${formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)}`,
        weekStart: new Date(currentWeekStart)
      });
      
      weekNumber++;
      currentWeekStart = addWeeks(currentWeekStart, 1);
    }
    
    return weeks;
  }, [selectedYear]);

  // Generate available years (current year - 2 to current year + 2) plus "all" option
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return [
      { value: "all", label: "Toutes les années" },
      ...Array.from({ length: 5 }, (_, i) => ({
        value: currentYear - 2 + i,
        label: (currentYear - 2 + i).toString()
      }))
    ];
  }, []);

  // Months list
  const months = useMemo(() => [
    { value: "all", label: "Tous les mois" },
    { value: 0, label: "Janvier" },
    { value: 1, label: "Février" },
    { value: 2, label: "Mars" },
    { value: 3, label: "Avril" },
    { value: 4, label: "Mai" },
    { value: 5, label: "Juin" },
    { value: 6, label: "Juillet" },
    { value: 7, label: "Août" },
    { value: 8, label: "Septembre" },
    { value: 9, label: "Octobre" },
    { value: 10, label: "Novembre" },
    { value: 11, label: "Décembre" },
  ], []);

  // Filter members - search is independent from date filters
  const filteredMembers = useMemo(() => {
    if (selectedView !== "index") return members;

    return members.filter(member => {
      // Apply status filter first
      const isExited = member.exit_date && parseISO(member.exit_date) < new Date();
      
      if (memberStatus === "active" && isExited) return false;
      if (memberStatus === "exited" && !isExited) return false;

      // If search term is present, only filter by search (ignore date filters)
      if (searchTerm) {
        return member.name.toLowerCase().includes(searchTerm.toLowerCase());
      }

      // If "all years" is selected and "all months", show all members matching status
      if (selectedYear === "all" && selectedMonth === "all") {
        return true;
      }

      // If no contract date, show member only if viewing all
      if (!member.contract_signed_date) {
        return selectedYear === "all";
      }
      
      const contractDate = parseISO(member.contract_signed_date);
      const contractYear = contractDate.getFullYear();
      const contractMonth = contractDate.getMonth();

      // Apply year filter if not "all"
      if (selectedYear !== "all" && contractYear !== selectedYear) return false;
      
      // Apply month filter if not "all"
      if (selectedMonth !== "all" && contractMonth !== selectedMonth) return false;

      return true;
    });
  }, [members, selectedView, selectedYear, selectedMonth, searchTerm, memberStatus]);

  const addMember = async (memberData: MemberFormData) => {
    if (memberData.name.trim()) {
      const newMember = {
        name: memberData.name,
        membership: memberData.membership,
        member_type: memberData.memberType,
        cash_collected: memberData.cashCollected || 0,
        contract_signed_date: memberData.contractDate ? format(memberData.contractDate, "yyyy-MM-dd") : null,
      };
      
      // Add member to database
      await addMemberToDb(newMember.name, newMember.membership);
      
      // Wait a bit for the member to be created
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Get the created member
      const { data: createdMemberData } = await supabase
        .from('customer_members')
        .select('*')
        .eq('name', newMember.name)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (createdMemberData) {
        // Update with additional fields
        await updateMemberInDb(createdMemberData.id, {
          member_type: newMember.member_type,
          cash_collected: newMember.cash_collected,
          contract_signed_date: newMember.contract_signed_date,
        });
        
        // Create accounting transaction if cash collected
        if (newMember.cash_collected > 0) {
          const transactionDate = memberData.contractDate || new Date();
          const currentMonth = transactionDate.getMonth() + 1;
          const currentYear = transactionDate.getFullYear();
          
          // Use membership directly as category (1:1 synchronization)
          const category = newMember.membership;
          
          // Map member type to product description
          let productDescription = "Revenu EFT Général";
          if (newMember.member_type === "Membres PT") {
            productDescription = "Revenu PT";
          } else if (newMember.member_type === "Membres PIF") {
            productDescription = "Membre PIF";
          }
          
          // Create accounting transaction with complete information
          await supabase
            .from('accounting_transactions')
            .insert({
              transaction_date: format(transactionDate, "yyyy-MM-dd"),
              transaction_type: "revenue",
              category: category,
              client_name: newMember.name,
              service_description: memberData.serviceDescription || newMember.membership,
              product_description: productDescription,
              amount: newMember.cash_collected,
              amount_received: newMember.cash_collected,
              payment_method: memberData.paymentMethod,
              invoice_number: memberData.invoiceNumber || null,
              notes: "Ajouté depuis Parcours Client",
              year: currentYear,
              month: currentMonth,
              month_name: new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(transactionDate),
            });
        }
      }
      
      // Force page refresh to show new member immediately
      window.location.reload();
    }
  };

  const deleteMember = async (id: string) => {
    // Get member name before deleting
    const member = members.find(m => m.id === id);
    if (member) {
      // Delete associated accounting transactions
      await supabase
        .from('accounting_transactions')
        .delete()
        .eq('client_name', member.name);
    }
    
    // Delete member from database
    await deleteMemberFromDb(id);
  };

  const updateMember = async (id: string, field: string, value: any) => {
    const member = members.find(m => m.id === id);
    
    // When exit_date is set, we keep existing transactions
    // The recurring generation logic will naturally stop creating new transactions after this date
    
    // If updating member_type, sync with accounting transactions
    if (field === "member_type" && member) {
      // Map member type to product description
      let productDescription = "Revenu EFT Général";
      if (value === "Membres PT") {
        productDescription = "Revenu PT";
      } else if (value === "Membres PIF") {
        productDescription = "Membre PIF";
      }
      
      // Update all accounting transactions for this member
      await supabase
        .from('accounting_transactions')
        .update({ product_description: productDescription })
        .eq('client_name', member.name)
        .eq('transaction_type', 'revenue');
    }
    
    // Log onboarding changes to history
    const onboardingFields = [
      'onboarding_bsport',
      'onboarding_hubfit', 
      'onboarding_nutrition',
      'questionnaire_coaching',
      'session_introduction'
    ];

    if (onboardingFields.includes(field)) {
      if (value === true) {
        // Delete any previous entry for this action_type and member
        await supabase
          .from('member_onboarding_history')
          .delete()
          .eq('member_id', id)
          .eq('action_type', field);

        // Log the new completion
        if (member) {
          const previousValue = member[field as keyof Member] as boolean;
          
          await supabase
            .from('member_onboarding_history')
            .insert([{
              member_id: id,
              action_type: field,
              previous_value: previousValue,
              new_value: value
            }]);
        }
      } else {
        // When unchecking, remove the history entry so it doesn't appear as completed
        await supabase
          .from('member_onboarding_history')
          .delete()
          .eq('member_id', id)
          .eq('action_type', field);
      }
    }
    
    // If updating contract_signed_date, sync with accounting transactions
    if (field === "contract_signed_date" && member && value) {
      const newDate = new Date(value);
      const newYear = newDate.getFullYear();
      const newMonth = newDate.getMonth() + 1;
      const newMonthName = new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(newDate);
      
      // Update all accounting transactions for this member to reflect new contract date
      await supabase
        .from('accounting_transactions')
        .update({
          transaction_date: value,
          year: newYear,
          month: newMonth,
          month_name: newMonthName
        })
        .eq('client_name', member.name)
        .eq('transaction_type', 'revenue');
        
      toast.success("Date de contrat mise à jour dans la comptabilité");
    }
    
    // If updating cash_collected, sync with accounting
    if (field === "cash_collected") {
      if (member) {
        const newAmount = parseFloat(value) || 0;
        const oldAmount = member.cash_collected || 0;
        
        if (newAmount > 0 && newAmount !== oldAmount) {
          const today = format(new Date(), "yyyy-MM-dd");
          const currentMonth = new Date().getMonth() + 1;
          const currentYear = new Date().getFullYear();
          
          // Use membership directly as category (1:1 synchronization)
          const category = member.membership;
          
          // Map member type to product description
          let productDescription = "Revenu EFT Général";
          if (member.member_type === "Membres PT") {
            productDescription = "Revenu PT";
          } else if (member.member_type === "Membres PIF") {
            productDescription = "Membre PIF";
          }
          
          // Create accounting transaction
          await supabase
            .from('accounting_transactions')
            .insert({
              transaction_date: today,
              transaction_type: "revenue",
              category: category,
              client_name: member.name,
              service_description: member.membership,
              product_description: productDescription,
              amount: newAmount,
              amount_received: newAmount,
              payment_method: "Prélèvement Automatique",
              notes: "Synchronisé depuis Parcours Client",
              year: currentYear,
              month: currentMonth,
              month_name: new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(new Date()),
            });
        }
      }
    }

    await updateMemberInDb(id, { [field]: value });
  };

  const isOnboardingComplete = (member: Member) => {
    return (
      member.onboarding_bsport &&
      member.onboarding_hubfit &&
      member.onboarding_nutrition &&
      member.questionnaire_coaching &&
      member.session_introduction
    );
  };

  const updateWeeklyTraining = async (memberId: string, weekNumber: number, trainingsCount: number) => {
    await updateWeeklyTrainingInDb(memberId, weekNumber, trainingsCount);
  };

  const getTrainingColor = (trainings: number) => {
    switch (trainings) {
      case 3:
        return "bg-green-500/20 text-green-700 dark:text-green-400";
      case 2:
        return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400";
      case 1:
        return "bg-orange-500/20 text-orange-700 dark:text-orange-400";
      case 0:
      default:
        return "bg-red-500/20 text-red-700 dark:text-red-400";
    }
  };

  const getMemberWeekNumber = (contractDate: string | null | undefined): number | null => {
    if (!contractDate) return null;
    
    try {
      const signedDate = parseISO(contractDate);
      const today = new Date();
      const weeksSinceSignature = differenceInWeeks(
        startOfWeek(today, { weekStartsOn: 1 }),
        startOfWeek(signedDate, { weekStartsOn: 1 })
      );
      return weeksSinceSignature + 1; // +1 car la première semaine est la semaine 1, pas 0
    } catch (error) {
      return null;
    }
  };

  // Get the absolute week number for a member based on their contract date and a given calendar week
  const getAbsoluteWeekForMember = (contractDate: string | null | undefined, calendarWeekStart: Date): number | null => {
    if (!contractDate) return null;
    
    try {
      const signedDate = parseISO(contractDate);
      const weeksSinceSignature = differenceInWeeks(
        startOfWeek(calendarWeekStart, { weekStartsOn: 1 }),
        startOfWeek(signedDate, { weekStartsOn: 1 })
      );
      return weeksSinceSignature + 1;
    } catch (error) {
      return null;
    }
  };

  // Filter members to show only those whose member week matches the selected calendar week
  const getFilteredMembersForWeek = (calendarWeekStart: Date) => {
    return members.filter(member => {
      if (!member.contract_signed_date) return false;

      // Filter out exited members (those with exit_date in the past)
      if (member.exit_date) {
        const exitDate = parseISO(member.exit_date);
        if (exitDate < calendarWeekStart) {
          return false;
        }
      }
      
      const memberWeekForThisCalendarWeek = getAbsoluteWeekForMember(member.contract_signed_date, calendarWeekStart);
      return memberWeekForThisCalendarWeek !== null && memberWeekForThisCalendarWeek > 0;
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 flex items-center justify-center">
        <p className="text-muted-foreground">Chargement des données...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Parcours Client
            </h1>
            <p className="text-muted-foreground mt-2">
              Suivez l'onboarding de vos membres
            </p>
          </div>
          <div className="flex gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>

        <Card className="p-6">
          <div className="space-y-4 mb-6">
            {/* Search Bar - Always visible in Index view */}
            {selectedView === "index" && (
              <div className="flex gap-3">
                <Input
                  placeholder="Rechercher un membre par nom..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 h-11 text-base"
                />
                {searchTerm && (
                  <Button 
                    variant="outline" 
                    onClick={() => setSearchTerm("")}
                    className="h-11"
                  >
                    Effacer
                  </Button>
                )}
              </div>
            )}

            {/* Filter Bar */}
            <div className="flex gap-3 items-center flex-wrap">
              <div className="flex gap-2 items-center">
                <span className="text-sm text-muted-foreground font-medium">Vue:</span>
                <Select value={selectedView} onValueChange={setSelectedView}>
                  <SelectTrigger className="w-[200px] bg-background z-50 h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50 max-h-[300px]">
                    <SelectItem value="index">Index</SelectItem>
                    {weekLabels.map((week) => (
                      <SelectItem key={week.value} value={week.value}>
                        {week.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="h-8 w-px bg-border" />

              {selectedView === "index" && (
                <div className="flex gap-2 items-center">
                  <span className="text-sm text-muted-foreground font-medium">Statut:</span>
                  <Select 
                    value={memberStatus} 
                    onValueChange={(value: "active" | "exited" | "all") => setMemberStatus(value)}
                  >
                    <SelectTrigger className="w-[140px] bg-background z-50 h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      <SelectItem value="active">Actifs</SelectItem>
                      <SelectItem value="exited">Sortis</SelectItem>
                      <SelectItem value="all">Tous</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="h-8 w-px bg-border" />

              <div className="flex gap-2 items-center">
                <span className="text-sm text-muted-foreground font-medium">Année:</span>
                <Select 
                  value={selectedYear.toString()} 
                  onValueChange={(value) => setSelectedYear(value === "all" ? "all" : parseInt(value))}
                >
                  <SelectTrigger className="w-[160px] bg-background z-50 h-10">
                    <SelectValue placeholder="Année" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    {availableYears.map((year) => (
                      <SelectItem key={year.value.toString()} value={year.value.toString()}>
                        {year.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedView === "index" && !searchTerm && (
                <>
                  <div className="flex gap-2 items-center">
                    <span className="text-sm text-muted-foreground font-medium">Mois:</span>
                    <Select 
                      value={selectedMonth.toString()} 
                      onValueChange={(value) => setSelectedMonth(value === "all" ? "all" : parseInt(value))}
                    >
                      <SelectTrigger className="w-[140px] bg-background z-50 h-10">
                        <SelectValue placeholder="Mois" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-lg z-50">
                        {months.map((month) => (
                          <SelectItem key={month.value.toString()} value={month.value.toString()}>
                            {month.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {selectedView === "index" && (
                <>
                  <div className="flex-1" />
                  <AddMemberDialog onAdd={addMember} />
                </>
              )}
            </div>

            {/* Active filters indicator */}
            {selectedView === "index" && (searchTerm || selectedMonth !== "all" || selectedYear !== "all") && (
              <div className="flex gap-2 items-center text-sm text-muted-foreground flex-wrap">
                <span className="font-medium">Filtres actifs:</span>
                {searchTerm && (
                  <span className="px-2 py-1 bg-primary/10 text-primary rounded">
                    Recherche: "{searchTerm}"
                  </span>
                )}
                {!searchTerm && selectedYear === "all" && selectedMonth === "all" && (
                  <span className="px-2 py-1 bg-green-500/10 text-green-700 dark:text-green-400 rounded font-medium">
                    Vue globale - Tous les membres actifs
                  </span>
                )}
                {!searchTerm && selectedYear !== "all" && selectedMonth !== "all" && (
                  <span className="px-2 py-1 bg-primary/10 text-primary rounded">
                    {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
                  </span>
                )}
                {!searchTerm && selectedYear !== "all" && selectedMonth === "all" && (
                  <span className="px-2 py-1 bg-primary/10 text-primary rounded">
                    Année: {selectedYear}
                  </span>
                )}
                {!searchTerm && selectedYear === "all" && selectedMonth !== "all" && (
                  <span className="px-2 py-1 bg-primary/10 text-primary rounded">
                    Mois: {months.find(m => m.value === selectedMonth)?.label}
                  </span>
                )}
              </div>
            )}
          </div>

          {selectedView === "index" ? (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px] text-center">N°</TableHead>
                      <TableHead className="min-w-[150px]">Nom / Prénom</TableHead>
                      <TableHead className="min-w-[200px]">Membership</TableHead>
                      <TableHead className="min-w-[150px]">Type</TableHead>
                      <TableHead className="min-w-[150px]">Cash Collectée</TableHead>
                      <TableHead className="min-w-[180px]">Date Signature Contrat</TableHead>
                      <TableHead className="min-w-[180px]">Date de Sortie</TableHead>
                      <TableHead className="text-center">Onboarding Bsport</TableHead>
                      <TableHead className="text-center">Onboarding Hubfit</TableHead>
                      <TableHead className="text-center">Onboarding Nutrition</TableHead>
                      <TableHead className="text-center">Questionnaire Coaching</TableHead>
                      <TableHead className="text-center">Session Introduction Club</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMembers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={13} className="text-center text-muted-foreground py-8">
                          {searchTerm 
                            ? `Aucun membre trouvé pour "${searchTerm}"`
                            : selectedYear === "all" && selectedMonth === "all"
                            ? "Aucun membre actif. Ajoutez-en un pour commencer."
                            : selectedMonth !== "all" 
                            ? `Aucun membre n'a signé en ${months.find(m => m.value === selectedMonth)?.label} ${selectedYear === "all" ? "" : selectedYear}`
                            : `Aucun membre pour ${selectedYear}. Ajoutez-en un pour commencer.`
                          }
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredMembers.map((member, index) => {
                        const isExited = member.exit_date && parseISO(member.exit_date) < new Date();
                        return (
                          <TableRow key={member.id}>
                            <TableCell className="text-center font-medium text-muted-foreground">
                              {index + 1}
                            </TableCell>
                          <TableCell>
                            <span 
                              className="font-medium cursor-pointer hover:text-primary hover:underline transition-colors"
                              onClick={() => setSelectedMemberId(member.id)}
                            >
                              {member.name}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={member.membership}
                              onValueChange={(value) =>
                                updateMember(member.id, "membership", value)
                              }
                            >
                              <SelectTrigger className="min-w-[180px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-background border shadow-lg z-50">
                                {membershipTypes.map((type) => (
                                  <SelectItem key={type} value={type}>
                                    {type}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={member.member_type || ""}
                              onValueChange={(value) =>
                                updateMember(member.id, "member_type", value)
                              }
                            >
                              <SelectTrigger className="min-w-[150px]">
                                <SelectValue placeholder="Sélectionner" />
                              </SelectTrigger>
                              <SelectContent className="bg-background border shadow-lg z-50">
                                <SelectItem value="Membres Généraux Récurrents">Membres Généraux Récurrents</SelectItem>
                                <SelectItem value="Membres PIF">Membres PIF</SelectItem>
                                <SelectItem value="Membres PT">Membres PT</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={member.cash_collected || 0}
                              onChange={(e) =>
                                updateMember(member.id, "cash_collected", parseFloat(e.target.value) || 0)
                              }
                              className="w-[120px]"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "w-[180px] justify-start text-left font-normal",
                                      !member.contract_signed_date && "text-muted-foreground"
                                    )}
                                  >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {member.contract_signed_date
                                      ? format(new Date(member.contract_signed_date), "dd/MM/yyyy")
                                      : "Sélectionner"}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 bg-background border shadow-lg z-50" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={member.contract_signed_date ? new Date(member.contract_signed_date) : undefined}
                                    onSelect={(date) =>
                                      updateMember(member.id, "contract_signed_date", date?.toISOString().split('T')[0] || null)
                                    }
                                    initialFocus
                                    className="pointer-events-auto"
                                  />
                                </PopoverContent>
                              </Popover>
                              {member.contract_signed_date && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => updateMember(member.id, "contract_signed_date", null)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "w-[180px] justify-start text-left font-normal",
                                      !member.exit_date && "text-muted-foreground",
                                      isExited ? "bg-red-500/10" : "bg-green-500/10"
                                    )}
                                  >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {member.exit_date
                                      ? format(new Date(member.exit_date), "dd/MM/yyyy")
                                      : "Actif"}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 bg-background border shadow-lg z-50" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={member.exit_date ? new Date(member.exit_date) : undefined}
                                    onSelect={(date) =>
                                      updateMember(member.id, "exit_date", date?.toISOString().split('T')[0] || null)
                                    }
                                    initialFocus
                                    className="pointer-events-auto"
                                  />
                                </PopoverContent>
                              </Popover>
                              {member.exit_date && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => updateMember(member.id, "exit_date", null)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={member.onboarding_bsport}
                            onCheckedChange={(checked) =>
                              updateMember(member.id, "onboarding_bsport", checked)
                            }
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={member.onboarding_hubfit}
                            onCheckedChange={(checked) =>
                              updateMember(member.id, "onboarding_hubfit", checked)
                            }
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={member.onboarding_nutrition}
                            onCheckedChange={(checked) =>
                              updateMember(member.id, "onboarding_nutrition", checked)
                            }
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={member.questionnaire_coaching}
                            onCheckedChange={(checked) =>
                              updateMember(member.id, "questionnaire_coaching", checked)
                            }
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={member.session_introduction}
                            onCheckedChange={(checked) =>
                              updateMember(member.id, "session_introduction", checked)
                            }
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMember(member.id)}
                            className="hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
              </Table>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Nom / Prénom</TableHead>
                    <TableHead className="min-w-[200px]">Membership</TableHead>
                    <TableHead className="text-center min-w-[120px]">Semaine Membre</TableHead>
                    <TableHead className="text-center min-w-[150px]">Onboarding Complété</TableHead>
                    <TableHead className="text-center min-w-[200px]">Entraînements cette semaine</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const weekIndex = parseInt(selectedView.replace("week-", "")) - 1;
                    const weekData = weekLabels[weekIndex];
                    if (!weekData) return null;

                    const filteredMembers = getFilteredMembersForWeek(weekData.weekStart);

                    if (filteredMembers.length === 0) {
                      return (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            Aucun membre actif pour cette semaine. Les membres ne sont affichés que pour les semaines qui correspondent à leur parcours depuis la signature du contrat.
                          </TableCell>
                        </TableRow>
                      );
                    }

                    return filteredMembers.map((member) => {
                      const week = parseInt(selectedView.replace("week-", ""));
                      const trainingsCalendarWeek = week; // calendar week if needed later
                      const trainingsWeekData = weekData;
                      const memberWeek = getAbsoluteWeekForMember(member.contract_signed_date, weekData.weekStart);
                      const trainings = memberWeek ? getWeeklyTraining(member.id, memberWeek) : 0;
                      
                      return (
                        <TableRow key={member.id}>
                          <TableCell>
                            <span 
                              className="font-medium cursor-pointer hover:text-primary hover:underline transition-colors"
                              onClick={() => setSelectedMemberId(member.id)}
                            >
                              {member.name}
                            </span>
                          </TableCell>
                          <TableCell>{member.membership}</TableCell>
                          <TableCell className="text-center">
                            {memberWeek !== null && memberWeek > 0 ? (
                              <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">
                                S{memberWeek}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">Non défini</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center">
                              <Checkbox
                                checked={isOnboardingComplete(member)}
                                disabled
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            {requiresTrainingTracking(member.membership) ? (
                              <div className="flex items-center justify-center gap-2">
                                <Select
                                  value={trainings.toString()}
                                  onValueChange={(value) =>
                                    updateWeeklyTraining(member.id, memberWeek ?? 0, parseInt(value))
                                  }
                                >
                                  <SelectTrigger
                                    className={cn(
                                      "w-[120px]",
                                      getTrainingColor(trainings)
                                    )}
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-background border shadow-lg z-50">
                                    <SelectItem value="0">0</SelectItem>
                                    <SelectItem value="1">1</SelectItem>
                                    <SelectItem value="2">2</SelectItem>
                                    <SelectItem value="3">3</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center">
                                <span className="text-muted-foreground text-sm font-medium">N/A</span>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })()}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        <MemberActivityDialog
          member={members.find(m => m.id === selectedMemberId) || null}
          weeklyTrainings={weeklyTrainings}
          onClose={() => setSelectedMemberId(null)}
          onNavigateToWeek={(week, year) => {
            setSelectedYear(year);
            setSelectedView(`week-${week}`);
          }}
        />
      </div>
    </div>
  );
};

export default CustomerJourney;
