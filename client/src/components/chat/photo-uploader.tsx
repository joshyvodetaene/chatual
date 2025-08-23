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
    console.log('Photo uploader clicked, opening uploader...');
    // Clear any existing files
    uppy.getFiles().forEach(file => uppy.removeFile(file.id));
    setShowUploader(!showUploader);
  };

  const handleClose = () => {
    console.log('Closing photo uploader...');
    setShowUploader(false);
  };

  if (!showUploader) {
    return (
      <Button 
        type="button"
        variant="ghost"
        onClick={handleButtonClick} 
        className={buttonClassName}
        data-testid="button-photo-upload"
      >
        {children}
      </Button>
    );
  }

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

      {/* Photo uploader panel - opens upward like emoji picker */}
      <div className={cn(
        "absolute bottom-12 z-50 bg-black border border-gray-700 rounded-lg shadow-lg backdrop-blur-sm",
        "w-[calc(100vw-1rem)] max-w-sm h-80",
        "sm:w-80 sm:h-96 sm:max-w-md",
        "md:w-96 md:h-[28rem] md:max-w-lg",
        "lg:w-[28rem] lg:h-[32rem] lg:max-w-xl",
        "right-2 sm:right-2 md:right-4"
      )} data-testid="photo-uploader-panel">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex justify-between items-center p-3 border-b border-gray-700">
            <h3 className="text-sm font-medium text-white">Upload Photos</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-6 w-6 p-0 text-gray-400 hover:text-white"
              data-testid="button-close-photo-uploader"
            >
              ✕
            </Button>
          </div>

          {/* Uppy Dashboard */}
          <div className="flex-1 p-2">
            <Dashboard
              uppy={uppy}
              height={isMobile ? 250 : 350}
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
    </div>
  );
}