import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  DollarSign,
  Mail,
  Phone,
  Calendar,
  Award,
  Search,
  BarChart3,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";
import { useTranslations } from "../hooks/useTranslations";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const COLOR_OPTIONS = [
  "#0A84FF", "#30D158", "#FFD60A", "#FF453A", "#64D2FF",
  "#BF5AF2", "#FF9F0A", "#AC8E68", "#FF375F", "#5E5CE6"
];

const SPECIALTIES = [
  "CrossFit", "HIIT", "Yoga", "Pilates", "Musculation", 
  "Cardio", "Boxing", "Stretching", "Functional Training", "Autre"
];

export default function CoachesPage() {
  const { lang } = useTranslations();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [selectedCoach, setSelectedCoach] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    hourly_rate: 0,
    specialties: [],
    color: "#0A84FF",
    is_active: true,
    notes: "",
  });

  // Fetch coaches
  const { data: coaches = [], isLoading } = useQuery({
    queryKey: ["coaches"],
    queryFn: () => axios.get(`${API}/coaches`).then((r) => r.data),
  });

  // Fetch coach stats when selected
  const { data: coachStats } = useQuery({
    queryKey: ["coach-stats", selectedCoach?.id],
    queryFn: () => axios.get(`${API}/coaches/${selectedCoach?.id}/stats`).then((r) => r.data),
    enabled: !!selectedCoach && statsModalOpen,
  });

  // Mutations
  const saveMutation = useMutation({
    mutationFn: (data) => 
      selectedCoach 
        ? axios.put(`${API}/coaches/${selectedCoach.id}`, data)
        : axios.post(`${API}/coaches`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["coaches"]);
      setModalOpen(false);
      resetForm();
      toast.success(selectedCoach ? "Coach mis à jour" : "Coach ajouté");
    },
    onError: (err) => toast.error(err.response?.data?.detail || "Erreur"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => axios.delete(`${API}/coaches/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(["coaches"]);
      toast.success("Coach supprimé");
    },
  });

  const resetForm = () => {
    setSelectedCoach(null);
    setFormData({
      name: "",
      email: "",
      phone: "",
      hourly_rate: 0,
      specialties: [],
      color: "#0A84FF",
      is_active: true,
      notes: "",
    });
  };

  const openEditModal = (coach) => {
    setSelectedCoach(coach);
    setFormData({
      name: coach.name || "",
      email: coach.email || "",
      phone: coach.phone || "",
      hourly_rate: coach.hourly_rate || 0,
      specialties: coach.specialties || [],
      color: coach.color || "#0A84FF",
      is_active: coach.is_active !== false,
      notes: coach.notes || "",
    });
    setModalOpen(true);
  };

  const openStatsModal = (coach) => {
    setSelectedCoach(coach);
    setStatsModalOpen(true);
  };

  const toggleSpecialty = (specialty) => {
    const current = formData.specialties || [];
    if (current.includes(specialty)) {
      setFormData({ ...formData, specialties: current.filter(s => s !== specialty) });
    } else {
      setFormData({ ...formData, specialties: [...current, specialty] });
    }
  };

  // Filter coaches
  const filteredCoaches = useMemo(() => {
    if (!search) return coaches;
    const s = search.toLowerCase();
    return coaches.filter((c) =>
      c.name?.toLowerCase().includes(s) ||
      c.email?.toLowerCase().includes(s) ||
      c.specialties?.some(sp => sp.toLowerCase().includes(s))
    );
  }, [coaches, search]);

  // Stats
  const activeCoaches = coaches.filter(c => c.is_active).length;
  const avgHourlyRate = coaches.length > 0 
    ? Math.round(coaches.reduce((sum, c) => sum + (c.hourly_rate || 0), 0) / coaches.length)
    : 0;

  return (
    <div className="space-y-6" data-testid="coaches-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="tf-page-header">
            {lang === "fr" ? "Gestion des Coachs" : "Coach Management"}
          </h1>
          <p className="tf-page-subtitle">
            {lang === "fr"
              ? "Gérez vos coachs et leurs taux horaires"
              : "Manage your coaches and their hourly rates"}
          </p>
        </div>
        <Button
          onClick={() => { resetForm(); setModalOpen(true); }}
          className="bg-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:opacity-85"
          data-testid="add-coach-btn"
        >
          <Plus size={16} className="mr-2" />
          {lang === "fr" ? "Ajouter un coach" : "Add Coach"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="tf-stat">
          <p className="tf-stat-label">Total Coachs</p>
          <p className="tf-number-large">{coaches.length}</p>
        </div>
        <div className="tf-stat">
          <p className="tf-stat-label" style={{color:"var(--color-success)"}}>Actifs</p>
          <p className="tf-number-large" style={{color:"var(--color-success)"}}>{activeCoaches}</p>
        </div>
        <div className="tf-stat">
          <p className="tf-stat-label">Taux horaire moyen</p>
          <p className="tf-number-large">{avgHourlyRate} CHF</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" size={16} />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={lang === "fr" ? "Rechercher un coach..." : "Search coach..."}
          className="pl-10 bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white"
          data-testid="coach-search"
        />
      </div>

      {/* Table */}
      <div className="tf-card overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-[var(--color-border)] hover:bg-transparent">
              <TableHead className="text-[var(--color-text-secondary)] w-8"></TableHead>
              <TableHead className="text-[var(--color-text-secondary)]">Nom</TableHead>
              <TableHead className="text-[var(--color-text-secondary)]">Contact</TableHead>
              <TableHead className="text-[var(--color-text-secondary)]">Spécialités</TableHead>
              <TableHead className="text-[var(--color-text-secondary)]">Taux horaire</TableHead>
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
            ) : filteredCoaches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-[var(--color-text-secondary)] py-8">
                  {search ? "Aucun coach trouvé" : "Aucun coach. Ajoutez votre premier coach !"}
                </TableCell>
              </TableRow>
            ) : (
              filteredCoaches.map((coach) => (
                <TableRow key={coach.id} className="border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]" data-testid={`coach-row-${coach.id}`}>
                  <TableCell>
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: coach.color || "#0A84FF" }}
                    />
                  </TableCell>
                  <TableCell className="text-white font-medium">{coach.name}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {coach.email && (
                        <p className="text-[var(--color-text-secondary)] text-sm flex items-center gap-1">
                          <Mail size={12} /> {coach.email}
                        </p>
                      )}
                      {coach.phone && (
                        <p className="text-[var(--color-text-secondary)] text-sm flex items-center gap-1">
                          <Phone size={12} /> {coach.phone}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(coach.specialties || []).slice(0, 3).map((s) => (
                        <Badge key={s} variant="secondary" className="bg-[rgba(255,255,255,0.1)] text-[var(--color-text-secondary)] border-0 text-xs">
                          {s}
                        </Badge>
                      ))}
                      {(coach.specialties || []).length > 3 && (
                        <Badge variant="secondary" className="bg-[rgba(255,255,255,0.1)] text-[var(--color-text-secondary)] border-0 text-xs">
                          +{coach.specialties.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-[var(--color-warning)] font-medium">{coach.hourly_rate || 0} CHF/h</span>
                  </TableCell>
                  <TableCell>
                    {coach.is_active ? (
                      <Badge className="bg-[rgba(48,209,88,0.15)] text-[var(--color-success)] border-0">Actif</Badge>
                    ) : (
                      <Badge variant="destructive">Inactif</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-[var(--color-accent)] hover:text-[var(--color-accent)] hover:bg-[rgba(10,132,255,0.08)]"
                        onClick={() => openStatsModal(coach)}
                        data-testid={`stats-${coach.id}`}
                      >
                        <BarChart3 size={14} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[rgba(255,255,255,0.1)]"
                        onClick={() => openEditModal(coach)}
                        data-testid={`edit-${coach.id}`}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-[var(--color-danger)] hover:text-[var(--color-danger)] hover:bg-[rgba(255,69,58,0.08)]"
                        onClick={() => {
                          if (window.confirm("Supprimer ce coach ?")) {
                            deleteMutation.mutate(coach.id);
                          }
                        }}
                        data-testid={`delete-${coach.id}`}
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

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedCoach ? "Modifier le coach" : "Nouveau coach"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="tf-stat-label">Nom *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
                placeholder="Nom du coach"
                data-testid="coach-name-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="tf-stat-label">Email</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
                />
              </div>
              <div>
                <label className="tf-stat-label">Téléphone</label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
                />
              </div>
            </div>
            <div>
              <label className="tf-stat-label">Taux horaire (CHF/h) *</label>
              <Input
                type="number"
                min={0}
                value={formData.hourly_rate}
                onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || 0 })}
                className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
                data-testid="coach-rate-input"
              />
            </div>
            <div>
              <label className="text-[var(--color-text-secondary)] text-xs uppercase mb-2 block">Spécialités</label>
              <div className="flex flex-wrap gap-2">
                {SPECIALTIES.map((specialty) => (
                  <button
                    key={specialty}
                    type="button"
                    onClick={() => toggleSpecialty(specialty)}
                    className={`px-3 py-1 rounded-full text-sm transition-all ${
                      (formData.specialties || []).includes(specialty)
                        ? "bg-[var(--color-accent)] text-white"
                        : "bg-[rgba(255,255,255,0.1)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]"
                    }`}
                  >
                    {specialty}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[var(--color-text-secondary)] text-xs uppercase mb-2 block">Couleur</label>
              <div className="flex gap-2">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      formData.color === color ? "border-white scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="tf-stat-label">Notes</label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
                placeholder="Notes (optionnel)"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-[var(--color-text-secondary)] text-sm">Actif</label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button
              onClick={() => saveMutation.mutate(formData)}
              disabled={!formData.name || saveMutation.isPending}
              className="bg-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:opacity-85"
              data-testid="save-coach-btn"
            >
              {saveMutation.isPending ? "..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats Modal */}
      <Dialog open={statsModalOpen} onOpenChange={setStatsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="text-[var(--color-accent)]" size={20} />
              Statistiques - {selectedCoach?.name}
            </DialogTitle>
          </DialogHeader>
          {coachStats && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-4 text-center">
                  <p className="tf-stat-label">Cours donnés</p>
                  <p className="tf-number-large">{coachStats.total_courses}</p>
                </div>
                <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-4 text-center">
                  <p className="tf-stat-label">Heures travaillées</p>
                  <p className="tf-number-large" style={{color:"var(--color-accent)"}}>{coachStats.total_hours}h</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-4 text-center">
                  <p className="tf-stat-label">Participants</p>
                  <p className="tf-number-large" style={{color:"var(--color-success)"}}>{coachStats.total_participants}</p>
                </div>
                <div className="tf-stat" style={{ textAlign: 'center' }}>
                  <p className="tf-stat-label" style={{color:"var(--color-accent)"}}>Gains estimés</p>
                  <p className="tf-number-large" style={{color:"var(--color-accent)"}}>{coachStats.earnings} CHF</p>
                </div>
              </div>
              <p className="text-[var(--color-text-tertiary)] text-xs text-center">
                Basé sur un taux horaire de {coachStats.hourly_rate} CHF/h
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setStatsModalOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
