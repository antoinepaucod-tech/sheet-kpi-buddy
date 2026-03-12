import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import axios from "axios";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Mail,
  Send,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  CreditCard,
  ClipboardList,
  UserCheck,
  Filter,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";
import { useTranslations } from "../hooks/useTranslations";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TYPE_CONFIG = {
  payment_reminder: { label: "Rappel paiement", icon: CreditCard, color: "bg-red-500/20 text-red-400" },
  review_reminder: { label: "Rappel bilan", icon: ClipboardList, color: "bg-purple-500/20 text-purple-400" },
  followup_reminder: { label: "Rappel suivi", icon: UserCheck, color: "bg-emerald-500/20 text-emerald-400" },
  custom: { label: "Personnalisé", icon: Mail, color: "bg-blue-500/20 text-blue-400" },
};

export default function NotificationsPage() {
  const { lang } = useTranslations();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [composeOpen, setComposeOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [composeData, setComposeData] = useState({
    recipient_email: "",
    subject: "",
    message: "",
  });

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ["notification-logs"],
    queryFn: () => axios.get(`${API}/notifications/logs?limit=100`).then((r) => r.data),
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: () => axios.get(`${API}/members`).then((r) => r.data),
  });

  const sendEmailMutation = useMutation({
    mutationFn: (data) => axios.post(`${API}/notifications/send-email`, data),
    onSuccess: (res) => {
      toast.success(res.data.message);
      setComposeOpen(false);
      setComposeData({ recipient_email: "", subject: "", message: "" });
      refetch();
    },
    onError: (err) => toast.error(err.response?.data?.detail || "Erreur d'envoi"),
  });

  const sendBulkMutation = useMutation({
    mutationFn: (data) => axios.post(`${API}/notifications/send-bulk`, data),
    onSuccess: (res) => {
      toast.success(res.data.message);
      refetch();
    },
    onError: (err) => toast.error(err.response?.data?.detail || "Erreur"),
  });

  const filteredLogs = useMemo(() => {
    let result = logs;
    if (filterType !== "all") {
      result = result.filter((l) => l.type === filterType);
    }
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.recipient?.toLowerCase().includes(s) ||
          l.subject?.toLowerCase().includes(s)
      );
    }
    return result;
  }, [logs, filterType, search]);

  const stats = useMemo(() => {
    const total = logs.length;
    const sent = logs.filter((l) => l.status === "sent").length;
    const today = new Date().toISOString().split("T")[0];
    const todayCount = logs.filter((l) => l.sent_at?.startsWith(today)).length;
    return { total, sent, todayCount };
  }, [logs]);

  const handleCompose = () => {
    if (!composeData.recipient_email || !composeData.subject) {
      toast.error("Email et sujet requis");
      return;
    }
    sendEmailMutation.mutate({
      recipient_email: composeData.recipient_email,
      subject: composeData.subject,
      html_content: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;background:#09090B;color:#fff;padding:0;">
        <div style="background:linear-gradient(135deg,#E11D48,#BE123C);padding:24px 32px;">
          <h1 style="margin:0;font-size:20px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.05em;">TRANSFORM</h1>
        </div>
        <div style="padding:32px;">
          <p style="color:#ccc;line-height:1.8;white-space:pre-wrap;">${composeData.message}</p>
        </div>
        <div style="padding:16px 32px;border-top:1px solid #222;text-align:center;">
          <p style="margin:0;font-size:12px;color:#666;">TRANSFORM - Pilotage financier pour clubs de sport</p>
        </div>
      </div>`,
      reminder_type: "custom",
    });
  };

  return (
    <div className="space-y-6" data-testid="notifications-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-4xl font-extrabold text-white uppercase tracking-tight">
            {lang === "fr" ? "Messagerie & Notifications" : "Messaging & Notifications"}
          </h1>
          <p className="text-white/40 text-sm font-body mt-1">
            Historique des emails envoyés et envoi de notifications
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => sendBulkMutation.mutate({ notification_type: "payment_reminder" })}
            disabled={sendBulkMutation.isPending}
            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
            data-testid="bulk-payment-btn"
          >
            <CreditCard size={14} className="mr-1.5" />
            {sendBulkMutation.isPending ? "Envoi..." : "Relancer paiements"}
          </Button>
          <Button
            variant="outline"
            onClick={() => sendBulkMutation.mutate({ notification_type: "review_reminder" })}
            disabled={sendBulkMutation.isPending}
            className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
            data-testid="bulk-review-btn"
          >
            <ClipboardList size={14} className="mr-1.5" />
            Relancer bilans
          </Button>
          <Button
            onClick={() => setComposeOpen(true)}
            className="bg-rose-600 hover:bg-rose-700"
            data-testid="compose-btn"
          >
            <Send size={14} className="mr-1.5" />
            Nouveau message
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#121214] rounded-sm p-4 border border-white/10">
          <p className="text-white/40 text-xs uppercase tracking-wider">Total envoyés</p>
          <p className="text-2xl font-mono font-bold text-white">{stats.total}</p>
        </div>
        <div className="bg-[#121214] rounded-sm p-4 border border-white/10">
          <p className="text-white/40 text-xs uppercase tracking-wider">Réussis</p>
          <p className="text-2xl font-mono font-bold text-emerald-400">{stats.sent}</p>
        </div>
        <div className="bg-[#121214] rounded-sm p-4 border border-white/10">
          <p className="text-white/40 text-xs uppercase tracking-wider">Aujourd'hui</p>
          <p className="text-2xl font-mono font-bold text-rose-400">{stats.todayCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par email ou sujet..."
            className="pl-10 bg-[#121214] border-white/10 text-white"
            data-testid="notif-search"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[200px] bg-[#121214] border-white/10 text-white" data-testid="notif-type-filter">
            <Filter size={14} className="mr-2 text-white/40" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#121214] border-white/10">
            <SelectItem value="all" className="text-white">Tous les types</SelectItem>
            <SelectItem value="payment_reminder" className="text-white">Rappels paiement</SelectItem>
            <SelectItem value="review_reminder" className="text-white">Rappels bilan</SelectItem>
            <SelectItem value="followup_reminder" className="text-white">Rappels suivi</SelectItem>
            <SelectItem value="custom" className="text-white">Personnalisés</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Email List */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="text-center text-white/50 py-12">Chargement...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center text-white/40 py-12">
            <Mail className="mx-auto mb-3 opacity-30" size={40} />
            <p>Aucun email envoyé</p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const config = TYPE_CONFIG[log.type] || TYPE_CONFIG.custom;
            const Icon = config.icon;
            const isExpanded = expandedId === log.sent_at;

            return (
              <div
                key={log.sent_at + log.recipient}
                className="bg-[#121214] border border-white/10 rounded-sm overflow-hidden"
                data-testid={`notif-log-${log.type}`}
              >
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/[0.02]"
                  onClick={() => setExpandedId(isExpanded ? null : log.sent_at)}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${config.color}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-medium text-sm truncate">{log.subject}</p>
                      <Badge className={`border-0 text-[10px] ${config.color}`}>{config.label}</Badge>
                    </div>
                    <p className="text-white/40 text-xs truncate">{log.recipient}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {log.status === "sent" ? (
                      <CheckCircle2 size={14} className="text-emerald-400" />
                    ) : (
                      <AlertTriangle size={14} className="text-red-400" />
                    )}
                    <span className="text-white/30 text-xs">
                      {log.sent_at ? format(parseISO(log.sent_at), "dd MMM HH:mm", { locale: fr }) : "-"}
                    </span>
                    {isExpanded ? <ChevronUp size={14} className="text-white/30" /> : <ChevronDown size={14} className="text-white/30" />}
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-white/5 pt-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-white/40 text-xs">Destinataire</p>
                        <p className="text-white">{log.recipient}</p>
                      </div>
                      <div>
                        <p className="text-white/40 text-xs">Statut</p>
                        <p className={log.status === "sent" ? "text-emerald-400" : "text-red-400"}>
                          {log.status === "sent" ? "Envoyé" : "Échec"}
                        </p>
                      </div>
                      <div>
                        <p className="text-white/40 text-xs">Type</p>
                        <p className="text-white">{config.label}</p>
                      </div>
                      <div>
                        <p className="text-white/40 text-xs">Date</p>
                        <p className="text-white">
                          {log.sent_at ? format(parseISO(log.sent_at), "dd MMMM yyyy à HH:mm", { locale: fr }) : "-"}
                        </p>
                      </div>
                      {log.reference_id && (
                        <div className="col-span-2">
                          <p className="text-white/40 text-xs">Référence</p>
                          <p className="text-white/60 text-xs font-mono">{log.reference_id}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Compose Modal */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="bg-[#121214] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send size={18} className="text-rose-500" />
              Nouveau message
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-white/50 text-xs">Destinataire</Label>
              <Select
                value={composeData.recipient_email}
                onValueChange={(v) => setComposeData({ ...composeData, recipient_email: v })}
              >
                <SelectTrigger className="bg-[#121214] border-white/10 text-white mt-1" data-testid="compose-recipient">
                  <SelectValue placeholder="Sélectionner un membre..." />
                </SelectTrigger>
                <SelectContent className="bg-[#121214] border-white/10 max-h-[200px]">
                  {members.filter((m) => m.email).map((m) => (
                    <SelectItem key={m.id} value={m.email} className="text-white">
                      {m.name} ({m.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="ou saisir un email directement..."
                value={composeData.recipient_email}
                onChange={(e) => setComposeData({ ...composeData, recipient_email: e.target.value })}
                className="bg-[#121214] border-white/10 text-white mt-2"
                data-testid="compose-email-input"
              />
            </div>
            <div>
              <Label className="text-white/50 text-xs">Sujet</Label>
              <Input
                value={composeData.subject}
                onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                placeholder="Objet du message"
                className="bg-[#121214] border-white/10 text-white mt-1"
                data-testid="compose-subject"
              />
            </div>
            <div>
              <Label className="text-white/50 text-xs">Message</Label>
              <Textarea
                value={composeData.message}
                onChange={(e) => setComposeData({ ...composeData, message: e.target.value })}
                placeholder="Votre message..."
                rows={6}
                className="bg-[#121214] border-white/10 text-white mt-1 resize-none"
                data-testid="compose-message"
              />
            </div>
            <p className="text-white/30 text-xs">
              Expéditeur : contact@thecoachswitzerland.ch
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setComposeOpen(false)}>Annuler</Button>
            <Button
              onClick={handleCompose}
              disabled={sendEmailMutation.isPending}
              className="bg-rose-600 hover:bg-rose-700"
              data-testid="send-compose-btn"
            >
              <Send size={14} className="mr-1.5" />
              {sendEmailMutation.isPending ? "Envoi..." : "Envoyer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
