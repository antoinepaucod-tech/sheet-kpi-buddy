import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CourseTemplate {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export const useCourseTemplates = () => {
  const queryClient = useQueryClient();

  const { data: courseTemplates = [], isLoading } = useQuery({
    queryKey: ["course-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_templates")
        .select("*")
        .order("name");

      if (error) throw error;
      return data as CourseTemplate[];
    },
  });

  const createTemplate = useMutation({
    mutationFn: async (template: Partial<CourseTemplate>) => {
      const { error } = await supabase.from("course_templates").insert([template as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-templates"] });
      toast.success("Cours ajouté");
    },
    onError: () => {
      toast.error("Erreur lors de l'ajout");
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CourseTemplate> & { id: string }) => {
      const { error } = await supabase
        .from("course_templates")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-templates"] });
      toast.success("Cours mis à jour");
    },
    onError: () => {
      toast.error("Erreur lors de la mise à jour");
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("course_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-templates"] });
      toast.success("Cours supprimé");
    },
    onError: () => {
      toast.error("Erreur lors de la suppression");
    },
  });

  return {
    courseTemplates,
    isLoading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  };
};
