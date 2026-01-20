import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { format, differenceInWeeks, startOfWeek, parseISO, addWeeks, startOfYear, subWeeks } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon, Users, Wallet, CheckCircle2, AlertTriangle, TrendingUp, TrendingDown, Activity, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { MemberActivityDialog } from "@/components/MemberActivityDialog";
import { AddMemberDialog, type MemberFormData } from "@/components/AddMemberDialog";
import { MembershipCategoryCard } from "@/components/MembershipCategoryCard";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { ExportButton } from "@/components/ExportButton";
import { OnboardingFilter, getOnboardingStatus, type OnboardingStatus } from "@/components/OnboardingFilter";
import { PageSkeleton } from "@/components/TableSkeleton";
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
import { useCoachMembership } from "@/hooks/useCoachMembership";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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
  const [onboardingFilter, setOnboardingFilter] = useState<OnboardingStatus>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<{ id: string; name: string } | null>(null);
  const [engagementViewMode, setEngagementViewMode] = useState<"week" | "year">("week");
  const [showAllAtRisk, setShowAllAtRisk] = useState(false);

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

  // Use shared hook for coach membership detection
  const { isCoachMembership } = useCoachMembership();

  // Dynamic membership types from accounting categories
  const membershipTypes = revenueCategories.map(cat => cat.name);

  // Memberships that require training tracking - now from database
  const trackingRequiredMemberships = useMemo(() => {
    return revenueCategories
      .filter(cat => cat.requires_training_tracking)
      .map(cat => cat.name);
  }, [revenueCategories]);

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

  // Generate available years (2023 to current year + 2) plus "all" option
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const startYear = 2023;
    const endYear = currentYear + 2;
    const years = [];
    for (let year = startYear; year <= endYear; year++) {
      years.push({ value: year, label: year.toString() });
    }
    return [
      { value: "all", label: "Toutes les années" },
      ...years
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return members.filter(member => {
      // Determine member's active period
      const hasContractDate = !!member.contract_signed_date;
      const contractDate = hasContractDate ? parseISO(member.contract_signed_date!) : null;
      
      // End date is subscription_end_date or exit_date (whichever exists)
      const endDateStr = member.subscription_end_date || member.exit_date;
      const endDate = endDateStr ? parseISO(endDateStr) : null;
      
      // A member is "exited" if their end date is in the past (strictly before today)
      // Members whose end date is today are still considered active for that day
      const isExited = endDate && endDate < today;
      
      // Apply status filter
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

      // For "exited" members viewing, filter by exit_date
      if (memberStatus === "exited" && endDate) {
        const exitYear = endDate.getFullYear();
        const exitMonth = endDate.getMonth();

        if (selectedYear !== "all" && exitYear !== selectedYear) return false;
        if (selectedMonth !== "all" && exitMonth !== selectedMonth) return false;

        return true;
      }

      // For "active" members, show them for ALL years between contract_signed_date and end date
      if (!contractDate) {
        return selectedYear === "all";
      }
      
      const contractYear = contractDate.getFullYear();
      const contractMonth = contractDate.getMonth();
      
      // Determine the end year/month for filtering
      let endYear = new Date().getFullYear();
      let endMonth = 11; // December by default
      
      if (endDate) {
        endYear = endDate.getFullYear();
        endMonth = endDate.getMonth();
      }

      // Apply year filter - member is visible if selected year is within their active period
      if (selectedYear !== "all") {
        // Member should appear in all years from contract year to end year (inclusive)
        if (selectedYear < contractYear || selectedYear > endYear) return false;
        
        // Apply month filter only if year matches start or end year
        if (selectedMonth !== "all") {
          // If selected year is the contract year, member should appear from contract month onwards
          if (selectedYear === contractYear && selectedMonth < contractMonth) return false;
          // If selected year is the end year, member should appear until end month (inclusive)
          if (selectedYear === endYear && selectedMonth > endMonth) return false;
        }
      }

      return true;
    });
  }, [members, selectedView, selectedYear, selectedMonth, searchTerm, memberStatus]);

  const addMember = async (memberData: MemberFormData) => {
    if (memberData.name.trim()) {
      const contractDate = memberData.contractDate ? format(memberData.contractDate, "yyyy-MM-dd") : null;
      const subscriptionEndDate = memberData.subscriptionEndDate ? format(memberData.subscriptionEndDate, "yyyy-MM-dd") : null;
      
      // Get current user's email for sold_by
      const { data: { user } } = await supabase.auth.getUser();
      const soldBy = user?.email?.split('@')[0] || 'User';
      
      // Generate subscription group ID for duo subscriptions
      const subscriptionGroupId = memberData.isDuoSubscription ? crypto.randomUUID() : null;
      const personsCount = memberData.isDuoSubscription ? 2 : 1;
      
      // Map member type to product description
      let productDescription = "Revenu EFT Général";
      if (memberData.memberType === "Membres PT") {
        productDescription = "Revenu PT";
      } else if (memberData.memberType === "Membres PIF") {
        productDescription = "Membre PIF";
      }
      
      // Create primary member
      const { data: primaryMember, error: primaryError } = await supabase
        .from('customer_members')
        .insert({
          name: memberData.name,
          membership: memberData.membership,
          member_type: memberData.memberType,
          cash_collected: memberData.cashCollected || 0,
          contract_signed_date: contractDate,
          subscription_end_date: subscriptionEndDate,
          exit_date: subscriptionEndDate,
          sold_by: soldBy,
          persons_count: personsCount,
          subscription_group_id: subscriptionGroupId,
          is_primary_subscriber: true,
        })
        .select()
        .single();
      
      if (primaryError) {
        toast.error("Erreur lors de la création du membre principal");
        console.error(primaryError);
        return;
      }
      
      // Create accounting transaction only for primary member (cash collected)
      if (memberData.cashCollected > 0) {
        const transactionDate = memberData.contractDate || new Date();
        const currentMonth = transactionDate.getMonth() + 1;
        const currentYear = transactionDate.getFullYear();
        
        await supabase
          .from('accounting_transactions')
          .insert({
            transaction_date: format(transactionDate, "yyyy-MM-dd"),
            transaction_type: "revenue",
            category: memberData.membership,
            client_name: memberData.name,
            service_description: memberData.serviceDescription || memberData.membership,
            product_description: productDescription,
            amount: memberData.cashCollected,
            amount_received: memberData.cashCollected,
            payment_method: memberData.paymentMethod,
            invoice_number: memberData.invoiceNumber || null,
            notes: memberData.isDuoSubscription ? "Abonnement Duo - Membre Principal" : "Ajouté depuis Parcours Client",
            year: currentYear,
            month: currentMonth,
            month_name: new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(transactionDate),
          });
      }
      
      // Create secondary member for duo subscriptions
      if (memberData.isDuoSubscription && memberData.secondPersonName?.trim()) {
        const { error: secondaryError } = await supabase
          .from('customer_members')
          .insert({
            name: memberData.secondPersonName.trim(),
            membership: memberData.membership,
            member_type: memberData.memberType,
            cash_collected: 0, // Secondary member has NO cash collected
            contract_signed_date: contractDate,
            subscription_end_date: subscriptionEndDate,
            exit_date: subscriptionEndDate,
            sold_by: soldBy,
            persons_count: 1, // Individual person count
            subscription_group_id: subscriptionGroupId,
            is_primary_subscriber: false,
          });
        
        if (secondaryError) {
          toast.error("Erreur lors de la création du membre secondaire");
          console.error(secondaryError);
        } else {
          toast.success(`Abonnement duo créé pour ${memberData.name} et ${memberData.secondPersonName}`);
        }
      } else {
        toast.success(`${memberData.name} ajouté avec succès`);
      }
      
      // Force page refresh to show new members immediately
      window.location.reload();
    }
  };

  const handleDeleteClick = (id: string) => {
    const member = members.find(m => m.id === id);
    if (member) {
      setMemberToDelete({ id, name: member.name });
      setDeleteDialogOpen(true);
    }
  };

  const confirmDelete = async () => {
    if (!memberToDelete) return;
    
    const member = members.find(m => m.id === memberToDelete.id);
    if (member) {
      // Delete associated accounting transactions
      await supabase
        .from('accounting_transactions')
        .delete()
        .eq('client_name', member.name);
    }
    
    // Delete member from database
    await deleteMemberFromDb(memberToDelete.id);
    setDeleteDialogOpen(false);
    setMemberToDelete(null);
    toast.success(`${memberToDelete.name} supprimé avec succès`);
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
    
    // If updating subscription_end_date, sync with exit_date
    if (field === "subscription_end_date") {
      // Synchronize subscription_end_date with exit_date
      await updateMemberInDb(id, { exit_date: value });
      
      if (value) {
        toast.success("Date de fin d'abonnement synchronisée avec la date de sortie");
      }
    }
    
    // If updating cash_collected, sync with accounting
    if (field === "cash_collected") {
      if (member) {
        const newAmount = parseFloat(value) || 0;
        const oldAmount = member.cash_collected || 0;
        
        if (newAmount > 0 && newAmount !== oldAmount) {
          // Use contract_signed_date if available, otherwise use current date
          const transactionDate = member.contract_signed_date 
            ? parseISO(member.contract_signed_date) 
            : new Date();
          const currentMonth = transactionDate.getMonth() + 1;
          const currentYear = transactionDate.getFullYear();
          const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 
                             'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
          
          // Use membership directly as category (1:1 synchronization)
          const category = member.membership;
          
          // Map member type to product description
          let productDescription = "Revenu EFT Général";
          if (member.member_type === "Membres PT") {
            productDescription = "Revenu PT";
          } else if (member.member_type === "Membres PIF") {
            productDescription = "Membre PIF";
          }
          
          // Create accounting transaction with member's contract date
          await supabase
            .from('accounting_transactions')
            .insert({
              transaction_date: format(transactionDate, "yyyy-MM-dd"),
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
              month_name: monthNames[currentMonth - 1],
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

  const updateWeeklyTraining = async (
    memberId: string, 
    weekNumber: number, 
    trainingsCount: number,
    calendarWeek?: number,
    calendarYear?: number
  ) => {
    await updateWeeklyTrainingInDb(memberId, weekNumber, trainingsCount, calendarWeek, calendarYear);
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

  const getMembershipStyle = (membership: string) => {
    // Define color categories for different membership types
    const membershipCategories: Record<string, { bg: string; text: string; border: string }> = {
      // Unlimited/Full access - Blue
      "Unlimited Access": { bg: "bg-blue-500/10", text: "text-blue-700 dark:text-blue-400", border: "border-blue-500/30" },
      "Hybrid FULL": { bg: "bg-blue-500/10", text: "text-blue-700 dark:text-blue-400", border: "border-blue-500/30" },
      
      // Regular/Basic plans - Green
      "Hybrid Matin": { bg: "bg-green-500/10", text: "text-green-700 dark:text-green-400", border: "border-green-500/30" },
      "Hybrid Soir": { bg: "bg-green-500/10", text: "text-green-700 dark:text-green-400", border: "border-green-500/30" },
      
      // Packs/Challenges - Purple
      "Pack 20 sessions": { bg: "bg-purple-500/10", text: "text-purple-700 dark:text-purple-400", border: "border-purple-500/30" },
      "Pack 10": { bg: "bg-purple-500/10", text: "text-purple-700 dark:text-purple-400", border: "border-purple-500/30" },
      "6 Weeks Challenge": { bg: "bg-purple-500/10", text: "text-purple-700 dark:text-purple-400", border: "border-purple-500/30" },
      
      // Special/Free - Orange
      "Abonnement offert": { bg: "bg-orange-500/10", text: "text-orange-700 dark:text-orange-400", border: "border-orange-500/30" },
      
      // Paused/Inactive - Gray
      "Pause": { bg: "bg-gray-500/10", text: "text-gray-700 dark:text-gray-400", border: "border-gray-500/30" },
    };

    return membershipCategories[membership] || { 
      bg: "bg-slate-500/10", 
      text: "text-slate-700 dark:text-slate-400", 
      border: "border-slate-500/30" 
    };
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

      // Filter out members whose subscription or exit date is before the selected week
      // Use exit_date if available, otherwise use subscription_end_date
      const endDateStr = member.exit_date || member.subscription_end_date;
      if (endDateStr) {
        const endDate = parseISO(endDateStr);
        if (endDate < calendarWeekStart) {
          return false;
        }
      }
      
      const memberWeekForThisCalendarWeek = getAbsoluteWeekForMember(member.contract_signed_date, calendarWeekStart);
      return memberWeekForThisCalendarWeek !== null && memberWeekForThisCalendarWeek > 0;
    });
  };

  // Summary statistics calculations
  const summaryStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // A member is active if they have no exit_date OR if their exit_date is in the future
    const allActiveMembers = members.filter(m => {
      if (!m.exit_date) return true;
      const exitDate = parseISO(m.exit_date);
      return exitDate >= today;
    });
    
    // Separate active members from coaches
    const activeMembers = allActiveMembers.filter(m => !isCoachMembership(m.membership));
    const activeCoaches = allActiveMembers.filter(m => isCoachMembership(m.membership));
    
    const totalCashCollected = activeMembers.reduce((sum, m) => sum + (m.cash_collected || 0), 0);
    const coachCashCollected = activeCoaches.reduce((sum, m) => sum + (m.cash_collected || 0), 0);
    
    const onboardingComplete = activeMembers.filter(m => 
      m.onboarding_bsport && m.onboarding_hubfit && m.onboarding_nutrition && 
      m.questionnaire_coaching && m.session_introduction
    ).length;
    
    const onboardingRate = activeMembers.length > 0 
      ? Math.round((onboardingComplete / activeMembers.length) * 100) 
      : 0;

    // Members at risk (no training in last 2 weeks for tracking required memberships) - only for club members
    const atRiskMembers = activeMembers.filter(member => {
      if (!requiresTrainingTracking(member.membership)) return false;
      if (!member.contract_signed_date) return false;
      
      const memberWeek = getMemberWeekNumber(member.contract_signed_date);
      if (!memberWeek || memberWeek < 3) return false;
      
      const lastTwoWeeksTrainings = 
        getWeeklyTraining(member.id, memberWeek) + 
        getWeeklyTraining(member.id, memberWeek - 1);
      
      return lastTwoWeeksTrainings === 0;
    });

    return {
      totalActive: activeMembers.length,
      totalCoaches: activeCoaches.length,
      totalCash: totalCashCollected,
      coachCash: coachCashCollected,
      onboardingRate,
      onboardingComplete,
      atRiskCount: atRiskMembers.length,
      atRiskMembers
    };
  }, [members, weeklyTrainings]);

  // Member evolution data for chart (last 6 months)
  const evolutionData = useMemo(() => {
    const data = [];
    const today = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);
      
      const activeInMonth = members.filter(member => {
        if (!member.contract_signed_date) return false;
        const contractDate = parseISO(member.contract_signed_date);
        if (contractDate > monthEnd) return false;
        
        if (member.exit_date) {
          const exitDate = parseISO(member.exit_date);
          if (exitDate < monthDate) return false;
        }
        return true;
      }).length;
      
      const newInMonth = members.filter(member => {
        if (!member.contract_signed_date) return false;
        const contractDate = parseISO(member.contract_signed_date);
        return contractDate.getMonth() === monthDate.getMonth() && 
               contractDate.getFullYear() === monthDate.getFullYear();
      }).length;
      
      data.push({
        month: format(monthDate, 'MMM yy', { locale: fr }),
        actifs: activeInMonth,
        nouveaux: newInMonth
      });
    }
    
    return data;
  }, [members]);

  // Get engagement level for a member
  // Returns 'none' for members that don't require tracking (they stay gray/neutral)
  // Get current calendar week number
  const getCurrentCalendarWeek = (): number => {
    const today = new Date();
    const year = selectedYear === "all" ? today.getFullYear() : selectedYear;
    const jan1 = new Date(year, 0, 1);
    const firstMonday = startOfWeek(jan1, { weekStartsOn: 1 });
    const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weeksSinceStart = differenceInWeeks(currentWeekStart, firstMonday);
    return weeksSinceStart + 1;
  };

  // Weekly engagement: based on current calendar week trainings only
  const getWeeklyEngagement = (member: Member): 'high' | 'medium' | 'low' | 'at-risk' | 'none' => {
    if (!requiresTrainingTracking(member.membership)) return 'none';
    if (!member.contract_signed_date) return 'none';
    
    const memberWeek = getMemberWeekNumber(member.contract_signed_date);
    if (!memberWeek || memberWeek < 1) return 'none';
    
    // Get trainings for current member week
    const currentWeekTrainings = getWeeklyTraining(member.id, memberWeek);
    
    if (currentWeekTrainings >= 3) return 'high';
    if (currentWeekTrainings === 2) return 'medium';
    if (currentWeekTrainings === 1) return 'low';
    return 'at-risk';
  };

  // Yearly engagement: average over all weeks since contract signature
  const getYearlyEngagement = (member: Member): 'high' | 'medium' | 'low' | 'at-risk' | 'none' => {
    if (!requiresTrainingTracking(member.membership)) return 'none';
    if (!member.contract_signed_date) return 'none';
    
    const memberWeek = getMemberWeekNumber(member.contract_signed_date);
    if (!memberWeek || memberWeek < 1) return 'none';
    
    // Calculate total trainings and average over all weeks
    let totalTrainings = 0;
    for (let week = 1; week <= memberWeek; week++) {
      totalTrainings += getWeeklyTraining(member.id, week);
    }
    
    const avgPerWeek = totalTrainings / memberWeek;
    
    if (avgPerWeek >= 3) return 'high';
    if (avgPerWeek >= 2) return 'medium';
    if (avgPerWeek >= 1) return 'low';
    return 'at-risk';
  };

  // Combined function that uses the selected mode
  const getMemberEngagement = (member: Member): 'high' | 'medium' | 'low' | 'at-risk' | 'none' => {
    if (engagementViewMode === "year") {
      return getYearlyEngagement(member);
    }
    return getWeeklyEngagement(member);
  };

  const getEngagementStyle = (engagement: 'high' | 'medium' | 'low' | 'at-risk') => {
    switch (engagement) {
      case 'high': return 'border-l-4 border-l-green-500';
      case 'medium': return 'border-l-4 border-l-yellow-500';
      case 'low': return 'border-l-4 border-l-orange-500';
      case 'at-risk': return 'border-l-4 border-l-red-500';
      default: return '';
    }
  };

  if (isLoading) {
    return <PageSkeleton />;
  }

  // Prepare export data
  const exportData = filteredMembers.map(m => ({
    nom: m.name,
    type: m.member_type || "",
    abonnement: m.membership,
    cash_collecte: m.cash_collected || 0,
    date_contrat: m.contract_signed_date || "",
    fin_abonnement: m.subscription_end_date || "",
    onboarding_bsport: m.onboarding_bsport,
    onboarding_hubfit: m.onboarding_hubfit,
    onboarding_nutrition: m.onboarding_nutrition,
    questionnaire: m.questionnaire_coaching,
    session_intro: m.session_introduction,
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      <div className="container mx-auto p-6 space-y-6">
        <Breadcrumbs />
        
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
            <ExportButton data={exportData} filename="parcours-client" />
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>

        {/* Confirm Delete Dialog */}
        <ConfirmDeleteDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={confirmDelete}
          itemName={memberToDelete?.name}
        />

        {/* Summary Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Membres Actifs</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{summaryStats.totalActive}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <Wallet className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cash Collecté Total</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{summaryStats.totalCash.toLocaleString()} CHF</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <CheckCircle2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Onboarding Complété</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {summaryStats.onboardingRate}%
                  <span className="text-sm font-normal ml-1">({summaryStats.onboardingComplete}/{summaryStats.totalActive})</span>
                </p>
              </div>
            </div>
          </Card>

          <Card className={cn(
            "p-4 border",
            summaryStats.atRiskCount > 0 
              ? "bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20" 
              : "bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20"
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                summaryStats.atRiskCount > 0 ? "bg-red-500/20" : "bg-emerald-500/20"
              )}>
                <AlertTriangle className={cn(
                  "h-5 w-5",
                  summaryStats.atRiskCount > 0 
                    ? "text-red-600 dark:text-red-400" 
                    : "text-emerald-600 dark:text-emerald-400"
                )} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Membres à Risque</p>
                <p className={cn(
                  "text-2xl font-bold",
                  summaryStats.atRiskCount > 0 
                    ? "text-red-600 dark:text-red-400" 
                    : "text-emerald-600 dark:text-emerald-400"
                )}>
                  {summaryStats.atRiskCount}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Evolution Chart */}
        {selectedView === "index" && (
          <Card className="p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Évolution des Membres (6 derniers mois)
            </h3>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolutionData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" tick={{ fill: 'currentColor' }} />
                  <YAxis className="text-xs" tick={{ fill: 'currentColor' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="actifs" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    name="Membres actifs"
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="nouveaux" 
                    stroke="hsl(142, 76%, 36%)" 
                    strokeWidth={2}
                    name="Nouveaux"
                    dot={{ fill: 'hsl(142, 76%, 36%)' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* At-Risk Members Alert */}
        {selectedView === "index" && summaryStats.atRiskCount > 0 && (
          <Card className="p-4 bg-red-500/5 border-red-500/20">
            <h3 className="font-semibold text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Membres à Risque ({summaryStats.atRiskCount})
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              Ces membres n'ont pas d'entraînement enregistré depuis 2 semaines :
            </p>
            <div className="flex flex-wrap gap-2">
              {(showAllAtRisk ? summaryStats.atRiskMembers : summaryStats.atRiskMembers.slice(0, 10)).map(member => (
                <Button
                  key={member.id}
                  variant="outline"
                  size="sm"
                  className="border-red-500/30 hover:bg-red-500/10"
                  onClick={() => setSelectedMemberId(member.id)}
                >
                  {member.name}
                </Button>
              ))}
              {summaryStats.atRiskCount > 10 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-red-500 transition-colors"
                  onClick={() => setShowAllAtRisk(!showAllAtRisk)}
                >
                  {showAllAtRisk 
                    ? "Réduire" 
                    : `+${summaryStats.atRiskCount - 10} autres`
                  }
                </Button>
              )}
            </div>
          </Card>
        )}

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
                  <div className="h-8 w-px bg-border" />
                  
                  {/* Engagement View Mode Toggle */}
                  <div className="flex gap-1 items-center bg-muted/50 rounded-lg p-1">
                    <Button
                      variant={engagementViewMode === "week" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setEngagementViewMode("week")}
                      className="h-8 gap-1.5"
                    >
                      <CalendarIcon className="h-4 w-4" />
                      Semaine
                    </Button>
                    <Button
                      variant={engagementViewMode === "year" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setEngagementViewMode("year")}
                      className="h-8 gap-1.5"
                    >
                      <BarChart3 className="h-4 w-4" />
                      Moyenne
                    </Button>
                  </div>
                  
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
            <div className="space-y-6">
              {/* Engagement Legend */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                <span className="font-medium">Niveau d'engagement :</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-green-500" />
                  <span>Élevé (3+ séances/sem.)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-yellow-500" />
                  <span>Moyen (2 séances)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-orange-500" />
                  <span>Faible (1 séance)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-red-500" />
                  <span>À risque (0 séance)</span>
                </div>
              </div>

              {/* MEMBRES Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Membres
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    ({filteredMembers.filter(m => !isCoachMembership(m.membership)).length} membres)
                  </span>
                </div>
                
                {Object.entries(
                  filteredMembers
                    .filter(member => !isCoachMembership(member.membership))
                    .reduce((acc, member) => {
                      const category = member.membership || "Sans abonnement";
                      if (!acc[category]) acc[category] = [];
                      acc[category].push(member);
                      return acc;
                    }, {} as Record<string, Member[]>)
                ).map(([category, members], categoryIndex) => {
                  const totalCash = members.reduce((sum, m) => sum + (m.cash_collected || 0), 0);
                  const style = getMembershipStyle(category);
                  
                  return (
                    <MembershipCategoryCard
                      key={category}
                      category={category}
                      members={members}
                      totalCash={totalCash}
                      style={style}
                      onMemberClick={setSelectedMemberId}
                      onUpdateMember={updateMember}
                      onDeleteMember={handleDeleteClick}
                      membershipTypes={membershipTypes}
                      getMembershipStyle={getMembershipStyle}
                      getMemberEngagement={getMemberEngagement}
                    />
                  );
                })}
              </div>

              {/* COACHS Section */}
              {filteredMembers.some(m => isCoachMembership(m.membership)) && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 pt-4 border-t">
                    <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                      <Activity className="h-5 w-5 text-amber-500" />
                      Coachs
                    </h2>
                    <span className="text-sm text-muted-foreground">
                      ({filteredMembers.filter(m => isCoachMembership(m.membership)).length} coachs)
                    </span>
                  </div>
                  
                  {Object.entries(
                    filteredMembers
                      .filter(member => isCoachMembership(member.membership))
                      .reduce((acc, member) => {
                        const category = member.membership || "Sans abonnement";
                        if (!acc[category]) acc[category] = [];
                        acc[category].push(member);
                        return acc;
                      }, {} as Record<string, Member[]>)
                  ).map(([category, members], categoryIndex) => {
                    const totalCash = members.reduce((sum, m) => sum + (m.cash_collected || 0), 0);
                    // Custom style for coach categories
                    const coachStyle = { 
                      bg: "bg-amber-500/10", 
                      text: "text-amber-700 dark:text-amber-400", 
                      border: "border-amber-500/30" 
                    };
                    
                    return (
                      <MembershipCategoryCard
                        key={category}
                        category={category}
                        members={members}
                        totalCash={totalCash}
                        style={coachStyle}
                        onMemberClick={setSelectedMemberId}
                        onUpdateMember={updateMember}
                        onDeleteMember={handleDeleteClick}
                        membershipTypes={membershipTypes}
                        getMembershipStyle={() => coachStyle}
                        getMemberEngagement={getMemberEngagement}
                      />
                    );
                  })}
                </div>
              )}
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
                      const calendarWeekNum = parseInt(selectedView.replace("week-", ""));
                      const calendarYearNum = weekData.weekStart.getFullYear();
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
                          <TableCell>
                            <div className={cn(
                              "inline-flex px-3 py-1.5 rounded-md border font-medium text-sm",
                              getMembershipStyle(member.membership).bg,
                              getMembershipStyle(member.membership).text,
                              getMembershipStyle(member.membership).border
                            )}>
                              {member.membership}
                            </div>
                          </TableCell>
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
                                    updateWeeklyTraining(
                                      member.id, 
                                      memberWeek ?? 0, 
                                      parseInt(value),
                                      calendarWeekNum,
                                      calendarYearNum
                                    )
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
          onMemberUpdated={() => window.location.reload()}
        />
      </div>
    </div>
  );
};

export default CustomerJourney;
