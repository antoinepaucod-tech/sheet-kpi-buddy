import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getWeek, startOfMonth, endOfMonth } from 'date-fns';

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
const getWeeksInMonth = (year: number, month: number): number[] => {
  const weeks: number[] = [];
  const start = startOfMonth(new Date(year, month - 1));
  const end = endOfMonth(new Date(year, month - 1));
  
  let current = start;
  while (current <= end) {
    const weekNum = getWeek(current, { weekStartsOn: 1 });
    if (!weeks.includes(weekNum)) {
      weeks.push(weekNum);
    }
    current = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  return weeks;
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
