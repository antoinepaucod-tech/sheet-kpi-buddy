import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "../lib/utils";

export function KPICard({ label, value, trend, vsLabel, icon: Icon, accent = false, className, ...props }) {
  return (
    <div
      {...props}
      className={cn("tf-stat", accent && "accent", className)}
      style={{
        ...(accent ? { borderColor: 'var(--color-accent)', background: 'var(--color-accent-subtle)' } : {}),
        transition: 'var(--transition-fast)',
        overflow: 'hidden',
      }}
    >
      <div className="flex items-start justify-between" style={{ marginBottom: 'var(--space-2)' }}>
        <p className="tf-stat-label leading-tight">
          {label}
        </p>
        {Icon && (
          <Icon
            size={14}
            strokeWidth={1.5}
            style={{ color: accent ? 'var(--color-accent)' : 'var(--color-text-tertiary)', flexShrink: 0 }}
          />
        )}
      </div>
      <p
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(18px, 1.4vw, 26px)',
          fontWeight: 'var(--font-bold)',
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          fontFeatureSettings: '"tnum" 1',
          fontVariantNumeric: 'tabular-nums',
          color: accent ? 'var(--color-accent)' : 'var(--color-text-primary)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </p>
      {trend && (
        <div
          className="flex items-center gap-1"
          style={{
            marginTop: 'var(--space-2)',
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-xs)',
            fontFeatureSettings: '"tnum" 1',
            color: trend.up ? 'var(--color-success)' : 'var(--color-danger)',
          }}
        >
          {trend.up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          <span>{trend.up ? "+" : ""}{trend.pct}%</span>
          {vsLabel && (
            <span style={{ color: 'var(--color-text-tertiary)', marginLeft: '4px' }}>{vsLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
