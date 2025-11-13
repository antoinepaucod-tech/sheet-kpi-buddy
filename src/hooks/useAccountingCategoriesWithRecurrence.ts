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

      // Fetch existing transactions for the target month to avoid duplicates
      const { data: existingTx, error: existingError } = await (supabase as any)
        .from("accounting_transactions")
        .select("transaction_date, transaction_type, category, client_name, amount, year, month")
        .eq("year", year)
        .eq("month", month + 1);
      if (existingError) throw existingError;

      const existingKeys = new Set(
        (existingTx || []).map((tx: any) =>
          `${tx.transaction_date}|${tx.transaction_type}|${tx.category}|${tx.client_name || ''}|${Number(tx.amount)}`
        )
      );

      // Fetch previous month transactions to carry over the recurring amount
      const prevDate = new Date(year, month, 1);
      prevDate.setMonth(prevDate.getMonth() - 1);
      const prevYear = prevDate.getFullYear();
      const prevMonth = prevDate.getMonth(); // 0-based

      const { data: prevTx, error: prevError } = await (supabase as any)
        .from("accounting_transactions")
        .select("transaction_type, category, client_name, amount, created_at, year, month")
        .eq("year", prevYear)
        .eq("month", prevMonth + 1);
      if (prevError) throw prevError;

      // Map of last month's amount per (type|category|client)
      const prevAmountMap = new Map<string, { amount: number; created_at: string }>();
      (prevTx || []).forEach((tx: any) => {
        const key = `${tx.transaction_type}|${tx.category}|${tx.client_name || ''}`;
        const current = prevAmountMap.get(key);
        if (!current || (tx.created_at && tx.created_at > current.created_at)) {
          prevAmountMap.set(key, { amount: Number(tx.amount) || 0, created_at: tx.created_at });
        }
      });

      // Generate transactions - include indefinite, exclude expired finite recurrences
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const transactionsToCreate: any[] = [];
      let skipped = 0;

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
        const matchingMembers = members?.filter((member: any) => member.membership === cat.name) || [];

        const day = Math.min(cat.recurrence_day || 1, daysInMonth);
        const transactionDate = new Date(year, month, day);
        const dateStr = transactionDate.toISOString().split('T')[0];

        if (matchingMembers.length > 0) {
          // Create a transaction for each matching member
          matchingMembers.forEach((member: any) => {
            const prevKey = `${cat.type}|${cat.name}|${member.name}`;
            const carriedAmount = prevAmountMap.get(prevKey)?.amount;
            const amount = carriedAmount !== undefined ? carriedAmount : Number(cat.default_amount) || 0;

            const dupKey = `${dateStr}|${cat.type}|${cat.name}|${member.name}|${amount}`;
            if (existingKeys.has(dupKey)) {
              skipped++;
              return;
            }

            transactionsToCreate.push({
              transaction_date: dateStr,
              transaction_type: cat.type,
              category: cat.name,
              client_name: member.name,
              service_description: cat.name,
              product_description: (member.member_type || "").includes("PT")
                ? "Revenu PT"
                : (member.member_type || "").includes("PIF")
                ? "Membre PIF"
                : "Revenu EFT Général",
              amount,
              amount_received: 0, // cash resets to 0 each recurrence
              year: year,
              month: month + 1,
              month_name: MONTHS[month],
              is_auto_generated: true,
              is_validated: false,
            });
          });
        } else {
          // No matching members, create a generic transaction
          const prevKey = `${cat.type}|${cat.name}|`;
          const carriedAmount = prevAmountMap.get(prevKey)?.amount;
          const amount = carriedAmount !== undefined ? carriedAmount : Number(cat.default_amount) || 0;

          const dupKey = `${dateStr}|${cat.type}|${cat.name}||${amount}`;
          if (existingKeys.has(dupKey)) {
            skipped++;
            return;
          }

          transactionsToCreate.push({
            transaction_date: dateStr,
            transaction_type: cat.type,
            category: cat.name,
            amount,
            amount_received: 0, // cash resets to 0 each recurrence
            year: year,
            month: month + 1,
            month_name: MONTHS[month],
            is_auto_generated: true,
            is_validated: false,
          });
        }
      });

      if (transactionsToCreate.length === 0) {
        return { inserted: 0, skipped };
      }

      const { error: insertError } = await (supabase as any)
        .from("accounting_transactions")
        .insert(transactionsToCreate);

      if (insertError) throw insertError;

      return { inserted: transactionsToCreate.length, skipped };
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["accounting-transactions"] });
      const msg = data.inserted > 0
        ? `${data.inserted} transactions récurrentes générées (${data.skipped} déjà existantes ignorées)`
        : `Aucune nouvelle transaction à générer (${data.skipped} déjà existantes ignorées)`;
      toast.success(msg);
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
