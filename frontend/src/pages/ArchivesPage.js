import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Archive, RotateCcw, Search, Users, UserCog } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { useArchiveAction } from "../hooks/useArchiveAction";
import { useBulkArchiveAction, MAX_BULK_SIZE } from "../hooks/useBulkArchiveAction";
import { ArchiveConfirmDialog } from "../components/ArchiveConfirmDialog";
import { BulkActionBar } from "../components/BulkActionBar";
import { BulkArchiveConfirmDialog } from "../components/BulkArchiveConfirmDialog";
import { Checkbox } from "../components/ui/checkbox";
import { toast } from "sonner";
import { useTranslations } from "../hooks/useTranslations";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function formatDate(iso) {
  if (!iso) return "-";
  try {
    return format(parseISO(iso), "dd MMM yyyy HH:mm", { locale: fr });
  } catch {
    return "-";
  }
}

export default function ArchivesPage() {
  const { lang } = useTranslations();
  const [tab, setTab] = useState("members");
  const [memberSearch, setMemberSearch] = useState("");
  const [coachSearch, setCoachSearch] = useState("");
  const [restoreDialog, setRestoreDialog] = useState({
    open: false,
    entityType: "member",
    entity: null,
  });

  // Archived members
  const { data: archivedMembers = [], isLoading: loadingMembers } = useQuery({
    queryKey: ["members-archived"],
    queryFn: () =>
      axios.get(`${API}/members?only_archived=true`).then((r) => r.data),
  });

  // Archived coaches
  const { data: archivedCoaches = [], isLoading: loadingCoaches } = useQuery({
    queryKey: ["coaches-archived"],
    queryFn: () =>
      axios.get(`${API}/coaches?only_archived=true`).then((r) => r.data),
  });

  const memberArchive = useArchiveAction("member", {
    onSuccess: () => setRestoreDialog({ open: false, entityType: "member", entity: null }),
  });
  const coachArchive = useArchiveAction("coach", {
    onSuccess: () => setRestoreDialog({ open: false, entityType: "coach", entity: null }),
  });

  // Sprint B.4.4 — Bulk restore (un hook par onglet pour ne pas mélanger les ids)
  const bulkMembers = useBulkArchiveAction("member");
  const bulkCoaches = useBulkArchiveAction("coach");
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const activeBulk = tab === "members" ? bulkMembers : bulkCoaches;

  const filteredMembers = useMemo(() => {
    if (!memberSearch) return archivedMembers;
    const s = memberSearch.toLowerCase();
    return archivedMembers.filter(
      (m) =>
        m.name?.toLowerCase().includes(s) ||
        m.email?.toLowerCase().includes(s) ||
        m.membership?.toLowerCase().includes(s)
    );
  }, [archivedMembers, memberSearch]);

  const filteredCoaches = useMemo(() => {
    if (!coachSearch) return archivedCoaches;
    const s = coachSearch.toLowerCase();
    return archivedCoaches.filter(
      (c) =>
        c.name?.toLowerCase().includes(s) ||
        c.email?.toLowerCase().includes(s)
    );
  }, [archivedCoaches, coachSearch]);

  const openRestore = (entityType, entity) =>
    setRestoreDialog({ open: true, entityType, entity });

  const onConfirmRestore = () => {
    const { entityType, entity } = restoreDialog;
    if (!entity) return;
    if (entityType === "member") memberArchive.restore(entity.id);
    else coachArchive.restore(entity.id);
  };

  return (
    <div className="space-y-6" data-testid="archives-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="tf-page-header flex items-center gap-3">
            <Archive size={26} className="text-[var(--color-warning)]" />
            {lang === "fr" ? "Archives" : "Archives"}
          </h1>
          <p className="tf-page-subtitle">
            {lang === "fr"
              ? "Membres et coachs archivés. Restaurez-les pour les remettre dans les flux normaux."
              : "Archived members and coaches. Restore them to bring them back."}
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
          <TabsTrigger value="members" data-testid="tab-archived-members" className="gap-2">
            <Users size={14} />
            {lang === "fr" ? "Membres" : "Members"}
            <Badge className="ml-1 bg-[rgba(255,255,255,0.08)] text-[var(--color-text-tertiary)] border-0">
              {archivedMembers.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="coaches" data-testid="tab-archived-coaches" className="gap-2">
            <UserCog size={14} />
            {lang === "fr" ? "Coachs" : "Coaches"}
            <Badge className="ml-1 bg-[rgba(255,255,255,0.08)] text-[var(--color-text-tertiary)] border-0">
              {archivedCoaches.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* MEMBERS TAB */}
        <TabsContent value="members" className="space-y-4 mt-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" size={16} />
            <Input
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder={lang === "fr" ? "Rechercher un membre archivé..." : "Search archived members..."}
              className="pl-10 bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white"
              data-testid="archived-members-search"
            />
          </div>

          <div className="tf-card overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--color-border)] hover:bg-transparent">
                  <TableHead className="w-10 text-[var(--color-text-secondary)]">
                    <Checkbox
                      checked={
                        filteredMembers.length > 0 &&
                        filteredMembers.slice(0, MAX_BULK_SIZE).every((m) => bulkMembers.selected.has(m.id))
                          ? true
                          : filteredMembers.some((m) => bulkMembers.selected.has(m.id))
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={(v) => {
                        if (v) {
                          const ids = filteredMembers.map((m) => m.id);
                          if (ids.length > MAX_BULK_SIZE) toast.info(`Maximum ${MAX_BULK_SIZE} sélectionnés.`);
                          bulkMembers.setMany(ids);
                        } else {
                          bulkMembers.clear();
                        }
                      }}
                      data-testid="bulk-select-all-archived-members"
                      className="border-[var(--color-border)] data-[state=checked]:bg-[var(--color-accent)] data-[state=checked]:border-[var(--color-accent)]"
                    />
                  </TableHead>
                  <TableHead className="text-[var(--color-text-secondary)]">Nom</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)]">Abonnement</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)]">Archivé le</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)]">Raison</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingMembers ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-[var(--color-text-secondary)] py-8">
                      Chargement...
                    </TableCell>
                  </TableRow>
                ) : filteredMembers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-[var(--color-text-secondary)] py-12">
                      <Archive size={28} className="mx-auto mb-2 opacity-30" />
                      {memberSearch ? "Aucun résultat." : "Aucun membre archivé."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMembers.map((m) => (
                    <TableRow
                      key={m.id}
                      className="border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]"
                      data-testid={`archived-member-row-${m.id}`}
                    >
                      <TableCell className="w-10">
                        <Checkbox
                          checked={bulkMembers.selected.has(m.id)}
                          onCheckedChange={() => {
                            if (!bulkMembers.selected.has(m.id) && bulkMembers.selected.size >= MAX_BULK_SIZE) {
                              toast.warning(`Maximum ${MAX_BULK_SIZE} éléments à la fois.`);
                              return;
                            }
                            bulkMembers.toggle(m.id);
                          }}
                          data-testid={`bulk-select-archived-${m.id}`}
                          className="border-[var(--color-border)] data-[state=checked]:bg-[var(--color-accent)] data-[state=checked]:border-[var(--color-accent)]"
                        />
                      </TableCell>
                      <TableCell className="text-white font-medium">{m.name}</TableCell>
                      <TableCell className="text-[var(--color-text-secondary)]">
                        {m.membership || "-"}
                      </TableCell>
                      <TableCell className="text-[var(--color-text-tertiary)] font-mono text-xs">
                        {formatDate(m.archived_at)}
                      </TableCell>
                      <TableCell className="text-[var(--color-text-secondary)] text-sm max-w-xs truncate" title={m.archived_reason || ""}>
                        {m.archived_reason || <span className="text-[var(--color-text-tertiary)] italic">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-[var(--color-success)] hover:bg-[rgba(48,209,88,0.08)] gap-2"
                          onClick={() => openRestore("member", m)}
                          data-testid={`restore-member-${m.id}`}
                        >
                          <RotateCcw size={14} />
                          Restaurer
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* COACHES TAB */}
        <TabsContent value="coaches" className="space-y-4 mt-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" size={16} />
            <Input
              value={coachSearch}
              onChange={(e) => setCoachSearch(e.target.value)}
              placeholder={lang === "fr" ? "Rechercher un coach archivé..." : "Search archived coaches..."}
              className="pl-10 bg-[var(--color-bg-secondary)] border-[var(--color-border)] text-white"
              data-testid="archived-coaches-search"
            />
          </div>

          <div className="tf-card overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--color-border)] hover:bg-transparent">
                  <TableHead className="w-10 text-[var(--color-text-secondary)]">
                    <Checkbox
                      checked={
                        filteredCoaches.length > 0 &&
                        filteredCoaches.slice(0, MAX_BULK_SIZE).every((c) => bulkCoaches.selected.has(c.id))
                          ? true
                          : filteredCoaches.some((c) => bulkCoaches.selected.has(c.id))
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={(v) => {
                        if (v) {
                          const ids = filteredCoaches.map((c) => c.id);
                          if (ids.length > MAX_BULK_SIZE) toast.info(`Maximum ${MAX_BULK_SIZE} sélectionnés.`);
                          bulkCoaches.setMany(ids);
                        } else {
                          bulkCoaches.clear();
                        }
                      }}
                      data-testid="bulk-select-all-archived-coaches"
                      className="border-[var(--color-border)] data-[state=checked]:bg-[var(--color-accent)] data-[state=checked]:border-[var(--color-accent)]"
                    />
                  </TableHead>
                  <TableHead className="text-[var(--color-text-secondary)]">Nom</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)]">Email</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)]">Archivé le</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)]">Raison</TableHead>
                  <TableHead className="text-[var(--color-text-secondary)] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingCoaches ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-[var(--color-text-secondary)] py-8">
                      Chargement...
                    </TableCell>
                  </TableRow>
                ) : filteredCoaches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-[var(--color-text-secondary)] py-12">
                      <Archive size={28} className="mx-auto mb-2 opacity-30" />
                      {coachSearch ? "Aucun résultat." : "Aucun coach archivé."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCoaches.map((c) => (
                    <TableRow
                      key={c.id}
                      className="border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]"
                      data-testid={`archived-coach-row-${c.id}`}
                    >
                      <TableCell className="w-10">
                        <Checkbox
                          checked={bulkCoaches.selected.has(c.id)}
                          onCheckedChange={() => {
                            if (!bulkCoaches.selected.has(c.id) && bulkCoaches.selected.size >= MAX_BULK_SIZE) {
                              toast.warning(`Maximum ${MAX_BULK_SIZE} éléments à la fois.`);
                              return;
                            }
                            bulkCoaches.toggle(c.id);
                          }}
                          data-testid={`bulk-select-archived-coach-${c.id}`}
                          className="border-[var(--color-border)] data-[state=checked]:bg-[var(--color-accent)] data-[state=checked]:border-[var(--color-accent)]"
                        />
                      </TableCell>
                      <TableCell className="text-white font-medium">{c.name}</TableCell>
                      <TableCell className="text-[var(--color-text-secondary)]">
                        {c.email || "-"}
                      </TableCell>
                      <TableCell className="text-[var(--color-text-tertiary)] font-mono text-xs">
                        {formatDate(c.archived_at)}
                      </TableCell>
                      <TableCell className="text-[var(--color-text-secondary)] text-sm max-w-xs truncate" title={c.archived_reason || ""}>
                        {c.archived_reason || <span className="text-[var(--color-text-tertiary)] italic">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-[var(--color-success)] hover:bg-[rgba(48,209,88,0.08)] gap-2"
                          onClick={() => openRestore("coach", c)}
                          data-testid={`restore-coach-${c.id}`}
                        >
                          <RotateCcw size={14} />
                          Restaurer
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

      <ArchiveConfirmDialog
        open={restoreDialog.open}
        onOpenChange={(o) => setRestoreDialog((s) => ({ ...s, open: o }))}
        mode="restore"
        entityLabel={restoreDialog.entityType === "member" ? "membre" : "coach"}
        entityName={restoreDialog.entity?.name || ""}
        isLoading={memberArchive.isRestoring || coachArchive.isRestoring}
        onConfirm={onConfirmRestore}
      />

      {/* Sprint B.4.4 — Bulk restore */}
      <BulkActionBar
        count={activeBulk.selected.size}
        entityLabel={tab === "members" ? "membre" : "coach"}
        entityLabelPlural={tab === "members" ? "membres" : "coachs"}
        action="restore"
        onAction={() => setBulkDialogOpen(true)}
        onClear={() => activeBulk.clear()}
      />
      <BulkArchiveConfirmDialog
        open={bulkDialogOpen || !!activeBulk.results}
        onClose={() => {
          setBulkDialogOpen(false);
          if (activeBulk.results) activeBulk.setResults(null);
        }}
        entityType={tab === "members" ? "member" : "coach"}
        action="restore"
        count={activeBulk.selected.size}
        running={activeBulk.running}
        progress={activeBulk.progress}
        results={activeBulk.results}
        onConfirm={async () => {
          const list = tab === "members" ? filteredMembers : filteredCoaches;
          const entitiesById = Object.fromEntries(list.map((e) => [e.id, e]));
          const summary = await activeBulk.run({ action: "restore", entitiesById });
          if (summary) {
            const { successes, errors } = summary;
            const nounPlural = tab === "members" ? "membres" : "coachs";
            const nounSingle = tab === "members" ? "membre" : "coach";
            if (errors.length === 0) toast.success(`${successes.length} ${successes.length > 1 ? nounPlural + " restaurés" : nounSingle + " restauré"} ✅`);
            else if (successes.length === 0) toast.error(`Échec — ${errors.length} erreur${errors.length > 1 ? "s" : ""}`);
            else toast.warning(`${successes.length} ${successes.length > 1 ? "restaurés" : "restauré"} ✅, ${errors.length} erreur${errors.length > 1 ? "s" : ""}`);
          }
        }}
      />
    </div>
  );
}
