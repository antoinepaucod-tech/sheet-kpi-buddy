import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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
import { ChevronDown, ChevronUp, CalendarIcon, Trash2, Users, Link2 } from "lucide-react";
import { Member } from "@/hooks/useCustomerMembers";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { OnboardingProgressBar } from "@/components/OnboardingProgressBar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  getMemberEngagement?: (member: Member) => 'high' | 'medium' | 'low' | 'at-risk' | 'none';
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
  const [isOpen, setIsOpen] = useState(false);

  // Calculate engagement counts for the header
  const engagementCounts = useMemo(() => {
    if (!getMemberEngagement) return null;
    
    const counts = { high: 0, medium: 0, low: 0, 'at-risk': 0 };
    members.forEach(member => {
      const engagement = getMemberEngagement(member);
      if (engagement !== 'none' && counts[engagement] !== undefined) {
        counts[engagement]++;
      }
    });
    return counts;
  }, [members, getMemberEngagement]);

  const getEngagementStyle = (engagement: 'high' | 'medium' | 'low' | 'at-risk' | 'none') => {
    switch (engagement) {
      case 'high': return 'border-l-4 border-l-green-500 bg-green-500/5';
      case 'medium': return 'border-l-4 border-l-yellow-500 bg-yellow-500/5';
      case 'low': return 'border-l-4 border-l-orange-500 bg-orange-500/5';
      case 'at-risk': return 'border-l-4 border-l-red-500 bg-red-500/5';
      case 'none': return ''; // No engagement styling for members without tracking
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
                <div className="flex-1">
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
                  <div className="flex items-center gap-2 mt-1.5">
                    <p className="text-xs text-muted-foreground">
                      {members.length} membre{members.length > 1 ? "s" : ""}
                    </p>
                    {engagementCounts && (engagementCounts.high > 0 || engagementCounts.medium > 0 || engagementCounts.low > 0 || engagementCounts['at-risk'] > 0) && (
                      <div className="flex items-center gap-1.5 text-xs">
                        {engagementCounts.high > 0 && (
                          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-green-500/20 text-green-600 dark:text-green-400">
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                            {engagementCounts.high}
                          </span>
                        )}
                        {engagementCounts.medium > 0 && (
                          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-600 dark:text-yellow-400">
                            <span className="w-2 h-2 rounded-full bg-yellow-500" />
                            {engagementCounts.medium}
                          </span>
                        )}
                        {engagementCounts.low > 0 && (
                          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-600 dark:text-orange-400">
                            <span className="w-2 h-2 rounded-full bg-orange-500" />
                            {engagementCounts.low}
                          </span>
                        )}
                        {engagementCounts['at-risk'] > 0 && (
                          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-500/20 text-red-600 dark:text-red-400">
                            <span className="w-2 h-2 rounded-full bg-red-500" />
                            {engagementCounts['at-risk']}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
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
                    <TableHead className="min-w-[120px]">Onboarding</TableHead>
                    <TableHead className="min-w-[150px]">Type</TableHead>
                    <TableHead className="min-w-[120px]">Cash</TableHead>
                    <TableHead className="min-w-[140px]">Date Contrat</TableHead>
                    <TableHead className="min-w-[140px]">Fin Abo.</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {members.map((member, index) => {
                    const isExited = member.exit_date && parseISO(member.exit_date) < new Date();
                    const engagement = getMemberEngagement ? getMemberEngagement(member) : 'none';
                    const isDuoMember = !!member.subscription_group_id;
                    const isPrimary = member.is_primary_subscriber;
                    
                    // Find linked member for duo subscriptions
                    const linkedMember = isDuoMember 
                      ? members.find(m => m.subscription_group_id === member.subscription_group_id && m.id !== member.id)
                      : null;
                    
                    return (
                      <TableRow key={member.id} className={cn(getMemberEngagement && engagement !== 'none' && getEngagementStyle(engagement))}>
                        <TableCell className="text-center font-medium text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span
                              className="font-medium cursor-pointer hover:text-primary hover:underline transition-colors"
                              onClick={() => onMemberClick(member.id)}
                            >
                              {member.name}
                            </span>
                            {isDuoMember && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge 
                                      variant={isPrimary ? "default" : "secondary"} 
                                      className="gap-1 text-xs py-0 px-1.5 cursor-help"
                                    >
                                      <Users className="h-3 w-3" />
                                      {isPrimary ? "Duo" : "Lié"}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>
                                      {isPrimary 
                                        ? `Membre principal duo${linkedMember ? ` (avec ${linkedMember.name})` : ''}`
                                        : `Membre secondaire${linkedMember ? ` (lié à ${linkedMember.name})` : ''} - Pas de revenu comptabilisé`
                                      }
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </TableCell>
                        {/* Onboarding Progress Bar */}
                        <TableCell>
                          <OnboardingProgressBar
                            steps={[
                              { label: "Bsport", completed: member.onboarding_bsport },
                              { label: "Hubfit", completed: member.onboarding_hubfit },
                              { label: "Nutrition", completed: member.onboarding_nutrition },
                              { label: "Questionnaire", completed: member.questionnaire_coaching },
                              { label: "Session Intro", completed: member.session_introduction },
                            ]}
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={member.member_type || ""}
                            onValueChange={(value) =>
                              onUpdateMember(member.id, "member_type", value)
                            }
                          >
                            <SelectTrigger className="min-w-[140px]">
                              <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent className="bg-background border shadow-lg z-50">
                              <SelectItem value="Membres Généraux Récurrents">
                                Récurrents
                              </SelectItem>
                              <SelectItem value="Membres PIF">PIF</SelectItem>
                              <SelectItem value="Membres PT">PT</SelectItem>
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
                            className="w-[100px]"
                          />
                        </TableCell>
                        <TableCell>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className={cn(
                                  "w-[120px] justify-start text-left font-normal text-xs",
                                  !member.contract_signed_date && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-1 h-3 w-3" />
                                {member.contract_signed_date
                                  ? format(new Date(member.contract_signed_date), "dd/MM/yy")
                                  : "Date"}
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
                        </TableCell>
                        <TableCell>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className={cn(
                                  "w-[120px] justify-start text-left font-normal text-xs",
                                  !member.subscription_end_date && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-1 h-3 w-3" />
                                {member.subscription_end_date
                                  ? format(new Date(member.subscription_end_date), "dd/MM/yy")
                                  : "Date"}
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
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDeleteMember(member.id)}
                            className="hover:bg-destructive/10 hover:text-destructive h-8 w-8"
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
