import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { format, parseISO, addDays, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ClipboardCheck,
  Calendar,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Clock,
  User,
  Mail,
  Phone,
  Plus,
  Search,
  Filter,
  Bell,
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { Progress } from "../components/ui/progress";
import { toast } from "sonner";
import { useTranslations } from "../hooks/useTranslations";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ONBOARDING_STEPS = [
  { key: "onboarding_bsport", label: "Inscription bsport", icon: "📱" },
  { key: "onboarding_hubfit", label: "Inscription Hubfit", icon: "💪" },
  { key: "onboarding_nutrition", label: "Consultation nutrition", icon: "🥗" },
  { key: "questionnaire_coaching", label: "Questionnaire coaching", icon: "📋" },
  { key: "session_introduction", label: "Session d'introduction", icon: "🎯" },
];

const FOLLOWUP_TYPES = [
  { value: "monthly", label: "Suivi mensuel" },
  { value: "onboarding", label: "Onboarding" },
  { value: "renewal", label: "Renouvellement" },
  { value: "payment", label: "Paiement" },
];

const STATUS_CONFIG = {
  scheduled: { label: "Planifié", color: "bg-blue-500/20 text-[var(--color-accent)]" },
  completed: { label: "Complété", color: "bg-emerald-500/20 text-[var(--color-success)]" },
  missed: { label: "Manqué", color: "bg-red-500/20 text-[var(--color-danger)]" },
  rescheduled: { label: "Reporté", color: "bg-orange-500/20 text-[var(--color-warning)]" },
};

export default function OnboardingPage() {
  const { lang } = useTranslations();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("onboarding");
  const [search, setSearch] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [followupModalOpen, setFollowupModalOpen] = useState(false);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [selectedFollowup, setSelectedFollowup] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  // Track which member is being edited to prevent reordering
  const [editingMemberId, setEditingMemberId] = useState(null);
  
  const [followupForm, setFollowupForm] = useState({
    member_id: "",
    followup_date: format(addDays(new Date(), 7), "yyyy-MM-dd"),
    followup_type: "monthly",
    notes: "",
  });

  // Fetch data - Get ALL members for onboarding view
  const { data: pendingOnboarding = [], isLoading: loadingOnboarding } = useQuery({
    queryKey: ["onboarding", "pending"],
    queryFn: () => axios.get(`${API}/onboarding/pending`).then((r) => r.data),
  });

  // Fetch ALL members to show completed onboarding too
  const { data: allMembers = [] } = useQuery({
    queryKey: ["members", "all"],
    queryFn: () => axios.get(`${API}/members`).then((r) => r.data),
  });

  // Combine pending + completed members for onboarding view
  const allMembersWithOnboarding = useMemo(() => {
    const completedMembers = allMembers.filter(m => 
      m.onboarding_completed === true && !pendingOnboarding.find(p => p.id === m.id)
    ).map(m => ({
      ...m,
      onboarding_progress: 5,
      onboarding_total: 5,
      onboarding_percentage: 100
    }));
    
    return [...pendingOnboarding, ...completedMembers];
  }, [allMembers, pendingOnboarding]);

  const { data: upcomingFollowups = [] } = useQuery({
    queryKey: ["followups", "upcoming"],
    queryFn: () => axios.get(`${API}/followups/upcoming?days=14`).then((r) => r.data),
  });

  const { data: missedFollowups = [] } = useQuery({
    queryKey: ["followups", "missed"],
    queryFn: () => axios.get(`${API}/followups/missed`).then((r) => r.data),
  });

  const { data: allFollowups = [] } = useQuery({
    queryKey: ["followups"],
    queryFn: () => axios.get(`${API}/followups`).then((r) => r.data),
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: () => axios.get(`${API}/members`).then((r) => r.data),
  });

  const { data: alerts } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => axios.get(`${API}/alerts/summary`).then((r) => r.data),
  });

  // Mutations
  const updateOnboardingMutation = useMutation({
    mutationFn: ({ memberId, data }) => axios.put(`${API}/members/${memberId}/onboarding`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["onboarding"]);
      queryClient.invalidateQueries(["members"]);
      toast.success("Onboarding mis à jour");
    },
  });

  const createFollowupMutation = useMutation({
    mutationFn: (data) => axios.post(`${API}/followups`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["followups"]);
      setFollowupModalOpen(false);
      toast.success("Suivi planifié");
    },
  });

  const completeFollowupMutation = useMutation({
    mutationFn: ({ id, data }) => axios.post(`${API}/followups/${id}/complete`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["followups"]);
      setCompleteModalOpen(false);
      toast.success("Suivi complété");
    },
  });

  const deleteFollowupMutation = useMutation({
    mutationFn: (id) => axios.delete(`${API}/followups/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(["followups"]);
      toast.success("Suivi supprimé");
    },
  });

  // Filter onboarding - preserve order during editing
  const filteredOnboarding = useMemo(() => {
    let result = showCompleted ? allMembersWithOnboarding : pendingOnboarding;
    
    if (search) {
      const s = search.toLowerCase();
      result = result.filter((m) =>
        m.name?.toLowerCase().includes(s) ||
        m.email?.toLowerCase().includes(s)
      );
    }
    
    // Sort by name to keep stable order, but if editing, put the edited member first
    const sorted = [...result].sort((a, b) => {
      // Keep currently editing member at same position
      if (editingMemberId) {
        if (a.id === editingMemberId) return -1;
        if (b.id === editingMemberId) return 1;
      }
      // Then sort by progress (incomplete first), then by name
      const aProgress = a.onboarding_percentage || 0;
      const bProgress = b.onboarding_percentage || 0;
      if (aProgress !== bProgress) return aProgress - bProgress;
      return (a.name || "").localeCompare(b.name || "");
    });
    
    return sorted;
  }, [pendingOnboarding, allMembersWithOnboarding, showCompleted, search, editingMemberId]);

  // Stats
  const completedOnboarding = allMembers.filter(m => m.onboarding_completed === true).length;
  const stats = useMemo(() => ({
    pendingOnboarding: pendingOnboarding.length,
    completedOnboarding: completedOnboarding,
    upcomingFollowups: upcomingFollowups.length,
    missedFollowups: missedFollowups.length,
    completedThisMonth: allFollowups.filter((f) => 
      f.status === "completed" && 
      f.completed_date?.startsWith(format(new Date(), "yyyy-MM"))
    ).length,
  }), [pendingOnboarding, completedOnboarding, upcomingFollowups, missedFollowups, allFollowups]);

  const toggleOnboardingStep = (memberId, stepKey, currentValue) => {
    // Set editing member to prevent reordering
    setEditingMemberId(memberId);
    
    updateOnboardingMutation.mutate({
      memberId,
      data: { [stepKey]: !currentValue }
    }, {
      onSettled: () => {
        // Clear editing state after a delay to allow animation
        setTimeout(() => setEditingMemberId(null), 1500);
      }
    });
  };

  const openCompleteModal = (followup) => {
    setSelectedFollowup(followup);
    setCompleteModalOpen(true);
  };

  const getMemberName = (memberId) => {
    const member = members.find((m) => m.id === memberId);
    return member?.name || "Inconnu";
  };

  return (
    <div className="space-y-6" data-testid="onboarding-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="tf-page-header">
            {lang === "fr" ? "Onboarding & Suivi" : "Onboarding & Follow-up"}
          </h1>
          <p className="tf-page-subtitle">
            {lang === "fr" ? "Intégration des membres et suivis mensuels" : "Member integration and monthly follow-ups"}
          </p>
        </div>
        <Button onClick={() => setFollowupModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700" data-testid="add-followup-btn">
          <Plus size={16} className="mr-2" />
          Planifier un suivi
        </Button>
      </div>

      {/* Alerts Banner */}
      {alerts && (alerts.late_payments > 0 || alerts.missed_followups > 0) && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-[var(--radius-lg)] p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-[var(--color-danger)]" size={24} />
            <div>
              <p className="text-[var(--color-danger)] font-medium">Actions requises</p>
              <p className="text-white/70 text-sm">
                {alerts.late_payments > 0 && `${alerts.late_payments} paiements en retard`}
                {alerts.late_payments > 0 && alerts.missed_followups > 0 && " • "}
                {alerts.missed_followups > 0 && `${alerts.missed_followups} suivis manqués`}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {alerts.late_payments > 0 && (
              <Badge className="bg-red-500/20 text-[var(--color-danger)] border-0">
                <Bell size={12} className="mr-1" /> {alerts.late_payments} paiements
              </Badge>
            )}
            {alerts.missed_followups > 0 && (
              <Badge className="bg-orange-500/20 text-[var(--color-warning)] border-0">
                <Calendar size={12} className="mr-1" /> {alerts.missed_followups} suivis
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-4 border border-indigo-500/30 cursor-pointer" onClick={() => setActiveTab("onboarding")}>
          <p className="text-indigo-400 text-xs uppercase flex items-center gap-1">
            <ClipboardCheck size={12} /> Onboarding en cours
          </p>
          <p className="text-2xl font-mono font-bold text-indigo-400">{stats.pendingOnboarding}</p>
        </div>
        <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-4 border border-blue-500/30 cursor-pointer" onClick={() => setActiveTab("upcoming")}>
          <p className="text-[var(--color-accent)] text-xs uppercase flex items-center gap-1">
            <Calendar size={12} /> Suivis à venir
          </p>
          <p className="text-2xl font-mono font-bold text-[var(--color-accent)]">{stats.upcomingFollowups}</p>
        </div>
        <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-4 border border-red-500/30 cursor-pointer" onClick={() => setActiveTab("missed")}>
          <p className="text-[var(--color-danger)] text-xs uppercase flex items-center gap-1">
            <AlertTriangle size={12} /> Suivis manqués
          </p>
          <p className="text-2xl font-mono font-bold text-[var(--color-danger)]">{stats.missedFollowups}</p>
        </div>
        <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-4 border border-emerald-500/30">
          <p className="text-[var(--color-success)] text-xs uppercase flex items-center gap-1">
            <CheckCircle2 size={12} /> Complétés ce mois
          </p>
          <p className="text-2xl font-mono font-bold text-[var(--color-success)]">{stats.completedThisMonth}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
          <TabsTrigger value="onboarding" className="data-[state=active]:bg-indigo-600">Onboarding ({stats.pendingOnboarding})</TabsTrigger>
          <TabsTrigger value="upcoming" className="data-[state=active]:bg-blue-600">À venir ({stats.upcomingFollowups})</TabsTrigger>
          <TabsTrigger value="missed" className="data-[state=active]:bg-red-600">Manqués ({stats.missedFollowups})</TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-white/20">Historique</TabsTrigger>
        </TabsList>

        {/* Onboarding Tab */}
        <TabsContent value="onboarding" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" size={16} />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un membre..."
                className="pl-10 bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white"
              />
            </div>
            <div className="flex items-center gap-3 bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] px-4 py-2 border border-[var(--color-border)]">
              <label className="text-white/70 text-sm">Afficher les complétés</label>
              <Switch
                checked={showCompleted}
                onCheckedChange={setShowCompleted}
                data-testid="show-completed-toggle"
              />
              {showCompleted && (
                <Badge className="bg-emerald-500/20 text-[var(--color-success)] border-0">
                  +{stats.completedOnboarding}
                </Badge>
              )}
            </div>
          </div>

          <div className="grid gap-4">
            {loadingOnboarding ? (
              <div className="text-center text-[var(--color-text-secondary)] py-8">Chargement...</div>
            ) : filteredOnboarding.length === 0 ? (
              <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-8 border border-emerald-500/30 text-center">
                <CheckCircle2 size={48} className="mx-auto text-[var(--color-success)] mb-4" />
                <p className="text-[var(--color-success)] font-medium">
                  {showCompleted ? "Aucun membre trouvé" : "Tous les onboardings sont complétés !"}
                </p>
                {!showCompleted && stats.completedOnboarding > 0 && (
                  <Button 
                    variant="link" 
                    className="text-indigo-400 mt-2"
                    onClick={() => setShowCompleted(true)}
                  >
                    Voir les {stats.completedOnboarding} membres complétés
                  </Button>
                )}
              </div>
            ) : (
              filteredOnboarding.map((member) => {
                const isCompleted = member.onboarding_percentage === 100;
                const isEditing = editingMemberId === member.id;
                
                return (
                  <div
                    key={member.id}
                    className={`bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-6 border transition-all duration-300 ${
                      isCompleted 
                        ? "border-emerald-500/30 bg-emerald-500/5" 
                        : isEditing 
                          ? "border-indigo-500/50 ring-2 ring-indigo-500/20" 
                          : "border-[var(--color-border)]"
                    }`}
                    data-testid={`onboarding-${member.id}`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          isCompleted ? "bg-emerald-500/20" : "bg-indigo-500/20"
                        }`}>
                          {isCompleted ? (
                            <CheckCircle2 className="text-[var(--color-success)]" size={24} />
                          ) : (
                            <User className="text-indigo-400" size={24} />
                          )}
                        </div>
                        <div>
                          <p className="text-white font-medium text-lg flex items-center gap-2">
                            {member.name}
                            {isCompleted && (
                              <Badge className="bg-emerald-500/20 text-[var(--color-success)] border-0 text-xs">
                                Complété
                              </Badge>
                            )}
                          </p>
                          <div className="flex items-center gap-4 text-[var(--color-text-secondary)] text-sm">
                            {member.email && (
                              <span className="flex items-center gap-1">
                                <Mail size={12} /> {member.email}
                              </span>
                            )}
                            {member.phone && (
                              <span className="flex items-center gap-1">
                                <Phone size={12} /> {member.phone}
                              </span>
                            )}
                          </div>
                          <p className="text-[var(--color-text-secondary)] text-xs mt-1">
                            Inscrit le {member.contract_signed_date ? format(parseISO(member.contract_signed_date), "dd MMM yyyy", { locale: fr }) : "-"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[var(--color-text-secondary)] text-xs uppercase mb-1">Progression</p>
                        <div className="flex items-center gap-2">
                          <Progress value={member.onboarding_percentage} className="w-24 h-2 bg-white/10" />
                          <span className={`font-bold ${isCompleted ? 'text-[var(--color-success)]' : 'text-indigo-400'}`}>
                            {member.onboarding_percentage}%
                          </span>
                        </div>
                        <p className="text-[var(--color-text-tertiary)] text-xs">{member.onboarding_progress}/5 étapes</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-5 gap-3">
                      {ONBOARDING_STEPS.map((step) => {
                        const isStepCompleted = member[step.key];
                        return (
                          <div
                            key={step.key}
                            onClick={() => !isCompleted && toggleOnboardingStep(member.id, step.key, isStepCompleted)}
                            className={`p-3 rounded-[var(--radius-lg)] border transition-all ${
                              isStepCompleted
                                ? "bg-emerald-500/10 border-emerald-500/30"
                                : isCompleted 
                                  ? "bg-white/5 border-[var(--color-border)] opacity-50"
                                  : "bg-white/5 border-[var(--color-border)] hover:border-indigo-500/50 cursor-pointer"
                            }`}
                            data-testid={`step-${step.key}-${member.id}`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xl">{step.icon}</span>
                              {isStepCompleted ? (
                                <CheckCircle2 size={16} className="text-[var(--color-success)]" />
                              ) : (
                                <Circle size={16} className="text-[var(--color-text-tertiary)]" />
                              )}
                            </div>
                            <p className={`text-xs ${isStepCompleted ? "text-[var(--color-success)]" : "text-white/70"}`}>
                              {step.label}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* Upcoming Follow-ups Tab */}
        <TabsContent value="upcoming" className="space-y-4">
          <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] border border-blue-500/30 overflow-hidden">
            <div className="p-4 border-b border-[var(--color-border)] bg-blue-500/10">
              <h3 className="text-[var(--color-accent)] font-medium flex items-center gap-2">
                <Calendar size={18} />
                Suivis à venir (14 jours)
              </h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--color-border)]">
                  <TableHead className="text-[var(--color-text-secondary)]">Membre</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)]">Contact</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)]">Date prévue</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)]">Dans</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)]">Type</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingFollowups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-[var(--color-text-secondary)] py-8">
                      Aucun suivi planifié
                    </TableCell>
                  </TableRow>
                ) : (
                  upcomingFollowups.map((followup) => {
                    const daysUntil = differenceInDays(parseISO(followup.followup_date), new Date());
                    return (
                      <TableRow key={followup.id} className="border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]">
                        <TableCell className="text-white font-medium">{followup.member_name}</TableCell>
                        <TableCell>
                          <div className="text-white/70 text-sm">
                            <p>{followup.member_email}</p>
                            <p>{followup.member_phone}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-white/70">
                          {format(parseISO(followup.followup_date), "dd MMM yyyy", { locale: fr })}
                        </TableCell>
                        <TableCell>
                          <Badge className={daysUntil <= 3 ? "bg-orange-500/20 text-[var(--color-warning)]" : "bg-blue-500/20 text-[var(--color-accent)]"}>
                            {daysUntil === 0 ? "Aujourd'hui" : daysUntil === 1 ? "Demain" : `${daysUntil} jours`}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-[var(--color-border-strong)] text-white/70">
                            {FOLLOWUP_TYPES.find((t) => t.value === followup.followup_type)?.label || followup.followup_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => openCompleteModal(followup)}
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            <CheckCircle2 size={14} className="mr-1" /> Compléter
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Missed Follow-ups Tab */}
        <TabsContent value="missed" className="space-y-4">
          <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] border border-red-500/30 overflow-hidden">
            <div className="p-4 border-b border-[var(--color-border)] bg-red-500/10">
              <h3 className="text-[var(--color-danger)] font-medium flex items-center gap-2">
                <AlertTriangle size={18} />
                Suivis manqués - Action requise
              </h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--color-border)]">
                  <TableHead className="text-[var(--color-text-secondary)]">Membre</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)]">Contact</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)]">Date prévue</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)]">Retard</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)]">Type</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {missedFollowups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-[var(--color-success)] py-8">
                      <CheckCircle2 size={24} className="mx-auto mb-2" />
                      Aucun suivi manqué
                    </TableCell>
                  </TableRow>
                ) : (
                  missedFollowups.map((followup) => {
                    const daysLate = differenceInDays(new Date(), parseISO(followup.followup_date));
                    return (
                      <TableRow key={followup.id} className="border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]">
                        <TableCell className="text-white font-medium">{followup.member_name}</TableCell>
                        <TableCell>
                          <div className="text-white/70 text-sm">
                            <p>{followup.member_email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-white/70">
                          {format(parseISO(followup.followup_date), "dd MMM yyyy", { locale: fr })}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-red-500/20 text-[var(--color-danger)] border-0">
                            {daysLate} jours
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-[var(--color-border-strong)] text-white/70">
                            {FOLLOWUP_TYPES.find((t) => t.value === followup.followup_type)?.label || followup.followup_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => openCompleteModal(followup)}
                              className="bg-emerald-600 hover:bg-emerald-700"
                            >
                              Compléter
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-[var(--color-border-strong)] text-white"
                              onClick={() => {
                                setFollowupForm({
                                  member_id: followup.member_id,
                                  followup_date: format(addDays(new Date(), 7), "yyyy-MM-dd"),
                                  followup_type: followup.followup_type,
                                  notes: `Reporté du ${format(parseISO(followup.followup_date), "dd/MM/yyyy")}`,
                                });
                                setFollowupModalOpen(true);
                              }}
                            >
                              Reporter
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] border border-[var(--color-border)] overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--color-border)]">
                  <TableHead className="text-[var(--color-text-secondary)]">Membre</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)]">Date</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)]">Type</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)]">Statut</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)]">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allFollowups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-[var(--color-text-secondary)] py-8">
                      Aucun historique
                    </TableCell>
                  </TableRow>
                ) : (
                  allFollowups.slice(0, 50).map((followup) => (
                    <TableRow key={followup.id} className="border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]">
                      <TableCell className="text-white font-medium">{getMemberName(followup.member_id)}</TableCell>
                      <TableCell className="text-white/70">
                        {format(parseISO(followup.followup_date), "dd MMM yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-[var(--color-border-strong)] text-white/70">
                          {FOLLOWUP_TYPES.find((t) => t.value === followup.followup_type)?.label || followup.followup_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${STATUS_CONFIG[followup.status]?.color} border-0`}>
                          {STATUS_CONFIG[followup.status]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[var(--color-text-secondary)] text-sm max-w-[200px] truncate">
                        {followup.notes || "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Follow-up Modal */}
      <Dialog open={followupModalOpen} onOpenChange={setFollowupModalOpen}>
        <DialogContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white">
          <DialogHeader>
            <DialogTitle>Planifier un suivi</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-[var(--color-text-secondary)] tf-label inline">Membre *</label>
              <Select value={followupForm.member_id} onValueChange={(v) => setFollowupForm({ ...followupForm, member_id: v })}>
                <SelectTrigger className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1" data-testid="followup-member-select">
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-white">{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[var(--color-text-secondary)] tf-label inline">Date du suivi</label>
                <Input
                  type="date"
                  value={followupForm.followup_date}
                  onChange={(e) => setFollowupForm({ ...followupForm, followup_date: e.target.value })}
                  className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
                />
              </div>
              <div>
                <label className="text-[var(--color-text-secondary)] tf-label inline">Type de suivi</label>
                <Select value={followupForm.followup_type} onValueChange={(v) => setFollowupForm({ ...followupForm, followup_type: v })}>
                  <SelectTrigger className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
                    {FOLLOWUP_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value} className="text-white">{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-[var(--color-text-secondary)] tf-label inline">Notes (optionnel)</label>
              <Input
                value={followupForm.notes}
                onChange={(e) => setFollowupForm({ ...followupForm, notes: e.target.value })}
                placeholder="Notes pour ce suivi..."
                className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFollowupModalOpen(false)}>Annuler</Button>
            <Button
              onClick={() => createFollowupMutation.mutate(followupForm)}
              disabled={!followupForm.member_id || createFollowupMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {createFollowupMutation.isPending ? "..." : "Planifier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Follow-up Modal */}
      <Dialog open={completeModalOpen} onOpenChange={setCompleteModalOpen}>
        <DialogContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="text-[var(--color-success)]" />
              Compléter le suivi
            </DialogTitle>
          </DialogHeader>
          {selectedFollowup && (
            <div className="space-y-4 py-4">
              <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-4">
                <p className="text-white font-medium">{getMemberName(selectedFollowup.member_id)}</p>
                <p className="text-[var(--color-text-secondary)] text-sm">
                  Prévu le {format(parseISO(selectedFollowup.followup_date), "dd MMMM yyyy", { locale: fr })}
                </p>
              </div>
              <div>
                <label className="text-[var(--color-text-secondary)] tf-label inline">Notes du suivi</label>
                <Input
                  placeholder="Résumé de l'entretien..."
                  className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
                  id="complete-notes-input"
                />
              </div>
              <div>
                <label className="text-[var(--color-text-secondary)] tf-label inline">Prochain suivi (optionnel)</label>
                <Input
                  type="date"
                  className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
                  id="next-followup-input"
                  defaultValue={format(addDays(new Date(), 30), "yyyy-MM-dd")}
                />
                <p className="text-[var(--color-text-secondary)] text-xs mt-1">Laissez vide pour ne pas planifier de prochain suivi</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCompleteModalOpen(false)}>Annuler</Button>
            <Button
              onClick={() => {
                const notes = document.getElementById("complete-notes-input")?.value;
                const nextDate = document.getElementById("next-followup-input")?.value;
                completeFollowupMutation.mutate({
                  id: selectedFollowup?.id,
                  data: {
                    notes,
                    next_followup_date: nextDate || undefined
                  }
                });
              }}
              disabled={completeFollowupMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {completeFollowupMutation.isPending ? "..." : "Compléter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
