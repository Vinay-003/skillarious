import React from 'react';

interface VideoPlayerProps {
  videoUrl: string;
  title: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoUrl, title }) => {
  return (
    <div className="w-full aspect-video bg-black rounded-lg overflow-hidden">
      <video
        className="w-full h-full"
        controls
        preload="none"
        poster="https://images.unsplash.com/photo-1588196749597-9ff075ee6b5b?auto=format&fit=crop&q=80"
      >
        <source src={videoUrl} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      <h1 className="text-2xl font-bold text-white mt-4">{title}</h1>
    </div>
  );
};

export default VideoPlayer;
