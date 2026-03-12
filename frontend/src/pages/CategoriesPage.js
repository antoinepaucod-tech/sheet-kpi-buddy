import { useState, useEffect } from "react";
import { Palette, Plus, Trash2, Loader2, Settings } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { useAccountingTransactions } from "../hooks/useAccountingTransactions";
import { useTranslations } from "../hooks/useTranslations";
import { useToast } from "../hooks/use-toast";
import { Toaster } from "../components/ui/toaster";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CATEGORY_COLORS = [
  "#E11D48", "#3B82F6", "#8B5CF6", "#22C55E", "#10B981",
  "#F59E0B", "#EC4899", "#F97316", "#6B7280", "#FACC15",
  "#06B6D4", "#84CC16",
];

// Default KPI columns + ability to add custom ones
const DEFAULT_KPI_COLUMNS = [
  { value: "loyer", label: "Loyer", type: "expense" },
  { value: "salaires", label: "Salaires", type: "expense" },
  { value: "salaires_coachs", label: "Salaires Coachs", type: "expense" },
  { value: "utilities", label: "Charges (eau, électricité)", type: "expense" },
  { value: "marketing_spend", label: "Marketing", type: "expense" },
  { value: "ad_spend", label: "Publicité", type: "expense" },
  { value: "assurance", label: "Assurance", type: "expense" },
  { value: "equipement", label: "Équipement", type: "expense" },
  { value: "entretien", label: "Entretien", type: "expense" },
  { value: "abonnements", label: "Abonnements (logiciels)", type: "expense" },
  { value: "other_expenses", label: "Autres dépenses", type: "expense" },
  { value: "revenue_members", label: "Revenus Membres", type: "revenue" },
  { value: "revenue_coaching", label: "Revenus Coaching", type: "revenue" },
  { value: "revenue_challenges", label: "Revenus Challenges", type: "revenue" },
  { value: "revenue_products", label: "Ventes Produits", type: "revenue" },
  { value: "other_revenue", label: "Autres revenus", type: "revenue" },
];

const EMPTY_FORM = { name: "", kpi_column: "other_expenses", type: "expense", color: "#3B82F6" };
const EMPTY_KPI_FORM = { value: "", label: "", type: "expense" };

export default function CategoriesPage() {
  const { t } = useTranslations();
  const { toast } = useToast();
  const { categories, refetch } = useAccountingTransactions(null);
  const [showModal, setShowModal] = useState(false);
  const [showKpiModal, setShowKpiModal] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [kpiForm, setKpiForm] = useState(EMPTY_KPI_FORM);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [customKpiColumns, setCustomKpiColumns] = useState([]);

  // Load custom KPI columns from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("custom_kpi_columns");
    if (saved) {
      try {
        setCustomKpiColumns(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  // All KPI columns (default + custom)
  const allKpiColumns = [...DEFAULT_KPI_COLUMNS, ...customKpiColumns];
  const expenseKpiColumns = allKpiColumns.filter(c => c.type === "expense");
  const revenueKpiColumns = allKpiColumns.filter(c => c.type === "revenue");

  const handleSave = async () => {
    if (!form.name || !form.kpi_column || !form.type) return;
    setSaving(true);
    try {
      await axios.post(`${API}/categories`, form);
      await refetch();
      setShowModal(false);
      setForm(EMPTY_FORM);
      toast({ title: "Catégorie créée", description: `"${form.name}" ajoutée avec succès` });
    } catch (e) {
      toast({ title: "Erreur", description: e.response?.data?.detail || "Erreur serveur", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await axios.delete(`${API}/categories/${deleteId}`);
      await refetch();
      setDeleteId(null);
      toast({ title: "Catégorie supprimée" });
    } catch (e) {
      toast({ title: "Erreur", description: e.response?.data?.detail || "Impossible de supprimer", variant: "destructive" });
    }
  };

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const res = await axios.post(`${API}/monthly-kpis/recalculate-all`);
      toast({ title: "KPIs recalculés", description: `${res.data.recalculated} mois mis à jour depuis les transactions` });
    } catch (e) {
      toast({ title: "Erreur", description: "Recalcul échoué", variant: "destructive" });
    } finally {
      setRecalculating(false);
    }
  };

  const handleAddKpiColumn = () => {
    if (!kpiForm.value || !kpiForm.label) return;
    const newColumn = {
      value: kpiForm.value.toLowerCase().replace(/\s+/g, "_"),
      label: kpiForm.label,
      type: kpiForm.type,
      custom: true,
    };
    const updated = [...customKpiColumns, newColumn];
    setCustomKpiColumns(updated);
    localStorage.setItem("custom_kpi_columns", JSON.stringify(updated));
    setKpiForm(EMPTY_KPI_FORM);
    setShowKpiModal(false);
    toast({ title: "Colonne KPI ajoutée", description: `"${kpiForm.label}" disponible pour les catégories` });
  };

  const handleDeleteKpiColumn = (value) => {
    const updated = customKpiColumns.filter(c => c.value !== value);
    setCustomKpiColumns(updated);
    localStorage.setItem("custom_kpi_columns", JSON.stringify(updated));
    toast({ title: "Colonne KPI supprimée" });
  };

  const expenseCategories = categories.filter((c) => c.type === "expense");
  const revenueCategories = categories.filter((c) => c.type === "revenue");

  return (
    <div className="space-y-6" data-testid="categories-page">
      <Toaster />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="tf-page-header">
            {t("categories")}
          </h1>
          <p className="tf-page-subtitle">
            {categories.length} catégorie{categories.length !== 1 ? "s" : ""} · {allKpiColumns.length} colonnes KPI
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowKpiModal(true)}
            className="border-[var(--color-border)] text-white/60 hover:text-white hover:bg-[var(--color-bg-tertiary)] text-xs"
            data-testid="add-kpi-column-btn"
          >
            <Plus size={12} className="mr-1.5" />
            Colonne KPI
          </Button>
          <Button
            variant="outline"
            onClick={handleRecalculate}
            disabled={recalculating}
            className="border-[var(--color-border)] text-white/60 hover:text-white hover:bg-[var(--color-bg-tertiary)] text-xs"
            data-testid="recalculate-btn"
          >
            {recalculating ? <Loader2 size={12} className="animate-spin mr-1.5" /> : null}
            {recalculating ? "Recalcul..." : "Recalculer les KPIs"}
          </Button>
          <Button
            onClick={() => setShowModal(true)}
            className="bg-[var(--color-accent)] hover:opacity-85 text-white font-bold uppercase tracking-wider text-xs"
            data-testid="add-category-btn"
          >
            <Plus size={14} className="mr-1.5" />
            Catégorie
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense categories */}
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-[var(--radius-lg)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--color-border)]">
            <p className="text-xs font-text text-[var(--color-text-secondary)] uppercase tracking-wider">
              Dépenses · {expenseCategories.length}
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--color-border)] hover:bg-transparent">
                <TableHead className="text-[var(--color-text-tertiary)] uppercase text-xs">Nom</TableHead>
                <TableHead className="text-[var(--color-text-tertiary)] uppercase text-xs">Colonne KPI</TableHead>
                <TableHead className="text-[var(--color-text-tertiary)] uppercase text-xs w-16">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenseCategories.map((cat) => (
                <TableRow key={cat.id} className="border-white/5 hover:bg-white/3" data-testid={`cat-row-${cat.id}`}>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-[var(--radius-lg)] flex-shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="font-mono text-sm text-white">{cat.name}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-[var(--color-text-secondary)] text-xs font-mono">{cat.kpi_column}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => setDeleteId(cat.id)}
                      className="text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] transition-colors"
                      data-testid={`delete-cat-${cat.id}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Revenue categories */}
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-[var(--radius-lg)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--color-border)]">
            <p className="text-xs font-text text-[var(--color-text-secondary)] uppercase tracking-wider">
              Revenus · {revenueCategories.length}
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--color-border)] hover:bg-transparent">
                <TableHead className="text-[var(--color-text-tertiary)] uppercase text-xs">Nom</TableHead>
                <TableHead className="text-[var(--color-text-tertiary)] uppercase text-xs">Colonne KPI</TableHead>
                <TableHead className="text-[var(--color-text-tertiary)] uppercase text-xs w-16">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {revenueCategories.map((cat) => (
                <TableRow key={cat.id} className="border-white/5 hover:bg-white/3" data-testid={`cat-row-${cat.id}`}>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-[var(--radius-lg)] flex-shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="font-mono text-sm text-white">{cat.name}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-[var(--color-text-secondary)] text-xs font-mono">{cat.kpi_column}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => setDeleteId(cat.id)}
                      className="text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] transition-colors"
                      data-testid={`delete-cat-${cat.id}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Add Category Modal */}
      <Dialog open={showModal} onOpenChange={(v) => !v && setShowModal(false)}>
        <DialogContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-extrabold uppercase">
              Nouvelle Catégorie
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-white/60 tf-label inline">Nom *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value.toUpperCase() })}
                placeholder="Ex: ASSURANCE"
                className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white placeholder:text-[var(--color-text-tertiary)] font-mono"
                data-testid="cat-name-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-white/60 tf-label inline">Type *</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white" data-testid="cat-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
                    <SelectItem value="expense" className="text-white focus:bg-white/10">{t("expense")}</SelectItem>
                    <SelectItem value="revenue" className="text-white focus:bg-white/10">{t("revenueType")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-white/60 tf-label inline">Colonne KPI *</Label>
                <Select value={form.kpi_column} onValueChange={(v) => setForm({ ...form, kpi_column: v })}>
                  <SelectTrigger className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white" data-testid="cat-kpi-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] max-h-60">
                    <div className="px-2 py-1 text-[var(--color-text-secondary)] text-xs uppercase">
                      {form.type === "expense" ? "Dépenses" : "Revenus"}
                    </div>
                    {(form.type === "expense" ? expenseKpiColumns : revenueKpiColumns).map((col) => (
                      <SelectItem key={col.value} value={col.value} className="text-white focus:bg-white/10">
                        <span className="flex items-center gap-2">
                          {col.label}
                          {col.custom && <Badge variant="secondary" className="text-[10px] bg-white/10 text-[var(--color-text-secondary)]">custom</Badge>}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-white/60 tf-label inline">Couleur</Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setForm({ ...form, color: c })}
                    className="w-7 h-7 rounded-[var(--radius-lg)] transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      outline: form.color === c ? `2px solid white` : "none",
                      outlineOffset: "2px",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowModal(false)}
              className="border-[var(--color-border)] text-white/60 hover:text-white hover:bg-[var(--color-bg-tertiary)]"
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name}
              className="bg-[var(--color-accent)] hover:opacity-85 text-white font-bold uppercase tracking-wider"
              data-testid="cat-save-btn"
            >
              {saving ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl font-extrabold uppercase">
              Supprimer la catégorie ?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--color-text-secondary)]">
              Les transactions existantes ne seront pas affectées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[var(--color-border)] text-white/60 hover:text-white hover:bg-[var(--color-bg-tertiary)]">
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white font-bold"
              data-testid="delete-cat-confirm-btn"
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add KPI Column Modal */}
      <Dialog open={showKpiModal} onOpenChange={(v) => !v && setShowKpiModal(false)}>
        <DialogContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-extrabold uppercase">
              Nouvelle Colonne KPI
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-[var(--color-text-secondary)] text-sm">
              Créez une nouvelle colonne KPI pour regrouper vos catégories de dépenses ou revenus.
            </p>
            <div className="space-y-1.5">
              <Label className="text-white/60 tf-label inline">Nom affiché *</Label>
              <Input
                value={kpiForm.label}
                onChange={(e) => setKpiForm({ ...kpiForm, label: e.target.value })}
                placeholder="Ex: Frais bancaires"
                className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white placeholder:text-[var(--color-text-tertiary)]"
                data-testid="kpi-label-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/60 tf-label inline">Code technique *</Label>
              <Input
                value={kpiForm.value}
                onChange={(e) => setKpiForm({ ...kpiForm, value: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                placeholder="Ex: frais_bancaires"
                className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white placeholder:text-[var(--color-text-tertiary)] font-mono"
                data-testid="kpi-value-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/60 tf-label inline">Type *</Label>
              <Select value={kpiForm.type} onValueChange={(v) => setKpiForm({ ...kpiForm, type: v })}>
                <SelectTrigger className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
                  <SelectItem value="expense" className="text-white focus:bg-white/10">{t("expense")}</SelectItem>
                  <SelectItem value="revenue" className="text-white focus:bg-white/10">{t("revenueType")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* List of custom columns */}
            {customKpiColumns.length > 0 && (
              <div className="border-t border-[var(--color-border)] pt-4">
                <Label className="text-white/60 tf-label inline mb-2 block">Colonnes personnalisées</Label>
                <div className="space-y-2">
                  {customKpiColumns.map((col) => (
                    <div key={col.value} className="flex items-center justify-between bg-[var(--color-bg-secondary)] rounded px-3 py-2">
                      <div>
                        <span className="text-white text-sm">{col.label}</span>
                        <span className="text-[var(--color-text-secondary)] text-xs ml-2 font-mono">{col.value}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteKpiColumn(col.value)}
                        className="text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowKpiModal(false)}
              className="border-[var(--color-border)] text-white/60 hover:text-white hover:bg-[var(--color-bg-tertiary)]"
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={handleAddKpiColumn}
              disabled={!kpiForm.value || !kpiForm.label}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase tracking-wider"
              data-testid="kpi-save-btn"
            >
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
