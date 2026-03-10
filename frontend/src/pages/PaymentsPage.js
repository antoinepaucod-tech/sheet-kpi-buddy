import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { format, parseISO, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import {
  CreditCard,
  Plus,
  AlertTriangle,
  Check,
  Clock,
  X,
  Search,
  Calendar,
  DollarSign,
  RefreshCw,
  Mail,
  Trash2,
  Filter,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { toast } from "sonner";
import { useTranslations } from "../hooks/useTranslations";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PAYMENT_METHODS = [
  { value: "prelevement", label: "Prélèvement automatique" },
  { value: "carte", label: "Carte bancaire" },
  { value: "virement", label: "Virement" },
  { value: "especes", label: "Espèces" },
];

const RECURRENCE_TYPES = [
  { value: "monthly_day", label: "Jour fixe du mois" },
  { value: "interval_days", label: "Tous les X jours" },
];

const STATUS_CONFIG = {
  pending: { label: "En attente", color: "bg-blue-500/20 text-blue-400", icon: Clock },
  paid: { label: "Payé", color: "bg-emerald-500/20 text-emerald-400", icon: Check },
  late: { label: "En retard", color: "bg-red-500/20 text-red-400", icon: AlertTriangle },
  failed: { label: "Échoué", color: "bg-orange-500/20 text-orange-400", icon: X },
  cancelled: { label: "Annulé", color: "bg-white/10 text-white/50", icon: X },
};

export default function PaymentsPage() {
  const { lang } = useTranslations();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("payments");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [markPaidModalOpen, setMarkPaidModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [generateMonth, setGenerateMonth] = useState(format(new Date(), "yyyy-MM"));
  
  const [scheduleForm, setScheduleForm] = useState({
    member_id: "",
    amount: 0,
    recurrence_type: "monthly_day",
    recurrence_value: 1,
    start_date: format(new Date(), "yyyy-MM-dd"),
    payment_method: "prelevement",
  });
  
  const [paymentForm, setPaymentForm] = useState({
    member_id: "",
    amount: 0,
    due_date: format(new Date(), "yyyy-MM-dd"),
    payment_method: "prelevement",
  });

  // Fetch data
  const { data: payments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ["payments"],
    queryFn: () => axios.get(`${API}/payments`).then((r) => r.data),
  });

  const { data: latePayments = [] } = useQuery({
    queryKey: ["payments", "late"],
    queryFn: () => axios.get(`${API}/payments/late`).then((r) => r.data),
  });

  const { data: upcomingPayments = [] } = useQuery({
    queryKey: ["payments", "upcoming"],
    queryFn: () => axios.get(`${API}/payments/upcoming?days=14`).then((r) => r.data),
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ["payment-schedules"],
    queryFn: () => axios.get(`${API}/payment-schedules`).then((r) => r.data),
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: () => axios.get(`${API}/members`).then((r) => r.data),
  });

  // Mutations
  const createScheduleMutation = useMutation({
    mutationFn: (data) => axios.post(`${API}/payment-schedules`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["payment-schedules"]);
      setScheduleModalOpen(false);
      toast.success("Planning créé");
    },
    onError: () => toast.error("Erreur"),
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: (id) => axios.delete(`${API}/payment-schedules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(["payment-schedules"]);
      toast.success("Planning supprimé");
    },
  });

  const createPaymentMutation = useMutation({
    mutationFn: (data) => axios.post(`${API}/payments`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["payments"]);
      setPaymentModalOpen(false);
      toast.success("Paiement créé");
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: ({ id, data }) => axios.post(`${API}/payments/${id}/mark-paid`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["payments"]);
      setMarkPaidModalOpen(false);
      toast.success("Paiement marqué comme payé");
    },
  });

  const deletePaymentMutation = useMutation({
    mutationFn: (id) => axios.delete(`${API}/payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(["payments"]);
      toast.success("Paiement supprimé");
    },
  });

  const generatePaymentsMutation = useMutation({
    mutationFn: ({ year, month }) => axios.post(`${API}/payments/generate/${year}/${month}`),
    onSuccess: (res) => {
      queryClient.invalidateQueries(["payments"]);
      toast.success(`${res.data.created} paiements générés`);
    },
    onError: () => toast.error("Erreur lors de la génération"),
  });

  // Filter payments
  const filteredPayments = useMemo(() => {
    let result = payments;
    
    if (filterStatus !== "all") {
      result = result.filter((p) => p.status === filterStatus);
    }
    
    if (search) {
      const s = search.toLowerCase();
      result = result.filter((p) => 
        p.member_name?.toLowerCase().includes(s) ||
        p.reference?.toLowerCase().includes(s)
      );
    }
    
    return result;
  }, [payments, filterStatus, search]);

  // Enrich payments with member names
  const enrichedPayments = useMemo(() => {
    return filteredPayments.map((p) => {
      const member = members.find((m) => m.id === p.member_id);
      return { ...p, member_name: member?.name || "Inconnu" };
    });
  }, [filteredPayments, members]);

  // Stats
  const stats = useMemo(() => ({
    total: payments.length,
    late: latePayments.length,
    pending: payments.filter((p) => p.status === "pending").length,
    paid: payments.filter((p) => p.status === "paid").length,
    totalAmount: payments.reduce((sum, p) => sum + (p.amount || 0), 0),
    lateAmount: latePayments.reduce((sum, p) => sum + (p.amount || 0), 0),
  }), [payments, latePayments]);

  const openMarkPaid = (payment) => {
    setSelectedPayment(payment);
    setMarkPaidModalOpen(true);
  };

  const handleGenerate = () => {
    const [year, month] = generateMonth.split("-");
    generatePaymentsMutation.mutate({ year: parseInt(year), month: parseInt(month) });
  };

  const getMemberName = (memberId) => {
    const member = members.find((m) => m.id === memberId);
    return member?.name || "Inconnu";
  };

  return (
    <div className="space-y-6" data-testid="payments-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <CreditCard className="text-green-500" />
            {lang === "fr" ? "Suivi des Paiements" : "Payment Tracking"}
          </h1>
          <p className="text-white/50 text-sm mt-1">
            {lang === "fr" ? "Gestion des paiements et alertes" : "Payment management and alerts"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setPaymentModalOpen(true)} variant="outline" className="border-white/20 text-white">
            <Plus size={16} className="mr-2" />
            Paiement manuel
          </Button>
          <Button onClick={() => setScheduleModalOpen(true)} className="bg-green-600 hover:bg-green-700" data-testid="add-schedule-btn">
            <Plus size={16} className="mr-2" />
            Nouveau planning
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-[#1C1C1E] rounded-lg p-4 border border-white/10">
          <p className="text-white/50 text-xs uppercase">Total paiements</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="bg-[#1C1C1E] rounded-lg p-4 border border-red-500/30 cursor-pointer hover:border-red-500" onClick={() => setFilterStatus(filterStatus === 'late' ? 'all' : 'late')}>
          <p className="text-red-400 text-xs uppercase flex items-center gap-1">
            <AlertTriangle size={12} /> En retard
          </p>
          <p className="text-2xl font-bold text-red-400">{stats.late}</p>
        </div>
        <div className="bg-[#1C1C1E] rounded-lg p-4 border border-white/10 cursor-pointer hover:border-blue-500/50" onClick={() => setFilterStatus(filterStatus === 'pending' ? 'all' : 'pending')}>
          <p className="text-blue-400 text-xs uppercase">En attente</p>
          <p className="text-2xl font-bold text-blue-400">{stats.pending}</p>
        </div>
        <div className="bg-[#1C1C1E] rounded-lg p-4 border border-white/10">
          <p className="text-emerald-400 text-xs uppercase">Payés</p>
          <p className="text-2xl font-bold text-emerald-400">{stats.paid}</p>
        </div>
        <div className="bg-[#1C1C1E] rounded-lg p-4 border border-white/10">
          <p className="text-white/50 text-xs uppercase flex items-center gap-1">
            <DollarSign size={12} /> Montant en retard
          </p>
          <p className="text-2xl font-bold text-red-400">{stats.lateAmount.toLocaleString("fr-CH")} CHF</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[#1C1C1E] border border-white/10">
          <TabsTrigger value="payments" className="data-[state=active]:bg-green-600">Paiements</TabsTrigger>
          <TabsTrigger value="late" className="data-[state=active]:bg-red-600">En retard ({stats.late})</TabsTrigger>
          <TabsTrigger value="upcoming" className="data-[state=active]:bg-blue-600">À venir ({upcomingPayments.length})</TabsTrigger>
          <TabsTrigger value="schedules" className="data-[state=active]:bg-purple-600">Plannings ({schedules.length})</TabsTrigger>
        </TabsList>

        {/* All Payments Tab */}
        <TabsContent value="payments" className="space-y-4">
          {/* Filters & Generate */}
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="pl-10 bg-[#1C1C1E] border-white/10 text-white"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[160px] bg-[#1C1C1E] border-white/10 text-white">
                <Filter size={14} className="mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1C1C1E] border-white/10">
                <SelectItem value="all" className="text-white">Tous</SelectItem>
                <SelectItem value="pending" className="text-white">En attente</SelectItem>
                <SelectItem value="paid" className="text-white">Payés</SelectItem>
                <SelectItem value="late" className="text-white">En retard</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2 items-center">
              <Input
                type="month"
                value={generateMonth}
                onChange={(e) => setGenerateMonth(e.target.value)}
                className="w-[160px] bg-[#1C1C1E] border-white/10 text-white"
              />
              <Button onClick={handleGenerate} variant="outline" className="border-white/20 text-white" disabled={generatePaymentsMutation.isPending}>
                <RefreshCw size={14} className={`mr-2 ${generatePaymentsMutation.isPending ? 'animate-spin' : ''}`} />
                Générer
              </Button>
            </div>
          </div>

          {/* Payments Table */}
          <div className="bg-[#1C1C1E] rounded-lg border border-white/10 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-white/50">Membre</TableHead>
                  <TableHead className="text-white/50">Échéance</TableHead>
                  <TableHead className="text-white/50">Montant</TableHead>
                  <TableHead className="text-white/50">Méthode</TableHead>
                  <TableHead className="text-white/50">Statut</TableHead>
                  <TableHead className="text-white/50">Date paiement</TableHead>
                  <TableHead className="text-white/50 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingPayments ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-white/50 py-8">Chargement...</TableCell>
                  </TableRow>
                ) : enrichedPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-white/50 py-8">Aucun paiement</TableCell>
                  </TableRow>
                ) : (
                  enrichedPayments.map((payment) => {
                    const StatusIcon = STATUS_CONFIG[payment.status]?.icon || Clock;
                    const daysLate = payment.status === "late" ? differenceInDays(new Date(), parseISO(payment.due_date)) : 0;
                    
                    return (
                      <TableRow key={payment.id} className="border-white/10 hover:bg-white/5" data-testid={`payment-${payment.id}`}>
                        <TableCell className="text-white font-medium">{payment.member_name}</TableCell>
                        <TableCell className="text-white/70">
                          {format(parseISO(payment.due_date), "dd MMM yyyy", { locale: fr })}
                        </TableCell>
                        <TableCell className="text-white font-medium">{payment.amount?.toLocaleString("fr-CH")} CHF</TableCell>
                        <TableCell className="text-white/70">
                          {PAYMENT_METHODS.find((m) => m.value === payment.payment_method)?.label || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${STATUS_CONFIG[payment.status]?.color} border-0`}>
                            <StatusIcon size={12} className="mr-1" />
                            {STATUS_CONFIG[payment.status]?.label}
                            {daysLate > 0 && <span className="ml-1">({daysLate}j)</span>}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-white/70">
                          {payment.paid_date ? format(parseISO(payment.paid_date), "dd/MM/yyyy") : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {payment.status !== "paid" && (
                              <Button
                                size="sm"
                                onClick={() => openMarkPaid(payment)}
                                className="bg-emerald-600 hover:bg-emerald-700"
                                data-testid={`mark-paid-${payment.id}`}
                              >
                                <Check size={14} className="mr-1" /> Payé
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deletePaymentMutation.mutate(payment.id)}
                              className="text-red-400 hover:text-red-300"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Late Payments Tab */}
        <TabsContent value="late" className="space-y-4">
          <div className="bg-[#1C1C1E] rounded-lg border border-red-500/30 overflow-hidden">
            <div className="p-4 border-b border-white/10 bg-red-500/10">
              <h3 className="text-red-400 font-medium flex items-center gap-2">
                <AlertTriangle size={18} />
                Paiements en retard - Action requise
              </h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-white/10">
                  <TableHead className="text-white/50">Membre</TableHead>
                  <TableHead className="text-white/50">Contact</TableHead>
                  <TableHead className="text-white/50">Échéance</TableHead>
                  <TableHead className="text-white/50">Retard</TableHead>
                  <TableHead className="text-white/50">Montant</TableHead>
                  <TableHead className="text-white/50 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {latePayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-emerald-400 py-8">
                      <Check size={24} className="mx-auto mb-2" />
                      Aucun paiement en retard
                    </TableCell>
                  </TableRow>
                ) : (
                  latePayments.map((payment) => {
                    const daysLate = differenceInDays(new Date(), parseISO(payment.due_date));
                    return (
                      <TableRow key={payment.id} className="border-white/10 hover:bg-white/5">
                        <TableCell className="text-white font-medium">{payment.member_name}</TableCell>
                        <TableCell>
                          <div className="text-white/70 text-sm">
                            <p>{payment.member_email}</p>
                            <p>{payment.member_phone}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-white/70">
                          {format(parseISO(payment.due_date), "dd MMM yyyy", { locale: fr })}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-red-500/20 text-red-400 border-0">
                            {daysLate} jours
                          </Badge>
                        </TableCell>
                        <TableCell className="text-red-400 font-bold">{payment.amount?.toLocaleString("fr-CH")} CHF</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" className="border-white/20 text-white">
                              <Mail size={14} className="mr-1" /> Relancer
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => openMarkPaid(payment)}
                              className="bg-emerald-600 hover:bg-emerald-700"
                            >
                              <Check size={14} className="mr-1" /> Payé
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Upcoming Payments Tab */}
        <TabsContent value="upcoming" className="space-y-4">
          <div className="bg-[#1C1C1E] rounded-lg border border-blue-500/30 overflow-hidden">
            <div className="p-4 border-b border-white/10 bg-blue-500/10">
              <h3 className="text-blue-400 font-medium flex items-center gap-2">
                <Calendar size={18} />
                Paiements à venir (14 jours)
              </h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-white/10">
                  <TableHead className="text-white/50">Membre</TableHead>
                  <TableHead className="text-white/50">Échéance</TableHead>
                  <TableHead className="text-white/50">Dans</TableHead>
                  <TableHead className="text-white/50">Montant</TableHead>
                  <TableHead className="text-white/50">Méthode</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-white/50 py-8">
                      Aucun paiement à venir
                    </TableCell>
                  </TableRow>
                ) : (
                  upcomingPayments.map((payment) => {
                    const daysUntil = differenceInDays(parseISO(payment.due_date), new Date());
                    return (
                      <TableRow key={payment.id} className="border-white/10 hover:bg-white/5">
                        <TableCell className="text-white font-medium">{payment.member_name}</TableCell>
                        <TableCell className="text-white/70">
                          {format(parseISO(payment.due_date), "dd MMM yyyy", { locale: fr })}
                        </TableCell>
                        <TableCell>
                          <Badge className={daysUntil <= 3 ? "bg-orange-500/20 text-orange-400" : "bg-blue-500/20 text-blue-400"}>
                            {daysUntil} jours
                          </Badge>
                        </TableCell>
                        <TableCell className="text-white font-medium">{payment.amount?.toLocaleString("fr-CH")} CHF</TableCell>
                        <TableCell className="text-white/70">
                          {PAYMENT_METHODS.find((m) => m.value === payment.payment_method)?.label || "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Schedules Tab */}
        <TabsContent value="schedules" className="space-y-4">
          <div className="bg-[#1C1C1E] rounded-lg border border-white/10 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10">
                  <TableHead className="text-white/50">Membre</TableHead>
                  <TableHead className="text-white/50">Montant</TableHead>
                  <TableHead className="text-white/50">Récurrence</TableHead>
                  <TableHead className="text-white/50">Méthode</TableHead>
                  <TableHead className="text-white/50">Début</TableHead>
                  <TableHead className="text-white/50">Statut</TableHead>
                  <TableHead className="text-white/50 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-white/50 py-8">
                      Aucun planning de paiement
                    </TableCell>
                  </TableRow>
                ) : (
                  schedules.map((schedule) => (
                    <TableRow key={schedule.id} className="border-white/10 hover:bg-white/5" data-testid={`schedule-${schedule.id}`}>
                      <TableCell className="text-white font-medium">{getMemberName(schedule.member_id)}</TableCell>
                      <TableCell className="text-white font-medium">{schedule.amount?.toLocaleString("fr-CH")} CHF</TableCell>
                      <TableCell className="text-white/70">
                        {schedule.recurrence_type === "monthly_day"
                          ? `Le ${schedule.recurrence_value} du mois`
                          : `Tous les ${schedule.recurrence_value} jours`}
                      </TableCell>
                      <TableCell className="text-white/70">
                        {PAYMENT_METHODS.find((m) => m.value === schedule.payment_method)?.label || "-"}
                      </TableCell>
                      <TableCell className="text-white/70">
                        {schedule.start_date ? format(parseISO(schedule.start_date), "dd/MM/yyyy") : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge className={schedule.is_active ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-white/50"}>
                          {schedule.is_active ? "Actif" : "Inactif"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteScheduleMutation.mutate(schedule.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Schedule Modal */}
      <Dialog open={scheduleModalOpen} onOpenChange={setScheduleModalOpen}>
        <DialogContent className="bg-[#1C1C1E] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Nouveau planning de paiement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-white/50 text-xs uppercase">Membre *</label>
              <Select value={scheduleForm.member_id} onValueChange={(v) => setScheduleForm({ ...scheduleForm, member_id: v })}>
                <SelectTrigger className="bg-[#121214] border-white/10 text-white mt-1" data-testid="schedule-member-select">
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent className="bg-[#1C1C1E] border-white/10">
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-white">{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-white/50 text-xs uppercase">Montant (CHF) *</label>
                <Input
                  type="number"
                  value={scheduleForm.amount}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, amount: parseFloat(e.target.value) || 0 })}
                  className="bg-[#121214] border-white/10 text-white mt-1"
                />
              </div>
              <div>
                <label className="text-white/50 text-xs uppercase">Méthode</label>
                <Select value={scheduleForm.payment_method} onValueChange={(v) => setScheduleForm({ ...scheduleForm, payment_method: v })}>
                  <SelectTrigger className="bg-[#121214] border-white/10 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1C1C1E] border-white/10">
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value} className="text-white">{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-white/50 text-xs uppercase">Type de récurrence</label>
                <Select value={scheduleForm.recurrence_type} onValueChange={(v) => setScheduleForm({ ...scheduleForm, recurrence_type: v })}>
                  <SelectTrigger className="bg-[#121214] border-white/10 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1C1C1E] border-white/10">
                    {RECURRENCE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value} className="text-white">{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-white/50 text-xs uppercase">
                  {scheduleForm.recurrence_type === "monthly_day" ? "Jour du mois (1-28)" : "Intervalle (jours)"}
                </label>
                <Input
                  type="number"
                  min={1}
                  max={scheduleForm.recurrence_type === "monthly_day" ? 28 : 365}
                  value={scheduleForm.recurrence_value}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, recurrence_value: parseInt(e.target.value) || 1 })}
                  className="bg-[#121214] border-white/10 text-white mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-white/50 text-xs uppercase">Date de début</label>
              <Input
                type="date"
                value={scheduleForm.start_date}
                onChange={(e) => setScheduleForm({ ...scheduleForm, start_date: e.target.value })}
                className="bg-[#121214] border-white/10 text-white mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setScheduleModalOpen(false)}>Annuler</Button>
            <Button
              onClick={() => createScheduleMutation.mutate(scheduleForm)}
              disabled={!scheduleForm.member_id || !scheduleForm.amount || createScheduleMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {createScheduleMutation.isPending ? "..." : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Paid Modal */}
      <Dialog open={markPaidModalOpen} onOpenChange={setMarkPaidModalOpen}>
        <DialogContent className="bg-[#1C1C1E] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="text-emerald-400" />
              Marquer comme payé
            </DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4 py-4">
              <div className="bg-[#121214] rounded-lg p-4">
                <p className="text-white font-medium">{getMemberName(selectedPayment.member_id)}</p>
                <p className="text-white/50 text-sm">Montant: {selectedPayment.amount?.toLocaleString("fr-CH")} CHF</p>
                <p className="text-white/50 text-sm">Échéance: {format(parseISO(selectedPayment.due_date), "dd/MM/yyyy")}</p>
              </div>
              <div>
                <label className="text-white/50 text-xs uppercase">Date de paiement</label>
                <Input
                  type="date"
                  defaultValue={format(new Date(), "yyyy-MM-dd")}
                  className="bg-[#121214] border-white/10 text-white mt-1"
                  id="paid-date-input"
                />
              </div>
              <div>
                <label className="text-white/50 text-xs uppercase">Référence (optionnel)</label>
                <Input
                  placeholder="N° de transaction..."
                  className="bg-[#121214] border-white/10 text-white mt-1"
                  id="reference-input"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMarkPaidModalOpen(false)}>Annuler</Button>
            <Button
              onClick={() => {
                const paidDate = document.getElementById("paid-date-input")?.value;
                const reference = document.getElementById("reference-input")?.value;
                markPaidMutation.mutate({
                  id: selectedPayment?.id,
                  data: { paid_date: paidDate, reference }
                });
              }}
              disabled={markPaidMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {markPaidMutation.isPending ? "..." : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Payment Modal */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="bg-[#1C1C1E] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Ajouter un paiement manuel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-white/50 text-xs uppercase">Membre *</label>
              <Select value={paymentForm.member_id} onValueChange={(v) => setPaymentForm({ ...paymentForm, member_id: v })}>
                <SelectTrigger className="bg-[#121214] border-white/10 text-white mt-1">
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent className="bg-[#1C1C1E] border-white/10">
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-white">{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-white/50 text-xs uppercase">Montant (CHF) *</label>
                <Input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })}
                  className="bg-[#121214] border-white/10 text-white mt-1"
                />
              </div>
              <div>
                <label className="text-white/50 text-xs uppercase">Date d'échéance</label>
                <Input
                  type="date"
                  value={paymentForm.due_date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, due_date: e.target.value })}
                  className="bg-[#121214] border-white/10 text-white mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPaymentModalOpen(false)}>Annuler</Button>
            <Button
              onClick={() => createPaymentMutation.mutate(paymentForm)}
              disabled={!paymentForm.member_id || !paymentForm.amount || createPaymentMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {createPaymentMutation.isPending ? "..." : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
