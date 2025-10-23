import { useState, useMemo } from "react";

interface VideoBackgroundProps {
  videoUrl?: string;
  overlayOpacity?: number;
  children: React.ReactNode;
}

const getYoutubeEmbedUrl = (url: string): string | null => {
  if (!url) return null;
  
  // Handle different YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/,
    /youtube\.com\/embed\/([^&\s]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return `https://www.youtube.com/embed/${match[1]}?autoplay=1&mute=1&loop=1&controls=0&showinfo=0&playlist=${match[1]}`;
    }
  }
  
  return null;
};

export const VideoBackground = ({ 
  videoUrl = "https://assets.mixkit.co/videos/preview/mixkit-athlete-working-out-in-a-gym-44472-large.mp4",
  overlayOpacity = 0.7,
  children 
}: VideoBackgroundProps) => {
  const [videoError, setVideoError] = useState(false);
  
  const youtubeEmbedUrl = useMemo(() => getYoutubeEmbedUrl(videoUrl), [videoUrl]);
  const isYoutubeVideo = !!youtubeEmbedUrl;

  return (
    <div className="relative overflow-hidden">
      {/* Video Background */}
      {videoUrl && !videoError && (
        <>
          {isYoutubeVideo ? (
            <iframe
              src={youtubeEmbedUrl}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              style={{ 
                border: 'none',
                transform: 'scale(1.5)', // Zoom to hide YouTube controls
                transformOrigin: 'center'
              }}
              allow="autoplay; encrypted-media"
              allowFullScreen
              title="Background video"
            />
          ) : (
            <video
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
              onError={() => setVideoError(true)}
            >
              <source src={videoUrl} type="video/mp4" />
            </video>
          )}
          
          {/* Overlay for text readability */}
          <div 
            className="absolute inset-0 bg-background"
            style={{ opacity: overlayOpacity }}
          />
        </>
      )}
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};
