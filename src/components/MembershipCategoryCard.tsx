import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { ChevronDown, ChevronUp, CalendarIcon, Trash2, X } from "lucide-react";
import { Member } from "@/hooks/useCustomerMembers";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

interface MembershipCategoryCardProps {
  category: string;
  members: Member[];
  totalCash: number;
  style: { bg: string; text: string; border: string };
  onMemberClick: (id: string) => void;
  onUpdateMember: (id: string, field: string, value: any) => void;
  onDeleteMember: (id: string) => void;
  membershipTypes: string[];
  getMembershipStyle: (membership: string) => { bg: string; text: string; border: string };
  getMemberEngagement?: (member: Member) => 'high' | 'medium' | 'low' | 'na';
}

export const MembershipCategoryCard = ({
  category,
  members,
  totalCash,
  style,
  onMemberClick,
  onUpdateMember,
  onDeleteMember,
  membershipTypes,
  getMembershipStyle,
  getMemberEngagement,
}: MembershipCategoryCardProps) => {
  const [isOpen, setIsOpen] = useState(true);

  // Vert = 3+ fois, Orange = 2 fois, Rouge = 0-1 fois, Gris = non suivi
  const getEngagementStyle = (engagement: 'high' | 'medium' | 'low' | 'na') => {
    switch (engagement) {
      case 'high': return 'border-l-4 border-l-green-500 bg-green-500/5';    // Vert: 3+ fois
      case 'medium': return 'border-l-4 border-l-orange-500 bg-orange-500/5'; // Orange: 2 fois
      case 'low': return 'border-l-4 border-l-red-500 bg-red-500/5';          // Rouge: 0-1 fois
      case 'na': return 'border-l-4 border-l-muted bg-muted/5';               // Gris: non suivi
      default: return '';
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden border-border/50 shadow-sm hover:shadow-md transition-shadow">
        <CollapsibleTrigger asChild>
          <div
            className={cn(
              "p-4 cursor-pointer transition-colors",
              style.bg,
              "hover:opacity-80"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
                <div>
                  <div
                    className={cn(
                      "font-semibold text-base inline-flex items-center gap-2 px-3 py-1.5 rounded-md border",
                      style.bg,
                      style.text,
                      style.border
                    )}
                  >
                    {category}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {members.length} membre{members.length > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-lg text-foreground">
                  {totalCash.toFixed(2)} CHF
                </div>
                <div className="text-xs text-muted-foreground">
                  Cash collectée
                </div>
              </div>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px] text-center">N°</TableHead>
                    <TableHead className="min-w-[150px]">Nom / Prénom</TableHead>
                    <TableHead className="min-w-[150px]">Type</TableHead>
                    <TableHead className="min-w-[150px]">Cash Collectée</TableHead>
                    <TableHead className="min-w-[180px]">Date Signature Contrat</TableHead>
                    <TableHead className="min-w-[180px]">Date de Sortie</TableHead>
                    <TableHead className="min-w-[180px]">Date de Fin d'Abonnement</TableHead>
                    <TableHead className="text-center">Onboarding Bsport</TableHead>
                    <TableHead className="text-center">Onboarding Hubfit</TableHead>
                    <TableHead className="text-center">Onboarding Nutrition</TableHead>
                    <TableHead className="text-center">Questionnaire Coaching</TableHead>
                    <TableHead className="text-center">Session Introduction Club</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member, index) => {
                    const isExited = member.exit_date && parseISO(member.exit_date) < new Date();
                    const engagement = getMemberEngagement ? getMemberEngagement(member) : 'medium';
                    return (
                      <TableRow key={member.id} className={cn(getMemberEngagement && getEngagementStyle(engagement))}>
                        <TableCell className="text-center font-medium text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <span
                            className="font-medium cursor-pointer hover:text-primary hover:underline transition-colors"
                            onClick={() => onMemberClick(member.id)}
                          >
                            {member.name}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={member.member_type || ""}
                            onValueChange={(value) =>
                              onUpdateMember(member.id, "member_type", value)
                            }
                          >
                            <SelectTrigger className="min-w-[150px]">
                              <SelectValue placeholder="Sélectionner" />
                            </SelectTrigger>
                            <SelectContent className="bg-background border shadow-lg z-50">
                              <SelectItem value="Membres Généraux Récurrents">
                                Membres Généraux Récurrents
                              </SelectItem>
                              <SelectItem value="Membres PIF">Membres PIF</SelectItem>
                              <SelectItem value="Membres PT">Membres PT</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={member.cash_collected || 0}
                            onChange={(e) =>
                              onUpdateMember(
                                member.id,
                                "cash_collected",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-[120px]"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
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
                                  selected={
                                    member.contract_signed_date
                                      ? new Date(member.contract_signed_date)
                                      : undefined
                                  }
                                  onSelect={(date) =>
                                    onUpdateMember(
                                      member.id,
                                      "contract_signed_date",
                                      date?.toISOString().split("T")[0] || null
                                    )
                                  }
                                  initialFocus
                                  className="pointer-events-auto"
                                />
                              </PopoverContent>
                            </Popover>
                            {member.contract_signed_date && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() =>
                                  onUpdateMember(member.id, "contract_signed_date", null)
                                }
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-[180px] justify-start text-left font-normal",
                                    !member.exit_date && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {member.exit_date
                                    ? format(new Date(member.exit_date), "dd/MM/yyyy")
                                    : "Sélectionner"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0 bg-background border shadow-lg z-50" align="start">
                                <Calendar
                                  mode="single"
                                  selected={member.exit_date ? new Date(member.exit_date) : undefined}
                                  onSelect={(date) =>
                                    onUpdateMember(
                                      member.id,
                                      "exit_date",
                                      date?.toISOString().split("T")[0] || null
                                    )
                                  }
                                  initialFocus
                                  className="pointer-events-auto"
                                />
                              </PopoverContent>
                            </Popover>
                            {member.exit_date && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => onUpdateMember(member.id, "exit_date", null)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-[180px] justify-start text-left font-normal",
                                    !member.subscription_end_date && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {member.subscription_end_date
                                    ? format(new Date(member.subscription_end_date), "dd/MM/yyyy")
                                    : "Sélectionner"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0 bg-background border shadow-lg z-50" align="start">
                                <Calendar
                                  mode="single"
                                  selected={
                                    member.subscription_end_date
                                      ? new Date(member.subscription_end_date)
                                      : undefined
                                  }
                                  onSelect={(date) =>
                                    onUpdateMember(
                                      member.id,
                                      "subscription_end_date",
                                      date?.toISOString().split("T")[0] || null
                                    )
                                  }
                                  initialFocus
                                  className="pointer-events-auto"
                                />
                              </PopoverContent>
                            </Popover>
                            {member.subscription_end_date && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() =>
                                  onUpdateMember(member.id, "subscription_end_date", null)
                                }
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={member.onboarding_bsport}
                            onCheckedChange={(checked) =>
                              onUpdateMember(member.id, "onboarding_bsport", checked)
                            }
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={member.onboarding_hubfit}
                            onCheckedChange={(checked) =>
                              onUpdateMember(member.id, "onboarding_hubfit", checked)
                            }
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={member.onboarding_nutrition}
                            onCheckedChange={(checked) =>
                              onUpdateMember(member.id, "onboarding_nutrition", checked)
                            }
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={member.questionnaire_coaching}
                            onCheckedChange={(checked) =>
                              onUpdateMember(member.id, "questionnaire_coaching", checked)
                            }
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={member.session_introduction}
                            onCheckedChange={(checked) =>
                              onUpdateMember(member.id, "session_introduction", checked)
                            }
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDeleteMember(member.id)}
                            className="hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
