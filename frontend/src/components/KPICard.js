import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "../lib/utils";

export function KPICard({ label, value, trend, vsLabel, icon: Icon, accent = false, className, ...props }) {
  return (
    <div
      {...props}
      className={cn("tf-stat", accent && "accent", className)}
      style={{
        ...(accent ? { borderColor: 'var(--color-accent)', background: 'var(--color-accent-subtle)' } : {}),
      }}
    >
      <div className="flex items-start justify-between mb-1">
        <p className="tf-stat-label leading-tight">{label}</p>
        {Icon && (
          <Icon size={14} strokeWidth={1.5} style={{ color: accent ? 'var(--color-accent)' : 'var(--color-text-tertiary)', flexShrink: 0 }} />
        )}
      </div>
      <p className="tf-kpi-value" style={{ color: accent ? 'var(--color-accent)' : undefined }}>
        {value}
      </p>
      {trend && (
        <div className="flex items-center gap-1 mt-1" style={{ fontSize: '11px', fontFeatureSettings: '"tnum" 1', color: trend.up ? 'var(--color-success)' : 'var(--color-danger)' }}>
          {trend.up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          <span>{trend.up ? "+" : ""}{trend.pct}%</span>
          {vsLabel && <span style={{ color: 'var(--color-text-tertiary)', marginLeft: '3px' }}>{vsLabel}</span>}
        </div>
      )}
    </div>
  );
}
