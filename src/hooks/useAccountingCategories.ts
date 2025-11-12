import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AccountingCategory {
  id: string;
  name: string;
  type: "revenue" | "expense";
  position: number;
}

export const useAccountingCategories = () => {
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["accounting-categories"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("accounting_categories")
        .select("*")
        .order("position", { ascending: true });

      if (error) throw error;
      return data as AccountingCategory[];
    },
  });

  const revenueCategories = categories.filter((c) => c.type === "revenue");
  const expenseCategories = categories.filter((c) => c.type === "expense");

  return {
    categories,
    revenueCategories,
    expenseCategories,
    isLoading,
  };
};
