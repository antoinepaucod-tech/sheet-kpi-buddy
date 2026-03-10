import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { format, differenceInDays, parseISO } from "date-fns";
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
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
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

const MEMBER_TYPES = [
  "Membres Généraux Récurrents",
  "Membres PIF",
  "Membres PT",
];

const MEMBERSHIP_OPTIONS = [
  "Mensuel",
  "3 Mois",
  "6 Mois",
  "6 Semaines",
  "Annuel",
  "Annuel PT",
];

export default function MembersPage() {
  const { lang } = useTranslations();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [showExpiring, setShowExpiring] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [expandedMember, setExpandedMember] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    membership: "Annuel",
    member_type: "Membres Généraux Récurrents",
    contract_signed_date: "",
    subscription_end_date: "",
    cash_collected: 0,
    notes: "",
  });
  const [renewData, setRenewData] = useState({
    new_end_date: "",
    renewal_duration: "12 mois",
    notes: "",
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

  // Filter members
  const filteredMembers = useMemo(() => {
    let result = showExpiring ? expiringMembers : members;
    
    if (filterType !== "all") {
      result = result.filter((m) => m.member_type === filterType);
    }
    
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.name?.toLowerCase().includes(s) ||
          m.email?.toLowerCase().includes(s) ||
          m.membership?.toLowerCase().includes(s)
      );
    }
    
    return result;
  }, [members, expiringMembers, showExpiring, filterType, search]);

  // Stats
  const stats = useMemo(() => ({
    total: members.length,
    expiring: expiringMembers.length,
    byType: MEMBER_TYPES.reduce((acc, type) => {
      acc[type] = members.filter((m) => m.member_type === type).length;
      return acc;
    }, {}),
  }), [members, expiringMembers]);

  const openAddModal = () => {
    setSelectedMember(null);
    setFormData({
      name: "",
      email: "",
      phone: "",
      membership: "Annuel",
      member_type: "Membres Généraux Récurrents",
      contract_signed_date: format(new Date(), "yyyy-MM-dd"),
      subscription_end_date: format(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
      cash_collected: 0,
      notes: "",
    });
    setModalOpen(true);
  };

  const openEditModal = (member) => {
    setSelectedMember(member);
    setFormData({
      name: member.name || "",
      email: member.email || "",
      phone: member.phone || "",
      membership: member.membership || "Annuel",
      member_type: member.member_type || "Membres Généraux Récurrents",
      contract_signed_date: member.contract_signed_date || "",
      subscription_end_date: member.subscription_end_date || "",
      cash_collected: member.cash_collected || 0,
      notes: member.notes || "",
    });
    setModalOpen(true);
  };

  const openRenewModal = (member) => {
    setSelectedMember(member);
    const currentEnd = member.subscription_end_date
      ? parseISO(member.subscription_end_date)
      : new Date();
    const newEnd = new Date(currentEnd);
    newEnd.setFullYear(newEnd.getFullYear() + 1);
    
    setRenewData({
      new_end_date: format(newEnd, "yyyy-MM-dd"),
      renewal_duration: "12 mois",
      notes: "",
    });
    setRenewModalOpen(true);
  };

  const getDaysRemaining = (endDate) => {
    if (!endDate) return null;
    return differenceInDays(parseISO(endDate), new Date());
  };

  const getStatusBadge = (member) => {
    const days = getDaysRemaining(member.subscription_end_date);
    if (days === null) return null;
    
    if (days < 0) {
      return <Badge variant="destructive">Expiré</Badge>;
    } else if (days <= 7) {
      return <Badge variant="destructive">Expire dans {days}j</Badge>;
    } else if (days <= 30) {
      return <Badge variant="warning" className="bg-orange-500/20 text-orange-400">Expire dans {days}j</Badge>;
    }
    return <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400">Actif</Badge>;
  };

  return (
    <div className="space-y-6" data-testid="members-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Users className="text-rose-500" />
            {lang === "fr" ? "Gestion des Membres" : "Members Management"}
          </h1>
          <p className="text-white/50 text-sm mt-1">
            {lang === "fr" ? "Abonnements et échéances" : "Subscriptions and expirations"}
          </p>
        </div>
        <Button onClick={openAddModal} className="bg-rose-600 hover:bg-rose-700" data-testid="add-member-btn">
          <Plus size={16} className="mr-2" />
          {lang === "fr" ? "Ajouter un membre" : "Add member"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-[#1C1C1E] rounded-lg p-4 border border-white/10">
          <p className="text-white/50 text-xs uppercase">Total</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div 
          className={`bg-[#1C1C1E] rounded-lg p-4 border cursor-pointer transition-colors ${showExpiring ? 'border-orange-500' : 'border-white/10 hover:border-orange-500/50'}`}
          onClick={() => setShowExpiring(!showExpiring)}
          data-testid="expiring-filter"
        >
          <p className="text-orange-400 text-xs uppercase flex items-center gap-1">
            <AlertTriangle size={12} />
            Expirant (30j)
          </p>
          <p className="text-2xl font-bold text-orange-400">{stats.expiring}</p>
        </div>
        {MEMBER_TYPES.map((type) => (
          <div key={type} className="bg-[#1C1C1E] rounded-lg p-4 border border-white/10">
            <p className="text-white/50 text-xs uppercase truncate">{type.replace("Membres ", "")}</p>
            <p className="text-2xl font-bold text-white">{stats.byType[type]}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === "fr" ? "Rechercher..." : "Search..."}
            className="pl-10 bg-[#1C1C1E] border-white/10 text-white"
            data-testid="member-search"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[220px] bg-[#1C1C1E] border-white/10 text-white" data-testid="type-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#1C1C1E] border-white/10">
            <SelectItem value="all" className="text-white">Tous les types</SelectItem>
            {MEMBER_TYPES.map((type) => (
              <SelectItem key={type} value={type} className="text-white">{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-[#1C1C1E] rounded-lg border border-white/10 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="text-white/50">Membre</TableHead>
              <TableHead className="text-white/50">Type</TableHead>
              <TableHead className="text-white/50">Abonnement</TableHead>
              <TableHead className="text-white/50">Date signature</TableHead>
              <TableHead className="text-white/50">Expiration</TableHead>
              <TableHead className="text-white/50">Statut</TableHead>
              <TableHead className="text-white/50 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-white/50 py-8">
                  Chargement...
                </TableCell>
              </TableRow>
            ) : filteredMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-white/50 py-8">
                  Aucun membre trouvé
                </TableCell>
              </TableRow>
            ) : (
              filteredMembers.map((member) => (
                <>
                  <TableRow
                    key={member.id}
                    className="border-white/10 hover:bg-white/5 cursor-pointer"
                    onClick={() => setExpandedMember(expandedMember === member.id ? null : member.id)}
                    data-testid={`member-row-${member.id}`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {expandedMember === member.id ? <ChevronUp size={14} className="text-white/30" /> : <ChevronDown size={14} className="text-white/30" />}
                        <div>
                          <p className="text-white font-medium">{member.name}</p>
                          <p className="text-white/40 text-xs">{member.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-white/20 text-white/70">
                        {member.member_type?.replace("Membres ", "")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-white/70">{member.membership}</TableCell>
                    <TableCell className="text-white/70">
                      {member.contract_signed_date
                        ? format(parseISO(member.contract_signed_date), "dd MMM yyyy", { locale: fr })
                        : "-"}
                    </TableCell>
                    <TableCell className="text-white/70">
                      {member.subscription_end_date
                        ? format(parseISO(member.subscription_end_date), "dd MMM yyyy", { locale: fr })
                        : "-"}
                    </TableCell>
                    <TableCell>{getStatusBadge(member)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                          onClick={() => openRenewModal(member)}
                          data-testid={`renew-${member.id}`}
                        >
                          <RefreshCw size={14} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                          onClick={() => openEditModal(member)}
                          data-testid={`edit-${member.id}`}
                        >
                          <Edit size={14} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          onClick={() => deleteMutation.mutate(member.id)}
                          data-testid={`delete-${member.id}`}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedMember === member.id && (
                    <TableRow className="bg-[#121214]">
                      <TableCell colSpan={7}>
                        <div className="py-4 px-6 space-y-4">
                          <div className="grid grid-cols-3 gap-6">
                            <div>
                              <p className="text-white/40 text-xs uppercase mb-1">Contact</p>
                              <p className="text-white flex items-center gap-2">
                                <Mail size={14} className="text-white/40" />
                                {member.email || "-"}
                              </p>
                              <p className="text-white flex items-center gap-2 mt-1">
                                <Phone size={14} className="text-white/40" />
                                {member.phone || "-"}
                              </p>
                            </div>
                            <div>
                              <p className="text-white/40 text-xs uppercase mb-1">Cash collecté</p>
                              <p className="text-2xl font-bold text-emerald-400">
                                {member.cash_collected?.toLocaleString("fr-CH")} CHF
                              </p>
                            </div>
                            <div>
                              <p className="text-white/40 text-xs uppercase mb-1">Notes</p>
                              <p className="text-white/70 text-sm">{member.notes || "Aucune note"}</p>
                            </div>
                          </div>
                          {renewals.length > 0 && (
                            <div>
                              <p className="text-white/40 text-xs uppercase mb-2">Historique des renouvellements</p>
                              <div className="space-y-2">
                                {renewals.map((r) => (
                                  <div key={r.id} className="flex items-center gap-4 text-sm">
                                    <CheckCircle2 size={14} className="text-emerald-400" />
                                    <span className="text-white/70">{r.renewal_duration}</span>
                                    <span className="text-white/40">→</span>
                                    <span className="text-white">{r.new_end_date}</span>
                                    <span className="text-white/30 text-xs">
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
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-[#1C1C1E] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedMember ? "Modifier le membre" : "Ajouter un membre"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-white/50 text-xs uppercase">Nom *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-[#121214] border-white/10 text-white mt-1"
                  data-testid="member-name-input"
                />
              </div>
              <div>
                <label className="text-white/50 text-xs uppercase">Email</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="bg-[#121214] border-white/10 text-white mt-1"
                  data-testid="member-email-input"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-white/50 text-xs uppercase">Téléphone</label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="bg-[#121214] border-white/10 text-white mt-1"
                />
              </div>
              <div>
                <label className="text-white/50 text-xs uppercase">Type de membre</label>
                <Select value={formData.member_type} onValueChange={(v) => setFormData({ ...formData, member_type: v })}>
                  <SelectTrigger className="bg-[#121214] border-white/10 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1C1C1E] border-white/10">
                    {MEMBER_TYPES.map((type) => (
                      <SelectItem key={type} value={type} className="text-white">{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-white/50 text-xs uppercase">Abonnement</label>
                <Select value={formData.membership} onValueChange={(v) => setFormData({ ...formData, membership: v })}>
                  <SelectTrigger className="bg-[#121214] border-white/10 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1C1C1E] border-white/10">
                    {MEMBERSHIP_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt} className="text-white">{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-white/50 text-xs uppercase">Cash collecté (CHF)</label>
                <Input
                  type="number"
                  value={formData.cash_collected}
                  onChange={(e) => setFormData({ ...formData, cash_collected: parseFloat(e.target.value) || 0 })}
                  className="bg-[#121214] border-white/10 text-white mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-white/50 text-xs uppercase flex items-center gap-1">
                  <Calendar size={12} /> Date de signature
                </label>
                <Input
                  type="date"
                  value={formData.contract_signed_date}
                  onChange={(e) => setFormData({ ...formData, contract_signed_date: e.target.value })}
                  className="bg-[#121214] border-white/10 text-white mt-1"
                  data-testid="contract-date-input"
                />
              </div>
              <div>
                <label className="text-white/50 text-xs uppercase flex items-center gap-1">
                  <Clock size={12} /> Date d'expiration
                </label>
                <Input
                  type="date"
                  value={formData.subscription_end_date}
                  onChange={(e) => setFormData({ ...formData, subscription_end_date: e.target.value })}
                  className="bg-[#121214] border-white/10 text-white mt-1"
                  data-testid="expiration-date-input"
                />
              </div>
            </div>
            <div>
              <label className="text-white/50 text-xs uppercase">Notes</label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="bg-[#121214] border-white/10 text-white mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button
              onClick={() => saveMutation.mutate(formData)}
              disabled={!formData.name || saveMutation.isPending}
              className="bg-rose-600 hover:bg-rose-700"
              data-testid="save-member-btn"
            >
              {saveMutation.isPending ? "..." : selectedMember ? "Mettre à jour" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Renew Modal */}
      <Dialog open={renewModalOpen} onOpenChange={setRenewModalOpen}>
        <DialogContent className="bg-[#1C1C1E] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="text-emerald-400" size={20} />
              Renouveler l'abonnement
            </DialogTitle>
          </DialogHeader>
          {selectedMember && (
            <div className="space-y-4 py-4">
              <div className="bg-[#121214] rounded-lg p-4">
                <p className="text-white font-medium">{selectedMember.name}</p>
                <p className="text-white/50 text-sm">
                  Expire le: {selectedMember.subscription_end_date
                    ? format(parseISO(selectedMember.subscription_end_date), "dd MMMM yyyy", { locale: fr })
                    : "Non défini"}
                </p>
              </div>
              <div>
                <label className="text-white/50 text-xs uppercase">Durée du renouvellement</label>
                <Select value={renewData.renewal_duration} onValueChange={(v) => setRenewData({ ...renewData, renewal_duration: v })}>
                  <SelectTrigger className="bg-[#121214] border-white/10 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1C1C1E] border-white/10">
                    <SelectItem value="1 mois" className="text-white">1 mois</SelectItem>
                    <SelectItem value="3 mois" className="text-white">3 mois</SelectItem>
                    <SelectItem value="6 mois" className="text-white">6 mois</SelectItem>
                    <SelectItem value="6 semaines" className="text-white">6 semaines</SelectItem>
                    <SelectItem value="12 mois" className="text-white">12 mois</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-white/50 text-xs uppercase">Nouvelle date d'expiration</label>
                <Input
                  type="date"
                  value={renewData.new_end_date}
                  onChange={(e) => setRenewData({ ...renewData, new_end_date: e.target.value })}
                  className="bg-[#121214] border-white/10 text-white mt-1"
                  data-testid="new-end-date-input"
                />
              </div>
              <div>
                <label className="text-white/50 text-xs uppercase">Notes</label>
                <Input
                  value={renewData.notes}
                  onChange={(e) => setRenewData({ ...renewData, notes: e.target.value })}
                  className="bg-[#121214] border-white/10 text-white mt-1"
                  placeholder="Optionnel"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenewModalOpen(false)}>Annuler</Button>
            <Button
              onClick={() => renewMutation.mutate({ id: selectedMember?.id, data: renewData })}
              disabled={!renewData.new_end_date || renewMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
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
