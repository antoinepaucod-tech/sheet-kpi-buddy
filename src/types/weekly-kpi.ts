export interface WeeklyKPI {
  id?: string;
  year: number;
  week_number: number;
  week_start_date: string;
  week_end_date: string;
  
  // Revenue
  total_revenue: number;
  general_eft_revenue: number;
  pt_revenue: number;
  retail_revenue: number;
  fast_cash_revenue: number;
  
  // Members
  pif_members: number;
  pif_exits: number;
  pauses: number;
  recurring_general_members: number;
  general_exits: number;
  pt_members: number;
  pt_exits: number;
  
  // Classes
  total_classes: number;
  
  // Leads & Sales
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
  
  // Trials
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
  
  // Additional metrics
  gym_floor_sqft?: number;
  
  created_at?: string;
  updated_at?: string;
}

export const getWeekInfo = (date: Date) => {
  const year = date.getFullYear();
  const onejan = new Date(year, 0, 1);
  const weekNumber = Math.ceil(
    ((date.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7
  );
  
  // Get Monday of current week
  const currentDay = date.getDay();
  const diff = date.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  
  // Get Sunday of current week
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  
  return {
    year,
    weekNumber,
    weekStartDate: monday.toISOString().split('T')[0],
    weekEndDate: sunday.toISOString().split('T')[0],
  };
};

export const createEmptyWeeklyKPI = (year: number, weekNumber: number, startDate: string, endDate: string): WeeklyKPI => ({
  year,
  week_number: weekNumber,
  week_start_date: startDate,
  week_end_date: endDate,
  total_revenue: 0,
  general_eft_revenue: 0,
  pt_revenue: 0,
  retail_revenue: 0,
  fast_cash_revenue: 0,
  pif_members: 0,
  pif_exits: 0,
  pauses: 0,
  recurring_general_members: 0,
  general_exits: 0,
  pt_members: 0,
  pt_exits: 0,
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
  gym_floor_sqft: 0,
});
