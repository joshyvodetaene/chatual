import React, { useState, useEffect } from "react";
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
  
  // Create uppy instance
  const [uppy] = useState(() =>
    new Uppy({
      restrictions: {
        maxNumberOfFiles,
        maxFileSize,
        allowedFileTypes: ['image/*'],
      },
      autoProceed: false, // Let user manually start upload
    })
      .use(AwsS3, {
        shouldUseMultipart: false,
        getUploadParameters: onGetUploadParameters,
      })
  );

  // Handle upload completion
  useEffect(() => {
    const handleComplete = (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
      if (result.successful && result.successful.length > 0) {
        onComplete?.(result);
        setShowModal(false);
        // Clear files after successful upload
        uppy.getFiles().forEach(file => uppy.removeFile(file.id));
        
        // Restore scrolling when modal closes
        if (isMobile) {
          document.body.style.overflow = '';
        }
      }
    };

    const handleError = (file: any, error: any) => {
      console.error('Photo upload error:', error);
    };

    uppy.on('complete', handleComplete);
    uppy.on('upload-error', handleError);

    return () => {
      uppy.off('complete', handleComplete);
      uppy.off('upload-error', handleError);
    };
  }, [uppy, onComplete, isMobile]);

  const handleButtonClick = () => {
    console.log('Photo uploader clicked, opening modal...');
    // Clear any existing files
    uppy.getFiles().forEach(file => uppy.removeFile(file.id));
    setShowModal(true);
    
    // Prevent background scrolling on mobile
    if (isMobile) {
      document.body.style.overflow = 'hidden';
    }
  };

  const handleCloseModal = () => {
    console.log('Closing photo uploader modal...');
    setShowModal(false);
    
    // Restore scrolling
    if (isMobile) {
      document.body.style.overflow = '';
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

      {showModal && (
        <DashboardModal
          uppy={uppy}
          open={showModal}
          onRequestClose={handleCloseModal}
          proudlyDisplayPoweredByUppy={false}
          note="Images only, up to 10MB each"
          closeModalOnClickOutside={true}
          showLinkToFileUploadResult={false}
          showProgressDetails={true}
          hideUploadButton={false}
        />
      )}
    </div>
  );
}