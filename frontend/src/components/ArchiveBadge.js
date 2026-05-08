import { Archive } from "lucide-react";
import { Badge } from "./ui/badge";

/**
 * Visual badge displayed on archived entity rows / cards.
 */
export function ArchiveBadge({ className = "", size = "sm" }) {
  return (
    <Badge
      data-testid="archived-badge"
      className={`bg-[rgba(255,255,255,0.08)] text-[var(--color-text-tertiary)] border border-[var(--color-border)] gap-1 ${className}`}
    >
      <Archive size={size === "sm" ? 11 : 13} strokeWidth={1.8} />
      <span style={{ fontSize: "10px", letterSpacing: "0.04em" }}>ARCHIVÉ</span>
    </Badge>
  );
}
