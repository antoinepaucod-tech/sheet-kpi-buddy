import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Mail, Plus, Trash2, Clock, Share2, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "@/hooks/useTranslations";

interface EmailPref {
  id: string;
  email: string;
  enabled: boolean;
  send_hour?: number;
  timezone?: string;
}

const TIMEZONES = [
  { value: "America/New_York", label: "EST (New York)" },
  { value: "America/Chicago", label: "CST (Chicago)" },
  { value: "America/Denver", label: "MST (Denver)" },
  { value: "America/Los_Angeles", label: "PST (Los Angeles)" },
  { value: "America/Toronto", label: "Toronto" },
  { value: "America/Montreal", label: "Montréal" },
  { value: "America/Vancouver", label: "Vancouver" },
  { value: "Europe/Zurich", label: "Zurich" },
  { value: "UTC", label: "UTC" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i.toString(),
  label: `${i.toString().padStart(2, '0')}:00`,
}));

export const EmailPreferences = () => {
  const [emails, setEmails] = useState<EmailPref[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newHour, setNewHour] = useState("9");
  const [newTimezone, setNewTimezone] = useState("America/Montreal");
  const [loading, setLoading] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslations();

  useEffect(() => {
    loadEmails();
  }, []);

  const loadEmails = async () => {
    const { data, error } = await supabase
      .from("email_preferences")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading emails:", error);
      return;
    }

    setEmails(data || []);
  };

  const addEmail = async () => {
    if (!newEmail || !newEmail.includes("@")) {
      toast({
        title: t('toast.invalidEmail'),
        description: t('toast.validEmail'),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from("email_preferences")
      .insert({ 
        email: newEmail, 
        enabled: true,
        send_hour: parseInt(newHour),
        timezone: newTimezone
      });

    if (error) {
      toast({
        title: t('toast.error'),
        description: t('toast.cannotAdd'),
        variant: "destructive",
      });
    } else {
      toast({
        title: t('toast.emailAdded'),
        description: t('toast.weeklyReminders'),
      });
      setNewEmail("");
      loadEmails();
    }
    setLoading(false);
  };

  const copyShareLink = () => {
    const shareUrl = `${window.location.origin}/weekly?view=readonly`;
    navigator.clipboard.writeText(shareUrl);
    toast({
      title: t('toast.linkCopied'),
      description: t('toast.linkCopiedDesc'),
    });
  };

  const removeEmail = async (id: string) => {
    const { error } = await supabase
      .from("email_preferences")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'email",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Email supprimé",
        description: "Vous ne recevrez plus de rappels",
      });
      loadEmails();
    }
  };

  return (
    <Card className="border border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-heading">
          <Mail className="h-5 w-5" />
          {t('email.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="votre@email.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && addEmail()}
              />
            </div>
            <div>
              <Label htmlFor="hour">{t('email.hourLabel')}</Label>
              <Select value={newHour} onValueChange={setNewHour}>
                <SelectTrigger id="hour">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS.map((hour) => (
                    <SelectItem key={hour.value} value={hour.value}>
                      {hour.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="timezone">{t('email.timezoneLabel')}</Label>
              <Select value={newTimezone} onValueChange={setNewTimezone}>
                <SelectTrigger id="timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={addEmail} disabled={loading} className="gradient-primary flex-1">
              <Plus className="h-4 w-4 mr-2" />
              {t('button.addReminder')}
            </Button>
            <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Share2 className="h-4 w-4 mr-2" />
                  {t('button.share')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('email.shareTitle')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {t('email.shareDescription')}
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={`${window.location.origin}/weekly?view=readonly`}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button onClick={copyShareLink} variant="outline">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="space-y-2">
          {emails.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t('email.noEmails')}
            </p>
          ) : (
            emails.map((email) => (
              <div
                key={email.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center gap-3 flex-1">
                  <Mail className="h-4 w-4 text-primary" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{email.email}</span>
                      {email.enabled && (
                        <Badge variant="outline" className="text-xs">
                          {t('email.active')}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <Clock className="h-3 w-3" />
                      <span>
                        {email.send_hour !== undefined ? `${email.send_hour.toString().padStart(2, '0')}:00` : '09:00'} 
                        {' '}{email.timezone ? TIMEZONES.find(tz => tz.value === email.timezone)?.label : 'UTC'}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeEmail(email.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
