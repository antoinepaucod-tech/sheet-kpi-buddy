import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ScheduleTemplate {
  id: string;
  day_of_week: string;
  time_slot: string;
  course_name: string;
  instructor_name: string | null;
  created_at: string;
  updated_at: string;
}

export const useScheduleTemplates = () => {
  const queryClient = useQueryClient();

  const { data: scheduleTemplates = [], isLoading } = useQuery({
    queryKey: ["schedule-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_templates")
        .select("*")
        .order("day_of_week")
        .order("time_slot");

      if (error) throw error;
      return data as ScheduleTemplate[];
    },
  });

  const createTemplate = useMutation({
    mutationFn: async (template: Partial<ScheduleTemplate>) => {
      const { error } = await supabase.from("schedule_templates").insert([template as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule-templates"] });
      toast.success("Planning ajouté");
    },
    onError: () => {
      toast.error("Erreur lors de l'ajout");
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ScheduleTemplate> & { id: string }) => {
      const { error } = await supabase
        .from("schedule_templates")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule-templates"] });
      toast.success("Planning mis à jour");
    },
    onError: () => {
      toast.error("Erreur lors de la mise à jour");
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schedule_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule-templates"] });
      toast.success("Planning supprimé");
    },
    onError: () => {
      toast.error("Erreur lors de la suppression");
    },
  });

  return {
    scheduleTemplates,
    isLoading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  };
};
