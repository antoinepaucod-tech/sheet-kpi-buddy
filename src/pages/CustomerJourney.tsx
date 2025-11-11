import { useState, useMemo } from "react";
import { format, differenceInWeeks, startOfWeek, parseISO, addWeeks, startOfYear } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useTranslations } from "@/hooks/useTranslations";
import { cn } from "@/lib/utils";
import { useCustomerMembers } from "@/hooks/useCustomerMembers";
import type { Member } from "@/hooks/useCustomerMembers";

const membershipTypes = [
  "49CHF/Sem Annuel 1x",
  "29CHF/Sem Mensuel Basic",
  "59CHF/Sem Annuel 2x",
  "39CHF/Sem Mensuel Elite",
];

const CustomerJourney = () => {
  const { t } = useTranslations();
  const [newMemberName, setNewMemberName] = useState("");
  const [selectedView, setSelectedView] = useState("index");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  const {
    members,
    isLoading,
    addMember: addMemberToDb,
    updateMember: updateMemberInDb,
    deleteMember: deleteMemberFromDb,
    updateWeeklyTraining: updateWeeklyTrainingInDb,
    getWeeklyTraining,
  } = useCustomerMembers();

  // Generate week labels with dates for selected year
  const weekLabels = useMemo(() => {
    const firstMonday = startOfWeek(startOfYear(new Date(selectedYear, 0, 1)), { weekStartsOn: 1 });
    
    return Array.from({ length: 52 }, (_, i) => {
      const weekNumber = i + 1;
      const weekStart = addWeeks(firstMonday, i);
      const formattedDate = format(weekStart, "EEEE dd/MM", { locale: fr });
      return {
        value: `week-${weekNumber}`,
        label: `S${weekNumber} : ${formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)}`,
        weekStart: weekStart
      };
    });
  }, [selectedYear]);

  // Generate available years (current year - 2 to current year + 2)
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  }, []);

  const addMember = async () => {
    if (newMemberName.trim()) {
      await addMemberToDb(newMemberName, membershipTypes[0]);
      setNewMemberName("");
    }
  };

  const deleteMember = async (id: string) => {
    await deleteMemberFromDb(id);
  };

  const updateMember = async (id: string, field: string, value: any) => {
    await updateMemberInDb(id, { [field]: value });
  };

  const isOnboardingComplete = (member: Member) => {
    return (
      member.onboarding_bsport &&
      member.onboarding_hubfit &&
      member.onboarding_nutrition &&
      member.questionnaire_coaching &&
      member.session_introduction
    );
  };

  const updateWeeklyTraining = async (memberId: string, weekNumber: number, trainingsCount: number) => {
    await updateWeeklyTrainingInDb(memberId, weekNumber, trainingsCount);
  };

  const getTrainingColor = (trainings: number) => {
    switch (trainings) {
      case 3:
        return "bg-green-500/20 text-green-700 dark:text-green-400";
      case 2:
        return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400";
      case 1:
        return "bg-orange-500/20 text-orange-700 dark:text-orange-400";
      case 0:
      default:
        return "bg-red-500/20 text-red-700 dark:text-red-400";
    }
  };

  const getMemberWeekNumber = (contractDate: string | null | undefined): number | null => {
    if (!contractDate) return null;
    
    try {
      const signedDate = parseISO(contractDate);
      const today = new Date();
      const weeksSinceSignature = differenceInWeeks(
        startOfWeek(today, { weekStartsOn: 1 }),
        startOfWeek(signedDate, { weekStartsOn: 1 })
      );
      return weeksSinceSignature + 1; // +1 car la première semaine est la semaine 1, pas 0
    } catch (error) {
      return null;
    }
  };

  // Get the absolute week number for a member based on their contract date and a given calendar week
  const getAbsoluteWeekForMember = (contractDate: string | null | undefined, calendarWeekStart: Date): number | null => {
    if (!contractDate) return null;
    
    try {
      const signedDate = parseISO(contractDate);
      const weeksSinceSignature = differenceInWeeks(
        startOfWeek(calendarWeekStart, { weekStartsOn: 1 }),
        startOfWeek(signedDate, { weekStartsOn: 1 })
      );
      return weeksSinceSignature + 1;
    } catch (error) {
      return null;
    }
  };

  // Filter members to show only those whose member week matches the selected calendar week
  const getFilteredMembersForWeek = (calendarWeekStart: Date) => {
    return members.filter(member => {
      if (!member.contract_signed_date) return false;
      
      const memberWeekForThisCalendarWeek = getAbsoluteWeekForMember(member.contract_signed_date, calendarWeekStart);
      return memberWeekForThisCalendarWeek !== null && memberWeekForThisCalendarWeek > 0;
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 flex items-center justify-center">
        <p className="text-muted-foreground">Chargement des données...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Parcours Client
            </h1>
            <p className="text-muted-foreground mt-2">
              Suivez l'onboarding de vos membres
            </p>
          </div>
          <div className="flex gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>

        <Card className="p-6">
          <div className="flex gap-4 mb-6 items-center">
            <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
              <SelectTrigger className="w-[120px] bg-background z-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                {availableYears.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedView} onValueChange={setSelectedView}>
              <SelectTrigger className="w-[280px] bg-background z-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50 max-h-[300px]">
                <SelectItem value="index">Index</SelectItem>
                {weekLabels.map((week) => (
                  <SelectItem key={week.value} value={week.value}>
                    {week.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedView === "index" && (
              <>
                <Input
                  placeholder="Nom du nouveau membre"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && addMember()}
                  className="flex-1"
                />
                <Button onClick={addMember} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Ajouter
                </Button>
              </>
            )}
          </div>

          {selectedView === "index" ? (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[150px]">Nom / Prénom</TableHead>
                      <TableHead className="min-w-[200px]">Type De Membership</TableHead>
                      <TableHead className="min-w-[180px]">Date Signature Contrat</TableHead>
                      <TableHead className="text-center">Onboarding Bsport</TableHead>
                      <TableHead className="text-center">Onboarding Hubfit</TableHead>
                      <TableHead className="text-center">Onboarding Nutrition</TableHead>
                      <TableHead className="text-center">Questionnaire Coaching</TableHead>
                      <TableHead className="text-center">Session Introduction Club</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          Aucun membre pour le moment. Ajoutez-en un pour commencer.
                        </TableCell>
                      </TableRow>
                    ) : (
                      members.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell>
                            <Input
                              value={member.name}
                              onChange={(e) =>
                                updateMember(member.id, "name", e.target.value)
                              }
                              className="min-w-[150px]"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={member.membership}
                              onValueChange={(value) =>
                                updateMember(member.id, "membership", value)
                              }
                            >
                              <SelectTrigger className="min-w-[180px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-background border shadow-lg z-50">
                                {membershipTypes.map((type) => (
                                  <SelectItem key={type} value={type}>
                                    {type}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-[180px] justify-start text-left font-normal",
                                    !member.contract_signed_date && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {member.contract_signed_date
                                    ? format(new Date(member.contract_signed_date), "dd/MM/yyyy")
                                    : "Sélectionner"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0 bg-background border shadow-lg z-50" align="start">
                                <Calendar
                                  mode="single"
                                  selected={member.contract_signed_date ? new Date(member.contract_signed_date) : undefined}
                                  onSelect={(date) =>
                                    updateMember(member.id, "contract_signed_date", date?.toISOString().split('T')[0] || null)
                                  }
                                  initialFocus
                                  className="pointer-events-auto"
                                />
                              </PopoverContent>
                            </Popover>
                          </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={member.onboarding_bsport}
                            onCheckedChange={(checked) =>
                              updateMember(member.id, "onboarding_bsport", checked)
                            }
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={member.onboarding_hubfit}
                            onCheckedChange={(checked) =>
                              updateMember(member.id, "onboarding_hubfit", checked)
                            }
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={member.onboarding_nutrition}
                            onCheckedChange={(checked) =>
                              updateMember(member.id, "onboarding_nutrition", checked)
                            }
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={member.questionnaire_coaching}
                            onCheckedChange={(checked) =>
                              updateMember(member.id, "questionnaire_coaching", checked)
                            }
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={member.session_introduction}
                            onCheckedChange={(checked) =>
                              updateMember(member.id, "session_introduction", checked)
                            }
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMember(member.id)}
                            className="hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Nom / Prénom</TableHead>
                    <TableHead className="min-w-[200px]">Type De Membership</TableHead>
                    <TableHead className="text-center min-w-[120px]">Semaine Membre</TableHead>
                    <TableHead className="text-center min-w-[150px]">Onboarding Complété</TableHead>
                    <TableHead className="text-center min-w-[200px]">Entraînements cette semaine</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const weekIndex = parseInt(selectedView.replace("week-", "")) - 1;
                    const weekData = weekLabels[weekIndex];
                    if (!weekData) return null;

                    const filteredMembers = getFilteredMembersForWeek(weekData.weekStart);

                    if (filteredMembers.length === 0) {
                      return (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            Aucun membre actif pour cette semaine. Les membres ne sont affichés que pour les semaines qui correspondent à leur parcours depuis la signature du contrat.
                          </TableCell>
                        </TableRow>
                      );
                    }

                    return filteredMembers.map((member) => {
                      const week = parseInt(selectedView.replace("week-", ""));
                      const trainings = getWeeklyTraining(member.id, week);
                      const memberWeek = getAbsoluteWeekForMember(member.contract_signed_date, weekData.weekStart);
                      
                      return (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">{member.name}</TableCell>
                          <TableCell>{member.membership}</TableCell>
                          <TableCell className="text-center">
                            {memberWeek !== null && memberWeek > 0 ? (
                              <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">
                                S{memberWeek}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">Non défini</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center">
                              <Checkbox
                                checked={isOnboardingComplete(member)}
                                disabled
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-2">
                              <Select
                                value={trainings.toString()}
                                onValueChange={(value) =>
                                  updateWeeklyTraining(member.id, week, parseInt(value))
                                }
                              >
                                <SelectTrigger
                                  className={cn(
                                    "w-[120px]",
                                    getTrainingColor(trainings)
                                  )}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-background border shadow-lg z-50">
                                  <SelectItem value="0">0</SelectItem>
                                  <SelectItem value="1">1</SelectItem>
                                  <SelectItem value="2">2</SelectItem>
                                  <SelectItem value="3">3</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })()}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default CustomerJourney;
