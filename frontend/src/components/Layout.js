import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Tag,
  Settings,
  ChevronLeft,
  ChevronRight,
  Globe,
  RefreshCw,
  LogOut,
  User,
  BarChart3,
  Users,
  Trophy,
  CalendarDays,
  UserCheck,
  CreditCard,
  ClipboardCheck,
  ClipboardList,
  Sliders,
} from "lucide-react";
import { useTranslations } from "../hooks/useTranslations";
import { useAuth } from "../contexts/AuthContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { cn } from "../lib/utils";

export function Layout({ children, selectedMonth, setSelectedMonth, availableMonths }) {
  const { t, lang, setLang } = useTranslations();
  const { user, logout } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const navItems = [
    { path: "/", icon: LayoutDashboard, label: t("dashboard") },
    { path: "/compare", icon: BarChart3, label: lang === "fr" ? "Analyse Multi-Mois" : "Multi-Month" },
    { path: "/members", icon: Users, label: lang === "fr" ? "Membres" : "Members" },
    { path: "/payments", icon: CreditCard, label: lang === "fr" ? "Paiements" : "Payments" },
    { path: "/onboarding", icon: ClipboardCheck, label: lang === "fr" ? "Onboarding" : "Onboarding" },
    { path: "/annual-reviews", icon: ClipboardList, label: lang === "fr" ? "Bilans Annuels" : "Annual Reviews" },
    { path: "/challenge", icon: Trophy, label: lang === "fr" ? "Challenge 6 Sem." : "6 Weeks Challenge" },
    { path: "/courses", icon: CalendarDays, label: lang === "fr" ? "KPIs Cours" : "Course KPIs" },
    { path: "/clients", icon: UserCheck, label: lang === "fr" ? "KPIs Clients" : "Client KPIs" },
    { path: "/transactions", icon: ArrowLeftRight, label: t("transactions") },
    { path: "/recurring", icon: RefreshCw, label: t("recurringTransactions") },
    { path: "/categories", icon: Tag, label: t("categories") },
    { path: "/settings", icon: Settings, label: t("settings") },
    { path: "/settings/types", icon: Sliders, label: lang === "fr" ? "Config. Types" : "Types Config" },
  ];

  return (
    <div className="flex min-h-screen bg-[#09090B]">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col bg-[#121214] border-r border-white/10 transition-all duration-300 flex-shrink-0",
          collapsed ? "w-16" : "w-60"
        )}
      >
        <div className="flex items-center justify-between p-4 h-16 border-b border-white/10">
          {!collapsed && (
            <span className="font-heading text-lg font-extrabold tracking-tight text-white uppercase">
              KPI Buddy
            </span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-white/40 hover:text-white transition-colors ml-auto"
            data-testid="sidebar-toggle"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {navItems.map(({ path, icon: Icon, label }) => (
            <Link
              key={path}
              to={path}
              data-testid={`nav-${path === "/" ? "dashboard" : path.replace("/", "")}`}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-sm transition-colors",
                location.pathname === path
                  ? "bg-rose-600/20 text-rose-500 border-l-2 border-rose-600"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              )}
            >
              <Icon size={18} strokeWidth={1.5} />
              {!collapsed && (
                <span className="text-sm font-medium">{label}</span>
              )}
            </Link>
          ))}
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-white/10">
          {!collapsed && user && (
            <div className="mb-3 px-2">
              <p className="text-xs text-white/40 truncate">{user.email}</p>
              <p className="text-sm text-white font-medium truncate">{user.club_name}</p>
            </div>
          )}
          <button
            onClick={logout}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-sm transition-colors w-full",
              "text-white/40 hover:text-red-400 hover:bg-red-500/10"
            )}
            data-testid="logout-btn"
          >
            <LogOut size={16} />
            {!collapsed && (
              <span className="text-sm">{lang === "fr" ? "Déconnexion" : "Logout"}</span>
            )}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-[#09090B]/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-2 text-white/60">
                <User size={14} />
                <span className="text-sm font-medium">{user.club_name}</span>
              </div>
            )}
            {availableMonths && availableMonths.length > 0 && (
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger
                  className="w-48 bg-[#1C1C1E] border-white/10 text-white text-sm h-9 focus:ring-rose-500"
                  data-testid="month-selector"
                >
                  <SelectValue placeholder={t("selectMonth")} />
                </SelectTrigger>
                <SelectContent className="bg-[#1C1C1E] border-white/10">
                  {availableMonths.map((m) => (
                    <SelectItem
                      key={m.value}
                      value={m.value}
                      className="text-white focus:bg-white/10 focus:text-white"
                    >
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Globe size={15} className="text-white/30" />
            {["fr", "en"].map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                data-testid={`lang-btn-${l}`}
                className={cn(
                  "text-xs font-bold uppercase px-2.5 py-1 rounded-sm transition-colors",
                  lang === l
                    ? "text-rose-500 bg-rose-600/10"
                    : "text-white/40 hover:text-white"
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
