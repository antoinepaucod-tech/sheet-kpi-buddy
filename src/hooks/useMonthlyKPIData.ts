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
  total_expenses: number;
  
  // Calculated
  profit: number;
}

export const useMonthlyKPIData = () => {
  const [monthlyData, setMonthlyData] = useState<MonthlyKPIData[]>([]);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(new Date().getMonth());
  const [isLoading, setIsLoading] = useState(true);

  // Load and aggregate monthly data from weekly KPIs
  const loadMonthlyData = async () => {
    setIsLoading(true);
    try {
      const currentYear = new Date().getFullYear();
      
      // Fetch all weekly KPIs for the year
      const { data: weeklyData, error } = await supabase
        .from('weekly_kpis')
        .select('*')
        .eq('year', currentYear)
        .order('week_number', { ascending: true });

      if (error) throw error;

      // Aggregate weekly data by month
      const monthlyAggregates: { [key: number]: MonthlyKPIData } = {};
      
      // Initialize all months
      for (let m = 0; m < 12; m++) {
        monthlyAggregates[m] = {
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
        };
      }

      // Aggregate weekly data
      weeklyData?.forEach((week) => {
        const weekDate = new Date(week.week_start_date);
        const monthIndex = weekDate.getMonth();
        const monthly = monthlyAggregates[monthIndex];

        // Add revenues
        monthly.general_eft_revenue += Number(week.general_eft_revenue) || 0;
        monthly.pt_revenue += Number(week.pt_revenue) || 0;
        monthly.retail_revenue += Number(week.retail_revenue) || 0;
        monthly.fast_cash_revenue += Number(week.fast_cash_revenue) || 0;

        // Add member changes (entries add, exits subtract)
        monthly.pif_members += (Number(week.pif_members) || 0) - (Number(week.pif_exits) || 0);
        monthly.recurring_general_members += (Number(week.recurring_general_members) || 0) - (Number(week.general_exits) || 0);
        monthly.pt_members += (Number(week.pt_members) || 0) - (Number(week.pt_exits) || 0);
        
        // Track exits and pauses
        monthly.pif_exits += Number(week.pif_exits) || 0;
        monthly.general_exits += Number(week.general_exits) || 0;
        monthly.pt_exits += Number(week.pt_exits) || 0;
        monthly.pauses += Number(week.pauses) || 0;

        // Add classes
        monthly.total_classes += Number(week.total_classes) || 0;

        // Add sales funnel
        monthly.leads += Number(week.leads) || 0;
        monthly.calls_made += Number(week.calls_made) || 0;
        monthly.scheduled += Number(week.scheduled) || 0;
        monthly.show += Number(week.show) || 0;
        monthly.close += Number(week.close) || 0;
        monthly.cash_collected += Number(week.cash_collected) || 0;

        // Add organic
        monthly.organic_leads += Number(week.organic_leads) || 0;
        monthly.organic_close += Number(week.organic_close) || 0;
        monthly.organic_cash_collected += Number(week.organic_cash_collected) || 0;

        // Add trial
        monthly.in_trial += Number(week.in_trial) || 0;
        monthly.trial_ending += Number(week.trial_ending) || 0;
        monthly.converted += Number(week.converted) || 0;

        // Add expenses
        monthly.ad_spend += Number(week.ad_spend) || 0;
        monthly.rent += Number(week.rent) || 0;
        monthly.repairs_maintenance += Number(week.repairs_maintenance) || 0;
        monthly.computer_software += Number(week.computer_software) || 0;
        monthly.internet_telephone += Number(week.internet_telephone) || 0;
        monthly.stationary += Number(week.stationary) || 0;
        monthly.utilities += Number(week.utilities) || 0;
        monthly.advertising_promotion += Number(week.advertising_promotion) || 0;
        monthly.legal_professional += Number(week.legal_professional) || 0;
        monthly.charitable_donations += Number(week.charitable_donations) || 0;
        monthly.subscriptions += Number(week.subscriptions) || 0;
        monthly.bank_finance_charges += Number(week.bank_finance_charges) || 0;
        monthly.insurance += Number(week.insurance) || 0;
      });

      // Calculate totals and save to database
      const monthlyDataArray = Object.values(monthlyAggregates);
      
      for (const monthly of monthlyDataArray) {
        monthly.total_revenue = monthly.general_eft_revenue + monthly.pt_revenue + 
                                monthly.retail_revenue + monthly.fast_cash_revenue;
        monthly.total_active_members = Math.max(0, monthly.pif_members + monthly.recurring_general_members + monthly.pt_members);
        monthly.total_expenses = monthly.ad_spend + monthly.rent + monthly.repairs_maintenance +
                                monthly.computer_software + monthly.internet_telephone + monthly.stationary +
                                monthly.utilities + monthly.advertising_promotion + monthly.legal_professional +
                                monthly.charitable_donations + monthly.subscriptions + monthly.bank_finance_charges +
                                monthly.insurance;
        monthly.profit = monthly.total_revenue - monthly.total_expenses;

        // Upsert to database
        const { error: upsertError } = await supabase
          .from('monthly_kpis')
          .upsert({
            year: monthly.year,
            month: monthly.month,
            month_name: monthly.month_name,
            ...monthly
          }, {
            onConflict: 'year,month'
          });

        if (upsertError) console.error('Error upserting monthly data:', upsertError);
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

    // Subscribe to weekly KPI changes
    const channel = supabase
      .channel('weekly_kpis_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'weekly_kpis'
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
