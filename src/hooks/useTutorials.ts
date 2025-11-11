import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Tutorial {
  id: string;
  title: string;
  description: string | null;
  video_type: 'youtube' | 'vimeo' | 'tella' | 'upload';
  video_url: string;
  thumbnail_url: string | null;
  duration: number | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface TutorialView {
  id: string;
  tutorial_id: string;
  user_id: string;
  viewed_at: string;
  completed: boolean;
}

export const useTutorials = () => {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [tutorialViews, setTutorialViews] = useState<TutorialView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Load tutorials
      const { data: tutorialsData, error: tutorialsError } = await supabase
        .from("tutorials")
        .select("*")
        .order("order_index", { ascending: true });

      if (tutorialsError) throw tutorialsError;

      const typedTutorials = (tutorialsData || []) as Tutorial[];
      
      // Load tutorial views
      const { data: viewsData, error: viewsError } = await supabase
        .from("tutorial_views")
        .select("*");

      if (viewsError) throw viewsError;

      setTutorials(typedTutorials);
      setTutorialViews(viewsData || []);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const addTutorial = async (tutorial: Omit<Tutorial, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from("tutorials")
        .insert([tutorial])
        .select()
        .single();

      if (error) throw error;

      const typedData = data as Tutorial;
      setTutorials([...tutorials, typedData]);
      toast({
        title: "Succès",
        description: "Tutoriel ajouté avec succès",
      });
      return data;
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }
  };

  const updateTutorial = async (id: string, updates: Partial<Tutorial>) => {
    try {
      const { error } = await supabase
        .from("tutorials")
        .update(updates)
        .eq("id", id);

      if (error) throw error;

      setTutorials(tutorials.map(t => t.id === id ? { ...t, ...updates } : t));
      toast({
        title: "Succès",
        description: "Tutoriel mis à jour",
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteTutorial = async (id: string) => {
    try {
      const { error } = await supabase
        .from("tutorials")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setTutorials(tutorials.filter(t => t.id !== id));
      toast({
        title: "Succès",
        description: "Tutoriel supprimé",
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const markAsViewed = async (tutorialId: string, userId: string, completed: boolean = true) => {
    try {
      const { data, error } = await supabase
        .from("tutorial_views")
        .upsert({
          tutorial_id: tutorialId,
          user_id: userId,
          completed,
        })
        .select()
        .single();

      if (error) throw error;

      setTutorialViews([
        ...tutorialViews.filter(v => !(v.tutorial_id === tutorialId && v.user_id === userId)),
        data
      ]);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const isTutorialViewed = (tutorialId: string, userId: string): boolean => {
    return tutorialViews.some(
      v => v.tutorial_id === tutorialId && v.user_id === userId && v.completed
    );
  };

  return {
    tutorials,
    tutorialViews,
    isLoading,
    addTutorial,
    updateTutorial,
    deleteTutorial,
    markAsViewed,
    isTutorialViewed,
  };
};
