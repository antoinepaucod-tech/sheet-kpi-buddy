import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  Settings,
  CreditCard,
  Users,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  GripVertical,
  Download,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { toast } from "sonner";
import { useTranslations } from "../hooks/useTranslations";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const COLOR_OPTIONS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", 
  "#ec4899", "#06b6d4", "#f97316", "#84cc16", "#6366f1"
];

export default function SettingsTypesPage() {
  const { lang } = useTranslations();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("memberships");
  
  // Membership type modal
  const [membershipModalOpen, setMembershipModalOpen] = useState(false);
  const [editingMembership, setEditingMembership] = useState(null);
  const [membershipForm, setMembershipForm] = useState({
    name: "",
    duration_months: 1,
    duration_days: null,
    price: 0,
    description: "",
    is_recurring: true,
    default_billing_cycle_type: "monthly_day",
    default_billing_cycle_value: 1,
    is_active: true,
    display_order: 0,
    color: "#3b82f6",
  });
  
  // Member type modal
  const [memberTypeModalOpen, setMemberTypeModalOpen] = useState(false);
  const [editingMemberType, setEditingMemberType] = useState(null);
  const [memberTypeForm, setMemberTypeForm] = useState({
    name: "",
    code: "",
    description: "",
    is_active: true,
    display_order: 0,
    color: "#3b82f6",
  });

  // Fetch membership types
  const { data: membershipTypes = [], isLoading: loadingMemberships } = useQuery({
    queryKey: ["membership-types"],
    queryFn: () => axios.get(`${API}/settings/membership-types`).then(r => r.data),
  });

  // Fetch member types
  const { data: memberTypes = [], isLoading: loadingMemberTypes } = useQuery({
    queryKey: ["member-types"],
    queryFn: () => axios.get(`${API}/settings/member-types`).then(r => r.data),
  });

  // Mutations for membership types
  const createMembershipMutation = useMutation({
    mutationFn: (data) => axios.post(`${API}/settings/membership-types`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["membership-types"]);
      setMembershipModalOpen(false);
      resetMembershipForm();
      toast.success("Type d'abonnement créé");
    },
    onError: (err) => toast.error(err.response?.data?.detail || "Erreur"),
  });

  const updateMembershipMutation = useMutation({
    mutationFn: ({ id, data }) => axios.put(`${API}/settings/membership-types/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["membership-types"]);
      setMembershipModalOpen(false);
      resetMembershipForm();
      toast.success("Type d'abonnement mis à jour");
    },
    onError: (err) => toast.error(err.response?.data?.detail || "Erreur"),
  });

  const deleteMembershipMutation = useMutation({
    mutationFn: (id) => axios.delete(`${API}/settings/membership-types/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(["membership-types"]);
      toast.success("Type d'abonnement supprimé");
    },
  });

  // Mutations for member types
  const createMemberTypeMutation = useMutation({
    mutationFn: (data) => axios.post(`${API}/settings/member-types`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["member-types"]);
      setMemberTypeModalOpen(false);
      resetMemberTypeForm();
      toast.success("Type de membre créé");
    },
    onError: (err) => toast.error(err.response?.data?.detail || "Erreur"),
  });

  const updateMemberTypeMutation = useMutation({
    mutationFn: ({ id, data }) => axios.put(`${API}/settings/member-types/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["member-types"]);
      setMemberTypeModalOpen(false);
      resetMemberTypeForm();
      toast.success("Type de membre mis à jour");
    },
    onError: (err) => toast.error(err.response?.data?.detail || "Erreur"),
  });

  const deleteMemberTypeMutation = useMutation({
    mutationFn: (id) => axios.delete(`${API}/settings/member-types/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(["member-types"]);
      toast.success("Type de membre supprimé");
    },
  });

  // Seed defaults mutation
  const seedMutation = useMutation({
    mutationFn: () => axios.post(`${API}/settings/seed-defaults`),
    onSuccess: (res) => {
      queryClient.invalidateQueries(["membership-types"]);
      queryClient.invalidateQueries(["member-types"]);
      toast.success(`${res.data.membership_types_created} abonnements et ${res.data.member_types_created} types de membres créés`);
    },
  });

  const resetMembershipForm = () => {
    setEditingMembership(null);
    setMembershipForm({
      name: "",
      duration_months: 1,
      duration_days: null,
      price: 0,
      description: "",
      is_recurring: true,
      default_billing_cycle_type: "monthly_day",
      default_billing_cycle_value: 1,
      is_active: true,
      display_order: membershipTypes.length,
      color: "#3b82f6",
    });
  };

  const resetMemberTypeForm = () => {
    setEditingMemberType(null);
    setMemberTypeForm({
      name: "",
      code: "",
      description: "",
      is_active: true,
      display_order: memberTypes.length,
      color: "#3b82f6",
    });
  };

  const openEditMembership = (item) => {
    setEditingMembership(item);
    setMembershipForm({
      name: item.name,
      duration_months: item.duration_months,
      duration_days: item.duration_days,
      price: item.price,
      description: item.description || "",
      is_recurring: item.is_recurring,
      default_billing_cycle_type: item.default_billing_cycle_type || "monthly_day",
      default_billing_cycle_value: item.default_billing_cycle_value || 1,
      is_active: item.is_active,
      display_order: item.display_order,
      color: item.color || "#3b82f6",
    });
    setMembershipModalOpen(true);
  };

  const openEditMemberType = (item) => {
    setEditingMemberType(item);
    setMemberTypeForm({
      name: item.name,
      code: item.code,
      description: item.description || "",
      is_active: item.is_active,
      display_order: item.display_order,
      color: item.color || "#3b82f6",
    });
    setMemberTypeModalOpen(true);
  };

  const handleSaveMembership = () => {
    const payload = {
      ...membershipForm,
      duration_days: membershipForm.duration_days || null,
    };
    if (editingMembership) {
      updateMembershipMutation.mutate({ id: editingMembership.id, data: payload });
    } else {
      createMembershipMutation.mutate(payload);
    }
  };

  const handleSaveMemberType = () => {
    if (editingMemberType) {
      updateMemberTypeMutation.mutate({ id: editingMemberType.id, data: memberTypeForm });
    } else {
      createMemberTypeMutation.mutate(memberTypeForm);
    }
  };

  const formatDuration = (item) => {
    if (item.duration_days) {
      return `${item.duration_days} jours`;
    }
    if (item.duration_months === 1) return "1 mois";
    if (item.duration_months === 12) return "1 an";
    return `${item.duration_months} mois`;
  };

  return (
    <div className="space-y-6" data-testid="settings-types-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Settings className="text-blue-500" />
            {lang === "fr" ? "Configuration des Types" : "Types Configuration"}
          </h1>
          <p className="text-white/50 text-sm mt-1">
            {lang === "fr" 
              ? "Gérez les types d'abonnements et de membres"
              : "Manage membership and member types"}
          </p>
        </div>
        <Button
          onClick={() => seedMutation.mutate()}
          disabled={seedMutation.isPending}
          variant="outline"
          className="border-white/20 text-white hover:bg-white/10"
          data-testid="seed-defaults-btn"
        >
          <Download size={16} className="mr-2" />
          {seedMutation.isPending ? "..." : "Charger les types par défaut"}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-[#1C1C1E] border border-white/10">
          <TabsTrigger 
            value="memberships" 
            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            data-testid="tab-memberships"
          >
            <CreditCard size={16} className="mr-2" />
            Types d'abonnement
          </TabsTrigger>
          <TabsTrigger 
            value="members"
            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            data-testid="tab-member-types"
          >
            <Users size={16} className="mr-2" />
            Types de membre
          </TabsTrigger>
        </TabsList>

        {/* Membership Types Tab */}
        <TabsContent value="memberships" className="mt-4">
          <div className="bg-[#1C1C1E] rounded-lg border border-white/10">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-white font-medium">Types d'abonnement</h2>
              <Button 
                size="sm" 
                onClick={() => { resetMembershipForm(); setMembershipModalOpen(true); }}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="add-membership-type-btn"
              >
                <Plus size={16} className="mr-1" />
                Ajouter
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-white/50 w-8"></TableHead>
                  <TableHead className="text-white/50">Nom</TableHead>
                  <TableHead className="text-white/50">Durée</TableHead>
                  <TableHead className="text-white/50">Prix</TableHead>
                  <TableHead className="text-white/50">Cycle facturation</TableHead>
                  <TableHead className="text-white/50">Récurrent</TableHead>
                  <TableHead className="text-white/50">Statut</TableHead>
                  <TableHead className="text-white/50 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingMemberships ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-white/50 py-8">
                      Chargement...
                    </TableCell>
                  </TableRow>
                ) : membershipTypes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-white/50 py-8">
                      Aucun type d'abonnement. Cliquez sur "Charger les types par défaut" pour commencer.
                    </TableCell>
                  </TableRow>
                ) : (
                  membershipTypes.map((item) => (
                    <TableRow key={item.id} className="border-white/10 hover:bg-white/5" data-testid={`membership-row-${item.id}`}>
                      <TableCell>
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: item.color || "#3b82f6" }}
                        />
                      </TableCell>
                      <TableCell className="text-white font-medium">{item.name}</TableCell>
                      <TableCell className="text-white/70">{formatDuration(item)}</TableCell>
                      <TableCell className="text-white/70">{item.price} CHF</TableCell>
                      <TableCell className="text-white/50 text-sm">
                        {item.is_recurring ? (
                          item.default_billing_cycle_type === "monthly_day" 
                            ? `Jour ${item.default_billing_cycle_value || 1}` 
                            : `${item.default_billing_cycle_value || 28}j`
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        {item.is_recurring ? (
                          <Badge className="bg-blue-500/20 text-blue-400 border-0">Récurrent</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-white/10 text-white/60 border-0">One-time</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.is_active ? (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-0">Actif</Badge>
                        ) : (
                          <Badge variant="destructive">Inactif</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-white/50 hover:text-white hover:bg-white/10"
                            onClick={() => openEditMembership(item)}
                            data-testid={`edit-membership-${item.id}`}
                          >
                            <Pencil size={14} />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            onClick={() => {
                              if (window.confirm("Supprimer ce type d'abonnement ?")) {
                                deleteMembershipMutation.mutate(item.id);
                              }
                            }}
                            data-testid={`delete-membership-${item.id}`}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Member Types Tab */}
        <TabsContent value="members" className="mt-4">
          <div className="bg-[#1C1C1E] rounded-lg border border-white/10">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-white font-medium">Types de membre</h2>
              <Button 
                size="sm" 
                onClick={() => { resetMemberTypeForm(); setMemberTypeModalOpen(true); }}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="add-member-type-btn"
              >
                <Plus size={16} className="mr-1" />
                Ajouter
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-white/50 w-8"></TableHead>
                  <TableHead className="text-white/50">Nom</TableHead>
                  <TableHead className="text-white/50">Code</TableHead>
                  <TableHead className="text-white/50">Description</TableHead>
                  <TableHead className="text-white/50">Statut</TableHead>
                  <TableHead className="text-white/50 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingMemberTypes ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-white/50 py-8">
                      Chargement...
                    </TableCell>
                  </TableRow>
                ) : memberTypes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-white/50 py-8">
                      Aucun type de membre. Cliquez sur "Charger les types par défaut" pour commencer.
                    </TableCell>
                  </TableRow>
                ) : (
                  memberTypes.map((item) => (
                    <TableRow key={item.id} className="border-white/10 hover:bg-white/5" data-testid={`member-type-row-${item.id}`}>
                      <TableCell>
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: item.color || "#3b82f6" }}
                        />
                      </TableCell>
                      <TableCell className="text-white font-medium">{item.name}</TableCell>
                      <TableCell className="text-white/50 font-mono text-sm">{item.code}</TableCell>
                      <TableCell className="text-white/50 text-sm">{item.description || "-"}</TableCell>
                      <TableCell>
                        {item.is_active ? (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-0">Actif</Badge>
                        ) : (
                          <Badge variant="destructive">Inactif</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-white/50 hover:text-white hover:bg-white/10"
                            onClick={() => openEditMemberType(item)}
                            data-testid={`edit-member-type-${item.id}`}
                          >
                            <Pencil size={14} />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            onClick={() => {
                              if (window.confirm("Supprimer ce type de membre ?")) {
                                deleteMemberTypeMutation.mutate(item.id);
                              }
                            }}
                            data-testid={`delete-member-type-${item.id}`}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Membership Type Modal */}
      <Dialog open={membershipModalOpen} onOpenChange={setMembershipModalOpen}>
        <DialogContent className="bg-[#1C1C1E] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingMembership ? "Modifier le type d'abonnement" : "Nouveau type d'abonnement"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-white/50 text-xs uppercase">Nom *</label>
              <Input
                value={membershipForm.name}
                onChange={(e) => setMembershipForm({ ...membershipForm, name: e.target.value })}
                className="bg-[#121214] border-white/10 text-white mt-1"
                placeholder="Ex: Mensuel, Annuel, 6 Weeks Challenge"
                data-testid="membership-name-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-white/50 text-xs uppercase">Durée (mois)</label>
                <Input
                  type="number"
                  min={0}
                  value={membershipForm.duration_months}
                  onChange={(e) => setMembershipForm({ ...membershipForm, duration_months: parseInt(e.target.value) || 0 })}
                  className="bg-[#121214] border-white/10 text-white mt-1"
                  data-testid="membership-months-input"
                />
              </div>
              <div>
                <label className="text-white/50 text-xs uppercase">Ou durée (jours)</label>
                <Input
                  type="number"
                  min={0}
                  value={membershipForm.duration_days || ""}
                  onChange={(e) => setMembershipForm({ ...membershipForm, duration_days: parseInt(e.target.value) || null })}
                  className="bg-[#121214] border-white/10 text-white mt-1"
                  placeholder="Ex: 42 pour 6 semaines"
                  data-testid="membership-days-input"
                />
              </div>
            </div>
            <div>
              <label className="text-white/50 text-xs uppercase">Prix (CHF)</label>
              <Input
                type="number"
                min={0}
                value={membershipForm.price}
                onChange={(e) => setMembershipForm({ ...membershipForm, price: parseFloat(e.target.value) || 0 })}
                className="bg-[#121214] border-white/10 text-white mt-1"
                data-testid="membership-price-input"
              />
            </div>
            <div>
              <label className="text-white/50 text-xs uppercase">Description</label>
              <Input
                value={membershipForm.description}
                onChange={(e) => setMembershipForm({ ...membershipForm, description: e.target.value })}
                className="bg-[#121214] border-white/10 text-white mt-1"
                placeholder="Optionnel"
              />
            </div>
            <div>
              <label className="text-white/50 text-xs uppercase mb-2 block">Couleur</label>
              <div className="flex gap-2 flex-wrap">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setMembershipForm({ ...membershipForm, color })}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      membershipForm.color === color ? "border-white scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-white/70 text-sm">Abonnement récurrent</label>
              <Switch
                checked={membershipForm.is_recurring}
                onCheckedChange={(v) => setMembershipForm({ ...membershipForm, is_recurring: v })}
                data-testid="membership-recurring-switch"
              />
            </div>
            
            {/* Default billing cycle settings */}
            {membershipForm.is_recurring && (
              <div className="border border-white/10 rounded-lg p-4 space-y-3 bg-[#121214]">
                <label className="text-white/50 text-xs uppercase block">Cycle de facturation par défaut</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-white/40 text-xs">Type de cycle</label>
                    <Select 
                      value={membershipForm.default_billing_cycle_type} 
                      onValueChange={(v) => setMembershipForm({ ...membershipForm, default_billing_cycle_type: v })}
                    >
                      <SelectTrigger className="bg-[#1C1C1E] border-white/10 text-white mt-1 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1C1C1E] border-white/10">
                        <SelectItem value="monthly_day" className="text-white">Jour fixe du mois</SelectItem>
                        <SelectItem value="interval_days" className="text-white">Tous les X jours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-white/40 text-xs">
                      {membershipForm.default_billing_cycle_type === "monthly_day" ? "Jour (1-28)" : "Intervalle (jours)"}
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={membershipForm.default_billing_cycle_type === "monthly_day" ? 28 : 365}
                      value={membershipForm.default_billing_cycle_value}
                      onChange={(e) => setMembershipForm({ ...membershipForm, default_billing_cycle_value: parseInt(e.target.value) || 1 })}
                      className="bg-[#1C1C1E] border-white/10 text-white mt-1 h-9"
                      data-testid="membership-billing-value"
                    />
                  </div>
                </div>
                <p className="text-white/30 text-xs">
                  {membershipForm.default_billing_cycle_type === "monthly_day"
                    ? `Paiement le ${membershipForm.default_billing_cycle_value} de chaque mois`
                    : `Paiement tous les ${membershipForm.default_billing_cycle_value} jours`}
                </p>
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <label className="text-white/70 text-sm">Actif</label>
              <Switch
                checked={membershipForm.is_active}
                onCheckedChange={(v) => setMembershipForm({ ...membershipForm, is_active: v })}
                data-testid="membership-active-switch"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMembershipModalOpen(false)}>Annuler</Button>
            <Button
              onClick={handleSaveMembership}
              disabled={!membershipForm.name || createMembershipMutation.isPending || updateMembershipMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="save-membership-btn"
            >
              {createMembershipMutation.isPending || updateMembershipMutation.isPending ? "..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Member Type Modal */}
      <Dialog open={memberTypeModalOpen} onOpenChange={setMemberTypeModalOpen}>
        <DialogContent className="bg-[#1C1C1E] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingMemberType ? "Modifier le type de membre" : "Nouveau type de membre"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-white/50 text-xs uppercase">Nom *</label>
              <Input
                value={memberTypeForm.name}
                onChange={(e) => setMemberTypeForm({ ...memberTypeForm, name: e.target.value })}
                className="bg-[#121214] border-white/10 text-white mt-1"
                placeholder="Ex: Membres Généraux Récurrents"
                data-testid="member-type-name-input"
              />
            </div>
            <div>
              <label className="text-white/50 text-xs uppercase">Code *</label>
              <Input
                value={memberTypeForm.code}
                onChange={(e) => setMemberTypeForm({ ...memberTypeForm, code: e.target.value.toLowerCase().replace(/\s/g, "_") })}
                className="bg-[#121214] border-white/10 text-white mt-1 font-mono"
                placeholder="Ex: general, pif, pt"
                data-testid="member-type-code-input"
              />
            </div>
            <div>
              <label className="text-white/50 text-xs uppercase">Description</label>
              <Input
                value={memberTypeForm.description}
                onChange={(e) => setMemberTypeForm({ ...memberTypeForm, description: e.target.value })}
                className="bg-[#121214] border-white/10 text-white mt-1"
                placeholder="Optionnel"
              />
            </div>
            <div>
              <label className="text-white/50 text-xs uppercase mb-2 block">Couleur</label>
              <div className="flex gap-2 flex-wrap">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setMemberTypeForm({ ...memberTypeForm, color })}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      memberTypeForm.color === color ? "border-white scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-white/70 text-sm">Actif</label>
              <Switch
                checked={memberTypeForm.is_active}
                onCheckedChange={(v) => setMemberTypeForm({ ...memberTypeForm, is_active: v })}
                data-testid="member-type-active-switch"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMemberTypeModalOpen(false)}>Annuler</Button>
            <Button
              onClick={handleSaveMemberType}
              disabled={!memberTypeForm.name || !memberTypeForm.code || createMemberTypeMutation.isPending || updateMemberTypeMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="save-member-type-btn"
            >
              {createMemberTypeMutation.isPending || updateMemberTypeMutation.isPending ? "..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
