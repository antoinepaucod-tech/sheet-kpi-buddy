import { useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ScrollArea,
  ScrollBar,
} from "@/components/ui/scroll-area";
import { Plus, Trash2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useTranslations } from "@/hooks/useTranslations";
import { cn } from "@/lib/utils";

interface Member {
  id: string;
  name: string;
  membership: string;
  onboardingBsport: boolean;
  onboardingHubfit: boolean;
  onboardingNutrition: boolean;
  questionnaireCoaching: boolean;
  sessionIntroduction: boolean;
}

interface WeeklyTraining {
  memberId: string;
  week: number;
  trainings: number;
}

const membershipTypes = [
  "49CHF/Sem Annuel 1x",
  "29CHF/Sem Mensuel Basic",
  "59CHF/Sem Annuel 2x",
  "39CHF/Sem Mensuel Elite",
];

const CustomerJourney = () => {
  const { t } = useTranslations();
  const [members, setMembers] = useState<Member[]>([]);
  const [newMemberName, setNewMemberName] = useState("");
  const [weeklyTrainings, setWeeklyTrainings] = useState<WeeklyTraining[]>([]);
  const [activeTab, setActiveTab] = useState("index");

  const addMember = () => {
    if (newMemberName.trim()) {
      const newMember: Member = {
        id: crypto.randomUUID(),
        name: newMemberName,
        membership: membershipTypes[0],
        onboardingBsport: false,
        onboardingHubfit: false,
        onboardingNutrition: false,
        questionnaireCoaching: false,
        sessionIntroduction: false,
      };
      setMembers([...members, newMember]);
      setNewMemberName("");
    }
  };

  const deleteMember = (id: string) => {
    setMembers(members.filter((m) => m.id !== id));
  };

  const updateMember = (id: string, field: keyof Member, value: any) => {
    setMembers(
      members.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const isOnboardingComplete = (member: Member) => {
    return (
      member.onboardingBsport &&
      member.onboardingHubfit &&
      member.onboardingNutrition &&
      member.questionnaireCoaching &&
      member.sessionIntroduction
    );
  };

  const getWeeklyTraining = (memberId: string, week: number): number => {
    const training = weeklyTrainings.find(
      (wt) => wt.memberId === memberId && wt.week === week
    );
    return training?.trainings ?? 0;
  };

  const updateWeeklyTraining = (memberId: string, week: number, trainings: number) => {
    setWeeklyTrainings((prev) => {
      const existing = prev.find(
        (wt) => wt.memberId === memberId && wt.week === week
      );
      if (existing) {
        return prev.map((wt) =>
          wt.memberId === memberId && wt.week === week
            ? { ...wt, trainings }
            : wt
        );
      } else {
        return [...prev, { memberId, week, trainings }];
      }
    });
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
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <ScrollArea className="w-full whitespace-nowrap">
              <TabsList className="inline-flex h-10 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground mb-6">
                <TabsTrigger value="index">Index</TabsTrigger>
                {Array.from({ length: 52 }, (_, i) => i + 1).map((week) => (
                  <TabsTrigger key={week} value={`week-${week}`}>
                    Semaine {week}
                  </TabsTrigger>
                ))}
              </TabsList>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>

            <TabsContent value="index" className="mt-0">
              <div className="flex gap-4 mb-6">
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
              </div>

              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[150px]">Nom / Prénom</TableHead>
                      <TableHead className="min-w-[200px]">Type De Membership</TableHead>
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
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
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
                              <SelectContent>
                                {membershipTypes.map((type) => (
                                  <SelectItem key={type} value={type}>
                                    {type}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={member.onboardingBsport}
                              onCheckedChange={(checked) =>
                                updateMember(member.id, "onboardingBsport", checked)
                              }
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={member.onboardingHubfit}
                              onCheckedChange={(checked) =>
                                updateMember(member.id, "onboardingHubfit", checked)
                              }
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={member.onboardingNutrition}
                              onCheckedChange={(checked) =>
                                updateMember(member.id, "onboardingNutrition", checked)
                              }
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={member.questionnaireCoaching}
                              onCheckedChange={(checked) =>
                                updateMember(member.id, "questionnaireCoaching", checked)
                              }
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={member.sessionIntroduction}
                              onCheckedChange={(checked) =>
                                updateMember(member.id, "sessionIntroduction", checked)
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
            </TabsContent>

            {Array.from({ length: 52 }, (_, i) => i + 1).map((week) => (
              <TabsContent key={week} value={`week-${week}`} className="mt-0">
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Nom / Prénom</TableHead>
                        <TableHead className="min-w-[200px]">Type De Membership</TableHead>
                        <TableHead className="text-center min-w-[150px]">Onboarding Complété</TableHead>
                        <TableHead className="text-center min-w-[200px]">Entraînements cette semaine</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            Aucun membre dans l'Index. Ajoutez des membres dans l'onglet Index.
                          </TableCell>
                        </TableRow>
                      ) : (
                        members.map((member) => {
                          const trainings = getWeeklyTraining(member.id, week);
                          return (
                            <TableRow key={member.id}>
                              <TableCell className="font-medium">{member.name}</TableCell>
                              <TableCell>{member.membership}</TableCell>
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
                                    <SelectContent>
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
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </Card>
      </div>
    </div>
  );
};

export default CustomerJourney;
