import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "../lib/utils";

export function KPICard({ label, value, trend, vsLabel, icon: Icon, accent = false, className, ...props }) {
  return (
    <div
      {...props}
      className={cn(
        "bg-[#121214] border border-white/10 p-5 rounded-sm hover:border-white/20 transition-colors",
        accent && "border-rose-600/30 bg-rose-600/5",
        className
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-body text-white/50 uppercase tracking-wider leading-tight">
          {label}
        </p>
        {Icon && (
          <Icon
            size={16}
            strokeWidth={1.5}
            className={cn("text-white/20 flex-shrink-0", accent && "text-rose-500/50")}
          />
        )}
      </div>
      <p
        className={cn(
          "text-3xl font-heading font-extrabold text-white tracking-tight",
          accent && "text-rose-500"
        )}
      >
        {value}
      </p>
      {trend && (
        <div
          className={cn(
            "flex items-center gap-1 mt-2 text-xs font-mono",
            trend.up ? "text-green-400" : "text-red-400"
          )}
        >
          {trend.up ? (
            <TrendingUp size={11} />
          ) : (
            <TrendingDown size={11} />
          )}
          <span>
            {trend.up ? "+" : ""}
            {trend.pct}%
          </span>
          {vsLabel && (
            <span className="text-white/25 ml-1">{vsLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
