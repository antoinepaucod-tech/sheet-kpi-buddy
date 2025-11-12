import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ValidationResult {
  isValid: boolean;
  customerJourneyTotal: number;
  kpiRevenueTotal: number;
  difference: number;
}

export const useCashCollectedValidation = (year: number, month: number) => {
  const [validation, setValidation] = useState<ValidationResult>({
    isValid: true,
    customerJourneyTotal: 0,
    kpiRevenueTotal: 0,
    difference: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const validateCashCollected = async () => {
      setIsLoading(true);
      try {
        // Get total cash collected from customer_members for this month/year
        const { data: members, error: membersError } = await supabase
          .from('customer_members')
          .select('cash_collected, contract_signed_date')
          .not('contract_signed_date', 'is', null);

        if (membersError) throw membersError;

        // Filter members by contract signed date matching the selected month/year
        const customerJourneyTotal = members
          .filter((m) => {
            if (!m.contract_signed_date) return false;
            const signDate = new Date(m.contract_signed_date);
            return (
              signDate.getFullYear() === year &&
              signDate.getMonth() === month
            );
          })
          .reduce((sum, m) => sum + (m.cash_collected || 0), 0);

        // Get cash_collected from monthly_kpis for this month/year
        const { data: kpiData, error: kpiError } = await supabase
          .from('monthly_kpis')
          .select('cash_collected')
          .eq('year', year)
          .eq('month', month + 1)
          .single();

        if (kpiError && kpiError.code !== 'PGRST116') throw kpiError;

        const kpiRevenueTotal = kpiData?.cash_collected || 0;
        const difference = Math.abs(customerJourneyTotal - kpiRevenueTotal);
        const isValid = difference < 0.01; // Allow for minor floating point differences

        setValidation({
          isValid,
          customerJourneyTotal,
          kpiRevenueTotal,
          difference,
        });

        // Show warning if validation fails
        if (!isValid && (customerJourneyTotal > 0 || kpiRevenueTotal > 0)) {
          toast.warning(
            `Incohérence détectée: Cash collecté Parcours Client (CHF ${customerJourneyTotal.toFixed(2)}) ≠ KPI Revenu (CHF ${kpiRevenueTotal.toFixed(2)})`,
            { duration: 10000 }
          );
        }
      } catch (error) {
        console.error('Error validating cash collected:', error);
      } finally {
        setIsLoading(false);
      }
    };

    validateCashCollected();
  }, [year, month]);

  return { validation, isLoading };
};
