import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EmailPref {
  id: string;
  email: string;
  enabled: boolean;
}

export const EmailPreferences = () => {
  const [emails, setEmails] = useState<EmailPref[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

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
        title: "Email invalide",
        description: "Veuillez entrer une adresse email valide",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from("email_preferences")
      .insert({ email: newEmail, enabled: true });

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter l'email. Il existe peut-être déjà.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Email ajouté",
        description: "Vous recevrez les rappels hebdomadaires",
      });
      setNewEmail("");
      loadEmails();
    }
    setLoading(false);
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
    <Card className="border-2 border-primary/20 bg-card/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Rappels Email Hebdomadaires
        </CardTitle>
        <CardDescription>
          Recevez un email chaque lundi pour vous rappeler de mettre à jour vos KPIs
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="votre@email.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && addEmail()}
          />
          <Button onClick={addEmail} disabled={loading} className="gradient-primary">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter
          </Button>
        </div>

        <div className="space-y-2">
          {emails.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun email configuré. Ajoutez-en un pour recevoir des rappels !
            </p>
          ) : (
            emails.map((email) => (
              <div
                key={email.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <span className="text-sm">{email.email}</span>
                  {email.enabled && (
                    <Badge variant="outline" className="text-xs">
                      Actif
                    </Badge>
                  )}
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

        <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
          <p className="font-semibold mb-1">📅 Rappel automatique :</p>
          <p>• Envoyé chaque <strong>lundi à 9h00 UTC</strong></p>
          <p>• Résumé des métriques à suivre</p>
          <p>• Lien direct vers votre dashboard</p>
        </div>
      </CardContent>
    </Card>
  );
};
