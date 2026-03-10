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
    color: "#F97316",
  },
  {
    key: "cac",
    labelFr: "CAC cible (CHF)",
    labelEn: "Target CAC (CHF)",
    type: "currency",
    description: "Coût d'acquisition par nouveau membre",
    color: "#8B5CF6",
  },
  {
    key: "roas",
    labelFr: "ROAS cible",
    labelEn: "Target ROAS",
    type: "multiplier",
    description: "Retour sur investissement publicitaire",
    color: "#FACC15",
  },
  {
    key: "new_members",
    labelFr: "Nouveaux membres/mois cible",
    labelEn: "Target new members/month",
    type: "number",
    description: "Objectif d'acquisition mensuel",
    color: "#22C55E",
  },
  {
    key: "profit_margin",
    labelFr: "Marge nette cible (%)",
    labelEn: "Target net margin (%)",
    type: "percent",
    description: "Pourcentage de bénéfice sur le chiffre d'affaires",
    color: "#22C55E",
  },
  {
    key: "revenue_growth",
    labelFr: "Croissance revenus cible (%)",
    labelEn: "Target revenue growth (%)",
    type: "percent",
    description: "Croissance mensuelle visée",
    color: "#E11D48",
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
        <Loader2 className="animate-spin text-rose-500" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl" data-testid="settings-page">
      <Toaster />
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-4xl font-extrabold text-white uppercase tracking-tight">
          {t("settings")}
        </h1>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-rose-600 hover:bg-rose-700 text-white font-bold uppercase tracking-wider text-xs"
          data-testid="save-settings-btn"
        >
          {saving ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Save size={12} className="mr-1.5" />}
          {saving ? "Sauvegarde..." : (lang === "fr" ? "Sauvegarder" : "Save")}
        </Button>
      </div>

      {/* Club Info */}
      <div className="bg-[#121214] border border-white/10 rounded-sm p-6 space-y-4">
        <p className="text-xs font-body text-white/40 uppercase tracking-wider mb-4">
          {lang === "fr" ? "Informations du club" : "Club information"}
        </p>
        <div className="space-y-1.5">
          <Label className="text-white/60 text-xs uppercase tracking-wider">
            {lang === "fr" ? "Nom du club" : "Club name"}
          </Label>
          <Input
            value={settings.club_name}
            onChange={(e) => setSettings({ ...settings, club_name: e.target.value })}
            className="bg-[#1C1C1E] border-white/10 text-white max-w-sm"
            data-testid="club-name-input"
          />
        </div>
      </div>

      {/* KPI Targets */}
      <div className="bg-[#121214] border border-white/10 rounded-sm p-6 space-y-5">
        <p className="text-xs font-body text-white/40 uppercase tracking-wider">
          {lang === "fr" ? "Objectifs KPI" : "KPI Targets"}
        </p>

        {TARGET_FIELDS.map((field, idx) => (
          <div key={field.key}>
            {idx > 0 && <Separator className="bg-white/5 my-5" />}
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
                <p className="text-xs text-white/30 ml-4">{field.description}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Input
                  type="number"
                  value={settings.targets[field.key] ?? 0}
                  onChange={(e) => updateTarget(field.key, e.target.value)}
                  className="bg-[#1C1C1E] border-white/10 text-white font-mono w-28 text-right"
                  step={field.type === "percent" || field.type === "multiplier" ? 0.1 : 1}
                  data-testid={`target-${field.key}`}
                />
                <span className="text-white/30 text-xs font-mono w-8">
                  {field.type === "percent" ? "%" : field.type === "multiplier" ? "x" : field.type === "currency" ? "CHF" : ""}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recalculate */}
      <div className="bg-[#121214] border border-white/10 rounded-sm p-6">
        <p className="text-xs font-body text-white/40 uppercase tracking-wider mb-3">
          {lang === "fr" ? "Outils de maintenance" : "Maintenance tools"}
        </p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white font-medium">
              {lang === "fr" ? "Recalculer les KPIs" : "Recalculate KPIs"}
            </p>
            <p className="text-xs text-white/30 mt-0.5">
              {lang === "fr"
                ? "Recalcule les revenus/dépenses de chaque mois depuis les transactions"
                : "Recomputes revenues/expenses for each month from actual transactions"}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleRecalculate}
            disabled={recalculating}
            className="border-white/10 text-white/60 hover:text-white hover:bg-white/5 text-xs flex-shrink-0"
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
      <div className="bg-[#121214] border border-red-500/20 rounded-sm p-6">
        <p className="text-xs font-body text-red-400/60 uppercase tracking-wider mb-3">
          {lang === "fr" ? "Zone dangereuse" : "Danger zone"}
        </p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white font-medium">
              {lang === "fr" ? "Réinitialiser les données" : "Reset data"}
            </p>
            <p className="text-xs text-white/30 mt-0.5">
              {lang === "fr"
                ? "Supprime toutes les données transactionnelles (membres, paiements, KPIs, challenges, cours) tout en conservant votre compte et votre configuration"
                : "Deletes all transactional data (members, payments, KPIs, challenges, courses) while keeping your account and configuration"}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setResetModalOpen(true)}
            className="border-red-500/30 text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs flex-shrink-0"
            data-testid="reset-data-btn"
          >
            <Trash2 size={12} className="mr-1.5" />
            {lang === "fr" ? "Réinitialiser" : "Reset"}
          </Button>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      <Dialog open={resetModalOpen} onOpenChange={setResetModalOpen}>
        <DialogContent className="bg-[#1C1C1E] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle size={20} />
              {lang === "fr" ? "Réinitialisation des données" : "Data reset"}
            </DialogTitle>
            <DialogDescription className="text-white/50">
              {lang === "fr"
                ? "Cette action est irréversible. Toutes les données suivantes seront supprimées :"
                : "This action is irreversible. All following data will be deleted:"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <ul className="text-red-300 text-sm space-y-1">
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
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
              <p className="text-emerald-400 text-sm font-medium mb-1">Données conservées :</p>
              <ul className="text-emerald-300 text-sm space-y-1">
                <li>- Votre compte utilisateur</li>
                <li>- Paramètres du club et objectifs KPI</li>
                <li>- Catégories comptables</li>
                <li>- Types d'abonnements et types de membres</li>
                <li>- Colonnes KPI personnalisées</li>
              </ul>
            </div>
            <div>
              <label className="text-white/50 text-xs">
                Tapez <span className="text-red-400 font-mono font-bold">RESET</span> pour confirmer
              </label>
              <Input
                value={resetConfirm}
                onChange={(e) => setResetConfirm(e.target.value)}
                placeholder="RESET"
                className="bg-[#121214] border-white/10 text-white mt-1 font-mono"
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
              className="bg-red-600 hover:bg-red-700 disabled:opacity-30"
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
