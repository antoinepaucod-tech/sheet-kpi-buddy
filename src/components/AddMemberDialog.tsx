import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Plus, Users } from "lucide-react";
import { format, addMonths, addWeeks } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useAccountingCategories } from "@/hooks/useAccountingCategories";
import { Badge } from "@/components/ui/badge";

const PAYMENT_METHODS = [
  "Prélèvement Automatique",
  "Virement Bancaire",
  "Carte Bancaire",
  "Espèces",
  "Autre",
];

interface AddMemberDialogProps {
  onAdd: (memberData: MemberFormData) => void;
}

export interface MemberFormData {
  name: string;
  membership: string;
  memberType: string;
  cashCollected: number;
  contractDate: Date | null;
  subscriptionDurationMonths: number;
  subscriptionEndDate: Date | null;
  paymentMethod: string;
  invoiceNumber?: string;
  serviceDescription?: string;
  // Duo fields
  isDuoSubscription: boolean;
  secondPersonName?: string;
}

export const AddMemberDialog = ({ onAdd }: AddMemberDialogProps) => {
  const { revenueCategories, isLoading } = useAccountingCategories();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState<MemberFormData>({
    name: "",
    membership: "",
    memberType: "",
    cashCollected: 0,
    contractDate: new Date(),
    subscriptionDurationMonths: 12,
    subscriptionEndDate: null,
    paymentMethod: "Prélèvement Automatique",
    invoiceNumber: "",
    serviceDescription: "",
    isDuoSubscription: false,
    secondPersonName: "",
  });

  // Detect if selected membership is a duo type
  const isDuoMembership = useMemo(() => {
    if (!formData.membership) return false;
    const membershipLower = formData.membership.toLowerCase();
    return membershipLower.includes('duo') || membershipLower.includes('couple');
  }, [formData.membership]);

  // Auto-enable duo mode when a duo membership is selected
  const effectiveIsDuo = isDuoMembership || formData.isDuoSubscription;

  const handleSubmit = () => {
    if (formData.name.trim() && formData.membership && formData.memberType && formData.cashCollected >= 0) {
      // For duo subscriptions, validate second person name
      if (effectiveIsDuo && !formData.secondPersonName?.trim()) {
        return; // Don't submit without second person name
      }
      
      onAdd({
        ...formData,
        isDuoSubscription: effectiveIsDuo,
      });
      
      // Reset form
      setFormData({
        name: "",
        membership: "",
        memberType: "",
        cashCollected: 0,
        contractDate: new Date(),
        subscriptionDurationMonths: 12,
        subscriptionEndDate: null,
        paymentMethod: "Prélèvement Automatique",
        invoiceNumber: "",
        serviceDescription: "",
        isDuoSubscription: false,
        secondPersonName: "",
      });
      setOpen(false);
    }
  };

  const isFormValid = formData.name.trim() && 
    formData.membership && 
    formData.memberType && 
    formData.contractDate &&
    (!effectiveIsDuo || formData.secondPersonName?.trim());

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 h-10">
          <Plus className="h-4 w-4" />
          Ajouter un membre
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Ajouter un nouveau membre
            {effectiveIsDuo && (
              <Badge variant="secondary" className="gap-1">
                <Users className="h-3 w-3" />
                Duo
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Personne 1 */}
          <div className="space-y-2">
            <Label htmlFor="name">
              {effectiveIsDuo ? "Nom / Prénom - Personne 1 (Principal) *" : "Nom / Prénom *"}
            </Label>
            <Input
              id="name"
              placeholder="Nom du membre principal"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          {/* Personne 2 - Only for Duo */}
          {effectiveIsDuo && (
            <div className="space-y-2 p-4 bg-muted/50 rounded-lg border border-dashed">
              <Label htmlFor="secondPersonName" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Nom / Prénom - Personne 2 *
              </Label>
              <Input
                id="secondPersonName"
                placeholder="Nom de la deuxième personne"
                value={formData.secondPersonName}
                onChange={(e) => setFormData({ ...formData, secondPersonName: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Cette personne aura son propre suivi (onboarding, entraînements) mais partage le même abonnement.
                Le revenu sera uniquement comptabilisé sur le membre principal.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Membership */}
            <div className="space-y-2">
              <Label htmlFor="membership">Membership *</Label>
              <Select
                value={formData.membership}
                onValueChange={(value) => setFormData({ ...formData, membership: value })}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {revenueCategories.map((category) => (
                    <SelectItem key={category.id} value={category.name}>
                      <span className="flex items-center gap-2">
                        {category.name}
                        {(category.name.toLowerCase().includes('duo') || 
                          category.name.toLowerCase().includes('couple')) && (
                          <Badge variant="outline" className="text-xs py-0 px-1">
                            <Users className="h-3 w-3" />
                          </Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type */}
            <div className="space-y-2">
              <Label htmlFor="type">Type *</Label>
              <Select
                value={formData.memberType}
                onValueChange={(value) => setFormData({ ...formData, memberType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Membres Généraux Récurrents">
                    Membres Généraux Récurrents
                  </SelectItem>
                  <SelectItem value="Membres PIF">Membres PIF</SelectItem>
                  <SelectItem value="Membres PT">Membres PT</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Cash Collectée */}
            <div className="space-y-2">
              <Label htmlFor="cash">
                Cash Collectée (CHF) * 
                {effectiveIsDuo && (
                  <span className="text-muted-foreground font-normal ml-1">(total pour les 2)</span>
                )}
              </Label>
              <Input
                id="cash"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.cashCollected || ""}
                onChange={(e) =>
                  setFormData({ ...formData, cashCollected: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            {/* Date signature contrat */}
            <div className="space-y-2">
              <Label>Date Signature Contrat *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.contractDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.contractDate ? (
                      format(formData.contractDate, "dd MMMM yyyy", { locale: fr })
                    ) : (
                      <span>Sélectionner une date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.contractDate || undefined}
                    onSelect={(date) => {
                      const endDate = date && formData.subscriptionDurationMonths > 0
                        ? addMonths(date, formData.subscriptionDurationMonths)
                        : null;
                      setFormData({ 
                        ...formData, 
                        contractDate: date || null,
                        subscriptionEndDate: endDate
                      });
                    }}
                    locale={fr}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Durée d'abonnement */}
            <div className="space-y-2">
              <Label htmlFor="subscriptionDuration">Durée d'Abonnement</Label>
              <Select
                value={formData.subscriptionDurationMonths.toString()}
                onValueChange={(value) => {
                  const durationValue = parseFloat(value);
                  let endDate: Date | null = null;
                  
                  if (formData.contractDate && durationValue > 0) {
                    // Handle 6 weeks (1.5 months equivalent stored as 1.5)
                    if (durationValue === 1.5) {
                      endDate = addWeeks(formData.contractDate, 6);
                    } else {
                      endDate = addMonths(formData.contractDate, durationValue);
                    }
                  }
                  
                  setFormData({ 
                    ...formData, 
                    subscriptionDurationMonths: durationValue,
                    subscriptionEndDate: endDate
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="1.5">6 semaines après signature</SelectItem>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((months) => (
                    <SelectItem key={months} value={months.toString()}>
                      {months} mois après signature
                    </SelectItem>
                  ))}
                  <SelectItem value="0">Sans échéance</SelectItem>
                </SelectContent>
              </Select>
              {formData.subscriptionEndDate && formData.subscriptionDurationMonths > 0 && (
                <p className="text-xs text-muted-foreground">
                  Date de fin: {format(formData.subscriptionEndDate, "dd MMMM yyyy", { locale: fr })}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Moyen de paiement */}
            <div className="space-y-2">
              <Label htmlFor="payment">Moyen de Paiement *</Label>
              <Select
                value={formData.paymentMethod}
                onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Numéro de facture */}
            <div className="space-y-2">
              <Label htmlFor="invoice">Numéro de Facture (optionnel)</Label>
              <Input
                id="invoice"
                placeholder="INV-2025-001"
                value={formData.invoiceNumber}
                onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
              />
            </div>
          </div>

          {/* Description du service */}
          <div className="space-y-2">
            <Label htmlFor="service">Description du Service (optionnel)</Label>
            <Input
              id="service"
              placeholder="Description additionnelle..."
              value={formData.serviceDescription}
              onChange={(e) => setFormData({ ...formData, serviceDescription: e.target.value })}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid}
          >
            {effectiveIsDuo ? "Ajouter les 2 membres" : "Ajouter"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};