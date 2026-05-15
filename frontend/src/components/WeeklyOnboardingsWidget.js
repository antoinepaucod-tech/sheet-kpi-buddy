import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Flame, Users, Trophy } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const BG = "#09090B";
const ACCENT = "#F97316";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT_SECONDARY = "rgba(235,235,245,0.55)";
const TEXT_TERTIARY = "rgba(235,235,245,0.30)";

const fontDisplay = '"Bebas Neue", "Inter", -apple-system, sans-serif';
const fontText = '"DM Sans", "Inter", -apple-system, sans-serif';

function formatRange(startISO, endISO) {
  if (!startISO || !endISO) return "";
  try {
    const s = parseISO(startISO);
    const e = parseISO(endISO);
    const sFmt = format(s, "d MMM", { locale: fr });
    const eFmt = format(e, "d MMM yyyy", { locale: fr });
    return `${sFmt} – ${eFmt}`;
  } catch {
    return `${startISO} → ${endISO}`;
  }
}

export function WeeklyOnboardingsWidget() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["onboarding", "weekly-stats"],
    queryFn: () => axios.get(`${API}/onboarding/stats/weekly`).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div
        className="rounded-xl p-5"
        style={{ background: BG, border: `1px solid ${BORDER}`, fontFamily: fontText }}
        data-testid="weekly-onboardings-widget-loading"
      >
        <p style={{ color: TEXT_TERTIARY, fontSize: 13 }}>Chargement des stats hebdo...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div
        className="rounded-xl p-5"
        style={{ background: BG, border: `1px solid ${BORDER}`, fontFamily: fontText }}
        data-testid="weekly-onboardings-widget-error"
      >
        <p style={{ color: "#FF453A", fontSize: 13 }}>
          Impossible de charger les statistiques d'onboarding de la semaine.
        </p>
      </div>
    );
  }

  const { iso_week, iso_year, start_date, end_date, total, by_user } = data;
  const list = Array.isArray(by_user) ? by_user : [];
  const top = list[0] || null;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: BG,
        border: `1px solid ${BORDER}`,
        fontFamily: fontText,
      }}
      data-testid="weekly-onboardings-widget"
    >
      {/* Header */}
      <div
        className="px-5 pt-5 pb-4 flex items-end justify-between gap-4 flex-wrap"
        style={{ borderBottom: `1px solid ${BORDER}` }}
      >
        <div>
          <div
            className="flex items-center gap-2 mb-1"
            style={{ color: ACCENT }}
          >
            <Flame size={14} />
            <span
              style={{
                fontFamily: fontText,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              Onboardings de la semaine
            </span>
          </div>
          <h2
            style={{
              fontFamily: fontDisplay,
              fontSize: 36,
              lineHeight: 1,
              color: "#FFFFFF",
              letterSpacing: "0.02em",
              margin: 0,
            }}
            data-testid="weekly-onboardings-title"
          >
            SEMAINE {iso_week} · {iso_year}
          </h2>
          <p
            style={{
              fontFamily: fontText,
              fontSize: 12,
              color: TEXT_SECONDARY,
              marginTop: 6,
            }}
          >
            {formatRange(start_date, end_date)} · Europe/Zurich
          </p>
        </div>

        <div className="flex items-stretch gap-3">
          <div
            className="rounded-lg px-4 py-3 flex items-center gap-3"
            style={{
              background: "rgba(249,115,22,0.08)",
              border: `1px solid ${ACCENT}33`,
              minWidth: 120,
            }}
          >
            <Users size={18} style={{ color: ACCENT }} />
            <div>
              <p
                style={{
                  fontFamily: fontText,
                  fontSize: 10,
                  color: TEXT_SECONDARY,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  margin: 0,
                }}
              >
                Total
              </p>
              <p
                style={{
                  fontFamily: fontDisplay,
                  fontSize: 32,
                  lineHeight: 1,
                  color: ACCENT,
                  margin: 0,
                }}
                data-testid="weekly-onboardings-total"
              >
                {total}
              </p>
            </div>
          </div>

          {top && top.count > 0 && (
            <div
              className="rounded-lg px-4 py-3 flex items-center gap-3"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${BORDER}`,
                minWidth: 180,
              }}
            >
              <Trophy size={18} style={{ color: "#FFD60A" }} />
              <div className="min-w-0">
                <p
                  style={{
                    fontFamily: fontText,
                    fontSize: 10,
                    color: TEXT_SECONDARY,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    margin: 0,
                  }}
                >
                  Top de la semaine
                </p>
                <p
                  style={{
                    fontFamily: fontText,
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#FFFFFF",
                    margin: "2px 0 0",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: 180,
                  }}
                  data-testid="weekly-onboardings-top-user"
                  title={top.user_name}
                >
                  {top.user_name}{" "}
                  <span style={{ color: ACCENT, fontWeight: 700 }}>· {top.count}</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Body : table */}
      {list.length === 0 ? (
        <div
          className="px-5 py-8 text-center"
          style={{
            fontFamily: fontText,
            fontSize: 13,
            color: TEXT_TERTIARY,
          }}
          data-testid="weekly-onboardings-empty"
        >
          Aucun onboarding complété cette semaine.
        </div>
      ) : (
        <div className="px-5 py-3">
          <table
            className="w-full"
            style={{ fontFamily: fontText, borderCollapse: "collapse" }}
            data-testid="weekly-onboardings-table"
          >
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                <th
                  style={{
                    fontFamily: fontText,
                    textAlign: "left",
                    fontSize: 10,
                    fontWeight: 600,
                    color: TEXT_SECONDARY,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    padding: "10px 8px",
                    width: 40,
                  }}
                >
                  #
                </th>
                <th
                  style={{
                    textAlign: "left",
                    fontSize: 10,
                    fontWeight: 600,
                    color: TEXT_SECONDARY,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    padding: "10px 8px",
                  }}
                >
                  Utilisateur
                </th>
                <th
                  style={{
                    textAlign: "right",
                    fontSize: 10,
                    fontWeight: 600,
                    color: TEXT_SECONDARY,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    padding: "10px 8px",
                  }}
                >
                  Onboardings
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((u, idx) => {
                const isUnknown = !u.user_id;
                const rowColor = isUnknown ? TEXT_TERTIARY : "#FFFFFF";
                const rowTestId = isUnknown
                  ? `weekly-onboardings-row-unknown-${idx}`
                  : `weekly-onboardings-row-${u.user_id}`;
                return (
                  <tr
                    key={u.user_id || `__unknown_${idx}`}
                    style={{ borderBottom: `1px solid ${BORDER}` }}
                    data-testid={rowTestId}
                  >
                    <td
                      style={{
                        padding: "12px 8px",
                        fontSize: 13,
                        color: TEXT_TERTIARY,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {idx + 1}
                    </td>
                    <td
                      style={{
                        padding: "12px 8px",
                        fontSize: 14,
                        fontWeight: 500,
                        color: rowColor,
                        fontStyle: isUnknown ? "italic" : "normal",
                      }}
                    >
                      {u.user_name || "Inconnu"}
                      {isUnknown && (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 10,
                            fontWeight: 600,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: "rgba(255,255,255,0.05)",
                            color: TEXT_TERTIARY,
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                          }}
                        >
                          Sans audit
                        </span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: "12px 8px",
                        textAlign: "right",
                        fontFamily: fontDisplay,
                        fontSize: 22,
                        color: isUnknown ? TEXT_SECONDARY : ACCENT,
                        fontVariantNumeric: "tabular-nums",
                        letterSpacing: "0.02em",
                      }}
                    >
                      {u.count}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default WeeklyOnboardingsWidget;
