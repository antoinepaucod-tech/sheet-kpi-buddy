import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useMyRole } from '../hooks/useData'

const tabs = [
  { to: '/', key: 'dashboard', icon: GroupIcon },
  { to: '/clubs', key: 'clubs', icon: ClubIcon },
  { to: '/entry', key: 'entry', icon: EntryIcon },
  { to: '/simulator', key: 'simulator', icon: SimIcon },
  { to: '/investor', key: 'investor', icon: InvestorIcon },
  { to: '/settings', key: 'settings', icon: GearIcon },
]

export default function Layout() {
  const { t } = useTranslation()
  const { data: role } = useMyRole()

  return (
    <div className="mx-auto min-h-screen max-w-3xl">
      <header className="flex items-center justify-between px-4 pb-2 pt-[calc(env(safe-area-inset-top,0px)+1rem)]">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-3xl text-accent">PROFIT OS</span>
          {role === 'viewer' ? (
            <span className="rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted">
              {t('auth.readonly')}
            </span>
          ) : null}
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-xs text-muted underline-offset-2 hover:text-white hover:underline"
        >
          {t('auth.logout')}
        </button>
      </header>

      <main className="safe-bottom px-4">
        <Outlet />
      </main>

      <nav className="nav-safe fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl">
          {tabs.map(({ to, key, icon: Icon }) => (
            <NavLink
              key={key}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium uppercase tracking-wide ${
                  isActive ? 'text-accent' : 'text-muted'
                }`
              }
            >
              <Icon />
              {t(`nav.${key}`)}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

const ic = { width: 22, height: 22, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }

function GroupIcon() {
  return (
    <svg {...ic} viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}
function ClubIcon() {
  return (
    <svg {...ic} viewBox="0 0 24 24">
      <path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" />
    </svg>
  )
}
function EntryIcon() {
  return (
    <svg {...ic} viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
function SimIcon() {
  return (
    <svg {...ic} viewBox="0 0 24 24">
      <path d="M4 21V14M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" />
      <path d="M2 14h4M10 8h4M18 16h4" />
    </svg>
  )
}
function InvestorIcon() {
  return (
    <svg {...ic} viewBox="0 0 24 24">
      <path d="M3 17l5-6 4 3 6-8" />
      <path d="M15 6h3v3" />
      <path d="M3 21h18" />
    </svg>
  )
}
function GearIcon() {
  return (
    <svg {...ic} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.09a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z" />
    </svg>
  )
}
