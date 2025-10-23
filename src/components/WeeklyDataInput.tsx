import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WeeklyKPI } from "@/types/weekly-kpi";
import { Edit, DollarSign, Users, Target, CreditCard } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface WeeklyDataInputProps {
  weekData: WeeklyKPI;
  weekLabel: string;
  onSave: (data: WeeklyKPI) => void;
}

export const WeeklyDataInput = ({ weekData, weekLabel, onSave }: WeeklyDataInputProps) => {
  const [formData, setFormData] = useState<WeeklyKPI>(weekData);
  const [open, setOpen] = useState(false);

  // Reset form data when weekData changes (week selection changes)
  useEffect(() => {
    setFormData(weekData);
  }, [weekData]);

  const handleSave = () => {
    onSave(formData);
    setOpen(false);
  };

  const updateField = (field: keyof WeeklyKPI, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: parseFloat(value) || 0,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Edit className="h-4 w-4" />
          {weekLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">Données {weekLabel}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Du {new Date(weekData.week_start_date).toLocaleDateString('fr-FR')} au{' '}
            {new Date(weekData.week_end_date).toLocaleDateString('fr-FR')}
          </p>
        </DialogHeader>
        <ScrollArea className="h-[calc(90vh-120px)] pr-4">
          <Tabs defaultValue="revenue" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="revenue" className="gap-2">
                <DollarSign className="h-4 w-4" />
                Revenus
              </TabsTrigger>
              <TabsTrigger value="members" className="gap-2">
                <Users className="h-4 w-4" />
                Membres
              </TabsTrigger>
              <TabsTrigger value="sales" className="gap-2">
                <Target className="h-4 w-4" />
                Ventes
              </TabsTrigger>
              <TabsTrigger value="expenses" className="gap-2">
                <CreditCard className="h-4 w-4" />
                Dépenses
              </TabsTrigger>
            </TabsList>

            <TabsContent value="revenue" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="general_eft_revenue">General EFT Rev</Label>
                  <Input
                    id="general_eft_revenue"
                    type="number"
                    value={formData.general_eft_revenue}
                    onChange={(e) => updateField('general_eft_revenue', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="pt_revenue">PT Rev</Label>
                  <Input
                    id="pt_revenue"
                    type="number"
                    value={formData.pt_revenue}
                    onChange={(e) => updateField('pt_revenue', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="retail_revenue">Retail Rev</Label>
                  <Input
                    id="retail_revenue"
                    type="number"
                    value={formData.retail_revenue}
                    onChange={(e) => updateField('retail_revenue', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="fast_cash_revenue">Fast Cash Rev</Label>
                  <Input
                    id="fast_cash_revenue"
                    type="number"
                    value={formData.fast_cash_revenue}
                    onChange={(e) => updateField('fast_cash_revenue', e.target.value)}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="members" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pif_members">PIF Members</Label>
                  <Input
                    id="pif_members"
                    type="number"
                    value={formData.pif_members}
                    onChange={(e) => updateField('pif_members', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="pif_exits">PIF Exits</Label>
                  <Input
                    id="pif_exits"
                    type="number"
                    value={formData.pif_exits}
                    onChange={(e) => updateField('pif_exits', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="pauses">Pauses</Label>
                  <Input
                    id="pauses"
                    type="number"
                    value={formData.pauses}
                    onChange={(e) => updateField('pauses', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="recurring_general_members">Recurring General Members</Label>
                  <Input
                    id="recurring_general_members"
                    type="number"
                    value={formData.recurring_general_members}
                    onChange={(e) => updateField('recurring_general_members', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="general_exits">General Exits</Label>
                  <Input
                    id="general_exits"
                    type="number"
                    value={formData.general_exits}
                    onChange={(e) => updateField('general_exits', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="pt_members">PT Members</Label>
                  <Input
                    id="pt_members"
                    type="number"
                    value={formData.pt_members}
                    onChange={(e) => updateField('pt_members', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="pt_exits">PT Exits</Label>
                  <Input
                    id="pt_exits"
                    type="number"
                    value={formData.pt_exits}
                    onChange={(e) => updateField('pt_exits', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="total_classes">Total Classes</Label>
                  <Input
                    id="total_classes"
                    type="number"
                    value={formData.total_classes}
                    onChange={(e) => updateField('total_classes', e.target.value)}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="sales" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="leads">Leads</Label>
                  <Input
                    id="leads"
                    type="number"
                    value={formData.leads}
                    onChange={(e) => updateField('leads', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="calls_made">Calls Made</Label>
                  <Input
                    id="calls_made"
                    type="number"
                    value={formData.calls_made}
                    onChange={(e) => updateField('calls_made', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="scheduled">Scheduled</Label>
                  <Input
                    id="scheduled"
                    type="number"
                    value={formData.scheduled}
                    onChange={(e) => updateField('scheduled', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="show">Show</Label>
                  <Input
                    id="show"
                    type="number"
                    value={formData.show}
                    onChange={(e) => updateField('show', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="close">Close</Label>
                  <Input
                    id="close"
                    type="number"
                    value={formData.close}
                    onChange={(e) => updateField('close', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="cash_collected">Cash Collected</Label>
                  <Input
                    id="cash_collected"
                    type="number"
                    value={formData.cash_collected}
                    onChange={(e) => updateField('cash_collected', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="organic_leads">Organic Leads</Label>
                  <Input
                    id="organic_leads"
                    type="number"
                    value={formData.organic_leads}
                    onChange={(e) => updateField('organic_leads', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="organic_close">Organic Close</Label>
                  <Input
                    id="organic_close"
                    type="number"
                    value={formData.organic_close}
                    onChange={(e) => updateField('organic_close', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="organic_cash_collected">Organic Cash</Label>
                  <Input
                    id="organic_cash_collected"
                    type="number"
                    value={formData.organic_cash_collected}
                    onChange={(e) => updateField('organic_cash_collected', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="in_trial">In Trial</Label>
                  <Input
                    id="in_trial"
                    type="number"
                    value={formData.in_trial}
                    onChange={(e) => updateField('in_trial', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="trial_ending">Trial Ending</Label>
                  <Input
                    id="trial_ending"
                    type="number"
                    value={formData.trial_ending}
                    onChange={(e) => updateField('trial_ending', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="converted">Converted</Label>
                  <Input
                    id="converted"
                    type="number"
                    value={formData.converted}
                    onChange={(e) => updateField('converted', e.target.value)}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="expenses" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="ad_spend">Ad Spend</Label>
                  <Input
                    id="ad_spend"
                    type="number"
                    value={formData.ad_spend}
                    onChange={(e) => updateField('ad_spend', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="rent">Rent</Label>
                  <Input
                    id="rent"
                    type="number"
                    value={formData.rent}
                    onChange={(e) => updateField('rent', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="repairs_maintenance">Repairs & Maintenance</Label>
                  <Input
                    id="repairs_maintenance"
                    type="number"
                    value={formData.repairs_maintenance}
                    onChange={(e) => updateField('repairs_maintenance', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="computer_software">Computer Software</Label>
                  <Input
                    id="computer_software"
                    type="number"
                    value={formData.computer_software}
                    onChange={(e) => updateField('computer_software', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="internet_telephone">Internet & Telephone</Label>
                  <Input
                    id="internet_telephone"
                    type="number"
                    value={formData.internet_telephone}
                    onChange={(e) => updateField('internet_telephone', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="stationary">Stationary</Label>
                  <Input
                    id="stationary"
                    type="number"
                    value={formData.stationary}
                    onChange={(e) => updateField('stationary', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="utilities">Utilities</Label>
                  <Input
                    id="utilities"
                    type="number"
                    value={formData.utilities}
                    onChange={(e) => updateField('utilities', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="advertising_promotion">Advertising</Label>
                  <Input
                    id="advertising_promotion"
                    type="number"
                    value={formData.advertising_promotion}
                    onChange={(e) => updateField('advertising_promotion', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="legal_professional">Legal & Professional</Label>
                  <Input
                    id="legal_professional"
                    type="number"
                    value={formData.legal_professional}
                    onChange={(e) => updateField('legal_professional', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="charitable_donations">Charitable Donations</Label>
                  <Input
                    id="charitable_donations"
                    type="number"
                    value={formData.charitable_donations}
                    onChange={(e) => updateField('charitable_donations', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="subscriptions">Subscriptions</Label>
                  <Input
                    id="subscriptions"
                    type="number"
                    value={formData.subscriptions}
                    onChange={(e) => updateField('subscriptions', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="bank_finance_charges">Bank/Finance Charges</Label>
                  <Input
                    id="bank_finance_charges"
                    type="number"
                    value={formData.bank_finance_charges}
                    onChange={(e) => updateField('bank_finance_charges', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="insurance">Insurance</Label>
                  <Input
                    id="insurance"
                    type="number"
                    value={formData.insurance}
                    onChange={(e) => updateField('insurance', e.target.value)}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </ScrollArea>
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} className="gradient-primary">
            Sauvegarder
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
