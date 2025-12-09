import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { differenceInWeeks, parseISO, addWeeks } from 'date-fns';

export interface ChallengeMember {
  id: string;
  name: string;
  membership: string;
  contract_signed_date: string | null;
  subscription_end_date: string | null;
  exit_date: string | null;
  cash_collected: number | null;
  member_type: string | null;
}

export interface ChallengeCheckin {
  id?: string;
  member_id: string;
  week_number: number;
  completed: boolean;
}

export interface WeeklyTraining {
  id?: string;
  member_id: string;
  week_number: number;
  trainings_count: number;
}

export const useChallengeMembers = () => {
  const [members, setMembers] = useState<ChallengeMember[]>([]);
  const [checkins, setCheckins] = useState<ChallengeCheckin[]>([]);
  const [trainings, setTrainings] = useState<WeeklyTraining[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Load members with "6WEEKS CHALLENGE" membership (case insensitive match)
      const { data: membersData, error: membersError } = await supabase
        .from('customer_members')
        .select('id, name, membership, contract_signed_date, subscription_end_date, exit_date, cash_collected, member_type')
        .ilike('membership', '%6week%')
        .order('created_at', { ascending: false });

      if (membersError) throw membersError;
      
      // Load checkins
      const { data: checkinsData, error: checkinsError } = await supabase
        .from('challenge_weekly_checkins')
        .select('*');

      if (checkinsError) throw checkinsError;
      
      // Load weekly trainings for these members
      const memberIds = (membersData || []).map(m => m.id);
      let trainingsData: WeeklyTraining[] = [];
      
      if (memberIds.length > 0) {
        const { data: trainingsResult, error: trainingsError } = await supabase
          .from('weekly_trainings')
          .select('*')
          .in('member_id', memberIds);

        if (trainingsError) throw trainingsError;
        trainingsData = trainingsResult || [];
      }

      setMembers(membersData || []);
      setCheckins(checkinsData || []);
      setTrainings(trainingsData);
    } catch (error) {
      console.error('Error loading challenge data:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les données du challenge',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateCheckin = async (memberId: string, weekNumber: number, completed: boolean) => {
    try {
      const existing = checkins.find(
        c => c.member_id === memberId && c.week_number === weekNumber
      );

      if (existing) {
        const { error } = await supabase
          .from('challenge_weekly_checkins')
          .update({ completed })
          .eq('member_id', memberId)
          .eq('week_number', weekNumber);

        if (error) throw error;

        setCheckins(
          checkins.map(c =>
            c.member_id === memberId && c.week_number === weekNumber
              ? { ...c, completed }
              : c
          )
        );
      } else {
        const { data, error } = await supabase
          .from('challenge_weekly_checkins')
          .insert([{ member_id: memberId, week_number: weekNumber, completed }])
          .select()
          .single();

        if (error) throw error;

        setCheckins([...checkins, data]);
      }
    } catch (error) {
      console.error('Error updating checkin:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour le check-in',
        variant: 'destructive',
      });
    }
  };

  const getCheckin = (memberId: string, weekNumber: number): boolean => {
    const checkin = checkins.find(
      c => c.member_id === memberId && c.week_number === weekNumber
    );
    return checkin?.completed ?? false;
  };

  const getTraining = (memberId: string, weekNumber: number): number => {
    const training = trainings.find(
      t => t.member_id === memberId && t.week_number === weekNumber
    );
    return training?.trainings_count ?? 0;
  };

  // Calculate challenge progress for a member
  const getChallengeProgress = (member: ChallengeMember) => {
    if (!member.contract_signed_date) {
      return { currentWeek: 0, totalWeeks: 6, isActive: false, isCompleted: false };
    }

    const startDate = parseISO(member.contract_signed_date);
    const endDate = addWeeks(startDate, 6);
    const now = new Date();
    
    const weeksElapsed = differenceInWeeks(now, startDate);
    const currentWeek = Math.min(Math.max(weeksElapsed + 1, 1), 6);
    
    const isActive = now >= startDate && now < endDate;
    const isCompleted = now >= endDate;

    return { currentWeek, totalWeeks: 6, isActive, isCompleted };
  };

  // Calculate engagement level based on trainings (3 per week expected)
  const getEngagementLevel = (memberId: string, currentWeek: number): string => {
    if (currentWeek <= 0) return 'na';
    
    let totalTrainings = 0;
    let weeksWithData = 0;
    
    for (let week = 1; week <= currentWeek; week++) {
      const training = getTraining(memberId, week);
      totalTrainings += training;
      if (training > 0) weeksWithData++;
    }
    
    // Calculate average trainings per week
    const avgTrainings = currentWeek > 0 ? totalTrainings / currentWeek : 0;
    
    // Expected: 3 trainings per week
    if (avgTrainings >= 3) return 'high';
    if (avgTrainings >= 2) return 'medium';
    if (avgTrainings >= 1) return 'low';
    return 'at-risk';
  };

  // Calculate checkin completion rate
  const getCheckinRate = (memberId: string, currentWeek: number): number => {
    if (currentWeek <= 0) return 0;
    
    let completedCount = 0;
    for (let week = 1; week <= currentWeek; week++) {
      if (getCheckin(memberId, week)) {
        completedCount++;
      }
    }
    
    return Math.round((completedCount / currentWeek) * 100);
  };

  return {
    members,
    checkins,
    trainings,
    isLoading,
    updateCheckin,
    getCheckin,
    getTraining,
    getChallengeProgress,
    getEngagementLevel,
    getCheckinRate,
    refresh: loadData,
  };
};
