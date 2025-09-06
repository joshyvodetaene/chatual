import React, { useState, useEffect } from "react";
import type { ReactNode } from "react";
import Uppy from "@uppy/core";
import { Dashboard } from "@uppy/react";
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";
import AwsS3 from "@uppy/aws-s3";
import type { UploadResult } from "@uppy/core";
import { Button } from "@/components/ui/button";
import { useResponsive } from "@/hooks/use-responsive";
import { cn } from "@/lib/utils";

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
  const [showUploader, setShowUploader] = useState(false);
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
        setShowUploader(false);
        // Clear files after successful upload
        uppy.getFiles().forEach(file => uppy.removeFile(file.id));
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
  }, [uppy, onComplete]);

  const handleButtonClick = () => {
    // Clear any existing files
    uppy.getFiles().forEach(file => uppy.removeFile(file.id));
    setShowUploader(!showUploader);
  };

  const handleClose = () => {
    setShowUploader(false);
  };

  return (
    <div className="relative">
      <Button 
        type="button"
        variant="ghost"
        onClick={handleButtonClick} 
        className={buttonClassName}
        data-testid="button-photo-upload"
      >
        {children}
      </Button>

      {/* Photo uploader overlay - centered and clickable */}
      {showUploader && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
            data-testid="photo-uploader-backdrop"
          />
          
          {/* Centered photo uploader panel */}
          <div className={cn(
            "fixed z-50 bg-black border border-gray-700 rounded-lg shadow-xl",
            "w-[90vw] max-w-md h-[70vh] max-h-96",
            "sm:w-[80vw] sm:max-w-lg sm:h-[75vh] sm:max-h-[500px]",
            "md:w-[70vw] md:max-w-xl md:h-[80vh] md:max-h-[600px]",
            "left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2"
          )} data-testid="photo-uploader-panel">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex justify-between items-center p-3 border-b border-gray-700 bg-black rounded-t-lg">
                <h3 className="text-sm font-medium text-white">Upload Photos</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClose}
                  className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-800"
                  data-testid="button-close-photo-uploader"
                >
                  ✕
                </Button>
              </div>

              {/* Uppy Dashboard */}
              <div className="flex-1 p-2 bg-black rounded-b-lg">
                <Dashboard
                  uppy={uppy}
                  height={isMobile ? 200 : 300}
                  width="100%"
                  showLinkToFileUploadResult={false}
                  showProgressDetails={true}
                  hideUploadButton={false}
                  note="Images only, up to 10MB each"
                  proudlyDisplayPoweredByUppy={false}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}