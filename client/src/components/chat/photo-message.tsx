import { useState } from 'react';
import { MessageWithUser } from '@shared/schema';
import { cn } from '@/lib/utils';

interface PhotoMessageProps {
  message: MessageWithUser;
  isOwn: boolean;
}

export default function PhotoMessage({ message, isOwn }: PhotoMessageProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  if (!message.photoUrl || message.messageType !== 'photo') {
    return null;
  }

  // Construct proper photo URL for display
  const photoSrc = message.photoUrl.startsWith('http') 
    ? message.photoUrl 
    : message.photoUrl.startsWith('/photos/') 
    ? message.photoUrl  // Already has /photos/ prefix
    : `/photos${message.photoUrl}`; // Add /photos/ prefix if missing

  return (
    <div className={cn(
      "flex items-start space-x-2 p-4",
      isOwn ? "flex-row-reverse space-x-reverse" : ""
    )}>
      <div className={cn(
        "max-w-xs rounded-lg overflow-hidden shadow-md",
        isOwn ? "bg-primary" : "bg-white border"
      )}>
        {!imageError ? (
          <div className="relative">
            {!imageLoaded && (
              <div className="w-64 h-48 bg-gray-200 animate-pulse flex items-center justify-center">
                <span className="text-gray-500 text-sm">Loading...</span>
              </div>
            )}
            <img
              src={photoSrc}
              alt={message.photoFileName || "Photo"}
              className={cn(
                "w-full h-auto max-w-64 transition-opacity cursor-pointer",
                imageLoaded ? "opacity-100" : "opacity-0 absolute inset-0"
              )}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              onClick={() => {
                // Open image in a new tab for full view
                window.open(photoSrc, '_blank');
              }}
            />
          </div>
        ) : (
          <div className="w-64 h-48 bg-gray-100 flex items-center justify-center">
            <div className="text-center px-4">
              <span className="text-gray-500 text-sm block mb-1">Failed to load image</span>
              <span className="text-gray-400 text-xs">{message.photoFileName || 'Photo'}</span>
            </div>
          </div>
        )}
        
        {message.content && (
          <div className={cn(
            "p-3 text-sm",
            isOwn ? "text-white" : "text-gray-900"
          )}>
            {message.content}
          </div>
        )}
        
        <div className={cn(
          "px-3 pb-2 text-xs",
          isOwn ? "text-white text-opacity-70" : "text-gray-500"
        )}>
          {message.createdAt ? new Date(message.createdAt).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          }) : ''}
        </div>
      </div>
    </div>
  );
}