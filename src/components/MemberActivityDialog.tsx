import { useState, useMemo } from "react";
import { parseISO, format, addWeeks, startOfWeek, differenceInWeeks, differenceInMonths, addMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink, MessageSquare, CheckCircle2, Trash2, RefreshCw, Calendar, Pencil, Save, X } from "lucide-react";
import { useMemberHistory } from "@/hooks/useMemberHistory";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Member, WeeklyTraining } from "@/hooks/useCustomerMembers";

interface MemberActivityDialogProps {
  member: Member | null;
  weeklyTrainings: WeeklyTraining[];
  onClose: () => void;
  onNavigateToWeek?: (week: number, year: number, memberId: string) => void;
  onMemberUpdated?: () => void;
}

export function MemberActivityDialog({ 
  member, 
  weeklyTrainings, 
  onClose,
  onNavigateToWeek,
  onMemberUpdated
}: MemberActivityDialogProps) {
  // Check member first, before any hooks
  if (!member) return null;

  const [newComment, setNewComment] = useState("");
  const [renewalMonths, setRenewalMonths] = useState("12");
  const [isRenewing, setIsRenewing] = useState(false);
  const [isEditingEndDate, setIsEditingEndDate] = useState(false);
  const [editedEndDate, setEditedEndDate] = useState(member.subscription_end_date || "");
  const [isSavingEndDate, setIsSavingEndDate] = useState(false);
  const { comments, history, isLoading: historyLoading, addComment, deleteComment } = useMemberHistory(member.id);

  const handleSaveEndDate = async () => {
    if (!editedEndDate) {
      toast.error("Veuillez saisir une date valide");
      return;
    }

    setIsSavingEndDate(true);
    try {
      const { error } = await supabase
        .from('customer_members')
        .update({
          subscription_end_date: editedEndDate,
          exit_date: editedEndDate,
        })
        .eq('id', member.id);

      if (error) throw error;

      toast.success("Date de fin mise à jour");
      setIsEditingEndDate(false);
      
      if (onMemberUpdated) {
        onMemberUpdated();
      }
    } catch (error) {
      console.error('Error updating end date:', error);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setIsSavingEndDate(false);
    }
  };

  // Check if subscription is near expiration or expired
  const subscriptionStatus = useMemo(() => {
    if (!member.subscription_end_date) return null;
    
    const endDate = parseISO(member.subscription_end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const daysUntilExpiration = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiration < 0) {
      return { status: 'expired', days: Math.abs(daysUntilExpiration), date: endDate };
    } else if (daysUntilExpiration <= 30) {
      return { status: 'expiring_soon', days: daysUntilExpiration, date: endDate };
    }
    return { status: 'active', days: daysUntilExpiration, date: endDate };
  }, [member.subscription_end_date]);

  const handleRenewSubscription = async () => {
    if (!member.subscription_end_date) {
      toast.error("Ce membre n'a pas de date de fin d'abonnement définie");
      return;
    }

    setIsRenewing(true);
    try {
      const currentEndDate = parseISO(member.subscription_end_date);
      const today = new Date();
      
      // Calculate new end date: from current end date (or today if expired) + renewal months
      const baseDate = currentEndDate > today ? currentEndDate : today;
      const newEndDate = addMonths(baseDate, parseInt(renewalMonths));
      
      // Update the member's subscription_end_date and exit_date
      const { error: updateError } = await supabase
        .from('customer_members')
        .update({
          subscription_end_date: format(newEndDate, "yyyy-MM-dd"),
          exit_date: format(newEndDate, "yyyy-MM-dd"),
        })
        .eq('id', member.id);

      if (updateError) throw updateError;

      // Create a new accounting transaction for the renewal
      const renewalDate = new Date();
      const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
      
      // Determine product description based on member type
      let productDescription = "Revenu EFT Général";
      if (member.member_type === "Membres PT") {
        productDescription = "Revenu PT";
      } else if (member.member_type === "Membres PIF") {
        productDescription = "Membre PIF";
      }

      const { error: transactionError } = await supabase
        .from('accounting_transactions')
        .insert({
          transaction_date: format(renewalDate, "yyyy-MM-dd"),
          transaction_type: 'revenue',
          category: member.membership,
          client_name: member.name,
          service_description: `Renouvellement ${renewalMonths} mois - ${member.membership}`,
          product_description: productDescription,
          amount: member.cash_collected || 0,
          amount_received: 0, // Not validated yet
          payment_method: 'Prélèvement Automatique',
          notes: `Renouvellement abonnement - nouvelle échéance: ${format(newEndDate, "dd/MM/yyyy")}`,
          year: renewalDate.getFullYear(),
          month: renewalDate.getMonth() + 1,
          month_name: monthNames[renewalDate.getMonth()],
          is_auto_generated: false,
          is_validated: false,
        });

      if (transactionError) throw transactionError;

      toast.success(`Abonnement renouvelé jusqu'au ${format(newEndDate, "dd MMMM yyyy", { locale: fr })}`);
      
      if (onMemberUpdated) {
        onMemberUpdated();
      }
      
      onClose();
    } catch (error) {
      console.error('Error renewing subscription:', error);
      toast.error("Erreur lors du renouvellement de l'abonnement");
    } finally {
      setIsRenewing(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      toast.error("Le commentaire ne peut pas être vide");
      return;
    }

    try {
      await addComment(newComment);
      setNewComment("");
      toast.success("Commentaire ajouté");
    } catch (error) {
      toast.error("Erreur lors de l'ajout du commentaire");
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteComment(commentId);
      toast.success("Commentaire supprimé");
    } catch (error) {
      toast.error("Erreur lors de la suppression");
    }
  };

  const getActionLabel = (actionType: string): string => {
    const labels: Record<string, string> = {
      'onboarding_bsport': 'Onboarding Bsport',
      'onboarding_hubfit': 'Onboarding Hubfit',
      'onboarding_nutrition': 'Onboarding Nutrition',
      'questionnaire_coaching': 'Questionnaire Coaching',
      'session_introduction': 'Session Introduction'
    };
    return labels[actionType] || actionType;
  };

  const latestHistory = useMemo(() => {
    const byType = new Map<string, typeof history[number]>();
    // history is loaded desc, so first occurrence is latest
    for (const item of history) {
      if (!byType.has(item.action_type)) {
        byType.set(item.action_type, item);
      }
    }
    return Array.from(byType.values()).sort(
      (a, b) => new Date(a.action_date).getTime() - new Date(b.action_date).getTime()
    );
  }, [history]);
  const now = new Date();
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, now.getDate());

  let memberStat = {
    totalTrainings: 0,
    averagePerMonth: 0,
    averagePerWeek: 0,
    weeksSinceSignature: 0,
  };

  if (member.contract_signed_date) {
    const signatureDate = parseISO(member.contract_signed_date);
    const startDate = signatureDate > twelveMonthsAgo ? signatureDate : twelveMonthsAgo;
    
    const monthsSinceStart = differenceInMonths(now, startDate);
    const weeksSinceStart = differenceInWeeks(now, startDate);
    
    const memberTrainings = weeklyTrainings.filter(wt => wt.member_id === member.id);
    const totalTrainings = memberTrainings.reduce((sum, wt) => sum + wt.trainings_count, 0);
    
    const averagePerMonth = monthsSinceStart > 0 ? totalTrainings / monthsSinceStart : 0;
    const averagePerWeek = weeksSinceStart > 0 ? totalTrainings / weeksSinceStart : 0;

    memberStat = {
      totalTrainings,
      averagePerMonth,
      averagePerWeek,
      weeksSinceSignature: weeksSinceStart,
    };
  }

  const memberWeeklyData = weeklyTrainings
    .filter(wt => wt.member_id === member.id)
    .sort((a, b) => b.week_number - a.week_number)
    .slice(0, 12);

  const handleNavigateToWeek = (weekNumber: number) => {
    if (!member.contract_signed_date || !onNavigateToWeek) return;
    
    const signatureDate = parseISO(member.contract_signed_date);
    const memberWeekStartDate = addWeeks(signatureDate, weekNumber - 1);
    
    const targetYear = memberWeekStartDate.getFullYear();
    const jan1 = new Date(targetYear, 0, 1);
    const firstMonday = startOfWeek(jan1, { weekStartsOn: 1 });
    const memberWeekMonday = startOfWeek(memberWeekStartDate, { weekStartsOn: 1 });
    const calendarWeek = Math.floor(differenceInWeeks(memberWeekMonday, firstMonday)) + 1;
    
    onNavigateToWeek(calendarWeek, targetYear, member.id);
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Synthèse d'activité - {member.name}</DialogTitle>
          <DialogDescription className="sr-only">
            Détails d'activité hebdomadaire et statistiques du membre {member.name}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 mt-4">
          <Card className="p-4 bg-muted/30">
            <h3 className="font-semibold mb-3">Informations Générales</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Abonnement</p>
                <p className="font-medium">{member.membership}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Date de signature</p>
                <p className="font-medium">
                  {member.contract_signed_date 
                    ? format(parseISO(member.contract_signed_date), "dd MMMM yyyy", { locale: fr })
                    : "Non définie"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-2">
                  Fin d'abonnement
                  {!isEditingEndDate && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => {
                        setEditedEndDate(member.subscription_end_date || "");
                        setIsEditingEndDate(true);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  )}
                </p>
                {isEditingEndDate ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="date"
                      value={editedEndDate}
                      onChange={(e) => setEditedEndDate(e.target.value)}
                      className="h-8 w-[140px]"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleSaveEndDate}
                      disabled={isSavingEndDate}
                    >
                      <Save className="h-3 w-3 text-success" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setIsEditingEndDate(false)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <p className={`font-medium ${
                    subscriptionStatus?.status === 'expired' ? 'text-destructive' :
                    subscriptionStatus?.status === 'expiring_soon' ? 'text-warning' : ''
                  }`}>
                    {member.subscription_end_date 
                      ? format(parseISO(member.subscription_end_date), "dd MMMM yyyy", { locale: fr })
                      : "Non définie"}
                  </p>
                )}
              </div>
              <div>
                <p className="text-muted-foreground">Statut</p>
                <p className={`font-medium ${
                  subscriptionStatus?.status === 'expired' ? 'text-destructive' :
                  subscriptionStatus?.status === 'expiring_soon' ? 'text-warning' :
                  'text-success'
                }`}>
                  {subscriptionStatus?.status === 'expired' 
                    ? `Expiré (${subscriptionStatus.days}j)` 
                    : subscriptionStatus?.status === 'expiring_soon'
                    ? `Expire dans ${subscriptionStatus.days}j`
                    : member.subscription_end_date ? 'Actif' : '-'}
                </p>
              </div>
            </div>
          </Card>

          {/* Renewal Section - only show if subscription_end_date exists */}
          {member.subscription_end_date && (
            <Card className={`p-4 ${
              subscriptionStatus?.status === 'expired' 
                ? 'bg-destructive/10 border-destructive/30' 
                : subscriptionStatus?.status === 'expiring_soon'
                ? 'bg-warning/10 border-warning/30'
                : 'bg-muted/30'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  <h3 className="font-semibold">Renouvellement</h3>
                </div>
                <div className="flex items-center gap-3">
                  <Select value={renewalMonths} onValueChange={setRenewalMonths}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Durée" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 mois</SelectItem>
                      <SelectItem value="3">3 mois</SelectItem>
                      <SelectItem value="6">6 mois</SelectItem>
                      <SelectItem value="12">12 mois</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={handleRenewSubscription} 
                    disabled={isRenewing}
                    className="gap-2"
                  >
                    <Calendar className="h-4 w-4" />
                    {isRenewing ? 'Renouvellement...' : 'Renouveler'}
                  </Button>
                </div>
              </div>
              {subscriptionStatus?.status === 'expired' && (
                <p className="text-sm text-destructive mt-2">
                  Abonnement expiré depuis {subscriptionStatus.days} jours. Le membre n'apparaîtra plus dans la comptabilité tant qu'il n'est pas renouvelé.
                </p>
              )}
              {subscriptionStatus?.status === 'expiring_soon' && (
                <p className="text-sm text-warning mt-2">
                  Abonnement expire dans {subscriptionStatus.days} jours. Pensez à proposer un renouvellement.
                </p>
              )}
            </Card>
          )}

          <div className="space-y-3">
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => window.open("https://app.hubfit.io/clients", "_blank")}
              >
                <ExternalLink className="h-4 w-4" />
                Profil Hubfit
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => window.open("https://backoffice.bsport.io/member", "_blank")}
              >
                <ExternalLink className="h-4 w-4" />
                Profil Bsport
              </Button>
            </div>
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => window.open("https://link.localbestgyms.com/widget/bookings/antoine-paucod-personal-calendar-igmengorv", "_blank")}
              >
                <ExternalLink className="h-4 w-4" />
                RDV Antoine
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => window.open("https://link.localbestgyms.com/widget/bookings/jennifer-porraz-personal-calendar-0y_0v3kue", "_blank")}
              >
                <ExternalLink className="h-4 w-4" />
                RDV Jennifer
              </Button>
            </div>
          </div>

          <Card className="p-4 bg-primary/5">
            <h3 className="font-semibold mb-3">Statistiques (12 derniers mois)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-primary">{memberStat.totalTrainings}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Moy. / Mois</p>
                <p className="text-2xl font-bold">{memberStat.averagePerMonth.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Moy. / Semaine</p>
                <p className="text-2xl font-bold">{memberStat.averagePerWeek.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Semaines</p>
                <p className="text-2xl font-bold">{memberStat.weeksSinceSignature}</p>
              </div>
            </div>
          </Card>

          <div>
            <h3 className="font-semibold mb-3">Activité Hebdomadaire (12 dernières semaines)</h3>
            {memberWeeklyData.length > 0 ? (
              <div className="space-y-2">
                {memberWeeklyData.map((wt) => (
                  <div key={wt.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group">
                    <span className="text-sm font-medium">Semaine {wt.week_number}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold">{wt.trainings_count}</span>
                      <div 
                        className={`w-3 h-3 rounded-full ${
                          wt.trainings_count >= 3 ? "bg-green-500" :
                          wt.trainings_count === 2 ? "bg-yellow-500" :
                          wt.trainings_count === 1 ? "bg-orange-500" :
                          "bg-red-500"
                        }`}
                      />
                      {onNavigateToWeek && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleNavigateToWeek(wt.week_number)}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">Aucune donnée d'entraînement disponible</p>
            )}
          </div>

          {/* Historique Onboarding Timeline */}
          <Card className="p-4 bg-muted/20">
            <h3 className="font-semibold mb-4">Historique Onboarding</h3>
            {latestHistory.length > 0 ? (
              <div className="relative pl-6">
                {/* Timeline line */}
                <div className="absolute left-[11px] top-0 bottom-0 w-0.5 bg-border" />
                
                {/* Timeline items - show oldest to newest */}
                <div className="space-y-4">
                  {latestHistory.map((item) => (
                    <div key={item.id} className="relative">
                      {/* Timeline dot */}
                      <div className="absolute left-[-23px] top-1 w-5 h-5 rounded-full border-2 bg-green-500 border-green-600" />
                      
                      <div className="bg-background p-3 rounded-lg border">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span className="font-medium text-sm">
                              {getActionLabel(item.action_type)}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(parseISO(item.action_date), "dd/MM/yyyy HH:mm", { locale: fr })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 ml-6">
                          Complété
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun historique</p>
            )}
          </Card>

          {/* Commentaires Section */}
          <Card className="p-4 bg-accent/10">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Commentaires
            </h3>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Ajouter un commentaire..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={2}
                  className="flex-1"
                />
                <Button onClick={handleAddComment} className="self-end">
                  Ajouter
                </Button>
              </div>

              {comments.length > 0 ? (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {comments.map((comment) => (
                    <div key={comment.id} className="p-3 bg-background rounded-lg border group relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleDeleteComment(comment.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                      <p className="text-sm pr-8">{comment.comment}</p>
                      <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
                        <span>{comment.created_by}</span>
                        <span>{format(parseISO(comment.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Aucun commentaire</p>
              )}
            </div>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
