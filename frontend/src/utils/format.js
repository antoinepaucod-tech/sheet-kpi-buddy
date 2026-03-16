export const formatCHF = (amount) => {
  if (amount === null || amount === undefined) return "0.00 CHF";
  return new Intl.NumberFormat("fr-CH", {
    style: "currency",
    currency: "CHF",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatPct = (value) => {
  const v = value ?? 0;
  if (Math.abs(v) > 999) return `${v > 0 ? "+" : ""}${Math.round(v)}%`;
  return `${v.toFixed(1)}%`;
};

export const formatNum = (value) =>
  new Intl.NumberFormat("fr-CH").format(value ?? 0);

export const formatMonthLabel = (month, lang = "fr") => {
  if (!month) return "";
  const [year, m] = month.split("-");
  const date = new Date(parseInt(year), parseInt(m) - 1, 1);
  return date.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", {
    month: "short",
    year: "2-digit",
  });
};

export const formatMonthFull = (month, lang = "fr") => {
  if (!month) return "";
  const [year, m] = month.split("-");
  const date = new Date(parseInt(year), parseInt(m) - 1, 1);
  return date.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", {
    month: "long",
    year: "numeric",
  });
};

export const getTrend = (current, previous) => {
  if (!previous || previous === 0) return null;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  return { pct: pct.toFixed(1), up: pct >= 0 };
};
