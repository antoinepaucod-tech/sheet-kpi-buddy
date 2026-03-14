import { useState, useEffect } from "react";
import { useGHL } from "@/hooks/useGHL";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, DollarSign, Calendar, Users, ArrowRight, Phone, Mail } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const GoHighLevel = () => {
  const {
    isLoading,
    pipelines,
    opportunities,
    calendars,
    appointments,
    fetchPipelines,
    fetchOpportunities,
    fetchCalendars,
    fetchAppointments,
  } = useGHL();

  const [locationId, setLocationId] = useState("");
  const [selectedPipeline, setSelectedPipeline] = useState<string>("");
  const [selectedCalendar, setSelectedCalendar] = useState<string>("");
  const [isConfigured, setIsConfigured] = useState(false);

  const handleConnect = async () => {
    if (!locationId.trim()) return;
    setIsConfigured(true);
    // Fetch all data in parallel
    await Promise.all([
      fetchPipelines(locationId),
      fetchCalendars(locationId),
    ]);
  };

  useEffect(() => {
    if (isConfigured && locationId && pipelines.length > 0 && !selectedPipeline) {
      setSelectedPipeline(pipelines[0].id);
      fetchOpportunities(locationId, pipelines[0].id);
    }
  }, [pipelines, isConfigured]);

  useEffect(() => {
    if (selectedPipeline && locationId) {
      fetchOpportunities(locationId, selectedPipeline);
    }
  }, [selectedPipeline]);

  useEffect(() => {
    if (isConfigured && locationId && calendars.length > 0 && !selectedCalendar) {
      setSelectedCalendar(calendars[0].id);
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
      fetchAppointments(locationId, calendars[0].id, startOfMonth, endOfMonth);
    }
  }, [calendars, isConfigured]);

  const handleRefresh = () => {
    if (!locationId) return;
    fetchPipelines(locationId);
    fetchCalendars(locationId);
    if (selectedPipeline) fetchOpportunities(locationId, selectedPipeline);
    if (selectedCalendar) {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
      fetchAppointments(locationId, selectedCalendar, startOfMonth, endOfMonth);
    }
  };

  const currentPipeline = pipelines.find(p => p.id === selectedPipeline);

  const getStageOpportunities = (stageId: string) => {
    return opportunities.filter(o => o.pipelineStageId === stageId);
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'won': return 'bg-success/10 text-success border-success/20';
      case 'lost': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'open': return 'bg-primary/10 text-primary border-primary/20';
      case 'confirmed': return 'bg-success/10 text-success border-success/20';
      case 'cancelled': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'showed': return 'bg-success/10 text-success border-success/20';
      case 'noshow': return 'bg-warning/10 text-warning border-warning/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const totalOpportunityValue = opportunities.reduce((sum, o) => sum + (o.monetaryValue || 0), 0);

  if (!isConfigured) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-heading">Go High Level</h1>
          <p className="text-muted-foreground mt-1">Connectez votre compte GHL</p>
        </div>

        <Card className="max-w-md mx-auto mt-12">
          <CardHeader>
            <CardTitle className="text-lg">Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Location ID (Sub-Account ID)
              </label>
              <Input
                placeholder="Ex: abc123XYZ..."
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Trouvez-le dans Settings → Business Profile de votre sous-compte GHL
              </p>
            </div>
            <Button onClick={handleConnect} disabled={!locationId.trim()} className="w-full">
              Connecter
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-heading">Go High Level</h1>
          <p className="text-muted-foreground mt-1">Opportunités & Rendez-vous</p>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm" disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Opportunités</p>
              <p className="text-2xl font-bold text-foreground">{opportunities.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Valeur totale</p>
              <p className="text-2xl font-bold text-foreground">
                {totalOpportunityValue.toLocaleString('fr-CH')} CHF
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">RDV ce mois</p>
              <p className="text-2xl font-bold text-foreground">{appointments.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pipeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="appointments">Rendez-vous</TabsTrigger>
        </TabsList>

        {/* Pipeline Tab */}
        <TabsContent value="pipeline" className="space-y-4">
          {pipelines.length > 1 && (
            <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Sélectionner un pipeline" />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-64 rounded-lg" />
              ))}
            </div>
          ) : currentPipeline ? (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {currentPipeline.stages
                .sort((a, b) => a.position - b.position)
                .map((stage) => {
                  const stageOpps = getStageOpportunities(stage.id);
                  return (
                    <div key={stage.id} className="min-w-[280px] flex-shrink-0">
                      <div className="bg-muted/50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-medium text-sm text-foreground">{stage.name}</h3>
                          <Badge variant="secondary" className="text-xs">
                            {stageOpps.length}
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          {stageOpps.map(opp => (
                            <Card key={opp.id} className="shadow-sm">
                              <CardContent className="p-3 space-y-2">
                                <p className="font-medium text-sm text-foreground">{opp.name}</p>
                                {opp.contact?.name && (
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {opp.contact.name}
                                  </p>
                                )}
                                {opp.contact?.phone && (
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {opp.contact.phone}
                                  </p>
                                )}
                                {opp.monetaryValue ? (
                                  <p className="text-xs font-semibold text-success">
                                    {opp.monetaryValue.toLocaleString('fr-CH')} CHF
                                  </p>
                                ) : null}
                                <Badge className={`text-xs ${getStatusColor(opp.status)}`}>
                                  {opp.status}
                                </Badge>
                              </CardContent>
                            </Card>
                          ))}
                          {stageOpps.length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-4">
                              Aucune opportunité
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">Aucun pipeline trouvé</p>
          )}
        </TabsContent>

        {/* Appointments Tab */}
        <TabsContent value="appointments" className="space-y-4">
          {calendars.length > 1 && (
            <Select value={selectedCalendar} onValueChange={(val) => {
              setSelectedCalendar(val);
              const now = new Date();
              const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
              const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
              fetchAppointments(locationId, val, startOfMonth, endOfMonth);
            }}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Sélectionner un calendrier" />
              </SelectTrigger>
              <SelectContent>
                {calendars.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : appointments.length > 0 ? (
            <div className="space-y-3">
              {appointments
                .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                .map(apt => (
                  <Card key={apt.id}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Calendar className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm text-foreground">{apt.title || 'Rendez-vous'}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <span>
                              {format(new Date(apt.startTime), "EEEE d MMMM 'à' HH:mm", { locale: fr })}
                            </span>
                            <ArrowRight className="h-3 w-3" />
                            <span>
                              {format(new Date(apt.endTime), "HH:mm", { locale: fr })}
                            </span>
                          </div>
                          {apt.contact?.name && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Users className="h-3 w-3" /> {apt.contact.name}
                              </span>
                              {apt.contact?.email && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Mail className="h-3 w-3" /> {apt.contact.email}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <Badge className={`text-xs ${getStatusColor(apt.appointmentStatus)}`}>
                        {apt.appointmentStatus}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">Aucun rendez-vous ce mois</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GoHighLevel;
