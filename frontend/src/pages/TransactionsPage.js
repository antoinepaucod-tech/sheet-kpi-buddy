import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp, Loader2, RotateCcw, Download, Search, Upload, Pencil, Filter, ExternalLink, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { AddTransactionModal } from "../components/AddTransactionModal";
import { ImportCSVModal } from "../components/ImportCSVModal";
import { useAccountingTransactions } from "../hooks/useAccountingTransactions";
import { useTranslations } from "../hooks/useTranslations";
import { useCoachMembership } from "../hooks/useCoachMembership";
import { useToast } from "../hooks/use-toast";
import { Toaster } from "../components/ui/toaster";
import { formatCHF } from "../utils/format";
import { useNavigate } from "react-router-dom";

export default function TransactionsPage({ selectedMonth }) {
  const { t, lang } = useTranslations();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [filterMonth, setFilterMonth] = useState(selectedMonth || "");
  const [filterType, setFilterType] = useState("all");
  const [filterCategories, setFilterCategories] = useState(new Set());
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [editTx, setEditTx] = useState(null);
  const [showExcluded, setShowExcluded] = useState(false);

  useEffect(() => {
    if (selectedMonth) setFilterMonth(selectedMonth);
  }, [selectedMonth]);

  const { transactions, categories, excluded, loading, refetch, addTransaction, updateTransaction, deleteTransaction, removeFromExclusions } =
    useAccountingTransactions(filterMonth || null);

  const { memberRevenue, coachRevenue } = useCoachMembership(transactions, categories);

  // Group categories by type
  const categoryGroups = useMemo(() => {
    const revenue = categories.filter(c => c.type === "revenue").sort((a, b) => a.name.localeCompare(b.name));
    const expense = categories.filter(c => c.type === "expense").sort((a, b) => a.name.localeCompare(b.name));
    return { revenue, expense };
  }, [categories]);

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (filterType !== "all" && tx.type !== filterType) return false;
      if (filterCategories.size > 0 && !filterCategories.has(tx.category)) return false;
      if (searchText) {
        const s = searchText.toLowerCase();
        if (
          !tx.description?.toLowerCase().includes(s) &&
          !tx.category?.toLowerCase().includes(s) &&
          !tx.client_name?.toLowerCase().includes(s)
        ) return false;
      }
      return true;
    });
  }, [transactions, filterType, filterCategories, searchText]);

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteTransaction(deleteId);
    setDeleteId(null);
    toast({ title: "Transaction supprimée", description: "Ajoutée aux exclusions" });
  };

  const toggleCategory = (catName) => {
    setFilterCategories(prev => {
      const next = new Set(prev);
      if (next.has(catName)) next.delete(catName);
      else next.add(catName);
      return next;
    });
  };

  const exportCSV = () => {
    const headers = ["Date", "Client", "Description", "Catégorie", "Type", "Montant (CHF)"];
    const rows = filtered.map((tx) => [
      tx.date, `"${tx.client_name || ""}"`, `"${tx.description}"`, tx.category, tx.type, tx.amount.toFixed(2),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions_${filterMonth || "all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getCategoryColor = (catName) => {
    const cat = categories.find((c) => c.name === catName);
    return cat?.color || "#3A3A3C";
  };

  return (
    <div className="space-y-6" data-testid="transactions-page">
      <Toaster />
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="tf-page-header">{t("transactions")}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImport(true)}
            className="border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] text-xs"
            data-testid="import-csv-btn">
            <Upload size={12} className="mr-1.5" />Importer CSV
          </Button>
          <Button variant="outline" onClick={exportCSV}
            className="border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] text-xs"
            data-testid="export-csv-btn">
            <Download size={12} className="mr-1.5" />Exporter CSV
          </Button>
          <Button onClick={() => setShowModal(true)}
            className="bg-[var(--color-accent)] hover:opacity-85 text-white font-bold uppercase tracking-wider text-xs"
            data-testid="add-transaction-btn">
            <Plus size={14} className="mr-1.5" />{t("addTransaction")}
          </Button>
        </div>
      </div>

      {/* Revenue split */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 tf-stagger">
        {[
          { label: t("revenueMembers"), value: formatCHF(memberRevenue) },
          { label: t("revenueCoaching"), value: formatCHF(coachRevenue) },
          { label: t("expenses"), value: formatCHF(transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0)), isDanger: true },
          { label: t("totalRevenue"), value: formatCHF(transactions.filter((t) => t.type === "revenue").reduce((s, t) => s + t.amount, 0)) },
        ].map(({ label, value, isDanger }) => (
          <div key={label} className="tf-stat">
            <p className="tf-stat-label">{label}</p>
            <p className="tf-number-large" style={{ marginTop: 'var(--space-2)', color: isDanger ? 'var(--color-danger)' : 'var(--color-text-primary)' }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
          <input type="text" value={searchText} onChange={(e) => setSearchText(e.target.value)}
            placeholder="Rechercher nom, description, catégorie..."
            className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-white text-sm rounded-[var(--radius-lg)] pl-8 pr-3 py-2 focus:outline-none focus:border-[var(--color-border-strong)] placeholder:text-[var(--color-text-tertiary)]"
            data-testid="tx-search-input" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40 bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white text-sm h-9" data-testid="filter-type-select">
            <SelectValue placeholder="Tous types" />
          </SelectTrigger>
          <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
            <SelectItem value="all" className="text-white focus:bg-[rgba(255,255,255,0.1)]">Tous types</SelectItem>
            <SelectItem value="revenue" className="text-white focus:bg-[rgba(255,255,255,0.1)]">{t("revenueType")}</SelectItem>
            <SelectItem value="expense" className="text-white focus:bg-[rgba(255,255,255,0.1)]">{t("expense")}</SelectItem>
          </SelectContent>
        </Select>

        {/* Category filter button */}
        <div className="relative">
          <Button variant="outline" onClick={() => setShowCategoryFilter(!showCategoryFilter)}
            className={`border-[var(--color-border)] text-xs h-9 ${filterCategories.size > 0 ? 'text-[var(--color-accent)] border-[var(--color-accent)]' : 'text-[var(--color-text-secondary)]'}`}
            data-testid="category-filter-btn">
            <Filter size={12} className="mr-1.5" />
            Catégories {filterCategories.size > 0 && `(${filterCategories.size})`}
          </Button>
          {showCategoryFilter && (
            <div className="absolute top-full left-0 mt-1 w-72 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto"
                 data-testid="category-filter-dropdown">
              <div className="p-2 border-b border-[var(--color-border)] flex justify-between items-center">
                <span className="text-xs font-semibold text-[var(--color-text-secondary)]">Filtrer par catégorie</span>
                {filterCategories.size > 0 && (
                  <button onClick={() => setFilterCategories(new Set())} className="text-xs text-[var(--color-accent)] hover:underline" data-testid="clear-cat-filter">Effacer</button>
                )}
              </div>
              <CategoryGroup title="Revenus" categories={categoryGroups.revenue} selected={filterCategories} onToggle={toggleCategory} color="var(--color-success)" />
              <CategoryGroup title="Dépenses" categories={categoryGroups.expense} selected={filterCategories} onToggle={toggleCategory} color="var(--color-danger)" />
            </div>
          )}
        </div>

        {filterCategories.size > 0 && (
          <button onClick={() => setFilterCategories(new Set())} className="text-xs text-[var(--color-accent)] hover:underline flex items-center gap-1">
            <X size={12} />Effacer filtres
          </button>
        )}

        <p className="text-xs text-[var(--color-text-tertiary)] font-mono ml-auto">
          {filtered.length} transaction{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Transactions Table */}
      <div className="tf-card overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center h-40" data-testid="transactions-loading">
            <Loader2 className="animate-spin text-[var(--color-accent)]" size={24} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-40" data-testid="transactions-empty">
            <p className="text-[var(--color-text-tertiary)] font-text text-sm">{t("noData")}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--color-border)] hover:bg-transparent">
                {[t("date"), "Client", t("description"), t("category"), t("amount"), t("actions")].map(
                  (h) => (
                    <TableHead key={h} className="text-[var(--color-text-secondary)] uppercase tracking-wider text-xs font-text">{h}</TableHead>
                  )
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((tx) => (
                <TableRow key={tx.id} className="border-[var(--color-border)] hover:bg-[rgba(255,255,255,0.03)] transition-colors" data-testid={`tx-row-${tx.id}`}>
                  <TableCell className="font-mono text-xs text-[var(--color-text-secondary)]">{tx.date}</TableCell>
                  <TableCell>
                    {tx.client_name ? (
                      <button onClick={() => navigate(`/members?search=${encodeURIComponent(tx.client_name)}`)}
                        className="text-[var(--color-accent)] hover:underline text-xs flex items-center gap-1 max-w-[140px] truncate"
                        data-testid={`tx-client-link-${tx.id}`}>
                        {tx.client_name}
                        <ExternalLink size={10} className="flex-shrink-0" />
                      </button>
                    ) : (
                      <span className="text-[var(--color-text-tertiary)] text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-white text-xs max-w-[200px] truncate" title={tx.description}>{tx.description}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-[var(--radius-lg)] border border-[var(--color-border)] max-w-[160px] truncate"
                      style={{ color: getCategoryColor(tx.category) }} title={tx.category}>
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: getCategoryColor(tx.category) }} />
                      {tx.category}
                    </span>
                  </TableCell>
                  <TableCell className={`font-mono text-sm font-bold ${tx.type === "revenue" ? "text-[var(--color-success)]" : "text-[var(--color-text-primary)]"}`}>
                    {tx.type === "revenue" ? "+" : "-"} {formatCHF(tx.amount)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditTx(tx)}
                        className="text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] transition-colors p-1"
                        data-testid={`edit-tx-${tx.id}`}>
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => setDeleteId(tx.id)}
                        className="text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] transition-colors p-1"
                        data-testid={`delete-tx-${tx.id}`}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Excluded transactions */}
      {excluded.length > 0 && (
        <div className="tf-card overflow-hidden p-0">
          <button className="w-full flex items-center justify-between px-5 py-3 text-left"
            onClick={() => setShowExcluded(!showExcluded)} data-testid="toggle-excluded-btn">
            <span className="text-xs font-text text-[var(--color-text-secondary)] uppercase tracking-wider">
              {t("excludedTransactions")} ({excluded.length})
            </span>
            {showExcluded ? <ChevronUp size={14} className="text-[var(--color-text-tertiary)]" /> : <ChevronDown size={14} className="text-[var(--color-text-tertiary)]" />}
          </button>
          {showExcluded && (
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--color-border)] hover:bg-transparent">
                  {[t("description"), t("category"), t("type"), t("amount"), "Exclue le", t("actions")].map(
                    (h) => <TableHead key={h} className="text-[var(--color-text-tertiary)] uppercase tracking-wider text-xs font-text">{h}</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {excluded.map((ex) => (
                  <TableRow key={ex.id} className="border-[var(--color-border)] opacity-60" data-testid={`excluded-row-${ex.id}`}>
                    <TableCell className="text-[var(--color-text-secondary)] text-sm line-through">{ex.description}</TableCell>
                    <TableCell className="text-[var(--color-text-secondary)] text-xs font-mono">{ex.category}</TableCell>
                    <TableCell>
                      <Badge className={ex.type === "revenue" ? "bg-[rgba(48,209,88,0.12)] text-[var(--color-success)] border-0 text-xs" : "bg-[rgba(10,132,255,0.12)] text-[var(--color-accent)] border-0 text-xs"}>
                        {ex.type === "revenue" ? t("revenueType") : t("expense")}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-[var(--color-text-secondary)]">{formatCHF(ex.amount)}</TableCell>
                    <TableCell className="text-[var(--color-text-tertiary)] text-xs font-mono">{new Date(ex.excluded_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <button onClick={() => removeFromExclusions(ex.id)}
                        className="text-[var(--color-text-tertiary)] hover:text-[var(--color-success)] transition-colors p-1"
                        data-testid={`restore-excluded-${ex.id}`}>
                        <RotateCcw size={13} />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl font-extrabold uppercase">{t("confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--color-text-secondary)]">{t("deleteWarning")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]" data-testid="delete-cancel-btn">{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-[var(--color-danger)] hover:opacity-85 text-white font-bold" data-testid="delete-confirm-btn">{t("delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Transaction Modal */}
      <EditTransactionModal
        tx={editTx}
        categories={categories}
        onClose={() => setEditTx(null)}
        onSave={async (id, data) => {
          await updateTransaction(id, data);
          setEditTx(null);
          toast({ title: "Transaction mise à jour" });
        }}
      />

      {/* Add Transaction Modal */}
      <AddTransactionModal open={showModal} onClose={() => setShowModal(false)} onSave={addTransaction} categories={categories} />

      {/* Import CSV Modal */}
      <ImportCSVModal open={showImport} onClose={() => setShowImport(false)} onImported={refetch} categories={categories} />
    </div>
  );
}


/* ── Category Filter Group ── */
function CategoryGroup({ title, categories, selected, onToggle, color }) {
  const [expanded, setExpanded] = useState(false);
  const selectedCount = categories.filter(c => selected.has(c.name)).length;

  return (
    <div className="border-b border-[var(--color-border)] last:border-0">
      <button
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-[var(--color-bg-tertiary)] transition-colors"
        onClick={() => setExpanded(!expanded)}
        data-testid={`cat-group-${title}`}
      >
        <span className="text-xs font-semibold flex items-center gap-2" style={{ color }}>
          {title} ({categories.length})
          {selectedCount > 0 && <Badge className="bg-[var(--color-accent)] text-white border-0 text-[9px] px-1.5 py-0">{selectedCount}</Badge>}
        </span>
        {expanded ? <ChevronUp size={12} className="text-[var(--color-text-tertiary)]" /> : <ChevronDown size={12} className="text-[var(--color-text-tertiary)]" />}
      </button>
      {expanded && (
        <div className="px-2 pb-2 grid grid-cols-1 gap-0.5">
          {categories.map(c => (
            <button key={c.id} onClick={() => onToggle(c.name)}
              className={`text-left px-2 py-1.5 rounded text-xs transition-colors ${selected.has(c.name) ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'}`}
              data-testid={`cat-filter-${c.name}`}>
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


/* ── Edit Transaction Modal ── */
function EditTransactionModal({ tx, categories, onClose, onSave }) {
  const [form, setForm] = useState({});

  useEffect(() => {
    if (tx) setForm({
      date: tx.date || "",
      description: tx.description || "",
      amount: tx.amount || 0,
      category: tx.category || "",
      client_name: tx.client_name || "",
      payment_method: tx.payment_method || "",
      notes: tx.notes || "",
    });
  }, [tx]);

  if (!tx) return null;

  const handleSave = () => {
    onSave(tx.id, form);
  };

  const inputClass = "w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[var(--color-accent)]";
  const labelClass = "text-xs font-semibold text-[var(--color-text-secondary)] mb-1";

  return (
    <Dialog open={!!tx} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white">
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-extrabold uppercase">Modifier la transaction</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
                className={inputClass} data-testid="edit-tx-date" />
            </div>
            <div>
              <label className={labelClass}>Montant (CHF)</label>
              <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
                className={inputClass} data-testid="edit-tx-amount" />
            </div>
          </div>
          <div>
            <label className={labelClass}>Client</label>
            <input type="text" value={form.client_name} onChange={(e) => setForm(f => ({ ...f, client_name: e.target.value }))}
              className={inputClass} data-testid="edit-tx-client" />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <input type="text" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              className={inputClass} data-testid="edit-tx-description" />
          </div>
          <div>
            <label className={labelClass}>Catégorie</label>
            <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))}>
              <SelectTrigger className="bg-[var(--color-bg-primary)] border-[var(--color-border)] text-white text-sm" data-testid="edit-tx-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] max-h-60">
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.name} className="text-white text-xs">{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Mode de paiement</label>
              <input type="text" value={form.payment_method} onChange={(e) => setForm(f => ({ ...f, payment_method: e.target.value }))}
                className={inputClass} data-testid="edit-tx-payment" />
            </div>
            <div>
              <label className={labelClass}>Notes</label>
              <input type="text" value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                className={inputClass} data-testid="edit-tx-notes" />
            </div>
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}
            className="border-[var(--color-border)] text-[var(--color-text-secondary)]">Annuler</Button>
          <Button onClick={handleSave}
            className="bg-[var(--color-accent)] hover:opacity-85 text-white font-bold"
            data-testid="edit-tx-save-btn">Sauvegarder</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
