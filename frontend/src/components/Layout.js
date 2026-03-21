import { useState, useEffect } from "react";
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
  UserCog,
  ListChecks,
  Mail,
  Table2,
  Building2,
  ChevronDown,
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

const NAV_SECTIONS = (lang) => [
  {
    label: lang === "fr" ? "Pilotage" : "Analytics",
    items: [
      { path: "/", icon: LayoutDashboard, label: lang === "fr" ? "Tableau de bord" : "Dashboard" },
      { path: "/compare", icon: BarChart3, label: lang === "fr" ? "Analyse Multi-Mois" : "Multi-Month" },
    ],
  },
  {
    label: lang === "fr" ? "Membres" : "Members",
    items: [
      { path: "/members", icon: Users, label: lang === "fr" ? "Membres" : "Members" },
      { path: "/payments", icon: CreditCard, label: lang === "fr" ? "Paiements" : "Payments" },
      { path: "/onboarding", icon: ClipboardCheck, label: "Onboarding" },
    ],
  },
  {
    label: lang === "fr" ? "Activité" : "Activity",
    items: [
      { path: "/courses", icon: CalendarDays, label: lang === "fr" ? "KPIs Cours" : "Course KPIs" },
      { path: "/attendance", icon: ListChecks, label: lang === "fr" ? "Saisie Séances" : "Attendance" },
      { path: "/clients", icon: UserCheck, label: lang === "fr" ? "KPIs Clients" : "Client KPIs" },
      { path: "/coaches", icon: UserCog, label: lang === "fr" ? "Coachs" : "Coaches" },
    ],
  },
  {
    label: lang === "fr" ? "Programmes" : "Programs",
    items: [
      { path: "/challenge", icon: Trophy, label: lang === "fr" ? "Challenge 6 Sem." : "6 Weeks" },
      { path: "/annual-reviews", icon: ClipboardList, label: lang === "fr" ? "Bilans / Suivis" : "Reviews" },
    ],
  },
  {
    label: lang === "fr" ? "Comptabilité" : "Accounting",
    items: [
      { path: "/transactions", icon: ArrowLeftRight, label: lang === "fr" ? "Transactions" : "Transactions" },
      { path: "/budget", icon: Table2, label: lang === "fr" ? "Budget Mensuel" : "Monthly Budget" },
      { path: "/recurring", icon: RefreshCw, label: lang === "fr" ? "Récurrentes" : "Recurring" },
      { path: "/categories", icon: Tag, label: lang === "fr" ? "Catégories" : "Categories" },
    ],
  },
  {
    label: lang === "fr" ? "Communication" : "Communication",
    items: [
      { path: "/notifications", icon: Mail, label: lang === "fr" ? "Messagerie" : "Messaging" },
    ],
  },
  {
    label: "Configuration",
    items: [
      { path: "/settings", icon: Settings, label: lang === "fr" ? "Paramètres" : "Settings" },
      { path: "/settings/types", icon: Sliders, label: lang === "fr" ? "Config. Types" : "Types Config" },
    ],
  },
];

export function Layout({ children, selectedMonth, setSelectedMonth, availableMonths }) {
  const { t, lang, setLang } = useTranslations();
  const { user, logout } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [pendingOnboardingCount, setPendingOnboardingCount] = useState(0);
  const [latePaymentsCount, setLatePaymentsCount] = useState(0);
  const [upcomingReviewsCount, setUpcomingReviewsCount] = useState(0);
  const [overdueReviewsCount, setOverdueReviewsCount] = useState(0);

  // Multi-club context
  const { clubs, activeClubId, switchClub } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";

  // Build navigation with Franchise as first item for super_admin
  const navSections = isSuperAdmin
    ? [{ label: "Franchise", items: [{ path: "/franchise", icon: Building2, label: "Dashboard Franchise" }] }, ...NAV_SECTIONS(lang)]
    : NAV_SECTIONS(lang);

  const sections = navSections;

  // Fetch notification counts for badges
  useEffect(() => {
    const API = process.env.REACT_APP_BACKEND_URL + "/api";
    fetch(`${API}/onboarding/pending`)
      .then(r => r.json())
      .then(data => setPendingOnboardingCount(Array.isArray(data) ? data.length : 0))
      .catch(() => {});
    fetch(`${API}/payments/late`)
      .then(r => r.json())
      .then(data => setLatePaymentsCount(Array.isArray(data) ? data.length : 0))
      .catch(() => {});
    fetch(`${API}/annual-reviews/stats`)
      .then(r => r.json())
      .then(data => {
        setUpcomingReviewsCount(data.this_week || 0);
        setOverdueReviewsCount(data.overdue || 0);
      })
      .catch(() => {});
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--color-bg-primary)' }}>
      {/* Sidebar */}
      <aside
        className={cn(
          "tf-sidebar flex flex-col transition-all duration-300 flex-shrink-0",
          collapsed ? "w-16" : "w-60"
        )}
      >
        <div className="flex items-center justify-between p-4 h-16" style={{ borderBottom: '1px solid var(--color-border)' }}>
          {!collapsed && (
            <span className="font-display" style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>
              Transform
            </span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto"
            style={{ color: 'var(--color-text-tertiary)', transition: 'var(--transition-fast)' }}
            data-testid="sidebar-toggle"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className="flex-1 py-2 overflow-y-auto">
          {sections.map((section) => (
            <div key={section.label} className="mb-1">
              {!collapsed && (
                <p className="tf-label px-4 pt-3 pb-1">
                  {section.label}
                </p>
              )}
              {collapsed && <div className="my-1 mx-3" style={{ borderTop: '1px solid var(--color-border)' }} />}
              <div className="space-y-0.5 px-2">
                {section.items.map(({ path, icon: Icon, label }) => {
                  const isActive = location.pathname === path;
                  const showBadge = path === "/onboarding" && pendingOnboardingCount > 0;
                  const showLateBadge = path === "/payments" && latePaymentsCount > 0;
                  const showReviewBadges = path === "/annual-reviews";
                  return (
                    <Link
                      key={path}
                      to={path}
                      data-testid={`nav-${path === "/" ? "dashboard" : path.replace(/\//g, "").replace("settings-types", "settings/types")}`}
                      className={cn("tf-sidebar-item flex items-center gap-3", isActive && "active")}
                    >
                      <Icon size={16} strokeWidth={1.5} />
                      {!collapsed && (
                        <span className="flex-1" style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }}>{label}</span>
                      )}
                      {!collapsed && showBadge && (
                        <span
                          className="min-w-[20px] h-5 flex items-center justify-center rounded-full text-xs font-bold"
                          style={{ background: 'var(--color-accent)', color: '#fff', fontSize: '10px', padding: '0 5px' }}
                        >
                          {pendingOnboardingCount}
                        </span>
                      )}
                      {!collapsed && showLateBadge && (
                        <span
                          className="min-w-[20px] h-5 flex items-center justify-center rounded-full text-xs font-bold"
                          style={{ background: 'var(--color-danger)', color: '#fff', fontSize: '10px', padding: '0 5px' }}
                          data-testid="late-payments-badge"
                        >
                          {latePaymentsCount}
                        </span>
                      )}
                      {!collapsed && showReviewBadges && (
                        <div className="flex items-center gap-1">
                          {upcomingReviewsCount > 0 && (
                            <span
                              className="min-w-[20px] h-5 flex items-center justify-center rounded-full text-xs font-bold"
                              style={{ background: 'var(--color-warning)', color: '#000', fontSize: '10px', padding: '0 5px' }}
                              data-testid="upcoming-reviews-badge"
                              title="Bilans cette semaine"
                            >
                              {upcomingReviewsCount}
                            </span>
                          )}
                          {overdueReviewsCount > 0 && (
                            <span
                              className="min-w-[20px] h-5 flex items-center justify-center rounded-full text-xs font-bold"
                              style={{ background: 'var(--color-danger)', color: '#fff', fontSize: '10px', padding: '0 5px' }}
                              data-testid="overdue-reviews-badge"
                              title="Bilans en retard"
                            >
                              {overdueReviewsCount}
                            </span>
                          )}
                        </div>
                      )}
                      {collapsed && showBadge && (
                        <span
                          className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full"
                          style={{ background: 'var(--color-accent)' }}
                        />
                      )}
                      {collapsed && showLateBadge && (
                        <span
                          className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full"
                          style={{ background: 'var(--color-danger)' }}
                        />
                      )}
                      {collapsed && showReviewBadges && overdueReviewsCount > 0 && (
                        <span
                          className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full"
                          style={{ background: 'var(--color-danger)' }}
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User section */}
        <div className="p-3" style={{ borderTop: '1px solid var(--color-border)' }}>
          {!collapsed && user && (
            <div className="mb-3 px-2">
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }} className="truncate">{user.email}</p>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', fontWeight: 'var(--font-medium)' }} className="truncate">{user.club_name}</p>
              {user.role === "super_admin" && (
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 'var(--font-bold)',
                    color: 'var(--color-accent)',
                    background: 'var(--color-accent-subtle)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)',
                    display: 'inline-block',
                    marginTop: '4px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                  data-testid="super-admin-badge"
                >
                  Super Admin
                </span>
              )}
            </div>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2 w-full tf-sidebar-item"
            style={{ color: 'var(--color-text-tertiary)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-danger)'; e.currentTarget.style.background = 'rgba(255,69,58,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}
            data-testid="logout-btn"
          >
            <LogOut size={16} />
            {!collapsed && (
              <span style={{ fontSize: 'var(--text-sm)' }}>{lang === "fr" ? "Deconnexion" : "Logout"}</span>
            )}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 flex items-center justify-between px-6 sticky top-0 z-10" style={{ borderBottom: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
          <div className="flex items-center gap-4">
            {/* Club Selector - Super Admin only */}
            {isSuperAdmin && clubs.length > 1 && (
              <Select value={activeClubId || ""} onValueChange={switchClub}>
                <SelectTrigger
                  className="w-56 h-9 tf-input"
                  data-testid="club-selector"
                >
                  <Building2 size={14} className="mr-2" style={{ color: 'var(--color-accent)' }} />
                  <SelectValue placeholder="Sélectionner un club" />
                </SelectTrigger>
                <SelectContent style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                  {clubs.map((club) => (
                    <SelectItem
                      key={club.id}
                      value={club.id}
                      className="text-white focus:bg-[rgba(255,255,255,0.1)] focus:text-white"
                      data-testid={`club-option-${club.slug}`}
                    >
                      {club.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {!isSuperAdmin && user && (
              <div className="flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
                <Building2 size={14} />
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }}>{user.club_name}</span>
              </div>
            )}
            {availableMonths && availableMonths.length > 0 && (
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger
                  className="w-48 h-9 tf-input"
                  data-testid="month-selector"
                >
                  <SelectValue placeholder={t("selectMonth")} />
                </SelectTrigger>
                <SelectContent style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                  {availableMonths.map((m) => (
                    <SelectItem
                      key={m.value}
                      value={m.value}
                      className="text-white focus:bg-[rgba(255,255,255,0.1)] focus:text-white"
                    >
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Globe size={15} style={{ color: 'var(--color-text-tertiary)' }} />
            {["fr", "en"].map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                data-testid={`lang-btn-${l}`}
                style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 'var(--font-bold)',
                  textTransform: 'uppercase',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  transition: 'var(--transition-fast)',
                  color: lang === l ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
                  background: lang === l ? 'var(--color-accent-subtle)' : 'transparent',
                }}
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
