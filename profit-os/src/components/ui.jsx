import { useTranslation } from 'react-i18next'

export function Card({ children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-line bg-card p-4 ${className}`}>{children}</div>
  )
}

export function SectionTitle({ children }) {
  return (
    <h2 className="font-display text-2xl uppercase tracking-wide text-white/90">{children}</h2>
  )
}

export function KpiCard({ label, value, sub, tone }) {
  const toneClass =
    tone === 'pos' ? 'text-pos' : tone === 'neg' ? 'text-neg' : tone === 'accent' ? 'text-accent' : 'text-white'
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wider text-muted">{label}</span>
      <span className={`num text-xl font-semibold ${toneClass}`}>{value}</span>
      {sub ? <span className="num text-xs text-muted">{sub}</span> : null}
    </Card>
  )
}

export function NumField({ label, value, onChange, hint, disabled, step = 1, placeholder }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-white/80">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={value ?? ''}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === '' ? '' : e.target.value)}
        className="num rounded-xl border border-line bg-card2 px-3 py-2.5 text-base text-white outline-none focus:border-accent disabled:opacity-50"
      />
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </label>
  )
}

export function SliderField({ label, value, onChange, min, max, step = 1, format, disabled }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-white/80">{label}</span>
        <span className="num text-sm font-semibold text-accent">
          {format ? format(Number(value) || 0) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={Number(value) || 0}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

export function ClubSelect({ clubs, value, onChange, allowAll = false }) {
  const { t } = useTranslation()
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-full rounded-xl border border-line bg-card2 px-3 py-2.5 text-base text-white outline-none focus:border-accent"
    >
      {allowAll ? <option value="">{t('common.allClubs')}</option> : null}
      {(clubs ?? []).map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  )
}

export function MonthPicker({ value, onChange }) {
  return (
    <input
      type="month"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="num w-full rounded-xl border border-line bg-card2 px-3 py-2.5 text-base text-white outline-none focus:border-accent"
    />
  )
}

export function Button({ children, onClick, variant = 'primary', disabled, type = 'button', className = '' }) {
  const styles =
    variant === 'primary'
      ? 'bg-accent text-black font-semibold hover:bg-accent/90'
      : variant === 'danger'
        ? 'bg-neg/15 text-neg border border-neg/30'
        : 'bg-card2 text-white border border-line hover:border-accent/50'
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-4 py-2.5 text-sm transition disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  )
}

export function Spinner() {
  const { t } = useTranslation()
  return <div className="py-12 text-center text-sm text-muted">{t('common.loading')}</div>
}
