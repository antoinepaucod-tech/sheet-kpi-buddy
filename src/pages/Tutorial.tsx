import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { VideoDialog } from "@/components/VideoDialog";
import { useTutorials } from "@/hooks/useTutorials";
import { Plus, Play, Trash2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const Tutorial = () => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedTutorial, setSelectedTutorial] = useState<string | null>(null);
  const [newTutorial, setNewTutorial] = useState({
    title: "",
    description: "",
    video_type: "youtube" as const,
    video_url: "",
    thumbnail_url: "",
    duration: null as number | null,
    order_index: 0,
  });

  const {
    tutorials,
    isLoading,
    addTutorial,
    deleteTutorial,
    markAsViewed,
    isTutorialViewed,
  } = useTutorials();

  // For demo purposes, using a static user ID. In production, get from auth
  const userId = "demo-user-id";

  const handleAddTutorial = async () => {
    if (newTutorial.title && newTutorial.video_url) {
      await addTutorial(newTutorial);
      setNewTutorial({
        title: "",
        description: "",
        video_type: "youtube",
        video_url: "",
        thumbnail_url: "",
        duration: null,
        order_index: 0,
      });
      setShowAddForm(false);
    }
  };

  const handleOpenVideo = (tutorialId: string) => {
    setSelectedTutorial(tutorialId);
  };

  const handleMarkAsViewed = async () => {
    if (selectedTutorial) {
      await markAsViewed(selectedTutorial, userId);
    }
  };

  const selectedTutorialData = tutorials.find(t => t.id === selectedTutorial) || null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 flex items-center justify-center">
        <p className="text-muted-foreground">Chargement des tutoriels...</p>
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

        {/* Add Tutorial Button */}
        <div className="flex justify-end">
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Ajouter un tutoriel
          </Button>
        </div>

        {/* Add Tutorial Form */}
        {showAddForm && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Nouveau Tutoriel</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Titre</label>
                <Input
                  placeholder="Titre du tutoriel"
                  value={newTutorial.title}
                  onChange={(e) => setNewTutorial({ ...newTutorial, title: e.target.value })}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Description</label>
                <Textarea
                  placeholder="Description du tutoriel"
                  value={newTutorial.description}
                  onChange={(e) => setNewTutorial({ ...newTutorial, description: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Type de vidéo</label>
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
                    <SelectItem value="upload">Upload</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">URL de la vidéo</label>
                <Input
                  placeholder="https://..."
                  value={newTutorial.video_url}
                  onChange={(e) => setNewTutorial({ ...newTutorial, video_url: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">URL de la miniature (optionnel)</label>
                <Input
                  placeholder="https://..."
                  value={newTutorial.thumbnail_url}
                  onChange={(e) => setNewTutorial({ ...newTutorial, thumbnail_url: e.target.value })}
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleAddTutorial}>
                  Ajouter
                </Button>
                <Button variant="outline" onClick={() => setShowAddForm(false)}>
                  Annuler
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Tutorials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tutorials.map((tutorial) => {
            const isViewed = isTutorialViewed(tutorial.id, userId);
            
            return (
              <Card
                key={tutorial.id}
                className={cn(
                  "p-6 cursor-pointer hover:shadow-lg transition-all relative",
                  isViewed && "border-green-500/50"
                )}
                onClick={() => handleOpenVideo(tutorial.id)}
              >
                {isViewed && (
                  <div className="absolute top-3 right-3">
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  </div>
                )}
                
                {tutorial.thumbnail_url ? (
                  <div className="aspect-video rounded-lg overflow-hidden mb-4 relative group">
                    <img
                      src={tutorial.thumbnail_url}
                      alt={tutorial.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="h-12 w-12 text-white" />
                    </div>
                  </div>
                ) : (
                  <div className="aspect-video rounded-lg bg-muted flex items-center justify-center mb-4 group">
                    <Play className="h-12 w-12 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                )}

                <h3 className="font-semibold text-lg mb-2">{tutorial.title}</h3>
                {tutorial.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                    {tutorial.description}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground uppercase">
                    {tutorial.video_type}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteTutorial(tutorial.id);
                    }}
                    className="hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        {tutorials.length === 0 && !showAddForm && (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground mb-4">
              Aucun tutoriel disponible. Ajoutez-en un pour commencer.
            </p>
            <Button onClick={() => setShowAddForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un tutoriel
            </Button>
          </Card>
        )}

        <VideoDialog
          tutorial={selectedTutorialData}
          isViewed={isTutorialViewed(selectedTutorial || "", userId)}
          onClose={() => setSelectedTutorial(null)}
          onMarkAsViewed={handleMarkAsViewed}
        />
      </div>
    </div>
  );
};

export default Tutorial;
