import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import type { Tutorial } from "@/hooks/useTutorials";

interface VideoDialogProps {
  tutorial: Tutorial | null;
  isViewed: boolean;
  onClose: () => void;
  onMarkAsViewed: () => void;
}

export function VideoDialog({ tutorial, isViewed, onClose, onMarkAsViewed }: VideoDialogProps) {
  if (!tutorial) return null;

  const getEmbedUrl = (videoType: string, videoUrl: string) => {
    switch (videoType) {
      case 'youtube':
        // Extract video ID from various YouTube URL formats
        const youtubeMatch = videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
        return youtubeMatch ? `https://www.youtube.com/embed/${youtubeMatch[1]}` : videoUrl;
      
      case 'vimeo':
        // Extract video ID from Vimeo URL
        const vimeoMatch = videoUrl.match(/vimeo\.com\/(\d+)/);
        return vimeoMatch ? `https://player.vimeo.com/video/${vimeoMatch[1]}` : videoUrl;
      
      case 'tella':
        // Tella videos can be embedded directly
        return videoUrl;
      
      case 'upload':
        // For uploaded videos, use the URL directly
        return videoUrl;
      
      default:
        return videoUrl;
    }
  };

  const embedUrl = getEmbedUrl(tutorial.video_type, tutorial.video_url);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{tutorial.title}</DialogTitle>
          {tutorial.description && (
            <p className="text-muted-foreground mt-2">{tutorial.description}</p>
          )}
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
            {tutorial.video_type === 'upload' ? (
              <video
                controls
                className="w-full h-full"
                src={embedUrl}
              >
                Votre navigateur ne supporte pas la lecture de vidéos.
              </video>
            ) : (
              <iframe
                src={embedUrl}
                className="w-full h-full"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                title={tutorial.title}
              />
            )}
          </div>

          <div className="flex justify-center">
            <Button
              onClick={onMarkAsViewed}
              className={isViewed ? "bg-green-500 hover:bg-green-600" : ""}
              size="lg"
            >
              <CheckCircle2 className="mr-2 h-5 w-5" />
              {isViewed ? "Vidéo visionnée ✓" : "Marquer comme vue"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
