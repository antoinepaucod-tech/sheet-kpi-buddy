import { Badge } from "./ui/badge";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { fr } from "date-fns/locale";

/**
 * RenewalReminderBadge (P3 — 2026-05-16).
 * Mini-badge gris "📧 J-N" affiché à côté du badge EXPIRÉ.
 *
 * Le calcul J-N utilise differenceInCalendarDays en heure locale du
 * navigateur, ce qui correspond à Europe/Zurich pour Antoine. Pas de
 * conversion timezone manuelle nécessaire côté frontend (date-fns
 * compare en local time).
 *
 * Returns null si lastReminderAt est falsy (membre jamais relancé).
 */
export function RenewalReminderBadge({ lastReminderAt, count, testid }) {
  if (!lastReminderAt) return null;
  let lastDate;
  try {
    lastDate = parseISO(lastReminderAt);
  } catch {
    return null;
  }
  const days = differenceInCalendarDays(new Date(), lastDate);
  let label;
  if (days <= 0) {
    label = "📧 Aujourd'hui";
  } else if (days <= 7) {
    label = `📧 J-${days}`;
  } else {
    label = `📧 il y a ${days}j`;
  }

  let formattedDateFr;
  try {
    formattedDateFr = format(lastDate, "EEEE d MMMM yyyy", { locale: fr });
  } catch {
    formattedDateFr = lastReminderAt;
  }
  const safeCount = typeof count === "number" && count > 0 ? count : 1;
  const tooltip = `Relancé ${safeCount} fois · dernière le ${formattedDateFr}`;

  return (
    <Badge
      title={tooltip}
      className="bg-[rgba(156,163,175,0.15)] text-[#9CA3AF] border-0 text-[9px] px-1.5 py-0 font-semibold tracking-wider"
      data-testid={testid}
    >
      {label}
    </Badge>
  );
}
