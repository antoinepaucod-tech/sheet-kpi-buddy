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
      <DialogContent className="bg-[#121214] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl font-extrabold uppercase tracking-tight">
            {t("addTransaction")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-white/60 text-xs uppercase tracking-wider">
                {t("type")} *
              </Label>
              <Select
                value={form.type}
                onValueChange={(v) => handleChange("type", v)}
              >
                <SelectTrigger
                  className="bg-[#121214] border-white/10 text-white"
                  data-testid="tx-type-select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#121214] border-white/10">
                  <SelectItem value="expense" className="text-white focus:bg-white/10">
                    {t("expense")}
                  </SelectItem>
                  <SelectItem value="revenue" className="text-white focus:bg-white/10">
                    {t("revenueType")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-white/60 text-xs uppercase tracking-wider">
                {t("date")} *
              </Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => handleChange("date", e.target.value)}
                className="bg-[#121214] border-white/10 text-white"
                data-testid="tx-date-input"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-white/60 text-xs uppercase tracking-wider">
              {t("description")} *
            </Label>
            <Input
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="Ex: Loyer janvier"
              className="bg-[#121214] border-white/10 text-white placeholder:text-white/20"
              data-testid="tx-description-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-white/60 text-xs uppercase tracking-wider">
                {t("amount")} (CHF) *
              </Label>
              <Input
                type="number"
                value={form.amount}
                onChange={(e) => handleChange("amount", e.target.value)}
                placeholder="0.00"
                className="bg-[#121214] border-white/10 text-white placeholder:text-white/20 font-mono"
                data-testid="tx-amount-input"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-white/60 text-xs uppercase tracking-wider">
                {t("category")} *
              </Label>
              <Select
                value={form.category}
                onValueChange={(v) => handleChange("category", v)}
              >
                <SelectTrigger
                  className="bg-[#121214] border-white/10 text-white"
                  data-testid="tx-category-select"
                >
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent className="bg-[#121214] border-white/10">
                  {filteredCategories.map((cat) => (
                    <SelectItem
                      key={cat.id}
                      value={cat.name}
                      className="text-white focus:bg-white/10"
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
              <Label className="text-white/60 text-xs uppercase tracking-wider">
                {t("subType")}
              </Label>
              <Select
                value={form.sub_type}
                onValueChange={(v) => handleChange("sub_type", v)}
              >
                <SelectTrigger
                  className="bg-[#121214] border-white/10 text-white"
                  data-testid="tx-subtype-select"
                >
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent className="bg-[#121214] border-white/10">
                  <SelectItem value="members" className="text-white focus:bg-white/10">
                    {t("membersType")}
                  </SelectItem>
                  <SelectItem value="coaching" className="text-white focus:bg-white/10">
                    {t("coachingType")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {error && (
            <p className="text-red-400 text-sm font-mono" data-testid="tx-error">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-white/10 text-white/60 hover:text-white hover:bg-white/5"
            data-testid="tx-cancel-btn"
          >
            {t("cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-rose-600 hover:bg-rose-700 text-white font-bold uppercase tracking-wider"
            data-testid="tx-save-btn"
          >
            {saving ? t("saving") || "..." : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
