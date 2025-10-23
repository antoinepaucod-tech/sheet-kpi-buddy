import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AnnualKPIData {
  year: number;
  totalRevenue: number;
  generalEFTRevenue: number;
  ptRevenue: number;
  retailRevenue: number;
  fastCashRevenue: number;
  totalActiveMembers: number;
  pifMembers: number;
  recurringGeneralMembers: number;
  ptMembers: number;
  totalExits: number;
  pifExits: number;
  generalExits: number;
  ptExits: number;
  pauses: number;
  totalClasses: number;
  leads: number;
  callsMade: number;
  scheduled: number;
  show: number;
  close: number;
  cashCollected: number;
  organicLeads: number;
  organicClose: number;
  organicCashCollected: number;
  inTrial: number;
  trialEnding: number;
  converted: number;
  adSpend: number;
  totalExpenses: number;
  profit: number;
  
  // Churn rates
  pifChurn: number;
  generalChurn: number;
  ptChurn: number;
  
  // Advanced metrics
  generalACRM: number;
  generalLTV: number;
  ptACRM: number;
  ptLTV: number;
  cpl: number;
  cpr: number;
  cac: number;
  roAds: number;
  gymFloorSQFT: number;
}

export const useAnnualKPIData = () => {
  const [annualData, setAnnualData] = useState<AnnualKPIData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadAnnualData = async () => {
    try {
      setIsLoading(true);
      const currentYear = new Date().getFullYear();

      const { data: monthlyData, error } = await supabase
        .from('monthly_kpis')
        .select('*')
        .eq('year', currentYear)
        .order('month', { ascending: true });

      if (error) throw error;

      if (!monthlyData || monthlyData.length === 0) {
        setAnnualData(null);
        return;
      }

      // Aggregate all monthly data into annual totals
      const annual: AnnualKPIData = {
        year: currentYear,
        totalRevenue: 0,
        generalEFTRevenue: 0,
        ptRevenue: 0,
        retailRevenue: 0,
        fastCashRevenue: 0,
        totalActiveMembers: 0,
        pifMembers: 0,
        recurringGeneralMembers: 0,
        ptMembers: 0,
        totalExits: 0,
        pifExits: 0,
        generalExits: 0,
        ptExits: 0,
        pauses: 0,
        totalClasses: 0,
        leads: 0,
        callsMade: 0,
        scheduled: 0,
        show: 0,
        close: 0,
        cashCollected: 0,
        organicLeads: 0,
        organicClose: 0,
        organicCashCollected: 0,
        inTrial: 0,
        trialEnding: 0,
        converted: 0,
        adSpend: 0,
        totalExpenses: 0,
        profit: 0,
        pifChurn: 0,
        generalChurn: 0,
        ptChurn: 0,
        generalACRM: 0,
        generalLTV: 0,
        ptACRM: 0,
        ptLTV: 0,
        cpl: 0,
        cpr: 0,
        cac: 0,
        roAds: 0,
        gymFloorSQFT: 0,
      };

      // Sum up all months
      monthlyData.forEach((month) => {
        annual.totalRevenue += Number(month.total_revenue || 0);
        annual.generalEFTRevenue += Number(month.general_eft_revenue || 0);
        annual.ptRevenue += Number(month.pt_revenue || 0);
        annual.retailRevenue += Number(month.retail_revenue || 0);
        annual.fastCashRevenue += Number(month.fast_cash_revenue || 0);
        annual.totalClasses += Number(month.total_classes || 0);
        annual.leads += Number(month.leads || 0);
        annual.callsMade += Number(month.calls_made || 0);
        annual.scheduled += Number(month.scheduled || 0);
        annual.show += Number(month.show || 0);
        annual.close += Number(month.close || 0);
        annual.cashCollected += Number(month.cash_collected || 0);
        annual.organicLeads += Number(month.organic_leads || 0);
        annual.organicClose += Number(month.organic_close || 0);
        annual.organicCashCollected += Number(month.organic_cash_collected || 0);
        annual.inTrial += Number(month.in_trial || 0);
        annual.trialEnding += Number(month.trial_ending || 0);
        annual.converted += Number(month.converted || 0);
        annual.adSpend += Number(month.ad_spend || 0);
        annual.totalExpenses += Number(month.total_expenses || 0);
        annual.profit += Number(month.profit || 0);
        annual.pifExits += Number(month.pif_exits || 0);
        annual.generalExits += Number(month.general_exits || 0);
        annual.ptExits += Number(month.pt_exits || 0);
        annual.pauses += Number(month.pauses || 0);
      });

      // For members, use the most recent month's values (not sum)
      const latestMonth = monthlyData[monthlyData.length - 1];
      const computedTotalActive =
        Number(latestMonth.total_active_members ?? 0) ||
        (Number(latestMonth.pif_members || 0) +
         Number(latestMonth.recurring_general_members || 0) +
         Number(latestMonth.pt_members || 0));
      annual.totalActiveMembers = computedTotalActive;
      annual.pifMembers = Number(latestMonth.pif_members || 0);
      annual.recurringGeneralMembers = Number(latestMonth.recurring_general_members || 0);
      annual.ptMembers = Number(latestMonth.pt_members || 0);

      annual.totalExits = annual.pifExits + annual.generalExits + annual.ptExits;

      // Calculate annual churn rates
      annual.pifChurn = annual.pifMembers > 0 ? (annual.pifExits / annual.pifMembers) * 100 : 0;
      annual.generalChurn = annual.recurringGeneralMembers > 0 ? (annual.generalExits / annual.recurringGeneralMembers) * 100 : 0;
      annual.ptChurn = annual.ptMembers > 0 ? (annual.ptExits / annual.ptMembers) * 100 : 0;

      // Calculate annual cost metrics
      annual.cpl = annual.leads > 0 ? annual.adSpend / annual.leads : 0;
      annual.cpr = annual.scheduled > 0 ? annual.adSpend / annual.scheduled : 0;
      annual.cac = annual.close > 0 ? annual.adSpend / annual.close : 0;
      annual.roAds = annual.adSpend > 0 ? (annual.cashCollected / annual.adSpend) * 100 : 0;

      // Use average of monthly LTV/ACRM values (from last month)
      annual.generalACRM = Number(latestMonth.general_acrm || 0);
      annual.generalLTV = Number(latestMonth.general_ltv || 0);
      annual.ptACRM = Number(latestMonth.pt_acrm || 0);
      annual.ptLTV = Number(latestMonth.pt_ltv || 0);
      annual.gymFloorSQFT = Number(latestMonth.gym_floor_sqft || 0);

      setAnnualData(annual);
    } catch (error) {
      console.error('Error loading annual data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnnualData();

    const channel = supabase
      .channel('monthly_kpis_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'monthly_kpis',
        },
        () => {
          loadAnnualData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    annualData,
    isLoading,
    refreshData: loadAnnualData,
  };
};
