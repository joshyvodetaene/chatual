import React, { useState } from "react";
import type { ReactNode } from "react";
import Uppy from "@uppy/core";
import { DashboardModal } from "@uppy/react";
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";
import AwsS3 from "@uppy/aws-s3";
import type { UploadResult } from "@uppy/core";
import { Button } from "@/components/ui/button";
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
  const { isMobile } = useResponsive();
  
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
          // Restore scrolling when modal closes
          if (isMobile) {
            document.body.style.overflow = '';
          }
        }
      })
      .on("upload-error", (file, error) => {
        console.error('Photo upload error:', error);
      })
  );

  const handleButtonClick = () => {
    // Clear any existing files before opening modal
    uppy.getFiles().forEach(file => uppy.removeFile(file.id));
    setShowModal(true);
    
    // Prevent background scrolling on mobile when modal is open
    if (isMobile) {
      document.body.style.overflow = 'hidden';
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

      <DashboardModal
        uppy={uppy}
        open={showModal}
        onRequestClose={() => {
          setShowModal(false);
          // Restore scrolling when modal closes
          if (isMobile) {
            document.body.style.overflow = '';
          }
        }}
        proudlyDisplayPoweredByUppy={false}
        note="Images only, up to 10MB each"
        closeModalOnClickOutside={true}
        showLinkToFileUploadResult={false}
        showProgressDetails={true}
        hideUploadButton={false}
      />
    </div>
  );
}