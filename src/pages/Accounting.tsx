import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useAccountingTransactions, type AccountingTransaction } from "@/hooks/useAccountingTransactions";
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
    invoice_number: "",
    notes: "",
  });

  const { transactions, isLoading, createTransaction, updateTransaction, deleteTransaction } =
    useAccountingTransactions(selectedYear, selectedMonth);

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
      invoice_number: "",
      notes: "",
    });
    setEditingTransaction(null);
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
      invoice_number: transaction.invoice_number || "",
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
    const grouped: Record<string, number> = {};
    transactions
      .filter((t) => t.transaction_type === "revenue")
      .forEach((t) => {
        grouped[t.category] = (grouped[t.category] || 0) + t.amount;
      });
    return grouped;
  }, [transactions]);

  const expensesByCategory = useMemo(() => {
    const grouped: Record<string, number> = {};
    transactions
      .filter((t) => t.transaction_type === "expense")
      .forEach((t) => {
        grouped[t.category] = (grouped[t.category] || 0) + t.amount;
      });
    return grouped;
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

        <div className="flex gap-4">
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
        </div>

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList>
            <TabsTrigger value="dashboard">Tableau de Bord</TabsTrigger>
            <TabsTrigger value="revenues">Revenus</TabsTrigger>
            <TabsTrigger value="expenses">Dépenses</TabsTrigger>
            <TabsTrigger value="all">Toutes les Transactions</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Revenus Totaux</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">CHF {summary.totalRevenue.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">
                    {summary.revenueCount} transactions
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Revenus Reçus</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">CHF {summary.totalRevenueReceived.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">
                    Encaissés
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Dépenses Totales</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">CHF {summary.totalExpenses.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">
                    {summary.expenseCount} transactions
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Profit</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-3xl font-bold ${summary.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    CHF {summary.profit.toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Revenus - Dépenses
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Revenus par Catégorie</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Catégorie</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(revenuesByCategory).map(([category, amount]) => (
                        <TableRow key={category}>
                          <TableCell>{category}</TableCell>
                          <TableCell className="text-right font-medium">
                            CHF {amount.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Dépenses par Catégorie</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Catégorie</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(expensesByCategory).map(([category, amount]) => (
                        <TableRow key={category}>
                          <TableCell>{category}</TableCell>
                          <TableCell className="text-right font-medium">
                            CHF {amount.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="revenues" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Revenus</CardTitle>
                  <Dialog open={isDialogOpen && formData.transaction_type === "revenue"} 
                    onOpenChange={(open) => {
                      setIsDialogOpen(open);
                      if (!open) resetForm();
                    }}>
                    <DialogTrigger asChild>
                      <Button onClick={() => {
                        resetForm();
                        setFormData(prev => ({ ...prev, transaction_type: "revenue" }));
                      }}>
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
                          <Label>N° Facture</Label>
                          <Input
                            value={formData.invoice_number}
                            onChange={(e) =>
                              setFormData({ ...formData, invoice_number: e.target.value })
                            }
                            placeholder="Ex: #01"
                          />
                        </div>
                        <div>
                          <Label>Nom Client</Label>
                          <Input
                            value={formData.client_name}
                            onChange={(e) =>
                              setFormData({ ...formData, client_name: e.target.value })
                            }
                          />
                        </div>
                        <div className="col-span-2">
                          <Label>Description du Service</Label>
                          <Input
                            value={formData.service_description}
                            onChange={(e) =>
                              setFormData({ ...formData, service_description: e.target.value })
                            }
                            placeholder="Ex: Exploitation, Personal Training"
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
                              setFormData({
                                ...formData,
                                amount_received: parseFloat(e.target.value) || 0,
                              })
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
                      <TableHead>N° Facture</TableHead>
                      <TableHead>Catégorie</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Reçu</TableHead>
                      <TableHead>Paiement</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions
                      .filter((t) => t.transaction_type === "revenue")
                      .map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell>
                            {format(new Date(transaction.transaction_date), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell>{transaction.invoice_number}</TableCell>
                          <TableCell>{transaction.category}</TableCell>
                          <TableCell>{transaction.client_name}</TableCell>
                          <TableCell>{transaction.service_description}</TableCell>
                          <TableCell>CHF {transaction.amount.toFixed(2)}</TableCell>
                          <TableCell>CHF {(transaction.amount_received || 0).toFixed(2)}</TableCell>
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
