import { useState, useEffect, useCallback } from "react";
import { Settings, Save, Loader2, RefreshCw, AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "../components/ui/dialog";
import { useTranslations } from "../hooks/useTranslations";
import { useToast } from "../hooks/use-toast";
import { Toaster } from "../components/ui/toaster";
import { formatCHF, formatPct } from "../utils/format";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TARGET_FIELDS = [
  {
    key: "churn_rate",
    labelFr: "Taux de Churn cible (%)",
    labelEn: "Target Churn Rate (%)",
    type: "percent",
    description: "En dessous de ce taux = bonne rétention",
    color: "#FFD60A",
  },
  {
    key: "cac",
    labelFr: "CAC cible (CHF)",
    labelEn: "Target CAC (CHF)",
    type: "currency",
    description: "Coût d'acquisition par nouveau membre",
    color: "#64D2FF",
  },
  {
    key: "roas",
    labelFr: "ROAS cible",
    labelEn: "Target ROAS",
    type: "multiplier",
    description: "Retour sur investissement publicitaire",
    color: "#FFD60A",
  },
  {
    key: "new_members",
    labelFr: "Nouveaux membres/mois cible",
    labelEn: "Target new members/month",
    type: "number",
    description: "Objectif d'acquisition mensuel",
    color: "#30D158",
  },
  {
    key: "profit_margin",
    labelFr: "Marge nette cible (%)",
    labelEn: "Target net margin (%)",
    type: "percent",
    description: "Pourcentage de bénéfice sur le chiffre d'affaires",
    color: "#30D158",
  },
  {
    key: "revenue_growth",
    labelFr: "Croissance revenus cible (%)",
    labelEn: "Target revenue growth (%)",
    type: "percent",
    description: "Croissance mensuelle visée",
    color: "#FF453A",
  },
];

const DEFAULT_SETTINGS = {
  club_name: "Mon Club",
  targets: {
    churn_rate: 3.0,
    cac: 150.0,
    roas: 20.0,
    new_members: 30,
    profit_margin: 30.0,
    revenue_growth: 5.0,
  },
};

export default function SettingsPage() {
  const { t, lang } = useTranslations();
  const { toast } = useToast();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetting, setResetting] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/settings`);
      setSettings(res.data);
    } catch (e) {
      console.error("Failed to load settings", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/settings`, {
        club_name: settings.club_name,
        targets: settings.targets,
      });
      toast({
        title: lang === "fr" ? "Paramètres sauvegardés" : "Settings saved",
        description: lang === "fr" ? "Vos objectifs ont été mis à jour" : "Your targets have been updated",
      });
    } catch (e) {
      toast({
        title: "Erreur",
        description: e.response?.data?.detail || "Erreur serveur",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const res = await axios.post(`${API}/monthly-kpis/recalculate-all`);
      toast({
        title: lang === "fr" ? "KPIs recalculés" : "KPIs recalculated",
        description: `${res.data.recalculated} ${lang === "fr" ? "mois mis à jour" : "months updated"}`,
      });
    } catch (e) {
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setRecalculating(false);
    }
  };

  const handleResetData = async () => {
    if (resetConfirm !== "RESET") return;
    setResetting(true);
    try {
      const res = await axios.post(`${API}/settings/reset-data`, { confirm: "RESET" });
      toast({
        title: lang === "fr" ? "Données réinitialisées" : "Data reset",
        description: res.data.message,
      });
      setResetModalOpen(false);
      setResetConfirm("");
    } catch (e) {
      toast({
        title: "Erreur",
        description: e.response?.data?.detail || "Erreur serveur",
        variant: "destructive",
      });
    } finally {
      setResetting(false);
    }
  };

  const updateTarget = (key, value) => {
    setSettings((prev) => ({
      ...prev,
      targets: { ...prev.targets, [key]: parseFloat(value) || 0 },
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-[var(--color-accent)]" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl" data-testid="settings-page">
      <Toaster />
      <div className="flex items-center justify-between">
        <h1 className="tf-page-header">
          {t("settings")}
        </h1>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-[var(--color-accent)] hover:opacity-85 text-white font-bold uppercase tracking-wider text-xs"
          data-testid="save-settings-btn"
        >
          {saving ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Save size={12} className="mr-1.5" />}
          {saving ? "Sauvegarde..." : (lang === "fr" ? "Sauvegarder" : "Save")}
        </Button>
      </div>

      {/* Club Info */}
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-6 space-y-4">
        <p className="text-xs font-text text-[var(--color-text-secondary)] uppercase tracking-wider mb-4">
          {lang === "fr" ? "Informations du club" : "Club information"}
        </p>
        <div className="space-y-1.5">
          <Label className="tf-stat-label">
            {lang === "fr" ? "Nom du club" : "Club name"}
          </Label>
          <Input
            value={settings.club_name}
            onChange={(e) => setSettings({ ...settings, club_name: e.target.value })}
            className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white max-w-sm"
            data-testid="club-name-input"
          />
        </div>
      </div>

      {/* KPI Targets */}
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-6 space-y-5">
        <p className="text-xs font-text text-[var(--color-text-secondary)] uppercase tracking-wider">
          {lang === "fr" ? "Objectifs KPI" : "KPI Targets"}
        </p>

        {TARGET_FIELDS.map((field, idx) => (
          <div key={field.key}>
            {idx > 0 && <Separator className="bg-[rgba(255,255,255,0.05)] my-5" />}
            <div className="flex items-start justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: field.color }}
                  />
                  <Label className="text-white text-sm font-medium">
                    {lang === "fr" ? field.labelFr : field.labelEn}
                  </Label>
                </div>
                <p className="text-xs text-[var(--color-text-tertiary)] ml-4">{field.description}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Input
                  type="number"
                  value={settings.targets[field.key] ?? 0}
                  onChange={(e) => updateTarget(field.key, e.target.value)}
                  className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white font-mono w-28 text-right"
                  step={field.type === "percent" || field.type === "multiplier" ? 0.1 : 1}
                  data-testid={`target-${field.key}`}
                />
                <span className="text-[var(--color-text-tertiary)] text-xs font-mono w-8">
                  {field.type === "percent" ? "%" : field.type === "multiplier" ? "x" : field.type === "currency" ? "CHF" : ""}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recalculate */}
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-6">
        <p className="text-xs font-text text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
          {lang === "fr" ? "Outils de maintenance" : "Maintenance tools"}
        </p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white font-medium">
              {lang === "fr" ? "Recalculer les KPIs" : "Recalculate KPIs"}
            </p>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
              {lang === "fr"
                ? "Recalcule les revenus/dépenses de chaque mois depuis les transactions"
                : "Recomputes revenues/expenses for each month from actual transactions"}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleRecalculate}
            disabled={recalculating}
            className="border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] text-xs flex-shrink-0"
            data-testid="recalculate-all-btn"
          >
            {recalculating ? (
              <Loader2 size={12} className="animate-spin mr-1.5" />
            ) : (
              <RefreshCw size={12} className="mr-1.5" />
            )}
            {recalculating ? "En cours..." : (lang === "fr" ? "Recalculer tout" : "Recalculate all")}
          </Button>
        </div>
      </div>

      {/* Reset Data */}
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-danger)]/20 rounded-[var(--radius-lg)] p-6">
        <p className="text-xs font-text text-[var(--color-danger)]/60 uppercase tracking-wider mb-3">
          {lang === "fr" ? "Zone dangereuse" : "Danger zone"}
        </p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white font-medium">
              {lang === "fr" ? "Réinitialiser les données" : "Reset data"}
            </p>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
              {lang === "fr"
                ? "Supprime toutes les données transactionnelles (membres, paiements, KPIs, challenges, cours) tout en conservant votre compte et votre configuration"
                : "Deletes all transactional data (members, payments, KPIs, challenges, courses) while keeping your account and configuration"}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setResetModalOpen(true)}
            className="border-[rgba(255,69,58,0.3)] text-[var(--color-danger)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 text-xs flex-shrink-0"
            data-testid="reset-data-btn"
          >
            <Trash2 size={12} className="mr-1.5" />
            {lang === "fr" ? "Réinitialiser" : "Reset"}
          </Button>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      <Dialog open={resetModalOpen} onOpenChange={setResetModalOpen}>
        <DialogContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[var(--color-danger)]">
              <AlertTriangle size={20} />
              {lang === "fr" ? "Réinitialisation des données" : "Data reset"}
            </DialogTitle>
            <DialogDescription className="text-[var(--color-text-secondary)]">
              {lang === "fr"
                ? "Cette action est irréversible. Toutes les données suivantes seront supprimées :"
                : "This action is irreversible. All following data will be deleted:"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 rounded-[var(--radius-lg)] p-3">
              <ul className="text-[var(--color-danger)] text-sm space-y-1">
                <li>- Membres et historique de renouvellements</li>
                <li>- Paiements et plannings de paiement</li>
                <li>- KPIs mensuels</li>
                <li>- Challenges et participants</li>
                <li>- Cours et instructeurs</li>
                <li>- Transactions et transactions récurrentes</li>
                <li>- Bilans et suivis</li>
                <li>- Coachs</li>
              </ul>
            </div>
            <div className="bg-[var(--color-success)]/10 border border-[var(--color-success)]/20 rounded-[var(--radius-lg)] p-3">
              <p className="text-[var(--color-success)] text-sm font-medium mb-1">Données conservées :</p>
              <ul className="text-[var(--color-success)] text-sm space-y-1">
                <li>- Votre compte utilisateur</li>
                <li>- Paramètres du club et objectifs KPI</li>
                <li>- Catégories comptables</li>
                <li>- Types d'abonnements et types de membres</li>
                <li>- Colonnes KPI personnalisées</li>
              </ul>
            </div>
            <div>
              <label className="text-[var(--color-text-secondary)] text-xs">
                Tapez <span className="text-[var(--color-danger)] font-mono font-bold">RESET</span> pour confirmer
              </label>
              <Input
                value={resetConfirm}
                onChange={(e) => setResetConfirm(e.target.value)}
                placeholder="RESET"
                className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1 font-mono"
                data-testid="reset-confirm-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setResetModalOpen(false); setResetConfirm(""); }}>
              Annuler
            </Button>
            <Button
              onClick={handleResetData}
              disabled={resetConfirm !== "RESET" || resetting}
              className="bg-[var(--color-danger)] hover:opacity-85 disabled:opacity-30"
              data-testid="confirm-reset-btn"
            >
              {resetting ? <Loader2 size={14} className="animate-spin mr-1" /> : <Trash2 size={14} className="mr-1" />}
              {resetting ? "Suppression..." : "Supprimer toutes les données"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
