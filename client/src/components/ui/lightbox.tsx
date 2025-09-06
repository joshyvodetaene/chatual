import { useState } from "react";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogOverlay } from "./dialog";

interface LightboxProps {
  src: string;
  alt: string;
  isOpen: boolean;
  onClose: () => void;
}

export function Lightbox({ src, alt, isOpen, onClose }: LightboxProps) {
  const [isLoading, setIsLoading] = useState(true);

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  const handleImageError = () => {
    setIsLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogOverlay className="bg-black/90 backdrop-blur-sm" />
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-none bg-transparent shadow-none">
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            aria-label="Close lightbox"
            data-testid="button-close-lightbox"
          >
            <X size={24} />
          </button>

          {/* Loading state */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}

          {/* Full-size image */}
          <img
            src={src}
            alt={alt}
            onLoad={handleImageLoad}
            onError={handleImageError}
            className={`max-w-full max-h-full object-contain rounded-lg transition-opacity duration-300 ${
              isLoading ? "opacity-0" : "opacity-100"
            }`}
            style={{ maxWidth: "95vw", maxHeight: "95vh" }}
            data-testid="img-lightbox-fullsize"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface LightboxTriggerProps {
  src: string;
  alt: string;
  children: React.ReactNode;
  className?: string;
}

export function LightboxTrigger({ src, alt, children, className }: LightboxTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div
        onClick={() => setIsOpen(true)}
        className={`cursor-pointer ${className || ""}`}
        data-testid="trigger-lightbox"
      >
        {children}
      </div>
      <Lightbox
        src={src}
        alt={alt}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}