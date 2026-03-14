import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface GHLOpportunity {
  id: string;
  name: string;
  monetaryValue?: number;
  pipelineId: string;
  pipelineStageId: string;
  status: string;
  contact?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface GHLPipeline {
  id: string;
  name: string;
  stages: {
    id: string;
    name: string;
    position: number;
  }[];
}

interface GHLCalendarEvent {
  id: string;
  title: string;
  calendarId: string;
  startTime: string;
  endTime: string;
  status: string;
  appointmentStatus: string;
  contact?: {
    id: string;
    name?: string;
    email?: string;
    phone?: string;
  };
}

interface GHLCalendar {
  id: string;
  name: string;
  description?: string;
}

export const useGHL = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [pipelines, setPipelines] = useState<GHLPipeline[]>([]);
  const [opportunities, setOpportunities] = useState<GHLOpportunity[]>([]);
  const [calendars, setCalendars] = useState<GHLCalendar[]>([]);
  const [appointments, setAppointments] = useState<GHLCalendarEvent[]>([]);
  const { toast } = useToast();

  const callGHL = useCallback(async (endpoint: string, params?: Record<string, string>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data, error } = await supabase.functions.invoke('ghl-proxy', {
      body: { endpoint, params },
    });

    if (error) throw error;
    return data;
  }, []);

  const fetchPipelines = useCallback(async (locationId: string) => {
    setIsLoading(true);
    try {
      const data = await callGHL('/opportunities/pipelines', { location_id: locationId });
      const pipelinesData = data.pipelines || [];
      setPipelines(pipelinesData);
      return pipelinesData;
    } catch (error) {
      console.error('Error fetching pipelines:', error);
      toast({
        title: 'Erreur GHL',
        description: 'Impossible de récupérer les pipelines',
        variant: 'destructive',
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [callGHL, toast]);

  const fetchOpportunities = useCallback(async (locationId: string, pipelineId?: string) => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = { location_id: locationId };
      if (pipelineId) params.pipeline_id = pipelineId;
      
      const data = await callGHL('/opportunities/search', params);
      const opps = data.opportunities || [];
      setOpportunities(opps);
      return opps;
    } catch (error) {
      console.error('Error fetching opportunities:', error);
      toast({
        title: 'Erreur GHL',
        description: 'Impossible de récupérer les opportunités',
        variant: 'destructive',
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [callGHL, toast]);

  const fetchCalendars = useCallback(async (locationId: string) => {
    setIsLoading(true);
    try {
      const data = await callGHL('/calendars/', { location_id: locationId });
      const cals = data.calendars || [];
      setCalendars(cals);
      return cals;
    } catch (error) {
      console.error('Error fetching calendars:', error);
      toast({
        title: 'Erreur GHL',
        description: 'Impossible de récupérer les calendriers',
        variant: 'destructive',
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [callGHL, toast]);

  const fetchAppointments = useCallback(async (locationId: string, calendarId?: string, startDate?: string, endDate?: string) => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = { locationId };
      if (calendarId) params.calendarId = calendarId;
      if (startDate) params.startTime = startDate;
      if (endDate) params.endTime = endDate;
      
      const data = await callGHL('/calendars/events', params);
      const events = data.events || [];
      setAppointments(events);
      return events;
    } catch (error) {
      console.error('Error fetching appointments:', error);
      toast({
        title: 'Erreur GHL',
        description: 'Impossible de récupérer les rendez-vous',
        variant: 'destructive',
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [callGHL, toast]);

  return {
    isLoading,
    pipelines,
    opportunities,
    calendars,
    appointments,
    fetchPipelines,
    fetchOpportunities,
    fetchCalendars,
    fetchAppointments,
  };
};
