import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CourseKPI {
  id: string;
  course_name: string;
  day_of_week: string;
  time_slot: string;
  instructor: string | null;
  year: number;
  month: number;
  month_name: string;
  week1_attendance: number;
  week2_attendance: number;
  week3_attendance: number;
  week4_attendance: number;
  week5_attendance: number;
  monthly_expenses: number;
  attendance_rate: number;
  max_capacity: number;
}

export const useCourseKPIData = (year: number, month: number) => {
  const queryClient = useQueryClient();

  const { data: courses, isLoading } = useQuery({
    queryKey: ["course-kpis", year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_kpis")
        .select("*")
        .eq("year", year)
        .eq("month", month)
        .order("day_of_week")
        .order("time_slot");

      if (error) throw error;
      return data as CourseKPI[];
    },
  });

  const createCourse = useMutation({
    mutationFn: async (course: Partial<CourseKPI>) => {
      const { data, error } = await supabase
        .from("course_kpis")
        .insert([course as any])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-kpis", year, month] });
      toast.success("Cours créé avec succès");
    },
    onError: (error) => {
      toast.error("Erreur lors de la création du cours");
      console.error(error);
    },
  });

  const updateCourse = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<CourseKPI>;
    }) => {
      // Calculate attendance rate based on weekly attendance
      const weeks = [
        updates.week1_attendance || 0,
        updates.week2_attendance || 0,
        updates.week3_attendance || 0,
        updates.week4_attendance || 0,
        updates.week5_attendance || 0,
      ];
      
      const nonZeroWeeks = weeks.filter(w => w > 0).length;
      const totalAttendance = weeks.reduce((sum, w) => sum + w, 0);
      const maxCapacity = updates.max_capacity || 10;
      
      const attendanceRate = nonZeroWeeks > 0 
        ? (totalAttendance / (nonZeroWeeks * maxCapacity)) * 100 
        : 0;

      const { data, error } = await supabase
        .from("course_kpis")
        .update({ ...updates, attendance_rate: attendanceRate })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-kpis", year, month] });
    },
    onError: (error) => {
      toast.error("Erreur lors de la mise à jour");
      console.error(error);
    },
  });

  const deleteCourse = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("course_kpis")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-kpis", year, month] });
      toast.success("Cours supprimé");
    },
    onError: (error) => {
      toast.error("Erreur lors de la suppression");
      console.error(error);
    },
  });

  return {
    courses: courses || [],
    isLoading,
    createCourse,
    updateCourse,
    deleteCourse,
  };
};
