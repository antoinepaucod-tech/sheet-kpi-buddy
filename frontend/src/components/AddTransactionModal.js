import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { useTranslations } from "../hooks/useTranslations";

const EMPTY = {
  date: new Date().toISOString().split("T")[0],
  description: "",
  amount: "",
  type: "expense",
  category: "",
  sub_type: "",
  is_recurring: false,
  recurrence_day: 1,
};

export function AddTransactionModal({ open, onClose, onSave, categories }) {
  const { t } = useTranslations();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const expenseCategories = categories.filter((c) => c.type === "expense");
  const revenueCategories = categories.filter((c) => c.type === "revenue");
  const filteredCategories =
    form.type === "expense" ? expenseCategories : revenueCategories;

  const handleChange = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "type") {
        next.category = "";
        next.sub_type = "";
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!form.date || !form.description || !form.amount || !form.category) {
      setError("Veuillez remplir tous les champs obligatoires");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        ...form,
        amount: parseFloat(form.amount),
        sub_type: form.sub_type || null,
        is_recurring: form.is_recurring || false,
        recurrence_day: form.is_recurring ? (form.recurrence_day || 1) : undefined,
      });
      setForm(EMPTY);
      onClose();
    } catch (e) {
      setError(e.response?.data?.detail || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold uppercase tracking-tight">
            {t("addTransaction")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[var(--color-text-secondary)] text-xs uppercase tracking-wider">
                {t("type")} *
              </Label>
              <Select
                value={form.type}
                onValueChange={(v) => handleChange("type", v)}
              >
                <SelectTrigger
                  className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white"
                  data-testid="tx-type-select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
                  <SelectItem value="expense" className="text-white focus:bg-[rgba(255,255,255,0.1)]">
                    {t("expense")}
                  </SelectItem>
                  <SelectItem value="revenue" className="text-white focus:bg-[rgba(255,255,255,0.1)]">
                    {t("revenueType")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[var(--color-text-secondary)] text-xs uppercase tracking-wider">
                {t("date")} *
              </Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => handleChange("date", e.target.value)}
                className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white"
                data-testid="tx-date-input"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[var(--color-text-secondary)] text-xs uppercase tracking-wider">
              {t("description")} *
            </Label>
            <Input
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="Ex: Loyer janvier"
              className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white placeholder:text-[var(--color-text-tertiary)]"
              data-testid="tx-description-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[var(--color-text-secondary)] text-xs uppercase tracking-wider">
                {t("amount")} (CHF) *
              </Label>
              <Input
                type="number"
                value={form.amount}
                onChange={(e) => handleChange("amount", e.target.value)}
                placeholder="0.00"
                className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white placeholder:text-[var(--color-text-tertiary)] font-mono"
                data-testid="tx-amount-input"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[var(--color-text-secondary)] text-xs uppercase tracking-wider">
                {t("category")} *
              </Label>
              <Select
                value={form.category}
                onValueChange={(v) => handleChange("category", v)}
              >
                <SelectTrigger
                  className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white"
                  data-testid="tx-category-select"
                >
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
                  {filteredCategories.map((cat) => (
                    <SelectItem
                      key={cat.id}
                      value={cat.name}
                      className="text-white focus:bg-[rgba(255,255,255,0.1)]"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        {cat.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.type === "revenue" && (
            <div className="space-y-1.5">
              <Label className="text-[var(--color-text-secondary)] text-xs uppercase tracking-wider">
                {t("subType")}
              </Label>
              <Select
                value={form.sub_type}
                onValueChange={(v) => handleChange("sub_type", v)}
              >
                <SelectTrigger
                  className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white"
                  data-testid="tx-subtype-select"
                >
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
                  <SelectItem value="members" className="text-white focus:bg-[rgba(255,255,255,0.1)]">
                    {t("membersType")}
                  </SelectItem>
                  <SelectItem value="coaching" className="text-white focus:bg-[rgba(255,255,255,0.1)]">
                    {t("coachingType")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Recurring toggle */}
          <div className="flex items-center justify-between p-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-[var(--radius-lg)]">
            <div>
              <Label className="text-white text-sm font-display font-bold">
                {form.type === "expense" ? "Dépense récurrente" : "Revenu récurrent"}
              </Label>
              <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">
                Créer un modèle récurrent pour cette transaction
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleChange("is_recurring", !form.is_recurring)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.is_recurring ? 'bg-[var(--color-accent)]' : 'bg-[rgba(255,255,255,0.15)]'}`}
              data-testid="tx-recurring-toggle"
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${form.is_recurring ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {form.is_recurring && (
            <div className="space-y-1.5">
              <Label className="text-[var(--color-text-secondary)] text-xs uppercase tracking-wider">
                Jour de récurrence
              </Label>
              <Select
                value={(form.recurrence_day || 1).toString()}
                onValueChange={(v) => handleChange("recurrence_day", parseInt(v))}
              >
                <SelectTrigger
                  className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white"
                  data-testid="tx-recurrence-day-select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] max-h-48">
                  {Array.from({length: 28}, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={d.toString()} className="text-white focus:bg-[rgba(255,255,255,0.1)]">
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {error && (
            <p className="text-[var(--color-danger)] text-sm font-mono" data-testid="tx-error">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]"
            data-testid="tx-cancel-btn"
          >
            {t("cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-[var(--color-accent)] hover:opacity-85 text-white font-bold uppercase tracking-wider"
            data-testid="tx-save-btn"
          >
            {saving ? t("saving") || "..." : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
