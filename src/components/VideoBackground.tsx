import { useState } from "react";

interface VideoBackgroundProps {
  videoUrl?: string;
  overlayOpacity?: number;
  children: React.ReactNode;
}

export const VideoBackground = ({ 
  videoUrl = "https://assets.mixkit.co/videos/preview/mixkit-athlete-working-out-in-a-gym-44472-large.mp4",
  overlayOpacity = 0.7,
  children 
}: VideoBackgroundProps) => {
  const [videoError, setVideoError] = useState(false);

  return (
    <div className="relative overflow-hidden">
      {/* Video Background */}
      {videoUrl && !videoError && (
        <>
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
