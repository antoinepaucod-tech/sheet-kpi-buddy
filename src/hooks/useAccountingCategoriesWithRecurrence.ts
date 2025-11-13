import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AccountingCategoryWithRecurrence {
  id: string;
  name: string;
  type: "revenue" | "expense";
  position: number;
  is_recurring: boolean;
  recurrence_day: number;
  default_amount: number;
  is_indefinite_recurrence: boolean;
  recurrence_end_date: string | null;
}

export const useAccountingCategoriesWithRecurrence = () => {
  const queryClient = useQueryClient();

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["accounting-categories-with-recurrence"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("accounting_categories")
        .select("*")
        .order("position", { ascending: true });

      if (error) throw error;
      return data as AccountingCategoryWithRecurrence[];
    },
  });

  const updateCategory = useMutation({
    mutationFn: async (updates: Partial<AccountingCategoryWithRecurrence> & { id: string }) => {
      const { error } = await (supabase as any)
        .from("accounting_categories")
        .update({
          name: updates.name,
          is_recurring: updates.is_recurring,
          recurrence_day: updates.recurrence_day,
          default_amount: updates.default_amount,
          position: updates.position,
          is_indefinite_recurrence: updates.is_indefinite_recurrence,
          recurrence_end_date: updates.recurrence_end_date,
        })
        .eq("id", updates.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting-categories-with-recurrence"] });
      queryClient.invalidateQueries({ queryKey: ["accounting-categories"] });
      toast.success("Catégorie mise à jour");
    },
    onError: () => {
      toast.error("Erreur lors de la mise à jour");
    },
  });

  const generateRecurringTransactions = useMutation({
    mutationFn: async ({ year, month }: { year: number; month: number }) => {
      const MONTHS = [
        "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
        "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
      ];

      // Get all recurring categories
      const { data: recurringCategories, error: fetchError } = await (supabase as any)
        .from("accounting_categories")
        .select("*")
        .eq("is_recurring", true);

      if (fetchError) throw fetchError;
      if (!recurringCategories || recurringCategories.length === 0) {
        throw new Error("Aucune catégorie récurrente configurée");
      }

      // Get active members (no exit_date or exit_date in the future)
      const { data: members, error: membersError } = await supabase
        .from("customer_members")
        .select("*")
        .or(`exit_date.is.null,exit_date.gt.${new Date().toISOString()}`);

      if (membersError) throw membersError;

      // Generate transactions - include indefinite, exclude expired finite recurrences
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const transactionsToCreate: any[] = [];

      recurringCategories.forEach((cat: any) => {
        // Check if category should be included
        let includeCategory = false;
        
        // Always include indefinite recurrences
        if (cat.is_indefinite_recurrence) {
          includeCategory = true;
        } 
        // For finite recurrences, check if we're before the end date
        else if (cat.recurrence_end_date) {
          const day = Math.min(cat.recurrence_day || 1, daysInMonth);
          const transactionDate = new Date(year, month, day);
          const endDate = new Date(cat.recurrence_end_date);
          includeCategory = transactionDate <= endDate;
        } else {
          includeCategory = true;
        }

        if (!includeCategory) return;

        // Find members with matching membership
        const matchingMembers = members?.filter((member: any) => 
          member.membership === cat.name
        ) || [];

        const day = Math.min(cat.recurrence_day || 1, daysInMonth);
        const transactionDate = new Date(year, month, day);

        if (matchingMembers.length > 0) {
          // Create a transaction for each matching member
          matchingMembers.forEach((member: any) => {
            transactionsToCreate.push({
              transaction_date: transactionDate.toISOString().split('T')[0],
              transaction_type: cat.type,
              category: cat.name,
              client_name: member.name,
              service_description: cat.name,
              product_description: (member.member_type || "").includes("PT") 
                ? "Revenu PT" 
                : (member.member_type || "").includes("PIF")
                ? "Membre PIF"
                : "Revenu EFT Général",
              amount: cat.default_amount || 0,
              amount_received: 0,
              year: year,
              month: month + 1,
              month_name: MONTHS[month],
              is_auto_generated: true,
              is_validated: false,
            });
          });
        } else {
          // No matching members, create a generic transaction
          transactionsToCreate.push({
            transaction_date: transactionDate.toISOString().split('T')[0],
            transaction_type: cat.type,
            category: cat.name,
            amount: cat.default_amount || 0,
            amount_received: 0,
            year: year,
            month: month + 1,
            month_name: MONTHS[month],
            is_auto_generated: true,
            is_validated: false,
          });
        }
      });

      const { error: insertError } = await (supabase as any)
        .from("accounting_transactions")
        .insert(transactionsToCreate);

      if (insertError) throw insertError;

      return { count: transactionsToCreate.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["accounting-transactions"] });
      toast.success(`${data.count} transactions récurrentes générées`);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de la génération");
    },
  });

  const revenueCategories = categories.filter((c) => c.type === "revenue");
  const expenseCategories = categories.filter((c) => c.type === "expense");

  return {
    categories,
    revenueCategories,
    expenseCategories,
    isLoading,
    updateCategory,
    generateRecurringTransactions,
  };
};
