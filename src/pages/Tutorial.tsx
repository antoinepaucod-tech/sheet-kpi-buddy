import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Play, Check, Trash2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { VideoDialog } from "@/components/VideoDialog";
import { useTutorials } from "@/hooks/useTutorials";
import { toast } from "sonner";

const Tutorial = () => {
  const {
    tutorials,
    isLoading,
    addTutorial,
    deleteTutorial,
    markAsViewed,
    isCompleted,
  } = useTutorials();

  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedTutorial, setSelectedTutorial] = useState<string | null>(null);
  const [newTutorial, setNewTutorial] = useState({
    title: "",
    description: "",
    video_type: "youtube" as "youtube" | "vimeo" | "tella" | "upload",
    video_url: "",
    thumbnail_url: "",
  });

  const handleAddTutorial = async () => {
    if (!newTutorial.title || !newTutorial.video_url) {
      toast.error("Veuillez remplir au moins le titre et l'URL de la vidéo");
      return;
    }

    try {
      await addTutorial({
        ...newTutorial,
        order_index: tutorials.length,
        duration: null,
      });
      
      setNewTutorial({
        title: "",
        description: "",
        video_type: "youtube",
        video_url: "",
        thumbnail_url: "",
      });
      setShowAddForm(false);
      toast.success("Tutoriel ajouté avec succès");
    } catch (error) {
      toast.error("Erreur lors de l'ajout du tutoriel");
    }
  };

  const handleDeleteTutorial = async (id: string) => {
    try {
      await deleteTutorial(id);
      toast.success("Tutoriel supprimé");
    } catch (error) {
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleMarkComplete = async () => {
    if (!selectedTutorial) return;
    
    try {
      await markAsViewed(selectedTutorial, true);
      toast.success("Tutoriel marqué comme visionné");
    } catch (error) {
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const selectedTutorialData = tutorials.find(t => t.id === selectedTutorial);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 flex items-center justify-center">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Tutoriels
            </h1>
            <p className="text-muted-foreground mt-2">
              Apprenez à utiliser l'application
            </p>
          </div>
          <div className="flex gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>

        <Card className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Liste des tutoriels</h2>
            <Button onClick={() => setShowAddForm(!showAddForm)} className="gap-2">
              <Plus className="h-4 w-4" />
              Ajouter un tutoriel
            </Button>
          </div>

          {showAddForm && (
            <Card className="p-4 mb-6 bg-muted/30">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Titre *</Label>
                  <Input
                    id="title"
                    value={newTutorial.title}
                    onChange={(e) => setNewTutorial({ ...newTutorial, title: e.target.value })}
                    placeholder="Titre du tutoriel"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newTutorial.description}
                    onChange={(e) => setNewTutorial({ ...newTutorial, description: e.target.value })}
                    placeholder="Description du tutoriel"
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="video_type">Type de vidéo *</Label>
                  <Select
                    value={newTutorial.video_type}
                    onValueChange={(value: any) => setNewTutorial({ ...newTutorial, video_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="youtube">YouTube</SelectItem>
                      <SelectItem value="vimeo">Vimeo</SelectItem>
                      <SelectItem value="tella">Tella</SelectItem>
                      <SelectItem value="upload">Upload direct</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="video_url">URL de la vidéo *</Label>
                  <Input
                    id="video_url"
                    value={newTutorial.video_url}
                    onChange={(e) => setNewTutorial({ ...newTutorial, video_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <Label htmlFor="thumbnail_url">URL de la miniature (optionnel)</Label>
                  <Input
                    id="thumbnail_url"
                    value={newTutorial.thumbnail_url}
                    onChange={(e) => setNewTutorial({ ...newTutorial, thumbnail_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowAddForm(false)}>
                    Annuler
                  </Button>
                  <Button onClick={handleAddTutorial}>
                    Ajouter
                  </Button>
                </div>
              </div>
            </Card>
          )}

          <div className="space-y-3">
            {tutorials.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Aucun tutoriel disponible. Ajoutez-en un pour commencer.
              </p>
            ) : (
              tutorials.map((tutorial) => {
                const completed = isCompleted(tutorial.id);
                return (
                  <Card
                    key={tutorial.id}
                    className="p-4 hover:bg-accent/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1" onClick={() => setSelectedTutorial(tutorial.id)}>
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${completed ? 'bg-green-600' : 'bg-primary/10'}`}>
                            {completed ? (
                              <Check className="h-5 w-5 text-white" />
                            ) : (
                              <Play className="h-5 w-5 text-primary" />
                            )}
                          </div>
                          <div>
                            <h3 className="font-semibold">{tutorial.title}</h3>
                            {tutorial.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {tutorial.description}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {tutorial.video_type.toUpperCase()}
                            </p>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTutorial(tutorial.id);
                        }}
                        className="hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </Card>

        {selectedTutorialData && (
          <VideoDialog
            tutorial={selectedTutorialData}
            isCompleted={isCompleted(selectedTutorialData.id)}
            onClose={() => setSelectedTutorial(null)}
            onMarkComplete={handleMarkComplete}
          />
        )}
      </div>
    </div>
  );
};

export default Tutorial;
