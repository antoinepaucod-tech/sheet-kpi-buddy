import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MonthlyKPI } from "@/types/kpi";
import { Edit, DollarSign, Users, TrendingUp, ShoppingCart, Target, CreditCard } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DataInputDialogProps {
  monthData: MonthlyKPI;
  monthName: string;
  onSave: (data: Partial<MonthlyKPI>) => void;
}

export const DataInputDialog = ({ monthData, monthName, onSave }: DataInputDialogProps) => {
  const [formData, setFormData] = useState<MonthlyKPI>(monthData);
  const [open, setOpen] = useState(false);

  const handleSave = () => {
    onSave(formData);
    setOpen(false);
  };

  const updateField = (field: keyof MonthlyKPI, value: string) => {
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
          Modifier {monthName}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">Données pour {monthName}</DialogTitle>
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
                  <Label htmlFor="generalEFTRevenue">General EFT Rev</Label>
                  <Input
                    id="generalEFTRevenue"
                    type="number"
                    value={formData.generalEFTRevenue}
                    onChange={(e) => updateField('generalEFTRevenue', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="ptRevenue">PT Rev</Label>
                  <Input
                    id="ptRevenue"
                    type="number"
                    value={formData.ptRevenue}
                    onChange={(e) => updateField('ptRevenue', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="retailRevenue">Retail Rev</Label>
                  <Input
                    id="retailRevenue"
                    type="number"
                    value={formData.retailRevenue}
                    onChange={(e) => updateField('retailRevenue', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="fastCashRevenue">Fast Cash Rev</Label>
                  <Input
                    id="fastCashRevenue"
                    type="number"
                    value={formData.fastCashRevenue}
                    onChange={(e) => updateField('fastCashRevenue', e.target.value)}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="members" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pifMembers">PIF Members</Label>
                  <Input
                    id="pifMembers"
                    type="number"
                    value={formData.pifMembers}
                    onChange={(e) => updateField('pifMembers', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="pifExits">PIF Exits</Label>
                  <Input
                    id="pifExits"
                    type="number"
                    value={formData.pifExits}
                    onChange={(e) => updateField('pifExits', e.target.value)}
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
                  <Label htmlFor="recurringGeneralMembers">Recurring General Members</Label>
                  <Input
                    id="recurringGeneralMembers"
                    type="number"
                    value={formData.recurringGeneralMembers}
                    onChange={(e) => updateField('recurringGeneralMembers', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="generalExits">General Exits</Label>
                  <Input
                    id="generalExits"
                    type="number"
                    value={formData.generalExits}
                    onChange={(e) => updateField('generalExits', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="ptMembers">PT Members</Label>
                  <Input
                    id="ptMembers"
                    type="number"
                    value={formData.ptMembers}
                    onChange={(e) => updateField('ptMembers', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="ptExits">PT Exits</Label>
                  <Input
                    id="ptExits"
                    type="number"
                    value={formData.ptExits}
                    onChange={(e) => updateField('ptExits', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="totalClasses">Total Classes</Label>
                  <Input
                    id="totalClasses"
                    type="number"
                    value={formData.totalClasses}
                    onChange={(e) => updateField('totalClasses', e.target.value)}
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
                  <Label htmlFor="callsMade">Calls Made</Label>
                  <Input
                    id="callsMade"
                    type="number"
                    value={formData.callsMade}
                    onChange={(e) => updateField('callsMade', e.target.value)}
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
                  <Label htmlFor="cashCollected">Cash Collected</Label>
                  <Input
                    id="cashCollected"
                    type="number"
                    value={formData.cashCollected}
                    onChange={(e) => updateField('cashCollected', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="organicLeads">Organic Leads</Label>
                  <Input
                    id="organicLeads"
                    type="number"
                    value={formData.organicLeads}
                    onChange={(e) => updateField('organicLeads', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="organicClose">Organic Close</Label>
                  <Input
                    id="organicClose"
                    type="number"
                    value={formData.organicClose}
                    onChange={(e) => updateField('organicClose', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="inTrial">En Essai</Label>
                  <Input
                    id="inTrial"
                    type="number"
                    value={formData.inTrial}
                    onChange={(e) => updateField('inTrial', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="trialEnding">Fin Essai</Label>
                  <Input
                    id="trialEnding"
                    type="number"
                    value={formData.trialEnding}
                    onChange={(e) => updateField('trialEnding', e.target.value)}
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
                  <Label htmlFor="adSpend">Ad Spend</Label>
                  <Input
                    id="adSpend"
                    type="number"
                    value={formData.adSpend}
                    onChange={(e) => updateField('adSpend', e.target.value)}
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
                  <Label htmlFor="repairsAndMaintenance">Repairs & Maintenance</Label>
                  <Input
                    id="repairsAndMaintenance"
                    type="number"
                    value={formData.repairsAndMaintenance}
                    onChange={(e) => updateField('repairsAndMaintenance', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="computerSoftware">Computer Software</Label>
                  <Input
                    id="computerSoftware"
                    type="number"
                    value={formData.computerSoftware}
                    onChange={(e) => updateField('computerSoftware', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="internetTelephone">Internet & Telephone</Label>
                  <Input
                    id="internetTelephone"
                    type="number"
                    value={formData.internetTelephone}
                    onChange={(e) => updateField('internetTelephone', e.target.value)}
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
                  <Label htmlFor="bankFinanceCharges">Bank/Finance Charges</Label>
                  <Input
                    id="bankFinanceCharges"
                    type="number"
                    value={formData.bankFinanceCharges}
                    onChange={(e) => updateField('bankFinanceCharges', e.target.value)}
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
