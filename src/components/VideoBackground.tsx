import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";

interface VideoBackgroundProps {
  videoUrl?: string;
  overlayOpacity?: number;
  children: React.ReactNode;
}

const getYoutubeId = (url?: string): string | null => {
  if (!url) return null;
  // Match youtu.be/ID, youtube.com/watch?v=ID, youtube.com/embed/ID
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/(?:watch\?v=|embed\/)([a-zA-Z0-9_-]+)/,
    /youtube\.com.*[?&]v=([a-zA-Z0-9_-]+)/
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m && m[1]) return m[1];
  }
  return null;
};

export const VideoBackground = ({ 
  videoUrl = "/videos/fitness-background.mp4",
  overlayOpacity = 0.7,
  children 
}: VideoBackgroundProps) => {
  const [videoError, setVideoError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const youtubeId = useMemo(() => getYoutubeId(videoUrl), [videoUrl]);
  const isYoutube = !!youtubeId;

  const iframeSrc = youtubeId
    ? `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&controls=0&modestbranding=1&loop=1&playlist=${youtubeId}&playsinline=1`
    : undefined;

  return (
    <div className="relative overflow-hidden">
      {/* Background layer */}
      {videoUrl && (
        <>
          {isYoutube ? (
            isPlaying ? (
              <>
                <iframe
                  src={iframeSrc}
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  style={{ border: 'none' }}
                  allow="autoplay; encrypted-media; picture-in-picture"
                  loading="lazy"
                  allowFullScreen
                  title="Background video"
                />
                <div 
                  className="absolute inset-0 bg-background"
                  style={{ opacity: overlayOpacity }}
                />
              </>
            ) : (
              <>
                {/* Thumbnail fallback before user interaction */}
                <img
                  src={`https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`}
                  alt="Arrière-plan vidéo YouTube"
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <div 
                  className="absolute inset-0 bg-background"
                  style={{ opacity: overlayOpacity }}
                />
                <div className="absolute inset-0 z-40 flex items-center justify-center">
                  <Button variant="secondary" size="lg" onClick={() => setIsPlaying(true)} className="shadow-md" aria-label="Lire la vidéo d'arrière-plan">
                    <Play className="mr-2 h-4 w-4" /> Lire la vidéo
                  </Button>
                </div>
              </>
            )
          ) : (
            <>
              {!videoError && (
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="auto"
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  onError={() => setVideoError(true)}
                >
                  <source src={videoUrl} type="video/mp4" />
                  <source src={videoUrl} type="video/webm" />
                </video>
              )}
              <div 
                className="absolute inset-0 bg-background"
                style={{ opacity: overlayOpacity }}
              />
            </>
          )}
        </>
      )}

      {/* Foreground content */}
      <div className="relative z-30">
        {children}
      </div>
    </div>
  );
};
