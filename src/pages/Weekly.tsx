import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { WeeklyKPI, getWeekInfo, createEmptyWeeklyKPI } from "@/types/weekly-kpi";
import { WeeklyDataInput } from "@/components/WeeklyDataInput";
import { EmailPreferences } from "@/components/EmailPreferences";
import { MetricCard } from "@/components/MetricCard";
import { DollarSign, Users, Target, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { VideoBackground } from "@/components/VideoBackground";
import { VideoSettings } from "@/components/VideoSettings";
import { Badge } from "@/components/ui/badge";

const Weekly = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isReadOnly = searchParams.get("view") === "readonly";
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [weekData, setWeekData] = useState<WeeklyKPI | null>(null);
  const { toast } = useToast();
  
  const [videoConfig, setVideoConfig] = useState(() => {
    const saved = localStorage.getItem("video-config");
    return saved ? JSON.parse(saved) : { url: "", overlayOpacity: 0.7, enabled: false };
  });

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
      <header className="border-b border-border/50 backdrop-blur-md sticky top-0 z-10">
        <VideoBackground 
          videoUrl={videoConfig.enabled ? videoConfig.url : undefined}
          overlayOpacity={videoConfig.overlayOpacity}
        >
          <div className="container mx-auto px-6 py-6">
            <div className="flex items-center justify-between gap-8">
              <div className="flex items-center gap-6 flex-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => navigate('/')}
                  className="hover:bg-foreground/5"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-4xl font-semibold tracking-tight text-display">
                      SUIVI HEBDOMADAIRE
                    </h1>
                    {isReadOnly && (
                      <Badge variant="outline" className="text-xs uppercase tracking-wider">
                        Lecture seule
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground text-sm tracking-wide">
                    Données semaine par semaine
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {!isReadOnly && (
                  <WeeklyDataInput 
                    weekData={weekData} 
                    weekLabel={`Semaine ${weekInfo.weekNumber}`} 
                    onSave={saveWeekData} 
                  />
                )}
                <VideoSettings onConfigChange={setVideoConfig} />
                <ThemeToggle />
              </div>
            </div>
            
            <div className="flex items-center justify-center gap-3 mt-6">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setCurrentWeekOffset(currentWeekOffset - 1)} 
                className="h-10 w-10 hover:bg-foreground/5"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3 px-6 py-2 bg-muted/50 rounded-lg min-w-[240px] justify-center">
                <span className="font-medium text-lg tracking-wide">
                  SEMAINE {weekInfo.weekNumber} · {weekInfo.year}
                </span>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setCurrentWeekOffset(currentWeekOffset + 1)} 
                className="h-10 w-10 hover:bg-foreground/5"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </VideoBackground>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-10">
        {!isReadOnly && <EmailPreferences />}
        
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
