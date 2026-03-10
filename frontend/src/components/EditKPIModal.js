import { useState } from "react";
import { Pencil, X, Loader2, Save } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useTranslations } from "../hooks/useTranslations";
import { formatMonthFull } from "../utils/format";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MANUAL_FIELDS = [
  { key: "new_members", labelFr: "Nouveaux membres", labelEn: "New members", type: "int" },
  { key: "lost_members", labelFr: "Membres perdus", labelEn: "Lost members", type: "int" },
  { key: "total_members", labelFr: "Total membres", labelEn: "Total members", type: "int" },
  { key: "marketing_spend", labelFr: "Budget marketing (CHF)", labelEn: "Marketing budget (CHF)", type: "float" },
  { key: "ad_spend", labelFr: "Budget pub (CHF)", labelEn: "Ad spend (CHF)", type: "float" },
];

export function EditKPIModal({ open, onClose, kpi, onSaved }) {
  const { t, lang } = useTranslations();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const initForm = () => {
    if (kpi) {
      const f = {};
      MANUAL_FIELDS.forEach((field) => {
        f[field.key] = kpi[field.key] ?? 0;
      });
      setForm(f);
    }
  };

  const handleOpenChange = (isOpen) => {
    if (isOpen) initForm();
    else onClose();
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = { month: kpi.month };
      MANUAL_FIELDS.forEach((field) => {
        payload[field.key] = field.type === "int"
          ? parseInt(form[field.key]) || 0
          : parseFloat(form[field.key]) || 0;
      });
      // Preserve existing financial fields
      payload.revenue_members = kpi.revenue_members;
      payload.revenue_coaching = kpi.revenue_coaching;
      payload.total_revenue = kpi.total_revenue;
      payload.total_expenses = kpi.total_expenses;
      payload.net_profit = kpi.net_profit;
      payload.loyer = kpi.loyer;
      payload.salaires = kpi.salaires;
      payload.utilities = kpi.utilities;
      payload.other_expenses = kpi.other_expenses;

      await axios.post(`${API}/monthly-kpis`, payload);
      await onSaved();
      onClose();
    } catch (e) {
      setError(e.response?.data?.detail || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-[#121214] border-white/10 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl font-extrabold uppercase tracking-tight">
            {lang === "fr" ? "Modifier KPIs" : "Edit KPIs"} — {kpi ? formatMonthFull(kpi.month, lang) : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {MANUAL_FIELDS.map((field) => (
            <div key={field.key} className="flex items-center justify-between gap-4">
              <Label className="text-white/60 text-xs uppercase tracking-wider flex-1">
                {lang === "fr" ? field.labelFr : field.labelEn}
              </Label>
              <Input
                type="number"
                value={form[field.key] ?? 0}
                onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                className="bg-[#1C1C1E] border-white/10 text-white font-mono w-28 text-right"
                data-testid={`edit-kpi-${field.key}`}
              />
            </div>
          ))}
          {error && <p className="text-red-400 text-xs font-mono">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-white/10 text-white/60 hover:text-white hover:bg-white/5"
          >
            {t("cancel")}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-rose-600 hover:bg-rose-700 text-white font-bold uppercase tracking-wider"
            data-testid="edit-kpi-save-btn"
          >
            {saving ? <Loader2 size={12} className="animate-spin mr-1" /> : <Save size={12} className="mr-1" />}
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
