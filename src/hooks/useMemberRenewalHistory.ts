import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface RenewalHistoryEntry {
  id: string;
  member_id: string;
  renewal_date: string;
  previous_end_date: string;
  new_end_date: string;
  renewal_duration: string;
  performed_by: string | null;
  notes: string | null;
  created_at: string;
}

export function useMemberRenewalHistory(memberId: string | null) {
  const [renewalHistory, setRenewalHistory] = useState<RenewalHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!memberId) {
      setRenewalHistory([]);
      setIsLoading(false);
      return;
    }

    const fetchRenewalHistory = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('member_renewal_history')
        .select('*')
        .eq('member_id', memberId)
        .order('renewal_date', { ascending: false });

      if (error) {
        console.error('Error fetching renewal history:', error);
      } else {
        setRenewalHistory(data || []);
      }
      setIsLoading(false);
    };

    fetchRenewalHistory();
  }, [memberId]);

  const addRenewalRecord = async (record: {
    member_id: string;
    previous_end_date: string;
    new_end_date: string;
    renewal_duration: string;
    performed_by: string | null;
    notes?: string;
  }) => {
    const { data, error } = await supabase
      .from('member_renewal_history')
      .insert(record)
      .select()
      .single();

    if (error) {
      console.error('Error adding renewal record:', error);
      throw error;
    }

    setRenewalHistory(prev => [data, ...prev]);
    return data;
  };

  return { renewalHistory, isLoading, addRenewalRecord };
}
