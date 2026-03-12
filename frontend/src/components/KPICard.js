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
      }}
    >
      <div className="flex items-start justify-between" style={{ marginBottom: 'var(--space-3)' }}>
        <p className="tf-stat-label leading-tight">
          {label}
        </p>
        {Icon && (
          <Icon
            size={16}
            strokeWidth={1.5}
            style={{ color: accent ? 'var(--color-accent)' : 'var(--color-text-tertiary)', flexShrink: 0 }}
          />
        )}
      </div>
      <p
        className="font-mono"
        style={{
          fontSize: 'var(--text-2xl)',
          fontWeight: 'var(--font-bold)',
          color: accent ? 'var(--color-accent)' : 'var(--color-text-primary)',
        }}
      >
        {value}
      </p>
      {trend && (
        <div
          className="flex items-center gap-1 font-mono"
          style={{
            marginTop: 'var(--space-2)',
            fontSize: 'var(--text-xs)',
            color: trend.up ? 'var(--color-success)' : 'var(--color-danger)',
          }}
        >
          {trend.up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          <span>{trend.up ? "+" : ""}{trend.pct}%</span>
          {vsLabel && (
            <span style={{ color: 'var(--color-text-tertiary)', marginLeft: '4px' }}>{vsLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
