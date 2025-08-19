import { useState, useRef, useEffect } from 'react';
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

  return (
    <div className={cn(
      "border-t border-gray-200 bg-white mobile-safe-area",
      "p-2 sm:p-3 md:p-4 lg:p-6"
    )} data-testid="message-input">
      <div className="flex items-end space-x-1 sm:space-x-2 md:space-x-3 lg:space-x-4">
        <PhotoUploader
          maxNumberOfFiles={1}
          maxFileSize={10485760} // 10MB
          onGetUploadParameters={handleGetUploadParameters}
          onComplete={handlePhotoUploadComplete}
          buttonClassName="hover:bg-gray-100 rounded-lg transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 hover:shadow-md tap-target p-1 sm:p-2 md:p-3"
        >
          <Image className="text-gray-500 w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
        </PhotoUploader>
        
        <div className="flex-1">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="resize-none border border-gray-300 rounded-2xl focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-20 placeholder-gray-500 touch-manipulation px-3 sm:px-4 md:px-5 py-2 sm:py-3 md:py-4 pr-10 sm:pr-12 md:pr-14 text-sm sm:text-base md:text-lg min-h-[40px] sm:min-h-[44px] md:min-h-[48px] max-h-[100px] sm:max-h-[120px] md:max-h-[140px]"
              rows={1}
              disabled={disabled}
              data-testid="input-message"
            />
            <Button
              ref={emojiButtonRef}
              variant="ghost"
              size="sm"
              className="absolute right-2 sm:right-3 md:right-4 bottom-2 sm:bottom-3 md:bottom-4 h-auto hover:bg-gray-100 transition-all duration-200 ease-in-out transform hover:scale-110 active:scale-95 hover:shadow-sm tap-target p-1 sm:p-2 md:p-3"
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
          className="bg-primary text-white rounded-2xl hover:bg-primary/90 transition-all duration-300 ease-in-out transform hover:scale-110 active:scale-95 hover:shadow-xl hover:shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100 tap-target touch-manipulation p-2 sm:p-3 md:p-4 min-h-[40px] sm:min-h-[44px] md:min-h-[48px] min-w-[40px] sm:min-w-[44px] md:min-w-[48px]"
          data-testid="button-send"
        >
          <Send className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
        </Button>
      </div>
    </div>
  );
}
