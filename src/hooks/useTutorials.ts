import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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

export function useTutorials() {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [tutorialViews, setTutorialViews] = useState<TutorialView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId] = useState(() => `user-${Date.now()}`); // Temporary user ID for demo

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);

      // Load tutorials
      const { data: tutorialsData, error: tutorialsError } = await supabase
        .from('tutorials')
        .select('*')
        .order('order_index', { ascending: true });

      if (tutorialsError) throw tutorialsError;
      setTutorials((tutorialsData || []) as Tutorial[]);

      // Load tutorial views
      const { data: viewsData, error: viewsError } = await supabase
        .from('tutorial_views')
        .select('*')
        .eq('user_id', userId);

      if (viewsError) throw viewsError;
      setTutorialViews(viewsData || []);

    } catch (error) {
      console.error('Error loading tutorials:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addTutorial = async (tutorial: Omit<Tutorial, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('tutorials')
        .insert([tutorial])
        .select()
        .single();

      if (error) throw error;
      
      setTutorials(prev => [...prev, data as Tutorial].sort((a, b) => a.order_index - b.order_index));
      return data;
    } catch (error) {
      console.error('Error adding tutorial:', error);
      throw error;
    }
  };

  const updateTutorial = async (id: string, updates: Partial<Tutorial>) => {
    try {
      const { data, error } = await supabase
        .from('tutorials')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setTutorials(prev =>
        prev.map(t => t.id === id ? data as Tutorial : t).sort((a, b) => a.order_index - b.order_index)
      );
    } catch (error) {
      console.error('Error updating tutorial:', error);
      throw error;
    }
  };

  const deleteTutorial = async (id: string) => {
    try {
      const { error } = await supabase
        .from('tutorials')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setTutorials(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error deleting tutorial:', error);
      throw error;
    }
  };

  const markAsViewed = async (tutorialId: string, completed: boolean = true) => {
    try {
      const existing = tutorialViews.find(v => v.tutorial_id === tutorialId && v.user_id === userId);

      if (existing) {
        // Update existing view
        const { data, error } = await supabase
          .from('tutorial_views')
          .update({ completed, viewed_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;

        setTutorialViews(prev =>
          prev.map(v => v.id === existing.id ? data : v)
        );
      } else {
        // Create new view
        const { data, error } = await supabase
          .from('tutorial_views')
          .insert([{
            tutorial_id: tutorialId,
            user_id: userId,
            completed
          }])
          .select()
          .single();

        if (error) throw error;

        setTutorialViews(prev => [...prev, data]);
      }
    } catch (error) {
      console.error('Error marking tutorial as viewed:', error);
      throw error;
    }
  };

  const isCompleted = (tutorialId: string): boolean => {
    const view = tutorialViews.find(v => v.tutorial_id === tutorialId && v.user_id === userId);
    return view?.completed || false;
  };

  return {
    tutorials,
    tutorialViews,
    isLoading,
    addTutorial,
    updateTutorial,
    deleteTutorial,
    markAsViewed,
    isCompleted,
  };
}
