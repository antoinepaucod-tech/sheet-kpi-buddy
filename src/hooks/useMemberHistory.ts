import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MemberComment {
  id: string;
  member_id: string;
  comment: string;
  created_at: string;
  created_by: string;
}

export interface OnboardingHistory {
  id: string;
  member_id: string;
  action_type: string;
  action_date: string;
  previous_value: boolean;
  new_value: boolean;
}

export function useMemberHistory(memberId: string | null) {
  const [comments, setComments] = useState<MemberComment[]>([]);
  const [history, setHistory] = useState<OnboardingHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (memberId) {
      loadData();
    }
  }, [memberId]);

  const loadData = async () => {
    if (!memberId) return;

    try {
      setIsLoading(true);

      // Load comments
      const { data: commentsData, error: commentsError } = await supabase
        .from('member_comments')
        .select('*')
        .eq('member_id', memberId)
        .order('created_at', { ascending: false });

      if (commentsError) throw commentsError;
      setComments(commentsData || []);

      // Load onboarding history
      const { data: historyData, error: historyError } = await supabase
        .from('member_onboarding_history')
        .select('*')
        .eq('member_id', memberId)
        .order('action_date', { ascending: false });

      if (historyError) throw historyError;
      setHistory(historyData || []);

    } catch (error) {
      console.error('Error loading member history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addComment = async (comment: string) => {
    if (!memberId || !comment.trim()) return;

    try {
      // Get current user's email
      const { data: { user } } = await supabase.auth.getUser();
      const createdBy = user?.email?.split('@')[0] || 'User';

      const { data, error } = await supabase
        .from('member_comments')
        .insert([{
          member_id: memberId,
          comment: comment.trim(),
          created_by: createdBy
        }])
        .select()
        .single();

      if (error) throw error;

      setComments(prev => [data, ...prev]);
      return data;
    } catch (error) {
      console.error('Error adding comment:', error);
      throw error;
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('member_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      setComments(prev => prev.filter(c => c.id !== commentId));
      return true;
    } catch (error) {
      console.error('Error deleting comment:', error);
      throw error;
    }
  };

  const logOnboardingAction = async (
    actionType: string,
    previousValue: boolean,
    newValue: boolean
  ) => {
    if (!memberId) return;

    try {
      const { data, error } = await supabase
        .from('member_onboarding_history')
        .insert([{
          member_id: memberId,
          action_type: actionType,
          previous_value: previousValue,
          new_value: newValue
        }])
        .select()
        .single();

      if (error) throw error;

      setHistory(prev => [data, ...prev]);
      return data;
    } catch (error) {
      console.error('Error logging onboarding action:', error);
      throw error;
    }
  };

  return {
    comments,
    history,
    isLoading,
    addComment,
    deleteComment,
    logOnboardingAction,
    refreshData: loadData
  };
}
