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
  revenue_type: "membre" | "produit" | "service" | null;
  requires_training_tracking: boolean;
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
          requires_training_tracking: updates.requires_training_tracking,
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

      // Get all recurring categories OR member-type categories (which are implicitly recurring)
      const { data: recurringCategories, error: fetchError } = await (supabase as any)
        .from("accounting_categories")
        .select("*")
        .or("is_recurring.eq.true,revenue_type.eq.membre");

      if (fetchError) throw fetchError;

      // Get all members to check their status during transaction generation
      const { data: members, error: membersError } = await supabase
        .from("customer_members")
        .select("*");

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

      const existingClientMonthKeys = new Set(
        (existingTx || []).map((tx: any) =>
          `${tx.year}-${tx.month}|${tx.category}|${tx.client_name || ''}`
        )
      );

      // Fetch previous month transactions to carry over the recurring amount
      const prevDate = new Date(year, month, 1);
      prevDate.setMonth(prevDate.getMonth() - 1);
      const prevYear = prevDate.getFullYear();
      const prevMonth = prevDate.getMonth(); // 0-based

      // Fetch ALL expense transactions from previous month (validated or not)
      // For revenues: only fetch validated transactions (business rule)
      const { data: prevTxValidated, error: prevErrorValidated } = await (supabase as any)
        .from("accounting_transactions")
        .select("transaction_type, category, client_name, amount, created_at, year, month, service_description, product_description, payment_method, notes, is_validated")
        .eq("year", prevYear)
        .eq("month", prevMonth + 1)
        .eq("transaction_type", "revenue")
        .eq("is_validated", true);
      if (prevErrorValidated) throw prevErrorValidated;

      // For expenses: fetch ALL transactions from previous month (for auto-regeneration)
      const { data: prevTxExpenses, error: prevErrorExpenses } = await (supabase as any)
        .from("accounting_transactions")
        .select("transaction_type, category, client_name, amount, created_at, year, month, service_description, product_description, payment_method, notes, is_validated")
        .eq("year", prevYear)
        .eq("month", prevMonth + 1)
        .eq("transaction_type", "expense");
      if (prevErrorExpenses) throw prevErrorExpenses;

      // Combine all previous transactions
      const prevTx = [...(prevTxValidated || []), ...(prevTxExpenses || [])];

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

      // Process recurring revenue categories (original logic)
      (recurringCategories || []).forEach((cat: any) => {
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

            const clientMonthKey = `${year}-${month + 1}|${cat.name}|${member.name}`;
            const hasExistingThisMonthForClient = existingClientMonthKeys.has(clientMonthKey);

            // Règle anti-doublon : si une entrée existe déjà pour ce client/catégorie/mois
            if (hasExistingThisMonthForClient) {
              skipped++;
              return;
            }
            
            // Check if member has exited this month or before
            if (member.exit_date) {
              const exitDate = new Date(member.exit_date);
              const currentMonthStart = new Date(year, month, 1);
              
              if (exitDate < currentMonthStart) {
                return; // Skip - member has exited
              }
            }
            
            // Check if member's subscription has ended before this month
            if (member.subscription_end_date) {
              const subscriptionEndDate = new Date(member.subscription_end_date);
              const currentMonthStart = new Date(year, month, 1);
              
              const endYear = subscriptionEndDate.getFullYear();
              const endMonth = subscriptionEndDate.getMonth();
              const lastDayOfEndMonth = new Date(endYear, endMonth + 1, 0).getDate();
              const isLastDayOfMonth = subscriptionEndDate.getDate() === lastDayOfEndMonth;
              
              if (subscriptionEndDate < currentMonthStart) {
                return; // Skip - subscription has ended
              }
              
              if (isLastDayOfMonth && endMonth === month - 1 && endYear === year) {
                return;
              }
              if (isLastDayOfMonth && month === 0 && endMonth === 11 && endYear === year - 1) {
                return;
              }
            }
            
            // Determine if member should have a recurring transaction
            let shouldGenerate = false;
            let amount = 0;
            
            const isAnnualPaidInFull = [
              'OPEN GYM - PAIEMENT ANNUEL X1',
              'UNLIMITED ACCESS - PAIEMENT X1 - ANNUEL',
              'UNLIMITED ACCESS DUO - PAIEMENT ANNUEL X1',
              'OFFRE 6 MOIS - 499 CHF'
            ].includes(cat.name);

            if (member.contract_signed_date) {
              const contractDate = new Date(member.contract_signed_date);
              const currentMonthStart = new Date(year, month, 1);
              const currentMonthEnd = new Date(year, month + 1, 0);
              
              if (
                contractDate >= currentMonthStart &&
                contractDate <= currentMonthEnd &&
                carriedAmount === undefined &&
                !hasExistingThisMonthForClient
              ) {
                shouldGenerate = true;
                amount = Number(cat.default_amount) || 0;
              }
            }
            
            if (!shouldGenerate && carriedAmount !== undefined) {
              shouldGenerate = true;
              amount = isAnnualPaidInFull ? 0 : carriedAmount;
            }

            if (!shouldGenerate) {
              return;
            }

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
              amount_received: 0,
              year: year,
              month: month + 1,
              month_name: MONTHS[month],
              is_auto_generated: true,
              is_validated: false,
            });
          });
        } else {
          // No matching members - find ALL previous transactions for this category and carry them over
          const prevTransactionsForCategory = (prevTx || []).filter((tx: any) => 
            tx.transaction_type === cat.type && tx.category === cat.name
          );
          
          if (prevTransactionsForCategory.length === 0) {
            return;
          }

          prevTransactionsForCategory.forEach((prevTransaction: any) => {
            const clientName = prevTransaction.client_name || '';
            const amount = Number(prevTransaction.amount) || 0;
            
            if (cat.revenue_type === 'membre' && clientName) {
              const memberNow = members?.find((m: any) => m.name === clientName);
              if (memberNow && memberNow.membership !== cat.name) {
                return;
              }
              if (memberNow?.exit_date) {
                const exitDate = new Date(memberNow.exit_date);
                const currentMonthStart = new Date(year, month, 1);
                if (exitDate < currentMonthStart) {
                  return;
                }
              }
              if (memberNow?.subscription_end_date) {
                const subscriptionEndDate = new Date(memberNow.subscription_end_date);
                const currentMonthStart = new Date(year, month, 1);
                
                const endYear = subscriptionEndDate.getFullYear();
                const endMonth = subscriptionEndDate.getMonth();
                const lastDayOfEndMonth = new Date(endYear, endMonth + 1, 0).getDate();
                const isLastDayOfMonth = subscriptionEndDate.getDate() === lastDayOfEndMonth;
                
                if (subscriptionEndDate < currentMonthStart) {
                  return;
                }
                
                if (isLastDayOfMonth && endMonth === month - 1 && endYear === year) {
                  return;
                }
                if (isLastDayOfMonth && month === 0 && endMonth === 11 && endYear === year - 1) {
                  return;
                }
              }
            }
            
            const clientMonthKey = `${year}-${month + 1}|${cat.name}|${clientName}`;
            if (existingClientMonthKeys.has(clientMonthKey)) {
              skipped++;
              return;
            }

            const dupKey = `${dateStr}|${cat.type}|${cat.name}|${clientName}|${amount}`;
            if (existingKeys.has(dupKey)) {
              skipped++;
              return;
            }

            transactionsToCreate.push({
              transaction_date: dateStr,
              transaction_type: cat.type,
              category: cat.name,
              client_name: clientName || null,
              service_description: prevTransaction.service_description || cat.name,
              product_description: prevTransaction.product_description || cat.name,
              amount,
              amount_received: 0,
              year: year,
              month: month + 1,
              month_name: MONTHS[month],
              is_auto_generated: true,
              is_validated: false,
              payment_method: prevTransaction.payment_method || null,
              notes: prevTransaction.notes || null,
            });
          });
        }
      });

      // NEW: Auto-regenerate ALL expenses from previous month
      // This ensures expenses are automatically carried over regardless of category configuration
      const expensesFromPrevMonth = prevTxExpenses || [];
      const processedExpenseKeys = new Set<string>();

      // Create a more flexible key lookup for existing transactions (using service_description as a unique identifier)
      const existingExpenseServiceKeys = new Set(
        (existingTx || [])
          .filter((tx: any) => tx.transaction_type === 'expense')
          .map((tx: any) => `${tx.category}|${tx.service_description || ''}`)
      );

      // Fetch ALL excluded recurring expenses (not just this month)
      // Once a user deletes an expense, it should never come back in future months
      const { data: excludedExpenses } = await (supabase as any)
        .from("excluded_recurring_expenses")
        .select("category, service_description");
      
      const excludedExpenseKeys = new Set(
        (excludedExpenses || []).map((ex: any) => `${ex.category}|${ex.service_description || ''}`)
      );

      expensesFromPrevMonth.forEach((prevExpense: any) => {
        const clientName = prevExpense.client_name || '';
        const amount = Number(prevExpense.amount) || 0;
        const category = prevExpense.category;
        const serviceDesc = prevExpense.service_description || '';

        // Create unique key using category + service_description (more reliable for expenses)
        const expenseKey = `${category}|${serviceDesc}`;
        
        // Skip if this expense was explicitly excluded (deleted by user)
        if (excludedExpenseKeys.has(expenseKey)) {
          skipped++;
          return;
        }
        
        if (processedExpenseKeys.has(expenseKey)) {
          return;
        }
        processedExpenseKeys.add(expenseKey);

        // Check if already exists this month using service_description as unique identifier
        if (existingExpenseServiceKeys.has(expenseKey)) {
          skipped++;
          return;
        }

        const day = 1; // Use first day of month for expenses
        const transactionDate = new Date(year, month, day);
        const dateStr = transactionDate.toISOString().split('T')[0];

        // Check if we already added this expense in the recurring categories loop
        const alreadyAdded = transactionsToCreate.some(
          (tx: any) => 
            tx.transaction_type === 'expense' && 
            tx.category === category && 
            (tx.service_description || '') === serviceDesc
        );

        if (alreadyAdded) {
          return;
        }

        transactionsToCreate.push({
          transaction_date: dateStr,
          transaction_type: 'expense',
          category: category,
          client_name: clientName || null,
          service_description: serviceDesc || category,
          product_description: prevExpense.product_description || category,
          amount,
          amount_received: 0, // Cash resets to 0 each recurrence
          year: year,
          month: month + 1,
          month_name: MONTHS[month],
          is_auto_generated: true,
          is_validated: false,
          payment_method: prevExpense.payment_method || null,
          notes: prevExpense.notes || null,
        });
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
