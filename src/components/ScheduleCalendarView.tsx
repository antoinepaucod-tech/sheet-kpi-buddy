import { ScheduleTemplate } from "@/hooks/useScheduleTemplates";
import { Button } from "@/components/ui/button";
import { Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS_OF_WEEK = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const TIME_SLOTS_WITH_RANGES = [
  { label: "6h30 - 7h15", value: "6h30" },
  { label: "8h00 - 8h45", value: "8h" },
  { label: "9h00 - 9h45", value: "9h" },
  { label: "12h15 - 13h00", value: "12h15" },
  { label: "18h30 - 19h15", value: "18h30" },
  { label: "19h30 - 20h15", value: "19h30" },
];

interface ScheduleCalendarViewProps {
  scheduleTemplates: ScheduleTemplate[];
  onDelete: (id: string) => void;
  onAdd: (day: string, time: string) => void;
  onEdit: (template: ScheduleTemplate) => void;
}

export const ScheduleCalendarView = ({ 
  scheduleTemplates, 
  onDelete,
  onAdd,
  onEdit
}: ScheduleCalendarViewProps) => {
  
  // Organiser les cours par jour et horaire
  const getCoursesForDayAndTime = (day: string, time: string) => {
    return scheduleTemplates.filter(
      (t) => t.day_of_week === day && t.time_slot === time
    );
  };

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[1200px]">
        {/* En-tête avec les jours */}
        <div className="grid grid-cols-7 gap-2 mb-4">
          <div className="font-bold text-lg"></div>
          {DAYS_OF_WEEK.slice(0, 6).map((day) => (
            <div key={day} className="font-bold text-lg text-center text-foreground">
              {day}
            </div>
          ))}
        </div>

        {/* Grille des créneaux */}
        <div className="space-y-2">
          {TIME_SLOTS_WITH_RANGES.map((timeSlot, rowIndex) => (
            <div 
              key={timeSlot.value} 
              className={cn(
                "grid grid-cols-7 gap-2 p-4 rounded-lg",
                rowIndex % 2 === 0 ? "bg-muted/30" : "bg-muted/50"
              )}
            >
              {/* Colonne horaire */}
              <div className="font-medium text-sm flex items-center text-foreground">
                {timeSlot.label}
              </div>
              
              {/* Colonnes pour chaque jour */}
              {DAYS_OF_WEEK.slice(0, 6).map((day) => {
                const courses = getCoursesForDayAndTime(day, timeSlot.value);
                
                return (
                  <div key={day} className="flex flex-col gap-2">
                    {courses.length === 0 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-12 border-2 border-dashed border-muted-foreground/20 hover:border-primary/50"
                        onClick={() => onAdd(day, timeSlot.value)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    ) : (
                      courses.map((course) => (
                        <div
                          key={course.id}
                          className="relative group bg-black rounded-full px-4 py-3 flex items-center justify-center cursor-pointer hover:bg-black/80 transition-colors"
                          onClick={() => onEdit(course)}
                        >
                          <div className="text-center">
                            <div className="text-[#FFD700] font-bold text-xs uppercase">
                              {course.course_name.replace("Hyrox ", "")}
                            </div>
                            {course.instructor_name && (
                              <div className="text-[#FFD700]/70 text-[10px]">
                                {course.instructor_name}
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive hover:bg-destructive/90 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(course.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
