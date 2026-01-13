import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Member {
  id: string;
  name: string;
  membership: string;
  member_type?: string | null;
  cash_collected?: number | null;
  contract_signed_date?: string | null;
  subscription_end_date?: string | null;
  exit_date?: string | null;
  onboarding_bsport: boolean;
  onboarding_hubfit: boolean;
  onboarding_nutrition: boolean;
  questionnaire_coaching: boolean;
  session_introduction: boolean;
  sold_by?: string | null;
  // Duo subscription fields
  persons_count: number;
  subscription_group_id?: string | null;
  is_primary_subscriber: boolean;
}

export interface WeeklyTraining {
  id?: string;
  member_id: string;
  week_number: number;
  trainings_count: number;
  calendar_week?: number | null;
  calendar_year?: number | null;
}

export const useCustomerMembers = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [weeklyTrainings, setWeeklyTrainings] = useState<WeeklyTraining[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Load members
      const { data: membersData, error: membersError } = await supabase
        .from('customer_members')
        .select('*')
        .order('created_at', { ascending: true });

      if (membersError) throw membersError;
      
      // Load weekly trainings
      const { data: trainingsData, error: trainingsError } = await supabase
        .from('weekly_trainings')
        .select('*');

      if (trainingsError) throw trainingsError;

      setMembers(membersData || []);
      setWeeklyTrainings(trainingsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les données',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addMember = async (name: string, membership: string) => {
    try {
      const { data, error } = await supabase
        .from('customer_members')
        .insert([{ name, membership }])
        .select()
        .single();

      if (error) throw error;

      setMembers([...members, data]);
      toast({
        title: 'Membre ajouté',
        description: `${name} a été ajouté avec succès`,
      });
    } catch (error) {
      console.error('Error adding member:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'ajouter le membre',
        variant: 'destructive',
      });
    }
  };

  const updateMember = async (id: string, updates: Partial<Member>) => {
    try {
      const { error } = await supabase
        .from('customer_members')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setMembers(members.map(m => m.id === id ? { ...m, ...updates } : m));
    } catch (error) {
      console.error('Error updating member:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour le membre',
        variant: 'destructive',
      });
    }
  };

  const deleteMember = async (id: string) => {
    try {
      const { error } = await supabase
        .from('customer_members')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMembers(members.filter(m => m.id !== id));
      setWeeklyTrainings(weeklyTrainings.filter(wt => wt.member_id !== id));
      
      toast({
        title: 'Membre supprimé',
        description: 'Le membre a été supprimé avec succès',
      });
    } catch (error) {
      console.error('Error deleting member:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer le membre',
        variant: 'destructive',
      });
    }
  };

  // Updated to include calendar_week and calendar_year
  const updateWeeklyTraining = async (
    memberId: string,
    weekNumber: number,
    trainingsCount: number,
    calendarWeek?: number,
    calendarYear?: number
  ) => {
    try {
      const existing = weeklyTrainings.find(
        wt => wt.member_id === memberId && wt.week_number === weekNumber
      );

      if (existing) {
        const updateData: { trainings_count: number; calendar_week?: number; calendar_year?: number } = { 
          trainings_count: trainingsCount 
        };
        
        // Also update calendar data if provided and not already set
        if (calendarWeek !== undefined && calendarYear !== undefined) {
          updateData.calendar_week = calendarWeek;
          updateData.calendar_year = calendarYear;
        }
        
        const { error } = await supabase
          .from('weekly_trainings')
          .update(updateData)
          .eq('member_id', memberId)
          .eq('week_number', weekNumber);

        if (error) throw error;

        setWeeklyTrainings(
          weeklyTrainings.map(wt =>
            wt.member_id === memberId && wt.week_number === weekNumber
              ? { ...wt, trainings_count: trainingsCount, calendar_week: calendarWeek, calendar_year: calendarYear }
              : wt
          )
        );
      } else {
        const insertData: {
          member_id: string;
          week_number: number;
          trainings_count: number;
          calendar_week?: number;
          calendar_year?: number;
        } = { 
          member_id: memberId, 
          week_number: weekNumber, 
          trainings_count: trainingsCount 
        };
        
        if (calendarWeek !== undefined && calendarYear !== undefined) {
          insertData.calendar_week = calendarWeek;
          insertData.calendar_year = calendarYear;
        }
        
        const { data, error } = await supabase
          .from('weekly_trainings')
          .insert([insertData])
          .select()
          .single();

        if (error) throw error;

        setWeeklyTrainings([...weeklyTrainings, data]);
      }
    } catch (error) {
      console.error('Error updating weekly training:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour les entraînements',
        variant: 'destructive',
      });
    }
  };

  const getWeeklyTraining = (memberId: string, weekNumber: number): number => {
    const training = weeklyTrainings.find(
      wt => wt.member_id === memberId && wt.week_number === weekNumber
    );
    return training?.trainings_count ?? 0;
  };

  // New function to get training by calendar week
  const getWeeklyTrainingByCalendarWeek = (memberId: string, calendarWeek: number, calendarYear: number): number => {
    const training = weeklyTrainings.find(
      wt => wt.member_id === memberId && wt.calendar_week === calendarWeek && wt.calendar_year === calendarYear
    );
    return training?.trainings_count ?? 0;
  };

  return {
    members,
    weeklyTrainings,
    isLoading,
    addMember,
    updateMember,
    deleteMember,
    updateWeeklyTraining,
    getWeeklyTraining,
    getWeeklyTrainingByCalendarWeek,
  };
};
