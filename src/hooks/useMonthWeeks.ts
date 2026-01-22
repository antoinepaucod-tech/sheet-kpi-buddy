import { useMemo } from 'react';
import { startOfWeek, getWeek, getMonth, getYear, format } from 'date-fns';
import { fr } from 'date-fns/locale';

export interface WeekInfo {
  weekNumber: number; // 1-5 (relative week in display)
  isoWeek: number; // ISO week number
  mondayDate: Date;
  label: string; // e.g., "27/01"
  fieldKey: `week${1 | 2 | 3 | 4 | 5}_attendance`;
  instructorKey: `week${1 | 2 | 3 | 4 | 5}_instructor`;
}

/**
 * Hook to calculate which weeks belong to a given month.
 * RULE: A week belongs to the month where its Monday falls.
 * This ensures each week is counted in exactly one month, avoiding overlaps.
 * 
 * Returns 4 or 5 weeks depending on the month structure.
 */
export const useMonthWeeks = (year: number, month: number) => {
  const weeks = useMemo((): WeekInfo[] => {
    const result: WeekInfo[] = [];
    
    // Iterate through all possible ISO weeks (1-53)
    for (let isoWeek = 1; isoWeek <= 53; isoWeek++) {
      // Find the Monday of this ISO week
      // Start from Jan 4 which is always in week 1 by ISO definition
      const jan4 = new Date(year, 0, 4);
      const jan4IsoWeek = getWeek(jan4, { weekStartsOn: 1 });
      
      // Calculate the Monday of the target week
      const daysToAdd = (isoWeek - jan4IsoWeek) * 7;
      const someDay = new Date(jan4.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
      const monday = startOfWeek(someDay, { weekStartsOn: 1 });
      
      // Check if the Monday falls in the target month AND year
      const mondayMonth = getMonth(monday) + 1; // getMonth is 0-indexed
      const mondayYear = getYear(monday);
      
      if (mondayMonth === month && mondayYear === year) {
        result.push({
          weekNumber: result.length + 1 as 1 | 2 | 3 | 4 | 5,
          isoWeek,
          mondayDate: monday,
          label: format(monday, 'dd/MM', { locale: fr }),
          fieldKey: `week${result.length + 1}_attendance` as WeekInfo['fieldKey'],
          instructorKey: `week${result.length + 1}_instructor` as WeekInfo['instructorKey'],
        });
      }
    }
    
    // Sort by ISO week number and limit to 5 weeks max
    return result.sort((a, b) => a.isoWeek - b.isoWeek).slice(0, 5);
  }, [year, month]);

  const weekCount = weeks.length;

  return {
    weeks,
    weekCount,
    hasWeek5: weekCount >= 5,
  };
};

/**
 * Helper function to get weeks in month (non-hook version for use in other hooks)
 */
export const getWeeksInMonthSync = (year: number, month: number): number[] => {
  const result: number[] = [];
  
  for (let isoWeek = 1; isoWeek <= 53; isoWeek++) {
    const jan4 = new Date(year, 0, 4);
    const jan4IsoWeek = getWeek(jan4, { weekStartsOn: 1 });
    
    const daysToAdd = (isoWeek - jan4IsoWeek) * 7;
    const someDay = new Date(jan4.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    const monday = startOfWeek(someDay, { weekStartsOn: 1 });
    
    const mondayMonth = getMonth(monday) + 1;
    const mondayYear = getYear(monday);
    
    if (mondayMonth === month && mondayYear === year) {
      result.push(isoWeek);
    }
  }
  
  return result.sort((a, b) => a - b).slice(0, 5);
};
