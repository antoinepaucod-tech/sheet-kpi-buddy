export interface MonthlyKPI {
  month: string;
  
  // Revenue
  totalRevenue: number;
  generalEFTRevenue: number;
  ptRevenue: number;
  retailRevenue: number;
  fastCashRevenue: number;
  
  // Members
  pifMembers: number;
  pifExits: number;
  pifChurn: number;
  pauses: number;
  recurringGeneralMembers: number;
  generalExits: number;
  generalChurn: number;
  ptMembers: number;
  ptExits: number;
  ptChurn: number;
  
  // Classes
  totalClasses: number;
  
  // Leads & Sales
  leads: number;
  callsMade: number;
  callPercentage: number;
  scheduled: number;
  schedPercentage: number;
  show: number;
  showPercentage: number;
  close: number;
  closePercentage: number;
  cashCollected: number;
  avgPerSale: number;
  
  // Organic
  organicLeads: number;
  organicClose: number;
  organicClosePercentage: number;
  organicCashCollected: number;
  
  // Trials
  inTrial: number;
  trialEnding: number;
  converted: number;
  conversionPercentage: number;
  
  // Expenses
  adSpend: number;
  rent: number;
  repairsAndMaintenance: number;
  computerSoftware: number;
  internetTelephone: number;
  subscriptions: number;
  bankFinanceCharges: number;
  insurance: number;
  salaries: number;
  totalExpenses: number;
  
  // Profit
  profit: number;
  profitPercentage: number;
  
  // Metrics
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

export const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export const createEmptyKPI = (month: string): MonthlyKPI => ({
  month,
  totalRevenue: 0,
  generalEFTRevenue: 0,
  ptRevenue: 0,
  retailRevenue: 0,
  fastCashRevenue: 0,
  pifMembers: 0,
  pifExits: 0,
  pifChurn: 0,
  pauses: 0,
  recurringGeneralMembers: 0,
  generalExits: 0,
  generalChurn: 0,
  ptMembers: 0,
  ptExits: 0,
  ptChurn: 0,
  totalClasses: 0,
  leads: 0,
  callsMade: 0,
  callPercentage: 0,
  scheduled: 0,
  schedPercentage: 0,
  show: 0,
  showPercentage: 0,
  close: 0,
  closePercentage: 0,
  cashCollected: 0,
  avgPerSale: 0,
  organicLeads: 0,
  organicClose: 0,
  organicClosePercentage: 0,
  organicCashCollected: 0,
  inTrial: 0,
  trialEnding: 0,
  converted: 0,
  conversionPercentage: 0,
  adSpend: 0,
  rent: 0,
  repairsAndMaintenance: 0,
  computerSoftware: 0,
  internetTelephone: 0,
  subscriptions: 0,
  bankFinanceCharges: 0,
  insurance: 0,
  salaries: 0,
  totalExpenses: 0,
  profit: 0,
  profitPercentage: 0,
  generalACRM: 0,
  generalLTV: 0,
  ptACRM: 0,
  ptLTV: 0,
  cpl: 0,
  cpr: 0,
  cac: 0,
  roAds: 0,
  gymFloorSQFT: 0,
});
