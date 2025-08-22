import React, { useState, useRef } from "react";
import type { ReactNode } from "react";
import Uppy from "@uppy/core";
import { DashboardModal } from "@uppy/react";
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";
import AwsS3 from "@uppy/aws-s3";
import type { UploadResult } from "@uppy/core";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useResponsive } from "@/hooks/use-responsive";

interface PhotoUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onGetUploadParameters: () => Promise<{
    method: "PUT";
    url: string;
  }>;
  onComplete?: (
    result: UploadResult<Record<string, unknown>, Record<string, unknown>>
  ) => void;
  buttonClassName?: string;
  children: ReactNode;
}

/**
 * A photo upload component that renders as a button and provides a modal interface for
 * photo management.
 * 
 * Features:
 * - Renders as a customizable button that opens a photo upload modal
 * - Provides a modal interface for:
 *   - Photo selection
 *   - Photo preview
 *   - Upload progress tracking
 *   - Upload status display
 * - Restricted to image files only
 * 
 * The component uses Uppy under the hood to handle all file upload functionality.
 * All file management features are automatically handled by the Uppy dashboard modal.
 */
export function PhotoUploader({
  maxNumberOfFiles = 5,
  maxFileSize = 10485760, // 10MB default
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  children,
}: PhotoUploaderProps) {
  const [showModal, setShowModal] = useState(false);
  const [useCustomModal, setUseCustomModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isMobile } = useResponsive();
  
  const handleButtonClick = () => {
    // Clear any existing files before opening modal
    uppy.getFiles().forEach(file => uppy.removeFile(file.id));
    
    // Use custom modal for better positioning
    if (isMobile) {
      setUseCustomModal(true);
      setShowModal(true);
    } else {
      setShowModal(true);
    }
  };
  const [uppy] = useState(() =>
    new Uppy({
      restrictions: {
        maxNumberOfFiles,
        maxFileSize,
        allowedFileTypes: ['image/*'],
      },
      autoProceed: true, // Automatically start upload when files are added
    })
      .use(AwsS3, {
        shouldUseMultipart: false,
        getUploadParameters: onGetUploadParameters,
      })
      .on("complete", (result) => {
        if (result.successful && result.successful.length > 0) {
          onComplete?.(result);
          setShowModal(false);
        }
      })
      .on("upload-error", (file, error) => {
        console.error('Photo upload error:', error);
      })
  );

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      // Add files to Uppy
      Array.from(files).forEach(file => {
        uppy.addFile({
          name: file.name,
          type: file.type,
          data: file,
        });
      });
    }
  };

  return (
    <div>
      <Button 
        type="button"
        variant="ghost"
        onClick={handleButtonClick} 
        className={buttonClassName}
        data-testid="button-photo-upload"
      >
        {children}
      </Button>

      {/* Custom modal for mobile with better positioning */}
      {useCustomModal && isMobile && (
        <Sheet open={showModal} onOpenChange={setShowModal}>
          <SheetContent side="bottom" className="h-auto max-h-[80vh]">
            <SheetHeader>
              <SheetTitle>Upload Photos</SheetTitle>
              <SheetDescription>
                Select up to {maxNumberOfFiles} images to upload (max {Math.round(maxFileSize / 1024 / 1024)}MB each)
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple={maxNumberOfFiles > 1}
                onChange={handleFileSelect}
                className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg text-center cursor-pointer hover:border-gray-400 transition-colors"
              />
              <p className="text-xs text-gray-500 mt-2 text-center">
                Tap to select photos from your device
              </p>
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Default Uppy modal for desktop */}
      {showModal && (!useCustomModal || !isMobile) && (
        <DashboardModal
          uppy={uppy}
          open={showModal}
          onRequestClose={() => {
            setShowModal(false);
            setUseCustomModal(false);
          }}
          proudlyDisplayPoweredByUppy={false}
          note="Images only, up to 10MB each"
          target="body"
        />
      )}
    </div>
  );
}