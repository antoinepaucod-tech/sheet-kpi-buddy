import { Badge } from "./ui/badge";
import { PauseCircle } from "lucide-react";

export function PauseBadge({ from, to, className = "" }) {
  return (
    <Badge
      data-testid="pause-badge"
      className={`bg-[rgba(255,214,10,0.15)] text-[var(--color-warning)] border-0 text-[10px] font-mono inline-flex items-center gap-1 ${className}`}
      title={from ? `En pause du ${from}${to ? ` au ${to}` : ""}` : "En pause"}
    >
      <PauseCircle size={10} />
      EN PAUSE
    </Badge>
  );
}
