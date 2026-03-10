import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  CalendarDays,
  Plus,
  Clock,
  Users,
  TrendingUp,
  Trash2,
  Edit,
  User,
  DollarSign,
  Copy,
  RefreshCw,
  UserCog,
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
import { Progress } from "../components/ui/progress";
import { toast } from "sonner";
import { useTranslations } from "../hooks/useTranslations";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DAYS_FR = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const MONTHS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

const TIME_SLOTS = [
  "06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "18:30",
  "19:00", "19:30", "20:00", "21:00"
];

export default function CoursesPage() {
  const { lang } = useTranslations();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedDay, setSelectedDay] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [replaceModalOpen, setReplaceModalOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [formData, setFormData] = useState({
    year: currentYear,
    month: currentMonth,
    day_of_week: "Lundi",
    time_slot: "07:00",
    course_name: "",
    coach_id: "",
    instructor_name: "",
    max_capacity: 12,
  });
  const [replaceData, setReplaceData] = useState({
    replacement_coach_id: "",
    date: "",
    reason: "",
  });

  // Fetch courses
  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["courses", selectedYear, selectedMonth],
    queryFn: () =>
      axios.get(`${API}/courses?year=${selectedYear}&month=${selectedMonth}`).then((r) => r.data),
  });

  // Fetch coaches
  const { data: coaches = [] } = useQuery({
    queryKey: ["coaches", "active"],
    queryFn: () => axios.get(`${API}/coaches?active_only=true`).then((r) => r.data),
  });

  // Fetch instructors (legacy)
  const { data: instructors = [] } = useQuery({
    queryKey: ["instructors"],
    queryFn: () => axios.get(`${API}/instructors?active_only=true`).then((r) => r.data),
  });

  // Fetch summary
  const { data: summary } = useQuery({
    queryKey: ["courses", "summary", selectedYear, selectedMonth],
    queryFn: () =>
      axios.get(`${API}/courses/summary/${selectedYear}/${selectedMonth}`).then((r) => r.data),
  });

  // Create course
  const createMutation = useMutation({
    mutationFn: (data) => axios.post(`${API}/courses`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["courses"]);
      setModalOpen(false);
      toast.success("Cours ajouté");
    },
    onError: () => toast.error("Erreur"),
  });

  // Update course
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => axios.put(`${API}/courses/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["courses"]);
      setEditModalOpen(false);
      toast.success("Cours mis à jour");
    },
    onError: () => toast.error("Erreur"),
  });

  // Delete course
  const deleteMutation = useMutation({
    mutationFn: (id) => axios.delete(`${API}/courses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(["courses"]);
      toast.success("Cours supprimé");
    },
  });

  // Copy planning from previous month
  const copyPlanningMutation = useMutation({
    mutationFn: () => axios.post(`${API}/courses/copy-planning/${selectedYear}/${selectedMonth}`),
    onSuccess: (res) => {
      queryClient.invalidateQueries(["courses"]);
      toast.success(res.data.message);
    },
    onError: (err) => toast.error(err.response?.data?.detail || "Erreur lors de la copie"),
  });

  // Create coach replacement
  const replaceMutation = useMutation({
    mutationFn: (data) => axios.post(`${API}/coaches/replacements/`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["courses"]);
      setReplaceModalOpen(false);
      toast.success("Remplacement enregistré");
    },
    onError: () => toast.error("Erreur"),
  });

  // Filter courses
  const filteredCourses = useMemo(() => {
    if (selectedDay === "all") return courses;
    return courses.filter((c) => c.day_of_week === selectedDay);
  }, [courses, selectedDay]);

  // Group by day
  const coursesByDay = useMemo(() => {
    const grouped = {};
    DAYS_FR.forEach((day) => {
      grouped[day] = filteredCourses.filter((c) => c.day_of_week === day);
    });
    return grouped;
  }, [filteredCourses]);

  const openAddModal = () => {
    setFormData({
      year: selectedYear,
      month: selectedMonth,
      day_of_week: "Lundi",
      time_slot: "07:00",
      course_name: "",
      coach_id: coaches[0]?.id || "",
      instructor_name: coaches[0]?.name || instructors[0]?.name || "",
      max_capacity: 12,
    });
    setModalOpen(true);
  };

  const openEditModal = (course) => {
    setSelectedCourse(course);
    setEditModalOpen(true);
  };

  const openReplaceModal = (course) => {
    setSelectedCourse(course);
    setReplaceData({
      replacement_coach_id: "",
      date: new Date().toISOString().split('T')[0],
      reason: "",
    });
    setReplaceModalOpen(true);
  };

  // Get coach name by id
  const getCoachName = (coachId) => {
    const coach = coaches.find(c => c.id === coachId);
    return coach?.name || "";
  };

  const handleAttendanceChange = (course, week, value) => {
    updateMutation.mutate({
      id: course.id,
      data: { [`week${week}_attendance`]: parseInt(value) || 0 },
    });
  };

  const getAttendanceColor = (rate) => {
    if (rate >= 80) return "text-emerald-400";
    if (rate >= 60) return "text-amber-400";
    return "text-red-400";
  };

  return (
    <div className="space-y-6" data-testid="courses-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <CalendarDays className="text-blue-500" />
            {lang === "fr" ? "KPIs des Cours" : "Course KPIs"}
          </h1>
          <p className="text-white/50 text-sm mt-1">
            {lang === "fr" ? "Fréquentation et statistiques par cours" : "Attendance and statistics per course"}
          </p>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={() => copyPlanningMutation.mutate()}
            disabled={copyPlanningMutation.isPending || courses.length > 0}
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10"
            data-testid="copy-planning-btn"
          >
            <Copy size={16} className="mr-2" />
            {copyPlanningMutation.isPending ? "..." : "Copier mois précédent"}
          </Button>
          <Button onClick={openAddModal} className="bg-blue-600 hover:bg-blue-700" data-testid="add-course-btn">
            <Plus size={16} className="mr-2" />
            {lang === "fr" ? "Ajouter un cours" : "Add course"}
          </Button>
        </div>
      </div>

      {/* Info banner if no courses */}
      {courses.length === 0 && !isLoading && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <p className="text-blue-400 text-sm">
            Aucun cours pour {MONTHS_FR[selectedMonth - 1]} {selectedYear}. 
            <button 
              onClick={() => copyPlanningMutation.mutate()}
              className="underline ml-1 hover:text-blue-300"
            >
              Copier le planning du mois précédent
            </button>
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
          <SelectTrigger className="w-[120px] bg-[#1C1C1E] border-white/10 text-white" data-testid="year-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#1C1C1E] border-white/10">
            {[2023, 2024, 2025].map((y) => (
              <SelectItem key={y} value={y.toString()} className="text-white">{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
          <SelectTrigger className="w-[150px] bg-[#1C1C1E] border-white/10 text-white" data-testid="month-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#1C1C1E] border-white/10">
            {MONTHS_FR.map((m, i) => (
              <SelectItem key={i} value={(i + 1).toString()} className="text-white">{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedDay} onValueChange={setSelectedDay}>
          <SelectTrigger className="w-[150px] bg-[#1C1C1E] border-white/10 text-white" data-testid="day-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#1C1C1E] border-white/10">
            <SelectItem value="all" className="text-white">Tous les jours</SelectItem>
            {DAYS_FR.map((d) => (
              <SelectItem key={d} value={d} className="text-white">{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#1C1C1E] rounded-lg p-4 border border-white/10">
            <p className="text-white/50 text-xs uppercase flex items-center gap-1">
              <CalendarDays size={12} /> Total Cours
            </p>
            <p className="text-2xl font-bold text-white">{summary.total_courses}</p>
          </div>
          <div className="bg-[#1C1C1E] rounded-lg p-4 border border-white/10">
            <p className="text-white/50 text-xs uppercase flex items-center gap-1">
              <TrendingUp size={12} /> Taux moyen
            </p>
            <p className={`text-2xl font-bold ${getAttendanceColor(summary.avg_attendance_rate)}`}>
              {summary.avg_attendance_rate}%
            </p>
          </div>
          <div className="bg-[#1C1C1E] rounded-lg p-4 border border-white/10">
            <p className="text-white/50 text-xs uppercase flex items-center gap-1">
              <DollarSign size={12} /> Dépenses
            </p>
            <p className="text-2xl font-bold text-white">
              {summary.total_expenses?.toLocaleString("fr-CH")} CHF
            </p>
          </div>
          <div className="bg-[#1C1C1E] rounded-lg p-4 border border-white/10">
            <p className="text-white/50 text-xs uppercase">Mois</p>
            <p className="text-xl font-bold text-blue-400">{summary.month_name} {selectedYear}</p>
          </div>
        </div>
      )}

      {/* Courses Table */}
      <div className="bg-[#1C1C1E] rounded-lg border border-white/10 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="text-white/50">Jour</TableHead>
              <TableHead className="text-white/50">Horaire</TableHead>
              <TableHead className="text-white/50">Cours</TableHead>
              <TableHead className="text-white/50">Coach</TableHead>
              <TableHead className="text-white/50">Cap.</TableHead>
              <TableHead className="text-white/50 text-center">S1</TableHead>
              <TableHead className="text-white/50 text-center">S2</TableHead>
              <TableHead className="text-white/50 text-center">S3</TableHead>
              <TableHead className="text-white/50 text-center">S4</TableHead>
              <TableHead className="text-white/50 text-center">S5</TableHead>
              <TableHead className="text-white/50">Taux</TableHead>
              <TableHead className="text-white/50 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center text-white/50 py-8">
                  Chargement...
                </TableCell>
              </TableRow>
            ) : filteredCourses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center text-white/50 py-8">
                  Aucun cours pour cette période
                </TableCell>
              </TableRow>
            ) : (
              filteredCourses.map((course) => (
                <TableRow
                  key={course.id}
                  className="border-white/10 hover:bg-white/5"
                  data-testid={`course-row-${course.id}`}
                >
                  <TableCell>
                    <Badge variant="outline" className="border-white/20 text-white/70">
                      {course.day_of_week}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-white flex items-center gap-1">
                    <Clock size={12} className="text-white/40" />
                    {course.time_slot}
                  </TableCell>
                  <TableCell className="text-white font-medium">{course.course_name}</TableCell>
                  <TableCell className="text-white/70 flex items-center gap-1">
                    <User size={12} className="text-white/40" />
                    {course.instructor || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-blue-500/20 text-blue-400 border-0">
                      <Users size={10} className="mr-1" />
                      {course.max_capacity}
                    </Badge>
                  </TableCell>
                  {[1, 2, 3, 4, 5].map((week) => (
                    <TableCell key={week} className="text-center">
                      <Input
                        type="number"
                        min="0"
                        max={course.max_capacity}
                        value={course[`week${week}_attendance`] || 0}
                        onChange={(e) => handleAttendanceChange(course, week, e.target.value)}
                        className="w-12 h-8 text-center bg-[#121214] border-white/10 text-white p-1"
                        data-testid={`attendance-w${week}-${course.id}`}
                      />
                    </TableCell>
                  ))}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={course.attendance_rate} className="w-16 h-2 bg-white/10" />
                      <span className={`text-sm font-medium ${getAttendanceColor(course.attendance_rate)}`}>
                        {course.attendance_rate}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openReplaceModal(course)}
                        className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                        title="Remplacer le coach"
                      >
                        <UserCog size={14} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditModal(course)}
                        className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                      >
                        <Edit size={14} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(course.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
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

      {/* Day Summary */}
      {selectedDay === "all" && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {DAYS_FR.map((day) => (
            <div
              key={day}
              className="bg-[#1C1C1E] rounded-lg p-4 border border-white/10 cursor-pointer hover:border-blue-500/50 transition-colors"
              onClick={() => setSelectedDay(day)}
            >
              <p className="text-white/50 text-xs uppercase">{day}</p>
              <p className="text-xl font-bold text-white">{coursesByDay[day]?.length || 0}</p>
              <p className="text-white/40 text-xs">cours</p>
            </div>
          ))}
        </div>
      )}

      {/* Add Course Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-[#1C1C1E] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Ajouter un cours</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-white/50 text-xs uppercase">Nom du cours *</label>
              <Input
                value={formData.course_name}
                onChange={(e) => setFormData({ ...formData, course_name: e.target.value })}
                placeholder="Ex: CrossFit Morning"
                className="bg-[#121214] border-white/10 text-white mt-1"
                data-testid="course-name-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-white/50 text-xs uppercase">Jour</label>
                <Select value={formData.day_of_week} onValueChange={(v) => setFormData({ ...formData, day_of_week: v })}>
                  <SelectTrigger className="bg-[#121214] border-white/10 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1C1C1E] border-white/10">
                    {DAYS_FR.map((d) => (
                      <SelectItem key={d} value={d} className="text-white">{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-white/50 text-xs uppercase">Horaire</label>
                <Select value={formData.time_slot} onValueChange={(v) => setFormData({ ...formData, time_slot: v })}>
                  <SelectTrigger className="bg-[#121214] border-white/10 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1C1C1E] border-white/10">
                    {TIME_SLOTS.map((t) => (
                      <SelectItem key={t} value={t} className="text-white">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-white/50 text-xs uppercase">Coach *</label>
                <Select 
                  value={formData.coach_id} 
                  onValueChange={(v) => {
                    const coach = coaches.find(c => c.id === v);
                    setFormData({ 
                      ...formData, 
                      coach_id: v,
                      instructor_name: coach?.name || ""
                    });
                  }}
                >
                  <SelectTrigger className="bg-[#121214] border-white/10 text-white mt-1">
                    <SelectValue placeholder="Sélectionner un coach..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1C1C1E] border-white/10">
                    {coaches.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-white">
                        {c.name} ({c.hourly_rate} CHF/h)
                      </SelectItem>
                    ))}
                    {coaches.length === 0 && instructors.map((i) => (
                      <SelectItem key={i.id} value={i.id} className="text-white">{i.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-white/50 text-xs uppercase">Capacité max</label>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={formData.max_capacity}
                  onChange={(e) => setFormData({ ...formData, max_capacity: parseInt(e.target.value) || 12 })}
                  className="bg-[#121214] border-white/10 text-white mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button
              onClick={() => createMutation.mutate(formData)}
              disabled={!formData.course_name || createMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="save-course-btn"
            >
              {createMutation.isPending ? "..." : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Course Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="bg-[#1C1C1E] border-white/10 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modifier le cours</DialogTitle>
          </DialogHeader>
          {selectedCourse && (
            <div className="space-y-4 py-4">
              <div className="bg-[#121214] rounded-lg p-4">
                <div className="flex items-center gap-4">
                  <Badge className="bg-blue-500/20 text-blue-400 border-0">{selectedCourse.day_of_week}</Badge>
                  <span className="text-white">{selectedCourse.time_slot}</span>
                  <span className="text-white font-medium">{selectedCourse.course_name}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-white/50 text-xs uppercase">Instructeur</label>
                  <Select
                    value={selectedCourse.instructor || ""}
                    onValueChange={(v) => updateMutation.mutate({ id: selectedCourse.id, data: { instructor: v } })}
                  >
                    <SelectTrigger className="bg-[#121214] border-white/10 text-white mt-1">
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1C1C1E] border-white/10">
                      {instructors.map((i) => (
                        <SelectItem key={i.id} value={i.name} className="text-white">{i.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-white/50 text-xs uppercase">Capacité max</label>
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    defaultValue={selectedCourse.max_capacity}
                    onBlur={(e) => updateMutation.mutate({ id: selectedCourse.id, data: { max_capacity: parseInt(e.target.value) || 12 } })}
                    className="bg-[#121214] border-white/10 text-white mt-1"
                  />
                </div>
              </div>
              <div>
                <label className="text-white/50 text-xs uppercase">Dépenses mensuelles (CHF)</label>
                <Input
                  type="number"
                  min="0"
                  defaultValue={selectedCourse.monthly_expenses || 0}
                  onBlur={(e) => updateMutation.mutate({ id: selectedCourse.id, data: { monthly_expenses: parseFloat(e.target.value) || 0 } })}
                  className="bg-[#121214] border-white/10 text-white mt-1"
                />
              </div>
              <div>
                <label className="text-white/50 text-xs uppercase mb-2 block">Fréquentation par semaine</label>
                <div className="grid grid-cols-5 gap-3">
                  {[1, 2, 3, 4, 5].map((week) => (
                    <div key={week} className="text-center">
                      <p className="text-white/40 text-xs mb-1">Semaine {week}</p>
                      <Input
                        type="number"
                        min="0"
                        max={selectedCourse.max_capacity}
                        defaultValue={selectedCourse[`week${week}_attendance`] || 0}
                        onBlur={(e) => handleAttendanceChange(selectedCourse, week, e.target.value)}
                        className="bg-[#121214] border-white/10 text-white text-center"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditModalOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Replace Coach Modal */}
      <Dialog open={replaceModalOpen} onOpenChange={setReplaceModalOpen}>
        <DialogContent className="bg-[#1C1C1E] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="text-orange-400" size={20} />
              Remplacer le coach
            </DialogTitle>
          </DialogHeader>
          {selectedCourse && (
            <div className="space-y-4 py-4">
              <div className="bg-[#121214] rounded-lg p-3">
                <p className="text-white font-medium">{selectedCourse.course_name}</p>
                <p className="text-white/50 text-sm">
                  {selectedCourse.day_of_week} à {selectedCourse.time_slot}
                </p>
                <p className="text-white/40 text-sm mt-1">
                  Coach actuel : {selectedCourse.instructor || selectedCourse.instructor_name || getCoachName(selectedCourse.coach_id) || "-"}
                </p>
              </div>
              <div>
                <label className="text-white/50 text-xs uppercase">Coach de remplacement *</label>
                <Select 
                  value={replaceData.replacement_coach_id} 
                  onValueChange={(v) => setReplaceData({ ...replaceData, replacement_coach_id: v })}
                >
                  <SelectTrigger className="bg-[#121214] border-white/10 text-white mt-1">
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1C1C1E] border-white/10">
                    {coaches.filter(c => c.id !== selectedCourse.coach_id).map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-white">
                        {c.name} ({c.hourly_rate} CHF/h)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-white/50 text-xs uppercase">Date du remplacement *</label>
                <Input
                  type="date"
                  value={replaceData.date}
                  onChange={(e) => setReplaceData({ ...replaceData, date: e.target.value })}
                  className="bg-[#121214] border-white/10 text-white mt-1"
                />
              </div>
              <div>
                <label className="text-white/50 text-xs uppercase">Raison</label>
                <Select 
                  value={replaceData.reason} 
                  onValueChange={(v) => setReplaceData({ ...replaceData, reason: v })}
                >
                  <SelectTrigger className="bg-[#121214] border-white/10 text-white mt-1">
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1C1C1E] border-white/10">
                    <SelectItem value="maladie" className="text-white">Maladie</SelectItem>
                    <SelectItem value="absence" className="text-white">Absence</SelectItem>
                    <SelectItem value="conge" className="text-white">Congé</SelectItem>
                    <SelectItem value="autre" className="text-white">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReplaceModalOpen(false)}>Annuler</Button>
            <Button
              onClick={() => {
                replaceMutation.mutate({
                  course_id: selectedCourse?.id,
                  original_coach_id: selectedCourse?.coach_id || "",
                  replacement_coach_id: replaceData.replacement_coach_id,
                  date: replaceData.date,
                  reason: replaceData.reason,
                });
              }}
              disabled={!replaceData.replacement_coach_id || !replaceData.date || replaceMutation.isPending}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {replaceMutation.isPending ? "..." : "Confirmer le remplacement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
