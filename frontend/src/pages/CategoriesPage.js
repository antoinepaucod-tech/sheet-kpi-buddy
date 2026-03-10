import { useState, useEffect } from "react";
import { Palette, Plus, Trash2, Loader2 } from "lucide-react";
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

const KPI_COLUMNS = [
  "loyer", "salaires", "utilities", "marketing_spend", "ad_spend",
  "revenue_members", "revenue_coaching", "other_expenses",
];

const EMPTY_FORM = { name: "", kpi_column: "other_expenses", type: "expense", color: "#3B82F6" };

export default function CategoriesPage() {
  const { t } = useTranslations();
  const { toast } = useToast();
  const { categories, refetch } = useAccountingTransactions(null);
  const [showModal, setShowModal] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

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

  const expenseCategories = categories.filter((c) => c.type === "expense");
  const revenueCategories = categories.filter((c) => c.type === "revenue");

  return (
    <div className="space-y-6" data-testid="categories-page">
      <Toaster />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-4xl font-extrabold text-white uppercase tracking-tight">
            {t("categories")}
          </h1>
          <p className="text-white/40 text-sm font-body mt-1">
            {categories.length} catégorie{categories.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRecalculate}
            disabled={recalculating}
            className="border-white/10 text-white/60 hover:text-white hover:bg-white/5 text-xs"
            data-testid="recalculate-btn"
          >
            {recalculating ? <Loader2 size={12} className="animate-spin mr-1.5" /> : null}
            {recalculating ? "Recalcul..." : "Recalculer les KPIs"}
          </Button>
          <Button
            onClick={() => setShowModal(true)}
            className="bg-rose-600 hover:bg-rose-700 text-white font-bold uppercase tracking-wider text-xs"
            data-testid="add-category-btn"
          >
            <Plus size={14} className="mr-1.5" />
            Ajouter
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense categories */}
        <div className="bg-[#121214] border border-white/10 rounded-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10">
            <p className="text-xs font-body text-white/40 uppercase tracking-wider">
              Dépenses · {expenseCategories.length}
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-white/30 uppercase text-xs">Nom</TableHead>
                <TableHead className="text-white/30 uppercase text-xs">Colonne KPI</TableHead>
                <TableHead className="text-white/30 uppercase text-xs w-16">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenseCategories.map((cat) => (
                <TableRow key={cat.id} className="border-white/5 hover:bg-white/3" data-testid={`cat-row-${cat.id}`}>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="font-mono text-sm text-white">{cat.name}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-white/40 text-xs font-mono">{cat.kpi_column}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => setDeleteId(cat.id)}
                      className="text-white/20 hover:text-red-400 transition-colors"
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
        <div className="bg-[#121214] border border-white/10 rounded-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10">
            <p className="text-xs font-body text-white/40 uppercase tracking-wider">
              Revenus · {revenueCategories.length}
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-white/30 uppercase text-xs">Nom</TableHead>
                <TableHead className="text-white/30 uppercase text-xs">Colonne KPI</TableHead>
                <TableHead className="text-white/30 uppercase text-xs w-16">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {revenueCategories.map((cat) => (
                <TableRow key={cat.id} className="border-white/5 hover:bg-white/3" data-testid={`cat-row-${cat.id}`}>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="font-mono text-sm text-white">{cat.name}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-white/40 text-xs font-mono">{cat.kpi_column}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => setDeleteId(cat.id)}
                      className="text-white/20 hover:text-red-400 transition-colors"
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
        <DialogContent className="bg-[#121214] border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-extrabold uppercase">
              Nouvelle Catégorie
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-white/60 text-xs uppercase tracking-wider">Nom *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value.toUpperCase() })}
                placeholder="Ex: ASSURANCE"
                className="bg-[#1C1C1E] border-white/10 text-white placeholder:text-white/20 font-mono"
                data-testid="cat-name-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-white/60 text-xs uppercase tracking-wider">Type *</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger className="bg-[#1C1C1E] border-white/10 text-white" data-testid="cat-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1C1C1E] border-white/10">
                    <SelectItem value="expense" className="text-white focus:bg-white/10">{t("expense")}</SelectItem>
                    <SelectItem value="revenue" className="text-white focus:bg-white/10">{t("revenueType")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-white/60 text-xs uppercase tracking-wider">Colonne KPI *</Label>
                <Select value={form.kpi_column} onValueChange={(v) => setForm({ ...form, kpi_column: v })}>
                  <SelectTrigger className="bg-[#1C1C1E] border-white/10 text-white" data-testid="cat-kpi-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1C1C1E] border-white/10">
                    {KPI_COLUMNS.map((col) => (
                      <SelectItem key={col} value={col} className="text-white focus:bg-white/10 font-mono text-xs">
                        {col}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-white/60 text-xs uppercase tracking-wider">Couleur</Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setForm({ ...form, color: c })}
                    className="w-7 h-7 rounded-sm transition-transform hover:scale-110"
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
              className="border-white/10 text-white/60 hover:text-white hover:bg-white/5"
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold uppercase tracking-wider"
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
        <AlertDialogContent className="bg-[#121214] border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading text-xl font-extrabold uppercase">
              Supprimer la catégorie ?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">
              Les transactions existantes ne seront pas affectées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 text-white/60 hover:text-white hover:bg-white/5">
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
    </div>
  );
}
