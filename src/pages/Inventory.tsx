import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PageSkeleton } from "@/components/TableSkeleton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Package, CheckCircle2, AlertTriangle } from "lucide-react";
import { useInventory } from "@/hooks/useInventory";
import { cn } from "@/lib/utils";

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

const Inventory = () => {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());

  const {
    items,
    loading,
    addItem,
    updateItem,
    deleteItem,
    upsertCheck,
    getCheckForItem,
  } = useInventory(selectedYear, selectedMonth);

  // Add item dialog
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newQuantity, setNewQuantity] = useState(1);
  const [newCategory, setNewCategory] = useState("");
  const [newUnit, setNewUnit] = useState("unité");

  // Edit item dialog
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");
  const [editQuantity, setEditQuantity] = useState(1);
  const [editCategory, setEditCategory] = useState("");
  const [editUnit, setEditUnit] = useState("unité");

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleAddItem = async () => {
    if (!newName.trim()) return;
    const success = await addItem(newName.trim(), newQuantity, newCategory, newUnit);
    if (success) {
      setIsAddOpen(false);
      setNewName("");
      setNewQuantity(1);
      setNewCategory("");
      setNewUnit("unité");
    }
  };

  const handleEditItem = async () => {
    if (!editName.trim()) return;
    const success = await updateItem(editId, {
      name: editName.trim(),
      expected_quantity: editQuantity,
      category: editCategory || null,
      unit: editUnit,
    });
    if (success) setIsEditOpen(false);
  };

  const openEdit = (item: typeof items[0]) => {
    setEditId(item.id);
    setEditName(item.name);
    setEditQuantity(item.expected_quantity);
    setEditCategory(item.category || "");
    setEditUnit(item.unit || "unité");
    setIsEditOpen(true);
  };

  const handleQuantityChange = async (itemId: string, value: string) => {
    const qty = parseInt(value);
    if (isNaN(qty) || qty < 0) return;
    await upsertCheck(itemId, qty);
  };

  // Stats
  const totalItems = items.length;
  const checkedItems = items.filter((item) => getCheckForItem(item.id)).length;
  const missingItems = items.filter((item) => {
    const check = getCheckForItem(item.id);
    return check && check.actual_quantity < item.expected_quantity;
  }).length;
  const okItems = items.filter((item) => {
    const check = getCheckForItem(item.id);
    return check && check.actual_quantity >= item.expected_quantity;
  }).length;

  // Group by category
  const categories = [...new Set(items.map((i) => i.category || "Sans catégorie"))];

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Breadcrumbs />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-heading">Inventaire</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Suivi mensuel du matériel — {MONTHS[selectedMonth]} {selectedYear}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LanguageToggle />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(Number(v))}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[2024, 2025, 2026, 2027].map((y) => (
              <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(Number(v))}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((m, i) => (
              <SelectItem key={i} value={i.toString()}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setIsAddOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Ajouter du matériel
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-2xl font-semibold">{totalItems}</p>
              <p className="text-xs text-muted-foreground">Total matériel</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-[hsl(142,71%,45%)]" />
            <div>
              <p className="text-2xl font-semibold text-[hsl(142,71%,45%)]">{okItems}</p>
              <p className="text-xs text-muted-foreground">Complet</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-2xl font-semibold text-destructive">{missingItems}</p>
              <p className="text-xs text-muted-foreground">Manquant</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-2xl font-semibold">{checkedItems}/{totalItems}</p>
              <p className="text-xs text-muted-foreground">Vérifié</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inventory table */}
      {items.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Aucun matériel enregistré</p>
            <Button className="mt-4" onClick={() => setIsAddOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Ajouter du matériel
            </Button>
          </CardContent>
        </Card>
      ) : (
        categories.map((cat) => {
          const catItems = items.filter((i) => (i.category || "Sans catégorie") === cat);
          return (
            <Card key={cat}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">{cat}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Matériel</TableHead>
                      <TableHead className="text-center w-[120px]">Attendu</TableHead>
                      <TableHead className="text-center w-[140px]">Réel ({MONTHS[selectedMonth]})</TableHead>
                      <TableHead className="text-center w-[100px]">Statut</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {catItems.map((item) => {
                      const check = getCheckForItem(item.id);
                      const actual = check?.actual_quantity;
                      const isChecked = actual !== undefined;
                      const isOk = isChecked && actual >= item.expected_quantity;
                      const isMissing = isChecked && actual < item.expected_quantity;

                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {item.name}
                            {item.unit && item.unit !== "unité" && (
                              <span className="text-muted-foreground text-xs ml-1">({item.unit})</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center font-semibold">
                            {item.expected_quantity}
                          </TableCell>
                          <TableCell className="text-center">
                            <Input
                              type="number"
                              min={0}
                              value={actual ?? ""}
                              onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                              placeholder="—"
                              className={cn(
                                "w-20 mx-auto text-center font-semibold",
                                isOk && "text-[hsl(142,71%,45%)] border-[hsl(142,71%,45%)]/50",
                                isMissing && "text-destructive border-destructive/50"
                              )}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            {!isChecked ? (
                              <Badge variant="outline" className="text-xs">Non vérifié</Badge>
                            ) : isOk ? (
                              <Badge className="bg-[hsl(142,71%,45%)] text-white text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1" /> OK
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-xs">
                                <AlertTriangle className="h-3 w-3 mr-1" /> -{item.expected_quantity - actual!}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(item)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                onClick={() => setDeleteId(item.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter du matériel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nom *</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Tapis de yoga" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Quantité attendue</Label>
                <Input type="number" min={1} value={newQuantity} onChange={(e) => setNewQuantity(Number(e.target.value))} />
              </div>
              <div>
                <Label>Unité</Label>
                <Input value={newUnit} onChange={(e) => setNewUnit(e.target.value)} placeholder="unité" />
              </div>
            </div>
            <div>
              <Label>Catégorie</Label>
              <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Ex: Fitness, Musculation..." />
            </div>
            <Button onClick={handleAddItem} className="w-full" disabled={!newName.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Ajouter
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le matériel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nom *</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Quantité attendue</Label>
                <Input type="number" min={1} value={editQuantity} onChange={(e) => setEditQuantity(Number(e.target.value))} />
              </div>
              <div>
                <Label>Unité</Label>
                <Input value={editUnit} onChange={(e) => setEditUnit(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Catégorie</Label>
              <Input value={editCategory} onChange={(e) => setEditCategory(e.target.value)} />
            </div>
            <Button onClick={handleEditItem} className="w-full" disabled={!editName.trim()}>
              Enregistrer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) await deleteItem(deleteId);
          setDeleteId(null);
        }}
        title="Supprimer ce matériel ?"
        description="Cette action est irréversible. Le matériel sera retiré de l'inventaire."
      />
    </div>
  );
};

export default Inventory;
