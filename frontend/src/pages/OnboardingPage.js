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
  SkipForward,
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
import { useMemberCategories, CATEGORY_LABELS, ONBOARDING_EXCLUDED_DEFAULT } from "../hooks/useMemberCategories";

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
  scheduled: { label: "Planifié", color: "bg-[rgba(10,132,255,0.15)] text-[var(--color-accent)]" },
  completed: { label: "Complété", color: "bg-[rgba(48,209,88,0.15)] text-[var(--color-success)]" },
  missed: { label: "Manqué", color: "bg-[rgba(255,69,58,0.15)] text-[var(--color-danger)]" },
  rescheduled: { label: "Reporté", color: "bg-[rgba(255,214,10,0.15)] text-[var(--color-warning)]" },
};

export default function OnboardingPage() {
  const { lang } = useTranslations();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("onboarding");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all"); // "all" = défaut sans exclus
  const { getCategory, getDuoPartnerId, getDuoPartnerName, isPrimaryInDuo } = useMemberCategories();
  const [showCompleted, setShowCompleted] = useState(false);
  const [followupModalOpen, setFollowupModalOpen] = useState(false);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [selectedFollowup, setSelectedFollowup] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [skipDialogOpen, setSkipDialogOpen] = useState(false);
  const [skipTarget, setSkipTarget] = useState(null);
  const [skipReason, setSkipReason] = useState("");
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

  // Completed onboarding members (for Historique tab) — exclude coaches/IFRC
  const COACH_KEYWORDS = ["THE COACH", "VIRTUAL COACH", "VIRTUAL", "IFRC"];
  const completedMembers = useMemo(() => {
    return allMembers.filter(m => 
      m.onboarding_completed === true && 
      !pendingOnboarding.find(p => p.id === m.id) &&
      !COACH_KEYWORDS.some(kw => (m.membership || "").toUpperCase().includes(kw))
    );
  }, [allMembers, pendingOnboarding]);

  // Combine pending + completed members for onboarding view
  const allMembersWithOnboarding = useMemo(() => {
    const completedWithProgress = completedMembers.map(m => ({
      ...m,
      onboarding_progress: 5,
      onboarding_total: 5,
      onboarding_percentage: 100
    }));
    return [...pendingOnboarding, ...completedWithProgress];
  }, [completedMembers, pendingOnboarding]);

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
      queryClient.invalidateQueries({ queryKey: ["onboarding"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
      toast.success("Onboarding mis à jour");
    },
  });

  const createFollowupMutation = useMutation({
    mutationFn: (data) => axios.post(`${API}/followups`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followups"] });
      setFollowupModalOpen(false);
      toast.success("Suivi planifié");
    },
  });

  const completeFollowupMutation = useMutation({
    mutationFn: ({ id, data }) => axios.post(`${API}/followups/${id}/complete`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followups"] });
      setCompleteModalOpen(false);
      toast.success("Suivi complété");
    },
  });

  const deleteFollowupMutation = useMutation({
    mutationFn: (id) => axios.delete(`${API}/followups/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followups"] });
      toast.success("Suivi supprimé");
    },
  });

  const skipOnboardingMutation = useMutation({
    mutationFn: ({ memberId, reason }) =>
      axios.post(`${API}/onboarding/${memberId}/skip`, { reason, user_name: "Utilisateur" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
      toast.success("Onboarding skipé");
      setSkipDialogOpen(false);
      setSkipTarget(null);
      setSkipReason("");
    },
    onError: () => toast.error("Erreur lors du skip"),
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

    // Sprint C — Filtre par catégorie
    if (categoryFilter === "all") {
      // Défaut : exclure OpenGym / Pret / Inconnu
      result = result.filter((m) => !ONBOARDING_EXCLUDED_DEFAULT.includes(getCategory(m.id)));
    } else {
      result = result.filter((m) => getCategory(m.id) === categoryFilter);
    }

    // Sprint C — Dédup Partenaire : 1 ligne par couple, garder uniquement le primary
    // (les non-primary dont le partenaire est aussi dans la liste sont retirés)
    const idsInList = new Set(result.map((m) => m.id));
    result = result.filter((m) => {
      if (getCategory(m.id) !== "Partenaire") return true;
      const partnerId = getDuoPartnerId(m.id);
      // Si le partenaire n'est pas dans la liste filtrée → garder
      if (!partnerId || !idsInList.has(partnerId)) return true;
      // Sinon : garder UNIQUEMENT si this member est primary
      return isPrimaryInDuo(m.id);
    });
    
    // Sort alphabetically for stable order (no reordering when steps are toggled)
    const sorted = [...result].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    
    return sorted;
  }, [pendingOnboarding, allMembersWithOnboarding, showCompleted, search, editingMemberId, categoryFilter, getCategory, getDuoPartnerId, isPrimaryInDuo]);

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
    setEditingMemberId(memberId);
    
    // Optimistic update: update the cache immediately to prevent reorder
    queryClient.setQueryData(["onboarding", "pending"], (old) => {
      if (!old) return old;
      return old.map(m => 
        m.id === memberId ? { ...m, [stepKey]: !currentValue, 
          onboarding_progress: m.onboarding_progress + (!currentValue ? 1 : -1),
          onboarding_percentage: Math.round(((m.onboarding_progress + (!currentValue ? 1 : -1)) / 5) * 100)
        } : m
      );
    });

    updateOnboardingMutation.mutate({
      memberId,
      data: { [stepKey]: !currentValue }
    }, {
      onSuccess: () => {
        // Refetch in background without clearing cache
        queryClient.invalidateQueries({ queryKey: ["onboarding"] });
        queryClient.invalidateQueries({ queryKey: ["members"] });
      },
      onError: () => {
        // Rollback optimistic update on error
        queryClient.invalidateQueries({ queryKey: ["onboarding"] });
      },
      onSettled: () => {
        setTimeout(() => setEditingMemberId(null), 500);
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
      <div>
        <h1 className="tf-page-header">Onboarding</h1>
        <p className="tf-page-subtitle">
          {lang === "fr" ? "Suivi de l'intégration des nouveaux membres" : "New member integration tracking"}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 tf-stagger">
        <div className="tf-stat cursor-pointer" onClick={() => setActiveTab("onboarding")}>
          <p className="tf-stat-label" style={{color:"var(--color-accent)"}}>
            <ClipboardCheck size={12} style={{display:'inline',marginRight:'4px'}} /> Onboarding en cours
          </p>
          <p className="tf-number-large" style={{color:"var(--color-accent)"}}>{stats.pendingOnboarding}</p>
        </div>
        <div className="tf-stat cursor-pointer" onClick={() => setActiveTab("history")}>
          <p className="tf-stat-label" style={{color:"var(--color-success)"}}>
            <CheckCircle2 size={12} style={{display:'inline',marginRight:'4px'}} /> Onboardings complétés
          </p>
          <p className="tf-number-large" style={{color:"var(--color-success)"}}>{stats.completedOnboarding}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
          <TabsTrigger value="onboarding" className="data-[state=active]:bg-[var(--color-accent)]">Onboarding ({stats.pendingOnboarding})</TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-[var(--color-bg-tertiary)]">Historique</TabsTrigger>
        </TabsList>

        {/* Onboarding Tab */}
        <TabsContent value="onboarding" className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[260px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" size={16} />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un membre..."
                className="pl-10 bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white"
              />
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger
                  className="w-[200px] bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white"
                  data-testid="onboarding-category-filter"
                >
                  <SelectValue placeholder="Catégorie" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
                  <SelectItem value="all" className="text-white">Tous (par défaut)</SelectItem>
                  <SelectItem value="HG" className="text-white">{CATEGORY_LABELS.HG}</SelectItem>
                  <SelectItem value="IFRC" className="text-white">{CATEGORY_LABELS.IFRC}</SelectItem>
                  <SelectItem value="Partenaire" className="text-white">{CATEGORY_LABELS.Partenaire}</SelectItem>
                  <SelectItem value="Challenge" className="text-white">{CATEGORY_LABELS.Challenge}</SelectItem>
                  <SelectItem value="Coach" className="text-white">{CATEGORY_LABELS.Coach}</SelectItem>
                  <SelectItem value="OpenGym" className="text-white">{CATEGORY_LABELS.OpenGym}</SelectItem>
                </SelectContent>
              </Select>
              {completedMembers.length > 0 && (
                <Badge className="bg-[rgba(48,209,88,0.15)] text-[var(--color-success)] border-0">
                  {completedMembers.length} complété{completedMembers.length > 1 ? "s" : ""} (voir Historique)
                </Badge>
              )}
            </div>
          </div>

          <div className="grid gap-4">
            {loadingOnboarding ? (
              <div className="text-center text-[var(--color-text-secondary)] py-8">Chargement...</div>
            ) : pendingOnboarding.length === 0 ? (
              <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-8 border border-[rgba(48,209,88,0.2)] text-center">
                <CheckCircle2 size={48} className="mx-auto text-[var(--color-success)] mb-4" />
                <p className="text-[var(--color-success)] font-medium">
                  Tous les onboardings sont complétés !
                </p>
              </div>
            ) : (
              filteredOnboarding.map((member) => {
                const isEditing = editingMemberId === member.id;
                
                return (
                  <div
                    key={member.id}
                    className={`bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-6 border transition-all duration-300 ${
                      isEditing 
                        ? "border-[rgba(10,132,255,0.3)] ring-2 ring-[rgba(10,132,255,0.1)]" 
                        : "border-[var(--color-border)]"
                    }`}
                    data-testid={`onboarding-${member.id}`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-[rgba(10,132,255,0.15)]">
                          <User className="text-[var(--color-accent)]" size={24} />
                        </div>
                        <div>
                          <p className="text-white font-medium text-lg flex items-center gap-2 flex-wrap">
                            <span>{member.name}</span>
                            {getCategory(member.id) === "Partenaire" && getDuoPartnerName(member.id) && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[rgba(191,90,242,0.15)] text-[#BF5AF2] border border-[rgba(191,90,242,0.25)]" data-testid={`duo-pair-${member.id}`}>
                                & {getDuoPartnerName(member.id)} • DUO
                              </span>
                            )}
                            {getCategory(member.id) && getCategory(member.id) !== "HG" && getCategory(member.id) !== "Partenaire" && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[rgba(255,255,255,0.06)] text-[var(--color-text-tertiary)] border border-[var(--color-border)]" data-testid={`category-${member.id}`}>
                                {CATEGORY_LABELS[getCategory(member.id)] || getCategory(member.id)}
                              </span>
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
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-[var(--color-text-secondary)] text-xs uppercase mb-1">Progression</p>
                          <div className="flex items-center gap-2">
                            <Progress value={member.onboarding_percentage} className="w-24 h-2 bg-[rgba(255,255,255,0.1)]" />
                            <span className="font-bold text-[var(--color-accent)]">
                              {member.onboarding_percentage}%
                            </span>
                          </div>
                          <p className="text-[var(--color-text-tertiary)] text-xs">{member.onboarding_progress}/5 étapes</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid={`skip-onboarding-${member.id}`}
                          className="border-[rgba(255,159,10,0.3)] text-[var(--color-warning)] hover:bg-[rgba(255,159,10,0.1)] hover:text-[var(--color-warning)] gap-1.5"
                          onClick={() => {
                            setSkipTarget(member);
                            setSkipReason("");
                            setSkipDialogOpen(true);
                          }}
                        >
                          <SkipForward size={14} />
                          Passer
                        </Button>
                      </div>
                    </div>

                    {member.onboarding_percentage === 100 && (member.onboarding_completed_at || member.onboarding_completed_date || member.onboarding_completed_by_name) && (
                      <div
                        className="mb-4 px-3 py-2 rounded-[var(--radius-md)] bg-[rgba(48,209,88,0.08)] border border-[rgba(48,209,88,0.18)] flex items-center gap-2 text-xs text-[var(--color-success)]"
                        data-testid={`completed-banner-${member.id}`}
                      >
                        <CheckCircle2 size={13} />
                        <span>
                          Onboardé le{" "}
                          {(() => {
                            const raw = member.onboarding_completed_at || member.onboarding_completed_date;
                            if (!raw) return "date inconnue";
                            try {
                              return format(parseISO(raw), "dd MMM yyyy", { locale: fr });
                            } catch {
                              return "date inconnue";
                            }
                          })()}
                          {member.onboarding_completed_by_name && (
                            <> par <span className="font-medium">{member.onboarding_completed_by_name}</span></>
                          )}
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-5 gap-3">
                      {ONBOARDING_STEPS.map((step) => {
                        const isStepCompleted = member[step.key];
                        return (
                          <div
                            key={step.key}
                            onClick={() => toggleOnboardingStep(member.id, step.key, isStepCompleted)}
                            className={`p-3 rounded-[var(--radius-lg)] border transition-all ${
                              isStepCompleted
                                ? "bg-[rgba(48,209,88,0.08)] border-[rgba(48,209,88,0.2)]"
                                : "bg-[rgba(255,255,255,0.05)] border-[var(--color-border)] hover:border-[rgba(10,132,255,0.3)] cursor-pointer"
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
                            <p className={`text-xs ${isStepCompleted ? "text-[var(--color-success)]" : "text-[var(--color-text-secondary)]"}`}>
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

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          {/* Completed Onboardings Section */}
          {completedMembers.length > 0 && (
            <div className="tf-card overflow-hidden p-0">
              <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center gap-2">
                <CheckCircle2 size={16} className="text-[var(--color-success)]" />
                <span className="text-white font-medium text-sm">
                  Onboardings complétés ({completedMembers.length})
                </span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-[var(--color-border)]">
                    <TableHead className="text-[var(--color-text-secondary)]">Membre</TableHead>
                    <TableHead className="text-[var(--color-text-secondary)]">Abonnement</TableHead>
                    <TableHead className="text-[var(--color-text-secondary)]">Onboardé le</TableHead>
                    <TableHead className="text-[var(--color-text-secondary)]">Par</TableHead>
                    <TableHead className="text-[var(--color-text-secondary)]">Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completedMembers.map((member) => {
                    // Prefer ISO datetime (new field), fallback to legacy date string
                    const completedRaw = member.onboarding_completed_at || member.onboarding_completed_date;
                    let completedLabel = "—";
                    if (completedRaw) {
                      try {
                        completedLabel = format(parseISO(completedRaw), "dd MMM yyyy", { locale: fr });
                      } catch {
                        completedLabel = "—";
                      }
                    }
                    const author = member.onboarding_completed_by_name;
                    return (
                      <TableRow
                        key={member.id}
                        className="border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]"
                        data-testid={`completed-onboarding-row-${member.id}`}
                      >
                        <TableCell className="text-white font-medium">{member.name}</TableCell>
                        <TableCell className="text-[var(--color-text-secondary)]">{member.membership || "-"}</TableCell>
                        <TableCell className="text-[var(--color-text-secondary)]">{completedLabel}</TableCell>
                        <TableCell className="text-[var(--color-text-secondary)]">
                          {author ? (
                            <span data-testid={`onboarding-author-${member.id}`}>{author}</span>
                          ) : (
                            <span className="text-[var(--color-text-tertiary)] italic text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-[rgba(48,209,88,0.15)] text-[var(--color-success)] border-0">
                            Complété
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Followup History */}
          <div className="tf-card overflow-hidden p-0">
            <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center gap-2">
              <Calendar size={16} className="text-[var(--color-accent)]" />
              <span className="text-white font-medium text-sm">
                Historique des suivis ({allFollowups.length})
              </span>
            </div>
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
                      <TableCell className="text-[var(--color-text-secondary)]">
                        {format(parseISO(followup.followup_date), "dd MMM yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-[var(--color-border-strong)] text-[var(--color-text-secondary)]">
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
              <label className="tf-stat-label">Membre *</label>
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
                <label className="tf-stat-label">Date du suivi</label>
                <Input
                  type="date"
                  value={followupForm.followup_date}
                  onChange={(e) => setFollowupForm({ ...followupForm, followup_date: e.target.value })}
                  className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
                />
              </div>
              <div>
                <label className="tf-stat-label">Type de suivi</label>
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
              <label className="tf-stat-label">Notes (optionnel)</label>
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
              className="bg-[var(--color-accent)] hover:opacity-85"
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
                <label className="tf-stat-label">Notes du suivi</label>
                <Input
                  placeholder="Résumé de l'entretien..."
                  className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
                  id="complete-notes-input"
                />
              </div>
              <div>
                <label className="tf-stat-label">Prochain suivi (optionnel)</label>
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
              className="bg-[var(--color-success)] hover:bg-[var(--color-success)] hover:opacity-85"
            >
              {completeFollowupMutation.isPending ? "..." : "Compléter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Skip Onboarding Confirmation Modal */}
      <Dialog open={skipDialogOpen} onOpenChange={setSkipDialogOpen}>
        <DialogContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SkipForward className="text-[var(--color-warning)]" size={20} />
              Passer l'onboarding
            </DialogTitle>
          </DialogHeader>
          {skipTarget && (
            <div className="space-y-4 py-4">
              <div className="bg-[var(--color-bg-tertiary)] rounded-[var(--radius-lg)] p-4">
                <p className="text-white font-medium">{skipTarget.name}</p>
                <p className="text-[var(--color-text-secondary)] text-sm">
                  Progression actuelle : {skipTarget.onboarding_progress}/5 étapes ({skipTarget.onboarding_percentage}%)
                </p>
              </div>
              <p className="text-[var(--color-text-secondary)] text-sm">
                Ce membre sera retiré de la liste des onboardings en attente. Vous pouvez indiquer une raison (optionnel).
              </p>
              <div>
                <label className="tf-stat-label">Raison (optionnel)</label>
                <Input
                  value={skipReason}
                  onChange={(e) => setSkipReason(e.target.value)}
                  placeholder="Ex: Membre déjà expérimenté, transfert d'un autre club..."
                  className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
                  data-testid="skip-reason-input"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSkipDialogOpen(false)} data-testid="skip-cancel-btn">Annuler</Button>
            <Button
              onClick={() => skipOnboardingMutation.mutate({ memberId: skipTarget?.id, reason: skipReason })}
              disabled={skipOnboardingMutation.isPending}
              className="bg-[var(--color-warning)] hover:bg-[var(--color-warning)] hover:opacity-85 text-black"
              data-testid="skip-confirm-btn"
            >
              {skipOnboardingMutation.isPending ? "..." : "Confirmer le skip"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
