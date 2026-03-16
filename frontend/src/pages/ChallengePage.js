import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Trophy,
  Plus,
  Users,
  Calendar,
  Check,
  X,
  Trash2,
  Edit,
  ChevronRight,
  Target,
  Flame,
  Award,
  ClipboardCheck,
  Eye,
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
import { Progress } from "../components/ui/progress";
import { toast } from "sonner";
import { useTranslations } from "../hooks/useTranslations";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const WEEKS = [1, 2, 3, 4, 5, 6];
const CHECKINS_PER_WEEK = 3; // Objectif : 3 check-ins par semaine

const CHALLENGE_TYPES = [
  { value: "fixed", label: "Challenge à date fixe", description: "Ex: Challenge Hiver 2024 - dates communes pour tous" },
  { value: "personal", label: "Challenge personnel", description: "Dates personnalisées par participant" },
];

export default function ChallengePage() {
  const { lang } = useTranslations();
  const queryClient = useQueryClient();
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [addParticipantOpen, setAddParticipantOpen] = useState(false);
  const [checkinModalOpen, setCheckinModalOpen] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    start_date: "",
    end_date: "",
    is_active: true,
    challenge_type: "fixed",
    checkins_goal: CHECKINS_PER_WEEK,
  });
  const [participantData, setParticipantData] = useState({
    member_id: "",
    member_name: "",
    personal_start_date: "",
    personal_end_date: "",
  });

  // Fetch challenges
  const { data: challenges = [], isLoading } = useQuery({
    queryKey: ["challenges"],
    queryFn: () => axios.get(`${API}/challenges`).then((r) => r.data),
  });

  // Fetch challenge detail
  const { data: challengeDetail } = useQuery({
    queryKey: ["challenges", selectedChallenge],
    queryFn: () =>
      selectedChallenge
        ? axios.get(`${API}/challenges/${selectedChallenge}`).then((r) => r.data)
        : null,
    enabled: !!selectedChallenge,
  });

  // Fetch members for participant selection
  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: () => axios.get(`${API}/members`).then((r) => r.data),
  });

  // Fetch bilans for challenge participants
  const { data: challengeBilans = [] } = useQuery({
    queryKey: ["challenge-bilans", selectedChallenge],
    queryFn: async () => {
      if (!challengeDetail?.participants?.length) return [];
      const memberIds = challengeDetail.participants.map(p => p.member_id);
      const allReviews = await axios.get(`${API}/annual-reviews`).then(r => r.data);
      return allReviews.filter(r => memberIds.includes(r.member_id));
    },
    enabled: !!challengeDetail?.participants?.length,
  });

  // Create/Update challenge
  const saveMutation = useMutation({
    mutationFn: (data) =>
      formData.id
        ? axios.put(`${API}/challenges/${formData.id}`, data)
        : axios.post(`${API}/challenges`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["challenges"]);
      setModalOpen(false);
      toast.success(formData.id ? "Challenge mis à jour" : "Challenge créé");
    },
    onError: () => toast.error("Erreur"),
  });

  // Delete challenge
  const deleteMutation = useMutation({
    mutationFn: (id) => axios.delete(`${API}/challenges/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(["challenges"]);
      setSelectedChallenge(null);
      toast.success("Challenge supprimé");
    },
  });

  // Add participant
  const addParticipantMutation = useMutation({
    mutationFn: (data) =>
      axios.post(`${API}/challenges/${selectedChallenge}/participants`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["challenges", selectedChallenge]);
      setAddParticipantOpen(false);
      toast.success("Participant ajouté");
    },
    onError: (err) => toast.error(err.response?.data?.detail || "Erreur"),
  });

  // Update participant check-ins
  const updateCheckinMutation = useMutation({
    mutationFn: ({ participantId, data }) =>
      axios.put(`${API}/challenges/${selectedChallenge}/participants/${participantId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["challenges", selectedChallenge]);
    },
  });

  // Remove participant
  const removeParticipantMutation = useMutation({
    mutationFn: (participantId) =>
      axios.delete(`${API}/challenges/${selectedChallenge}/participants/${participantId}`),
    onSuccess: () => {
      queryClient.invalidateQueries(["challenges", selectedChallenge]);
      toast.success("Participant retiré");
    },
  });

  const openAddModal = () => {
    setFormData({
      name: "",
      start_date: format(new Date(), "yyyy-MM-dd"),
      end_date: format(new Date(Date.now() + 42 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
      is_active: true,
      challenge_type: "fixed",
      checkins_goal: CHECKINS_PER_WEEK,
    });
    setModalOpen(true);
  };

  const openEditModal = (challenge) => {
    setFormData({
      id: challenge.id,
      name: challenge.name,
      start_date: challenge.start_date,
      end_date: challenge.end_date || "",
      is_active: challenge.is_active,
      challenge_type: challenge.challenge_type || "fixed",
      checkins_goal: challenge.checkins_goal || CHECKINS_PER_WEEK,
    });
    setModalOpen(true);
  };

  const openCheckinModal = (participant) => {
    setSelectedParticipant(participant);
    setCheckinModalOpen(true);
  };

  // Calculate weekly check-ins from training data (attendance) with fallback to manual
  const getWeeklyCheckins = (participant, week) => {
    // Training-based check-ins from Saisie Séances (preferred)
    const trainingKey = `week${week}_trainings`;
    if (participant[trainingKey] !== undefined && participant[trainingKey] > 0) {
      return participant[trainingKey];
    }
    // Fallback to manually entered check-ins
    const key = `week${week}_checkins`;
    return participant[key] || 0;
  };

  const updateWeeklyCheckins = (participant, week, count) => {
    const key = `week${week}_checkins`;
    updateCheckinMutation.mutate({
      participantId: participant.id,
      data: { [key]: count }
    });
  };

  // Calculate stats
  const stats = useMemo(() => {
    if (!challengeDetail?.participants) return null;
    
    const participants = challengeDetail.participants;
    const totalParticipants = participants.length;
    const goal = challengeDetail.checkins_goal || 3;
    
    // A week is "completed" if check-ins >= goal (from trainings or manual only)
    const isWeekComplete = (p, w) => {
      const trainings = p[`week${w}_trainings`] || 0;
      const manual = p[`week${w}_checkins`] || 0;
      const checkins = Math.max(trainings, manual);
      return checkins >= goal;
    };
    
    const weeklyStats = WEEKS.map((w) => ({
      week: w,
      completed: participants.filter((p) => isWeekComplete(p, w)).length,
      percentage: totalParticipants > 0
        ? Math.round((participants.filter((p) => isWeekComplete(p, w)).length / totalParticipants) * 100)
        : 0,
    }));
    
    const completionByParticipant = participants.map((p) => ({
      ...p,
      completedWeeks: WEEKS.filter((w) => isWeekComplete(p, w)).length,
      completionRate: Math.round((WEEKS.filter((w) => isWeekComplete(p, w)).length / 6) * 100),
    }));
    
    const avgCompletion = totalParticipants > 0
      ? Math.round(completionByParticipant.reduce((sum, p) => sum + p.completionRate, 0) / totalParticipants)
      : 0;
    
    return {
      totalParticipants,
      weeklyStats,
      completionByParticipant,
      avgCompletion,
      fullyCompleted: completionByParticipant.filter((p) => p.completedWeeks === 6).length,
    };
  }, [challengeDetail]);

  const toggleWeekCheckin = (participant, week) => {
    const currentValue = participant[`week${week}`];
    updateCheckinMutation.mutate({
      participantId: participant.id,
      data: { [`week${week}`]: !currentValue },
    });
  };

  return (
    <div className="space-y-6" data-testid="challenge-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="tf-page-header">
            {lang === "fr" ? "Challenge 6 Semaines" : "6 Weeks Challenge"}
          </h1>
          <p className="tf-page-subtitle">
            {lang === "fr" ? "Suivi des participants et progression" : "Track participants and progress"}
          </p>
        </div>
        <Button onClick={openAddModal} className="bg-[var(--color-accent)] hover:opacity-85" data-testid="add-challenge-btn">
          <Plus size={16} className="mr-2" />
          {lang === "fr" ? "Nouveau Challenge" : "New Challenge"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Challenge List */}
        <div className="space-y-3">
          <h2 className="text-[var(--color-text-secondary)] text-sm font-medium uppercase tracking-wide">Challenges</h2>
          {isLoading ? (
            <p className="text-[var(--color-text-secondary)]">Chargement...</p>
          ) : challenges.length === 0 ? (
            <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-6 border border-[var(--color-border)] text-center">
              <Trophy size={32} className="mx-auto text-[var(--color-text-tertiary)] mb-2" />
              <p className="text-[var(--color-text-secondary)]">Aucun challenge</p>
            </div>
          ) : (
            challenges.map((challenge) => (
              <div
                key={challenge.id}
                onClick={() => setSelectedChallenge(challenge.id)}
                className={`bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-4 border cursor-pointer transition-all ${
                  selectedChallenge === challenge.id
                    ? "border-[var(--color-accent)] bg-[rgba(10,132,255,0.05)]"
                    : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
                }`}
                data-testid={`challenge-${challenge.id}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-[var(--radius-lg)] ${challenge.is_active ? "bg-[rgba(10,132,255,0.15)]" : "bg-[rgba(255,255,255,0.1)]"}`}>
                      <Trophy size={18} className={challenge.is_active ? "text-[var(--color-accent)]" : "text-[var(--color-text-secondary)]"} />
                    </div>
                    <div>
                      <p className="text-white font-medium">{challenge.name}</p>
                      <p className="text-[var(--color-text-secondary)] text-xs flex items-center gap-1">
                        <Calendar size={10} />
                        {challenge.challenge_type === "personal" 
                          ? "Dates personnalisées"
                          : <>
                              {challenge.start_date ? format(parseISO(challenge.start_date), "dd MMM", { locale: fr }) : "-"}
                              {challenge.end_date && ` → ${format(parseISO(challenge.end_date), "dd MMM", { locale: fr })}`}
                            </>
                        }
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-[var(--color-text-tertiary)]" />
                </div>
                <div className="flex gap-2 mt-2">
                  {challenge.is_active && (
                    <Badge className="bg-[rgba(10,132,255,0.15)] text-[var(--color-accent)] border-0">Actif</Badge>
                  )}
                  <Badge className={`border-0 ${challenge.challenge_type === "personal" ? "bg-[rgba(10,132,255,0.15)] text-[var(--color-accent)]" : "bg-[rgba(255,255,255,0.1)] text-[var(--color-text-secondary)]"}`}>
                    {challenge.challenge_type === "personal" ? "Personnel" : "Date fixe"}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Challenge Detail */}
        <div className="lg:col-span-2">
          {!selectedChallenge ? (
            <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-12 border border-[var(--color-border)] text-center">
              <Target size={48} className="mx-auto mb-4" style={{ color: 'var(--color-text-tertiary)' }} />
              <p className="text-[var(--color-text-secondary)]">Sélectionnez un challenge pour voir les détails</p>
            </div>
          ) : !challengeDetail ? (
            <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-12 border border-[var(--color-border)] text-center">
              <p className="text-[var(--color-text-secondary)]">Chargement...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Challenge Header */}
              <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-6 border border-[var(--color-border)]">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white">{challengeDetail.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      {challengeDetail.challenge_type === "personal" ? (
                        <span className="text-[var(--color-text-secondary)] text-sm">Dates personnalisées par participant</span>
                      ) : (
                        <span className="text-[var(--color-text-secondary)] text-sm">
                          {challengeDetail.start_date && format(parseISO(challengeDetail.start_date), "dd MMMM yyyy", { locale: fr })}
                          {challengeDetail.end_date && ` - ${format(parseISO(challengeDetail.end_date), "dd MMMM yyyy", { locale: fr })}`}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className={`border-0 ${challengeDetail.challenge_type === "personal" ? "bg-[rgba(10,132,255,0.15)] text-[var(--color-accent)]" : "bg-[rgba(255,255,255,0.1)] text-[var(--color-text-secondary)]"}`}>
                        {challengeDetail.challenge_type === "personal" ? "Personnel" : "Date fixe"}
                      </Badge>
                      <Badge className="bg-[rgba(10,132,255,0.15)] text-[var(--color-accent)] border-0">
                        Objectif : {challengeDetail.checkins_goal || 3}x / semaine
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEditModal(challengeDetail)}
                      className="text-[var(--color-text-secondary)] hover:text-white"
                    >
                      <Edit size={16} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(challengeDetail.id)}
                      className="text-[var(--color-danger)] hover:text-[var(--color-danger)]"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>

                {/* Stats */}
                {stats && (
                  <div className="grid grid-cols-4 gap-4 mt-6">
                    <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-3">
                      <p className="text-[var(--color-text-secondary)] text-xs uppercase">Participants</p>
                      <p className="tf-number-large">{stats.totalParticipants}</p>
                    </div>
                    <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-3">
                      <p className="text-[var(--color-text-secondary)] text-xs uppercase">Complétion moy.</p>
                      <p className="tf-number-large" style={{color:"var(--color-accent)"}}>{stats.avgCompletion}%</p>
                    </div>
                    <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-3">
                      <p className="text-[var(--color-text-secondary)] text-xs uppercase">100% complété</p>
                      <p className="tf-number-large" style={{color:"var(--color-success)"}}>{stats.fullyCompleted}</p>
                    </div>
                    <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-3">
                      <p className="text-[var(--color-text-secondary)] text-xs uppercase">Statut</p>
                      <Badge className={challengeDetail.is_active ? "bg-[rgba(48,209,88,0.15)] text-[var(--color-success)]" : "bg-[rgba(255,255,255,0.1)] text-[var(--color-text-secondary)]"}>
                        {challengeDetail.is_active ? "Actif" : "Terminé"}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>

              {/* Weekly Progress */}
              {stats && (
                <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-6 border border-[var(--color-border)]">
                  <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                    <Flame className="text-[var(--color-accent)]" size={18} />
                    Progression par semaine
                  </h3>
                  <div className="grid grid-cols-6 gap-3">
                    {stats.weeklyStats.map((week) => (
                      <div key={week.week} className="text-center">
                        <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-3">
                          <p className="text-[var(--color-text-secondary)] text-xs mb-1">S{week.week}</p>
                          <p className="text-lg font-bold text-white">{week.completed}</p>
                          <p className="text-xs text-[var(--color-accent)]">{week.percentage}%</p>
                        </div>
                        <Progress value={week.percentage} className="mt-2 h-1 bg-[rgba(255,255,255,0.1)]" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Participants */}
              <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-6 border border-[var(--color-border)]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-medium flex items-center gap-2">
                    <Users size={18} className="text-[var(--color-text-secondary)]" />
                    Participants
                  </h3>
                  <Button
                    size="sm"
                    onClick={() => setAddParticipantOpen(true)}
                    className="bg-[var(--color-accent)] hover:opacity-85"
                    data-testid="add-participant-btn"
                  >
                    <Plus size={14} className="mr-1" />
                    Ajouter
                  </Button>
                </div>

                {challengeDetail.participants?.length === 0 ? (
                  <p className="text-[var(--color-text-secondary)] text-center py-8">Aucun participant</p>
                ) : (
                  <div className="space-y-2">
                    {stats?.completionByParticipant.map((participant) => (
                      <div
                        key={participant.id}
                        className="flex items-center gap-4 bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-3"
                        data-testid={`participant-${participant.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium">{participant.member_name}</p>
                          {challengeDetail?.challenge_type === "personal" && participant.personal_start_date && (
                            <p className="text-[var(--color-text-tertiary)] text-xs mt-0.5">
                              {format(parseISO(participant.personal_start_date), "dd MMM", { locale: fr })}
                              {participant.personal_end_date && ` → ${format(parseISO(participant.personal_end_date), "dd MMM", { locale: fr })}`}
                            </p>
                          )}
                          <div className="flex items-center gap-1 mt-1">
                            <Progress value={participant.completionRate} className="w-24 h-1.5 bg-[rgba(255,255,255,0.1)]" />
                            <span className="text-xs text-[var(--color-text-secondary)]">{participant.completionRate}%</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {WEEKS.map((week) => {
                            const checkins = getWeeklyCheckins(participant, week);
                            const goal = challengeDetail.checkins_goal || 3;
                            const isComplete = checkins >= goal;
                            return (
                              <div
                                key={week}
                                className={`w-8 h-8 rounded flex items-center justify-center ${
                                  isComplete
                                    ? "bg-[rgba(48,209,88,0.15)] text-[var(--color-success)]"
                                    : checkins > 0
                                      ? "bg-[rgba(10,132,255,0.15)] text-[var(--color-accent)]"
                                      : "bg-[rgba(255,255,255,0.05)] text-[var(--color-text-tertiary)]"
                                }`}
                                title={`S${week}: ${checkins}/${goal} séances`}
                                data-testid={`check-w${week}-${participant.id}`}
                              >
                                {isComplete ? <Check size={14} /> : checkins > 0 ? <span className="text-xs font-bold">{checkins}</span> : <span className="text-xs">{week}</span>}
                              </div>
                            );
                          })}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openCheckinModal(participant)}
                          className="text-[var(--color-accent)] hover:text-[var(--color-accent)]"
                          title="Check-ins détaillés"
                          data-testid={`detail-checkin-${participant.id}`}
                        >
                          <Target size={14} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeParticipantMutation.mutate(participant.id)}
                          className="text-[var(--color-danger)] hover:text-[var(--color-danger)]"
                        >
                          <Trash2 size={14} />
                        </Button>
                        {participant.completedWeeks === 6 && (
                          <Award className="text-[var(--color-success)]" size={20} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bilans / Suivis des participants */}
              <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-6 border border-[var(--color-border)]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-medium flex items-center gap-2">
                    <ClipboardCheck size={18} className="text-[var(--color-accent)]" />
                    Bilans mensuels des participants
                  </h3>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-[rgba(10,132,255,0.15)] text-[var(--color-accent)] border-0">
                      {challengeBilans.filter(b => b.status === "completed").length} / {challengeDetail?.participants?.length || 0} remplis
                    </Badge>
                    {challengeDetail?.participants?.length > 0 && challengeBilans.length === 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs border-[var(--color-border)] text-[var(--color-accent)]"
                        onClick={async () => {
                          try {
                            for (const p of challengeDetail.participants) {
                              try {
                                await axios.post(`${API}/challenges/${selectedChallenge}/participants`, {
                                  challenge_id: selectedChallenge,
                                  member_id: p.member_id,
                                  member_name: p.member_name,
                                });
                              } catch {}
                            }
                            queryClient.invalidateQueries(["challenge-bilans"]);
                          } catch {}
                        }}
                        data-testid="generate-bilans-btn"
                      >
                        <ClipboardCheck size={12} className="mr-1" />
                        Générer les bilans
                      </Button>
                    )}
                  </div>
                </div>

                {/* Per-participant status grid */}
                {challengeDetail?.participants?.length > 0 ? (
                  <div className="space-y-2">
                    {challengeDetail.participants.map((participant) => {
                      const pBilans = challengeBilans.filter(b => b.member_id === participant.member_id);
                      const completed = pBilans.filter(b => b.status === "completed");
                      const scheduled = pBilans.filter(b => b.status === "scheduled");
                      const hasCompletedBilan = completed.length > 0;
                      return (
                        <div
                          key={participant.member_id}
                          className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                            hasCompletedBilan
                              ? 'bg-[rgba(48,209,88,0.04)] border-[rgba(48,209,88,0.15)]'
                              : scheduled.length > 0
                                ? 'bg-[rgba(255,214,10,0.04)] border-[rgba(255,214,10,0.15)]'
                                : 'bg-[var(--color-bg-primary)] border-[var(--color-border)]'
                          }`}
                          data-testid={`bilan-status-${participant.member_id}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-2.5 h-2.5 rounded-full ${
                              hasCompletedBilan ? 'bg-[var(--color-success)]'
                              : scheduled.length > 0 ? 'bg-[var(--color-warning)]'
                              : 'bg-[var(--color-text-tertiary)]'
                            }`} />
                            <div>
                              <p className="text-white text-sm font-medium">{participant.member_name}</p>
                              {pBilans.length > 0 && (
                                <p className="text-[var(--color-text-tertiary)] text-xs mt-0.5">
                                  {completed.length > 0
                                    ? `Dernier bilan: ${completed[0].review_date ? format(parseISO(completed[0].review_date), "dd MMM yyyy", { locale: fr }) : "-"}`
                                    : scheduled.length > 0
                                      ? `Planifié: ${scheduled[0].review_date ? format(parseISO(scheduled[0].review_date), "dd MMM yyyy", { locale: fr }) : "-"}`
                                      : ""
                                  }
                                  {completed[0]?.weight_current ? ` - ${completed[0].weight_current}kg` : ""}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {hasCompletedBilan ? (
                              <Badge className="bg-[rgba(48,209,88,0.15)] text-[var(--color-success)] border-0 text-xs">
                                Bilan rempli
                              </Badge>
                            ) : scheduled.length > 0 ? (
                              <Badge className="bg-[rgba(255,214,10,0.15)] text-[var(--color-warning)] border-0 text-xs">
                                En attente
                              </Badge>
                            ) : (
                              <Badge className="bg-[rgba(255,69,58,0.12)] text-[var(--color-danger)] border-0 text-xs">
                                Pas de bilan
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <ClipboardCheck size={32} className="mx-auto text-[var(--color-text-tertiary)] mb-2" />
                    <p className="text-[var(--color-text-secondary)] text-sm">
                      Aucun participant inscrit
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Challenge Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white">
          <DialogHeader>
            <DialogTitle>
              {formData.id ? "Modifier le challenge" : "Nouveau challenge"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="tf-stat-label">Nom du challenge *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Challenge Hiver 2024"
                className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
                data-testid="challenge-name-input"
              />
            </div>
            
            {/* Challenge Type */}
            <div>
              <label className="tf-stat-label">Type de challenge</label>
              <Select 
                value={formData.challenge_type} 
                onValueChange={(v) => setFormData({ ...formData, challenge_type: v })}
              >
                <SelectTrigger className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
                  {CHALLENGE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value} className="text-white">
                      <div>
                        <p className="font-medium">{type.label}</p>
                        <p className="text-xs text-[var(--color-text-secondary)]">{type.description}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.challenge_type === "fixed" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="tf-stat-label">Date de début</label>
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
                  />
                </div>
                <div>
                  <label className="tf-stat-label">Date de fin</label>
                  <Input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
                  />
                </div>
              </div>
            )}
            
            {formData.challenge_type === "personal" && (
              <div className="bg-[rgba(10,132,255,0.08)] border border-[rgba(10,132,255,0.2)] rounded-[var(--radius-lg)] p-3">
                <p className="text-[var(--color-accent)] text-sm">
                  Les dates seront définies individuellement pour chaque participant lors de l'inscription.
                </p>
              </div>
            )}

            {/* Check-ins goal */}
            <div>
              <label className="tf-stat-label">Objectif check-ins par semaine</label>
              <div className="flex gap-2 mt-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setFormData({ ...formData, checkins_goal: n })}
                    className={`flex-1 py-2 rounded-[var(--radius-md)] text-sm font-medium transition-all ${
                      formData.checkins_goal === n
                        ? "bg-[var(--color-accent)] text-white"
                        : "bg-[rgba(255,255,255,0.1)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]"
                    }`}
                    data-testid={`checkin-goal-${n}`}
                  >
                    {n}x / sem.
                  </button>
                ))}
              </div>
              <p className="text-[var(--color-text-tertiary)] text-xs mt-1">
                Les participants doivent venir {formData.checkins_goal || 3}x par semaine pendant 6 semaines
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
              />
              <span className="text-[var(--color-text-secondary)]">Challenge actif</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button
              onClick={() => saveMutation.mutate(formData)}
              disabled={!formData.name || saveMutation.isPending}
              className="bg-[var(--color-accent)] hover:opacity-85"
              data-testid="save-challenge-btn"
            >
              {saveMutation.isPending ? "..." : formData.id ? "Mettre à jour" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Participant Modal */}
      <Dialog open={addParticipantOpen} onOpenChange={setAddParticipantOpen}>
        <DialogContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white">
          <DialogHeader>
            <DialogTitle>Ajouter un participant</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="tf-stat-label">Sélectionner un membre</label>
              <Select
                value={participantData.member_id}
                onValueChange={(v) => {
                  const member = members.find((m) => m.id === v);
                  setParticipantData({
                    ...participantData,
                    member_id: v,
                    member_name: member?.name || "",
                  });
                }}
              >
                <SelectTrigger className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1" data-testid="select-member">
                  <SelectValue placeholder="Choisir un membre..." />
                </SelectTrigger>
                <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id} className="text-white">
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Personal dates for personal challenges */}
            {challengeDetail?.challenge_type === "personal" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="tf-stat-label">Début personnel</label>
                  <Input
                    type="date"
                    value={participantData.personal_start_date}
                    onChange={(e) => setParticipantData({ ...participantData, personal_start_date: e.target.value })}
                    className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
                  />
                </div>
                <div>
                  <label className="tf-stat-label">Fin personnel</label>
                  <Input
                    type="date"
                    value={participantData.personal_end_date}
                    onChange={(e) => setParticipantData({ ...participantData, personal_end_date: e.target.value })}
                    className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddParticipantOpen(false)}>Annuler</Button>
            <Button
              onClick={() =>
                addParticipantMutation.mutate({
                  challenge_id: selectedChallenge,
                  ...participantData,
                })
              }
              disabled={!participantData.member_id || addParticipantMutation.isPending}
              className="bg-[var(--color-accent)] hover:opacity-85"
              data-testid="confirm-add-participant-btn"
            >
              {addParticipantMutation.isPending ? "..." : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Weekly Check-ins Modal */}
      <Dialog open={checkinModalOpen} onOpenChange={setCheckinModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="text-[var(--color-accent)]" size={20} />
              Check-ins hebdomadaires - {selectedParticipant?.member_name}
            </DialogTitle>
          </DialogHeader>
          {selectedParticipant && (
            <div className="space-y-4 py-4">
              <p className="text-[var(--color-text-secondary)] text-sm">
                Objectif : {challengeDetail?.checkins_goal || 3} séances par semaine — données issues de la Saisie Séances
              </p>
              <div className="grid grid-cols-3 gap-3">
                {WEEKS.map((week) => {
                  const trainings = selectedParticipant[`week${week}_trainings`] || 0;
                  const manual = selectedParticipant[`week${week}_checkins`] || 0;
                  const checkins = Math.max(trainings, manual);
                  const goal = challengeDetail?.checkins_goal || 3;
                  const isComplete = checkins >= goal;
                  return (
                    <div 
                      key={week} 
                      className={`bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-4 border ${
                        isComplete ? "border-[rgba(48,209,88,0.2)]" : "border-[var(--color-border)]"
                      }`}
                    >
                      <p className="text-[var(--color-text-secondary)] text-xs uppercase mb-2">Semaine {week}</p>
                      <p className={`tf-number-large text-center ${isComplete ? "text-[var(--color-success)]" : trainings > 0 ? "text-[var(--color-accent)]" : "text-white"}`}>
                        {checkins}
                      </p>
                      <p className="text-center text-xs mt-1">
                        {isComplete ? (
                          <span className="text-[var(--color-success)]">Objectif atteint</span>
                        ) : (
                          <span className="text-[var(--color-text-tertiary)]">{checkins}/{goal} séances</span>
                        )}
                      </p>
                      {trainings > 0 && (
                        <p className="text-center text-[10px] text-[var(--color-accent)] mt-0.5">via Saisie Séances</p>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="bg-[rgba(10,132,255,0.08)] border border-[rgba(10,132,255,0.2)] rounded-[var(--radius-lg)] p-3 mt-4">
                <p className="text-[var(--color-accent)] text-sm">
                  Total : {WEEKS.reduce((sum, w) => sum + getWeeklyCheckins(selectedParticipant, w), 0)} check-ins 
                  / {(challengeDetail?.checkins_goal || 3) * 6} objectif
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCheckinModalOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
