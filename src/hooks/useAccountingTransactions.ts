import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AccountingTransaction {
  id: string;
  transaction_date: string;
  transaction_type: "revenue" | "expense";
  category: string;
  client_name?: string;
  service_description?: string;
  product_description?: string;
  amount: number;
  amount_received?: number;
  payment_method?: string;
  invoice_number?: string;
  notes?: string;
  year: number;
  month: number;
  month_name: string;
  created_at: string;
  updated_at: string;
  is_validated?: boolean;
  is_auto_generated?: boolean;
}

export const useAccountingTransactions = (year: number, month: number) => {
  const queryClient = useQueryClient();

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["accounting-transactions", year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting_transactions")
        .select("*")
        .eq("year", year)
        .eq("month", month + 1)
        .order("transaction_date", { ascending: false });

      if (error) throw error;
      return data as AccountingTransaction[];
    },
  });

  const createTransaction = useMutation({
    mutationFn: async (transaction: Partial<AccountingTransaction>) => {
      const { error } = await supabase
        .from("accounting_transactions")
        .insert([transaction as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-kpis"] });
      toast.success("Transaction ajoutée");
    },
    onError: () => {
      toast.error("Erreur lors de l'ajout");
    },
  });

  const updateTransaction = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AccountingTransaction> & { id: string }) => {
      const { error } = await supabase
        .from("accounting_transactions")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-kpis"] });
      toast.success("Transaction mise à jour");
    },
    onError: () => {
      toast.error("Erreur lors de la mise à jour");
    },
  });

  const deleteTransaction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("accounting_transactions")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-kpis"] });
      toast.success("Transaction supprimée");
    },
    onError: () => {
      toast.error("Erreur lors de la suppression");
    },
  });

  return {
    transactions,
    isLoading,
    createTransaction,
    updateTransaction,
    deleteTransaction,
  };
};
