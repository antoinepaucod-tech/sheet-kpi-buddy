import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MONTHS } from '@/types/kpi';

export interface MonthlyKPIData {
  id?: string;
  year: number;
  month: number;
  month_name: string;
  
  // Revenue
  general_eft_revenue: number;
  pt_revenue: number;
  retail_revenue: number;
  fast_cash_revenue: number;
  total_revenue: number;
  
  // Members
  pif_members: number;
  recurring_general_members: number;
  pt_members: number;
  total_active_members: number;
  
  // Member changes
  pif_exits: number;
  general_exits: number;
  pt_exits: number;
  pauses: number;
  
  // Classes
  total_classes: number;
  
  // Sales funnel
  leads: number;
  calls_made: number;
  scheduled: number;
  show: number;
  close: number;
  cash_collected: number;
  
  // Organic
  organic_leads: number;
  organic_close: number;
  organic_cash_collected: number;
  
  // Trial
  in_trial: number;
  trial_ending: number;
  converted: number;
  
  // Expenses
  ad_spend: number;
  rent: number;
  repairs_maintenance: number;
  computer_software: number;
  internet_telephone: number;
  stationary: number;
  utilities: number;
  advertising_promotion: number;
  legal_professional: number;
  charitable_donations: number;
  subscriptions: number;
  bank_finance_charges: number;
  insurance: number;
  salaries?: number;
  food_expenses?: number;
  credit_repayment?: number;
  total_expenses: number;
  
  // Calculated
  profit: number;
  
  // Churn rates
  pif_churn?: number;
  general_churn?: number;
  pt_churn?: number;
  
  // Advanced metrics
  general_acrm?: number;
  general_ltv?: number;
  pt_acrm?: number;
  pt_ltv?: number;
  cpl?: number;
  cpr?: number;
  cac?: number;
  ro_ads?: number;
  gym_floor_sqft?: number;
}

export const useMonthlyKPIData = () => {
  const [monthlyData, setMonthlyData] = useState<MonthlyKPIData[]>([]);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(new Date().getMonth());
  const [isLoading, setIsLoading] = useState(true);

  // Load monthly data directly from monthly_kpis table
  const loadMonthlyData = async () => {
    setIsLoading(true);
    try {
      const currentYear = new Date().getFullYear();
      
      // Fetch all monthly KPIs for the year
      const { data: existingData, error } = await supabase
        .from('monthly_kpis')
        .select('*')
        .eq('year', currentYear)
        .order('month', { ascending: true });

      if (error) throw error;

      // Create a map of existing data
      const dataMap: { [key: number]: MonthlyKPIData } = {};
      existingData?.forEach(item => {
        dataMap[item.month] = item as MonthlyKPIData;
      });

      // Initialize all months with existing or empty data
      const monthlyDataArray: MonthlyKPIData[] = [];
      for (let m = 0; m < 12; m++) {
        if (dataMap[m]) {
          monthlyDataArray.push(dataMap[m]);
        } else {
          // Create empty entry for missing months
          const emptyMonth: MonthlyKPIData = {
            year: currentYear,
            month: m,
            month_name: MONTHS[m],
            general_eft_revenue: 0,
            pt_revenue: 0,
            retail_revenue: 0,
            fast_cash_revenue: 0,
            total_revenue: 0,
            pif_members: 0,
            recurring_general_members: 0,
            pt_members: 0,
            total_active_members: 0,
            pif_exits: 0,
            general_exits: 0,
            pt_exits: 0,
            pauses: 0,
            total_classes: 0,
            leads: 0,
            calls_made: 0,
            scheduled: 0,
            show: 0,
            close: 0,
            cash_collected: 0,
            organic_leads: 0,
            organic_close: 0,
            organic_cash_collected: 0,
            in_trial: 0,
            trial_ending: 0,
            converted: 0,
            ad_spend: 0,
            rent: 0,
            repairs_maintenance: 0,
            computer_software: 0,
            internet_telephone: 0,
            stationary: 0,
            utilities: 0,
            advertising_promotion: 0,
            legal_professional: 0,
            charitable_donations: 0,
            subscriptions: 0,
            bank_finance_charges: 0,
            insurance: 0,
            total_expenses: 0,
            profit: 0,
            pif_churn: 0,
            general_churn: 0,
            pt_churn: 0,
            general_acrm: 0,
            general_ltv: 0,
            pt_acrm: 0,
            pt_ltv: 0,
            cpl: 0,
            cpr: 0,
            cac: 0,
            ro_ads: 0,
            gym_floor_sqft: 0,
          };
          monthlyDataArray.push(emptyMonth);
        }
      }

      setMonthlyData(monthlyDataArray);
    } catch (error) {
      console.error('Error loading monthly data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMonthlyData();

    // Subscribe to monthly KPI changes
    const channel = supabase
      .channel('monthly_kpis_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'monthly_kpis'
        },
        () => {
          loadMonthlyData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getCurrentMonthData = () => monthlyData[currentMonthIndex];

  return {
    monthlyData,
    currentMonthIndex,
    setCurrentMonthIndex,
    getCurrentMonthData,
    isLoading,
    refreshData: loadMonthlyData,
  };
};
