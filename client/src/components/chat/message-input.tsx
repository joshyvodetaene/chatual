import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Paperclip, Smile, Send, Image } from 'lucide-react';
import { PhotoUploader } from './photo-uploader';
import EmojiPicker from './emoji-picker';
import { apiRequest } from '@/lib/queryClient';
import type { UploadResult } from '@uppy/core';
import { useToast } from '@/hooks/use-toast';
import { useResponsive } from '@/hooks/use-responsive';
import { cn } from '@/lib/utils';

interface MessageInputProps {
  onSendMessage: (content: string, photoUrl?: string, photoFileName?: string) => void;
  onTyping: (isTyping: boolean) => void;
  disabled?: boolean;
}

export default function MessageInput({
  onSendMessage,
  onTyping,
  disabled = false,
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const { toast } = useToast();
  const { isMobile, isTablet } = useResponsive();

  const handleSendMessage = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
      handleStopTyping();

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleStartTyping = () => {
    if (!isTyping) {
      setIsTyping(true);
      onTyping(true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing after 2 seconds
    typingTimeoutRef.current = setTimeout(() => {
      handleStopTyping();
    }, 2000);
  };

  const handleStopTyping = () => {
    if (isTyping) {
      setIsTyping(false);
      onTyping(false);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);

    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';

    // Handle typing indicator
    if (value.trim()) {
      handleStartTyping();
    } else {
      handleStopTyping();
    }
  };

  // Handle photo upload
  const handleGetUploadParameters = async () => {
    try {
      const response = await apiRequest('POST', '/api/photos/upload-url', { fileName: 'message-photo.jpg' });
      const data = await response.json();
      return {
        method: 'PUT' as const,
        url: data.uploadURL,
      };
    } catch (error) {
      console.error('Error getting upload parameters:', error);
      toast({
        title: "Upload Error",
        description: "Failed to get upload parameters. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handlePhotoUploadComplete = (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    try {
      if (result.successful && result.successful.length > 0) {
        const uploadedFile = result.successful[0];
        const photoUrl = uploadedFile.uploadURL;

        if (!photoUrl) {
          throw new Error('No upload URL received');
        }

        // Use the original filename for display, not the storage UUID filename
        const photoFileName = uploadedFile.name || 'photo.jpg';

        console.log('Photo upload completed:', { photoUrl, photoFileName, originalName: uploadedFile.name });

        // Send the photo as a message
        console.log('Calling onSendMessage with:', {
          content: message.trim() || '',
          photoUrl,
          photoFileName
        });
        onSendMessage(message.trim() || '', photoUrl, photoFileName);
        setMessage('');
        handleStopTyping();

        // Reset textarea height
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }

        toast({
          title: "Photo Sent",
          description: "Your photo has been shared successfully.",
        });
      } else {
        console.error('Photo upload failed:', result);
        toast({
          title: "Upload Error",
          description: "Failed to upload photo. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error handling photo upload:', error);
      toast({
        title: "Upload Error",
        description: "Failed to send photo. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle emoji selection
  const handleEmojiSelect = (emoji: string) => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentMessage = message;

      // Insert emoji at cursor position
      const newMessage = currentMessage.slice(0, start) + emoji + currentMessage.slice(end);
      setMessage(newMessage);

      // Set cursor position after the inserted emoji
      setTimeout(() => {
        const newCursorPosition = start + emoji.length;
        textarea.setSelectionRange(newCursorPosition, newCursorPosition);
        textarea.focus();

        // Auto-resize textarea
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
      }, 0);
    }

    setShowEmojiPicker(false);
  };

  // Handle click outside emoji picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiButtonRef.current &&
          !emojiButtonRef.current.contains(event.target as Node) &&
          showEmojiPicker) {
        // Check if click is inside emoji picker
        const emojiPicker = document.querySelector('[data-testid="emoji-picker"]');
        if (!emojiPicker || !emojiPicker.contains(event.target as Node)) {
          setShowEmojiPicker(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Renamed handleInputChange to handleChange for consistency with the changes provided
  const handleChange = handleInputChange;
  // Renamed handlePhotoUploadComplete to handlePhotoUpload for consistency with the changes provided
  const handlePhotoUpload = handlePhotoUploadComplete;


  return (
    <div className={cn(
      "border-t border-primary/20 bg-card/80 backdrop-blur-sm red-glow",
      "p-2 sm:p-3 md:p-4 lg:p-6"
    )} data-testid="message-input">
      <div className="flex space-x-1.5 sm:space-x-2 md:space-x-3 lg:space-x-4 items-end">
        <div className="flex-1 relative">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              disabled={disabled}
              className={cn(
                "resize-none border-0 bg-white/90 backdrop-blur-sm shadow-sm focus:ring-2 focus:ring-primary/50 placeholder:text-gray-500 min-h-[36px] max-h-24 sm:min-h-[40px] sm:max-h-28 md:min-h-[44px] md:max-h-32 overflow-y-auto transition-all duration-200 rounded-lg text-black",
                "text-sm sm:text-base md:text-lg",
                "py-2 sm:py-2.5 md:py-3",
                "pr-12 sm:pr-14 md:pr-16 lg:pr-20",
                "pl-2 sm:pl-3 md:pl-4"
              )}
              data-testid="input-message"
            />
            <Button
              ref={emojiButtonRef}
              variant="ghost"
              size="sm"
              className={cn(
                "absolute bottom-1 sm:bottom-1.5 md:bottom-2 hover:bg-gray-100 transition-all duration-200 ease-in-out transform hover:scale-110 active:scale-95 hover:shadow-sm rounded-lg",
                "right-1 sm:right-1.5 md:right-2",
                "p-1 sm:p-1.5 md:p-2",
                "w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10"
              )}
              disabled={disabled}
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              data-testid="button-emoji"
            >
              <Smile className={cn(
                showEmojiPicker ? 'text-primary' : 'text-gray-500',
                "w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6"
              )} />
            </Button>

            <EmojiPicker
              isOpen={showEmojiPicker}
              onEmojiSelect={handleEmojiSelect}
              onToggle={() => setShowEmojiPicker(!showEmojiPicker)}
            />
          </div>
        </div>

        <Button
          onClick={handleSendMessage}
          disabled={!message.trim() || disabled}
          className={cn(
            "bg-primary hover:bg-primary/90 text-white shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 active:scale-95 hover:shadow-xl rounded-xl red-glow hover-lift",
            "p-2 sm:p-2.5 md:p-3 lg:p-4",
            "w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 lg:w-14 lg:h-14",
            "flex-shrink-0 relative overflow-hidden",
            !message.trim() || disabled ? "opacity-50" : "pulse-glow"
          )}
          data-testid="button-send-message"
        >
          <div className="absolute inset-0 shimmer"></div>
          <Send className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 relative z-10" />
        </Button>

        <PhotoUploader
          onUpload={handlePhotoUpload}
          disabled={disabled}
          className={cn(
            "p-2 sm:p-2.5 md:p-3 lg:p-4",
            "w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 lg:w-14 lg:h-14",
            "flex-shrink-0 rounded-lg"
          )}
        />
      </div>
    </div>
  );
}