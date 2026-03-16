import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, Save, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../components/ui/button";
import { useToast } from "../hooks/use-toast";
import { Toaster } from "../components/ui/toaster";
import { formatCHF } from "../utils/format";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MONTHS = [
  { num: 1, label: "Jan" }, { num: 2, label: "Fév" }, { num: 3, label: "Mar" },
  { num: 4, label: "Avr" }, { num: 5, label: "Mai" }, { num: 6, label: "Jun" },
  { num: 7, label: "Jul" }, { num: 8, label: "Aoû" }, { num: 9, label: "Sep" },
  { num: 10, label: "Oct" }, { num: 11, label: "Nov" }, { num: 12, label: "Déc" },
];

function EditableCell({ value, onSave, isEditing, onStartEdit }) {
  const [val, setVal] = useState(value || 0);
  const inputRef = useRef(null);

  useEffect(() => { setVal(value || 0); }, [value]);
  useEffect(() => { if (isEditing && inputRef.current) inputRef.current.focus(); }, [isEditing]);

  const handleSave = () => {
    const num = parseFloat(val) || 0;
    if (num !== (value || 0)) onSave(num);
  };

  if (!isEditing) {
    return (
      <div
        className="px-2 py-1.5 text-right cursor-pointer hover:bg-[var(--color-bg-tertiary)] rounded transition-colors min-w-[70px] text-xs tabular-nums"
        onClick={onStartEdit}
        data-testid="editable-cell"
      >
        {value ? value.toLocaleString("fr-CH", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : <span className="text-[var(--color-text-tertiary)]">-</span>}
      </div>
    );
  }

  return (
    <input
      ref={inputRef}
      type="number"
      step="0.01"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={handleSave}
      onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onStartEdit(null); }}
      className="w-full bg-[var(--color-bg-primary)] border border-[var(--color-accent)] rounded px-2 py-1 text-right text-xs text-[var(--color-text-primary)] outline-none min-w-[70px]"
      data-testid="editable-cell-input"
    />
  );
}

export default function MonthlyBudgetPage() {
  const { toast } = useToast();
  const [year, setYear] = useState(new Date().getFullYear());
  const [tab, setTab] = useState("expense");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState(null); // "catId-month"
  const [saving, setSaving] = useState(false);

  const fetchGrid = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/transactions/monthly-grid?year=${year}&type=${tab}`);
      setData(res.data);
    } catch (e) {
      console.error("Error fetching grid", e);
    } finally {
      setLoading(false);
    }
  }, [year, tab]);

  useEffect(() => { fetchGrid(); }, [fetchGrid]);

  const handleSave = async (category, month, amount) => {
    setSaving(true);
    try {
      await axios.put(`${API}/transactions/update-monthly-amount`, {
        category, year, month, amount,
      });
      toast({ title: "Montant mis à jour", description: `${category} - ${MONTHS[month - 1].label} ${year}` });
      setEditingCell(null);
      await fetchGrid();
    } catch (e) {
      toast({ title: "Erreur", description: "Impossible de sauvegarder", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const grandTotal = data.reduce((s, d) => s + d.year_total, 0);
  const monthTotals = {};
  for (const m of MONTHS) {
    monthTotals[m.num] = data.reduce((s, d) => s + (d.months[String(m.num)] || 0), 0);
  }

  return (
    <div className="space-y-4" data-testid="monthly-budget-page">
      <Toaster />

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="tf-page-header">Budget Mensuel</h1>
        <div className="flex items-center gap-3">
          {saving && <Loader2 className="animate-spin text-[var(--color-accent)]" size={16} />}
          <div className="flex items-center gap-1.5 bg-[var(--color-bg-secondary)] rounded-lg px-2 py-1 border border-[var(--color-border)]">
            <Button variant="ghost" size="sm" onClick={() => setYear(y => y - 1)} className="h-7 w-7 p-0 text-[var(--color-text-secondary)]" data-testid="prev-year-btn">
              <ChevronLeft size={14} />
            </Button>
            <span className="text-sm font-bold text-[var(--color-text-primary)] min-w-[48px] text-center" data-testid="current-year">{year}</span>
            <Button variant="ghost" size="sm" onClick={() => setYear(y => y + 1)} className="h-7 w-7 p-0 text-[var(--color-text-secondary)]" data-testid="next-year-btn">
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2" data-testid="budget-tabs">
        <Button
          onClick={() => setTab("expense")}
          variant={tab === "expense" ? "default" : "outline"}
          className={tab === "expense"
            ? "bg-[var(--color-accent)] text-white font-bold uppercase tracking-wider text-xs"
            : "border-[var(--color-border)] text-[var(--color-text-secondary)] text-xs"}
          data-testid="tab-expense"
        >
          Dépenses
        </Button>
        <Button
          onClick={() => setTab("revenue")}
          variant={tab === "revenue" ? "default" : "outline"}
          className={tab === "revenue"
            ? "bg-[var(--color-accent)] text-white font-bold uppercase tracking-wider text-xs"
            : "border-[var(--color-border)] text-[var(--color-text-secondary)] text-xs"}
          data-testid="tab-revenue"
        >
          Revenus
        </Button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-[var(--color-accent)]" size={24} />
        </div>
      ) : (
        <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs" data-testid="budget-grid">
              <thead>
                <tr className="bg-[var(--color-bg-tertiary)] border-b border-[var(--color-border)]">
                  <th className="text-left px-3 py-2.5 font-semibold text-[var(--color-text-secondary)] sticky left-0 bg-[var(--color-bg-tertiary)] z-10 min-w-[200px]">
                    Catégorie
                  </th>
                  {MONTHS.map((m) => (
                    <th key={m.num} className="text-right px-2 py-2.5 font-semibold text-[var(--color-text-secondary)] min-w-[80px]">
                      {m.label}
                    </th>
                  ))}
                  <th className="text-right px-3 py-2.5 font-bold text-[var(--color-text-primary)] min-w-[90px] bg-[var(--color-bg-tertiary)]">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] transition-colors"
                    data-testid={`budget-row-${row.category}`}
                  >
                    <td className="px-3 py-1.5 text-[var(--color-text-primary)] font-medium sticky left-0 bg-[var(--color-bg-primary)] z-10 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[180px]" title={row.category}>{row.category}</span>
                        {row.is_recurring && (
                          <span className="text-[8px] px-1 py-0.5 rounded bg-[var(--color-accent)]/20 text-[var(--color-accent)] font-semibold">REC</span>
                        )}
                      </div>
                    </td>
                    {MONTHS.map((m) => {
                      const cellKey = `${row.id}-${m.num}`;
                      return (
                        <td key={m.num} className="px-0 py-0">
                          <EditableCell
                            value={row.months[String(m.num)]}
                            isEditing={editingCell === cellKey}
                            onStartEdit={() => setEditingCell(cellKey)}
                            onSave={(amount) => handleSave(row.category, m.num, amount)}
                          />
                        </td>
                      );
                    })}
                    <td className="px-3 py-1.5 text-right font-bold text-[var(--color-text-primary)] tabular-nums bg-[var(--color-bg-secondary)]/50">
                      {row.year_total.toLocaleString("fr-CH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="bg-[var(--color-bg-tertiary)] border-t-2 border-[var(--color-accent)]/30">
                  <td className="px-3 py-2.5 font-bold text-[var(--color-text-primary)] sticky left-0 bg-[var(--color-bg-tertiary)] z-10">
                    TOTAL
                  </td>
                  {MONTHS.map((m) => (
                    <td key={m.num} className="px-2 py-2.5 text-right font-bold text-[var(--color-text-primary)] tabular-nums">
                      {(monthTotals[m.num] || 0).toLocaleString("fr-CH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-right font-bold text-[var(--color-accent)] tabular-nums text-sm">
                    {grandTotal.toLocaleString("fr-CH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-[var(--color-text-tertiary)] text-xs">
        Cliquez sur un montant pour le modifier. Les KPIs seront automatiquement recalculés.
      </p>
    </div>
  );
}
