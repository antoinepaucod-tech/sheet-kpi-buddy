import { BarChart3, Users, TrendingUp, GraduationCap, Calendar, Receipt } from "lucide-react";
import { NavLink } from "@/components/NavLink";
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

const menuItems = [
  { title: "KPI Revenu", url: "/", icon: BarChart3 },
  { title: "KPI Client", url: "/kpi-client", icon: TrendingUp },
  { title: "KPI Cours", url: "/course-kpi", icon: Calendar },
  { title: "Parcours Client", url: "/customer-journey", icon: Users },
  { title: "Comptabilité", url: "/accounting", icon: Receipt },
];

const tutorialItem = { title: "Tutoriel", url: "/tutorial", icon: GraduationCap };

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

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
                      <item.icon className="h-5 w-5" />
                      <span className={collapsed ? "sr-only" : ""}>{item.title}</span>
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
