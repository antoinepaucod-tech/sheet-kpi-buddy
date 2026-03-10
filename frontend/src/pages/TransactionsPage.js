import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp, Loader2, RotateCcw } from "lucide-react";
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
import { useAccountingTransactions } from "../hooks/useAccountingTransactions";
import { useTranslations } from "../hooks/useTranslations";
import { useCoachMembership } from "../hooks/useCoachMembership";
import { formatCHF, formatMonthLabel } from "../utils/format";

export default function TransactionsPage({ selectedMonth }) {
  const { t, lang } = useTranslations();
  const [filterMonth, setFilterMonth] = useState(selectedMonth || "");
  const [filterType, setFilterType] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [showExcluded, setShowExcluded] = useState(false);

  const { transactions, categories, excluded, loading, addTransaction, deleteTransaction, removeFromExclusions } =
    useAccountingTransactions(filterMonth || null);

  const { memberRevenue, coachRevenue } = useCoachMembership(transactions);

  const filtered = transactions.filter((tx) => {
    if (filterType && filterType !== "all" && tx.type !== filterType) return false;
    return true;
  });

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteTransaction(deleteId);
    setDeleteId(null);
  };

  const getCategoryColor = (catName) => {
    const cat = categories.find((c) => c.name === catName);
    return cat?.color || "#6B7280";
  };

  return (
    <div className="space-y-6" data-testid="transactions-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-4xl font-extrabold text-white uppercase tracking-tight">
          {t("transactions")}
        </h1>
        <Button
          onClick={() => setShowModal(true)}
          className="bg-rose-600 hover:bg-rose-700 text-white font-bold uppercase tracking-wider text-xs"
          data-testid="add-transaction-btn"
        >
          <Plus size={14} className="mr-1.5" />
          {t("addTransaction")}
        </Button>
      </div>

      {/* Revenue split */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t("revenueMembers"), value: formatCHF(memberRevenue), color: "text-green-400" },
          { label: t("revenueCoaching"), value: formatCHF(coachRevenue), color: "text-emerald-400" },
          {
            label: t("expenses"),
            value: formatCHF(transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0)),
            color: "text-blue-400",
          },
          {
            label: t("totalRevenue"),
            value: formatCHF(transactions.filter((t) => t.type === "revenue").reduce((s, t) => s + t.amount, 0)),
            color: "text-rose-400",
          },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#121214] border border-white/10 p-4 rounded-sm">
            <p className="text-xs text-white/40 uppercase tracking-wider">{label}</p>
            <p className={`text-xl font-heading font-extrabold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger
            className="w-40 bg-[#1C1C1E] border-white/10 text-white text-sm h-9"
            data-testid="filter-type-select"
          >
            <SelectValue placeholder="Tous types" />
          </SelectTrigger>
          <SelectContent className="bg-[#1C1C1E] border-white/10">
            <SelectItem value="all" className="text-white focus:bg-white/10">Tous types</SelectItem>
            <SelectItem value="revenue" className="text-white focus:bg-white/10">{t("revenueType")}</SelectItem>
            <SelectItem value="expense" className="text-white focus:bg-white/10">{t("expense")}</SelectItem>
          </SelectContent>
        </Select>

        <p className="text-xs text-white/30 font-mono ml-auto">
          {filtered.length} transaction{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Transactions Table */}
      <div className="bg-[#121214] border border-white/10 rounded-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40" data-testid="transactions-loading">
            <Loader2 className="animate-spin text-rose-500" size={24} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-40" data-testid="transactions-empty">
            <p className="text-white/30 font-body text-sm">{t("noData")}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                {[t("date"), t("description"), t("category"), t("type"), t("amount"), t("actions")].map(
                  (h) => (
                    <TableHead key={h} className="text-white/40 uppercase tracking-wider text-xs font-body">
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
                  className="border-white/5 hover:bg-white/3 transition-colors"
                  data-testid={`tx-row-${tx.id}`}
                >
                  <TableCell className="font-mono text-sm text-white/60">{tx.date}</TableCell>
                  <TableCell className="text-white text-sm">{tx.description}</TableCell>
                  <TableCell>
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded-sm border border-white/10"
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
                          ? "bg-green-500/10 text-green-400 border-green-500/20 text-xs"
                          : "bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs"
                      }
                    >
                      {tx.type === "revenue" ? t("revenueType") : t("expense")}
                      {tx.sub_type && ` · ${tx.sub_type}`}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={`font-mono text-sm font-bold ${
                      tx.type === "revenue" ? "text-green-400" : "text-white/80"
                    }`}
                  >
                    {tx.type === "revenue" ? "+" : "-"} {formatCHF(tx.amount)}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => setDeleteId(tx.id)}
                      className="text-white/20 hover:text-red-400 transition-colors p-1"
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
        <div className="bg-[#121214] border border-white/10 rounded-sm overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-5 py-3 text-left"
            onClick={() => setShowExcluded(!showExcluded)}
            data-testid="toggle-excluded-btn"
          >
            <span className="text-xs font-body text-white/40 uppercase tracking-wider">
              {t("excludedTransactions")} ({excluded.length})
            </span>
            {showExcluded ? (
              <ChevronUp size={14} className="text-white/30" />
            ) : (
              <ChevronDown size={14} className="text-white/30" />
            )}
          </button>

          {showExcluded && (
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  {[t("description"), t("category"), t("amount"), "Exclue le", t("actions")].map(
                    (h) => (
                      <TableHead key={h} className="text-white/30 uppercase tracking-wider text-xs font-body">
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
                    className="border-white/5 opacity-60"
                    data-testid={`excluded-row-${ex.id}`}
                  >
                    <TableCell className="text-white/60 text-sm line-through">{ex.description}</TableCell>
                    <TableCell className="text-white/40 text-xs font-mono">{ex.category}</TableCell>
                    <TableCell className="font-mono text-sm text-white/40">{formatCHF(ex.amount)}</TableCell>
                    <TableCell className="text-white/30 text-xs font-mono">
                      {new Date(ex.excluded_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => removeFromExclusions(ex.id)}
                        className="text-white/20 hover:text-green-400 transition-colors p-1"
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
        <AlertDialogContent className="bg-[#121214] border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading text-xl font-extrabold uppercase">
              {t("confirmDelete")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">
              {t("deleteWarning")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-white/10 text-white/60 hover:text-white hover:bg-white/5"
              data-testid="delete-cancel-btn"
            >
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white font-bold"
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
    </div>
  );
}
