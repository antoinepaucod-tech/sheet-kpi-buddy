import { useState, useEffect } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp, Loader2, RotateCcw, Download, Search, Upload } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { AddTransactionModal } from "../components/AddTransactionModal";
import { ImportCSVModal } from "../components/ImportCSVModal";
import { useAccountingTransactions } from "../hooks/useAccountingTransactions";
import { useTranslations } from "../hooks/useTranslations";
import { useCoachMembership } from "../hooks/useCoachMembership";
import { useToast } from "../hooks/use-toast";
import { Toaster } from "../components/ui/toaster";
import { formatCHF } from "../utils/format";

export default function TransactionsPage({ selectedMonth }) {
  const { t, lang } = useTranslations();
  const { toast } = useToast();
  const [filterMonth, setFilterMonth] = useState(selectedMonth || "");
  const [filterType, setFilterType] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [showExcluded, setShowExcluded] = useState(false);

  // Sync filter with global month selector
  useEffect(() => {
    if (selectedMonth) setFilterMonth(selectedMonth);
  }, [selectedMonth]);

  const { transactions, categories, excluded, loading, refetch, addTransaction, deleteTransaction, removeFromExclusions } =
    useAccountingTransactions(filterMonth || null);

  const { memberRevenue, coachRevenue } = useCoachMembership(transactions);

  const filtered = transactions.filter((tx) => {
    if (filterType && filterType !== "all" && tx.type !== filterType) return false;
    if (searchText && !tx.description.toLowerCase().includes(searchText.toLowerCase()) &&
        !tx.category.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteTransaction(deleteId);
    setDeleteId(null);
    toast({ title: lang === "fr" ? "Transaction supprimée" : "Transaction deleted", description: lang === "fr" ? "Ajoutée aux exclusions" : "Added to exclusions" });
  };

  const exportCSV = () => {
    const headers = ["Date", "Description", "Catégorie", "Type", "Sous-type", "Montant (CHF)"];
    const rows = filtered.map((tx) => [
      tx.date,
      `"${tx.description}"`,
      tx.category,
      tx.type,
      tx.sub_type || "",
      tx.amount.toFixed(2),
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
        <h1 className="tf-page-header">
          {t("transactions")}
        </h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowImport(true)}
            className="border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] text-xs"
            data-testid="import-csv-btn"
          >
            <Upload size={12} className="mr-1.5" />
            {lang === "fr" ? "Importer CSV" : "Import CSV"}
          </Button>
          <Button
            variant="outline"
            onClick={exportCSV}
            className="border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] text-xs"
            data-testid="export-csv-btn"
          >
            <Download size={12} className="mr-1.5" />
            {lang === "fr" ? "Exporter CSV" : "Export CSV"}
          </Button>
          <Button
            onClick={() => setShowModal(true)}
            className="bg-[var(--color-accent)] hover:opacity-85 text-white font-bold uppercase tracking-wider text-xs"
            data-testid="add-transaction-btn"
          >
            <Plus size={14} className="mr-1.5" />
            {t("addTransaction")}
          </Button>
        </div>
      </div>

      {/* Revenue split */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 tf-stagger">
        {[
          { label: t("revenueMembers"), value: formatCHF(memberRevenue) },
          { label: t("revenueCoaching"), value: formatCHF(coachRevenue) },
          {
            label: t("expenses"),
            value: formatCHF(transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0)),
            isDanger: true,
          },
          {
            label: t("totalRevenue"),
            value: formatCHF(transactions.filter((t) => t.type === "revenue").reduce((s, t) => s + t.amount, 0)),
          },
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
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={lang === "fr" ? "Rechercher..." : "Search..."}
            className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-white text-sm rounded-[var(--radius-lg)] pl-8 pr-3 py-2 focus:outline-none focus:border-[var(--color-border-strong)] placeholder:text-[var(--color-text-tertiary)]"
            data-testid="tx-search-input"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger
            className="w-40 bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white text-sm h-9"
            data-testid="filter-type-select"
          >
            <SelectValue placeholder="Tous types" />
          </SelectTrigger>
          <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
            <SelectItem value="all" className="text-white focus:bg-[rgba(255,255,255,0.1)]">Tous types</SelectItem>
            <SelectItem value="revenue" className="text-white focus:bg-[rgba(255,255,255,0.1)]">{t("revenueType")}</SelectItem>
            <SelectItem value="expense" className="text-white focus:bg-[rgba(255,255,255,0.1)]">{t("expense")}</SelectItem>
          </SelectContent>
        </Select>

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
                {[t("date"), t("description"), t("category"), t("type"), t("amount"), t("actions")].map(
                  (h) => (
                    <TableHead key={h} className="text-[var(--color-text-secondary)] uppercase tracking-wider text-xs font-text">
                      {h}
                    </TableHead>
                  )
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((tx) => (
                <TableRow
                  key={tx.id}
                  className="border-[var(--color-border)] hover:bg-[rgba(255,255,255,0.03)] transition-colors"
                  data-testid={`tx-row-${tx.id}`}
                >
                  <TableCell className="font-mono text-sm text-[var(--color-text-secondary)]">{tx.date}</TableCell>
                  <TableCell className="text-white text-sm">{tx.description}</TableCell>
                  <TableCell>
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded-[var(--radius-lg)] border border-[var(--color-border)]"
                      style={{ color: getCategoryColor(tx.category) }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: getCategoryColor(tx.category) }}
                      />
                      {tx.category}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        tx.type === "revenue"
                          ? "bg-[rgba(48,209,88,0.12)] text-[var(--color-success)] border-0 text-xs"
                          : "bg-[rgba(10,132,255,0.12)] text-[var(--color-accent)] border-0 text-xs"
                      }
                    >
                      {tx.type === "revenue" ? t("revenueType") : t("expense")}
                      {tx.sub_type && ` · ${tx.sub_type}`}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={`font-mono text-sm font-bold ${
                      tx.type === "revenue" ? "text-[var(--color-success)]" : "text-[var(--color-text-primary)]"
                    }`}
                  >
                    {tx.type === "revenue" ? "+" : "-"} {formatCHF(tx.amount)}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => setDeleteId(tx.id)}
                      className="text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] transition-colors p-1"
                      data-testid={`delete-tx-${tx.id}`}
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

      {/* Excluded transactions */}
      {excluded.length > 0 && (
        <div className="tf-card overflow-hidden p-0">
          <button
            className="w-full flex items-center justify-between px-5 py-3 text-left"
            onClick={() => setShowExcluded(!showExcluded)}
            data-testid="toggle-excluded-btn"
          >
            <span className="text-xs font-text text-[var(--color-text-secondary)] uppercase tracking-wider">
              {t("excludedTransactions")} ({excluded.length})
            </span>
            {showExcluded ? (
              <ChevronUp size={14} className="text-[var(--color-text-tertiary)]" />
            ) : (
              <ChevronDown size={14} className="text-[var(--color-text-tertiary)]" />
            )}
          </button>

          {showExcluded && (
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--color-border)] hover:bg-transparent">
                  {[t("description"), t("category"), t("type"), t("amount"), "Exclue le", t("actions")].map(
                    (h) => (
                      <TableHead key={h} className="text-[var(--color-text-tertiary)] uppercase tracking-wider text-xs font-text">
                        {h}
                      </TableHead>
                    )
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {excluded.map((ex) => (
                  <TableRow
                    key={ex.id}
                    className="border-[var(--color-border)] opacity-60"
                    data-testid={`excluded-row-${ex.id}`}
                  >
                    <TableCell className="text-[var(--color-text-secondary)] text-sm line-through">{ex.description}</TableCell>
                    <TableCell className="text-[var(--color-text-secondary)] text-xs font-mono">{ex.category}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          ex.type === "revenue"
                            ? "bg-[rgba(48,209,88,0.12)] text-[var(--color-success)] border-0 text-xs"
                            : "bg-[rgba(10,132,255,0.12)] text-[var(--color-accent)] border-0 text-xs"
                        }
                      >
                        {ex.type === "revenue" ? t("revenueType") : t("expense")}
                        {ex.sub_type && ` · ${ex.sub_type}`}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-[var(--color-text-secondary)]">{formatCHF(ex.amount)}</TableCell>
                    <TableCell className="text-[var(--color-text-tertiary)] text-xs font-mono">
                      {new Date(ex.excluded_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => removeFromExclusions(ex.id)}
                        className="text-[var(--color-text-tertiary)] hover:text-[var(--color-success)] transition-colors p-1"
                        title="Restaurer"
                        data-testid={`restore-excluded-${ex.id}`}
                      >
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
            <AlertDialogTitle className="font-display text-xl font-extrabold uppercase">
              {t("confirmDelete")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--color-text-secondary)]">
              {t("deleteWarning")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]"
              data-testid="delete-cancel-btn"
            >
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-[var(--color-danger)] hover:opacity-85 text-white font-bold"
              data-testid="delete-confirm-btn"
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Transaction Modal */}
      <AddTransactionModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSave={addTransaction}
        categories={categories}
      />

      {/* Import CSV Modal */}
      <ImportCSVModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={refetch}
        categories={categories}
      />
    </div>
  );
}
