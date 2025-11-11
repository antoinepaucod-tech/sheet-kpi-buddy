import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import type { Tutorial } from "@/hooks/useTutorials";

interface VideoDialogProps {
  tutorial: Tutorial | null;
  isCompleted: boolean;
  onClose: () => void;
  onMarkComplete: () => void;
}

export function VideoDialog({ tutorial, isCompleted, onClose, onMarkComplete }: VideoDialogProps) {
  if (!tutorial) return null;

  const getEmbedUrl = (tutorial: Tutorial): string => {
    const url = tutorial.video_url;
    
    switch (tutorial.video_type) {
      case 'youtube':
        // Extract YouTube video ID and create embed URL
        const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\?\/]+)/);
        if (youtubeMatch) {
          return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
        }
        return url;
      
      case 'vimeo':
        // Extract Vimeo video ID and create embed URL
        const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
        if (vimeoMatch) {
          return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
        }
        return url;
      
      case 'tella':
        // Tella usually provides embed URLs directly
        if (url.includes('tella.tv') && !url.includes('/embed/')) {
          return url.replace('tella.tv/', 'tella.tv/embed/');
        }
        return url;
      
      case 'upload':
        // Direct video file
        return url;
      
      default:
        return url;
    }
  };

  const embedUrl = getEmbedUrl(tutorial);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-xl">{tutorial.title}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {tutorial.description && (
            <p className="text-muted-foreground text-sm">{tutorial.description}</p>
          )}
          
          <div className="aspect-video w-full bg-black rounded-lg overflow-hidden">
            {tutorial.video_type === 'upload' ? (
              <video
                src={embedUrl}
                controls
                className="w-full h-full"
                onEnded={onMarkComplete}
              />
            ) : (
              <iframe
                src={embedUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}
          </div>

          <div className="flex justify-end">
            <Button
              onClick={onMarkComplete}
              className={isCompleted ? "bg-green-600 hover:bg-green-700" : ""}
              size="lg"
            >
              <Check className="mr-2 h-5 w-5" />
              {isCompleted ? "Visionnée" : "Marquer comme visionnée"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
