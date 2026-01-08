import { ChevronRight, Home } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const routeLabels: Record<string, string> = {
  "/": "Dashboard",
  "/kpi-revenue": "KPI Revenu",
  "/kpi-client": "KPI Client",
  "/course-kpi": "KPI Cours",
  "/customer-journey": "Parcours Client",
  "/6-weeks-challenge": "6 Weeks Challenge",
  "/accounting": "Comptabilité",
  "/expiring-subscriptions": "Échéances",
  "/tutorial": "Tutoriel",
  "/users": "Gestion Utilisateurs",
};

export const Breadcrumbs = () => {
  const location = useLocation();
  const currentPath = location.pathname;
  const currentLabel = routeLabels[currentPath] || "Page";

  // Don't show breadcrumbs on home page
  if (currentPath === "/") return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4 animate-fade-in">
      <Link 
        to="/" 
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        <Home className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Accueil</span>
      </Link>
      <ChevronRight className="h-3.5 w-3.5" />
      <span className={cn("font-medium text-foreground")}>
        {currentLabel}
      </span>
    </nav>
  );
};
