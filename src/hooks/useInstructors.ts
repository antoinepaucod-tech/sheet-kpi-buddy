import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Instructor {
  id: string;
  name: string;
  hourly_rate: number;
  created_at: string;
  updated_at: string;
}

export const useInstructors = () => {
  const queryClient = useQueryClient();

  const { data: instructors = [], isLoading } = useQuery({
    queryKey: ["instructors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instructors")
        .select("*")
        .order("name");

      if (error) throw error;
      return data as Instructor[];
    },
  });

  const createInstructor = useMutation({
    mutationFn: async (instructor: Partial<Instructor>) => {
      const { error } = await supabase.from("instructors").insert([instructor as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instructors"] });
      toast.success("Instructeur ajouté");
    },
    onError: () => {
      toast.error("Erreur lors de l'ajout");
    },
  });

  const updateInstructor = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Instructor> & { id: string }) => {
      const { error } = await supabase
        .from("instructors")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instructors"] });
      toast.success("Instructeur mis à jour");
    },
    onError: () => {
      toast.error("Erreur lors de la mise à jour");
    },
  });

  const deleteInstructor = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("instructors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instructors"] });
      toast.success("Instructeur supprimé");
    },
    onError: () => {
      toast.error("Erreur lors de la suppression");
    },
  });

  return {
    instructors,
    isLoading,
    createInstructor,
    updateInstructor,
    deleteInstructor,
  };
};
