import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, RefreshCw, CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useAccountingTransactions, type AccountingTransaction } from "@/hooks/useAccountingTransactions";
import { useRecurringTransactions, type RecurringTransaction } from "@/hooks/useRecurringTransactions";
import { useAccountingCategoriesWithRecurrence } from "@/hooks/useAccountingCategoriesWithRecurrence";
import { useCashCollectedValidation } from "@/hooks/useCashCollectedValidation";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

const DEFAULT_REVENUE_CATEGORIES = [
  "THE COACH PASS MENSUEL",
  "HUBFIT",
  "VIRTUAL COACH",
  "PT ANTOINE",
  "OPEN GYM - PAIEMENT MENSUEL",
  "OPEN GYM - PAIEMENT ANNUEL X1",
  "UNLIMITED ACCESS - PAIEMENT MENSUEL",
  "UNLIMITED ACCESS - PAIEMENT X1 - ANNUEL",
  "UNLIMITED ACCESS DUO - PAIEMENT MENSUEL",
  "UNLIMITED ACCESS DUO - PAIEMENT ANNUEL X1",
  "OFFRE 6 MOIS - 499 CHF",
  "OFFRE 3 MOIS",
  "UNLIMITED ACCESS SANS EMGAGEMENT - PAIEMENT MENSUEL",
];

const DEFAULT_EXPENSE_CATEGORIES = [
  "LOGICIELS",
  "ABONNEMENTS",
  "LOYERS",
  "SALAIRES COACH",
  "TELEPHONIE",
  "REMBOURSEMENT PRÊT",
  "RETRAIT BANCOMAT",
  "ALIMENTAIRE",
  "PUBLICITÉ",
  "SALAIRES",
];

const PRODUCT_DESCRIPTIONS_REVENUE = [
  "Revenu EFT Général",
  "Revenu PT",
  "Revenu Retail",
  "Revenu Fast Cash",
  "Membre PIF",
];

const PRODUCT_DESCRIPTIONS_EXPENSE = [
  "Dépenses Publicitaires",
  "Loyer",
  "Réparations & Maintenance",
  "Logiciels",
  "Internet & Téléphone",
  "Abonnements",
  "Frais Bancaires",
  "Assurance",
  "Salaires",
  "Remboursement crédit",
  "Retrait bancomat",
  "Alimentaire",
];

const PAYMENT_METHODS = [
  "Virement Bancaire",
  "Carte Bancaire",
  "Espèces",
  "Prélèvement Automatique",
  "Autre",
];

// Sortable category item component
const SortableCategoryItem = ({ 
  category, 
  categoryData,
  index, 
  isEditing, 
  editingName,
  editingRecurring,
  editingIndefinite,
  editingEndDate,
  onStartEdit, 
  onSaveEdit, 
  onCancelEdit, 
  onDelete, 
  onEditNameChange,
  onEditRecurringChange,
  onEditIndefiniteChange,
  onEditEndDateChange,
  onToggleEndDate
}: {
  category: string;
  categoryData?: { is_recurring: boolean; is_indefinite_recurrence: boolean; recurrence_end_date: string | null };
  index: number;
  isEditing: boolean;
  editingName: string;
  editingRecurring: boolean;
  editingIndefinite: boolean;
  editingEndDate: string | null;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onEditNameChange: (value: string) => void;
  onEditRecurringChange: (value: boolean) => void;
  onEditIndefiniteChange: (value: boolean) => void;
  onEditEndDateChange: (value: string | null) => void;
  onToggleEndDate: () => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex flex-col gap-2 p-3 hover:bg-accent/50 border-b last:border-b-0"
    >
      <div className="flex items-center gap-2">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        {isEditing ? (
          <>
            <Input
              value={editingName}
              onChange={(e) => onEditNameChange(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  onSaveEdit();
                } else if (e.key === "Escape") {
                  onCancelEdit();
                }
              }}
              autoFocus
              className="flex-1"
            />
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={onSaveEdit}
                className="h-8 w-8 p-0"
              >
                ✓
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onCancelEdit}
                className="h-8 w-8 p-0"
              >
                ✕
              </Button>
            </div>
          </>
        ) : (
          <>
            <span 
              className="font-medium flex-1 cursor-pointer hover:text-primary"
              onClick={onStartEdit}
            >
              {category}
            </span>
            {categoryData?.is_recurring && categoryData?.is_indefinite_recurrence && (
              <Badge variant="secondary" className="text-xs flex items-center gap-1">
                Récurrent <span className="text-base">∞</span>
              </Badge>
            )}
            {categoryData?.is_recurring && !categoryData?.is_indefinite_recurrence && categoryData?.recurrence_end_date && (
              <Badge variant="secondary" className="text-xs">
                Récurrent (fin: {new Date(categoryData.recurrence_end_date).toLocaleDateString('fr-FR')})
              </Badge>
            )}
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={onStartEdit}
                className="h-8 w-8 p-0"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onDelete}
                className="text-destructive hover:text-destructive h-8 w-8 p-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </div>
      
      {isEditing && (
        <div className="ml-8 flex items-center gap-4 pt-2 border-t">
          <div className="flex items-center gap-2">
            <Switch
              checked={editingRecurring}
              onCheckedChange={onEditRecurringChange}
            />
            <Label className="text-sm">Récurrente</Label>
          </div>
          {editingRecurring && (
            <>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editingIndefinite}
                    onCheckedChange={onEditIndefiniteChange}
                  />
                  <Label className="text-sm flex items-center gap-1">
                    Indéterminée <span className="text-lg">∞</span>
                  </Label>
                </div>
                {!editingIndefinite && (
                  <div className="flex flex-col gap-2 pl-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onToggleEndDate}
                    >
                      {editingEndDate ? "Retirer fin de récurrence" : "Fin de récurrence"}
                    </Button>
                    {editingEndDate && (
                      <Input
                        type="date"
                        value={editingEndDate || ""}
                        onChange={(e) => onEditEndDateChange(e.target.value || null)}
                        className="w-full"
                      />
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const Accounting = () => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<AccountingTransaction | null>(null);
  
  // Manage custom categories
  const [revenueCategories, setRevenueCategories] = useState<string[]>(DEFAULT_REVENUE_CATEGORIES);
  const [expenseCategories, setExpenseCategories] = useState<string[]>(DEFAULT_EXPENSE_CATEGORIES);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [categoryDialogType, setCategoryDialogType] = useState<"revenue" | "expense">("revenue");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategoryIndex, setEditingCategoryIndex] = useState<number | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [editingCategoryRecurring, setEditingCategoryRecurring] = useState(false);
  const [editingCategoryIndefinite, setEditingCategoryIndefinite] = useState(true);
  const [editingCategoryEndDate, setEditingCategoryEndDate] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  
  // Load all category data with recurrence info
  const { categories: allCategories } = useAccountingCategoriesWithRecurrence();
  
  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // Load categories from database and seed defaults if empty
  useEffect(() => {
    const load = async () => {
      const { data, error } = await (supabase as any)
        .from('accounting_categories')
        .select('*')
        .order('position', { ascending: true });
      if (error) {
        console.error('Erreur lors du chargement des catégories', error);
        return;
      }
      if (!data || data.length === 0) {
        const seed = [
          ...DEFAULT_REVENUE_CATEGORIES.map((name, idx) => ({ type: 'revenue', name, position: idx })),
          ...DEFAULT_EXPENSE_CATEGORIES.map((name, idx) => ({ type: 'expense', name, position: idx })),
        ];
        const { error: insertError } = await (supabase as any).from('accounting_categories').insert(seed);
        if (insertError) console.error('Erreur lors du seed des catégories', insertError);
        setRevenueCategories(DEFAULT_REVENUE_CATEGORIES);
        setExpenseCategories(DEFAULT_EXPENSE_CATEGORIES);
        return;
      }
      const revenues = data.filter((d: any) => d.type === 'revenue').sort((a: any,b: any)=>a.position-b.position).map((d: any) => d.name);
      const expenses = data.filter((d: any) => d.type === 'expense').sort((a: any,b: any)=>a.position-b.position).map((d: any) => d.name);
      setRevenueCategories(revenues);
      setExpenseCategories(expenses);
    };
    load();
  }, []);
  
  // Persist category order helper
  const persistCategoryOrder = async (type: 'revenue' | 'expense', names: string[]) => {
    await Promise.all(
      names.map((name, idx) =>
        (supabase as any).from('accounting_categories').update({ position: idx }).eq('type', type).eq('name', name)
      )
    );
  };
  
  const [formData, setFormData] = useState({
    transaction_date: format(new Date(), "yyyy-MM-dd"),
    transaction_type: "revenue" as "revenue" | "expense",
    category: "",
    client_name: "",
    service_description: "",
    product_description: "",
    amount: 0,
    amount_received: 0,
    payment_method: "",
    notes: "",
  });

  const { transactions, isLoading, createTransaction, updateTransaction, deleteTransaction } =
    useAccountingTransactions(selectedYear, selectedMonth);

  const queryClient = useQueryClient();
  
  // Load customer members to check for exit dates
  const [customerMembers, setCustomerMembers] = useState<any[]>([]);
  
  useEffect(() => {
    const loadMembers = async () => {
      const { data } = await supabase
        .from('customer_members')
        .select('name, exit_date');
      if (data) setCustomerMembers(data);
    };
    loadMembers();
  }, []);
  
  // Validate cash collected across pages
  const { validation } = useCashCollectedValidation(selectedYear, selectedMonth);

  const { 
    recurringTransactions, 
    createRecurring, 
    updateRecurring, 
    deleteRecurring,
    generateMonthlyTransactions 
  } = useRecurringTransactions();

  const [isRecurringDialogOpen, setIsRecurringDialogOpen] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringTransaction | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [recurringFormData, setRecurringFormData] = useState({
    transaction_type: "revenue" as "revenue" | "expense",
    category: "",
    client_name: "",
    service_description: "",
    product_description: "",
    amount: 0,
    amount_received: 0,
    payment_method: "",
    notes: "",
    recurrence_day: 1,
    is_active: true,
  });

  const resetForm = () => {
    setFormData({
      transaction_date: format(new Date(), "yyyy-MM-dd"),
      transaction_type: "revenue",
      category: "",
      client_name: "",
      service_description: "",
      product_description: "",
      amount: 0,
      amount_received: 0,
      payment_method: "",
      notes: "",
    });
    setEditingTransaction(null);
  };

  const resetRecurringForm = () => {
    setRecurringFormData({
      transaction_type: "revenue",
      category: "",
      client_name: "",
      service_description: "",
      product_description: "",
      amount: 0,
      amount_received: 0,
      payment_method: "",
      notes: "",
      recurrence_day: 1,
      is_active: true,
    });
    setEditingRecurring(null);
  };

  const handleRecurringSubmit = () => {
    if (!recurringFormData.category || recurringFormData.amount === 0) {
      toast.error("Veuillez remplir les champs obligatoires");
      return;
    }

    if (editingRecurring) {
      updateRecurring.mutate({ id: editingRecurring.id, ...recurringFormData });
    } else {
      createRecurring.mutate(recurringFormData);
    }
    setIsRecurringDialogOpen(false);
    resetRecurringForm();
  };

  const handleEditRecurring = (recurring: RecurringTransaction) => {
    setEditingRecurring(recurring);
    setRecurringFormData({
      transaction_type: recurring.transaction_type,
      category: recurring.category,
      client_name: recurring.client_name || "",
      service_description: recurring.service_description || "",
      product_description: recurring.product_description || "",
      amount: recurring.amount,
      amount_received: recurring.amount_received || 0,
      payment_method: recurring.payment_method || "",
      notes: recurring.notes || "",
      recurrence_day: recurring.recurrence_day,
      is_active: recurring.is_active,
    });
    setIsRecurringDialogOpen(true);
  };

  const { generateRecurringTransactions } = useAccountingCategoriesWithRecurrence();
  
  const handleGenerateRecurringTransactions = async () => {
    setIsGenerating(true);
    try {
      await generateRecurringTransactions.mutateAsync({ year: selectedYear, month: selectedMonth });
      queryClient.invalidateQueries({ queryKey: ["accounting-transactions"] });
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la génération");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyMonth = async (sourceYear: number, sourceMonth: number) => {
    try {
      const { data: sourceTransactions, error } = await supabase
        .from("accounting_transactions")
        .select("*")
        .eq("year", sourceYear)
        .eq("month", sourceMonth + 1);

      if (error) throw error;

      if (!sourceTransactions || sourceTransactions.length === 0) {
        toast.error("Aucune transaction à copier");
        return;
      }

      // Copier les transactions vers le mois actuel - SANS le montant reçu
      const newTransactions = sourceTransactions.map(t => ({
        transaction_date: t.transaction_date,
        transaction_type: t.transaction_type,
        category: t.category,
        client_name: t.client_name,
        service_description: t.service_description,
        amount: t.amount,
        amount_received: 0, // Réinitialiser à 0 lors de la copie
        payment_method: t.payment_method,
        notes: t.notes,
        year: selectedYear,
        month: selectedMonth + 1,
        month_name: MONTHS[selectedMonth],
      }));

      const { error: insertError } = await supabase
        .from("accounting_transactions")
        .insert(newTransactions);

      if (insertError) throw insertError;

      toast.success(`${sourceTransactions.length} transactions copiées`);
      
      // Rafraîchir les données
      window.location.reload();
    } catch (error) {
      toast.error("Erreur lors de la copie");
      console.error(error);
    }
  };

  const handleSubmit = () => {
    if (!formData.category || formData.amount === 0) {
      toast.error("Veuillez remplir les champs obligatoires");
      return;
    }

    const transactionData = {
      ...formData,
      year: selectedYear,
      month: selectedMonth + 1,
      month_name: MONTHS[selectedMonth],
    };

    if (editingTransaction) {
      updateTransaction.mutate({ id: editingTransaction.id, ...transactionData });
    } else {
      createTransaction.mutate(transactionData);
    }
    setIsDialogOpen(false);
    resetForm();
  };

  const handleEdit = (transaction: AccountingTransaction) => {
    setEditingTransaction(transaction);
    setFormData({
      transaction_date: transaction.transaction_date,
      transaction_type: transaction.transaction_type,
      category: transaction.category,
      client_name: transaction.client_name || "",
      service_description: transaction.service_description || "",
      product_description: (transaction as any).product_description || "",
      amount: transaction.amount,
      amount_received: transaction.amount_received || 0,
      payment_method: transaction.payment_method || "",
      notes: transaction.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error("Le nom de la catégorie ne peut pas être vide");
      return;
    }
    
    if (categoryDialogType === "revenue") {
      if (revenueCategories.includes(newCategoryName.trim())) {
        toast.error("Cette catégorie existe déjà");
        return;
      }
      const newCategories = [...revenueCategories, newCategoryName.trim()];
      setRevenueCategories(newCategories);
      
      // Persist to database
      const { error } = await (supabase as any).from('accounting_categories').insert({
        type: 'revenue',
        name: newCategoryName.trim(),
        position: revenueCategories.length
      });
      if (error) {
        console.error('Erreur lors de l\'ajout de la catégorie', error);
        toast.error("Erreur lors de la sauvegarde");
        return;
      }
      
      toast.success("Catégorie de revenu ajoutée");
    } else {
      if (expenseCategories.includes(newCategoryName.trim())) {
        toast.error("Cette catégorie existe déjà");
        return;
      }
      const newCategories = [...expenseCategories, newCategoryName.trim()];
      setExpenseCategories(newCategories);
      
      // Persist to database
      const { error } = await (supabase as any).from('accounting_categories').insert({
        type: 'expense',
        name: newCategoryName.trim(),
        position: expenseCategories.length
      });
      if (error) {
        console.error('Erreur lors de l\'ajout de la catégorie', error);
        toast.error("Erreur lors de la sauvegarde");
        return;
      }
      
      toast.success("Catégorie de dépense ajoutée");
    }
    
    setNewCategoryName("");
    setIsCategoryDialogOpen(false);
  };

  const handleDeleteCategory = async (category: string, type: "revenue" | "expense") => {
    // Delete from database
    const { error } = await (supabase as any)
      .from('accounting_categories')
      .delete()
      .eq('type', type)
      .eq('name', category);
    
    if (error) {
      console.error('Erreur lors de la suppression de la catégorie', error);
      toast.error("Erreur lors de la suppression");
      return;
    }
    
    if (type === "revenue") {
      setRevenueCategories(revenueCategories.filter(c => c !== category));
      toast.success("Catégorie de revenu supprimée");
    } else {
      setExpenseCategories(expenseCategories.filter(c => c !== category));
      toast.success("Catégorie de dépense supprimée");
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const categories = categoryDialogType === "revenue" ? revenueCategories : expenseCategories;
    const oldIndex = categories.indexOf(active.id as string);
    const newIndex = categories.indexOf(over.id as string);

    const newCategories = arrayMove(categories, oldIndex, newIndex);

    if (categoryDialogType === "revenue") {
      setRevenueCategories(newCategories);
      await persistCategoryOrder('revenue', newCategories);
    } else {
      setExpenseCategories(newCategories);
      await persistCategoryOrder('expense', newCategories);
    }
  };

  const handleStartEditCategory = async (index: number, currentName: string) => {
    setEditingCategoryIndex(index);
    setEditingCategoryName(currentName);
    
    // Load recurrence data from database (also capture the category id)
    const { data, error } = await (supabase as any)
      .from('accounting_categories')
      .select('id, is_recurring, is_indefinite_recurrence, recurrence_end_date')
      .eq('name', currentName)
      .eq('type', categoryDialogType)
      .maybeSingle();

    if (error) {
      console.error('Erreur lors du chargement de la catégorie:', error);
      // Set default values if error
      setEditingCategoryRecurring(false);
      setEditingCategoryIndefinite(true);
      setEditingCategoryEndDate(null);
      setEditingCategoryId(null);
      return;
    }

    if (data) {
      setEditingCategoryRecurring(data.is_recurring === true);
      setEditingCategoryIndefinite(data.is_indefinite_recurrence === true);
      setEditingCategoryEndDate(data.recurrence_end_date || null);
      setEditingCategoryId(data.id || null);
    } else {
      // No data found, use defaults
      setEditingCategoryRecurring(false);
      setEditingCategoryIndefinite(true);
      setEditingCategoryEndDate(null);
      setEditingCategoryId(null);
    }
  };

  const handleCancelEditCategory = () => {
    setEditingCategoryIndex(null);
    setEditingCategoryName("");
    setEditingCategoryRecurring(false);
    setEditingCategoryIndefinite(true);
    setEditingCategoryEndDate(null);
    setEditingCategoryId(null);
  };

  const handleSaveEditCategory = async (oldName: string, type: "revenue" | "expense") => {
    const newName = editingCategoryName.trim();
    
    if (!newName) {
      toast.error("Le nom de la catégorie ne peut pas être vide");
      return;
    }

    // Prevent duplicate names when renaming
    const categories = type === "revenue" ? revenueCategories : expenseCategories;
    if (newName !== oldName && categories.includes(newName)) {
      toast.error("Cette catégorie existe déjà");
      return;
    }

    try {
      // Always persist recurrence settings, even if name unchanged
      const updatePayload: any = {
        is_recurring: editingCategoryRecurring,
        is_indefinite_recurrence: editingCategoryIndefinite,
        recurrence_end_date: editingCategoryEndDate,
      };

      if (newName !== oldName) {
        updatePayload.name = newName;
      }

      let updateQuery = (supabase as any)
        .from('accounting_categories')
        .update(updatePayload);

      if (editingCategoryId) {
        updateQuery = updateQuery.eq('id', editingCategoryId);
      } else {
        updateQuery = updateQuery.eq('type', type).eq('name', oldName);
      }

      const { error: categoryError } = await updateQuery;

      if (categoryError) throw categoryError;

      // If renaming, update all transactions with the old category name
      if (newName !== oldName) {
        const { error: transError } = await supabase
          .from("accounting_transactions")
          .update({ category: newName })
          .eq("category", oldName)
          .eq("transaction_type", type);
        if (transError) throw transError;
      }

      // Update local state
      if (newName !== oldName) {
        if (type === "revenue") {
          const updatedCategories = [...revenueCategories];
          const index = updatedCategories.indexOf(oldName);
          if (index !== -1) {
            updatedCategories[index] = newName;
            setRevenueCategories(updatedCategories);
          }
          toast.success("Catégorie de revenu modifiée et paramètres enregistrés");
        } else {
          const updatedCategories = [...expenseCategories];
          const index = updatedCategories.indexOf(oldName);
          if (index !== -1) {
            updatedCategories[index] = newName;
            setExpenseCategories(updatedCategories);
          }
          toast.success("Catégorie de dépense modifiée et paramètres enregistrés");
        }
      } else {
        toast.success("Paramètres de récurrence enregistrés");
      }

      handleCancelEditCategory();
      // Refresh categories list to reflect new recurrence badges
      const { data } = await (supabase as any)
        .from('accounting_categories')
        .select('*')
        .order('position', { ascending: true });
      if (data) {
        const revenues = data.filter((d: any) => d.type === 'revenue').sort((a: any,b: any)=>a.position-b.position).map((d: any) => d.name);
        const expenses = data.filter((d: any) => d.type === 'expense').sort((a: any,b: any)=>a.position-b.position).map((d: any) => d.name);
        setRevenueCategories(revenues);
        setExpenseCategories(expenses);
      }
      // Refresh transactions using React Query instead of page reload
      queryClient.invalidateQueries({ queryKey: ["accounting-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounting-categories-with-recurrence"] });
    } catch (error) {
      console.error("Error updating category:", error);
      toast.error("Erreur lors de la modification de la catégorie");
    }
  };

  const summary = useMemo(() => {
    const revenues = transactions.filter((t) => t.transaction_type === "revenue");
    const expenses = transactions.filter((t) => t.transaction_type === "expense");

    const totalRevenue = revenues.reduce((sum, t) => sum + t.amount, 0);
    const totalRevenueReceived = revenues.reduce((sum, t) => sum + (t.amount_received || 0), 0);
    const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0);
    const profit = totalRevenueReceived - totalExpenses;

    return {
      totalRevenue,
      totalRevenueReceived,
      totalExpenses,
      profit,
      revenueCount: revenues.length,
      expenseCount: expenses.length,
    };
  }, [transactions]);

  const revenuesByCategory = useMemo(() => {
    const grouped: Record<string, { amount: number; received: number; count: number }> = {};
    transactions
      .filter((t) => t.transaction_type === "revenue")
      .forEach((t) => {
        if (!grouped[t.category]) {
          grouped[t.category] = { amount: 0, received: 0, count: 0 };
        }
        grouped[t.category].amount += t.amount;
        grouped[t.category].received += t.amount_received || 0;
        grouped[t.category].count += 1;
      });
    return grouped;
  }, [transactions]);

  const expensesByCategory = useMemo(() => {
    const grouped: Record<string, { amount: number; count: number }> = {};
    transactions
      .filter((t) => t.transaction_type === "expense")
      .forEach((t) => {
        if (!grouped[t.category]) {
          grouped[t.category] = { amount: 0, count: 0 };
        }
        grouped[t.category].amount += t.amount;
        grouped[t.category].count += 1;
      });
    return grouped;
  }, [transactions]);

  const getPaymentStatus = (transaction: AccountingTransaction): "paid" | "pending" | "unpaid" => {
    if (transaction.transaction_type === "expense") return "paid";
    const received = transaction.amount_received || 0;
    if (received >= transaction.amount) return "paid";
    if (received > 0) return "pending";
    return "unpaid";
  };

  const unpaidTransactions = useMemo(() => {
    return transactions.filter((t) => t.transaction_type === "revenue" && getPaymentStatus(t) !== "paid");
  }, [transactions]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Chargement...</div>;
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold">Comptabilité</h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleGenerateRecurringTransactions}
              disabled={isGenerating}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isGenerating && "animate-spin")} />
              {isGenerating ? "Génération..." : "Générer Paiements Récurrents"}
            </Button>
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>

        <div className="flex gap-4 items-center">
          <Select
            value={selectedYear.toString()}
            onValueChange={(value) => setSelectedYear(parseInt(value))}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2025, 2026, 2027].map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selectedMonth.toString()}
            onValueChange={(value) => setSelectedMonth(parseInt(value))}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((month, index) => (
                <SelectItem key={index} value={index.toString()}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button 
            variant="default"
            onClick={handleGenerateRecurringTransactions}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Générer Paiements Récurrents
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Copier depuis un autre mois
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Copier les transactions d'un autre mois</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Mois source</Label>
                  <div className="flex gap-2">
                    <Select
                      onValueChange={(value) => {
                        const [sourceYear, sourceMonth] = value.split('-');
                        handleCopyMonth(parseInt(sourceYear), parseInt(sourceMonth));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un mois" />
                      </SelectTrigger>
                      <SelectContent>
                        {[2025, 2026, 2027].map((year) =>
                          MONTHS.map((month, monthIndex) => (
                            <SelectItem 
                              key={`${year}-${monthIndex}`} 
                              value={`${year}-${monthIndex}`}
                              disabled={year === selectedYear && monthIndex === selectedMonth}
                            >
                              {month} {year}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Les transactions du mois source seront copiées vers {MONTHS[selectedMonth]} {selectedYear}
                </p>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="revenues" className="w-full">
          <TabsList>
            <TabsTrigger value="revenues">Revenus</TabsTrigger>
            <TabsTrigger value="expenses">Dépenses</TabsTrigger>
            <TabsTrigger value="dashboard">Tableau de Bord</TabsTrigger>
            <TabsTrigger value="unpaid">Impayés ({unpaidTransactions.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            {/* KPIs Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="border-l-4 border-l-emerald-400">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Revenus Totaux
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-foreground">
                    CHF {summary.totalRevenue.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {summary.revenueCount} transactions
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-blue-400">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Revenus Encaissés
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-foreground">
                    CHF {summary.totalRevenueReceived.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Différence: CHF {(summary.totalRevenue - summary.totalRevenueReceived).toFixed(2)}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-amber-400">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Dépenses Totales
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-foreground">
                    CHF {summary.totalExpenses.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {summary.expenseCount} transactions
                  </p>
                </CardContent>
              </Card>

              <Card className={`border-l-4 ${
                summary.profit >= 0 
                  ? "border-l-emerald-500"
                  : "border-l-rose-500"
              }`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Bénéfice / Perte
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-3xl font-bold ${
                    summary.profit >= 0 
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}>
                    CHF {summary.profit.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {summary.profit >= 0 ? "Profit" : "Perte"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Revenue Breakdown */}
            <Card>
              <CardHeader className="border-b bg-muted/30">
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <span className="text-emerald-500">📊</span>
                  Revenus par Catégorie
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b-2">
                      <TableHead className="font-bold">Catégorie</TableHead>
                      <TableHead className="text-right font-bold">Nb</TableHead>
                      <TableHead className="text-right font-bold">Montant Total</TableHead>
                      <TableHead className="text-right font-bold">Montant Reçu</TableHead>
                      <TableHead className="text-right font-bold">Différence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(revenuesByCategory)
                      .sort((a, b) => b[1].amount - a[1].amount)
                      .map(([category, data], index) => (
                        <TableRow key={category} className={index % 2 === 0 ? "bg-muted/20" : ""}>
                          <TableCell className="font-medium">{category}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {data.count}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            CHF {data.amount.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">
                            CHF {data.received.toFixed(2)}
                          </TableCell>
                          <TableCell className={`text-right font-medium ${
                            data.amount - data.received > 0 
                              ? "text-amber-600 dark:text-amber-400" 
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}>
                            CHF {(data.amount - data.received).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    <TableRow className="bg-muted/50 font-bold border-t-2">
                      <TableCell>TOTAL REVENUS</TableCell>
                      <TableCell className="text-right">{summary.revenueCount}</TableCell>
                      <TableCell className="text-right text-lg">
                        CHF {summary.totalRevenue.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-lg text-emerald-600 dark:text-emerald-400">
                        CHF {summary.totalRevenueReceived.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-lg text-amber-600 dark:text-amber-400">
                        CHF {(summary.totalRevenue - summary.totalRevenueReceived).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Detailed Expense Breakdown */}
            <Card>
              <CardHeader className="border-b bg-muted/30">
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <span className="text-amber-500">💸</span>
                  Dépenses par Catégorie
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b-2">
                      <TableHead className="font-bold">Catégorie</TableHead>
                      <TableHead className="text-right font-bold">Nb</TableHead>
                      <TableHead className="text-right font-bold">Montant Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(expensesByCategory)
                      .sort((a, b) => b[1].amount - a[1].amount)
                      .map(([category, data], index) => (
                        <TableRow key={category} className={index % 2 === 0 ? "bg-muted/20" : ""}>
                          <TableCell className="font-medium">{category}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {data.count}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-amber-600 dark:text-amber-400">
                            CHF {data.amount.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    <TableRow className="bg-muted/50 font-bold border-t-2">
                      <TableCell>TOTAL DÉPENSES</TableCell>
                      <TableCell className="text-right">{summary.expenseCount}</TableCell>
                      <TableCell className="text-right text-lg text-amber-600 dark:text-amber-400">
                        CHF {summary.totalExpenses.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="revenues" className="space-y-6">
            {/* Manage Categories Button */}
            <div className="flex justify-end mb-4">
              <Button
                variant="outline"
                onClick={() => {
                  setCategoryDialogType("revenue");
                  setIsCategoryDialogOpen(true);
                }}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Gérer les types de revenus
              </Button>
            </div>

            {/* Revenue Tables by Category - Show ALL categories */}
            {revenueCategories.map((category) => {
                const categoryTransactions = transactions
                  .filter((t) => t.transaction_type === "revenue" && t.category === category);
                
                const totalAmount = categoryTransactions.reduce((sum, t) => sum + t.amount, 0);
                const totalReceived = categoryTransactions.reduce((sum, t) => sum + (t.amount_received || 0), 0);
                const difference = totalAmount - totalReceived;

                return (
                  <Card key={category} className="overflow-hidden border-0 shadow-none">
                    {/* Header Row - Subtle Gray */}
                    <div className="bg-muted/80 text-foreground border border-border">
                      <div className="grid grid-cols-8">
                        <div className="px-3 py-2 font-bold border-r border-border text-sm">NOM DU SERVICE</div>
                        <div className="px-3 py-2 font-bold border-r border-border text-sm">NOM</div>
                        <div className="px-3 py-2 font-bold border-r border-border text-sm">Prénom</div>
                        <div className="px-3 py-2 font-bold border-r border-border text-sm">Prestation</div>
                        <div className="px-3 py-2 font-bold border-r border-border text-sm">Description Produit</div>
                        <div className="px-3 py-2 font-bold border-r border-border text-sm text-right">Montant</div>
                        <div className="px-3 py-2 font-bold border-r border-border text-sm text-center">État</div>
                        <div className="px-3 py-2 font-bold text-sm text-left">Réglé le</div>
                      </div>
                    </div>

                    {/* Category Header - Soft Blue */}
                    <div className="bg-blue-100 dark:bg-blue-950/30 text-foreground border-x border-b border-border">
                      <div className="px-3 py-2 font-bold uppercase text-sm">
                        {category}
                      </div>
                    </div>

                    {/* Transaction Rows */}
                    <div className="border-x border-border">
                      {categoryTransactions.map((transaction, index) => {
                        const status = getPaymentStatus(transaction);
                        const nameParts = (transaction.client_name || "").split(" ");
                        const lastName = nameParts[0] || "";
                        const firstName = nameParts.slice(1).join(" ") || "";
                        
                        // Check if member has exit date
                        const member = customerMembers.find(m => m.name === transaction.client_name);
                        const hasExitDate = member && member.exit_date && new Date(member.exit_date) <= new Date();
                        
                        return (
                          <div 
                            key={transaction.id}
                            className="grid grid-cols-8 border-b border-border hover:bg-accent/50 transition-colors group"
                          >
                            <div className="px-3 py-2 border-r border-border font-medium text-sm flex items-center gap-2">
                              <span className="mr-2">#{String(index + 1).padStart(2, '0')}</span>
                              {hasExitDate && (
                                <Badge variant="destructive" className="text-xs px-1.5 py-0.5">
                                  Terminé
                                </Badge>
                              )}
                              {(transaction as any).is_auto_generated && !(transaction as any).is_validated && (
                                <Badge variant="outline" className="text-xs px-1.5 py-0.5 bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300">
                                  À valider
                                </Badge>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteTransaction.mutate(transaction.id)}
                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                              {(transaction as any).is_auto_generated && !(transaction as any).is_validated && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => updateTransaction.mutate({ 
                                    id: transaction.id, 
                                    is_validated: true 
                                  })}
                                  className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                  ✓ Valider
                                </Button>
                              )}
                            </div>
                            <Input
                              key={`lastname-${transaction.id}`}
                              className="px-3 py-2 border-r border-border border-y-0 border-l-0 rounded-none font-medium uppercase text-sm h-auto focus-visible:ring-1 focus-visible:ring-offset-0 bg-transparent"
                              defaultValue={lastName}
                              onBlur={(e) => {
                                const newLastName = e.target.value.trim();
                                const newFullName = `${newLastName} ${firstName}`.trim();
                                if (newFullName !== transaction.client_name) {
                                  updateTransaction.mutate({ 
                                    id: transaction.id, 
                                    client_name: newFullName 
                                  });
                                }
                              }}
                            />
                            <Input
                              key={`firstname-${transaction.id}`}
                              className="px-3 py-2 border-r border-border border-y-0 border-l-0 rounded-none capitalize text-sm h-auto focus-visible:ring-1 focus-visible:ring-offset-0 bg-transparent"
                              defaultValue={firstName}
                              onBlur={(e) => {
                                const newFirstName = e.target.value.trim();
                                const newFullName = `${lastName} ${newFirstName}`.trim();
                                if (newFullName !== transaction.client_name) {
                                  updateTransaction.mutate({ 
                                    id: transaction.id, 
                                    client_name: newFullName 
                                  });
                                }
                              }}
                            />
                            <Input
                              key={`service-${transaction.id}`}
                              className="px-3 py-2 border-r border-border border-y-0 border-l-0 rounded-none uppercase text-sm h-auto focus-visible:ring-1 focus-visible:ring-offset-0 bg-transparent"
                              defaultValue={transaction.service_description || category}
                              onBlur={(e) => {
                                if (e.target.value !== transaction.service_description) {
                                  updateTransaction.mutate({ 
                                    id: transaction.id, 
                                    service_description: e.target.value 
                                  });
                                }
                              }}
                            />
                            <div className="px-2 py-2 border-r border-border">
                              <Select
                                value={(transaction as any).product_description || ""}
                                onValueChange={(value) => {
                                  updateTransaction.mutate({ 
                                    id: transaction.id, 
                                    product_description: value 
                                  });
                                }}
                              >
                                <SelectTrigger className="h-8 border-0 focus:ring-1 bg-transparent text-sm">
                                  <SelectValue placeholder="Sélectionner" />
                                </SelectTrigger>
                                <SelectContent>
                                  {PRODUCT_DESCRIPTIONS_REVENUE.map((desc) => (
                                    <SelectItem key={desc} value={desc}>
                                      {desc}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <Input
                              key={`amount-${transaction.id}`}
                              type="number"
                              step="0.1"
                              className="px-3 py-2 border-r border-border border-y-0 border-l-0 rounded-none text-right font-medium text-sm h-auto focus-visible:ring-1 focus-visible:ring-offset-0 bg-transparent"
                              defaultValue={transaction.amount}
                              onBlur={(e) => {
                                const newAmount = parseFloat(e.target.value) || 0;
                                if (newAmount !== transaction.amount) {
                                  updateTransaction.mutate({ 
                                    id: transaction.id, 
                                    amount: newAmount 
                                  });
                                }
                              }}
                            />
                            <Input
                              key={`received-${transaction.id}`}
                              type="number"
                              step="0.1"
                              className={`px-3 py-2 border-r border-border border-y-0 border-l-0 rounded-none text-center font-medium text-sm h-auto focus-visible:ring-1 focus-visible:ring-offset-0 ${
                                status === "paid" 
                                  ? "bg-emerald-100 dark:bg-emerald-950/30 text-foreground" 
                                  : status === "pending"
                                  ? "bg-amber-100 dark:bg-amber-950/30 text-foreground"
                                  : "bg-rose-100 dark:bg-rose-950/30 text-foreground"
                              }`}
                              defaultValue={transaction.amount_received || 0}
                              onBlur={(e) => {
                                const newReceived = parseFloat(e.target.value) || 0;
                                if (newReceived !== (transaction.amount_received || 0)) {
                                  updateTransaction.mutate({ 
                                    id: transaction.id, 
                                    amount_received: newReceived 
                                  });
                                }
                              }}
                            />
                            <Input
                              key={`notes-${transaction.id}`}
                              className="px-3 py-2 border-r-0 border-y-0 border-l-0 rounded-none text-sm h-auto focus-visible:ring-1 focus-visible:ring-offset-0 bg-transparent uppercase text-xs"
                              defaultValue={transaction.notes || ""}
                              placeholder="Notes..."
                              onBlur={(e) => {
                                if (e.target.value !== (transaction.notes || "")) {
                                  updateTransaction.mutate({ 
                                    id: transaction.id, 
                                    notes: e.target.value 
                                  });
                                }
                              }}
                            />
                          </div>
                        );
                      })}
                      
                      {/* Add Row Button */}
                      <div className="border-b border-border hover:bg-accent/30 transition-colors">
                        <Button
                          variant="ghost"
                          className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-accent/20 py-3 h-auto rounded-none"
                          onClick={() => {
                            setFormData({
                              transaction_date: format(new Date(), "yyyy-MM-dd"),
                              transaction_type: "revenue",
                              category: category,
                              client_name: "",
                              service_description: "",
                              product_description: "",
                              amount: 0,
                              amount_received: 0,
                              payment_method: "",
                              notes: "",
                            });
                            setIsDialogOpen(true);
                          }}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Ajouter une ligne
                        </Button>
                      </div>
                    </div>

                    {/* Total Row - Subtle Purple */}
                    <div className="bg-purple-100 dark:bg-purple-950/30 text-foreground border-x border-b border-border">
                      <div className="grid grid-cols-8">
                        <div className="px-3 py-2 col-span-5 font-bold uppercase text-sm">
                          TOTAL {category}
                        </div>
                        <div className="px-3 py-2 text-right font-bold text-sm border-l border-border">
                          {totalAmount.toFixed(1)}
                        </div>
                        <div className="px-3 py-2 text-center font-bold text-sm border-l border-border">
                          {totalReceived.toFixed(1)}
                        </div>
                        <div className="px-3 py-2 border-l border-border"></div>
                      </div>
                    </div>

                    {/* Difference Row - Light Gray */}
                    <div className="bg-muted/40 border-x border-b-2 border-border">
                      <div className="grid grid-cols-8">
                        <div className="px-3 py-2 col-span-5 font-bold uppercase text-sm">
                          DIFFERENCE
                        </div>
                        <div className={`px-3 py-2 text-right font-bold col-span-2 text-sm ${
                          difference > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                        }`}>
                          {difference.toFixed(1)}
                        </div>
                        <div className="px-3 py-2"></div>
                      </div>
                    </div>
                  </Card>
                );
              })}

            {/* Hidden Dialog for Quick Add */}
            <Dialog open={isDialogOpen && formData.transaction_type === "revenue"} 
              onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) resetForm();
              }}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingTransaction ? "Modifier" : "Nouveau"} Revenu - {formData.category}
                  </DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Date *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.transaction_date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.transaction_date ? (
                            format(new Date(formData.transaction_date), "dd/MM/yyyy")
                          ) : (
                            <span>Sélectionner une date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.transaction_date ? new Date(formData.transaction_date) : undefined}
                          onSelect={(date) => {
                            if (date) {
                              setFormData({ ...formData, transaction_date: format(date, "yyyy-MM-dd") });
                            }
                          }}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label>Catégorie *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) =>
                        setFormData({ ...formData, category: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                       <SelectContent>
                         {revenueCategories.map((cat) => (
                           <SelectItem key={cat} value={cat}>
                             {cat}
                           </SelectItem>
                         ))}
                       </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Nom du Client</Label>
                    <Input
                      value={formData.client_name}
                      onChange={(e) =>
                        setFormData({ ...formData, client_name: e.target.value })
                      }
                      placeholder="NOM Prénom"
                    />
                  </div>
                  <div>
                    <Label>Description du Produit</Label>
                    <Select
                      value={formData.product_description}
                      onValueChange={(value) =>
                        setFormData({ ...formData, product_description: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRODUCT_DESCRIPTIONS_REVENUE.map((desc) => (
                          <SelectItem key={desc} value={desc}>
                            {desc}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Montant *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) =>
                        setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div>
                    <Label>Montant Reçu</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.amount_received}
                      onChange={(e) =>
                        setFormData({ ...formData, amount_received: parseFloat(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div>
                    <Label>Moyen de Paiement</Label>
                    <Select
                      value={formData.payment_method}
                      onValueChange={(value) =>
                        setFormData({ ...formData, payment_method: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((method) => (
                          <SelectItem key={method} value={method}>
                            {method}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label>Notes</Label>
                    <Input
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-2">
                    <Button onClick={handleSubmit} className="w-full">
                      {editingTransaction ? "Mettre à jour" : "Créer"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="expenses" className="space-y-6">
            {/* Manage Categories Button */}
            <div className="flex justify-end mb-4">
              <Button
                variant="outline"
                onClick={() => {
                  setCategoryDialogType("expense");
                  setIsCategoryDialogOpen(true);
                }}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Gérer les types de dépenses
              </Button>
            </div>

            {/* Expense Tables by Category - Same structure as Revenue */}
            {expenseCategories.map((category) => {
                const categoryTransactions = transactions
                  .filter((t) => t.transaction_type === "expense" && t.category === category);
                
                const totalAmount = categoryTransactions.reduce((sum, t) => sum + t.amount, 0);

                return (
                  <Card key={category} className="overflow-hidden border-0 shadow-none">
                    {/* Header Row - Subtle Gray */}
                    <div className="bg-muted/80 text-foreground border border-border">
                      <div className="grid grid-cols-6">
                        <div className="px-3 py-2 font-bold border-r border-border text-sm">DESCRIPTION</div>
                        <div className="px-3 py-2 font-bold border-r border-border text-sm">DÉTAILS</div>
                        <div className="px-3 py-2 font-bold border-r border-border text-sm">FOURNISSEUR</div>
                        <div className="px-3 py-2 font-bold border-r border-border text-sm">Description Service</div>
                        <div className="px-3 py-2 font-bold border-r border-border text-sm text-right">MONTANT</div>
                        <div className="px-3 py-2 font-bold text-sm text-left">NOTES</div>
                      </div>
                    </div>

                    {/* Category Header - Soft Orange */}
                    <div className="bg-orange-100 dark:bg-orange-950/30 text-foreground border-x border-b border-border">
                      <div className="px-3 py-2 font-bold uppercase text-sm">
                        {category}
                      </div>
                    </div>

                    {/* Transaction Rows */}
                    <div className="border-x border-border">
                      {categoryTransactions.map((transaction, index) => {
                        return (
                          <div 
                            key={transaction.id}
                            className="grid grid-cols-6 border-b border-border hover:bg-accent/50 transition-colors group"
                          >
                            <div className="px-3 py-2 border-r border-border font-medium text-sm flex items-center gap-2">
                              <span className="mr-2">#{String(index + 1).padStart(2, '0')}</span>
                              {(transaction as any).is_auto_generated && !(transaction as any).is_validated && (
                                <Badge variant="outline" className="text-xs px-1.5 py-0.5 bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300">
                                  À valider
                                </Badge>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteTransaction.mutate(transaction.id)}
                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                              {(transaction as any).is_auto_generated && !(transaction as any).is_validated && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => updateTransaction.mutate({ 
                                    id: transaction.id, 
                                    is_validated: true 
                                  })}
                                  className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                  ✓ Valider
                                </Button>
                              )}
                            </div>
                            <Input
                              key={`service-${transaction.id}`}
                              className="px-3 py-2 border-r border-border border-y-0 border-l-0 rounded-none uppercase text-sm h-auto focus-visible:ring-1 focus-visible:ring-offset-0 bg-transparent"
                              defaultValue={transaction.service_description || category}
                              onBlur={(e) => {
                                if (e.target.value !== transaction.service_description) {
                                  updateTransaction.mutate({ 
                                    id: transaction.id, 
                                    service_description: e.target.value 
                                  });
                                }
                              }}
                            />
                            <Input
                              key={`client-${transaction.id}`}
                              className="px-3 py-2 border-r border-border border-y-0 border-l-0 rounded-none text-sm h-auto focus-visible:ring-1 focus-visible:ring-offset-0 bg-transparent"
                              defaultValue={transaction.client_name || ""}
                              onBlur={(e) => {
                                if (e.target.value !== transaction.client_name) {
                                  updateTransaction.mutate({ 
                                    id: transaction.id, 
                                    client_name: e.target.value 
                                  });
                                }
                              }}
                            />
                            <div className="px-2 py-2 border-r border-border">
                              <Select
                                value={(transaction as any).product_description || ""}
                                onValueChange={(value) => {
                                  updateTransaction.mutate({ 
                                    id: transaction.id, 
                                    product_description: value 
                                  });
                                }}
                              >
                                <SelectTrigger className="h-8 border-0 focus:ring-1 bg-transparent text-sm">
                                  <SelectValue placeholder="Sélectionner" />
                                </SelectTrigger>
                                <SelectContent>
                                  {PRODUCT_DESCRIPTIONS_EXPENSE.map((desc) => (
                                    <SelectItem key={desc} value={desc}>
                                      {desc}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <Input
                              key={`amount-${transaction.id}`}
                              type="number"
                              step="0.1"
                              className="px-3 py-2 border-r border-border border-y-0 border-l-0 rounded-none text-right font-medium text-sm h-auto focus-visible:ring-1 focus-visible:ring-offset-0 bg-transparent"
                              defaultValue={transaction.amount}
                              onBlur={(e) => {
                                const newAmount = parseFloat(e.target.value) || 0;
                                if (newAmount !== transaction.amount) {
                                  updateTransaction.mutate({ 
                                    id: transaction.id, 
                                    amount: newAmount 
                                  });
                                }
                              }}
                            />
                            <Input
                              key={`notes-${transaction.id}`}
                              className="px-3 py-2 border-r-0 border-y-0 border-l-0 rounded-none text-sm h-auto focus-visible:ring-1 focus-visible:ring-offset-0 bg-transparent uppercase text-xs"
                              defaultValue={transaction.notes || ""}
                              placeholder="Notes..."
                              onBlur={(e) => {
                                if (e.target.value !== (transaction.notes || "")) {
                                  updateTransaction.mutate({ 
                                    id: transaction.id, 
                                    notes: e.target.value 
                                  });
                                }
                              }}
                            />
                          </div>
                        );
                      })}
                      
                      {/* Add Row Button */}
                      <div className="border-b border-border hover:bg-accent/30 transition-colors">
                        <Button
                          variant="ghost"
                          className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-accent/20 py-3 h-auto rounded-none"
                          onClick={() => {
                            setFormData({
                              transaction_date: format(new Date(), "yyyy-MM-dd"),
                              transaction_type: "expense",
                              category: category,
                              client_name: "",
                              service_description: "",
                              product_description: "",
                              amount: 0,
                              amount_received: 0,
                              payment_method: "",
                              notes: "",
                            });
                            setIsDialogOpen(true);
                          }}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Ajouter une ligne
                        </Button>
                      </div>
                    </div>

                    {/* Total Row - Subtle Purple */}
                    <div className="bg-purple-100 dark:bg-purple-950/30 text-foreground border-x border-b-2 border-border">
                      <div className="grid grid-cols-6">
                        <div className="px-3 py-2 col-span-4 font-bold uppercase text-sm">
                          TOTAL {category}
                        </div>
                        <div className="px-3 py-2 text-right font-bold text-sm border-l border-border">
                          {totalAmount.toFixed(1)}
                        </div>
                        <div className="px-3 py-2 border-l border-border"></div>
                      </div>
                    </div>
                  </Card>
                );
              })}

            {/* Hidden Dialog for Quick Add */}
            <Dialog open={isDialogOpen && formData.transaction_type === "expense"} 
              onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) resetForm();
              }}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingTransaction ? "Modifier" : "Nouvelle"} Dépense - {formData.category}
                  </DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Date *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.transaction_date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.transaction_date ? (
                            format(new Date(formData.transaction_date), "dd/MM/yyyy")
                          ) : (
                            <span>Sélectionner une date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.transaction_date ? new Date(formData.transaction_date) : undefined}
                          onSelect={(date) => {
                            if (date) {
                              setFormData({ ...formData, transaction_date: format(date, "yyyy-MM-dd") });
                            }
                          }}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label>Catégorie *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) =>
                        setFormData({ ...formData, category: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                       <SelectContent>
                         {expenseCategories.map((cat) => (
                           <SelectItem key={cat} value={cat}>
                             {cat}
                           </SelectItem>
                         ))}
                       </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label>Description</Label>
                    <Input
                      value={formData.service_description}
                      onChange={(e) =>
                        setFormData({ ...formData, service_description: e.target.value })
                      }
                      placeholder="Description de la dépense"
                    />
                  </div>
                  <div>
                    <Label>Description du Produit</Label>
                    <Select
                      value={formData.product_description}
                      onValueChange={(value) =>
                        setFormData({ ...formData, product_description: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRODUCT_DESCRIPTIONS_EXPENSE.map((desc) => (
                          <SelectItem key={desc} value={desc}>
                            {desc}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Fournisseur</Label>
                    <Input
                      value={formData.client_name}
                      onChange={(e) =>
                        setFormData({ ...formData, client_name: e.target.value })
                      }
                      placeholder="Nom du fournisseur"
                    />
                  </div>
                  <div>
                    <Label>Montant *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) =>
                        setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div>
                    <Label>Moyen de Paiement</Label>
                    <Select
                      value={formData.payment_method}
                      onValueChange={(value) =>
                        setFormData({ ...formData, payment_method: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((method) => (
                          <SelectItem key={method} value={method}>
                            {method}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label>Notes</Label>
                    <Input
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-2">
                    <Button onClick={handleSubmit} className="w-full">
                      {editingTransaction ? "Mettre à jour" : "Créer"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="unpaid" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-amber-500">⚠️</span>
                  Transactions Impayées ou En Attente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Catégorie</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Reçu</TableHead>
                      <TableHead>Reste à Encaisser</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unpaidTransactions.map((transaction) => {
                      const status = getPaymentStatus(transaction);
                      const remaining = transaction.amount - (transaction.amount_received || 0);
                      return (
                        <TableRow key={transaction.id} className={status === "unpaid" ? "bg-destructive/5" : "bg-secondary/5"}>
                          <TableCell>
                            {format(new Date(transaction.transaction_date), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell>
                            <Badge variant={status === "pending" ? "secondary" : "destructive"}>
                              {status === "pending" ? "En attente" : "Impayé"}
                            </Badge>
                          </TableCell>
                          <TableCell>{transaction.category}</TableCell>
                          <TableCell className="font-medium">{transaction.client_name}</TableCell>
                          <TableCell>{transaction.service_description}</TableCell>
                          <TableCell>CHF {transaction.amount.toFixed(2)}</TableCell>
                          <TableCell className="text-emerald-600 dark:text-emerald-400">
                            CHF {(transaction.amount_received || 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="font-semibold text-amber-600 dark:text-amber-400">
                            CHF {remaining.toFixed(2)}
                          </TableCell>
                          <TableCell className="max-w-[200px]">
                            {transaction.notes ? (
                              <span className="text-sm">{transaction.notes}</span>
                            ) : (
                              <span className="text-muted-foreground italic text-sm">Aucune note</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEdit(transaction)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => deleteTransaction.mutate(transaction.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {unpaidTransactions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                          Aucune transaction impayée 🎉
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="all" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Toutes les Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Catégorie</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          {format(new Date(transaction.transaction_date), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell>
                          <span
                            className={
                              transaction.transaction_type === "revenue"
                                ? "text-green-600 font-medium"
                                : "text-red-600 font-medium"
                            }
                          >
                            {transaction.transaction_type === "revenue" ? "Revenu" : "Dépense"}
                          </span>
                        </TableCell>
                        <TableCell>{transaction.category}</TableCell>
                        <TableCell>
                          {transaction.client_name && `${transaction.client_name} - `}
                          {transaction.service_description}
                        </TableCell>
                        <TableCell>CHF {transaction.amount.toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(transaction)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteTransaction.mutate(transaction.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Category Management Dialog */}
        <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                Gérer les types de {categoryDialogType === "revenue" ? "revenus" : "dépenses"}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Add new category */}
              <div className="flex gap-2">
                <Input
                  placeholder={`Nouveau type de ${categoryDialogType === "revenue" ? "revenu" : "dépense"}`}
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      handleAddCategory();
                    }
                  }}
                />
                <Button onClick={handleAddCategory}>
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter
                </Button>
              </div>

              {/* List existing categories with drag and drop */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <div className="border rounded-md max-h-[400px] overflow-y-auto">
                  <SortableContext
                    items={categoryDialogType === "revenue" ? revenueCategories : expenseCategories}
                    strategy={verticalListSortingStrategy}
                  >
                     {(categoryDialogType === "revenue" ? revenueCategories : expenseCategories).map((category, index) => {
                       const categoryData = allCategories.find(c => c.name === category && c.type === categoryDialogType);
                       return (
                         <SortableCategoryItem
                           key={category}
                           category={category}
                           categoryData={categoryData ? {
                             is_recurring: categoryData.is_recurring,
                             is_indefinite_recurrence: categoryData.is_indefinite_recurrence,
                             recurrence_end_date: categoryData.recurrence_end_date
                           } : undefined}
                           index={index}
                           isEditing={editingCategoryIndex === index}
                           editingName={editingCategoryName}
                           editingRecurring={editingCategoryRecurring}
                           editingIndefinite={editingCategoryIndefinite}
                           editingEndDate={editingCategoryEndDate}
                           onStartEdit={() => handleStartEditCategory(index, category)}
                           onSaveEdit={() => handleSaveEditCategory(category, categoryDialogType)}
                           onCancelEdit={handleCancelEditCategory}
                           onDelete={() => handleDeleteCategory(category, categoryDialogType)}
                           onEditNameChange={setEditingCategoryName}
                           onEditRecurringChange={(checked) => {
                             setEditingCategoryRecurring(checked);
                             if (checked) {
                               setEditingCategoryIndefinite(true);
                               setEditingCategoryEndDate(null);
                             }
                           }}
                           onEditIndefiniteChange={setEditingCategoryIndefinite}
                           onEditEndDateChange={setEditingCategoryEndDate}
                           onToggleEndDate={() => {
                             if (editingCategoryEndDate) {
                               setEditingCategoryEndDate(null);
                               setEditingCategoryIndefinite(true);
                             } else {
                               setEditingCategoryIndefinite(false);
                               setEditingCategoryEndDate(new Date().toISOString().split('T')[0]);
                             }
                           }}
                         />
                       );
                     })}
                  </SortableContext>
                </div>
              </DndContext>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Accounting;
