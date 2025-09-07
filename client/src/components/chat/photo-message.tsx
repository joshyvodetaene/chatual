import { useState, memo } from 'react';
import { MessageWithUser } from '@shared/schema';
import { cn } from '@/lib/utils';
import { LightboxTrigger } from '@/components/ui/lightbox';
import { Skeleton } from '@/components/ui/skeleton';
import { useLazyLoading, useImagePreloader } from '@/hooks/use-lazy-loading';

interface PhotoMessageProps {
  message: MessageWithUser;
  isOwn: boolean;
}

const PhotoMessage = memo(function PhotoMessage({ message, isOwn }: PhotoMessageProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  // Lazy loading hook
  const { elementRef, shouldLoad } = useLazyLoading({
    rootMargin: '100px', // Start loading 100px before entering viewport
    threshold: 0.1
  });


  if (!message.photoUrl || message.messageType !== 'photo') {
    return null;
  }

  // Extract normalized photo path for thumbnails (always use local /photos/ route)
  const getNormalizedPath = (photoUrl: string): string => {
    if (photoUrl.startsWith('https://storage.googleapis.com/')) {
      // Extract the photo filename from Google Cloud Storage URL
      try {
        const url = new URL(photoUrl);
        const pathParts = url.pathname.split('/');
        const filename = pathParts[pathParts.length - 1];
        return `/photos/${filename}`;
      } catch (error) {
        console.error('Error parsing photo URL:', error);
        return photoUrl;
      }
    }
    
    // Handle local paths
    return photoUrl.startsWith('/photos/') 
      ? photoUrl  // Already has /photos/ prefix
      : `/photos${photoUrl}`; // Add /photos/ prefix if missing
  };
  
  const normalizedPath = getNormalizedPath(message.photoUrl);
  const thumbnailSrc = `${normalizedPath}?size=thumbnail`;
  const fullSizeSrc = message.photoUrl; // Keep original URL for full-size (works for both external and local)
  
  // Preload full-size image after thumbnail loads for better UX
  const { isPreloaded } = useImagePreloader(fullSizeSrc, imageLoaded && shouldLoad);

  return (
    <div 
      ref={elementRef}
      className={cn(
        "flex items-start space-x-2 p-4",
        isOwn ? "flex-row-reverse space-x-reverse" : ""
      )}
    >
      <div className={cn(
        "max-w-48 rounded-lg overflow-hidden shadow-md",
        "bg-black border border-gray-700",
        isOwn && "ml-auto"
      )}>
        {!imageError ? (
          <div className="relative">
            {(!shouldLoad || !imageLoaded) && (
              <div className="w-48 h-36 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 animate-pulse flex flex-col items-center justify-center space-y-2">
                <Skeleton className="w-12 h-12 rounded-full" />
                <Skeleton className="w-24 h-3 rounded" />
                <span className="text-gray-500 dark:text-gray-400 text-xs">
                  {!shouldLoad ? "Waiting to load..." : "Loading thumbnail..."}
                </span>
              </div>
            )}
            {shouldLoad && (
              <LightboxTrigger
                src={fullSizeSrc}
                alt={message.photoFileName || "Photo"}
                className="block w-full"
              >
                <img
                  src={thumbnailSrc}
                  alt={message.photoFileName || "Photo"}
                  className={cn(
                    "w-full h-auto max-w-48 transition-all duration-500 cursor-pointer hover:brightness-110 hover:scale-[1.02]",
                    imageLoaded ? "opacity-100 transform translate-y-0" : "opacity-0 absolute inset-0 transform translate-y-2"
                  )}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                  data-testid={`img-photo-thumbnail-${message.id}`}
                />
                {/* Visual indicator that full-size is preloaded */}
                {isPreloaded && imageLoaded && (
                  <div className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full opacity-75" 
                       title="Full-size image ready" />
                )}
              </LightboxTrigger>
            )}
          </div>
        ) : (
          <div className="w-48 h-36 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border border-red-200 dark:border-red-800 flex items-center justify-center">
            <div className="text-center px-4">
              <div className="w-8 h-8 mx-auto mb-2 bg-red-200 dark:bg-red-800 rounded-full flex items-center justify-center">
                <span className="text-red-600 dark:text-red-400 text-lg">⚠</span>
              </div>
              <span className="text-red-600 dark:text-red-400 text-sm block mb-1">Failed to load image</span>
              <span className="text-red-500 dark:text-red-500 text-xs">{message.photoFileName || 'Photo'}</span>
            </div>
          </div>
        )}

        {message.content && (
          <div className={cn(
            "p-3 text-sm",
            "text-white"
          )}>
            {message.content}
          </div>
        )}

        <div className={cn(
          "px-3 pb-2 text-xs",
          "text-white text-opacity-70"
        )}>
          {message.createdAt ? new Date(message.createdAt).toLocaleTimeString([], { hour12: false, 
            hour: '2-digit', 
            minute: '2-digit' 
          }) : ''}
        </div>
      </div>
    </div>
  );
});

export default PhotoMessage;