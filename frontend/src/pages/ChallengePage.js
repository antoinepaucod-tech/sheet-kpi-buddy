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

  // Calculate weekly check-ins from participant data
  const getWeeklyCheckins = (participant, week) => {
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
    
    const weeklyStats = WEEKS.map((w) => ({
      week: w,
      completed: participants.filter((p) => p[`week${w}`]).length,
      percentage: totalParticipants > 0
        ? Math.round((participants.filter((p) => p[`week${w}`]).length / totalParticipants) * 100)
        : 0,
    }));
    
    const completionByParticipant = participants.map((p) => ({
      ...p,
      completedWeeks: WEEKS.filter((w) => p[`week${w}`]).length,
      completionRate: Math.round((WEEKS.filter((w) => p[`week${w}`]).length / 6) * 100),
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
        <Button onClick={openAddModal} className="bg-amber-600 hover:bg-amber-700" data-testid="add-challenge-btn">
          <Plus size={16} className="mr-2" />
          {lang === "fr" ? "Nouveau Challenge" : "New Challenge"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Challenge List */}
        <div className="space-y-3">
          <h2 className="text-white/70 text-sm font-medium uppercase tracking-wide">Challenges</h2>
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
                    ? "border-amber-500 bg-amber-500/5"
                    : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
                }`}
                data-testid={`challenge-${challenge.id}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-[var(--radius-lg)] ${challenge.is_active ? "bg-amber-500/20" : "bg-white/10"}`}>
                      <Trophy size={18} className={challenge.is_active ? "text-amber-500" : "text-[var(--color-text-secondary)]"} />
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
                    <Badge className="bg-amber-500/20 text-amber-400 border-0">Actif</Badge>
                  )}
                  <Badge className={`border-0 ${challenge.challenge_type === "personal" ? "bg-blue-500/20 text-[var(--color-accent)]" : "bg-white/10 text-[var(--color-text-secondary)]"}`}>
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
              <Target size={48} className="mx-auto text-white/10 mb-4" />
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
                      <Badge className={`border-0 ${challengeDetail.challenge_type === "personal" ? "bg-blue-500/20 text-[var(--color-accent)]" : "bg-white/10 text-[var(--color-text-secondary)]"}`}>
                        {challengeDetail.challenge_type === "personal" ? "Personnel" : "Date fixe"}
                      </Badge>
                      <Badge className="bg-amber-500/10 text-amber-400 border-0">
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
                      className="text-[var(--color-danger)] hover:text-red-300"
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
                      <p className="text-2xl font-mono font-bold text-white">{stats.totalParticipants}</p>
                    </div>
                    <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-3">
                      <p className="text-[var(--color-text-secondary)] text-xs uppercase">Complétion moy.</p>
                      <p className="text-2xl font-mono font-bold text-amber-400">{stats.avgCompletion}%</p>
                    </div>
                    <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-3">
                      <p className="text-[var(--color-text-secondary)] text-xs uppercase">100% complété</p>
                      <p className="text-2xl font-mono font-bold text-[var(--color-success)]">{stats.fullyCompleted}</p>
                    </div>
                    <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-3">
                      <p className="text-[var(--color-text-secondary)] text-xs uppercase">Statut</p>
                      <Badge className={challengeDetail.is_active ? "bg-emerald-500/20 text-[var(--color-success)]" : "bg-white/10 text-[var(--color-text-secondary)]"}>
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
                    <Flame className="text-[var(--color-warning)]" size={18} />
                    Progression par semaine
                  </h3>
                  <div className="grid grid-cols-6 gap-3">
                    {stats.weeklyStats.map((week) => (
                      <div key={week.week} className="text-center">
                        <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-3">
                          <p className="text-[var(--color-text-secondary)] text-xs mb-1">S{week.week}</p>
                          <p className="text-lg font-bold text-white">{week.completed}</p>
                          <p className="text-xs text-amber-400">{week.percentage}%</p>
                        </div>
                        <Progress value={week.percentage} className="mt-2 h-1 bg-white/10" />
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
                    className="bg-amber-600 hover:bg-amber-700"
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
                            <Progress value={participant.completionRate} className="w-24 h-1.5 bg-white/10" />
                            <span className="text-xs text-[var(--color-text-secondary)]">{participant.completionRate}%</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {WEEKS.map((week) => (
                            <button
                              key={week}
                              onClick={() => toggleWeekCheckin(participant, week)}
                              className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                                participant[`week${week}`]
                                  ? "bg-emerald-500/20 text-[var(--color-success)]"
                                  : "bg-white/5 text-[var(--color-text-tertiary)] hover:bg-white/10"
                              }`}
                              data-testid={`check-w${week}-${participant.id}`}
                            >
                              {participant[`week${week}`] ? <Check size={14} /> : <span className="text-xs">{week}</span>}
                            </button>
                          ))}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openCheckinModal(participant)}
                          className="text-amber-400 hover:text-amber-300"
                          title="Check-ins détaillés"
                          data-testid={`detail-checkin-${participant.id}`}
                        >
                          <Target size={14} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeParticipantMutation.mutate(participant.id)}
                          className="text-[var(--color-danger)] hover:text-red-300"
                        >
                          <Trash2 size={14} />
                        </Button>
                        {participant.completedWeeks === 6 && (
                          <Award className="text-amber-400" size={20} />
                        )}
                      </div>
                    ))}
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
              <label className="text-[var(--color-text-secondary)] tf-label inline">Nom du challenge *</label>
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
              <label className="text-[var(--color-text-secondary)] tf-label inline">Type de challenge</label>
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
                  <label className="text-[var(--color-text-secondary)] tf-label inline">Date de début</label>
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
                  />
                </div>
                <div>
                  <label className="text-[var(--color-text-secondary)] tf-label inline">Date de fin</label>
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
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-[var(--radius-lg)] p-3">
                <p className="text-amber-400 text-sm">
                  Les dates seront définies individuellement pour chaque participant lors de l'inscription.
                </p>
              </div>
            )}

            {/* Check-ins goal */}
            <div>
              <label className="text-[var(--color-text-secondary)] tf-label inline">Objectif check-ins par semaine</label>
              <div className="flex items-center gap-4 mt-1">
                <Input
                  type="number"
                  min={1}
                  max={7}
                  value={formData.checkins_goal}
                  onChange={(e) => setFormData({ ...formData, checkins_goal: parseInt(e.target.value) || 3 })}
                  className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white w-20"
                />
                <span className="text-[var(--color-text-secondary)] text-sm">séances / semaine</span>
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
              <span className="text-white/70">Challenge actif</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button
              onClick={() => saveMutation.mutate(formData)}
              disabled={!formData.name || saveMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700"
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
              <label className="text-[var(--color-text-secondary)] tf-label inline">Sélectionner un membre</label>
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
                  <label className="text-[var(--color-text-secondary)] tf-label inline">Début personnel</label>
                  <Input
                    type="date"
                    value={participantData.personal_start_date}
                    onChange={(e) => setParticipantData({ ...participantData, personal_start_date: e.target.value })}
                    className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
                  />
                </div>
                <div>
                  <label className="text-[var(--color-text-secondary)] tf-label inline">Fin personnel</label>
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
              className="bg-amber-600 hover:bg-amber-700"
              data-testid="confirm-add-participant-btn"
            >
              {addParticipantMutation.isPending ? "..." : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Weekly Check-ins Modal */}
      <Dialog open={checkinModalOpen} onOpenChange={setCheckinModalOpen}>
        <DialogContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="text-amber-400" size={20} />
              Check-ins hebdomadaires - {selectedParticipant?.member_name}
            </DialogTitle>
          </DialogHeader>
          {selectedParticipant && (
            <div className="space-y-4 py-4">
              <p className="text-[var(--color-text-secondary)] text-sm">
                Objectif : {challengeDetail?.checkins_goal || 3} check-ins par semaine
              </p>
              <div className="grid grid-cols-3 gap-3">
                {WEEKS.map((week) => {
                  const checkins = getWeeklyCheckins(selectedParticipant, week);
                  const goal = challengeDetail?.checkins_goal || 3;
                  const isComplete = checkins >= goal;
                  return (
                    <div 
                      key={week} 
                      className={`bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-4 border ${
                        isComplete ? "border-emerald-500/30" : "border-[var(--color-border)]"
                      }`}
                    >
                      <p className="text-[var(--color-text-secondary)] text-xs uppercase mb-2">Semaine {week}</p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateWeeklyCheckins(selectedParticipant, week, Math.max(0, checkins - 1))}
                          className="w-8 h-8 rounded bg-white/10 text-white hover:bg-white/20 flex items-center justify-center"
                        >
                          -
                        </button>
                        <span className={`text-2xl font-bold flex-1 text-center ${isComplete ? "text-[var(--color-success)]" : "text-white"}`}>
                          {checkins}
                        </span>
                        <button
                          onClick={() => updateWeeklyCheckins(selectedParticipant, week, Math.min(7, checkins + 1))}
                          className="w-8 h-8 rounded bg-white/10 text-white hover:bg-white/20 flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>
                      <p className="text-center text-xs mt-1">
                        {isComplete ? (
                          <span className="text-[var(--color-success)]">✓ Objectif atteint</span>
                        ) : (
                          <span className="text-[var(--color-text-tertiary)]">{checkins}/{goal}</span>
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-[var(--radius-lg)] p-3 mt-4">
                <p className="text-amber-400 text-sm">
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
