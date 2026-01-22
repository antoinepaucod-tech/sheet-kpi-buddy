import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getWeek, startOfWeek, getMonth, getYear } from 'date-fns';

interface MonthlyAttendance {
  month: number;
  month_name: string;
  totalSessions: number;
  activeMembers: number;
  averagePerMember: number;
}

interface AnnualSummary {
  totalSessions: number;
  totalActiveMembers: number;
  averagePerMember: number;
  averageSessionsPerMonth: number;
}

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

// Helper to get week numbers for a specific month
// RULE: A week belongs to the month where it STARTS (Monday)
// This ensures each week is counted in only ONE month, avoiding overlaps
const getWeeksInMonth = (year: number, month: number): number[] => {
  const weeks: number[] = [];
  
  // Iterate through all 53 possible ISO weeks
  for (let weekNum = 1; weekNum <= 53; weekNum++) {
    // Find the Monday of this week
    // Start from Jan 4 which is always in week 1 by ISO definition
    const jan4 = new Date(year, 0, 4);
    const jan4Week = getWeek(jan4, { weekStartsOn: 1 });
    
    // Calculate the Monday of the target week
    const daysToAdd = (weekNum - jan4Week) * 7;
    const someDay = new Date(jan4.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    const monday = startOfWeek(someDay, { weekStartsOn: 1 });
    
    // Check if the Monday falls in the target month AND year
    const mondayMonth = getMonth(monday) + 1; // getMonth is 0-indexed
    const mondayYear = getYear(monday);
    
    if (mondayMonth === month && mondayYear === year) {
      weeks.push(weekNum);
    }
  }
  
  return weeks.sort((a, b) => a - b);
};

export const useClubAttendance = (year: number) => {
  const [weeklyTrainings, setWeeklyTrainings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('weekly_trainings')
          .select('*')
          .eq('calendar_year', year);

        if (error) throw error;
        setWeeklyTrainings(data || []);
      } catch (error) {
        console.error('Error fetching weekly trainings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [year]);

  const monthlyAttendance = useMemo((): MonthlyAttendance[] => {
    const result: MonthlyAttendance[] = [];

    for (let month = 1; month <= 12; month++) {
      const weeksInMonth = getWeeksInMonth(year, month);
      
      // Get all trainings for weeks in this month
      const monthTrainings = weeklyTrainings.filter(t => 
        t.calendar_week !== null && 
        weeksInMonth.includes(t.calendar_week)
      );

      // Total sessions
      const totalSessions = monthTrainings.reduce((sum, t) => sum + (t.trainings_count || 0), 0);
      
      // Unique active members (members with at least 1 training)
      const activeMemberIds = new Set(
        monthTrainings
          .filter(t => t.trainings_count > 0)
          .map(t => t.member_id)
      );
      const activeMembers = activeMemberIds.size;

      // Average per member
      const averagePerMember = activeMembers > 0 ? totalSessions / activeMembers : 0;

      result.push({
        month,
        month_name: MONTH_NAMES[month - 1],
        totalSessions,
        activeMembers,
        averagePerMember,
      });
    }

    return result;
  }, [weeklyTrainings, year]);

  const annualSummary = useMemo((): AnnualSummary => {
    const totalSessions = monthlyAttendance.reduce((sum, m) => sum + m.totalSessions, 0);
    
    // For annual: count unique members across all months
    const allActiveMemberIds = new Set(
      weeklyTrainings
        .filter(t => t.trainings_count > 0)
        .map(t => t.member_id)
    );
    const totalActiveMembers = allActiveMemberIds.size;
    
    const averagePerMember = totalActiveMembers > 0 ? totalSessions / totalActiveMembers : 0;
    
    const monthsWithData = monthlyAttendance.filter(m => m.totalSessions > 0).length;
    const averageSessionsPerMonth = monthsWithData > 0 ? totalSessions / monthsWithData : 0;

    return {
      totalSessions,
      totalActiveMembers,
      averagePerMember,
      averageSessionsPerMonth,
    };
  }, [monthlyAttendance, weeklyTrainings]);

  return {
    monthlyAttendance,
    annualSummary,
    isLoading,
  };
};
