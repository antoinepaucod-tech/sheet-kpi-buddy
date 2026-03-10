import { useState } from "react";
import { Plus, Trash2, Loader2, Calendar, Power, RefreshCw } from "lucide-react";
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
        <h1 className="font-heading text-4xl font-extrabold text-white uppercase tracking-tight">
          {t("recurringTransactions")}
        </h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowGenerateModal(true)}
            className="border-white/10 text-white/50 hover:text-white hover:bg-white/5 text-xs"
            data-testid="generate-month-btn"
          >
            <Calendar size={12} className="mr-1.5" />
            {t("generateMonthly")}
          </Button>
          <Button
            onClick={openAdd}
            className="bg-rose-600 hover:bg-rose-700 text-white font-bold uppercase tracking-wider text-xs"
            data-testid="add-recurring-btn"
          >
            <Plus size={14} className="mr-1.5" />
            {t("addRecurring")}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#121214] border border-white/10 p-4 rounded-sm">
          <p className="text-xs text-white/40 uppercase tracking-wider">Total</p>
          <p className="text-xl font-heading font-extrabold text-white mt-1">{recurring.length}</p>
        </div>
        <div className="bg-[#121214] border border-white/10 p-4 rounded-sm">
          <p className="text-xs text-white/40 uppercase tracking-wider">{t("active")}</p>
          <p className="text-xl font-heading font-extrabold text-green-400 mt-1">
            {recurring.filter(r => r.is_active).length}
          </p>
        </div>
        <div className="bg-[#121214] border border-white/10 p-4 rounded-sm">
          <p className="text-xs text-white/40 uppercase tracking-wider">{t("inactive")}</p>
          <p className="text-xl font-heading font-extrabold text-white/30 mt-1">
            {recurring.filter(r => !r.is_active).length}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#121214] border border-white/10 rounded-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="animate-spin text-rose-500" size={24} />
          </div>
        ) : recurring.length === 0 ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-white/30 font-body text-sm">{t("noRecurring")}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                {[t("description"), t("category"), t("type"), t("recurrenceDay"), t("amount"), "Status", t("actions")].map((h) => (
                  <TableHead key={h} className="text-white/40 uppercase tracking-wider text-xs font-body">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {recurring.map((item) => (
                <TableRow
                  key={item.id}
                  className={`border-white/5 hover:bg-white/3 transition-colors ${!item.is_active ? 'opacity-40' : ''}`}
                  data-testid={`recurring-row-${item.id}`}
                >
                  <TableCell 
                    className="text-white text-sm cursor-pointer hover:text-rose-400"
                    onClick={() => openEdit(item)}
                  >
                    {item.description}
                  </TableCell>
                  <TableCell className="text-white/60 text-xs font-mono">{item.category}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        item.type === "revenue"
                          ? "bg-green-500/10 text-green-400 border-green-500/20 text-xs"
                          : "bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs"
                      }
                    >
                      {item.type === "revenue" ? t("revenueType") : t("expense")}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm text-white/60">
                    {item.recurrence_day || 1}
                  </TableCell>
                  <TableCell className={`font-mono text-sm font-bold ${item.type === "revenue" ? "text-green-400" : "text-white/80"}`}>
                    {item.type === "revenue" ? "+" : "-"} {formatCHF(item.amount)}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleToggleActive(item)}
                      className={`p-1 rounded transition-colors ${item.is_active ? 'text-green-400 hover:text-green-300' : 'text-white/20 hover:text-white/40'}`}
                      title={t("toggleStatus")}
                      data-testid={`toggle-${item.id}`}
                    >
                      <Power size={14} />
                    </button>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => setDeleteId(item.id)}
                      className="text-white/20 hover:text-red-400 transition-colors p-1"
                      data-testid={`delete-recurring-${item.id}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="bg-[#121214] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-extrabold uppercase">
              {editItem ? (lang === "fr" ? "Modifier" : "Edit") : t("addRecurring")}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-white/60 text-xs uppercase">{t("type")}</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v, category: "" })}>
                <SelectTrigger className="bg-[#1C1C1E] border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1C1C1E] border-white/10">
                  <SelectItem value="expense" className="text-white focus:bg-white/10">{t("expense")}</SelectItem>
                  <SelectItem value="revenue" className="text-white focus:bg-white/10">{t("revenueType")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-white/60 text-xs uppercase">{t("category")}</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="bg-[#1C1C1E] border-white/10 text-white">
                  <SelectValue placeholder={lang === "fr" ? "Sélectionner" : "Select"} />
                </SelectTrigger>
                <SelectContent className="bg-[#1C1C1E] border-white/10">
                  {filteredCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.name} className="text-white focus:bg-white/10">
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-white/60 text-xs uppercase">{t("description")}</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="bg-[#1C1C1E] border-white/10 text-white"
                placeholder={lang === "fr" ? "Ex: Loyer mensuel" : "Ex: Monthly rent"}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-white/60 text-xs uppercase">{t("amount")} (CHF)</Label>
                <Input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="bg-[#1C1C1E] border-white/10 text-white"
                  step="0.01"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/60 text-xs uppercase">{t("recurrenceDay")}</Label>
                <Select value={form.recurrence_day.toString()} onValueChange={(v) => setForm({ ...form, recurrence_day: parseInt(v) })}>
                  <SelectTrigger className="bg-[#1C1C1E] border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1C1C1E] border-white/10 max-h-48">
                    {DAYS.map((d) => (
                      <SelectItem key={d} value={d.toString()} className="text-white focus:bg-white/10">
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {form.type === "revenue" && (
              <div className="space-y-1.5">
                <Label className="text-white/60 text-xs uppercase">{t("subType")}</Label>
                <Select value={form.sub_type || "none"} onValueChange={(v) => setForm({ ...form, sub_type: v === "none" ? "" : v })}>
                  <SelectTrigger className="bg-[#1C1C1E] border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1C1C1E] border-white/10">
                    <SelectItem value="none" className="text-white focus:bg-white/10">-</SelectItem>
                    <SelectItem value="members" className="text-white focus:bg-white/10">{t("membersType")}</SelectItem>
                    <SelectItem value="coaching" className="text-white focus:bg-white/10">{t("coachingType")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowModal(false)}
              className="border-white/10 text-white/60"
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={handleSave}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
            >
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Modal */}
      <Dialog open={showGenerateModal} onOpenChange={setShowGenerateModal}>
        <DialogContent className="bg-[#121214] border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-extrabold uppercase">
              {t("generateMonthly")}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <p className="text-white/50 text-sm">
              {lang === "fr" 
                ? "Générer automatiquement les transactions du mois sélectionné à partir des modèles récurrents actifs."
                : "Automatically generate transactions for the selected month from active recurring templates."}
            </p>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-white/60 text-xs uppercase">{lang === "fr" ? "Année" : "Year"}</Label>
                <Select value={generateYear.toString()} onValueChange={(v) => setGenerateYear(parseInt(v))}>
                  <SelectTrigger className="bg-[#1C1C1E] border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1C1C1E] border-white/10">
                    {[2023, 2024, 2025, 2026].map((y) => (
                      <SelectItem key={y} value={y.toString()} className="text-white focus:bg-white/10">
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/60 text-xs uppercase">{t("month")}</Label>
                <Select value={generateMonth.toString()} onValueChange={(v) => setGenerateMonth(parseInt(v))}>
                  <SelectTrigger className="bg-[#1C1C1E] border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1C1C1E] border-white/10">
                    {MONTHS_OPTIONS.map((m) => (
                      <SelectItem key={m.value} value={m.value.toString()} className="text-white focus:bg-white/10">
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
              className="border-white/10 text-white/60"
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
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
        <AlertDialogContent className="bg-[#121214] border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading text-xl font-extrabold uppercase">
              {t("confirmDelete")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">
              {lang === "fr" 
                ? "Cette action supprimera définitivement ce modèle récurrent."
                : "This action will permanently delete this recurring template."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 text-white/60 hover:text-white hover:bg-white/5">
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white font-bold"
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
