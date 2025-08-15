import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Paperclip, Smile, Send, Image } from 'lucide-react';
import { PhotoUploader } from './photo-uploader';
import { apiRequest } from '@/lib/queryClient';
import type { UploadResult } from '@uppy/core';
import { useToast } from '@/hooks/use-toast';

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const { toast } = useToast();

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="border-t border-gray-200 bg-white p-4" data-testid="message-input">
      <div className="flex items-end space-x-3">
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          data-testid="button-attach-file"
        >
          <Paperclip className="w-4 h-4 text-gray-500" />
        </Button>
        
        <div className="flex-1">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="resize-none border border-gray-300 rounded-2xl px-4 py-3 pr-12 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-20 placeholder-gray-500 text-sm min-h-[44px] max-h-[120px]"
              rows={1}
              disabled={disabled}
              data-testid="input-message"
            />
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-3 bottom-3 h-auto p-1"
              disabled={disabled}
              data-testid="button-emoji"
            >
              <Smile className="w-4 h-4 text-gray-500" />
            </Button>
          </div>
        </div>
        
        <Button
          onClick={handleSendMessage}
          disabled={!message.trim() || disabled}
          className="bg-primary text-white p-3 rounded-2xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="button-send"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
