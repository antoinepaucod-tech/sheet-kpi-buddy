import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type AppRole = "admin" | "staff" | "viewer" | "coach";

export const useUserRole = () => {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .single();

        if (error) {
          console.error("Error fetching user role:", error);
          setRole(null);
        } else {
          setRole(data?.role as AppRole || null);
        }
      } catch (err) {
        console.error("Error fetching user role:", err);
        setRole(null);
      } finally {
        setLoading(false);
      }
    };

    fetchRole();
  }, [user]);

  const isAdmin = role === "admin";
  const isCoach = role === "coach";
  const isStaff = role === "staff";
  const isViewer = role === "viewer";

  // Coach accessible pages
  const canAccessPage = (path: string): boolean => {
    if (isAdmin || isStaff) return true;
    
    if (isCoach) {
      const coachAllowedPaths = [
        "/6-weeks-challenge",
        "/course-kpi",
        "/kpi-client",
        "/tutorial"
      ];
      return coachAllowedPaths.some(allowed => path.startsWith(allowed));
    }
    
    if (isViewer) {
      // Viewers can view all pages but not edit
      return true;
    }
    
    return false;
  };

  // For CourseKPI tabs - coach can only see dashboard and planning
  const canAccessCourseKPITab = (tab: string): boolean => {
    if (isAdmin || isStaff) return true;
    
    if (isCoach) {
      const allowedTabs = ["dashboard", "courses"];
      return allowedTabs.includes(tab);
    }
    
    if (isViewer) return true;
    
    return false;
  };

  return {
    role,
    loading,
    isAdmin,
    isCoach,
    isStaff,
    isViewer,
    canAccessPage,
    canAccessCourseKPITab,
  };
};
