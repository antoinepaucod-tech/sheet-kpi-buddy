import { useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Save, X } from "lucide-react";
import { useCourseKPIData, type CourseKPI } from "@/hooks/useCourseKPIData";
import { useInstructors } from "@/hooks/useInstructors";
import { ThemeToggle } from "@/components/ThemeToggle";

const MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

const DAYS_OF_WEEK = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
];

export default function KPICourses() {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<Partial<CourseKPI>>({});
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newCourse, setNewCourse] = useState<Partial<CourseKPI>>({
    day_of_week: "Lundi",
    time_slot: "09:00",
    max_capacity: 10,
    monthly_expenses: 0,
  });


  const { courses, isLoading, createCourse, updateCourse, deleteCourse } =
    useCourseKPIData(selectedYear, selectedMonth);
  
  const { instructors } = useInstructors();

  // Quick instructor change without entering edit mode
  const handleQuickInstructorChange = async (courseId: string, newInstructor: string) => {
    await updateCourse.mutateAsync({ 
      id: courseId, 
      updates: { instructor: newInstructor === "none" ? null : newInstructor } 
    });
  };


  const handleEdit = (course: CourseKPI) => {
    setEditingId(course.id);
    setEditingValues(course);
  };

  const handleSave = async (id: string) => {
    // Remove monthly_expenses from updates to force recalculation
    const { monthly_expenses, ...updatesWithoutExpenses } = editingValues;
    await updateCourse.mutateAsync({ id, updates: updatesWithoutExpenses });
    setEditingId(null);
    setEditingValues({});
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditingValues({});
  };

  const handleAddNew = async () => {
    if (!newCourse.course_name || !newCourse.time_slot) {
      return;
    }

    await createCourse.mutateAsync({
      ...newCourse,
      year: selectedYear,
      month: selectedMonth,
      month_name: MONTHS[selectedMonth - 1],
      week1_attendance: 0,
      week2_attendance: 0,
      week3_attendance: 0,
      week4_attendance: 0,
      week5_attendance: 0,
      attendance_rate: 0,
    });

    setIsAddingNew(false);
    setNewCourse({
      day_of_week: "Lundi",
      time_slot: "09:00",
      max_capacity: 10,
      monthly_expenses: 0,
    });
  };

  const groupedCourses = courses.reduce((acc, course) => {
    if (!acc[course.day_of_week]) {
      acc[course.day_of_week] = [];
    }
    acc[course.day_of_week].push(course);
    return acc;
  }, {} as Record<string, CourseKPI[]>);

  const getWeekDates = () => {
    const dates: Date[] = [];
    const year = selectedYear;
    const month = selectedMonth - 1;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let current = firstDay;
    while (current <= lastDay) {
      if (current.getDay() === 1) {
        dates.push(new Date(current));
      }
      current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
    }

    return dates.slice(0, 5);
  };

  const weekDates = getWeekDates();

  const calculateTotalExpenses = () => {
    return courses.reduce((sum, course) => sum + (Number(course.monthly_expenses) || 0), 0);
  };

  const calculateAverageAttendance = () => {
    if (courses.length === 0) return 0;
    const sum = courses.reduce((acc, course) => acc + (Number(course.attendance_rate) || 0), 0);
    return (sum / courses.length).toFixed(2);
  };

  if (isLoading) {
    return (
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <main className="flex-1 p-8">
            <div className="flex justify-center items-center h-full">
              <p className="text-muted-foreground">Chargement...</p>
            </div>
          </main>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 p-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">KPI Cours</h1>
            <ThemeToggle />
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Période</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-4">
              <Select
                value={selectedMonth.toString()}
                onValueChange={(value) => setSelectedMonth(parseInt(value))}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month, index) => (
                    <SelectItem key={month} value={(index + 1).toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={selectedYear.toString()}
                onValueChange={(value) => setSelectedYear(parseInt(value))}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027].map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Résumé</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Dépenses</p>
                <p className="text-2xl font-bold">CHF {calculateTotalExpenses().toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Taux de Fréquentation Moyen</p>
                <p className="text-2xl font-bold">{calculateAverageAttendance()}%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Nombre de Cours</p>
                <p className="text-2xl font-bold">{courses.length}</p>
              </div>
            </CardContent>
          </Card>

          {DAYS_OF_WEEK.map((day) => {
            const dayCourses = groupedCourses[day] || [];
            
            return (
              <Card key={day} className="mb-6">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>{day}</CardTitle>
                  {!isAddingNew && (
                    <Button
                      onClick={() => {
                        setNewCourse({ ...newCourse, day_of_week: day });
                        setIsAddingNew(true);
                      }}
                      size="sm"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Ajouter un cours
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Horaire</TableHead>
                        <TableHead>Cours</TableHead>
                        <TableHead>Instructeur</TableHead>
                        {weekDates.map((date, index) => (
                          <TableHead key={index} className="text-center">
                            S{index + 1}
                            <br />
                            <span className="text-xs text-muted-foreground">
                              {date.toLocaleDateString("fr-FR", {
                                day: "2-digit",
                                month: "2-digit",
                              })}
                            </span>
                          </TableHead>
                        ))}
                        <TableHead>Dépenses</TableHead>
                        <TableHead>Taux %</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dayCourses.map((course) => (
                        <TableRow key={course.id}>
                          <TableCell>
                            {editingId === course.id ? (
                              <Input
                                type="time"
                                value={editingValues.time_slot || ""}
                                onChange={(e) =>
                                  setEditingValues({
                                    ...editingValues,
                                    time_slot: e.target.value,
                                  })
                                }
                                className="w-[120px]"
                              />
                            ) : (
                              course.time_slot
                            )}
                          </TableCell>
                          <TableCell>
                            {editingId === course.id ? (
                              <Input
                                value={editingValues.course_name || ""}
                                onChange={(e) =>
                                  setEditingValues({
                                    ...editingValues,
                                    course_name: e.target.value,
                                  })
                                }
                              />
                            ) : (
                              course.course_name
                            )}
                          </TableCell>
                          <TableCell>
                            {editingId === course.id ? (
                              <Select
                                value={editingValues.instructor || "none"}
                                onValueChange={(value) =>
                                  setEditingValues({
                                    ...editingValues,
                                    instructor: value === "none" ? null : value,
                                  })
                                }
                              >
                                <SelectTrigger className="w-[150px]">
                                  <SelectValue placeholder="Sélectionner" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Aucun</SelectItem>
                                  {instructors.map((instructor) => (
                                    <SelectItem key={instructor.id} value={instructor.name}>
                                      {instructor.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Select
                                value={course.instructor || "none"}
                                onValueChange={(value) => handleQuickInstructorChange(course.id, value)}
                              >
                                <SelectTrigger className="w-[150px] border-dashed hover:border-solid">
                                  <SelectValue placeholder="Sélectionner" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Aucun</SelectItem>
                                  {instructors.map((instructor) => (
                                    <SelectItem key={instructor.id} value={instructor.name}>
                                      {instructor.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          {[1, 2, 3, 4, 5].map((weekNum) => (
                            <TableCell key={weekNum} className="text-center">
                              {editingId === course.id ? (
                                <Input
                                  type="number"
                                  min="0"
                                  value={
                                    editingValues[
                                      `week${weekNum}_attendance` as keyof CourseKPI
                                    ] || 0
                                  }
                                  onChange={(e) =>
                                    setEditingValues({
                                      ...editingValues,
                                      [`week${weekNum}_attendance`]: parseInt(
                                        e.target.value
                                      ) || 0,
                                    })
                                  }
                                  className="w-[60px] text-center"
                                />
                              ) : (
                                course[
                                  `week${weekNum}_attendance` as keyof CourseKPI
                                ] || 0
                              )}
                            </TableCell>
                          ))}
                          <TableCell>
                            {editingId === course.id ? (
                              <div className="w-[100px] text-muted-foreground">
                                {editingValues.monthly_expenses || 0} CHF
                              </div>
                            ) : (
                              `CHF ${course.monthly_expenses}`
                            )}
                          </TableCell>
                          <TableCell>
                            {Number(course.attendance_rate).toFixed(1)}%
                          </TableCell>
                          <TableCell>
                            {editingId === course.id ? (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleSave(course.id)}
                                >
                                  <Save className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={handleCancel}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
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
                                  onClick={() => deleteCourse.mutate(course.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {isAddingNew && newCourse.day_of_week === day && (
                        <TableRow>
                          <TableCell>
                            <Input
                              type="time"
                              value={newCourse.time_slot || ""}
                              onChange={(e) =>
                                setNewCourse({
                                  ...newCourse,
                                  time_slot: e.target.value,
                                })
                              }
                              className="w-[120px]"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              placeholder="Nom du cours"
                              value={newCourse.course_name || ""}
                              onChange={(e) =>
                                setNewCourse({
                                  ...newCourse,
                                  course_name: e.target.value,
                                })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={newCourse.instructor || "none"}
                              onValueChange={(value) =>
                                setNewCourse({
                                  ...newCourse,
                                  instructor: value === "none" ? undefined : value,
                                })
                              }
                            >
                              <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Sélectionner" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Aucun</SelectItem>
                                {instructors.map((instructor) => (
                                  <SelectItem key={instructor.id} value={instructor.name}>
                                    {instructor.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">
                            Remplir après création
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0"
                              value={newCourse.monthly_expenses || 0}
                              onChange={(e) =>
                                setNewCourse({
                                  ...newCourse,
                                  monthly_expenses: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="w-[100px]"
                            />
                          </TableCell>
                          <TableCell>0%</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={handleAddNew}>
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setIsAddingNew(false);
                                  setNewCourse({
                                    day_of_week: "Lundi",
                                    time_slot: "09:00",
                                    max_capacity: 10,
                                    monthly_expenses: 0,
                                  });
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </main>
      </div>
    </SidebarProvider>
  );
}
