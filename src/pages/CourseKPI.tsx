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

const DAYS_OF_WEEK = ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI", "DIMANCHE"];
const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
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
  
  const [formData, setFormData] = useState({
    course_name: "",
    day_of_week: "LUNDI",
    time_slot: "",
    instructor: "",
    max_capacity: 10,
  });

  const queryClient = useQueryClient();

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
      day_of_week: "LUNDI",
      time_slot: "",
      instructor: "",
      max_capacity: 10,
    });
    setEditingCourse(null);
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

  const groupedCourses = useMemo(() => {
    const grouped: Record<string, CourseKPI[]> = {};
    DAYS_OF_WEEK.forEach(day => {
      grouped[day] = courses.filter(c => c.day_of_week === day);
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
                            {COURSE_OPTIONS.map((course) => (
                              <SelectItem key={course} value={course}>
                                {course}
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
                        <Input
                          value={formData.time_slot}
                          onChange={(e) =>
                            setFormData({ ...formData, time_slot: e.target.value })
                          }
                          placeholder="Ex: 12h30"
                        />
                      </div>
                      <div>
                        <Label>Instructeur</Label>
                        <Input
                          value={formData.instructor}
                          onChange={(e) =>
                            setFormData({ ...formData, instructor: e.target.value })
                          }
                          placeholder="Ex: Camille"
                        />
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
      </div>
    </div>
  );
};

export default CourseKPI;