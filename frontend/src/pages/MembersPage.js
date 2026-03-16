import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { format, differenceInDays, parseISO, addYears } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Users,
  Plus,
  Search,
  AlertTriangle,
  Calendar,
  Mail,
  Phone,
  RefreshCw,
  Trash2,
  Edit,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  CreditCard,
  ClipboardCheck,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { toast } from "sonner";
import { useTranslations } from "../hooks/useTranslations";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Fallback values (used if API returns empty)
const DEFAULT_MEMBER_TYPES = [
  "Membres Généraux Récurrents",
  "Membres PIF",
  "Membres PT",
];

const DEFAULT_MEMBERSHIPS = [
  "Mensuel",
  "3 Mois",
  "6 Mois",
  "6 Semaines",
  "Annuel",
  "Annuel PT",
];

const PAYMENT_METHODS = [
  { value: "prelevement", label: "Prélèvement automatique" },
  { value: "carte", label: "Carte bancaire" },
  { value: "virement", label: "Virement" },
  { value: "especes", label: "Espèces" },
];

const BILLING_CYCLE_TYPES = [
  { value: "monthly_day", label: "Jour fixe du mois" },
  { value: "interval_days", label: "Tous les X jours" },
];

export default function MembersPage() {
  const { lang } = useTranslations();
  const queryClient = useQueryClient();
  const searchParams = new URLSearchParams(window.location.search);
  const urlSearch = searchParams.get("search") || "";
  const [search, setSearch] = useState(urlSearch);
  const [filterType, setFilterType] = useState("all");
  const [view, setView] = useState(urlSearch ? "all" : "active"); // "all" | "active" | "coaches" | "expired"
  const [showExpiring, setShowExpiring] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [expandedMember, setExpandedMember] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    membership: "",
    member_type: "Membres Généraux Récurrents",
    contract_signed_date: "",
    subscription_end_date: "",
    cash_collected: 0,
    notes: "",
    // Billing
    billing_enabled: true,
    billing_amount: 0,
    billing_cycle_type: "monthly_day",
    billing_cycle_value: 1,
    billing_payment_method: "prelevement",
    // Annual review
    annual_review_enabled: false,
    // Duo
    is_duo: false,
    duo_partner_name: "",
    duo_partner_email: "",
    duo_partner_phone: "",
  });
  const [renewData, setRenewData] = useState({
    new_end_date: "",
    renewal_duration: "12 mois",
    notes: "",
    // Membership change
    change_membership: false,
    new_membership: "",
    new_member_type: "",
    // Billing cycle options for renewal
    update_billing: false,
    billing_cycle_type: "monthly_day",
    billing_cycle_value: 1,
    billing_amount: 0,
    billing_payment_method: "prelevement",
  });

  // Fetch members
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["members"],
    queryFn: () => axios.get(`${API}/members`).then((r) => r.data),
  });

  // Fetch expiring members
  const { data: expiringMembers = [] } = useQuery({
    queryKey: ["members", "expiring"],
    queryFn: () => axios.get(`${API}/members/expiring?days=30`).then((r) => r.data),
  });

  // Fetch renewals for expanded member
  const { data: renewals = [] } = useQuery({
    queryKey: ["renewals", expandedMember],
    queryFn: () =>
      expandedMember
        ? axios.get(`${API}/members/${expandedMember}/renewals`).then((r) => r.data)
        : [],
    enabled: !!expandedMember,
  });

  // Fetch membership types from settings
  const { data: membershipTypes = [] } = useQuery({
    queryKey: ["membership-types"],
    queryFn: () => axios.get(`${API}/settings/membership-types?active_only=true`).then((r) => r.data),
  });

  // Fetch member types from settings
  const { data: memberTypes = [] } = useQuery({
    queryKey: ["member-types"],
    queryFn: () => axios.get(`${API}/settings/member-types?active_only=true`).then((r) => r.data),
  });

  // Build renewal duration options from membership types
  const RENEWAL_DURATION_OPTIONS = useMemo(() => {
    if (membershipTypes.length === 0) {
      return [
        { value: "1 mois", label: "1 mois" },
        { value: "3 mois", label: "3 mois" },
        { value: "6 mois", label: "6 mois" },
        { value: "6 semaines", label: "6 semaines" },
        { value: "12 mois", label: "12 mois" },
      ];
    }
    return membershipTypes.map(t => {
      let label;
      if (t.duration_days) {
        label = `${t.duration_days} jours`;
        if (t.duration_days === 42) label = "6 semaines";
      } else if (t.duration_months === 1) {
        label = "1 mois";
      } else if (t.duration_months === 12) {
        label = "12 mois";
      } else {
        label = `${t.duration_months} mois`;
      }
      return { value: label, label: `${t.name} (${label})` };
    });
  }, [membershipTypes]);

  const MEMBERSHIP_OPTIONS = membershipTypes.length > 0
    ? membershipTypes.map(t => t.name)
    : DEFAULT_MEMBERSHIPS;

  const MEMBER_TYPES = memberTypes.length > 0
    ? memberTypes.map(t => t.name)
    : DEFAULT_MEMBER_TYPES;

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: (data) =>
      selectedMember
        ? axios.put(`${API}/members/${selectedMember.id}`, data)
        : axios.post(`${API}/members`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["members"]);
      setModalOpen(false);
      setSelectedMember(null);
      toast.success(selectedMember ? "Membre mis à jour" : "Membre ajouté");
    },
    onError: () => toast.error("Erreur lors de la sauvegarde"),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => axios.delete(`${API}/members/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(["members"]);
      toast.success("Membre supprimé");
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  // Renew mutation
  const renewMutation = useMutation({
    mutationFn: ({ id, data }) => axios.post(`${API}/members/${id}/renew`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["members"]);
      setRenewModalOpen(false);
      setSelectedMember(null);
      toast.success("Abonnement renouvelé");
    },
    onError: () => toast.error("Erreur lors du renouvellement"),
  });

  // Computed member categories
  const today = new Date().toISOString().split('T')[0];
  const coaches = members.filter(m => m.is_coach);
  const nonCoaches = members.filter(m => !m.is_coach);
  const activeMembersOnly = nonCoaches.filter(m => !m.subscription_end_date || m.subscription_end_date >= today);
  const expiredMembers = nonCoaches.filter(m => m.subscription_end_date && m.subscription_end_date < today);

  const getDaysRemaining = (endDate) => {
    if (!endDate) return null;
    return differenceInDays(parseISO(endDate), new Date());
  };

  // Filter members
  const filteredMembers = useMemo(() => {
    let base = members;
    if (view === "active") base = activeMembersOnly;
    else if (view === "coaches") base = coaches;
    else if (view === "expired") base = expiredMembers;

    if (showExpiring) {
      base = base.filter(m => {
        const days = getDaysRemaining(m.subscription_end_date);
        return days !== null && days >= 0 && days <= 30;
      });
    }
    if (filterType !== "all") base = base.filter(m => m.member_type === filterType);
    if (search) {
      const s = search.toLowerCase();
      base = base.filter(m =>
        m.name?.toLowerCase().includes(s) ||
        m.email?.toLowerCase().includes(s) ||
        m.membership?.toLowerCase().includes(s)
      );
    }
    return base;
  }, [members, view, filterType, search, showExpiring, activeMembersOnly, coaches, expiredMembers]);

  // Stats
  const stats = useMemo(() => ({
    total: members.length,
    active: activeMembersOnly.length,
    coaches: coaches.length,
    expired: expiredMembers.length,
    expiring: nonCoaches.filter(m => {
      const days = getDaysRemaining(m.subscription_end_date);
      return days !== null && days >= 0 && days <= 30;
    }).length,
    byType: MEMBER_TYPES.reduce((acc, type) => {
      acc[type] = members.filter((m) => m.member_type === type).length;
      return acc;
    }, {}),
  }), [members, activeMembersOnly, coaches, expiredMembers, nonCoaches]);

  const openAddModal = () => {
    setSelectedMember(null);
    setFormData({
      name: "",
      email: "",
      phone: "",
      membership: "",
      member_type: "Membres Généraux Récurrents",
      contract_signed_date: format(new Date(), "yyyy-MM-dd"),
      subscription_end_date: format(addYears(new Date(), 1), "yyyy-MM-dd"),
      cash_collected: 0,
      notes: "",
      billing_enabled: true,
      billing_amount: 100,
      billing_cycle_type: "monthly_day",
      billing_cycle_value: 1,
      billing_payment_method: "prelevement",
      review_enabled: false,
      review_frequency: "annually",
      annual_review_enabled: false,
    });
    setModalOpen(true);
  };

  const openEditModal = (member) => {
    setSelectedMember(member);
    setFormData({
      name: member.name || "",
      email: member.email || "",
      phone: member.phone || "",
      membership: member.membership || "",
      member_type: member.member_type || "Membres Généraux Récurrents",
      contract_signed_date: member.contract_signed_date || "",
      subscription_end_date: member.subscription_end_date || "",
      cash_collected: member.cash_collected || 0,
      notes: member.notes || "",
      billing_enabled: member.billing_enabled !== false,
      billing_amount: member.billing_amount || 0,
      billing_cycle_type: member.billing_cycle_type || "monthly_day",
      billing_cycle_value: member.billing_cycle_value || 1,
      billing_payment_method: member.billing_payment_method || "prelevement",
      review_enabled: member.annual_review_enabled || member.review_enabled || false,
      review_frequency: member.review_frequency || "annually",
      annual_review_enabled: member.annual_review_enabled || false,
      is_duo: member.is_duo || false,
      duo_partner_name: "",
      duo_partner_email: "",
      duo_partner_phone: "",
    });
    setModalOpen(true);
  };

  const openRenewModal = (member) => {
    setSelectedMember(member);
    const currentEnd = member.subscription_end_date
      ? parseISO(member.subscription_end_date)
      : new Date();
    const newEnd = addYears(currentEnd, 1);
    
    setRenewData({
      new_end_date: format(newEnd, "yyyy-MM-dd"),
      renewal_duration: "12 mois",
      notes: "",
      change_membership: false,
      new_membership: member.membership || "",
      new_member_type: member.member_type || "",
      update_billing: false,
      billing_cycle_type: member.billing_cycle_type || "monthly_day",
      billing_cycle_value: member.billing_cycle_value || 1,
      billing_amount: member.billing_amount || 0,
      billing_payment_method: member.billing_payment_method || "prelevement",
    });
    setRenewModalOpen(true);
  };

  const getStatusBadge = (member) => {
    const days = getDaysRemaining(member.subscription_end_date);
    if (days === null) return null;
    
    if (days < 0) {
      return <Badge variant="destructive">Expiré</Badge>;
    } else if (days <= 7) {
      return <Badge variant="destructive">Expire dans {days}j</Badge>;
    } else if (days <= 30) {
      return <Badge variant="warning" className="bg-[rgba(255,214,10,0.15)] text-[var(--color-warning)]">Expire dans {days}j</Badge>;
    }
    return <Badge variant="secondary" className="bg-[rgba(48,209,88,0.15)] text-[var(--color-success)]">Actif</Badge>;
  };

  return (
    <div className="space-y-6" data-testid="members-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="tf-page-header">
            {lang === "fr" ? "Gestion des Membres" : "Members Management"}
          </h1>
          <p className="tf-page-subtitle">
            {lang === "fr" ? "Abonnements et échéances" : "Subscriptions and expirations"}
          </p>
        </div>
        <Button onClick={openAddModal} className="bg-[var(--color-accent)] hover:opacity-85 font-bold uppercase tracking-wider text-xs" data-testid="add-member-btn">
          <Plus size={16} className="mr-2" />
          {lang === "fr" ? "Ajouter un membre" : "Add member"}
        </Button>
      </div>

      {/* View Tabs + Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 tf-stagger">
        <div
          className="tf-stat cursor-pointer transition-all"
          style={{ borderColor: view === "active" ? 'var(--color-success)' : undefined, borderWidth: view === "active" ? '2px' : undefined }}
          onClick={() => { setView("active"); setShowExpiring(false); }}
          data-testid="tab-active"
        >
          <p className="tf-stat-label" style={{ color: 'var(--color-success)' }}>Membres Actifs</p>
          <p className="tf-number-large" style={{ marginTop: 'var(--space-2)', color: view === "active" ? 'var(--color-success)' : undefined }}>{stats.active}</p>
        </div>
        <div
          className="tf-stat cursor-pointer transition-all"
          style={{ borderColor: view === "coaches" ? 'var(--color-accent)' : undefined, borderWidth: view === "coaches" ? '2px' : undefined }}
          onClick={() => { setView("coaches"); setShowExpiring(false); }}
          data-testid="tab-coaches"
        >
          <p className="tf-stat-label" style={{ color: 'var(--color-accent)' }}>Coachs</p>
          <p className="tf-number-large" style={{ marginTop: 'var(--space-2)', color: view === "coaches" ? 'var(--color-accent)' : undefined }}>{stats.coaches}</p>
        </div>
        <div
          className="tf-stat cursor-pointer transition-all"
          style={{ borderColor: view === "expired" ? 'var(--color-danger)' : undefined, borderWidth: view === "expired" ? '2px' : undefined }}
          onClick={() => { setView("expired"); setShowExpiring(false); }}
          data-testid="tab-expired"
        >
          <p className="tf-stat-label" style={{ color: 'var(--color-danger)' }}>Expirés / Churn</p>
          <p className="tf-number-large" style={{ marginTop: 'var(--space-2)', color: view === "expired" ? 'var(--color-danger)' : undefined }}>{stats.expired}</p>
        </div>
        <div
          className="tf-stat cursor-pointer transition-all"
          style={{ borderColor: showExpiring ? 'var(--color-warning)' : undefined, borderWidth: showExpiring ? '2px' : undefined }}
          onClick={() => { setShowExpiring(!showExpiring); if (!showExpiring) setView("active"); }}
          data-testid="tab-expiring"
        >
          <p className="tf-stat-label flex items-center gap-1" style={{ color: 'var(--color-warning)' }}>
            <AlertTriangle size={12} />
            Expirant (30j)
          </p>
          <p className="tf-number-large" style={{ marginTop: 'var(--space-2)', color: showExpiring ? 'var(--color-warning)' : undefined }}>{stats.expiring}</p>
        </div>
        <div
          className="tf-stat cursor-pointer transition-all"
          style={{ borderColor: view === "all" ? 'var(--color-text-secondary)' : undefined, borderWidth: view === "all" ? '2px' : undefined }}
          onClick={() => { setView("all"); setShowExpiring(false); }}
          data-testid="tab-all"
        >
          <p className="tf-stat-label">Tous</p>
          <p className="tf-number-large" style={{ marginTop: 'var(--space-2)' }}>{stats.total}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" size={16} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === "fr" ? "Rechercher..." : "Search..."}
            className="pl-10 bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white"
            data-testid="member-search"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[220px] bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white" data-testid="type-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
            <SelectItem value="all" className="text-white">Tous les types</SelectItem>
            {MEMBER_TYPES.map((type) => (
              <SelectItem key={type} value={type} className="text-white">{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="tf-card overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-[var(--color-border)] hover:bg-transparent">
              <TableHead className="text-[var(--color-text-secondary)]">Membre</TableHead>
              <TableHead className="text-[var(--color-text-secondary)]">Type</TableHead>
              <TableHead className="text-[var(--color-text-secondary)]">Abonnement</TableHead>
              <TableHead className="text-[var(--color-text-secondary)]">Date signature</TableHead>
              <TableHead className="text-[var(--color-text-secondary)]">Expiration</TableHead>
              <TableHead className="text-[var(--color-text-secondary)]">Statut</TableHead>
              <TableHead className="text-[var(--color-text-secondary)] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-[var(--color-text-secondary)] py-8">
                  Chargement...
                </TableCell>
              </TableRow>
            ) : filteredMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-[var(--color-text-secondary)] py-8">
                  Aucun membre trouvé
                </TableCell>
              </TableRow>
            ) : (
              filteredMembers.map((member) => {
                const isExpired = member.subscription_end_date && member.subscription_end_date < today;
                const rowOpacity = isExpired ? "opacity-50" : "";
                return (
                <>
                  <TableRow
                    key={member.id}
                    className={`border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] cursor-pointer ${rowOpacity}`}
                    onClick={() => setExpandedMember(expandedMember === member.id ? null : member.id)}
                    data-testid={`member-row-${member.id}`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {expandedMember === member.id ? <ChevronUp size={14} className="text-[var(--color-text-tertiary)]" /> : <ChevronDown size={14} className="text-[var(--color-text-tertiary)]" />}
                        <div className="flex items-center gap-2">
                          <p className="text-white font-medium">{member.name}</p>
                          {member.is_coach && (
                            <Badge className="bg-[rgba(10,132,255,0.2)] text-[var(--color-accent)] border-0 text-[9px] px-1.5 py-0 font-bold tracking-wider" data-testid="coach-badge">COACH</Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-[var(--color-border-strong)] text-[var(--color-text-secondary)]">
                        {member.member_type?.replace("Membres ", "")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[var(--color-text-secondary)]">
                      <div className="flex items-center gap-1.5">
                        {member.membership}
                        {member.is_duo && (
                          <Badge className="bg-[rgba(10,132,255,0.15)] text-[var(--color-accent)] border-0 text-[10px] px-1.5">DUO</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-[var(--color-text-secondary)]">
                      {member.contract_signed_date
                        ? format(parseISO(member.contract_signed_date), "dd MMM yyyy", { locale: fr })
                        : "-"}
                    </TableCell>
                    <TableCell className="text-[var(--color-text-secondary)]">
                      {member.subscription_end_date
                        ? format(parseISO(member.subscription_end_date), "dd MMM yyyy", { locale: fr })
                        : "-"}
                    </TableCell>
                    <TableCell>{getStatusBadge(member)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const days = getDaysRemaining(member.subscription_end_date);
                          const isExpiring = days !== null && days <= 30;
                          return isExpiring ? (
                            <Button
                              size="sm"
                              className="bg-[var(--color-accent)] hover:opacity-85 text-xs gap-1"
                              onClick={() => openRenewModal(member)}
                              data-testid={`renew-${member.id}`}
                            >
                              <RefreshCw size={12} />
                              Renouveler
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-[var(--color-accent)] hover:text-[var(--color-accent)] hover:bg-[rgba(10,132,255,0.08)]"
                              onClick={() => openRenewModal(member)}
                              data-testid={`renew-${member.id}`}
                            >
                              <RefreshCw size={14} />
                            </Button>
                          );
                        })()}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-[var(--color-accent)] hover:text-[var(--color-accent)] hover:bg-[rgba(10,132,255,0.08)]"
                          onClick={() => openEditModal(member)}
                          data-testid={`edit-${member.id}`}
                        >
                          <Edit size={14} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-[var(--color-danger)] hover:text-[var(--color-danger)] hover:bg-[rgba(255,69,58,0.08)]"
                          onClick={() => deleteMutation.mutate(member.id)}
                          data-testid={`delete-${member.id}`}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedMember === member.id && (
                    <TableRow className="bg-[var(--color-bg-secondary)]">
                      <TableCell colSpan={7}>
                        <div className="py-4 px-6 space-y-4">
                          <div className="grid grid-cols-3 gap-6">
                            <div>
                              <p className="text-[var(--color-text-secondary)] text-xs uppercase mb-1">Contact</p>
                              <p className="text-white flex items-center gap-2">
                                <Mail size={14} className="text-[var(--color-text-secondary)]" />
                                {member.email || "-"}
                              </p>
                              <p className="text-white flex items-center gap-2 mt-1">
                                <Phone size={14} className="text-[var(--color-text-secondary)]" />
                                {member.phone || "-"}
                              </p>
                            </div>
                            <div>
                              <p className="text-[var(--color-text-secondary)] text-xs uppercase mb-1">Cash collecté</p>
                              <p className="tf-number-large" style={{color:"var(--color-success)"}}>
                                {member.cash_collected?.toLocaleString("fr-CH")} CHF
                              </p>
                            </div>
                            <div>
                              <p className="text-[var(--color-text-secondary)] text-xs uppercase mb-1">Notes</p>
                              <p className="text-[var(--color-text-secondary)] text-sm">{member.notes || "Aucune note"}</p>
                            </div>
                          </div>
                          {renewals.length > 0 && (
                            <div>
                              <p className="text-[var(--color-text-secondary)] text-xs uppercase mb-2">Historique des renouvellements</p>
                              <div className="space-y-2">
                                {renewals.map((r) => (
                                  <div key={r.id} className="flex items-center gap-4 text-sm">
                                    <CheckCircle2 size={14} className="text-[var(--color-success)]" />
                                    <span className="text-[var(--color-text-secondary)]">{r.renewal_duration}</span>
                                    <span className="text-[var(--color-text-secondary)]">→</span>
                                    <span className="text-white">{r.new_end_date}</span>
                                    <span className="text-[var(--color-text-tertiary)] text-xs">
                                      {format(parseISO(r.created_at), "dd/MM/yyyy")}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              )})
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedMember ? "Modifier le membre" : "Ajouter un membre"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="tf-stat-label">Nom *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
                  data-testid="member-name-input"
                />
              </div>
              <div>
                <label className="tf-stat-label">Email</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
                  data-testid="member-email-input"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="tf-stat-label">Téléphone</label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
                />
              </div>
              <div>
                <label className="tf-stat-label">Type de membre</label>
                <Select value={formData.member_type} onValueChange={(v) => setFormData({ ...formData, member_type: v })}>
                  <SelectTrigger className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
                    {MEMBER_TYPES.map((type) => (
                      <SelectItem key={type} value={type} className="text-white">{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="tf-stat-label">Abonnement</label>
                <Select 
                  value={formData.membership} 
                  onValueChange={(v) => {
                    // Find the membership type to get default billing settings
                    const selectedType = membershipTypes.find(t => t.name === v);
                    const newData = { ...formData, membership: v };
                    
                    if (selectedType) {
                      // Pre-fill billing settings from membership type defaults
                      newData.billing_amount = selectedType.price || formData.billing_amount;
                      newData.billing_enabled = selectedType.is_recurring;
                      newData.member_type = selectedType.member_type || formData.member_type;
                      newData.is_duo = selectedType.is_duo || false;
                      if (selectedType.default_billing_cycle_type) {
                        newData.billing_cycle_type = selectedType.default_billing_cycle_type;
                      }
                      if (selectedType.default_billing_cycle_value) {
                        newData.billing_cycle_value = selectedType.default_billing_cycle_value;
                      }
                      // Auto-detect challenge type and set review accordingly
                      if (v.toLowerCase().includes("challenge")) {
                        newData.review_enabled = true;
                        newData.annual_review_enabled = true;
                        newData.review_frequency = "challenge";
                      }
                    }
                    
                    setFormData(newData);
                  }}
                >
                  <SelectTrigger className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
                    {MEMBERSHIP_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt} className="text-white">{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="tf-stat-label">Cash collecté (CHF)</label>
                <Input
                  type="number"
                  value={formData.cash_collected}
                  onChange={(e) => setFormData({ ...formData, cash_collected: parseFloat(e.target.value) || 0 })}
                  className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[var(--color-text-secondary)] text-xs uppercase flex items-center gap-1">
                  <Calendar size={12} /> Date de signature
                </label>
                <Input
                  type="date"
                  value={formData.contract_signed_date}
                  onChange={(e) => setFormData({ ...formData, contract_signed_date: e.target.value })}
                  className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
                  data-testid="contract-date-input"
                />
              </div>
              <div>
                <label className="text-[var(--color-text-secondary)] text-xs uppercase flex items-center gap-1">
                  <Clock size={12} /> Date d'expiration
                </label>
                <Input
                  type="date"
                  value={formData.subscription_end_date}
                  onChange={(e) => setFormData({ ...formData, subscription_end_date: e.target.value })}
                  className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
                  data-testid="expiration-date-input"
                />
              </div>
            </div>
            <div>
              <label className="tf-stat-label">Notes</label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
              />
            </div>

            {/* Billing Section - Read-only when membership type is selected */}
            <div className="border-t border-[var(--color-border)] pt-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-[var(--color-text-secondary)] text-sm flex items-center gap-2">
                  <CreditCard size={14} className="text-[var(--color-success)]" />
                  Facturation récurrente
                </label>
                <Switch
                  checked={formData.billing_enabled}
                  onCheckedChange={(v) => setFormData({ ...formData, billing_enabled: v })}
                  disabled={!!membershipTypes.find(t => t.name === formData.membership)}
                />
              </div>
              
              {formData.billing_enabled && (
                <div className="space-y-3 bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-3">
                  {/* Info banner when values come from membership type */}
                  {membershipTypes.find(t => t.name === formData.membership) && (
                    <div className="bg-[rgba(10,132,255,0.08)] border border-[rgba(10,132,255,0.15)] rounded p-2 mb-2">
                      <p className="text-[var(--color-accent)] text-xs">
                        Valeurs définies par le type d'abonnement "{formData.membership}" 
                        <br/>
                        <span className="text-[var(--color-accent)] opacity-70">Modifiables dans Config. Types</span>
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[var(--color-text-secondary)] text-xs">Montant (CHF)</label>
                      <Input
                        type="number"
                        value={formData.billing_amount}
                        onChange={(e) => setFormData({ ...formData, billing_amount: parseFloat(e.target.value) || 0 })}
                        className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1 h-8 disabled:opacity-50 disabled:cursor-not-allowed"
                        data-testid="billing-amount-input"
                        disabled={!!membershipTypes.find(t => t.name === formData.membership)}
                      />
                    </div>
                    <div>
                      <label className="text-[var(--color-text-secondary)] text-xs">Méthode</label>
                      <Select 
                        value={formData.billing_payment_method} 
                        onValueChange={(v) => setFormData({ ...formData, billing_payment_method: v })}
                      >
                        <SelectTrigger className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
                          {PAYMENT_METHODS.map((m) => (
                            <SelectItem key={m.value} value={m.value} className="text-white">{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[var(--color-text-secondary)] text-xs">Cycle de facturation</label>
                      <Select 
                        value={formData.billing_cycle_type} 
                        onValueChange={(v) => setFormData({ ...formData, billing_cycle_type: v })}
                        disabled={!!membershipTypes.find(t => t.name === formData.membership)}
                      >
                        <SelectTrigger className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1 h-8 disabled:opacity-50 disabled:cursor-not-allowed">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
                          {BILLING_CYCLE_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value} className="text-white">{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-[var(--color-text-secondary)] text-xs">
                        {formData.billing_cycle_type === "monthly_day" ? "Jour du mois (1-28)" : "Intervalle (jours)"}
                      </label>
                      <Input
                        type="number"
                        min={1}
                        max={formData.billing_cycle_type === "monthly_day" ? 28 : 365}
                        value={formData.billing_cycle_value}
                        onChange={(e) => setFormData({ ...formData, billing_cycle_value: parseInt(e.target.value) || 1 })}
                        className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1 h-8 disabled:opacity-50 disabled:cursor-not-allowed"
                        data-testid="billing-cycle-value-input"
                        disabled={!!membershipTypes.find(t => t.name === formData.membership)}
                      />
                    </div>
                  </div>
                  <p className="text-[var(--color-text-tertiary)] text-xs">
                    {formData.billing_cycle_type === "monthly_day"
                      ? `Facturé le ${formData.billing_cycle_value} de chaque mois`
                      : `Facturé tous les ${formData.billing_cycle_value} jours`}
                  </p>
                </div>
              )}
            </div>

            {/* Review Section - Choose frequency */}
            <div className="border-t border-[var(--color-border)] pt-4">
              <div className="flex items-center justify-between mb-3 bg-[rgba(100,210,255,0.08)] border border-[rgba(100,210,255,0.15)] rounded-[var(--radius-lg)] p-3">
                <label className="text-white text-sm font-medium flex items-center gap-2">
                  <ClipboardCheck size={16} className="text-[var(--color-info)]" />
                  Activer le Suivi / Bilan
                </label>
                <Switch
                  checked={formData.review_enabled}
                  onCheckedChange={(v) => setFormData({ ...formData, review_enabled: v, annual_review_enabled: v })}
                  data-testid="review-switch"
                />
              </div>
              {formData.review_enabled && (
                <div className="space-y-3 bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-3">
                  <div>
                    <label className="text-[var(--color-text-secondary)] text-xs">Fréquence du bilan</label>
                    <Select 
                      value={formData.review_frequency || "annually"} 
                      onValueChange={(v) => setFormData({ ...formData, review_frequency: v, annual_review_enabled: true })}
                    >
                      <SelectTrigger className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
                        <SelectItem value="challenge" className="text-white">Challenge (6 semaines)</SelectItem>
                        <SelectItem value="monthly" className="text-white">Mensuel</SelectItem>
                        <SelectItem value="quarterly" className="text-white">Trimestriel</SelectItem>
                        <SelectItem value="semi-annually" className="text-white">Semestriel</SelectItem>
                        <SelectItem value="annually" className="text-white">Annuel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-[var(--color-text-tertiary)] text-xs">
                    {formData.review_frequency === "challenge" && "Un bilan sera planifié 6 semaines après la date de signature"}
                    {formData.review_frequency === "monthly" && "Un bilan sera planifié chaque mois"}
                    {formData.review_frequency === "quarterly" && "Un bilan sera planifié tous les 3 mois"}
                    {formData.review_frequency === "semi-annually" && "Un bilan sera planifié tous les 6 mois"}
                    {(!formData.review_frequency || formData.review_frequency === "annually") && "Un bilan sera planifié 1 an après la date de signature"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Duo Subscription */}
          <div className="border-t border-[var(--color-border)] pt-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_duo || false}
                onChange={(e) => setFormData({ ...formData, is_duo: e.target.checked })}
                className="rounded"
                data-testid="duo-checkbox"
              />
              <label className="text-white text-sm">Abonnement Duo (2 personnes, 1 prix)</label>
            </div>
            {formData.is_duo && (
              <div className="mt-3 space-y-3 bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-3">
                <p className="tf-stat-label">Partenaire Duo</p>
                <div className="grid grid-cols-1 gap-2">
                  <Input
                    placeholder="Nom du partenaire *"
                    value={formData.duo_partner_name || ""}
                    onChange={(e) => setFormData({ ...formData, duo_partner_name: e.target.value })}
                    className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white h-8 text-sm"
                    data-testid="duo-partner-name"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Email"
                      value={formData.duo_partner_email || ""}
                      onChange={(e) => setFormData({ ...formData, duo_partner_email: e.target.value })}
                      className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white h-8 text-sm"
                      data-testid="duo-partner-email"
                    />
                    <Input
                      placeholder="Téléphone"
                      value={formData.duo_partner_phone || ""}
                      onChange={(e) => setFormData({ ...formData, duo_partner_phone: e.target.value })}
                      className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white h-8 text-sm"
                      data-testid="duo-partner-phone"
                    />
                  </div>
                </div>
                <p className="text-xs text-[var(--color-text-tertiary)]">Le partenaire sera créé automatiquement comme un membre distinct lié à celui-ci.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button
              onClick={() => saveMutation.mutate(formData)}
              disabled={!formData.name || saveMutation.isPending}
              className="bg-[var(--color-accent)] hover:opacity-85"
              data-testid="save-member-btn"
            >
              {saveMutation.isPending ? "..." : selectedMember ? "Mettre à jour" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Renew Modal */}
      <Dialog open={renewModalOpen} onOpenChange={setRenewModalOpen}>
        <DialogContent className="max-w-md overflow-y-auto" style={{ maxHeight: '90vh' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="text-[var(--color-success)]" size={20} />
              Renouveler l'abonnement
            </DialogTitle>
          </DialogHeader>
          {selectedMember && (
            <div className="space-y-4 py-4">
              <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-4">
                <p className="text-white font-medium">{selectedMember.name}</p>
                <p className="text-[var(--color-text-secondary)] text-sm">
                  Expire le: {selectedMember.subscription_end_date
                    ? format(parseISO(selectedMember.subscription_end_date), "dd MMMM yyyy", { locale: fr })
                    : "Non défini"}
                </p>
              </div>
              <div>
                <label className="tf-stat-label">Durée du renouvellement</label>
                <Select value={renewData.renewal_duration} onValueChange={(v) => setRenewData({ ...renewData, renewal_duration: v })}>
                  <SelectTrigger className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
                    {RENEWAL_DURATION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-white">{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="tf-stat-label">Nouvelle date d'expiration</label>
                <Input
                  type="date"
                  value={renewData.new_end_date}
                  onChange={(e) => setRenewData({ ...renewData, new_end_date: e.target.value })}
                  className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
                  data-testid="new-end-date-input"
                />
              </div>
              <div>
                <label className="tf-stat-label">Notes</label>
                <Input
                  value={renewData.notes}
                  onChange={(e) => setRenewData({ ...renewData, notes: e.target.value })}
                  className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
                  placeholder="Optionnel"
                />
              </div>

              {/* Membership type change option */}
              <div className="border-t border-[var(--color-border)] pt-4">
                <div
                  className="flex items-center justify-between mb-3 bg-[rgba(10,132,255,0.08)] border border-[rgba(10,132,255,0.15)] rounded-[var(--radius-lg)] p-3 cursor-pointer"
                  onClick={() => setRenewData(prev => ({ ...prev, change_membership: !prev.change_membership }))}
                >
                  <label className="text-white text-sm font-medium flex items-center gap-2 cursor-pointer">
                    <RefreshCw size={16} className="text-[var(--color-accent)]" />
                    Changer d'abonnement
                  </label>
                  <Switch
                    checked={renewData.change_membership}
                    onCheckedChange={(v) => setRenewData(prev => ({ ...prev, change_membership: v }))}
                    onClick={(e) => e.stopPropagation()}
                    data-testid="change-membership-switch"
                  />
                </div>
                
                {renewData.change_membership && (
                  <div className="space-y-3 bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-3">
                    <div>
                      <label className="text-[var(--color-text-secondary)] text-xs">Nouvel abonnement</label>
                      <Select value={renewData.new_membership} onValueChange={(v) => setRenewData(prev => ({ ...prev, new_membership: v }))}>
                        <SelectTrigger className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4} className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] max-h-[200px] overflow-y-auto z-[100]">
                          {MEMBERSHIP_OPTIONS.map((m) => (
                            <SelectItem key={m} value={m} className="text-white">{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-[var(--color-text-secondary)] text-xs">Type de membre</label>
                      <Select value={renewData.new_member_type} onValueChange={(v) => setRenewData(prev => ({ ...prev, new_member_type: v }))}>
                        <SelectTrigger className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4} className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] max-h-[200px] overflow-y-auto z-[100]">
                          {MEMBER_TYPES.map((t) => (
                            <SelectItem key={t} value={t} className="text-white">{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              {/* Billing cycle update option */}
              <div className="border-t border-[var(--color-border)] pt-4">
                <div
                  className="flex items-center justify-between mb-3 rounded-[var(--radius-lg)] p-3 cursor-pointer"
                  style={{ background: 'rgba(48,209,88,0.08)', border: '1px solid rgba(48,209,88,0.15)' }}
                  onClick={() => setRenewData(prev => ({ ...prev, update_billing: !prev.update_billing }))}
                >
                  <label className="text-white text-sm font-medium flex items-center gap-2 cursor-pointer">
                    <CreditCard size={16} className="text-[var(--color-success)]" />
                    Modifier le cycle de facturation
                  </label>
                  <Switch
                    checked={renewData.update_billing}
                    onCheckedChange={(v) => setRenewData(prev => ({ ...prev, update_billing: v }))}
                    onClick={(e) => e.stopPropagation()}
                    data-testid="update-billing-switch"
                  />
                </div>
                
                {renewData.update_billing && (
                  <div className="space-y-3 bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[var(--color-text-secondary)] text-xs">Montant (CHF)</label>
                        <Input
                          type="number"
                          value={renewData.billing_amount}
                          onChange={(e) => setRenewData(prev => ({ ...prev, billing_amount: parseFloat(e.target.value) || 0 }))}
                          className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1 h-8"
                          data-testid="renew-billing-amount"
                        />
                      </div>
                      <div>
                        <label className="text-[var(--color-text-secondary)] text-xs">Méthode</label>
                        <Select value={renewData.billing_payment_method} onValueChange={(v) => setRenewData(prev => ({ ...prev, billing_payment_method: v }))}>
                          <SelectTrigger className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent position="popper" sideOffset={4} className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] max-h-[200px] overflow-y-auto z-[100]">
                            {PAYMENT_METHODS.map((m) => (
                              <SelectItem key={m.value} value={m.value} className="text-white">{m.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[var(--color-text-secondary)] text-xs">Cycle de facturation</label>
                        <Select value={renewData.billing_cycle_type} onValueChange={(v) => setRenewData(prev => ({ ...prev, billing_cycle_type: v }))}>
                          <SelectTrigger className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent position="popper" sideOffset={4} className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] max-h-[200px] overflow-y-auto z-[100]">
                            {BILLING_CYCLE_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value} className="text-white">{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-[var(--color-text-secondary)] text-xs">
                          {renewData.billing_cycle_type === "monthly_day" ? "Jour du mois (1-28)" : "Intervalle (jours)"}
                        </label>
                        <Input
                          type="number"
                          min={1}
                          max={renewData.billing_cycle_type === "monthly_day" ? 28 : 365}
                          value={renewData.billing_cycle_value}
                          onChange={(e) => setRenewData(prev => ({ ...prev, billing_cycle_value: parseInt(e.target.value) || 1 }))}
                          className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1 h-8"
                          data-testid="renew-billing-cycle-value"
                        />
                      </div>
                    </div>
                    <p className="text-[var(--color-text-tertiary)] text-xs">
                      {renewData.billing_cycle_type === "monthly_day"
                        ? `Facturé le ${renewData.billing_cycle_value} de chaque mois`
                        : `Facturé tous les ${renewData.billing_cycle_value} jours`}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenewModalOpen(false)}>Annuler</Button>
            <Button
              onClick={() => {
                const payload = {
                  new_end_date: renewData.new_end_date,
                  renewal_duration: renewData.renewal_duration,
                  notes: renewData.notes,
                };
                if (renewData.change_membership) {
                  payload.new_membership = renewData.new_membership;
                  payload.new_member_type = renewData.new_member_type;
                }
                if (renewData.update_billing) {
                  payload.billing_cycle_type = renewData.billing_cycle_type;
                  payload.billing_cycle_value = renewData.billing_cycle_value;
                  payload.billing_amount = renewData.billing_amount;
                  payload.billing_payment_method = renewData.billing_payment_method;
                }
                renewMutation.mutate({ id: selectedMember?.id, data: payload });
              }}
              disabled={!renewData.new_end_date || renewMutation.isPending}
              className="bg-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:opacity-85"
              data-testid="confirm-renew-btn"
            >
              {renewMutation.isPending ? "..." : "Renouveler"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
