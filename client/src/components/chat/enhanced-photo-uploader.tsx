import React, { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Image, X, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

interface EnhancedPhotoUploaderProps {
  onUploadComplete: (photoUrl: string, fileName: string) => void;
  className?: string;
  disabled?: boolean;
}

export function EnhancedPhotoUploader({
  onUploadComplete,
  className,
  disabled = false,
}: EnhancedPhotoUploaderProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const resetUploader = useCallback(() => {
    setIsUploading(false);
    setUploadProgress(0);
    setSelectedFile(null);
    setIsExpanded(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [previewUrl]);

  const validateFile = (file: File): boolean => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return false;
    }
    
    if (file.size > 10485760) { // 10MB
      toast({
        title: "File Too Large",
        description: "Please select an image smaller than 10MB.",
        variant: "destructive",
      });
      return false;
    }
    
    return true;
  };

  const handleFileSelect = useCallback((file: File) => {
    if (!validateFile(file)) return;
    
    setSelectedFile(file);
    setIsExpanded(true);
    
    // Create preview
    const preview = URL.createObjectURL(file);
    setPreviewUrl(preview);
  }, []);

  const uploadFile = useCallback(async (file: File) => {
    try {
      setIsUploading(true);
      setUploadProgress(0);

      // Get upload URL
      const response = await apiRequest('POST', '/api/photos/upload-url', { 
        fileName: file.name 
      });
      const { uploadURL } = await response.json();

      // Upload file with progress
      const xhr = new XMLHttpRequest();
      
      return new Promise<void>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(progress);
          }
        });

        xhr.onload = () => {
          if (xhr.status === 200) {
            console.log('Upload successful:', uploadURL);
            onUploadComplete(uploadURL, file.name);
            resetUploader();
            toast({
              title: "Photo Uploaded",
              description: "Your photo has been shared successfully.",
            });
            resolve();
          } else {
            reject(new Error(`Upload failed with status: ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.open('PUT', uploadURL);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload photo. Please try again.",
        variant: "destructive",
      });
      resetUploader();
    }
  }, [onUploadComplete, resetUploader, toast]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleUpload = () => {
    if (selectedFile && !isUploading) {
      uploadFile(selectedFile);
    }
  };

  const handleCancel = () => {
    resetUploader();
  };

  const openFileSelector = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const toggleExpanded = () => {
    if (!selectedFile && !isUploading) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        className="hidden"
        disabled={disabled || isUploading}
      />

      {/* Compact Button or Expanded Upload Area */}
      {!isExpanded ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggleExpanded}
          disabled={disabled}
          className={cn(
            "text-gray-500 hover:text-primary transition-colors duration-200 flex-shrink-0",
            "p-1.5 sm:p-2 md:p-2.5",
            "w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10"
          )}
          data-testid="button-photo-upload"
        >
          <Image className="w-4 h-4 sm:w-5 sm:h-5" />
        </Button>
      ) : !selectedFile ? (
        <div
          className={cn(
            "relative border-2 border-dashed rounded-lg transition-colors duration-200",
            "flex items-center justify-center p-6 cursor-pointer",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-gray-300 hover:border-primary hover:bg-primary/5",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={!disabled ? openFileSelector : undefined}
        >
          <div className="text-center space-y-2">
            <Image className="w-8 h-8 mx-auto text-gray-400" />
            <div className="text-sm text-gray-600">
              <span className="font-medium text-primary">Click to upload</span> or drag and drop
            </div>
            <div className="text-xs text-gray-400">
              Images only, up to 10MB
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(false);
            }}
            className="absolute top-2 right-2 h-6 w-6 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        /* Preview and Upload Controls */
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          {/* Preview */}
          <div className="flex items-start space-x-3">
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Preview"
                className="w-16 h-16 object-cover rounded-lg"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {selectedFile.name}
              </p>
              <p className="text-xs text-gray-500">
                {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
              </p>
            </div>
            {!isUploading && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Progress Bar */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}

          {/* Action Buttons */}
          {!isUploading && (
            <div className="flex space-x-2">
              <Button
                onClick={handleUpload}
                disabled={disabled}
                className="flex-1"
                size="sm"
              >
                <Upload className="w-4 h-4 mr-2" />
                Send Photo
              </Button>
              <Button
                onClick={openFileSelector}
                variant="outline"
                disabled={disabled}
                size="sm"
              >
                Change
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}