import { useState, useEffect } from 'react';
import { MonthlyKPI, createEmptyKPI, MONTHS } from '@/types/kpi';

const STORAGE_KEY = 'gym-kpi-data';

export const useKPIData = () => {
  const [kpiData, setKPIData] = useState<MonthlyKPI[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return MONTHS.map(month => createEmptyKPI(month));
  });

  const [currentMonthIndex, setCurrentMonthIndex] = useState(new Date().getMonth());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(kpiData));
  }, [kpiData]);

  const updateKPI = (monthIndex: number, updates: Partial<MonthlyKPI>) => {
    setKPIData(prev => {
      const newData = [...prev];
      newData[monthIndex] = {
        ...newData[monthIndex],
        ...updates,
      };
      
      // Auto-calculate percentages and totals
      const data = newData[monthIndex];
      
      // Calculate revenue total
      data.totalRevenue = data.generalEFTRevenue + data.ptRevenue + data.retailRevenue + data.fastCashRevenue;
      
      // Calculate percentages
      if (data.leads > 0) {
        data.callPercentage = Math.round((data.callsMade / data.leads) * 100);
        data.schedPercentage = Math.round((data.scheduled / data.leads) * 100);
      }
      
      if (data.scheduled > 0) {
        data.showPercentage = Math.round((data.show / data.scheduled) * 100);
      }
      
      if (data.show > 0) {
        data.closePercentage = Math.round((data.close / data.show) * 100);
      }
      
      if (data.close > 0) {
        data.avgPerSale = Math.round(data.cashCollected / data.close);
      }
      
      if (data.organicLeads > 0) {
        data.organicClosePercentage = Math.round((data.organicClose / data.organicLeads) * 100);
      }
      
      if (data.trialEnding > 0) {
        data.conversionPercentage = Math.round((data.converted / data.trialEnding) * 100);
      }
      
      // Calculate total expenses
      data.totalExpenses = data.adSpend + data.rent + data.repairsAndMaintenance + 
        data.computerSoftware + data.internetTelephone + data.stationary + 
        data.utilities + data.advertisingPromotion + data.legalProfessionalFees + 
        data.charitableDonations + data.subscriptions + data.bankFinanceCharges + 
        data.insurance;
      
      // Calculate profit
      data.profit = data.totalRevenue - data.totalExpenses;
      
      if (data.totalRevenue > 0) {
        data.profitPercentage = Math.round((data.profit / data.totalRevenue) * 100);
      }
      
      // Calculate metrics
      if (data.leads > 0) {
        data.cpl = Math.round(data.adSpend / data.leads);
      }
      
      if (data.totalRevenue > 0 && data.adSpend > 0) {
        data.roAds = Math.round((data.totalRevenue / data.adSpend) * 100) / 100;
      }
      
      return newData;
    });
  };

  const getCurrentMonthData = () => kpiData[currentMonthIndex];

  return {
    kpiData,
    currentMonthIndex,
    setCurrentMonthIndex,
    updateKPI,
    getCurrentMonthData,
  };
};
