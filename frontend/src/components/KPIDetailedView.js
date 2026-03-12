import { formatCHF, formatNum, formatPct } from "../utils/format";
import { useTranslations } from "../hooks/useTranslations";
import { 
  Users, DollarSign, TrendingUp, TrendingDown, Target, Phone, Calendar,
  UserPlus, UserMinus, Percent, BarChart3, Wallet, CreditCard,
} from "lucide-react";

const StatBox = ({ label, value, icon: Icon, color = "text-white", subValue }) => (
  <div className="bg-[#121214] border border-white/5 p-3 rounded-sm">
    <div className="flex items-center gap-2 mb-1">
      {Icon && <Icon size={12} className="text-white/30" />}
      <span className="text-[10px] text-white/40 uppercase tracking-wider">{label}</span>
    </div>
    <p className={`text-lg font-heading font-bold ${color}`}>{value}</p>
    {subValue && <p className="text-[10px] text-white/30 mt-0.5">{subValue}</p>}
  </div>
);

const SectionTitle = ({ children }) => (
  <div className="flex items-center gap-2 mb-3 mt-5">
    <div className="w-1 h-4 bg-rose-500 rounded-full" />
    <h3 className="text-xs font-heading font-bold text-white/60 uppercase tracking-wider">{children}</h3>
  </div>
);

export function KPIDetailedView({ kpi, lang }) {
  const { t } = useTranslations();

  if (!kpi) return null;

  return (
    <div className="space-y-4" data-testid="kpi-detailed-view">
      
      {/* Sales Funnel Section */}
      <SectionTitle>{lang === "fr" ? "Entonnoir de Vente" : "Sales Funnel"}</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
        <StatBox 
          label="Leads" 
          value={formatNum(kpi.leads)} 
          icon={UserPlus}
          color="text-blue-400"
        />
        <StatBox 
          label={lang === "fr" ? "Appels" : "Calls"} 
          value={formatNum(kpi.calls_made)} 
          icon={Phone}
          subValue={kpi.call_percentage > 0 ? `${kpi.call_percentage.toFixed(1)}%` : null}
        />
        <StatBox 
          label={lang === "fr" ? "Planifiés" : "Scheduled"} 
          value={formatNum(kpi.scheduled)} 
          icon={Calendar}
          subValue={kpi.sched_percentage > 0 ? `${kpi.sched_percentage.toFixed(1)}%` : null}
        />
        <StatBox 
          label="Show" 
          value={formatNum(kpi.show)} 
          icon={Users}
          subValue={kpi.show_percentage > 0 ? `${kpi.show_percentage.toFixed(1)}%` : null}
        />
        <StatBox 
          label="Close" 
          value={formatNum(kpi.close)} 
          icon={Target}
          color="text-green-400"
          subValue={kpi.close_percentage > 0 ? `${kpi.close_percentage.toFixed(1)}%` : null}
        />
        <StatBox 
          label={lang === "fr" ? "Cash Collecté" : "Cash Collected"} 
          value={formatCHF(kpi.cash_collected)} 
          icon={Wallet}
          color="text-green-400"
          subValue={kpi.avg_per_sale > 0 ? `Moy: ${formatCHF(kpi.avg_per_sale)}` : null}
        />
      </div>

      {/* Organic & Trials Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <SectionTitle>{lang === "fr" ? "Leads Organiques" : "Organic Leads"}</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            <StatBox 
              label="Leads" 
              value={formatNum(kpi.organic_leads)} 
              icon={UserPlus}
              color="text-emerald-400"
            />
            <StatBox 
              label="Close" 
              value={formatNum(kpi.organic_close)} 
              icon={Target}
              subValue={kpi.organic_close_percentage > 0 ? `${kpi.organic_close_percentage.toFixed(1)}%` : null}
            />
            <StatBox 
              label="Cash" 
              value={formatCHF(kpi.organic_cash_collected)} 
              icon={Wallet}
              color="text-emerald-400"
            />
          </div>
        </div>

        <div>
          <SectionTitle>{lang === "fr" ? "Essais / Conversions" : "Trials / Conversions"}</SectionTitle>
          <div className="grid grid-cols-4 gap-2">
            <StatBox 
              label={lang === "fr" ? "En Essai" : "In Trial"} 
              value={formatNum(kpi.in_trial)} 
              icon={Users}
              color="text-amber-400"
            />
            <StatBox 
              label={lang === "fr" ? "Fin Essai" : "Ending"} 
              value={formatNum(kpi.trial_ending)} 
              icon={Calendar}
            />
            <StatBox 
              label={lang === "fr" ? "Convertis" : "Converted"} 
              value={formatNum(kpi.converted)} 
              icon={Target}
              color="text-green-400"
            />
            <StatBox 
              label={lang === "fr" ? "Taux Conv." : "Conv. Rate"} 
              value={`${(kpi.conversion_percentage || 0).toFixed(1)}%`} 
              icon={Percent}
              color={kpi.conversion_percentage > 50 ? "text-green-400" : "text-amber-400"}
            />
          </div>
        </div>
      </div>

      {/* Members Detailed Section */}
      <SectionTitle>{lang === "fr" ? "Détail des Membres" : "Members Breakdown"}</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
        <StatBox 
          label={lang === "fr" ? "Membres Actifs" : "Active Members"} 
          value={formatNum(kpi.total_active_members || kpi.total_members)} 
          icon={Users}
          color="text-blue-400"
        />
        <StatBox 
          label="PIF Members" 
          value={formatNum(kpi.pif_members)} 
          icon={Users}
          subValue={kpi.pif_exits > 0 ? `Exits: ${kpi.pif_exits}` : null}
        />
        <StatBox 
          label={lang === "fr" ? "PIF Churn" : "PIF Churn"} 
          value={`${(kpi.pif_churn || 0).toFixed(2)}%`} 
          icon={TrendingDown}
          color={kpi.pif_churn < 3 ? "text-green-400" : "text-red-400"}
        />
        <StatBox 
          label={lang === "fr" ? "Récurrents" : "Recurring"} 
          value={formatNum(kpi.recurring_general_members)} 
          icon={Users}
          subValue={kpi.general_exits > 0 ? `Exits: ${kpi.general_exits}` : null}
        />
        <StatBox 
          label={lang === "fr" ? "Général Churn" : "General Churn"} 
          value={`${(kpi.general_churn || 0).toFixed(2)}%`} 
          icon={TrendingDown}
          color={kpi.general_churn < 5 ? "text-green-400" : "text-red-400"}
        />
        <StatBox 
          label="Pauses" 
          value={formatNum(kpi.pauses)} 
          icon={UserMinus}
          color="text-amber-400"
        />
      </div>

      {/* PT Members */}
      <div className="grid grid-cols-4 gap-2 mt-2">
        <StatBox 
          label={lang === "fr" ? "Membres PT" : "PT Members"} 
          value={formatNum(kpi.pt_members)} 
          icon={Users}
          color="text-purple-400"
        />
        <StatBox 
          label={lang === "fr" ? "PT Exits" : "PT Exits"} 
          value={formatNum(kpi.pt_exits)} 
          icon={UserMinus}
        />
        <StatBox 
          label={lang === "fr" ? "PT Churn" : "PT Churn"} 
          value={`${(kpi.pt_churn || 0).toFixed(2)}%`} 
          icon={TrendingDown}
          color={kpi.pt_churn < 5 ? "text-green-400" : "text-red-400"}
        />
        <StatBox 
          label={lang === "fr" ? "Revenu PT" : "PT Revenue"} 
          value={formatCHF(kpi.pt_revenue)} 
          icon={DollarSign}
          color="text-purple-400"
        />
      </div>

      {/* Revenue Detailed Section */}
      <SectionTitle>{lang === "fr" ? "Détail des Revenus" : "Revenue Breakdown"}</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
        <StatBox 
          label={lang === "fr" ? "EFT Général" : "General EFT"} 
          value={formatCHF(kpi.general_eft_revenue)} 
          icon={CreditCard}
          color="text-green-400"
        />
        <StatBox 
          label={lang === "fr" ? "Revenu PT" : "PT Revenue"} 
          value={formatCHF(kpi.pt_revenue)} 
          icon={DollarSign}
          color="text-purple-400"
        />
        <StatBox 
          label="Retail" 
          value={formatCHF(kpi.retail_revenue)} 
          icon={DollarSign}
        />
        <StatBox 
          label="Fast Cash" 
          value={formatCHF(kpi.fast_cash_revenue)} 
          icon={Wallet}
          color="text-amber-400"
        />
        <StatBox 
          label={lang === "fr" ? "Total Revenus" : "Total Revenue"} 
          value={formatCHF(kpi.total_revenue)} 
          icon={DollarSign}
          color="text-green-400"
        />
      </div>

      {/* Expenses Detailed Section */}
      <SectionTitle>{lang === "fr" ? "Détail des Dépenses" : "Expenses Breakdown"}</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
        <StatBox 
          label={lang === "fr" ? "Loyer" : "Rent"} 
          value={formatCHF(kpi.loyer || kpi.rent)} 
          icon={DollarSign}
          color="text-blue-400"
        />
        <StatBox 
          label={lang === "fr" ? "Salaires" : "Salaries"} 
          value={formatCHF(kpi.salaires)} 
          icon={Users}
          color="text-purple-400"
        />
        <StatBox 
          label={lang === "fr" ? "Salaires Coach" : "Coach Salaries"} 
          value={formatCHF(kpi.salaires_coach)} 
          icon={Users}
        />
        <StatBox 
          label={lang === "fr" ? "Charges" : "Utilities"} 
          value={formatCHF(kpi.utilities)} 
          icon={DollarSign}
        />
        <StatBox 
          label="Marketing" 
          value={formatCHF(kpi.marketing_spend)} 
          icon={BarChart3}
          color="text-rose-400"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 mt-2">
        <StatBox 
          label={lang === "fr" ? "Réparations" : "Repairs"} 
          value={formatCHF(kpi.repairs_maintenance)} 
          icon={DollarSign}
        />
        <StatBox 
          label={lang === "fr" ? "Logiciels" : "Software"} 
          value={formatCHF(kpi.computer_software)} 
          icon={DollarSign}
        />
        <StatBox 
          label={lang === "fr" ? "Internet/Tél" : "Internet/Phone"} 
          value={formatCHF(kpi.internet_telephone)} 
          icon={Phone}
        />
        <StatBox 
          label={lang === "fr" ? "Abonnements" : "Subscriptions"} 
          value={formatCHF(kpi.subscriptions)} 
          icon={CreditCard}
        />
        <StatBox 
          label={lang === "fr" ? "Banque" : "Bank Charges"} 
          value={formatCHF(kpi.bank_finance_charges)} 
          icon={DollarSign}
        />
        <StatBox 
          label={lang === "fr" ? "Assurance" : "Insurance"} 
          value={formatCHF(kpi.insurance)} 
          icon={DollarSign}
        />
      </div>

      {/* Advanced Metrics Section */}
      <SectionTitle>{lang === "fr" ? "Métriques Avancées" : "Advanced Metrics"}</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
        <StatBox 
          label={lang === "fr" ? "ACRM Général" : "General ACRM"} 
          value={formatCHF(kpi.general_acrm)} 
          icon={DollarSign}
          color="text-cyan-400"
        />
        <StatBox 
          label={lang === "fr" ? "LTV Général" : "General LTV"} 
          value={formatCHF(kpi.general_ltv)} 
          icon={TrendingUp}
          color="text-cyan-400"
        />
        <StatBox 
          label="PT ACRM" 
          value={formatCHF(kpi.pt_acrm)} 
          icon={DollarSign}
          color="text-purple-400"
        />
        <StatBox 
          label="PT LTV" 
          value={formatCHF(kpi.pt_ltv)} 
          icon={TrendingUp}
          color="text-purple-400"
        />
        <StatBox 
          label="CPL" 
          value={formatCHF(kpi.cpl)} 
          icon={Target}
          subValue="Cost Per Lead"
        />
        <StatBox 
          label="CPR" 
          value={formatCHF(kpi.cpr)} 
          icon={Target}
          subValue="Cost Per Result"
        />
      </div>

      <div className="grid grid-cols-3 gap-2 mt-2">
        <StatBox 
          label="RoAds" 
          value={`${(kpi.ro_ads || kpi.roas || 0).toFixed(2)}x`} 
          icon={BarChart3}
          color={kpi.ro_ads > 3 ? "text-green-400" : "text-amber-400"}
        />
        <StatBox 
          label={lang === "fr" ? "Surface Gym (sqft)" : "Gym Floor (sqft)"} 
          value={formatNum(kpi.gym_floor_sqft)} 
          icon={BarChart3}
        />
        <StatBox 
          label={lang === "fr" ? "Total Cours" : "Total Classes"} 
          value={formatNum(kpi.total_classes)} 
          icon={Calendar}
          color="text-blue-400"
        />
      </div>
    </div>
  );
}
