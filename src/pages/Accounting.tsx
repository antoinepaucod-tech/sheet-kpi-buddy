import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useAccountingTransactions, type AccountingTransaction } from "@/hooks/useAccountingTransactions";
import { useRecurringTransactions, type RecurringTransaction } from "@/hooks/useRecurringTransactions";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { format } from "date-fns";

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

const REVENUE_CATEGORIES = [
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

const EXPENSE_CATEGORIES = [
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

const PAYMENT_METHODS = [
  "Virement Bancaire",
  "Carte Bancaire",
  "Espèces",
  "Prélèvement Automatique",
  "Autre",
];

const Accounting = () => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<AccountingTransaction | null>(null);
  const [formData, setFormData] = useState({
    transaction_date: format(new Date(), "yyyy-MM-dd"),
    transaction_type: "revenue" as "revenue" | "expense",
    category: "",
    client_name: "",
    service_description: "",
    amount: 0,
    amount_received: 0,
    payment_method: "",
    notes: "",
  });

  const { transactions, isLoading, createTransaction, updateTransaction, deleteTransaction } =
    useAccountingTransactions(selectedYear, selectedMonth);

  const { 
    recurringTransactions, 
    createRecurring, 
    updateRecurring, 
    deleteRecurring,
    generateMonthlyTransactions 
  } = useRecurringTransactions();

  const [isRecurringDialogOpen, setIsRecurringDialogOpen] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringTransaction | null>(null);
  const [recurringFormData, setRecurringFormData] = useState({
    transaction_type: "revenue" as "revenue" | "expense",
    category: "",
    client_name: "",
    service_description: "",
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
      amount: recurring.amount,
      amount_received: recurring.amount_received || 0,
      payment_method: recurring.payment_method || "",
      notes: recurring.notes || "",
      recurrence_day: recurring.recurrence_day,
      is_active: recurring.is_active,
    });
    setIsRecurringDialogOpen(true);
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
      amount: transaction.amount,
      amount_received: transaction.amount_received || 0,
      payment_method: transaction.payment_method || "",
      notes: transaction.notes || "",
    });
    setIsDialogOpen(true);
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
            {/* Revenue Tables by Category - Show ALL categories */}
            {REVENUE_CATEGORIES.map((category) => {
                const categoryTransactions = transactions
                  .filter((t) => t.transaction_type === "revenue" && t.category === category);
                
                const totalAmount = categoryTransactions.reduce((sum, t) => sum + t.amount, 0);
                const totalReceived = categoryTransactions.reduce((sum, t) => sum + (t.amount_received || 0), 0);
                const difference = totalAmount - totalReceived;

                return (
                  <Card key={category} className="overflow-hidden border-0 shadow-none">
                    {/* Header Row - Subtle Gray */}
                    <div className="bg-muted/80 text-foreground border border-border">
                      <div className="grid grid-cols-7">
                        <div className="px-3 py-2 font-bold border-r border-border text-sm">NOM DU SERVICE</div>
                        <div className="px-3 py-2 font-bold border-r border-border text-sm">NOM</div>
                        <div className="px-3 py-2 font-bold border-r border-border text-sm">Prénom</div>
                        <div className="px-3 py-2 font-bold border-r border-border text-sm">Prestation</div>
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
                        
                        return (
                          <div 
                            key={transaction.id}
                            className="grid grid-cols-7 border-b border-border hover:bg-accent/50 transition-colors group"
                          >
                            <div className="px-3 py-2 border-r border-border font-medium text-sm flex items-center">
                              <span className="mr-2">#{String(index + 1).padStart(2, '0')}</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteTransaction.mutate(transaction.id)}
                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
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
                      <div className="grid grid-cols-7">
                        <div className="px-3 py-2 col-span-4 font-bold uppercase text-sm">
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
                      <div className="grid grid-cols-7">
                        <div className="px-3 py-2 col-span-4 font-bold uppercase text-sm">
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
                    <Input
                      type="date"
                      value={formData.transaction_date}
                      onChange={(e) =>
                        setFormData({ ...formData, transaction_date: e.target.value })
                      }
                    />
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
                        {REVENUE_CATEGORIES.map((cat) => (
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
                    <Label>Description du Service</Label>
                    <Input
                      value={formData.service_description}
                      onChange={(e) =>
                        setFormData({ ...formData, service_description: e.target.value })
                      }
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
            {/* Expense Tables by Category - Same structure as Revenue */}
            {EXPENSE_CATEGORIES.map((category) => {
                const categoryTransactions = transactions
                  .filter((t) => t.transaction_type === "expense" && t.category === category);
                
                const totalAmount = categoryTransactions.reduce((sum, t) => sum + t.amount, 0);

                return (
                  <Card key={category} className="overflow-hidden border-0 shadow-none">
                    {/* Header Row - Subtle Gray */}
                    <div className="bg-muted/80 text-foreground border border-border">
                      <div className="grid grid-cols-5">
                        <div className="px-3 py-2 font-bold border-r border-border text-sm">DESCRIPTION</div>
                        <div className="px-3 py-2 font-bold border-r border-border text-sm">DÉTAILS</div>
                        <div className="px-3 py-2 font-bold border-r border-border text-sm">FOURNISSEUR</div>
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
                            className="grid grid-cols-5 border-b border-border hover:bg-accent/50 transition-colors group"
                          >
                            <div className="px-3 py-2 border-r border-border font-medium text-sm flex items-center">
                              <span className="mr-2">#{String(index + 1).padStart(2, '0')}</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteTransaction.mutate(transaction.id)}
                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
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
                      <div className="grid grid-cols-5">
                        <div className="px-3 py-2 col-span-3 font-bold uppercase text-sm">
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
                    <Input
                      type="date"
                      value={formData.transaction_date}
                      onChange={(e) =>
                        setFormData({ ...formData, transaction_date: e.target.value })
                      }
                    />
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
                        {EXPENSE_CATEGORIES.map((cat) => (
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

          <TabsContent value="recurring" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Transactions Récurrentes</CardTitle>
                  <Dialog open={isRecurringDialogOpen} onOpenChange={(open) => {
                    setIsRecurringDialogOpen(open);
                    if (!open) resetRecurringForm();
                  }}>
                    <DialogTrigger asChild>
                      <Button onClick={resetRecurringForm}>
                        <Plus className="mr-2 h-4 w-4" />
                        Ajouter une Récurrence
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>
                          {editingRecurring ? "Modifier" : "Nouvelle"} Transaction Récurrente
                        </DialogTitle>
                      </DialogHeader>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Type *</Label>
                          <Select
                            value={recurringFormData.transaction_type}
                            onValueChange={(value: "revenue" | "expense") =>
                              setRecurringFormData({ ...recurringFormData, transaction_type: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="revenue">Revenu</SelectItem>
                              <SelectItem value="expense">Dépense</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Catégorie *</Label>
                          <Select
                            value={recurringFormData.category}
                            onValueChange={(value) =>
                              setRecurringFormData({ ...recurringFormData, category: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner" />
                            </SelectTrigger>
                            <SelectContent>
                              {(recurringFormData.transaction_type === "revenue" 
                                ? REVENUE_CATEGORIES 
                                : EXPENSE_CATEGORIES
                              ).map((cat) => (
                                <SelectItem key={cat} value={cat}>
                                  {cat}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Nom Client</Label>
                          <Input
                            value={recurringFormData.client_name}
                            onChange={(e) =>
                              setRecurringFormData({ ...recurringFormData, client_name: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <Label>Description du Service</Label>
                          <Input
                            value={recurringFormData.service_description}
                            onChange={(e) =>
                              setRecurringFormData({ ...recurringFormData, service_description: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <Label>Montant *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={recurringFormData.amount}
                            onChange={(e) =>
                              setRecurringFormData({ ...recurringFormData, amount: parseFloat(e.target.value) || 0 })
                            }
                          />
                        </div>
                        <div>
                          <Label>Montant Reçu (par défaut)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={recurringFormData.amount_received}
                            onChange={(e) =>
                              setRecurringFormData({ ...recurringFormData, amount_received: parseFloat(e.target.value) || 0 })
                            }
                          />
                        </div>
                        <div>
                          <Label>Moyen de Paiement</Label>
                          <Select
                            value={recurringFormData.payment_method}
                            onValueChange={(value) =>
                              setRecurringFormData({ ...recurringFormData, payment_method: value })
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
                        <div>
                          <Label>Jour du Mois (1-31)</Label>
                          <Input
                            type="number"
                            min="1"
                            max="31"
                            value={recurringFormData.recurrence_day}
                            onChange={(e) =>
                              setRecurringFormData({ ...recurringFormData, recurrence_day: parseInt(e.target.value) || 1 })
                            }
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={recurringFormData.is_active}
                            onCheckedChange={(checked) =>
                              setRecurringFormData({ ...recurringFormData, is_active: checked })
                            }
                          />
                          <Label>Active</Label>
                        </div>
                        <div className="col-span-2">
                          <Label>Notes</Label>
                          <Input
                            value={recurringFormData.notes}
                            onChange={(e) =>
                              setRecurringFormData({ ...recurringFormData, notes: e.target.value })
                            }
                          />
                        </div>
                        <div className="col-span-2">
                          <Button onClick={handleRecurringSubmit} className="w-full">
                            {editingRecurring ? "Mettre à jour" : "Créer"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Active</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Catégorie</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Jour</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recurringTransactions.map((recurring) => (
                      <TableRow key={recurring.id}>
                        <TableCell>
                          <Switch
                            checked={recurring.is_active}
                            onCheckedChange={(checked) =>
                              updateRecurring.mutate({ id: recurring.id, is_active: checked })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <span
                            className={
                              recurring.transaction_type === "revenue"
                                ? "text-green-600 font-medium"
                                : "text-red-600 font-medium"
                            }
                          >
                            {recurring.transaction_type === "revenue" ? "Revenu" : "Dépense"}
                          </span>
                        </TableCell>
                        <TableCell>{recurring.category}</TableCell>
                        <TableCell>{recurring.client_name}</TableCell>
                        <TableCell>{recurring.service_description}</TableCell>
                        <TableCell>CHF {recurring.amount.toFixed(2)}</TableCell>
                        <TableCell>{recurring.recurrence_day}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditRecurring(recurring)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteRecurring.mutate(recurring.id)}
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
      </div>
    </div>
  );
};

export default Accounting;
