import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Loader2, Calendar, Power, RefreshCw, Check, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { useRecurringTransactions } from "../hooks/useRecurringTransactions";
import { useAccountingTransactions } from "../hooks/useAccountingTransactions";
import { useTranslations } from "../hooks/useTranslations";
import { useToast } from "../hooks/use-toast";
import { Toaster } from "../components/ui/toaster";
import { formatCHF } from "../utils/format";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

export default function RecurringPage() {
  const { t, lang } = useTranslations();
  const { toast } = useToast();
  const { recurring, loading, addRecurring, updateRecurring, deleteRecurring, generateMonthly } = useRecurringTransactions();
  const { categories } = useAccountingTransactions();
  
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateYear, setGenerateYear] = useState(new Date().getFullYear());
  const [generateMonth, setGenerateMonth] = useState(new Date().getMonth() + 1);
  
  const [form, setForm] = useState({
    type: "expense",
    category: "",
    description: "",
    amount: "",
    sub_type: "",
    recurrence_day: 1,
    is_active: true,
  });

  // Validation state
  const now = new Date();
  const [valMonth, setValMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [validations, setValidations] = useState([]);
  const [loadingVal, setLoadingVal] = useState(false);

  const fetchValidations = useCallback(async () => {
    if (!valMonth) return;
    setLoadingVal(true);
    try {
      const { data } = await axios.get(`${API}/recurring-validations/${valMonth}`);
      setValidations(data);
    } catch { setValidations([]); }
    finally { setLoadingVal(false); }
  }, [valMonth]);

  useEffect(() => { fetchValidations(); }, [fetchValidations]);

  const validatedRecurringIds = new Set(validations.map(v => v.recurring_id));

  const handleValidateRecurring = async (recurringId) => {
    try {
      await axios.post(`${API}/recurring-validations`, { recurring_id: recurringId, month: valMonth });
      fetchValidations();
      toast({ title: lang === "fr" ? "Validé" : "Validated" });
    } catch (e) {
      toast({ title: "Erreur", description: e.response?.data?.detail || "Erreur", variant: "destructive" });
    }
  };

  const handleUnvalidateRecurring = async (recurringId) => {
    const val = validations.find(v => v.recurring_id === recurringId);
    if (!val) return;
    try {
      await axios.delete(`${API}/recurring-validations/${val.id}`);
      fetchValidations();
      toast({ title: lang === "fr" ? "Validation annulée" : "Validation removed" });
    } catch (e) {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const openAdd = () => {
    setEditItem(null);
    setForm({
      type: "expense",
      category: "",
      description: "",
      amount: "",
      sub_type: "",
      recurrence_day: 1,
      is_active: true,
    });
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({
      type: item.type,
      category: item.category,
      description: item.description,
      amount: item.amount.toString(),
      sub_type: item.sub_type || "",
      recurrence_day: item.recurrence_day || 1,
      is_active: item.is_active,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.category || !form.description || !form.amount) {
      toast({ title: "Erreur", description: "Remplissez tous les champs obligatoires", variant: "destructive" });
      return;
    }
    
    const data = {
      ...form,
      amount: parseFloat(form.amount),
      sub_type: form.sub_type || null,
    };
    
    try {
      if (editItem) {
        await updateRecurring(editItem.id, data);
        toast({ title: lang === "fr" ? "Modifié" : "Updated" });
      } else {
        await addRecurring(data);
        toast({ title: lang === "fr" ? "Ajouté" : "Added" });
      }
      setShowModal(false);
    } catch (e) {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteRecurring(deleteId);
    setDeleteId(null);
    toast({ title: lang === "fr" ? "Supprimé" : "Deleted" });
  };

  const handleToggleActive = async (item) => {
    await updateRecurring(item.id, { ...item, is_active: !item.is_active });
    toast({ 
      title: item.is_active 
        ? (lang === "fr" ? "Désactivé" : "Deactivated") 
        : (lang === "fr" ? "Activé" : "Activated") 
    });
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generateMonthly(generateYear, generateMonth);
      toast({
        title: t("recurringGenerated"),
        description: `${result.created} ${lang === "fr" ? "créées" : "created"}${result.skipped > 0 ? `, ${result.skipped} ${t("recurringSkipped")}` : ""}`,
      });
      setShowGenerateModal(false);
    } catch (e) {
      toast({ 
        title: "Erreur", 
        description: e.response?.data?.detail || "Erreur serveur", 
        variant: "destructive" 
      });
    } finally {
      setGenerating(false);
    }
  };

  const filteredCategories = categories.filter(c => c.type === form.type);

  const MONTHS_OPTIONS = [
    { value: 1, label: lang === "fr" ? "Janvier" : "January" },
    { value: 2, label: lang === "fr" ? "Février" : "February" },
    { value: 3, label: lang === "fr" ? "Mars" : "March" },
    { value: 4, label: lang === "fr" ? "Avril" : "April" },
    { value: 5, label: lang === "fr" ? "Mai" : "May" },
    { value: 6, label: lang === "fr" ? "Juin" : "June" },
    { value: 7, label: lang === "fr" ? "Juillet" : "July" },
    { value: 8, label: lang === "fr" ? "Août" : "August" },
    { value: 9, label: lang === "fr" ? "Septembre" : "September" },
    { value: 10, label: lang === "fr" ? "Octobre" : "October" },
    { value: 11, label: lang === "fr" ? "Novembre" : "November" },
    { value: 12, label: lang === "fr" ? "Décembre" : "December" },
  ];

  return (
    <div className="space-y-6" data-testid="recurring-page">
      <Toaster />
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="tf-page-header">
          {t("recurringTransactions")}
        </h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowGenerateModal(true)}
            className="border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] text-xs"
            data-testid="generate-month-btn"
          >
            <Calendar size={12} className="mr-1.5" />
            {t("generateMonthly")}
          </Button>
          <Button
            onClick={openAdd}
            className="bg-[var(--color-accent)] hover:opacity-85 text-white font-bold uppercase tracking-wider text-xs"
            data-testid="add-recurring-btn"
          >
            <Plus size={14} className="mr-1.5" />
            {t("addRecurring")}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-4 rounded-[var(--radius-lg)]">
          <p className="tf-stat-label">Total</p>
          <p className="text-xl font-display font-extrabold text-white mt-1">{recurring.length}</p>
        </div>
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-4 rounded-[var(--radius-lg)]">
          <p className="tf-stat-label">Revenus</p>
          <p className="text-xl font-display font-extrabold text-[var(--color-success)] mt-1">
            {recurring.filter(r => r.type === "revenue" && r.is_active).length}
          </p>
          <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5 font-mono">
            +{formatCHF(recurring.filter(r => r.type === "revenue" && r.is_active).reduce((s, r) => s + (r.amount || 0), 0))}
          </p>
        </div>
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-4 rounded-[var(--radius-lg)]">
          <p className="tf-stat-label">{lang === "fr" ? "Dépenses" : "Expenses"}</p>
          <p className="text-xl font-display font-extrabold text-[var(--color-danger)] mt-1">
            {recurring.filter(r => r.type === "expense" && r.is_active).length}
          </p>
          <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5 font-mono">
            -{formatCHF(recurring.filter(r => r.type === "expense" && r.is_active).reduce((s, r) => s + (r.amount || 0), 0))}
          </p>
        </div>
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-4 rounded-[var(--radius-lg)]">
          <p className="tf-stat-label">{lang === "fr" ? "Billing Membres" : "Billing Members"}</p>
          <p className="text-xl font-display font-extrabold text-[var(--color-accent)] mt-1">
            {recurring.filter(r => r.source === "billing").length}
          </p>
        </div>
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-4 rounded-[var(--radius-lg)]">
          <p className="tf-stat-label">{lang === "fr" ? "Templates manuels" : "Manual Templates"}</p>
          <p className="text-xl font-display font-extrabold text-white mt-1">
            {recurring.filter(r => r.source === "template").length}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="tf-card overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="animate-spin text-[var(--color-accent)]" size={24} />
          </div>
        ) : recurring.length === 0 ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-[var(--color-text-tertiary)] font-text text-sm">{t("noRecurring")}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--color-border)] hover:bg-transparent">
                {[t("description"), t("category"), t("type"), "Source", t("recurrenceDay"), t("amount"), "Status", t("actions")].map((h) => (
                  <TableHead key={h} className="text-[var(--color-text-secondary)] uppercase tracking-wider text-xs font-text">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {recurring.map((item) => {
                const isTemplate = item.source === "template";
                const isBilling = item.source === "billing";
                const isCategory = item.source === "category";
                return (
                <TableRow
                  key={item.id}
                  className={`border-[var(--color-border)] hover:bg-[rgba(255,255,255,0.03)] transition-colors ${!item.is_active ? 'opacity-40' : ''}`}
                  data-testid={`recurring-row-${item.id}`}
                >
                  <TableCell 
                    className={`text-white text-sm ${isTemplate ? 'cursor-pointer hover:text-[var(--color-accent)]' : ''}`}
                    onClick={() => isTemplate && openEdit(item)}
                  >
                    {item.description}
                  </TableCell>
                  <TableCell className="text-[var(--color-text-secondary)] text-xs font-mono">{item.category}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        item.type === "revenue"
                          ? "bg-[rgba(48,209,88,0.12)] text-[var(--color-success)] border-0 text-xs"
                          : "bg-[rgba(255,69,58,0.12)] text-[var(--color-danger)] border-0 text-xs"
                      }
                    >
                      {item.type === "revenue" ? t("revenueType") : t("expense")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        isBilling ? "bg-[rgba(10,132,255,0.12)] text-[var(--color-accent)] border-0 text-[9px]" :
                        isCategory ? "bg-[rgba(255,214,10,0.12)] text-[var(--color-warning)] border-0 text-[9px]" :
                        "bg-[rgba(255,255,255,0.08)] text-[var(--color-text-secondary)] border-0 text-[9px]"
                      }
                    >
                      {isBilling ? "Billing" : isCategory ? "Catégorie" : "Manuel"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm text-[var(--color-text-secondary)]">
                    {item.recurrence_day || 1}
                  </TableCell>
                  <TableCell className={`font-mono text-sm font-bold ${item.type === "revenue" ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
                    {item.type === "revenue" ? "+" : "-"} {formatCHF(item.amount)}
                  </TableCell>
                  <TableCell>
                    {isTemplate && (
                    <button
                      onClick={() => handleToggleActive(item)}
                      className={`p-1 rounded transition-colors ${item.is_active ? 'text-[var(--color-success)] hover:text-[var(--color-success)]' : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'}`}
                      title={t("toggleStatus")}
                      data-testid={`toggle-${item.id}`}
                    >
                      <Power size={14} />
                    </button>
                    )}
                  </TableCell>
                  <TableCell>
                    {isTemplate && (
                    <button
                      onClick={() => setDeleteId(item.id)}
                      className="text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] transition-colors p-1"
                      data-testid={`delete-recurring-${item.id}`}
                    >
                      <Trash2 size={14} />
                    </button>
                    )}
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Monthly Validation Section */}
      <div className="tf-card p-4 space-y-4" data-testid="validation-section">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-display font-bold text-white uppercase tracking-wider">
            {lang === "fr" ? "Validation Mensuelle des Récurrences" : "Monthly Recurring Validation"}
          </h2>
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={valMonth}
              onChange={(e) => setValMonth(e.target.value)}
              className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-3 py-1.5 text-white text-xs font-mono"
              data-testid="validation-month-picker"
            />
          </div>
        </div>

        {loadingVal ? (
          <div className="flex items-center justify-center h-20">
            <Loader2 className="animate-spin text-[var(--color-accent)]" size={20} />
          </div>
        ) : recurring.filter(r => r.is_active).length === 0 ? (
          <p className="text-[var(--color-text-tertiary)] text-sm text-center py-4 italic">
            {lang === "fr" ? "Aucune récurrence active" : "No active recurring"}
          </p>
        ) : (
          <div className="space-y-1.5">
            {recurring.filter(r => r.is_active).map((item) => {
              const isValidated = validatedRecurringIds.has(item.id);
              const isRevenue = item.type === "revenue";
              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-3 rounded-[var(--radius-lg)] border transition-all ${
                    isValidated
                      ? 'bg-[rgba(48,209,88,0.05)] border-[rgba(48,209,88,0.2)]'
                      : 'bg-[var(--color-bg-secondary)] border-[var(--color-border)]'
                  }`}
                  data-testid={`validation-row-${item.id}`}
                >
                  <div className="flex items-center gap-3">
                    <RefreshCw size={14} className="text-[var(--color-text-tertiary)]" />
                    <div>
                      <span className="text-sm text-white font-display font-bold">{item.description}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-[var(--color-text-tertiary)] font-mono">{item.category}</span>
                        <span className="text-[10px] text-[var(--color-text-tertiary)] font-mono">
                          J{item.recurrence_day || 1}
                        </span>
                        <Badge className={`text-[9px] border-0 ${isRevenue ? 'bg-[rgba(48,209,88,0.12)] text-[var(--color-success)]' : 'bg-[rgba(255,69,58,0.12)] text-[var(--color-danger)]'}`}>
                          {isRevenue ? (lang === "fr" ? "Revenu" : "Revenue") : (lang === "fr" ? "Dépense" : "Expense")}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-mono text-sm font-bold ${isRevenue ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                      {isRevenue ? '+' : '-'}{formatCHF(item.amount)}
                    </span>
                    {isValidated ? (
                      <button
                        onClick={() => handleUnvalidateRecurring(item.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-[var(--radius-md)] bg-[rgba(48,209,88,0.15)] text-[var(--color-success)] hover:bg-[rgba(48,209,88,0.25)] transition-colors text-xs font-mono uppercase"
                        data-testid={`unvalidate-${item.id}`}
                      >
                        <Check size={12} />
                        {lang === "fr" ? "Validé" : "Validated"}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleValidateRecurring(item.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-[var(--radius-md)] bg-[rgba(255,255,255,0.05)] text-[var(--color-text-tertiary)] hover:text-white hover:bg-[rgba(255,255,255,0.1)] transition-colors text-xs font-mono uppercase border border-[var(--color-border)]"
                        data-testid={`validate-${item.id}`}
                      >
                        <X size={12} />
                        {lang === "fr" ? "Non validé" : "Not validated"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border)]">
              <span className="text-xs text-[var(--color-text-secondary)] font-display uppercase tracking-wider">
                {lang === "fr" ? "Progression" : "Progress"}
              </span>
              <span className="text-sm font-mono font-bold text-[var(--color-accent)]">
                {validations.length} / {recurring.filter(r => r.is_active).length} {lang === "fr" ? "validées" : "validated"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-extrabold uppercase">
              {editItem ? (lang === "fr" ? "Modifier" : "Edit") : t("addRecurring")}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-[var(--color-text-secondary)] text-xs uppercase">{t("type")}</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v, category: "" })}>
                <SelectTrigger className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
                  <SelectItem value="expense" className="text-white focus:bg-[rgba(255,255,255,0.1)]">{t("expense")}</SelectItem>
                  <SelectItem value="revenue" className="text-white focus:bg-[rgba(255,255,255,0.1)]">{t("revenueType")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-[var(--color-text-secondary)] text-xs uppercase">{t("category")}</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white">
                  <SelectValue placeholder={lang === "fr" ? "Sélectionner" : "Select"} />
                </SelectTrigger>
                <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
                  {filteredCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.name} className="text-white focus:bg-[rgba(255,255,255,0.1)]">
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-[var(--color-text-secondary)] text-xs uppercase">{t("description")}</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white"
                placeholder={lang === "fr" ? "Ex: Loyer mensuel" : "Ex: Monthly rent"}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[var(--color-text-secondary)] text-xs uppercase">{t("amount")} (CHF)</Label>
                <Input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white"
                  step="0.01"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[var(--color-text-secondary)] text-xs uppercase">{t("recurrenceDay")}</Label>
                <Select value={form.recurrence_day.toString()} onValueChange={(v) => setForm({ ...form, recurrence_day: parseInt(v) })}>
                  <SelectTrigger className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] max-h-48">
                    {DAYS.map((d) => (
                      <SelectItem key={d} value={d.toString()} className="text-white focus:bg-[rgba(255,255,255,0.1)]">
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {form.type === "revenue" && (
              <div className="space-y-1.5">
                <Label className="text-[var(--color-text-secondary)] text-xs uppercase">{t("subType")}</Label>
                <Select value={form.sub_type || "none"} onValueChange={(v) => setForm({ ...form, sub_type: v === "none" ? "" : v })}>
                  <SelectTrigger className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
                    <SelectItem value="none" className="text-white focus:bg-[rgba(255,255,255,0.1)]">-</SelectItem>
                    <SelectItem value="members" className="text-white focus:bg-[rgba(255,255,255,0.1)]">{t("membersType")}</SelectItem>
                    <SelectItem value="coaching" className="text-white focus:bg-[rgba(255,255,255,0.1)]">{t("coachingType")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowModal(false)}
              className="border-[var(--color-border)] text-[var(--color-text-secondary)]"
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={handleSave}
              className="bg-[var(--color-accent)] hover:opacity-85 text-white font-bold"
            >
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Modal */}
      <Dialog open={showGenerateModal} onOpenChange={setShowGenerateModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-extrabold uppercase">
              {t("generateMonthly")}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <p className="text-[var(--color-text-secondary)] text-sm">
              {lang === "fr" 
                ? "Générer automatiquement les transactions du mois sélectionné à partir des modèles récurrents actifs."
                : "Automatically generate transactions for the selected month from active recurring templates."}
            </p>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[var(--color-text-secondary)] text-xs uppercase">{lang === "fr" ? "Année" : "Year"}</Label>
                <Select value={generateYear.toString()} onValueChange={(v) => setGenerateYear(parseInt(v))}>
                  <SelectTrigger className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
                    {[2023, 2024, 2025, 2026].map((y) => (
                      <SelectItem key={y} value={y.toString()} className="text-white focus:bg-[rgba(255,255,255,0.1)]">
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[var(--color-text-secondary)] text-xs uppercase">{t("month")}</Label>
                <Select value={generateMonth.toString()} onValueChange={(v) => setGenerateMonth(parseInt(v))}>
                  <SelectTrigger className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
                    {MONTHS_OPTIONS.map((m) => (
                      <SelectItem key={m.value} value={m.value.toString()} className="text-white focus:bg-[rgba(255,255,255,0.1)]">
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowGenerateModal(false)}
              className="border-[var(--color-border)] text-[var(--color-text-secondary)]"
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="bg-[var(--color-accent)] hover:opacity-85 text-white font-bold"
            >
              {generating ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1.5" />
                  {lang === "fr" ? "Génération..." : "Generating..."}
                </>
              ) : (
                <>
                  <RefreshCw size={14} className="mr-1.5" />
                  {lang === "fr" ? "Générer" : "Generate"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl font-extrabold uppercase">
              {t("confirmDelete")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--color-text-secondary)]">
              {lang === "fr" 
                ? "Cette action supprimera définitivement ce modèle récurrent."
                : "This action will permanently delete this recurring template."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]">
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-[var(--color-danger)] hover:opacity-85 text-white font-bold"
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
