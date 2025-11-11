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
  "Coach Pass Mensuel",
  "Coach Pass One Shot",
  "Open Gym Mensuel",
  "Open Gym Annuel",
  "Unlimited Access Mensuel",
  "Unlimited Access Annuel",
  "Unlimited Access Duo Mensuel",
  "Unlimited Access Duo Annuel",
  "Unlimited Access Sans Engagement",
  "Hybrid FULL",
  "Offre 6 Mois",
  "Offre 3 Mois",
  "Pack 20 Sessions",
  "Pack 10 Sessions",
  "6 Weeks Challenge",
  "PT - Personal Training",
  "Retail",
  "Fast Cash",
  "Autre",
];

const EXPENSE_CATEGORIES = [
  "Salaires",
  "Loyer",
  "Réparations & Maintenance",
  "Informatique & Logiciels",
  "Internet & Téléphone",
  "Fournitures",
  "Utilities (Electricité, Eau, etc.)",
  "Publicité & Marketing",
  "Services Professionnels",
  "Donations",
  "Abonnements",
  "Frais Bancaires",
  "Assurances",
  "Remboursement Crédit",
  "Nourriture",
  "Autre",
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

  const handleGenerateMonth = () => {
    generateMonthlyTransactions.mutate({ year: selectedYear, month: selectedMonth });
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
              {[2023, 2024, 2025, 2026].map((year) => (
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
            onClick={handleGenerateMonth}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Générer le Mois
          </Button>
        </div>

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList>
            <TabsTrigger value="dashboard">Tableau de Bord</TabsTrigger>
            <TabsTrigger value="revenues">Revenus</TabsTrigger>
            <TabsTrigger value="expenses">Dépenses</TabsTrigger>
            <TabsTrigger value="unpaid">Impayés ({unpaidTransactions.length})</TabsTrigger>
            <TabsTrigger value="recurring">Récurrences</TabsTrigger>
            <TabsTrigger value="all">Toutes les Transactions</TabsTrigger>
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
            {/* Revenue Tables by Category */}
            {Object.entries(revenuesByCategory)
              .sort((a, b) => b[1].amount - a[1].amount)
              .map(([category]) => {
                const categoryTransactions = transactions
                  .filter((t) => t.transaction_type === "revenue" && t.category === category);
                
                const totalAmount = categoryTransactions.reduce((sum, t) => sum + t.amount, 0);
                const totalReceived = categoryTransactions.reduce((sum, t) => sum + (t.amount_received || 0), 0);
                const difference = totalAmount - totalReceived;

                return (
                  <Card key={category} className="overflow-hidden">
                    {/* Header Row - Red */}
                    <div className="bg-[hsl(348,100%,50%)] text-white">
                      <div className="grid grid-cols-7 border-b border-white/20">
                        <div className="px-4 py-3 font-bold border-r border-white/20">NOM DU SERVICE</div>
                        <div className="px-4 py-3 font-bold border-r border-white/20">NOM</div>
                        <div className="px-4 py-3 font-bold border-r border-white/20">Prénom</div>
                        <div className="px-4 py-3 font-bold border-r border-white/20">Prestation</div>
                        <div className="px-4 py-3 font-bold border-r border-white/20 text-right">Montant</div>
                        <div className="px-4 py-3 font-bold border-r border-white/20 text-center">État</div>
                        <div className="px-4 py-3 font-bold text-left">Réglé le</div>
                      </div>
                    </div>

                    {/* Category Header - Cyan */}
                    <div className="bg-[hsl(180,100%,70%)] text-black border-b-2 border-[hsl(180,100%,60%)]">
                      <div className="px-4 py-2 font-bold uppercase">
                        {category}
                      </div>
                    </div>

                    {/* Transaction Rows */}
                    <div>
                      {categoryTransactions.map((transaction, index) => {
                        const status = getPaymentStatus(transaction);
                        const [lastName = "", firstName = ""] = (transaction.client_name || "").split(" ");
                        
                        return (
                          <div 
                            key={transaction.id}
                            className={`grid grid-cols-7 border-b border-border/50 ${
                              index % 2 === 0 ? "bg-background" : "bg-muted/30"
                            }`}
                          >
                            <div className="px-4 py-3 border-r border-border/50 font-medium">
                              #{String(index + 1).padStart(2, '0')}
                            </div>
                            <div className="px-4 py-3 border-r border-border/50 font-medium uppercase">
                              {lastName}
                            </div>
                            <div className="px-4 py-3 border-r border-border/50 capitalize">
                              {firstName}
                            </div>
                            <div className="px-4 py-3 border-r border-border/50 uppercase">
                              {transaction.service_description || category}
                            </div>
                            <div className="px-4 py-3 border-r border-border/50 text-right font-medium">
                              {transaction.amount.toFixed(1)}
                            </div>
                            <div className="px-4 py-3 border-r border-border/50 text-center">
                              <span className={`inline-block px-3 py-1 rounded font-medium ${
                                status === "paid" 
                                  ? "bg-[hsl(120,60%,70%)] text-black" 
                                  : status === "pending"
                                  ? "bg-[hsl(45,100%,70%)] text-black"
                                  : "bg-[hsl(0,60%,70%)] text-black"
                              }`}>
                                {(transaction.amount_received || 0).toFixed(1)}
                              </span>
                            </div>
                            <div className="px-4 py-3 text-sm">
                              <div className="flex flex-col gap-1">
                                <span className="uppercase text-xs text-muted-foreground">
                                  {transaction.notes}
                                </span>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleEdit(transaction)}
                                    className="h-7 px-2"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => deleteTransaction.mutate(transaction.id)}
                                    className="h-7 px-2 text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Total Row - Magenta */}
                    <div className="bg-[hsl(328,100%,70%)] text-black border-y-2 border-[hsl(328,100%,60%)]">
                      <div className="grid grid-cols-7">
                        <div className="px-4 py-3 col-span-4 font-bold uppercase">
                          TOTAL {category}
                        </div>
                        <div className="px-4 py-3 text-right font-bold">
                          {totalAmount.toFixed(1)}
                        </div>
                        <div className="px-4 py-3 text-center font-bold">
                          {totalReceived.toFixed(1)}
                        </div>
                        <div className="px-4 py-3"></div>
                      </div>
                    </div>

                    {/* Difference Row - Gray */}
                    <div className="bg-muted/60 border-b border-border">
                      <div className="grid grid-cols-7">
                        <div className="px-4 py-3 col-span-4 font-bold uppercase">
                          DIFFERENCE
                        </div>
                        <div className={`px-4 py-3 text-right font-bold col-span-2 ${
                          difference > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                        }`}>
                          {difference.toFixed(1)}
                        </div>
                        <div className="px-4 py-3"></div>
                      </div>
                    </div>
                  </Card>
                );
              })}

            {/* Add Transaction Button */}
            <Card>
              <CardContent className="pt-6">
                <Dialog open={isDialogOpen && formData.transaction_type === "revenue"} 
                  onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) resetForm();
                  }}>
                  <DialogTrigger asChild>
                    <Button onClick={() => {
                      resetForm();
                      setFormData(prev => ({ ...prev, transaction_type: "revenue" }));
                    }} className="w-full">
                      <Plus className="mr-2 h-4 w-4" />
                      Ajouter un Revenu
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>
                        {editingTransaction ? "Modifier" : "Nouveau"} Revenu
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="expenses" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Dépenses</CardTitle>
                  <Dialog open={isDialogOpen && formData.transaction_type === "expense"} 
                    onOpenChange={(open) => {
                      setIsDialogOpen(open);
                      if (!open) resetForm();
                    }}>
                    <DialogTrigger asChild>
                      <Button onClick={() => {
                        resetForm();
                        setFormData(prev => ({ ...prev, transaction_type: "expense" }));
                      }}>
                        <Plus className="mr-2 h-4 w-4" />
                        Ajouter une Dépense
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>
                          {editingTransaction ? "Modifier" : "Nouvelle"} Dépense
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
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Catégorie</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Paiement</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions
                      .filter((t) => t.transaction_type === "expense")
                      .map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell>
                            {format(new Date(transaction.transaction_date), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell>{transaction.category}</TableCell>
                          <TableCell>{transaction.service_description}</TableCell>
                          <TableCell>CHF {transaction.amount.toFixed(2)}</TableCell>
                          <TableCell>{transaction.payment_method}</TableCell>
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
