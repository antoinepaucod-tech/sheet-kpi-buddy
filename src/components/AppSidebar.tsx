import { useEffect, useState } from "react";
import { BarChart3, Users, TrendingUp, GraduationCap, Calendar, Receipt, LayoutDashboard, Bell, LogOut, Trophy, Settings } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { addMonths, startOfDay, endOfDay, isWithinInterval, format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

// All menu items with role restrictions
const allMenuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, roles: ["admin", "staff", "viewer"] },
  { title: "KPI Revenu", url: "/kpi-revenue", icon: BarChart3, roles: ["admin", "staff", "viewer"] },
  { title: "KPI Client", url: "/kpi-client", icon: TrendingUp, roles: ["admin", "staff", "viewer", "coach"] },
  { title: "KPI Cours", url: "/course-kpi", icon: Calendar, roles: ["admin", "staff", "viewer", "coach"] },
  { title: "Parcours Client", url: "/customer-journey", icon: Users, roles: ["admin", "staff", "viewer"] },
  { title: "6 Weeks Challenge", url: "/6-weeks-challenge", icon: Trophy, roles: ["admin", "staff", "viewer", "coach"] },
  { title: "Comptabilité", url: "/accounting", icon: Receipt, roles: ["admin", "staff", "viewer"] },
  { title: "Échéances", url: "/expiring-subscriptions", icon: Bell, showAlert: true, roles: ["admin", "staff", "viewer"] },
];

const tutorialItem = { title: "Tutoriel", url: "/tutorial", icon: GraduationCap, roles: ["admin", "staff", "viewer", "coach"] };
const adminItem = { title: "Gestion Utilisateurs", url: "/users", icon: Settings, roles: ["admin"] };

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut, user } = useAuth();
  const { role, isAdmin, isCoach } = useUserRole();
  const [expiringCount, setExpiringCount] = useState(0);

  // Filter menu items based on user role
  const menuItems = allMenuItems.filter(item => {
    if (!role) return false;
    return item.roles.includes(role);
  });

  useEffect(() => {
    // Only load expiring count for non-coach roles
    if (isCoach) return;
    
    loadExpiringCount();
    
    // Refresh count every 5 minutes
    const interval = setInterval(loadExpiringCount, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [role, isCoach]);

  const loadExpiringCount = async () => {
    const today = startOfDay(new Date());
    const oneMonthFromNow = endOfDay(addMonths(today, 1));

    const { data, error } = await supabase
      .from('customer_members')
      .select('subscription_end_date, exit_date')
      .not('subscription_end_date', 'is', null)
      .or('exit_date.is.null,exit_date.gt.' + format(today, 'yyyy-MM-dd'));

    if (error) {
      console.error("Error loading expiring count:", error);
      return;
    }

    const count = (data || []).filter(member => {
      if (!member.subscription_end_date) return false;
      const endDate = new Date(member.subscription_end_date);
      return isWithinInterval(endDate, { start: today, end: oneMonthFromNow });
    }).length;

    setExpiringCount(count);
  };

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className={collapsed ? "opacity-0" : ""}>
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink 
                      to={item.url} 
                      className="flex items-center gap-3 hover:bg-accent/50 transition-colors"
                      activeClassName="bg-accent text-accent-foreground font-medium"
                    >
                      <div className="relative">
                        <item.icon className="h-5 w-5" />
                        {item.showAlert && expiringCount > 0 && (
                          <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
                        )}
                      </div>
                      <span className={collapsed ? "sr-only" : ""}>
                        {item.title}
                      </span>
                      {item.showAlert && expiringCount > 0 && !collapsed && (
                        <Badge variant="destructive" className="ml-auto text-xs px-1.5 py-0.5 h-5">
                          {expiringCount}
                        </Badge>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {tutorialItem.roles.includes(role || "") && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={tutorialItem.title}>
                    <NavLink 
                      to={tutorialItem.url} 
                      className="flex items-center gap-3 hover:bg-accent/50 transition-colors"
                      activeClassName="bg-accent text-accent-foreground font-medium"
                    >
                      <tutorialItem.icon className="h-5 w-5" />
                      <span className={collapsed ? "sr-only" : ""}>{tutorialItem.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              
              {adminItem.roles.includes(role || "") && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={adminItem.title}>
                    <NavLink 
                      to={adminItem.url} 
                      className="flex items-center gap-3 hover:bg-accent/50 transition-colors"
                      activeClassName="bg-accent text-accent-foreground font-medium"
                    >
                      <adminItem.icon className="h-5 w-5" />
                      <span className={collapsed ? "sr-only" : ""}>{adminItem.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              
              {user && (
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    tooltip="Déconnexion"
                    onClick={signOut}
                    className="flex items-center gap-3 hover:bg-destructive/10 text-destructive transition-colors cursor-pointer"
                  >
                    <LogOut className="h-5 w-5" />
                    <span className={collapsed ? "sr-only" : ""}>Déconnexion</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}