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

      // Generate transactions - skip indefinite recurrences
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const transactionsToCreate = recurringCategories
        .filter((cat: any) => !cat.is_indefinite_recurrence) // Skip indefinite
        .map((cat: any) => {
          const day = Math.min(cat.recurrence_day, daysInMonth);
          const transactionDate = new Date(year, month, day);

          return {
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
          };
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
