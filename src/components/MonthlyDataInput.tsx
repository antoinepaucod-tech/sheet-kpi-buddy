import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Edit } from "lucide-react";
import { MonthlyKPIData } from "@/hooks/useMonthlyKPIData";
import { useAccountingCategories } from "@/hooks/useAccountingCategories";

interface MonthlyDataInputProps {
  monthData: MonthlyKPIData;
  monthLabel: string;
  onSave: (data: MonthlyKPIData) => void;
}

export const MonthlyDataInput = ({ monthData, monthLabel, onSave }: MonthlyDataInputProps) => {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState<MonthlyKPIData>(monthData);
  const { expenseCategories, isLoading: categoriesLoading } = useAccountingCategories();

  useEffect(() => {
    setFormData(monthData);
  }, [monthData]);

  const handleSave = () => {
    onSave(formData);
    setOpen(false);
  };

  const updateField = (field: keyof MonthlyKPIData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: parseFloat(value) || 0
    }));
  };
  
  // Mapping entre les noms de catégories et les colonnes de monthly_kpis
  const getCategoryField = (categoryName: string): keyof MonthlyKPIData | null => {
    const normalized = categoryName.toUpperCase().trim();
    const mappings: Record<string, keyof MonthlyKPIData> = {
      "DÉPENSES PUBLICITAIRES": "ad_spend",
      "PUBLICITÉ": "ad_spend",
      "LOYER": "rent",
      "LOYERS": "rent",
      "RÉPARATIONS & MAINTENANCE": "repairs_maintenance",
      "LOGICIELS": "computer_software",
      "INTERNET & TÉLÉPHONE": "internet_telephone",
      "INTERNET & TELEPHONIE": "internet_telephone",
      "TELEPHONIE": "internet_telephone",
      "ABONNEMENTS": "subscriptions",
      "FRAIS BANCAIRES": "bank_finance_charges",
      "ASSURANCE": "insurance",
      "SALAIRES": "salaries",
      "SALAIRES COACH": "salaries",
      "ALIMENTAIRE": "food_expenses",
      "DÉPENSES ALIMENTAIRES": "food_expenses",
      "REMBOURSEMENT CRÉDIT": "credit_repayment",
      "REMBOURSEMENT PRÊT": "credit_repayment",
      "RETRAIT BANCOMAT": "bank_finance_charges", // Mapping to bank charges for now
    };
    return mappings[normalized] || null;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Edit className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier les données - {monthLabel}</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="revenue" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="revenue">Revenu</TabsTrigger>
            <TabsTrigger value="members">Membres</TabsTrigger>
            <TabsTrigger value="sales">Ventes</TabsTrigger>
            <TabsTrigger value="expenses">Dépenses</TabsTrigger>
            <TabsTrigger value="advanced">Avancées</TabsTrigger>
          </TabsList>

          <TabsContent value="revenue" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Revenu EFT Général</Label>
                <Input 
                  type="number" 
                  value={formData.general_eft_revenue}
                  onChange={(e) => updateField('general_eft_revenue', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Revenu PT</Label>
                <Input 
                  type="number" 
                  value={formData.pt_revenue}
                  onChange={(e) => updateField('pt_revenue', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Revenu Retail</Label>
                <Input 
                  type="number" 
                  value={formData.retail_revenue}
                  onChange={(e) => updateField('retail_revenue', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Revenu Fast Cash</Label>
                <Input 
                  type="number" 
                  value={formData.fast_cash_revenue}
                  onChange={(e) => updateField('fast_cash_revenue', e.target.value)}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="members" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Membres Généraux Récurrents</Label>
                <Input 
                  type="number" 
                  value={formData.recurring_general_members}
                  onChange={(e) => updateField('recurring_general_members', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Membres PIF</Label>
                <Input 
                  type="number" 
                  value={formData.pif_members}
                  onChange={(e) => updateField('pif_members', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Membres PT</Label>
                <Input 
                  type="number" 
                  value={formData.pt_members}
                  onChange={(e) => updateField('pt_members', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Sorties PIF</Label>
                <Input 
                  type="number" 
                  value={formData.pif_exits}
                  onChange={(e) => updateField('pif_exits', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Sorties Générales</Label>
                <Input 
                  type="number" 
                  value={formData.general_exits}
                  onChange={(e) => updateField('general_exits', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Sorties PT</Label>
                <Input 
                  type="number" 
                  value={formData.pt_exits}
                  onChange={(e) => updateField('pt_exits', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Pauses</Label>
                <Input 
                  type="number" 
                  value={formData.pauses}
                  onChange={(e) => updateField('pauses', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Classes Totales</Label>
                <Input 
                  type="number" 
                  value={formData.total_classes}
                  onChange={(e) => updateField('total_classes', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>SQFT Gym Floor</Label>
                <Input 
                  type="number" 
                  value={formData.gym_floor_sqft || 0}
                  onChange={(e) => updateField('gym_floor_sqft', e.target.value)}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="sales" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Leads</Label>
                <Input 
                  type="number" 
                  value={formData.leads}
                  onChange={(e) => updateField('leads', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Appels Effectués</Label>
                <Input 
                  type="number" 
                  value={formData.calls_made}
                  onChange={(e) => updateField('calls_made', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Scheduled</Label>
                <Input 
                  type="number" 
                  value={formData.scheduled}
                  onChange={(e) => updateField('scheduled', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Show</Label>
                <Input 
                  type="number" 
                  value={formData.show}
                  onChange={(e) => updateField('show', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Close</Label>
                <Input 
                  type="number" 
                  value={formData.close}
                  onChange={(e) => updateField('close', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Cash Collecté</Label>
                <Input 
                  type="number" 
                  value={formData.cash_collected}
                  onChange={(e) => updateField('cash_collected', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Leads Organiques</Label>
                <Input 
                  type="number" 
                  value={formData.organic_leads}
                  onChange={(e) => updateField('organic_leads', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Close Organiques</Label>
                <Input 
                  type="number" 
                  value={formData.organic_close}
                  onChange={(e) => updateField('organic_close', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Cash Organique</Label>
                <Input 
                  type="number" 
                  value={formData.organic_cash_collected}
                  onChange={(e) => updateField('organic_cash_collected', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>En Essai</Label>
                <Input 
                  type="number" 
                  value={formData.in_trial}
                  onChange={(e) => updateField('in_trial', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Fin Essai</Label>
                <Input 
                  type="number" 
                  value={formData.trial_ending}
                  onChange={(e) => updateField('trial_ending', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Convertis</Label>
                <Input 
                  type="number" 
                  value={formData.converted}
                  onChange={(e) => updateField('converted', e.target.value)}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="expenses" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              {categoriesLoading ? (
                <div className="col-span-2 text-center text-muted-foreground">
                  Chargement des catégories...
                </div>
              ) : (
                expenseCategories.map((category) => {
                  const field = getCategoryField(category.name);
                  if (!field) return null;
                  
                  return (
                    <div key={category.id} className="space-y-2">
                      <Label>{category.name}</Label>
                      <Input 
                        type="number" 
                        value={formData[field] || 0}
                        onChange={(e) => updateField(field, e.target.value)}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>General ACRM (CHF)</Label>
                <Input 
                  type="number" 
                  value={formData.general_acrm || 0}
                  onChange={(e) => updateField('general_acrm', e.target.value)}
                  placeholder="Revenu moyen mensuel par client général"
                />
              </div>
              <div className="space-y-2">
                <Label>General LTV (CHF)</Label>
                <Input 
                  type="number" 
                  value={formData.general_ltv || 0}
                  onChange={(e) => updateField('general_ltv', e.target.value)}
                  placeholder="Valeur vie client général"
                />
              </div>
              <div className="space-y-2">
                <Label>PT ACRM (CHF)</Label>
                <Input 
                  type="number" 
                  value={formData.pt_acrm || 0}
                  onChange={(e) => updateField('pt_acrm', e.target.value)}
                  placeholder="Revenu moyen mensuel par client PT"
                />
              </div>
              <div className="space-y-2">
                <Label>PT LTV (CHF)</Label>
                <Input 
                  type="number" 
                  value={formData.pt_ltv || 0}
                  onChange={(e) => updateField('pt_ltv', e.target.value)}
                  placeholder="Valeur vie client PT"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave}>
            Sauvegarder
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
