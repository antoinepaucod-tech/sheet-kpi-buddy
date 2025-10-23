import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { WeeklyKPI, getWeekInfo, createEmptyWeeklyKPI } from "@/types/weekly-kpi";
import { WeeklyDataInput } from "@/components/WeeklyDataInput";
import { EmailPreferences } from "@/components/EmailPreferences";
import { MetricCard } from "@/components/MetricCard";
import { DollarSign, Users, Target, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Weekly = () => {
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [weekData, setWeekData] = useState<WeeklyKPI | null>(null);
  const { toast } = useToast();

  const getCurrentWeek = () => {
    const date = new Date();
    date.setDate(date.getDate() + currentWeekOffset * 7);
    return getWeekInfo(date);
  };

  const weekInfo = getCurrentWeek();

  useEffect(() => {
    loadWeekData();
  }, [currentWeekOffset]);

  const loadWeekData = async () => {
    const { data } = await supabase
      .from("weekly_kpis")
      .select("*")
      .eq("year", weekInfo.year)
      .eq("week_number", weekInfo.weekNumber)
      .single();

    if (data) {
      setWeekData(data as WeeklyKPI);
    } else {
      setWeekData(createEmptyWeeklyKPI(weekInfo.year, weekInfo.weekNumber, weekInfo.weekStartDate, weekInfo.weekEndDate));
    }
  };

  const saveWeekData = async (data: WeeklyKPI) => {
    const total_revenue = data.general_eft_revenue + data.pt_revenue + data.retail_revenue + data.fast_cash_revenue;
    
    const { error } = await supabase
      .from("weekly_kpis")
      .upsert({
        ...data,
        total_revenue,
        year: weekInfo.year,
        week_number: weekInfo.weekNumber,
      });

    if (error) {
      toast({ title: "Erreur", description: "Impossible de sauvegarder", variant: "destructive" });
    } else {
      toast({ title: "Sauvegardé", description: "Données mises à jour avec succès" });
      loadWeekData();
    }
  };

  if (!weekData) return null;

  const formatCurrency = (val: number) => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 }).format(val);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Suivi Hebdomadaire
              </h1>
              <p className="text-muted-foreground mt-1">Données semaine par semaine</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-2">
                <Button variant="ghost" size="icon" onClick={() => setCurrentWeekOffset(currentWeekOffset - 1)} className="h-8 w-8">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-semibold min-w-[200px] text-center">
                  Semaine {weekInfo.weekNumber} - {weekInfo.year}
                </span>
                <Button variant="ghost" size="icon" onClick={() => setCurrentWeekOffset(currentWeekOffset + 1)} className="h-8 w-8">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <WeeklyDataInput weekData={weekData} weekLabel={`Semaine ${weekInfo.weekNumber}`} onSave={saveWeekData} />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <EmailPreferences />
        
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="Revenu Total" value={formatCurrency(weekData.total_revenue)} icon={DollarSign} variant="default" />
          <MetricCard title="Membres Actifs" value={weekData.recurring_general_members + weekData.pif_members} icon={Users} variant="default" />
          <MetricCard title="Leads" value={weekData.leads} icon={Target} variant="default" />
          <MetricCard title="Close" value={weekData.close} icon={TrendingUp} variant="success" />
        </section>
      </main>
    </div>
  );
};

export default Weekly;
