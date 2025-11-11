import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface RecurringTransaction {
  id: string;
  transaction_type: "revenue" | "expense";
  category: string;
  client_name?: string;
  service_description?: string;
  amount: number;
  amount_received?: number;
  payment_method?: string;
  invoice_number_prefix?: string;
  notes?: string;
  recurrence_day: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useRecurringTransactions = () => {
  const queryClient = useQueryClient();

  const { data: recurringTransactions = [], isLoading } = useQuery({
    queryKey: ["recurring-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_transactions")
        .select("*")
        .order("transaction_type")
        .order("client_name");

      if (error) throw error;
      return data as RecurringTransaction[];
    },
  });

  const createRecurring = useMutation({
    mutationFn: async (transaction: Partial<RecurringTransaction>) => {
      const { error } = await supabase
        .from("recurring_transactions")
        .insert([transaction as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-transactions"] });
      toast.success("Transaction récurrente ajoutée");
    },
    onError: () => {
      toast.error("Erreur lors de l'ajout");
    },
  });

  const updateRecurring = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<RecurringTransaction> & { id: string }) => {
      const { error } = await supabase
        .from("recurring_transactions")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-transactions"] });
      toast.success("Transaction récurrente mise à jour");
    },
    onError: () => {
      toast.error("Erreur lors de la mise à jour");
    },
  });

  const deleteRecurring = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("recurring_transactions")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-transactions"] });
      toast.success("Transaction récurrente supprimée");
    },
    onError: () => {
      toast.error("Erreur lors de la suppression");
    },
  });

  const generateMonthlyTransactions = useMutation({
    mutationFn: async ({ year, month }: { year: number; month: number }) => {
      const MONTHS = [
        "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
        "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
      ];

      // Fetch active recurring transactions
      const { data: recurring, error: fetchError } = await supabase
        .from("recurring_transactions")
        .select("*")
        .eq("is_active", true);

      if (fetchError) throw fetchError;
      if (!recurring || recurring.length === 0) {
        throw new Error("Aucune transaction récurrente active");
      }

      // Check if transactions already exist for this month
      const { data: existing, error: checkError } = await supabase
        .from("accounting_transactions")
        .select("id")
        .eq("year", year)
        .eq("month", month + 1)
        .limit(1);

      if (checkError) throw checkError;

      // Generate transactions for the month
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const transactionsToCreate = recurring.map((rec) => {
        // Ensure recurrence_day doesn't exceed days in month
        const day = Math.min(rec.recurrence_day, daysInMonth);
        const transactionDate = new Date(year, month, day);

        return {
          transaction_date: transactionDate.toISOString().split('T')[0],
          transaction_type: rec.transaction_type,
          category: rec.category,
          client_name: rec.client_name,
          service_description: rec.service_description,
          amount: rec.amount,
          amount_received: rec.amount_received || 0,
          payment_method: rec.payment_method,
          invoice_number: rec.invoice_number_prefix,
          notes: rec.notes,
          year: year,
          month: month + 1,
          month_name: MONTHS[month],
        };
      });

      const { error: insertError } = await supabase
        .from("accounting_transactions")
        .insert(transactionsToCreate);

      if (insertError) throw insertError;

      return {
        count: transactionsToCreate.length,
        hasExisting: existing && existing.length > 0,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["accounting-transactions"] });
      if (data.hasExisting) {
        toast.success(`${data.count} transactions récurrentes ajoutées (des transactions existaient déjà)`);
      } else {
        toast.success(`${data.count} transactions récurrentes générées pour ce mois`);
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de la génération");
    },
  });

  return {
    recurringTransactions,
    isLoading,
    createRecurring,
    updateRecurring,
    deleteRecurring,
    generateMonthlyTransactions,
  };
};
