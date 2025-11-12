import { useState } from "react";
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
import { CalendarIcon, Plus } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

const PAYMENT_METHODS = [
  "Prélèvement Automatique",
  "Virement Bancaire",
  "Carte Bancaire",
  "Espèces",
  "Autre",
];

const MEMBERSHIP_TYPES = [
  "Hybrid FULL - paiement tous les 28 jours YOUNG / STUDENT",
  "Hybrid FULL - paiement tous les 28 jours avec engagement",
  "Hybrid FULL - Paiement x1 Annuel",
  "Hybrid FULL DUO . Paiement x1 Annuel",
  "Unlimited Access (ancien membership)",
  "Unlimited Access 6 mois (ancien membership)",
  "Abonnement offert",
  "Hybrid OPEN GYM tous les 28 jours - avec engagement",
  "hybrid OPEN GYM - Paiement x1 - Annuel",
  "Open Gym (ancien membership)",
  "Hybrid FULL tous les 28 jours - sans engagement",
  "Pack 20 sessions",
  "Pack 10",
  "6 Weeks Challenge",
  "IFRC Paiement Mensuel",
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
  paymentMethod: string;
  invoiceNumber?: string;
  serviceDescription?: string;
}

export const AddMemberDialog = ({ onAdd }: AddMemberDialogProps) => {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState<MemberFormData>({
    name: "",
    membership: MEMBERSHIP_TYPES[0],
    memberType: "",
    cashCollected: 0,
    contractDate: new Date(),
    paymentMethod: "Prélèvement Automatique",
    invoiceNumber: "",
    serviceDescription: "",
  });

  const handleSubmit = () => {
    if (formData.name.trim() && formData.memberType && formData.cashCollected >= 0) {
      onAdd(formData);
      // Reset form
      setFormData({
        name: "",
        membership: MEMBERSHIP_TYPES[0],
        memberType: "",
        cashCollected: 0,
        contractDate: new Date(),
        paymentMethod: "Prélèvement Automatique",
        invoiceNumber: "",
        serviceDescription: "",
      });
      setOpen(false);
    }
  };

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
          <DialogTitle>Ajouter un nouveau membre</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Nom */}
          <div className="space-y-2">
            <Label htmlFor="name">Nom / Prénom *</Label>
            <Input
              id="name"
              placeholder="Nom du membre"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Membership */}
            <div className="space-y-2">
              <Label htmlFor="membership">Membership *</Label>
              <Select
                value={formData.membership}
                onValueChange={(value) => setFormData({ ...formData, membership: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {MEMBERSHIP_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
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
              <Label htmlFor="cash">Cash Collectée (CHF) *</Label>
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
                    onSelect={(date) => setFormData({ ...formData, contractDate: date || null })}
                    locale={fr}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
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
            disabled={!formData.name.trim() || !formData.memberType || !formData.contractDate}
          >
            Ajouter
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
