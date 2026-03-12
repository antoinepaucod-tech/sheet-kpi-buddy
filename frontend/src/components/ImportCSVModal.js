import { useState, useRef } from "react";
import Papa from "papaparse";
import { Upload, Check, X, Loader2, FileText, AlertTriangle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { useTranslations } from "../hooks/useTranslations";
import { formatCHF } from "../utils/format";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Expected CSV columns (our export format)
// Date;Description;Catégorie;Type;Sous-type;Montant (CHF)
const mapRow = (row, categories) => {
  const catName = (row["Catégorie"] || row["Category"] || "AUTRE").trim().toUpperCase();
  const type = (row["Type"] || "expense").toLowerCase().includes("rev") ? "revenue" : "expense";
  const subType = row["Sous-type"] || row["Sub-type"] || null;
  return {
    date: row["Date"] || new Date().toISOString().split("T")[0],
    description: row["Description"] || "Import",
    amount: Math.abs(parseFloat((row["Montant (CHF)"] || row["Amount"] || "0").replace(/[' ]/g, ""))),
    type,
    category: catName,
    sub_type: subType || null,
  };
};

export function ImportCSVModal({ open, onClose, onImported, categories }) {
  const { t, lang } = useTranslations();
  const fileRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [fileName, setFileName] = useState("");

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    Papa.parse(file, {
      header: true,
      delimiter: ";",
      skipEmptyLines: true,
      complete: (res) => {
        const parsed = [];
        const errs = [];
        res.data.forEach((row, i) => {
          try {
            const tx = mapRow(row, categories);
            if (!tx.date || !tx.description || isNaN(tx.amount)) {
              errs.push(`Ligne ${i + 2}: données invalides`);
            } else {
              parsed.push(tx);
            }
          } catch (ex) {
            errs.push(`Ligne ${i + 2}: ${ex.message}`);
          }
        });
        setRows(parsed);
        setErrors(errs);
      },
      error: (err) => setErrors([err.message]),
    });
  };

  const handleImport = async () => {
    if (!rows.length) return;
    setImporting(true);
    try {
      const res = await axios.post(`${API}/transactions/bulk`, rows);
      setResult(res.data);
      await onImported();
    } catch (e) {
      setErrors([e.response?.data?.detail || "Erreur d'import"]);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setRows([]);
    setErrors([]);
    setResult(null);
    setFileName("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold uppercase tracking-tight">
            {lang === "fr" ? "Importer des transactions CSV" : "Import CSV transactions"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4 py-2">
          {/* File format hint */}
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-3 text-xs font-mono text-[var(--color-text-secondary)]">
            <p className="text-white/70 mb-1">Format attendu (séparateur = ;) :</p>
            <p>Date ; Description ; Catégorie ; Type ; Sous-type ; Montant (CHF)</p>
            <p className="mt-1 text-[var(--color-success)]/60">Compatible avec l'export de cette app (CSV)</p>
          </div>

          {/* File picker */}
          <div
            className="border-2 border-dashed border-[var(--color-border)] rounded-[var(--radius-lg)] p-6 text-center cursor-pointer hover:border-rose-500/50 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} data-testid="csv-file-input" />
            {fileName ? (
              <div className="flex items-center justify-center gap-2">
                <FileText size={18} className="text-[var(--color-accent)]" />
                <span className="text-white font-mono text-sm">{fileName}</span>
              </div>
            ) : (
              <>
                <Upload size={24} className="text-[var(--color-text-tertiary)] mx-auto mb-2" />
                <p className="text-[var(--color-text-secondary)] text-sm">
                  {lang === "fr" ? "Cliquez pour choisir un fichier CSV" : "Click to select a CSV file"}
                </p>
              </>
            )}
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-[var(--radius-lg)] p-3 space-y-1">
              {errors.map((e, i) => (
                <p key={i} className="text-[var(--color-danger)] text-xs font-mono flex items-center gap-1.5">
                  <AlertTriangle size={11} /> {e}
                </p>
              ))}
            </div>
          )}

          {/* Preview */}
          {rows.length > 0 && !result && (
            <div>
              <p className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                {lang === "fr" ? `Aperçu — ${rows.length} transaction(s)` : `Preview — ${rows.length} transaction(s)`}
              </p>
              <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-[var(--radius-lg)] overflow-auto max-h-48">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-[var(--color-border)]">
                      {["Date", "Description", "Catégorie", "Type", "Montant"].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-[var(--color-text-tertiary)] uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 20).map((row, i) => (
                      <tr key={i} className="border-b border-white/5">
                        <td className="px-3 py-1.5 text-[var(--color-text-secondary)]">{row.date}</td>
                        <td className="px-3 py-1.5 text-white truncate max-w-[160px]">{row.description}</td>
                        <td className="px-3 py-1.5 text-white/60">{row.category}</td>
                        <td className="px-3 py-1.5">
                          <Badge className={row.type === "revenue" ? "bg-green-500/10 text-[var(--color-success)] text-xs" : "bg-blue-500/10 text-[var(--color-accent)] text-xs"}>
                            {row.type}
                          </Badge>
                        </td>
                        <td className={`px-3 py-1.5 font-bold ${row.type === "revenue" ? "text-[var(--color-success)]" : "text-white/70"}`}>
                          {formatCHF(row.amount)}
                        </td>
                      </tr>
                    ))}
                    {rows.length > 20 && (
                      <tr><td colSpan={5} className="px-3 py-1.5 text-[var(--color-text-tertiary)] text-center">+{rows.length - 20} de plus...</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Import result */}
          {result && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-[var(--radius-lg)] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Check size={16} className="text-[var(--color-success)]" />
                <p className="text-[var(--color-success)] font-bold font-mono">
                  {lang === "fr" ? "Import réussi !" : "Import successful!"}
                </p>
              </div>
              <p className="text-[var(--color-text-secondary)] text-sm font-mono">
                {result.imported} {lang === "fr" ? "importées" : "imported"}
                {result.skipped > 0 && `, ${result.skipped} ${lang === "fr" ? "ignorées (exclues)" : "skipped (excluded)"}`}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 border-t border-[var(--color-border)] pt-4">
          <Button
            variant="outline"
            onClick={handleClose}
            className="border-[var(--color-border)] text-white/60 hover:text-white hover:bg-[var(--color-bg-tertiary)]"
          >
            {result ? (lang === "fr" ? "Fermer" : "Close") : t("cancel")}
          </Button>
          {!result && (
            <Button
              onClick={handleImport}
              disabled={importing || !rows.length}
              className="bg-[var(--color-accent)] hover:opacity-85 text-white font-bold uppercase tracking-wider"
              data-testid="confirm-import-btn"
            >
              {importing ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Upload size={12} className="mr-1.5" />}
              {importing ? (lang === "fr" ? "Import..." : "Importing...") : (lang === "fr" ? `Importer ${rows.length}` : `Import ${rows.length}`)}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
