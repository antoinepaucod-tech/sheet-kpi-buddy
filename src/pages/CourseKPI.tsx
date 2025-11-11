import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInstructors, type Instructor } from "@/hooks/useInstructors";
import { useCourseTemplates } from "@/hooks/useCourseTemplates";
import { useScheduleTemplates, type ScheduleTemplate } from "@/hooks/useScheduleTemplates";
import { ScheduleCalendarView } from "@/components/ScheduleCalendarView";

const DAYS_OF_WEEK = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const TIME_SLOTS = ["6h30", "8h", "9h", "12h15", "18h30", "19h30"];
const COURSE_OPTIONS = [
  "Hyrox Engine",
  "Hyrox Power",
  "Hyrox Complete",
  "Hyrox Foundationnal",
  "Strengh",
  "IFRC Mobility",
  "Mobility",
  "Yoga",
];

interface CourseKPI {
  id: string;
  course_name: string;
  day_of_week: string;
  time_slot: string;
  instructor: string;
  year: number;
  month: number;
  month_name: string;
  week1_attendance: number;
  week2_attendance: number;
  week3_attendance: number;
  week4_attendance: number;
  week5_attendance: number;
  monthly_expenses: number;
  attendance_rate: number;
  max_capacity: number;
}

const CourseKPI = () => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseKPI | null>(null);
  const [isInstructorDialogOpen, setIsInstructorDialogOpen] = useState(false);
  const [editingInstructor, setEditingInstructor] = useState<Instructor | null>(null);
  const [instructorFormData, setInstructorFormData] = useState({
    name: "",
    hourly_rate: 0,
  });
  const [isCourseTemplateDialogOpen, setIsCourseTemplateDialogOpen] = useState(false);
  const [editingCourseTemplate, setEditingCourseTemplate] = useState<string | null>(null);
  const [courseTemplateName, setCourseTemplateName] = useState("");
  const [isScheduleTemplateDialogOpen, setIsScheduleTemplateDialogOpen] = useState(false);
  const [editingScheduleTemplate, setEditingScheduleTemplate] = useState<ScheduleTemplate | null>(null);
  const [scheduleTemplateFormData, setScheduleTemplateFormData] = useState({
    day_of_week: "Lundi",
    time_slot: "",
    course_name: "",
    instructor_name: "",
  });
  
  const [formData, setFormData] = useState({
    course_name: "",
    day_of_week: "Lundi",
    time_slot: "",
    instructor: "",
    max_capacity: 13,
  });

  const queryClient = useQueryClient();
  const { instructors, createInstructor, updateInstructor, deleteInstructor } = useInstructors();
  const { courseTemplates, createTemplate, updateTemplate, deleteTemplate } = useCourseTemplates();
  const { 
    scheduleTemplates, 
    createTemplate: createScheduleTemplate, 
    updateTemplate: updateScheduleTemplate, 
    deleteTemplate: deleteScheduleTemplate 
  } = useScheduleTemplates();

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["course-kpis", selectedYear, selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_kpis")
        .select("*")
        .eq("year", selectedYear)
        .eq("month", selectedMonth + 1)
        .order("day_of_week")
        .order("time_slot");

      if (error) throw error;
      return data as CourseKPI[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("course_kpis").insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-kpis"] });
      toast.success("Cours ajouté");
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<CourseKPI> & { id: string }) => {
      const { error } = await supabase
        .from("course_kpis")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-kpis"] });
      toast.success("Cours mis à jour");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("course_kpis").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-kpis"] });
      toast.success("Cours supprimé");
    },
  });

  const resetForm = () => {
    setFormData({
      course_name: "",
      day_of_week: "Lundi",
      time_slot: "",
      instructor: "",
      max_capacity: 13,
    });
    setEditingCourse(null);
  };

  const resetInstructorForm = () => {
    setInstructorFormData({
      name: "",
      hourly_rate: 0,
    });
    setEditingInstructor(null);
  };

  const calculateKPIs = () => {
    const totalCourses = courses.length;
    const totalExpenses = courses.reduce((sum, c) => sum + (c.monthly_expenses || 0), 0);
    const avgAttendance = courses.length > 0 
      ? courses.reduce((sum, c) => sum + c.attendance_rate, 0) / courses.length 
      : 0;
    const totalCapacity = courses.reduce((sum, c) => sum + c.max_capacity, 0);
    
    return {
      totalCourses,
      totalExpenses,
      avgAttendance,
      totalCapacity,
    };
  };

  const handleSubmit = () => {
    if (!formData.course_name || !formData.time_slot) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    const courseData = {
      ...formData,
      year: selectedYear,
      month: selectedMonth + 1,
      month_name: MONTHS[selectedMonth],
      week1_attendance: 0,
      week2_attendance: 0,
      week3_attendance: 0,
      week4_attendance: 0,
      week5_attendance: 0,
      monthly_expenses: 0,
      attendance_rate: 0,
    };

    if (editingCourse) {
      updateMutation.mutate({ id: editingCourse.id, ...courseData });
    } else {
      createMutation.mutate(courseData);
    }
  };

  const handleEdit = (course: CourseKPI) => {
    setEditingCourse(course);
    setFormData({
      course_name: course.course_name,
      day_of_week: course.day_of_week,
      time_slot: course.time_slot,
      instructor: course.instructor,
      max_capacity: course.max_capacity,
    });
    setIsDialogOpen(true);
  };

  const handleAttendanceUpdate = (courseId: string, week: string, value: number) => {
    const course = courses.find((c) => c.id === courseId);
    if (!course) return;

    const updates: any = { [week]: value };
    
    // Calculate attendance rate
    const weeks = [
      updates.week1_attendance ?? course.week1_attendance,
      updates.week2_attendance ?? course.week2_attendance,
      updates.week3_attendance ?? course.week3_attendance,
      updates.week4_attendance ?? course.week4_attendance,
      updates.week5_attendance ?? course.week5_attendance,
    ].filter(w => w > 0);

    const avgAttendance = weeks.length > 0 ? weeks.reduce((a, b) => a + b, 0) / weeks.length : 0;
    const rate = course.max_capacity > 0 ? (avgAttendance / course.max_capacity) * 100 : 0;
    
    updates.attendance_rate = Math.round(rate * 100) / 100;

    updateMutation.mutate({ id: courseId, ...updates });
  };

  const handleExpenseUpdate = (courseId: string, value: number) => {
    updateMutation.mutate({ id: courseId, monthly_expenses: value });
  };

  const getDefaultSchedule = () => {
    // Utiliser le planning template de la base de données
    return scheduleTemplates.map(template => {
      const instructor = instructors.find(i => i.name === template.instructor_name);
      const courseDuration = 0.75; // 45 minutes par cours
      const monthlyCost = instructor ? instructor.hourly_rate * courseDuration * 4 : 0;
      
      return {
        day: template.day_of_week,
        time: template.time_slot,
        course: template.course_name,
        instructor: template.instructor_name || "",
        monthly_expenses: monthlyCost,
      };
    });
  };

  const initializeFromTemplates = async () => {
    if (scheduleTemplates.length === 0) {
      toast.error("Veuillez d'abord configurer le planning de base");
      return;
    }

    const coursesToCreate = scheduleTemplates.map(template => {
      const instructor = instructors.find(i => i.name === template.instructor_name);
      const courseDuration = 0.75;
      const monthlyCost = instructor ? instructor.hourly_rate * courseDuration * 4 : 0;

      return {
        course_name: template.course_name,
        day_of_week: template.day_of_week,
        time_slot: template.time_slot,
        instructor: template.instructor_name || "",
        max_capacity: 13,
        year: selectedYear,
        month: selectedMonth + 1,
        month_name: MONTHS[selectedMonth],
        week1_attendance: 0,
        week2_attendance: 0,
        week3_attendance: 0,
        week4_attendance: 0,
        week5_attendance: 0,
        monthly_expenses: monthlyCost,
        attendance_rate: 0,
      };
    });

    const { error } = await supabase.from("course_kpis").insert(coursesToCreate);
    if (error) {
      toast.error("Erreur lors de l'initialisation");
      throw error;
    }
    
    queryClient.invalidateQueries({ queryKey: ["course-kpis"] });
    toast.success("Planning initialisé depuis le modèle");
  };

  const initializeScheduleMutation = useMutation({
    mutationFn: initializeFromTemplates,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-kpis"] });
    },
  });

  const groupedCourses = useMemo(() => {
    const grouped: Record<string, CourseKPI[]> = {};
    const timeOrder = ["6h30", "8h", "9h", "12h15", "18h30", "19h30"];
    
    DAYS_OF_WEEK.forEach(day => {
      grouped[day] = courses
        .filter(c => c.day_of_week === day)
        .sort((a, b) => {
          const indexA = timeOrder.indexOf(a.time_slot);
          const indexB = timeOrder.indexOf(b.time_slot);
          return indexA - indexB;
        });
    });
    return grouped;
  }, [courses]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Chargement...</div>;
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold">KPI Cours</h1>
          <div className="flex gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList>
            <TabsTrigger value="dashboard">Tableau de Bord</TabsTrigger>
            <TabsTrigger value="courses">Planning des Cours</TabsTrigger>
            <TabsTrigger value="instructors">Gestion des Instructeurs</TabsTrigger>
            <TabsTrigger value="course-templates">Gestion des Cours</TabsTrigger>
            <TabsTrigger value="schedule-templates">Planning de Base</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Total Cours</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{calculateKPIs().totalCourses}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Dépenses Totales</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">CHF {calculateKPIs().totalExpenses.toFixed(2)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Fréquentation Moyenne</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{calculateKPIs().avgAttendance.toFixed(1)}%</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Capacité Totale</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{calculateKPIs().totalCapacity}</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="course-templates" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Cours Prédéfinis</CardTitle>
                  <Dialog open={isCourseTemplateDialogOpen} onOpenChange={setIsCourseTemplateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Ajouter un cours
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Nouveau type de cours</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Nom du cours *</Label>
                          <Input
                            value={courseTemplateName}
                            onChange={(e) =>
                              setCourseTemplateName(e.target.value)
                            }
                            placeholder="Ex: Pilates"
                          />
                        </div>
                        <Button
                          onClick={() => {
                            if (!courseTemplateName) {
                              toast.error("Veuillez remplir le nom");
                              return;
                            }
                            if (editingCourseTemplate) {
                              updateTemplate.mutate({
                                id: editingCourseTemplate,
                                name: courseTemplateName,
                              });
                            } else {
                              createTemplate.mutate(courseTemplateName);
                            }
                            setIsCourseTemplateDialogOpen(false);
                            setCourseTemplateName("");
                          }}
                          className="w-full"
                        >
                          {editingCourseTemplate ? "Mettre à jour" : "Créer"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {courseTemplates.map((template) => (
                    <Card key={template.id}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <span className="font-medium">{template.name}</span>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteTemplate.mutate(template.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schedule-templates" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Planning de Base</CardTitle>
                  <Dialog open={isScheduleTemplateDialogOpen} onOpenChange={setIsScheduleTemplateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Ajouter un créneau
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          {editingScheduleTemplate ? "Modifier le créneau" : "Nouveau créneau par défaut"}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Jour *</Label>
                          <Select
                            value={scheduleTemplateFormData.day_of_week}
                            onValueChange={(value) =>
                              setScheduleTemplateFormData({ ...scheduleTemplateFormData, day_of_week: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DAYS_OF_WEEK.map((day) => (
                                <SelectItem key={day} value={day}>
                                  {day}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Horaire *</Label>
                          <Select
                            value={scheduleTemplateFormData.time_slot}
                            onValueChange={(value) =>
                              setScheduleTemplateFormData({ ...scheduleTemplateFormData, time_slot: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TIME_SLOTS.map((time) => (
                                <SelectItem key={time} value={time}>
                                  {time}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Cours *</Label>
                          <Select
                            value={scheduleTemplateFormData.course_name}
                            onValueChange={(value) =>
                              setScheduleTemplateFormData({ ...scheduleTemplateFormData, course_name: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {courseTemplates.map((template) => (
                                <SelectItem key={template.id} value={template.name}>
                                  {template.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Instructeur</Label>
                          <Select
                            value={scheduleTemplateFormData.instructor_name}
                            onValueChange={(value) =>
                              setScheduleTemplateFormData({ ...scheduleTemplateFormData, instructor_name: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {instructors.map((instructor) => (
                                <SelectItem key={instructor.id} value={instructor.name}>
                                  {instructor.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          onClick={() => {
                            if (!scheduleTemplateFormData.time_slot || !scheduleTemplateFormData.course_name) {
                              toast.error("Veuillez remplir tous les champs obligatoires");
                              return;
                            }
                            if (editingScheduleTemplate) {
                              updateScheduleTemplate.mutate({
                                id: editingScheduleTemplate.id,
                                ...scheduleTemplateFormData,
                              });
                            } else {
                              createScheduleTemplate.mutate(scheduleTemplateFormData);
                            }
                            setIsScheduleTemplateDialogOpen(false);
                            setEditingScheduleTemplate(null);
                            setScheduleTemplateFormData({
                              day_of_week: "Lundi",
                              time_slot: "",
                              course_name: "",
                              instructor_name: "",
                            });
                          }}
                          className="w-full"
                        >
                          {editingScheduleTemplate ? "Mettre à jour" : "Créer"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <ScheduleCalendarView
                  scheduleTemplates={scheduleTemplates}
                  onDelete={(id) => deleteScheduleTemplate.mutate(id)}
                  onAdd={(day, time) => {
                    setScheduleTemplateFormData({
                      day_of_week: day,
                      time_slot: time,
                      course_name: "",
                      instructor_name: "",
                    });
                    setEditingScheduleTemplate(null);
                    setIsScheduleTemplateDialogOpen(true);
                  }}
                  onEdit={(template) => {
                    setEditingScheduleTemplate(template);
                    setScheduleTemplateFormData({
                      day_of_week: template.day_of_week,
                      time_slot: template.time_slot,
                      course_name: template.course_name,
                      instructor_name: template.instructor_name || "",
                    });
                    setIsScheduleTemplateDialogOpen(true);
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="instructors" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Instructeurs</CardTitle>
                  <Dialog open={isInstructorDialogOpen} onOpenChange={setIsInstructorDialogOpen}>
                    <DialogTrigger asChild>
                      <Button onClick={resetInstructorForm}>
                        <Plus className="mr-2 h-4 w-4" />
                        Ajouter un instructeur
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          {editingInstructor ? "Modifier l'instructeur" : "Nouvel instructeur"}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Nom *</Label>
                          <Input
                            value={instructorFormData.name}
                            onChange={(e) =>
                              setInstructorFormData({ ...instructorFormData, name: e.target.value })
                            }
                            placeholder="Ex: Jennifer"
                          />
                        </div>
                        <div>
                          <Label>Salaire horaire (CHF) *</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={instructorFormData.hourly_rate}
                            onChange={(e) =>
                              setInstructorFormData({
                                ...instructorFormData,
                                hourly_rate: parseFloat(e.target.value) || 0,
                              })
                            }
                            placeholder="Ex: 50"
                          />
                        </div>
                        <Button
                          onClick={() => {
                            if (!instructorFormData.name) {
                              toast.error("Veuillez remplir tous les champs");
                              return;
                            }
                            if (editingInstructor) {
                              updateInstructor.mutate({ id: editingInstructor.id, ...instructorFormData });
                            } else {
                              createInstructor.mutate(instructorFormData);
                            }
                            setIsInstructorDialogOpen(false);
                            resetInstructorForm();
                          }}
                          className="w-full"
                        >
                          {editingInstructor ? "Mettre à jour" : "Créer"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Salaire horaire</TableHead>
                      <TableHead>Coût par cours (45min)</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {instructors.map((instructor) => (
                      <TableRow key={instructor.id}>
                        <TableCell className="font-medium">{instructor.name}</TableCell>
                        <TableCell>CHF {instructor.hourly_rate.toFixed(2)}</TableCell>
                        <TableCell>CHF {(instructor.hourly_rate * 0.75).toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingInstructor(instructor);
                                setInstructorFormData({
                                  name: instructor.name,
                                  hourly_rate: instructor.hourly_rate,
                                });
                                setIsInstructorDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteInstructor.mutate(instructor.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="courses" className="space-y-4">

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Gestion des Cours</CardTitle>
              <div className="flex gap-4 items-center">
                <div>
                  <Label>Année</Label>
                  <Select
                    value={selectedYear.toString()}
                    onValueChange={(value) => setSelectedYear(parseInt(value))}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2024, 2025, 2026].map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Mois</Label>
                  <Select
                    value={selectedMonth.toString()}
                    onValueChange={(value) => setSelectedMonth(parseInt(value))}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((month, index) => (
                        <SelectItem key={index} value={index.toString()}>
                          {month}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  {courses.length === 0 && (
                    <Button
                      onClick={() => initializeScheduleMutation.mutate()}
                      variant="secondary"
                      disabled={initializeScheduleMutation.isPending}
                    >
                      Initialiser le planning du mois
                    </Button>
                  )}
                  <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button onClick={resetForm}>
                        <Plus className="mr-2 h-4 w-4" />
                        Ajouter un cours
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingCourse ? "Modifier le cours" : "Nouveau cours"}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Nom du cours *</Label>
                        <Select
                          value={formData.course_name}
                          onValueChange={(value) =>
                            setFormData({ ...formData, course_name: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionnez un cours" />
                          </SelectTrigger>
                          <SelectContent>
                            {courseTemplates.map((template) => (
                              <SelectItem key={template.id} value={template.name}>
                                {template.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Jour de la semaine *</Label>
                        <Select
                          value={formData.day_of_week}
                          onValueChange={(value) =>
                            setFormData({ ...formData, day_of_week: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DAYS_OF_WEEK.map((day) => (
                              <SelectItem key={day} value={day}>
                                {day}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Horaire *</Label>
                        <Select
                          value={formData.time_slot}
                          onValueChange={(value) =>
                            setFormData({ ...formData, time_slot: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionnez un horaire" />
                          </SelectTrigger>
                          <SelectContent>
                            {TIME_SLOTS.map((time) => (
                              <SelectItem key={time} value={time}>
                                {time}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Instructeur</Label>
                        <Select
                          value={formData.instructor}
                          onValueChange={(value) =>
                            setFormData({ ...formData, instructor: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionnez un instructeur" />
                          </SelectTrigger>
                          <SelectContent>
                            {instructors.map((instructor) => (
                              <SelectItem key={instructor.id} value={instructor.name}>
                                {instructor.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Capacité max</Label>
                        <Input
                          type="number"
                          value={formData.max_capacity}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              max_capacity: parseInt(e.target.value),
                            })
                          }
                        />
                      </div>
                      <Button onClick={handleSubmit} className="w-full">
                        {editingCourse ? "Mettre à jour" : "Créer"}
                      </Button>
                    </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {DAYS_OF_WEEK.map((day) => {
                const dayCourses = groupedCourses[day];
                if (dayCourses.length === 0) return null;

                return (
                  <div key={day}>
                    <h3 className="text-lg font-semibold mb-3 text-primary">{day}</h3>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Horaire</TableHead>
                            <TableHead>Cours</TableHead>
                            <TableHead>Instructeur</TableHead>
                            <TableHead className="text-center">S1</TableHead>
                            <TableHead className="text-center">S2</TableHead>
                            <TableHead className="text-center">S3</TableHead>
                            <TableHead className="text-center">S4</TableHead>
                            <TableHead className="text-center">S5</TableHead>
                            <TableHead>Dépenses</TableHead>
                            <TableHead>Fréq. (%)</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dayCourses.map((course) => (
                            <TableRow key={course.id}>
                              <TableCell className="font-medium">{course.time_slot}</TableCell>
                              <TableCell>{course.course_name}</TableCell>
                              <TableCell>{course.instructor}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  value={course.week1_attendance}
                                  onChange={(e) =>
                                    handleAttendanceUpdate(
                                      course.id,
                                      "week1_attendance",
                                      parseInt(e.target.value) || 0
                                    )
                                  }
                                  className="w-16 text-center"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  value={course.week2_attendance}
                                  onChange={(e) =>
                                    handleAttendanceUpdate(
                                      course.id,
                                      "week2_attendance",
                                      parseInt(e.target.value) || 0
                                    )
                                  }
                                  className="w-16 text-center"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  value={course.week3_attendance}
                                  onChange={(e) =>
                                    handleAttendanceUpdate(
                                      course.id,
                                      "week3_attendance",
                                      parseInt(e.target.value) || 0
                                    )
                                  }
                                  className="w-16 text-center"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  value={course.week4_attendance}
                                  onChange={(e) =>
                                    handleAttendanceUpdate(
                                      course.id,
                                      "week4_attendance",
                                      parseInt(e.target.value) || 0
                                    )
                                  }
                                  className="w-16 text-center"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  value={course.week5_attendance}
                                  onChange={(e) =>
                                    handleAttendanceUpdate(
                                      course.id,
                                      "week5_attendance",
                                      parseInt(e.target.value) || 0
                                    )
                                  }
                                  className="w-16 text-center"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  value={course.monthly_expenses}
                                  onChange={(e) =>
                                    handleExpenseUpdate(
                                      course.id,
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="w-24"
                                  placeholder="CHF"
                                />
                              </TableCell>
                              <TableCell className="text-center font-medium">
                                {course.attendance_rate.toFixed(1)}%
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleEdit(course)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => deleteMutation.mutate(course.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CourseKPI;