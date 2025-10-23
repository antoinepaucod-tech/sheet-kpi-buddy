import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Video, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VideoConfig {
  url: string;
  overlayOpacity: number;
  enabled: boolean;
}

interface VideoSettingsProps {
  onConfigChange: (config: VideoConfig) => void;
}

export const VideoSettings = ({ onConfigChange }: VideoSettingsProps) => {
  const [open, setOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [overlayOpacity, setOverlayOpacity] = useState(70);
  const [enabled, setEnabled] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Load saved config
    const saved = localStorage.getItem("video-config");
    if (saved) {
      const config = JSON.parse(saved);
      setVideoUrl(config.url || "");
      setOverlayOpacity(config.overlayOpacity * 100 || 70);
      setEnabled(config.enabled || false);
    }
  }, []);

  const saveConfig = () => {
    const config = {
      url: videoUrl,
      overlayOpacity: overlayOpacity / 100,
      enabled: enabled && videoUrl.length > 0,
    };
    
    localStorage.setItem("video-config", JSON.stringify(config));
    onConfigChange(config);
    
    toast({
      title: "Configuration sauvegardée",
      description: "Les paramètres vidéo ont été mis à jour",
    });
    
    setOpen(false);
  };

  const toggleVideo = () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    
    const config = {
      url: videoUrl,
      overlayOpacity: overlayOpacity / 100,
      enabled: newEnabled && videoUrl.length > 0,
    };
    
    localStorage.setItem("video-config", JSON.stringify(config));
    onConfigChange(config);
  };

  const exampleVideos = [
    {
      name: "Gym Workout",
      url: "https://assets.mixkit.co/videos/preview/mixkit-athlete-working-out-in-a-gym-44472-large.mp4"
    },
    {
      name: "Fitness Training",
      url: "https://assets.mixkit.co/videos/preview/mixkit-fitness-training-with-battle-ropes-40892-large.mp4"
    },
    {
      name: "Running Track",
      url: "https://assets.mixkit.co/videos/preview/mixkit-runner-on-a-running-track-40920-large.mp4"
    }
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Video className="h-4 w-4" />
          {enabled && (
            <span className="absolute top-1 right-1 h-2 w-2 bg-success rounded-full" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuration Vidéo Background
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="video-url">URL de la vidéo</Label>
            <Input
              id="video-url"
              type="url"
              placeholder="https://youtube.com/watch?v=... ou https://example.com/video.mp4"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Formats supportés: Vidéos YouTube ou liens directs (MP4, WebM). La vidéo sera en lecture automatique et en boucle.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Vidéos d'exemple</Label>
            <div className="grid grid-cols-1 gap-2">
              {exampleVideos.map((video) => (
                <Button
                  key={video.url}
                  variant="outline"
                  className="justify-start"
                  onClick={() => setVideoUrl(video.url)}
                >
                  <Video className="h-4 w-4 mr-2" />
                  {video.name}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Opacité de l'overlay: {overlayOpacity}%</Label>
            <Slider
              value={[overlayOpacity]}
              onValueChange={(value) => setOverlayOpacity(value[0])}
              max={100}
              min={0}
              step={5}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Plus l'opacité est élevée, plus le texte sera lisible
            </p>
          </div>

          {videoUrl && (
            <div className="space-y-2">
              <Label>Aperçu</Label>
              <div className="relative aspect-video rounded-lg overflow-hidden border border-border">
                <video
                  src={videoUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div 
                  className="absolute inset-0 bg-background flex items-center justify-center"
                  style={{ opacity: overlayOpacity / 100 }}
                >
                  <p className="text-2xl font-semibold">Texte d'exemple</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between gap-2">
            <Button
              variant="outline"
              onClick={toggleVideo}
              className={enabled ? "border-success text-success" : ""}
            >
              <Video className="h-4 w-4 mr-2" />
              {enabled ? "Vidéo activée" : "Activer la vidéo"}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button onClick={saveConfig} className="gradient-primary">
                Sauvegarder
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
