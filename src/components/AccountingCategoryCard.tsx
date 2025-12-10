import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { AccountingTransaction } from "@/hooks/useAccountingTransactions";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MemberActivityDialog } from "@/components/MemberActivityDialog";
import type { Member as CustomerMember, WeeklyTraining } from "@/hooks/useCustomerMembers";

interface AccountingCategoryCardProps {
  category: string;
  transactions: AccountingTransaction[];
  onEdit: (transaction: AccountingTransaction) => void;
  onDelete: (id: string) => void;
  onUpdateAmount: (id: string, amount: number) => void;
  onUpdateAmountReceived: (id: string, amountReceived: number) => void;
  onToggleValidation: (id: string, currentStatus: boolean) => void;
  customerMembers: any[];
  type: "revenue" | "expense";
}

export const AccountingCategoryCard = ({
  category,
  transactions,
  onEdit,
  onDelete,
  onUpdateAmount,
  onUpdateAmountReceived,
  onToggleValidation,
  customerMembers,
  type,
}: AccountingCategoryCardProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activityMember, setActivityMember] = useState<CustomerMember | null>(null);
  const [weeklyTrainings, setWeeklyTrainings] = useState<WeeklyTraining[]>([]);

  const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
  const totalReceived = transactions.reduce((sum, t) => sum + (t.amount_received || 0), 0);
  const difference = totalAmount - totalReceived;
  const unvalidatedCount = transactions.filter((t) => !t.is_validated).length;

  const getMemberStatus = (clientName: string | null) => {
    if (!clientName) return null;
    const member = customerMembers.find(
      (m) => m.name.toLowerCase() === clientName.toLowerCase()
    );
    if (!member) return null;
    if (member.exit_date && new Date(member.exit_date) < new Date()) {
      return "departed";
    }
    return "active";
  };

  const openActivityDialog = async (clientName: string | null) => {
    if (!clientName) return;
    
    const member = customerMembers.find(
      (m) => m.name.toLowerCase() === clientName.toLowerCase()
    );
    
    if (!member) {
      toast.error("Membre non trouvé dans le parcours client");
      return;
    }

    // Load full member data
    const { data: fullMember, error } = await supabase
      .from('customer_members')
      .select('*')
      .eq('id', member.id)
      .maybeSingle();

    if (error) {
      console.error("Error loading member:", error);
      toast.error("Erreur lors du chargement des données du membre");
      return;
    }

    if (!fullMember) {
      toast.error("Membre non trouvé dans la base de données");
      return;
    }

    // Load weekly trainings for this member
    const { data: trainings } = await supabase
      .from('weekly_trainings')
      .select('*')
      .eq('member_id', member.id);

    setWeeklyTrainings(trainings || []);
    setActivityMember(fullMember as CustomerMember);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden border-border/50 shadow-sm hover:shadow-md transition-shadow">
        {/* Header - Compact View */}
        <CollapsibleTrigger asChild>
          <div
            className={`p-4 cursor-pointer transition-colors ${
              type === "revenue"
                ? "bg-emerald-500/10 hover:bg-emerald-500/15 dark:bg-emerald-500/5 dark:hover:bg-emerald-500/10"
                : "bg-rose-500/10 hover:bg-rose-500/15 dark:bg-rose-500/5 dark:hover:bg-rose-500/10"
            }`}
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
                  <h3 className="font-semibold text-base text-foreground">
                    {category}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {transactions.length} transaction{transactions.length > 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {unvalidatedCount > 0 && (
                  <Badge variant="destructive" className="animate-pulse">
                    {unvalidatedCount} à valider
                  </Badge>
                )}
                <div className="text-right">
                  <div className="font-bold text-lg text-foreground">
                    {totalReceived.toFixed(2)} CHF
                  </div>
                  <div className="text-xs text-muted-foreground">
                    sur {totalAmount.toFixed(2)} CHF
                  </div>
                  {difference > 0 && (
                    <div className="text-xs font-medium text-orange-600 dark:text-orange-400">
                      -{difference.toFixed(2)} CHF
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CollapsibleTrigger>

        {/* Expanded Content */}
        <CollapsibleContent className="animate-accordion-down">
          <div className="divide-y divide-border/50">
            {transactions.map((transaction, index) => {
              const memberStatus = getMemberStatus(transaction.client_name);
              return (
                <div
                  key={transaction.id}
                  className={`p-4 hover:bg-muted/30 transition-colors ${
                    !transaction.is_validated ? "bg-orange-500/5" : ""
                  }`}
                >
                  <div className="grid grid-cols-12 gap-3 items-center">
                    {/* Line Number */}
                    <div className="col-span-1 flex items-center justify-center">
                      <span className="text-xs font-medium text-muted-foreground bg-muted/50 rounded-full w-6 h-6 flex items-center justify-center">
                        {index + 1}
                      </span>
                    </div>

                    {/* Date & Validation Status */}
                    <div className="col-span-2">
                      <div className="text-sm font-medium text-foreground">
                        {format(new Date(transaction.transaction_date), "dd/MM/yyyy")}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <button
                          onClick={() =>
                            onToggleValidation(
                              transaction.id,
                              transaction.is_validated ?? false
                            )
                          }
                          className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                            transaction.is_validated
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 animate-pulse"
                          }`}
                        >
                          {transaction.is_validated ? "Validé" : "À valider"}
                        </button>
                        {transaction.is_auto_generated && (
                          <Badge variant="secondary" className="text-xs">
                            Auto
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Client/Provider Name */}
                    <div className="col-span-2">
                      {customerMembers.find(
                        (m) => m.name.toLowerCase() === transaction.client_name?.toLowerCase()
                      ) ? (
                        <button
                          onClick={() => openActivityDialog(transaction.client_name)}
                          className="text-sm font-medium text-foreground text-left hover:text-primary hover:underline transition-colors cursor-pointer"
                        >
                          {transaction.client_name}
                        </button>
                      ) : (
                        <div className="text-sm font-medium text-foreground">
                          {transaction.client_name || "-"}
                        </div>
                      )}
                      {memberStatus === "departed" && (
                        <Badge variant="outline" className="mt-1 text-xs border-orange-500 text-orange-600">
                          Parti
                        </Badge>
                      )}
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {transaction.service_description ||
                          transaction.product_description ||
                          "-"}
                      </div>
                    </div>

                    {/* Payment Method */}
                    <div className="col-span-2">
                      <div className="text-xs text-muted-foreground">
                        {transaction.payment_method || "-"}
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="col-span-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={transaction.amount}
                        onChange={(e) =>
                          onUpdateAmount(
                            transaction.id,
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="h-8 text-sm font-semibold"
                      />
                    </div>

                    {/* Amount Received */}
                    <div className="col-span-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={transaction.amount_received || 0}
                        onChange={(e) =>
                          onUpdateAmountReceived(
                            transaction.id,
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className={`h-8 text-sm font-bold ${
                          transaction.amount_received &&
                          transaction.amount_received < transaction.amount
                            ? "border-orange-500 text-orange-600"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      />
                    </div>

                    {/* Actions */}
                    <div className="col-span-1 flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(transaction)}
                        className="h-7 w-7 p-0"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(transaction.id)}
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Notes */}
                  {transaction.notes && (
                    <div className="mt-2 text-xs text-muted-foreground italic border-l-2 border-muted pl-2">
                      {transaction.notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CollapsibleContent>
      </Card>

      {/* Member Activity Dialog */}
      {activityMember && (
        <MemberActivityDialog
          member={activityMember}
          weeklyTrainings={weeklyTrainings}
          onClose={() => setActivityMember(null)}
          onMemberUpdated={() => setActivityMember(null)}
        />
      )}
    </Collapsible>
  );
};
