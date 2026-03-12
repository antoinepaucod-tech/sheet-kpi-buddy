import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { format, parseISO, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ClipboardCheck,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  Weight,
  Utensils,
  Dumbbell,
  Target,
  ChevronDown,
  ChevronUp,
  Search,
  Plus,
  Eye,
  BarChart3,
  Mail,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Textarea } from "../components/ui/textarea";
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
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const REVIEW_TYPES = [
  { value: "all", label: "Tous les types" },
  { value: "monthly", label: "Mensuel" },
  { value: "quarterly", label: "Trimestriel" },
  { value: "semi-annually", label: "Semestriel" },
  { value: "annually", label: "Annuel" },
];

const TYPE_COLORS = {
  monthly: "bg-[var(--color-info)]/20 text-[var(--color-info)]",
  quarterly: "bg-[rgba(10,132,255,0.15)] text-[var(--color-accent)]",
  "semi-annually": "bg-[var(--color-info)]/20 text-[var(--color-info)]",
  annually: "bg-[rgba(100,210,255,0.15)] text-[var(--color-info)]",
};

const TYPE_LABELS = {
  monthly: "Mensuel",
  quarterly: "Trimestriel",
  "semi-annually": "Semestriel",
  annually: "Annuel",
};

export default function AnnualReviewsPage() {
  const { lang } = useTranslations();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterPeriod, setFilterPeriod] = useState("upcoming");
  const [selectedReview, setSelectedReview] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyMemberId, setHistoryMemberId] = useState(null);
  const [formData, setFormData] = useState({
    weight_start: "",
    weight_current: "",
    weight_goal: "",
    body_fat_percentage: "",
    muscle_mass: "",
    nutrition_current: "",
    nutrition_adjustments: "",
    calories_target: "",
    protein_target: "",
    current_program: "",
    program_adjustments: "",
    training_frequency: "",
    goals_achieved: "",
    new_goals: "",
    coach_notes: "",
    member_feedback: "",
    next_review_date: "",
  });

  // Fetch all annual reviews
  const { data: allReviews = [], isLoading } = useQuery({
    queryKey: ["annual-reviews"],
    queryFn: () => axios.get(`${API}/annual-reviews`).then((r) => r.data),
  });

  // Fetch upcoming reviews (30 days)
  const { data: upcomingReviews = [] } = useQuery({
    queryKey: ["annual-reviews", "upcoming"],
    queryFn: () => axios.get(`${API}/annual-reviews/upcoming?days=60`).then((r) => r.data),
  });

  // Fetch members for creating new reviews
  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: () => axios.get(`${API}/members`).then((r) => r.data),
  });

  // Fetch review history for chart
  const { data: historyData } = useQuery({
    queryKey: ["annual-reviews", "history", historyMemberId],
    queryFn: () => historyMemberId ? axios.get(`${API}/annual-reviews/history/${historyMemberId}`).then((r) => r.data) : null,
    enabled: !!historyMemberId,
  });

  // Complete review mutation
  const completeMutation = useMutation({
    mutationFn: ({ id, data }) =>
      axios.post(`${API}/annual-reviews/${id}/complete`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["annual-reviews"]);
      setModalOpen(false);
      setSelectedReview(null);
      toast.success("Bilan complété avec succès");
    },
    onError: () => toast.error("Erreur lors de la sauvegarde"),
  });

  // Create new review mutation
  const createMutation = useMutation({
    mutationFn: (data) => axios.post(`${API}/annual-reviews`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["annual-reviews"]);
      toast.success("Bilan planifié");
    },
    onError: () => toast.error("Erreur lors de la création"),
  });

  // Send review reminder
  const sendReminderMutation = useMutation({
    mutationFn: (reviewId) => axios.post(`${API}/notifications/send-review-reminder/${reviewId}`),
    onSuccess: (res) => toast.success(res.data.message),
    onError: (err) => toast.error(err.response?.data?.detail || "Erreur d'envoi"),
  });

  // Filter reviews
  const filteredReviews = useMemo(() => {
    let result = filterPeriod === "upcoming" ? upcomingReviews : allReviews;

    if (filterStatus !== "all") {
      result = result.filter((r) => r.status === filterStatus);
    }

    if (filterType !== "all") {
      result = result.filter((r) => (r.review_type || "annually") === filterType);
    }

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.member_name?.toLowerCase().includes(s) ||
          r.member_email?.toLowerCase().includes(s)
      );
    }

    return result;
  }, [allReviews, upcomingReviews, filterPeriod, filterStatus, filterType, search]);

  // Stats
  const stats = useMemo(() => {
    const today = new Date();
    const scheduled = allReviews.filter((r) => r.status === "scheduled");
    const completed = allReviews.filter((r) => r.status === "completed");
    const missed = allReviews.filter((r) => {
      if (r.status !== "scheduled") return false;
      const reviewDate = parseISO(r.review_date);
      return reviewDate < today;
    });
    const next7Days = scheduled.filter((r) => {
      const days = differenceInDays(parseISO(r.review_date), today);
      return days >= 0 && days <= 7;
    });
    const next30Days = scheduled.filter((r) => {
      const days = differenceInDays(parseISO(r.review_date), today);
      return days >= 0 && days <= 30;
    });

    return {
      total: allReviews.length,
      scheduled: scheduled.length,
      completed: completed.length,
      missed: missed.length,
      next7Days: next7Days.length,
      next30Days: next30Days.length,
    };
  }, [allReviews]);

  const openCompleteModal = (review) => {
    setSelectedReview(review);
    setFormData({
      weight_start: review.weight_start || "",
      weight_current: review.weight_current || "",
      weight_goal: review.weight_goal || "",
      body_fat_percentage: review.body_fat_percentage || "",
      muscle_mass: review.muscle_mass || "",
      nutrition_current: review.nutrition_current || "",
      nutrition_adjustments: review.nutrition_adjustments || "",
      calories_target: review.calories_target || "",
      protein_target: review.protein_target || "",
      current_program: review.current_program || "",
      program_adjustments: review.program_adjustments || "",
      training_frequency: review.training_frequency || "",
      goals_achieved: review.goals_achieved || "",
      new_goals: review.new_goals || "",
      coach_notes: review.coach_notes || "",
      member_feedback: review.member_feedback || "",
      next_review_date: "",
    });
    setModalOpen(true);
  };

  const openDetailModal = (review) => {
    setSelectedReview(review);
    setDetailModalOpen(true);
  };

  const getStatusBadge = (review) => {
    const today = new Date();
    const reviewDate = parseISO(review.review_date);
    const days = differenceInDays(reviewDate, today);

    if (review.status === "completed") {
      return (
        <Badge className="bg-[rgba(48,209,88,0.15)] text-[var(--color-success)] border-0">
          <CheckCircle2 size={12} className="mr-1" />
          Complété
        </Badge>
      );
    }

    if (review.status === "missed" || days < 0) {
      return (
        <Badge variant="destructive">
          <AlertTriangle size={12} className="mr-1" />
          En retard
        </Badge>
      );
    }

    if (days <= 7) {
      return (
        <Badge className="bg-[rgba(255,214,10,0.15)] text-[var(--color-warning)] border-0">
          <Clock size={12} className="mr-1" />
          Dans {days}j
        </Badge>
      );
    }

    if (days <= 30) {
      return (
        <Badge className="bg-[rgba(10,132,255,0.15)] text-[var(--color-accent)] border-0">
          <Calendar size={12} className="mr-1" />
          Dans {days}j
        </Badge>
      );
    }

    return (
      <Badge variant="secondary" className="bg-[rgba(255,255,255,0.1)] text-white/60 border-0">
        Planifié
      </Badge>
    );
  };

  return (
    <div className="space-y-6" data-testid="annual-reviews-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="tf-page-header">
            {lang === "fr" ? "Bilans / Suivis" : "Reviews"}
          </h1>
          <p className="tf-page-subtitle">
            {lang === "fr"
              ? "Suivi poids, nutrition et programme - mensuel, trimestriel, semestriel, annuel"
              : "Weight, nutrition and training tracking - monthly, quarterly, semi-annual, annual"}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div
          className={`bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-4 border cursor-pointer transition-colors ${
            filterPeriod === "upcoming" ? "border-[var(--color-info)]" : "border-[var(--color-border)] hover:border-[var(--color-info)]/50"
          }`}
          onClick={() => setFilterPeriod("upcoming")}
          data-testid="filter-upcoming"
        >
          <p className="text-[var(--color-info)] text-xs uppercase flex items-center gap-1">
            <Clock size={12} />
            À venir (60j)
          </p>
          <p className="text-2xl font-mono font-bold text-[var(--color-info)]">{stats.next30Days}</p>
        </div>
        <div
          className={`bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-4 border cursor-pointer transition-colors ${
            filterPeriod === "all" && filterStatus === "all" ? "border-white/30" : "border-[var(--color-border)] hover:border-white/30"
          }`}
          onClick={() => { setFilterPeriod("all"); setFilterStatus("all"); }}
        >
          <p className="text-[var(--color-text-secondary)] tf-label inline">Total</p>
          <p className="text-2xl font-mono font-bold text-white">{stats.total}</p>
        </div>
        <div
          className={`bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-4 border cursor-pointer transition-colors ${
            filterStatus === "scheduled" ? "border-[var(--color-accent)]" : "border-[var(--color-border)] hover:border-[var(--color-accent)]/50"
          }`}
          onClick={() => { setFilterPeriod("all"); setFilterStatus("scheduled"); }}
        >
          <p className="text-[var(--color-accent)] text-xs uppercase">Planifiés</p>
          <p className="text-2xl font-mono font-bold text-[var(--color-accent)]">{stats.scheduled}</p>
        </div>
        <div
          className={`bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-4 border cursor-pointer transition-colors ${
            filterStatus === "completed" ? "border-[var(--color-success)]" : "border-[var(--color-border)] hover:border-[var(--color-success)]/50"
          }`}
          onClick={() => { setFilterPeriod("all"); setFilterStatus("completed"); }}
        >
          <p className="text-[var(--color-success)] text-xs uppercase">Complétés</p>
          <p className="text-2xl font-mono font-bold text-[var(--color-success)]">{stats.completed}</p>
        </div>
        <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-4 border border-[var(--color-warning)]/30">
          <p className="text-[var(--color-warning)] text-xs uppercase flex items-center gap-1">
            <AlertTriangle size={12} />
            Cette semaine
          </p>
          <p className="text-2xl font-mono font-bold text-[var(--color-warning)]">{stats.next7Days}</p>
        </div>
        <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-4 border border-[rgba(255,69,58,0.3)]">
          <p className="text-[var(--color-danger)] text-xs uppercase flex items-center gap-1">
            <AlertTriangle size={12} />
            En retard
          </p>
          <p className="text-2xl font-mono font-bold text-[var(--color-danger)]">{stats.missed}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" size={16} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === "fr" ? "Rechercher un membre..." : "Search member..."}
            className="pl-10 bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white"
            data-testid="review-search"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px] bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white" data-testid="status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
            <SelectItem value="all" className="text-white">Tous les statuts</SelectItem>
            <SelectItem value="scheduled" className="text-white">Planifiés</SelectItem>
            <SelectItem value="completed" className="text-white">Complétés</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px] bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white" data-testid="type-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
            {REVIEW_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value} className="text-white">{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] border border-[var(--color-border)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-[var(--color-border)] hover:bg-transparent">
              <TableHead className="text-[var(--color-text-secondary)]">Membre</TableHead>
              <TableHead className="text-[var(--color-text-secondary)]">Type</TableHead>
              <TableHead className="text-[var(--color-text-secondary)]">Date du bilan</TableHead>
              <TableHead className="text-[var(--color-text-secondary)]">Statut</TableHead>
              <TableHead className="text-[var(--color-text-secondary)]">Évolution poids</TableHead>
              <TableHead className="text-[var(--color-text-secondary)] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-[var(--color-text-secondary)] py-8">
                  Chargement...
                </TableCell>
              </TableRow>
            ) : filteredReviews.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-[var(--color-text-secondary)] py-8">
                  Aucun bilan trouvé
                </TableCell>
              </TableRow>
            ) : (
              filteredReviews.map((review) => (
                <TableRow
                  key={review.id}
                  className="border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]"
                  data-testid={`review-row-${review.id}`}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[rgba(100,210,255,0.15)] flex items-center justify-center">
                        <User size={14} className="text-[var(--color-info)]" />
                      </div>
                      <div>
                        <p className="text-white font-medium">{review.member_name}</p>
                        <p className="text-[var(--color-text-secondary)] text-xs">{review.member_email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`border-0 ${TYPE_COLORS[review.review_type] || TYPE_COLORS.annually}`}>
                      {TYPE_LABELS[review.review_type] || "Annuel"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-white/70">
                    {format(parseISO(review.review_date), "dd MMMM yyyy", { locale: fr })}
                  </TableCell>
                  <TableCell>{getStatusBadge(review)}</TableCell>
                  <TableCell>
                    {review.status === "completed" && review.weight_change != null ? (
                      <span className={review.weight_change > 0 ? "text-[var(--color-danger)]" : "text-[var(--color-success)]"}>
                        {review.weight_change > 0 ? "+" : ""}{review.weight_change} kg
                      </span>
                    ) : (
                      <span className="text-[var(--color-text-tertiary)]">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {review.status === "completed" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-[var(--color-accent)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10"
                          onClick={() => openDetailModal(review)}
                          data-testid={`view-${review.id}`}
                        >
                          <Eye size={14} className="mr-1" />
                          Voir
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="bg-[var(--color-info)] hover:bg-[var(--color-info)] hover:opacity-85"
                          onClick={() => openCompleteModal(review)}
                          data-testid={`complete-${review.id}`}
                        >
                          <CheckCircle2 size={14} className="mr-1" />
                          Compléter
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-[var(--color-accent)] hover:text-[var(--color-accent)]"
                        onClick={() => {
                          setHistoryMemberId(review.member_id);
                          setHistoryModalOpen(true);
                        }}
                        title="Historique"
                        data-testid={`history-${review.id}`}
                      >
                        <BarChart3 size={14} />
                      </Button>
                      {review.status === "scheduled" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-[var(--color-warning)] hover:text-[var(--color-warning)]"
                          onClick={() => sendReminderMutation.mutate(review.id)}
                          disabled={sendReminderMutation.isPending}
                          title="Envoyer rappel"
                          data-testid={`reminder-${review.id}`}
                        >
                          <Mail size={14} />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Complete Review Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="text-[var(--color-info)]" size={20} />
              Compléter le bilan
            </DialogTitle>
          </DialogHeader>
          {selectedReview && (
            <div className="space-y-6 py-4">
              {/* Member info */}
              <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-4">
                <p className="text-white font-medium">{selectedReview.member_name}</p>
                <p className="text-[var(--color-text-secondary)] text-sm">
                  Bilan prévu le: {format(parseISO(selectedReview.review_date), "dd MMMM yyyy", { locale: fr })}
                </p>
              </div>

              {/* Weight Section */}
              <div>
                <h3 className="text-white/70 text-sm font-medium flex items-center gap-2 mb-3">
                  <Weight size={16} className="text-[var(--color-accent)]" />
                  Suivi du poids
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-[var(--color-text-secondary)] text-xs">Poids début (kg)</label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.weight_start}
                      onChange={(e) => setFormData({ ...formData, weight_start: e.target.value })}
                      className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
                      data-testid="weight-start"
                    />
                  </div>
                  <div>
                    <label className="text-[var(--color-text-secondary)] text-xs">Poids actuel (kg)</label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.weight_current}
                      onChange={(e) => setFormData({ ...formData, weight_current: e.target.value })}
                      className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
                      data-testid="weight-current"
                    />
                  </div>
                  <div>
                    <label className="text-[var(--color-text-secondary)] text-xs">Objectif (kg)</label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.weight_goal}
                      onChange={(e) => setFormData({ ...formData, weight_goal: e.target.value })}
                      className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
                      data-testid="weight-goal"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <label className="text-[var(--color-text-secondary)] text-xs">% masse grasse</label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.body_fat_percentage}
                      onChange={(e) => setFormData({ ...formData, body_fat_percentage: e.target.value })}
                      className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[var(--color-text-secondary)] text-xs">Masse musculaire (kg)</label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.muscle_mass}
                      onChange={(e) => setFormData({ ...formData, muscle_mass: e.target.value })}
                      className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Nutrition Section */}
              <div>
                <h3 className="text-white/70 text-sm font-medium flex items-center gap-2 mb-3">
                  <Utensils size={16} className="text-[var(--color-success)]" />
                  Nutrition
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-[var(--color-text-secondary)] text-xs">Régime actuel</label>
                    <Textarea
                      value={formData.nutrition_current}
                      onChange={(e) => setFormData({ ...formData, nutrition_current: e.target.value })}
                      className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1 min-h-[60px]"
                      placeholder="Décrivez le régime alimentaire actuel..."
                    />
                  </div>
                  <div>
                    <label className="text-[var(--color-text-secondary)] text-xs">Ajustements recommandés</label>
                    <Textarea
                      value={formData.nutrition_adjustments}
                      onChange={(e) => setFormData({ ...formData, nutrition_adjustments: e.target.value })}
                      className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1 min-h-[60px]"
                      placeholder="Modifications à apporter..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[var(--color-text-secondary)] text-xs">Objectif calories/jour</label>
                      <Input
                        type="number"
                        value={formData.calories_target}
                        onChange={(e) => setFormData({ ...formData, calories_target: e.target.value })}
                        className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[var(--color-text-secondary)] text-xs">Objectif protéines (g/jour)</label>
                      <Input
                        type="number"
                        value={formData.protein_target}
                        onChange={(e) => setFormData({ ...formData, protein_target: e.target.value })}
                        className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Program Section */}
              <div>
                <h3 className="text-white/70 text-sm font-medium flex items-center gap-2 mb-3">
                  <Dumbbell size={16} className="text-[var(--color-warning)]" />
                  Programme d'entraînement
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-[var(--color-text-secondary)] text-xs">Programme actuel</label>
                    <Textarea
                      value={formData.current_program}
                      onChange={(e) => setFormData({ ...formData, current_program: e.target.value })}
                      className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1 min-h-[60px]"
                      placeholder="Décrivez le programme actuel..."
                    />
                  </div>
                  <div>
                    <label className="text-[var(--color-text-secondary)] text-xs">Modifications du programme</label>
                    <Textarea
                      value={formData.program_adjustments}
                      onChange={(e) => setFormData({ ...formData, program_adjustments: e.target.value })}
                      className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1 min-h-[60px]"
                      placeholder="Ajustements à apporter..."
                    />
                  </div>
                  <div>
                    <label className="text-[var(--color-text-secondary)] text-xs">Fréquence recommandée (séances/semaine)</label>
                    <Input
                      type="number"
                      value={formData.training_frequency}
                      onChange={(e) => setFormData({ ...formData, training_frequency: e.target.value })}
                      className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1 w-32"
                    />
                  </div>
                </div>
              </div>

              {/* Goals Section */}
              <div>
                <h3 className="text-white/70 text-sm font-medium flex items-center gap-2 mb-3">
                  <Target size={16} className="text-[var(--color-info)]" />
                  Objectifs
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-[var(--color-text-secondary)] text-xs">Objectifs atteints</label>
                    <Textarea
                      value={formData.goals_achieved}
                      onChange={(e) => setFormData({ ...formData, goals_achieved: e.target.value })}
                      className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1 min-h-[60px]"
                      placeholder="Quels objectifs ont été atteints..."
                    />
                  </div>
                  <div>
                    <label className="text-[var(--color-text-secondary)] text-xs">Nouveaux objectifs</label>
                    <Textarea
                      value={formData.new_goals}
                      onChange={(e) => setFormData({ ...formData, new_goals: e.target.value })}
                      className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1 min-h-[60px]"
                      placeholder="Objectifs pour la prochaine année..."
                    />
                  </div>
                </div>
              </div>

              {/* Notes Section */}
              <div>
                <h3 className="text-white/70 text-sm font-medium mb-3">Notes</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-[var(--color-text-secondary)] text-xs">Notes du coach</label>
                    <Textarea
                      value={formData.coach_notes}
                      onChange={(e) => setFormData({ ...formData, coach_notes: e.target.value })}
                      className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1 min-h-[60px]"
                    />
                  </div>
                  <div>
                    <label className="text-[var(--color-text-secondary)] text-xs">Retour du membre</label>
                    <Textarea
                      value={formData.member_feedback}
                      onChange={(e) => setFormData({ ...formData, member_feedback: e.target.value })}
                      className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1 min-h-[60px]"
                    />
                  </div>
                </div>
              </div>

              {/* Next Review */}
              <div className="border-t border-[var(--color-border)] pt-4">
                <label className="text-[var(--color-text-secondary)] text-xs">Prochain bilan (optionnel)</label>
                <Input
                  type="date"
                  value={formData.next_review_date}
                  onChange={(e) => setFormData({ ...formData, next_review_date: e.target.value })}
                  className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1 w-48"
                />
                <p className="text-[var(--color-text-tertiary)] text-xs mt-1">
                  Si renseigné, un nouveau bilan sera planifié automatiquement
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                const payload = {};
                Object.entries(formData).forEach(([key, value]) => {
                  if (value !== "" && value !== null) {
                    if (["weight_start", "weight_current", "weight_goal", "body_fat_percentage", "muscle_mass"].includes(key)) {
                      payload[key] = parseFloat(value);
                    } else if (["calories_target", "protein_target", "training_frequency"].includes(key)) {
                      payload[key] = parseInt(value);
                    } else {
                      payload[key] = value;
                    }
                  }
                });
                completeMutation.mutate({ id: selectedReview?.id, data: payload });
              }}
              disabled={completeMutation.isPending}
              className="bg-[var(--color-info)] hover:bg-[var(--color-info)] hover:opacity-85"
              data-testid="save-review-btn"
            >
              {completeMutation.isPending ? "..." : "Compléter le bilan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail View Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="text-[var(--color-success)]" size={20} />
              Détail du bilan
            </DialogTitle>
          </DialogHeader>
          {selectedReview && (
            <div className="space-y-6 py-4">
              {/* Member info */}
              <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-4 flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">{selectedReview.member_name}</p>
                  <p className="text-[var(--color-text-secondary)] text-sm">
                    Complété le: {selectedReview.completed_date && format(parseISO(selectedReview.completed_date), "dd MMMM yyyy", { locale: fr })}
                  </p>
                </div>
                <Badge className="bg-[rgba(48,209,88,0.15)] text-[var(--color-success)] border-0">
                  <CheckCircle2 size={12} className="mr-1" />
                  Complété
                </Badge>
              </div>

              {/* Weight Summary */}
              {(selectedReview.weight_start || selectedReview.weight_current) && (
                <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-4">
                  <h3 className="text-white/70 text-sm font-medium flex items-center gap-2 mb-3">
                    <Weight size={16} className="text-[var(--color-accent)]" />
                    Évolution du poids
                  </h3>
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div>
                      <p className="text-[var(--color-text-secondary)] text-xs">Début</p>
                      <p className="text-xl font-bold text-white">{selectedReview.weight_start || "-"} kg</p>
                    </div>
                    <div>
                      <p className="text-[var(--color-text-secondary)] text-xs">Actuel</p>
                      <p className="text-xl font-bold text-white">{selectedReview.weight_current || "-"} kg</p>
                    </div>
                    <div>
                      <p className="text-[var(--color-text-secondary)] text-xs">Objectif</p>
                      <p className="text-xl font-bold text-white">{selectedReview.weight_goal || "-"} kg</p>
                    </div>
                    <div>
                      <p className="text-[var(--color-text-secondary)] text-xs">Variation</p>
                      <p className={`text-xl font-bold ${selectedReview.weight_change > 0 ? "text-[var(--color-danger)]" : "text-[var(--color-success)]"}`}>
                        {selectedReview.weight_change > 0 ? "+" : ""}{selectedReview.weight_change || 0} kg
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Nutrition */}
              {(selectedReview.nutrition_current || selectedReview.nutrition_adjustments) && (
                <div>
                  <h3 className="text-white/70 text-sm font-medium flex items-center gap-2 mb-2">
                    <Utensils size={16} className="text-[var(--color-success)]" />
                    Nutrition
                  </h3>
                  {selectedReview.nutrition_current && (
                    <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-3 mb-2">
                      <p className="text-[var(--color-text-secondary)] text-xs mb-1">Régime actuel</p>
                      <p className="text-white/80 text-sm">{selectedReview.nutrition_current}</p>
                    </div>
                  )}
                  {selectedReview.nutrition_adjustments && (
                    <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-3">
                      <p className="text-[var(--color-text-secondary)] text-xs mb-1">Ajustements</p>
                      <p className="text-white/80 text-sm">{selectedReview.nutrition_adjustments}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Program */}
              {(selectedReview.current_program || selectedReview.program_adjustments) && (
                <div>
                  <h3 className="text-white/70 text-sm font-medium flex items-center gap-2 mb-2">
                    <Dumbbell size={16} className="text-[var(--color-warning)]" />
                    Programme
                  </h3>
                  {selectedReview.current_program && (
                    <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-3 mb-2">
                      <p className="text-[var(--color-text-secondary)] text-xs mb-1">Programme</p>
                      <p className="text-white/80 text-sm">{selectedReview.current_program}</p>
                    </div>
                  )}
                  {selectedReview.program_adjustments && (
                    <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-3">
                      <p className="text-[var(--color-text-secondary)] text-xs mb-1">Modifications</p>
                      <p className="text-white/80 text-sm">{selectedReview.program_adjustments}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Goals */}
              {(selectedReview.goals_achieved || selectedReview.new_goals) && (
                <div>
                  <h3 className="text-white/70 text-sm font-medium flex items-center gap-2 mb-2">
                    <Target size={16} className="text-[var(--color-info)]" />
                    Objectifs
                  </h3>
                  {selectedReview.goals_achieved && (
                    <div className="bg-[var(--color-success)]/10 border border-[var(--color-success)]/20 rounded-[var(--radius-lg)] p-3 mb-2">
                      <p className="text-[var(--color-success)] text-xs mb-1">Objectifs atteints</p>
                      <p className="text-white/80 text-sm">{selectedReview.goals_achieved}</p>
                    </div>
                  )}
                  {selectedReview.new_goals && (
                    <div className="bg-[var(--color-info)]/10 border border-[var(--color-info)]/20 rounded-[var(--radius-lg)] p-3">
                      <p className="text-[var(--color-info)] text-xs mb-1">Nouveaux objectifs</p>
                      <p className="text-white/80 text-sm">{selectedReview.new_goals}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              {(selectedReview.coach_notes || selectedReview.member_feedback) && (
                <div>
                  <h3 className="text-white/70 text-sm font-medium mb-2">Notes</h3>
                  {selectedReview.coach_notes && (
                    <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-3 mb-2">
                      <p className="text-[var(--color-text-secondary)] text-xs mb-1">Notes du coach</p>
                      <p className="text-white/80 text-sm">{selectedReview.coach_notes}</p>
                    </div>
                  )}
                  {selectedReview.member_feedback && (
                    <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-3">
                      <p className="text-[var(--color-text-secondary)] text-xs mb-1">Retour du membre</p>
                      <p className="text-white/80 text-sm">{selectedReview.member_feedback}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDetailModalOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Chart Modal */}
      <Dialog open={historyModalOpen} onOpenChange={(open) => { setHistoryModalOpen(open); if (!open) setHistoryMemberId(null); }}>
        <DialogContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="text-[var(--color-accent)]" size={20} />
              Historique des bilans - {historyData?.member_name}
            </DialogTitle>
          </DialogHeader>
          {historyData?.reviews?.length > 0 ? (
            <div className="space-y-6 py-4">
              {/* Weight Chart */}
              <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-4">
                <h3 className="text-white/70 text-sm font-medium mb-3">Evolution du poids (kg)</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={historyData.reviews.filter(r => r.weight_current).map(r => ({
                    date: r.review_date ? format(parseISO(r.review_date), "MMM yy", { locale: fr }) : "",
                    poids: r.weight_current,
                    objectif: r.weight_goal,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="date" stroke="#666" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#666" tick={{ fontSize: 11 }} domain={["dataMin - 2", "dataMax + 2"]} />
                    <Tooltip contentStyle={{ backgroundColor: "#1C1C1E", border: "1px solid #333", borderRadius: 8 }} />
                    <Legend />
                    <Line type="monotone" dataKey="poids" stroke="#64D2FF" strokeWidth={2} dot={{ fill: "#64D2FF", r: 4 }} name="Poids actuel" />
                    <Line type="monotone" dataKey="objectif" stroke="#30D158" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: "#30D158", r: 3 }} name="Objectif" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Body Composition Chart */}
              {historyData.reviews.some(r => r.body_fat_percentage || r.muscle_mass) && (
                <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-4">
                  <h3 className="text-white/70 text-sm font-medium mb-3">Composition corporelle</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={historyData.reviews.filter(r => r.body_fat_percentage || r.muscle_mass).map(r => ({
                      date: r.review_date ? format(parseISO(r.review_date), "MMM yy", { locale: fr }) : "",
                      graisse: r.body_fat_percentage,
                      muscle: r.muscle_mass,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="date" stroke="#666" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#666" tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: "#1C1C1E", border: "1px solid #333", borderRadius: 8 }} />
                      <Legend />
                      <Line type="monotone" dataKey="graisse" stroke="#FFD60A" strokeWidth={2} dot={{ fill: "#FFD60A", r: 4 }} name="% Graisse" />
                      <Line type="monotone" dataKey="muscle" stroke="#0A84FF" strokeWidth={2} dot={{ fill: "#0A84FF", r: 4 }} name="Masse musculaire" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Training Frequency */}
              {historyData.reviews.some(r => r.training_frequency) && (
                <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-4">
                  <h3 className="text-white/70 text-sm font-medium mb-3">Fréquence d'entraînement (séances/semaine)</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={historyData.reviews.filter(r => r.training_frequency).map(r => ({
                      date: r.review_date ? format(parseISO(r.review_date), "MMM yy", { locale: fr }) : "",
                      freq: parseFloat(r.training_frequency) || 0,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="date" stroke="#666" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#666" tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: "#1C1C1E", border: "1px solid #333", borderRadius: 8 }} />
                      <Line type="monotone" dataKey="freq" stroke="#30D158" strokeWidth={2} dot={{ fill: "#30D158", r: 4 }} name="Séances/semaine" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Summary Table */}
              <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-4">
                <h3 className="text-white/70 text-sm font-medium mb-3">Résumé des bilans</h3>
                <Table>
                  <TableHeader>
                    <TableRow className="border-[var(--color-border)]">
                      <TableHead className="text-[var(--color-text-secondary)]">Date</TableHead>
                      <TableHead className="text-[var(--color-text-secondary)]">Poids</TableHead>
                      <TableHead className="text-[var(--color-text-secondary)]">Variation</TableHead>
                      <TableHead className="text-[var(--color-text-secondary)]">Objectif</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyData.reviews.map((r) => (
                      <TableRow key={r.id} className="border-white/5">
                        <TableCell className="text-white/70 text-sm">
                          {r.review_date ? format(parseISO(r.review_date), "dd MMM yyyy", { locale: fr }) : "-"}
                        </TableCell>
                        <TableCell className="text-white font-medium">{r.weight_current || "-"} kg</TableCell>
                        <TableCell className={`text-sm ${r.weight_change < 0 ? "text-[var(--color-success)]" : r.weight_change > 0 ? "text-[var(--color-danger)]" : "text-[var(--color-text-secondary)]"}`}>
                          {r.weight_change ? `${r.weight_change > 0 ? "+" : ""}${r.weight_change} kg` : "-"}
                        </TableCell>
                        <TableCell className="text-[var(--color-text-secondary)] text-sm">{r.weight_goal || "-"} kg</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-[var(--color-text-secondary)]">
              Aucun bilan complété trouvé pour ce membre.
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setHistoryModalOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
