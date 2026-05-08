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
  RotateCcw,
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
import { RevertPaymentDialog } from "../components/RevertPaymentDialog";

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
  pending: { label: "En attente", color: "bg-[rgba(10,132,255,0.15)] text-[var(--color-accent)]", icon: Clock },
  paid: { label: "Payé", color: "bg-[rgba(10,132,255,0.15)] text-[var(--color-accent)]", icon: Check },
  late: { label: "En retard", color: "bg-[rgba(255,69,58,0.15)] text-[var(--color-danger)]", icon: AlertTriangle },
  failed: { label: "Échoué", color: "bg-[rgba(255,214,10,0.15)] text-[var(--color-warning)]", icon: X },
  cancelled: { label: "Annulé", color: "bg-[rgba(255,255,255,0.1)] text-[var(--color-text-secondary)]", icon: X },
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
  const [revertPaymentDialog, setRevertPaymentDialog] = useState({ open: false, payment: null });
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
    queryFn: () => axios.get(`${API}/payments/upcoming?days=7`).then((r) => r.data),
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
  // Helper: synchronously patch the cached payments arrays with an updated payment
  // (so the table re-renders <100ms instead of waiting for the network refetch).
  // Uses setQueriesData with prefix-match so any parameterized variant of the
  // ['payments', ...] queryKey is patched (defensive — currently we use plain ['payments']).
  const patchPaymentInCache = (updated) => {
    if (!updated?.id) return;
    queryClient.setQueriesData({ queryKey: ["payments"] }, (list) =>
      Array.isArray(list)
        ? list.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
        : list
    );
  };

  const removePaymentFromCache = (id) => {
    if (!id) return;
    queryClient.setQueriesData({ queryKey: ["payments"] }, (list) =>
      Array.isArray(list) ? list.filter((p) => p.id !== id) : list
    );
  };

  const createScheduleMutation = useMutation({
    mutationFn: (data) => axios.post(`${API}/payment-schedules`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-schedules"] });
      setScheduleModalOpen(false);
      toast.success("Planning créé");
    },
    onError: () => toast.error("Erreur"),
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: (id) => axios.delete(`${API}/payment-schedules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-schedules"] });
      toast.success("Planning supprimé");
    },
  });

  const createPaymentMutation = useMutation({
    mutationFn: (data) => axios.post(`${API}/payments`, data),
    onSuccess: () => {
      // Creation may produce one or more payment rows; rely on refetch.
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      setPaymentModalOpen(false);
      toast.success("Paiement créé");
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: ({ id, data }) => axios.post(`${API}/payments/${id}/mark-paid`, data),
    onSuccess: (res) => {
      // Synchronous cache patch so the row badge swaps from Impayé/En retard → Payé instantly.
      patchPaymentInCache(res?.data);
      // Eventual server reconciliation (fire-and-forget)
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      setMarkPaidModalOpen(false);
      toast.success("Paiement marqué comme payé");
    },
  });

  const revertPaymentMutation = useMutation({
    mutationFn: async ({ id, sendEmail, memberEmail }) => {
      const res = await axios.post(`${API}/payments/${id}/revert-to-unpaid`);
      let mailStatus = "skipped";
      let mailError = null;
      if (sendEmail) {
        try {
          await axios.post(`${API}/notifications/send-payment-reminder/${id}`);
          mailStatus = "sent";
        } catch (e) {
          mailStatus = "failed";
          mailError = e.response?.data?.detail || "Erreur d'envoi du mail";
        }
      }
      return { payment: res.data, mailStatus, mailError, memberEmail };
    },
    onSuccess: ({ payment, mailStatus, mailError, memberEmail }) => {
      // Synchronous cache patch (instant UI swap) + eventual server reconciliation.
      patchPaymentInCache(payment);
      queryClient.invalidateQueries({ queryKey: ["payments"] });

      const newStatus = payment?.status === "late" ? "en retard" : "en attente";
      toast.success(`Paiement repassé en ${newStatus}`);
      if (mailStatus === "sent") {
        toast.success(`Mail de relance envoyé${memberEmail ? ` à ${memberEmail}` : ""}`);
      } else if (mailStatus === "failed") {
        toast.warning(`Paiement modifié mais erreur d'envoi du mail : ${mailError}. À renvoyer manuellement.`);
      }
      setRevertPaymentDialog({ open: false, payment: null });
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || "Erreur lors du retour en impayé");
    },
  });

  const sendReminderMutation = useMutation({
    mutationFn: (paymentId) => axios.post(`${API}/notifications/send-payment-reminder/${paymentId}`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      toast.success(res.data.message);
    },
    onError: (err) => toast.error(err.response?.data?.detail || "Erreur d'envoi"),
  });

  const deletePaymentMutation = useMutation({
    mutationFn: (id) => axios.delete(`${API}/payments/${id}`),
    onSuccess: (_res, id) => {
      // Synchronous cache patch so the row disappears instantly.
      removePaymentFromCache(id);
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      toast.success("Paiement supprimé");
    },
  });

  const generatePaymentsMutation = useMutation({
    mutationFn: ({ year, month }) => axios.post(`${API}/payments/generate/${year}/${month}`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
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
    upcomingAmount: upcomingPayments.reduce((sum, p) => sum + (p.amount || 0), 0),
    schedulesAmount: schedules.filter(s => s.is_active).reduce((sum, s) => sum + (s.amount || 0), 0),
    activeSchedules: schedules.filter(s => s.is_active).length,
  }), [payments, latePayments, upcomingPayments, schedules]);

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
          <h1 className="tf-page-header">
            {lang === "fr" ? "Suivi des Paiements" : "Payment Tracking"}
          </h1>
          <p className="tf-page-subtitle">
            {lang === "fr" ? "Gestion des paiements et alertes" : "Payment management and alerts"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setPaymentModalOpen(true)} variant="outline" className="border-[var(--color-border-strong)] text-white">
            <Plus size={16} className="mr-2" />
            Paiement manuel
          </Button>
          <Button onClick={() => setScheduleModalOpen(true)} className="bg-[var(--color-accent)] hover:opacity-85" data-testid="add-schedule-btn">
            <Plus size={16} className="mr-2" />
            Nouveau planning
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 tf-stagger">
        <div className="tf-stat">
          <p className="tf-stat-label">Total paiements</p>
          <p className="tf-number-large" style={{ marginTop: 'var(--space-2)' }}>{stats.total}</p>
        </div>
        <div className="tf-stat cursor-pointer" style={{ borderColor: 'rgba(255,69,58,0.3)' }} onClick={() => setFilterStatus(filterStatus === 'late' ? 'all' : 'late')}>
          <p className="tf-stat-label flex items-center gap-1" style={{ color: 'var(--color-danger)' }}>
            <AlertTriangle size={12} /> En retard
          </p>
          <p className="tf-number-large" style={{ marginTop: 'var(--space-2)', color: 'var(--color-danger)' }}>{stats.late}</p>
        </div>
        <div className="tf-stat cursor-pointer" onClick={() => setFilterStatus(filterStatus === 'pending' ? 'all' : 'pending')}>
          <p className="tf-stat-label" style={{ color: 'var(--color-accent)' }}>En attente</p>
          <p className="tf-number-large" style={{ marginTop: 'var(--space-2)', color: 'var(--color-accent)' }}>{stats.pending}</p>
        </div>
        <div className="tf-stat">
          <p className="tf-stat-label" style={{ color: 'var(--color-accent)' }}>Payes</p>
          <p className="tf-number-large" style={{ marginTop: 'var(--space-2)', color: 'var(--color-accent)' }}>{stats.paid}</p>
        </div>
        <div className="tf-stat">
          <p className="tf-stat-label flex items-center gap-1">
            <DollarSign size={12} /> Montant en retard
          </p>
          <p className="tf-number-large" style={{ marginTop: 'var(--space-2)', color: 'var(--color-danger)' }}>{stats.lateAmount.toLocaleString("fr-CH")} CHF</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="payments">Paiements ({stats.total})</TabsTrigger>
          <TabsTrigger value="late" className="data-[state=active]:bg-[var(--color-danger)]">En retard ({stats.late}) — {stats.lateAmount.toLocaleString("fr-CH")} CHF</TabsTrigger>
          <TabsTrigger value="upcoming" className="data-[state=active]:bg-[var(--color-accent)]">À venir ({upcomingPayments.length}) — {stats.upcomingAmount.toLocaleString("fr-CH")} CHF</TabsTrigger>
          <TabsTrigger value="schedules" className="data-[state=active]:bg-[var(--color-info)]">Plannings ({stats.activeSchedules}) — {stats.schedulesAmount.toLocaleString("fr-CH")} CHF/mois</TabsTrigger>
        </TabsList>

        {/* All Payments Tab */}
        <TabsContent value="payments" className="space-y-4">
          {/* Filters & Generate */}
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" size={16} />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="pl-10 bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[160px] bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white">
                <Filter size={14} className="mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
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
                className="w-[160px] bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white"
              />
              <Button onClick={handleGenerate} variant="outline" className="border-[var(--color-border-strong)] text-white" disabled={generatePaymentsMutation.isPending}>
                <RefreshCw size={14} className={`mr-2 ${generatePaymentsMutation.isPending ? 'animate-spin' : ''}`} />
                Générer
              </Button>
            </div>
          </div>

          {/* Payments Table */}
          <div className="tf-card overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--color-border)] hover:bg-transparent">
                  <TableHead className="text-[var(--color-text-secondary)]">Membre</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)]">Échéance</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)]">Montant</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)]">Méthode</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)]">Statut</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)]">Date paiement</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingPayments ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-[var(--color-text-secondary)] py-8">Chargement...</TableCell>
                  </TableRow>
                ) : enrichedPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-[var(--color-text-secondary)] py-8">Aucun paiement — generez vos premiers echeanciers.</TableCell>
                  </TableRow>
                ) : (
                  enrichedPayments.map((payment) => {
                    const StatusIcon = STATUS_CONFIG[payment.status]?.icon || Clock;
                    const daysLate = payment.status === "late" ? differenceInDays(new Date(), parseISO(payment.due_date)) : 0;
                    
                    return (
                      <TableRow key={payment.id} className="border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]" data-testid={`payment-${payment.id}`}>
                        <TableCell className="text-white font-medium">{payment.member_name}</TableCell>
                        <TableCell className="text-[var(--color-text-secondary)]">
                          {format(parseISO(payment.due_date), "dd MMM yyyy", { locale: fr })}
                        </TableCell>
                        <TableCell className="text-white font-medium">{payment.amount?.toLocaleString("fr-CH")} CHF</TableCell>
                        <TableCell className="text-[var(--color-text-secondary)]">
                          {PAYMENT_METHODS.find((m) => m.value === payment.payment_method)?.label || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${STATUS_CONFIG[payment.status]?.color} border-0`}>
                            <StatusIcon size={12} className="mr-1" />
                            {STATUS_CONFIG[payment.status]?.label}
                            {daysLate > 0 && <span className="ml-1">({daysLate}j)</span>}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[var(--color-text-secondary)]">
                          {payment.paid_date ? format(parseISO(payment.paid_date), "dd/MM/yyyy") : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {payment.status !== "paid" && (
                              <Button
                                size="sm"
                                onClick={() => openMarkPaid(payment)}
                                className="bg-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:opacity-85"
                                data-testid={`mark-paid-${payment.id}`}
                              >
                                <Check size={14} className="mr-1" /> Payé
                              </Button>
                            )}
                            {payment.status === "paid" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setRevertPaymentDialog({ open: true, payment })}
                                className="text-[var(--color-warning)] hover:text-[var(--color-warning)] hover:bg-[rgba(255,159,10,0.08)]"
                                title="Repasser en impayé"
                                data-testid={`revert-payment-${payment.id}`}
                              >
                                <RotateCcw size={14} className="mr-1" />
                                Impayé
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deletePaymentMutation.mutate(payment.id)}
                              className="text-[var(--color-danger)] hover:text-[var(--color-danger)]"
                              data-testid={`delete-payment-${payment.id}`}
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
          <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] border border-[rgba(255,69,58,0.3)] overflow-hidden">
            <div className="p-4 border-b border-[var(--color-border)] bg-[rgba(255,69,58,0.08)]">
              <h3 className="text-[var(--color-danger)] font-medium flex items-center gap-2">
                <AlertTriangle size={18} />
                Paiements en retard - Action requise
              </h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--color-border)]">
                  <TableHead className="text-[var(--color-text-secondary)]">Membre</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)]">Contact</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)]">Échéance</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)]">Retard</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)]">Montant</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {latePayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-[var(--color-success)] py-8">
                      <Check size={24} className="mx-auto mb-2" />
                      Aucun paiement en retard
                    </TableCell>
                  </TableRow>
                ) : (
                  latePayments.map((payment) => {
                    const daysLate = differenceInDays(new Date(), parseISO(payment.due_date));
                    const member = members.find((m) => m.id === payment.member_id);
                    const displayName = payment.member_name || member?.name || "Inconnu";
                    const displayEmail = payment.member_email || member?.email || "";
                    const displayPhone = payment.member_phone || member?.phone || "";
                    return (
                      <TableRow key={payment.id} className="border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]">
                        <TableCell className="text-white font-medium">{displayName}</TableCell>
                        <TableCell>
                          <div className="text-[var(--color-text-secondary)] text-sm">
                            <p>{displayEmail}</p>
                            <p>{displayPhone}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-[var(--color-text-secondary)]">
                          {format(parseISO(payment.due_date), "dd MMM yyyy", { locale: fr })}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-[rgba(255,69,58,0.15)] text-[var(--color-danger)] border-0">
                            {daysLate} jours
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[var(--color-danger)] font-bold">{payment.amount?.toLocaleString("fr-CH")} CHF</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-[var(--color-border-strong)] text-white"
                              onClick={() => sendReminderMutation.mutate(payment.id)}
                              disabled={sendReminderMutation.isPending || payment.reminder_sent}
                              data-testid={`reminder-${payment.id}`}
                            >
                              <Mail size={14} className="mr-1" />
                              {payment.reminder_sent ? "Envoyé" : sendReminderMutation.isPending ? "..." : "Relancer"}
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => openMarkPaid(payment)}
                              className="bg-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:opacity-85"
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
          <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] border border-[rgba(10,132,255,0.2)] overflow-hidden">
            <div className="p-4 border-b border-[var(--color-border)] bg-[rgba(10,132,255,0.08)]">
              <h3 className="text-[var(--color-accent)] font-medium flex items-center gap-2">
                <Calendar size={18} />
                Paiements à venir (7 jours)
              </h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--color-border)]">
                  <TableHead className="text-[var(--color-text-secondary)]">Membre</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)]">Échéance</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)]">Dans</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)]">Montant</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)]">Méthode</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-[var(--color-text-secondary)] py-8">
                      Aucun paiement à venir
                    </TableCell>
                  </TableRow>
                ) : (
                  upcomingPayments.map((payment) => {
                    const daysUntil = differenceInDays(parseISO(payment.due_date), new Date());
                    return (
                      <TableRow key={payment.id} className="border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]">
                        <TableCell className="text-white font-medium">{payment.member_name}</TableCell>
                        <TableCell className="text-[var(--color-text-secondary)]">
                          {format(parseISO(payment.due_date), "dd MMM yyyy", { locale: fr })}
                        </TableCell>
                        <TableCell>
                          <Badge className={daysUntil <= 3 ? "bg-[rgba(255,214,10,0.15)] text-[var(--color-warning)]" : "bg-[rgba(10,132,255,0.15)] text-[var(--color-accent)]"}>
                            {daysUntil} jours
                          </Badge>
                        </TableCell>
                        <TableCell className="text-white font-medium">{payment.amount?.toLocaleString("fr-CH")} CHF</TableCell>
                        <TableCell className="text-[var(--color-text-secondary)]">
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
          <div className="tf-card overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--color-border)]">
                  <TableHead className="text-[var(--color-text-secondary)]">Membre</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)]">Montant</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)]">Récurrence</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)]">Méthode</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)]">Début</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)]">Statut</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-[var(--color-text-secondary)] py-8">
                      Aucun planning de paiement
                    </TableCell>
                  </TableRow>
                ) : (
                  schedules.map((schedule) => (
                    <TableRow key={schedule.id} className="border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]" data-testid={`schedule-${schedule.id}`}>
                      <TableCell className="text-white font-medium">{schedule.member_name || getMemberName(schedule.member_id)}</TableCell>
                      <TableCell className="text-white font-medium">{schedule.amount?.toLocaleString("fr-CH")} CHF</TableCell>
                      <TableCell className="text-[var(--color-text-secondary)]">
                        {schedule.recurrence_type === "monthly_day"
                          ? `Le ${schedule.recurrence_value} du mois`
                          : `Tous les ${schedule.recurrence_value} jours`}
                      </TableCell>
                      <TableCell className="text-[var(--color-text-secondary)]">
                        {PAYMENT_METHODS.find((m) => m.value === schedule.payment_method)?.label || "-"}
                      </TableCell>
                      <TableCell className="text-[var(--color-text-secondary)]">
                        {schedule.start_date ? format(parseISO(schedule.start_date), "dd/MM/yyyy") : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge className={schedule.is_active ? "bg-[rgba(48,209,88,0.15)] text-[var(--color-success)]" : "bg-[rgba(255,255,255,0.1)] text-[var(--color-text-secondary)]"}>
                          {schedule.is_active ? "Actif" : "Inactif"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteScheduleMutation.mutate(schedule.id)}
                          className="text-[var(--color-danger)] hover:text-[var(--color-danger)]"
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
        <DialogContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white">
          <DialogHeader>
            <DialogTitle>Nouveau planning de paiement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="tf-stat-label">Membre *</label>
              <Select value={scheduleForm.member_id} onValueChange={(v) => setScheduleForm({ ...scheduleForm, member_id: v })}>
                <SelectTrigger className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1" data-testid="schedule-member-select">
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-white">{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="tf-stat-label">Montant (CHF) *</label>
                <Input
                  type="number"
                  value={scheduleForm.amount}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, amount: parseFloat(e.target.value) || 0 })}
                  className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
                />
              </div>
              <div>
                <label className="tf-stat-label">Méthode</label>
                <Select value={scheduleForm.payment_method} onValueChange={(v) => setScheduleForm({ ...scheduleForm, payment_method: v })}>
                  <SelectTrigger className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value} className="text-white">{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="tf-stat-label">Type de récurrence</label>
                <Select value={scheduleForm.recurrence_type} onValueChange={(v) => setScheduleForm({ ...scheduleForm, recurrence_type: v })}>
                  <SelectTrigger className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
                    {RECURRENCE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value} className="text-white">{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="tf-stat-label">
                  {scheduleForm.recurrence_type === "monthly_day" ? "Jour du mois (1-28)" : "Intervalle (jours)"}
                </label>
                <Input
                  type="number"
                  min={1}
                  max={scheduleForm.recurrence_type === "monthly_day" ? 28 : 365}
                  value={scheduleForm.recurrence_value}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, recurrence_value: parseInt(e.target.value) || 1 })}
                  className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
                />
              </div>
            </div>
            <div>
              <label className="tf-stat-label">Date de début</label>
              <Input
                type="date"
                value={scheduleForm.start_date}
                onChange={(e) => setScheduleForm({ ...scheduleForm, start_date: e.target.value })}
                className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setScheduleModalOpen(false)}>Annuler</Button>
            <Button
              onClick={() => createScheduleMutation.mutate(scheduleForm)}
              disabled={!scheduleForm.member_id || !scheduleForm.amount || createScheduleMutation.isPending}
              className="bg-[var(--color-accent)] hover:opacity-85"
            >
              {createScheduleMutation.isPending ? "..." : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Paid Modal */}
      <Dialog open={markPaidModalOpen} onOpenChange={setMarkPaidModalOpen}>
        <DialogContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="text-[var(--color-success)]" />
              Marquer comme payé
            </DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4 py-4">
              <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-lg)] p-4">
                <p className="text-white font-medium">{getMemberName(selectedPayment.member_id)}</p>
                <p className="text-[var(--color-text-secondary)] text-sm">Montant: {selectedPayment.amount?.toLocaleString("fr-CH")} CHF</p>
                <p className="text-[var(--color-text-secondary)] text-sm">Échéance: {format(parseISO(selectedPayment.due_date), "dd/MM/yyyy")}</p>
              </div>
              <div>
                <label className="tf-stat-label">Date de paiement</label>
                <Input
                  type="date"
                  defaultValue={format(new Date(), "yyyy-MM-dd")}
                  className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
                  id="paid-date-input"
                />
              </div>
              <div>
                <label className="tf-stat-label">Référence (optionnel)</label>
                <Input
                  placeholder="N° de transaction..."
                  className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
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
              className="bg-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:opacity-85"
            >
              {markPaidMutation.isPending ? "..." : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Payment Modal */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white">
          <DialogHeader>
            <DialogTitle>Ajouter un paiement manuel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="tf-stat-label">Membre *</label>
              <Select value={paymentForm.member_id} onValueChange={(v) => setPaymentForm({ ...paymentForm, member_id: v })}>
                <SelectTrigger className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1">
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent className="bg-[var(--color-bg-secondary)] border-[var(--color-border)]">
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-white">{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="tf-stat-label">Montant (CHF) *</label>
                <Input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })}
                  className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
                />
              </div>
              <div>
                <label className="tf-stat-label">Date d'échéance</label>
                <Input
                  type="date"
                  value={paymentForm.due_date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, due_date: e.target.value })}
                  className="bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPaymentModalOpen(false)}>Annuler</Button>
            <Button
              onClick={() => createPaymentMutation.mutate(paymentForm)}
              disabled={!paymentForm.member_id || !paymentForm.amount || createPaymentMutation.isPending}
              className="bg-[var(--color-accent)] hover:opacity-85"
            >
              {createPaymentMutation.isPending ? "..." : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revert payment to unpaid Dialog */}
      <RevertPaymentDialog
        open={revertPaymentDialog.open}
        onOpenChange={(o) => setRevertPaymentDialog((s) => ({ ...s, open: o }))}
        payment={revertPaymentDialog.payment}
        memberName={
          revertPaymentDialog.payment
            ? (members.find((m) => m.id === revertPaymentDialog.payment.member_id)?.name || revertPaymentDialog.payment.member_name || "Inconnu")
            : ""
        }
        memberEmail={
          revertPaymentDialog.payment
            ? (members.find((m) => m.id === revertPaymentDialog.payment.member_id)?.email || revertPaymentDialog.payment.member_email || "")
            : ""
        }
        isLoading={revertPaymentMutation.isPending}
        onConfirm={({ sendEmail }) => {
          if (!revertPaymentDialog.payment) return;
          const memberEmail = members.find((m) => m.id === revertPaymentDialog.payment.member_id)?.email || revertPaymentDialog.payment.member_email || "";
          revertPaymentMutation.mutate({
            id: revertPaymentDialog.payment.id,
            sendEmail,
            memberEmail,
          });
        }}
      />
    </div>
  );
}
