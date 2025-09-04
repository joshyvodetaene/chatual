import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Smile, Image } from 'lucide-react';
import EmojiPicker from './emoji-picker';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { User } from '@shared/schema';
import { useResponsive } from '@/hooks/use-responsive';
import { useMobileKeyboard } from '@/hooks/use-mobile-keyboard';
import { useQuery } from '@tanstack/react-query';
import MentionDropdown from './mention-dropdown';

interface MessageInputProps {
  onSendMessage: (content: string, photoUrl?: string, photoFileName?: string, mentionedUserIds?: string[]) => void;
  onTyping: (isTyping: boolean) => void;
  disabled?: boolean;
  currentUser?: User;
  roomId?: string;
}

export default function MessageInputEnhanced({
  onSendMessage,
  onTyping,
  disabled = false,
  currentUser,
  roomId,
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [mentionedUsers, setMentionedUsers] = useState<User[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const { toast } = useToast();
  const { isMobile, isTablet } = useResponsive();
  const { isKeyboardOpen, scrollToBottom } = useMobileKeyboard();

  // Get room members for mentions
  const { data: roomData } = useQuery<{ room: { members: User[] } }>({
    queryKey: ['/api/rooms', roomId],
    enabled: !!roomId,
  });

  const availableUsers = roomData?.room.members.filter(user => user.id !== currentUser?.id) || [];

  const handleSendMessage = useCallback(() => {
    if (message.trim() && !disabled) {
      const mentionedUserIds = mentionedUsers.map(user => user.id);
      onSendMessage(message.trim(), undefined, undefined, mentionedUserIds);
      setMessage('');
      setMentionedUsers([]);
      handleStopTyping();

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  }, [message, disabled, mentionedUsers, onSendMessage]);

  // Handle photo upload using the same method as photo management
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const handlePhotoButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Error",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10485760) { // 10MB
      toast({
        title: "Error",
        description: "Image must be less than 10MB",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploadingPhoto(true);
      
      // Get upload URL using the same endpoint as photo management
      const response = await apiRequest('POST', '/api/photos/upload-url', { 
        fileName: file.name 
      });
      const data = await response.json();

      // Upload file directly
      const uploadResponse = await fetch(data.uploadURL, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      // Send the photo as a message
      const mentionedUserIds = mentionedUsers.map(user => user.id);
      onSendMessage(message.trim() || '', data.uploadURL, file.name, mentionedUserIds);
      
      setMessage('');
      setMentionedUsers([]);
      handleStopTyping();

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }

      toast({
        title: "Photo Sent",
        description: "Your photo has been shared successfully.",
      });

      // Reset file input
      event.target.value = '';
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast({
        title: "Upload Error",
        description: "Failed to upload photo. Please try again.",
        variant: "destructive",
      });
      event.target.value = '';
    } finally {
      setUploadingPhoto(false);
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
        textarea.style.height = Math.min(textarea.scrollHeight, isMobile ? 100 : 120) + 'px';
      }, 0);
    }
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (showMentions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex(prev => 
          Math.min(prev + 1, getFilteredUsers().length - 1)
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex(prev => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const filteredUsers = getFilteredUsers();
        if (filteredUsers[selectedMentionIndex]) {
          selectMention(filteredUsers[selectedMentionIndex]);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentions(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey && !showMentions) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [showMentions, selectedMentionIndex, handleSendMessage]);

  const handleStartTyping = useCallback(() => {
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
  }, [isTyping, onTyping]);

  const handleStopTyping = useCallback(() => {
    if (isTyping) {
      setIsTyping(false);
      onTyping(false);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, [isTyping, onTyping]);

  const getFilteredUsers = useCallback(() => {
    if (!mentionQuery) return availableUsers;
    return availableUsers.filter(user => 
      user.displayName.toLowerCase().includes(mentionQuery.toLowerCase()) ||
      user.username.toLowerCase().includes(mentionQuery.toLowerCase())
    );
  }, [availableUsers, mentionQuery]);

  // Handle click outside emoji picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiButtonRef.current &&
          !emojiButtonRef.current.contains(event.target as Node) &&
          showEmojiPicker) {
        // Check if click is inside emoji picker
        const emojiPicker = document.querySelector('[data-testid="emoji-picker"]');
        if (!emojiPicker?.contains(event.target as Node)) {
          setShowEmojiPicker(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  const selectMention = useCallback((user: User) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;
    const textBefore = message.substring(0, cursorPos);
    const textAfter = message.substring(cursorPos);
    
    // Find the @ symbol that triggered this mention
    const lastAtIndex = textBefore.lastIndexOf('@');
    const beforeAt = textBefore.substring(0, lastAtIndex);
    const newMessage = `${beforeAt}@${user.username} ${textAfter}`;
    
    setMessage(newMessage);
    setShowMentions(false);
    setMentionQuery('');
    setSelectedMentionIndex(0);
    
    // Add user to mentioned users if not already there
    setMentionedUsers(prev => {
      if (!prev.find(u => u.id === user.id)) {
        return [...prev, user];
      }
      return prev;
    });
    
    // Focus back to textarea
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = beforeAt.length + user.username.length + 2; // +2 for @ and space
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        textareaRef.current.focus();
      }
    }, 0);
  }, [message]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);

    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, isMobile ? 100 : 120) + 'px';

    // Handle typing indicator
    if (value.trim()) {
      handleStartTyping();
    } else {
      handleStopTyping();
    }

    // Check for mentions
    const cursorPos = textarea.selectionStart;
    const textBefore = value.substring(0, cursorPos);
    const lastAtIndex = textBefore.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBefore.substring(lastAtIndex + 1);
      const hasSpaceAfterAt = textAfterAt.includes(' ');
      
      if (!hasSpaceAfterAt && textAfterAt.length <= 20) {
        // Show mentions dropdown
        setMentionQuery(textAfterAt);
        setShowMentions(true);
        setSelectedMentionIndex(0);
        
        // Calculate position for dropdown
        const rect = textarea.getBoundingClientRect();
        setMentionPosition({
          top: rect.top - 200, // Show above textarea
          left: rect.left,
        });
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  }, [handleStartTyping, handleStopTyping, isMobile]);

  // Handle mobile keyboard
  useEffect(() => {
    if (isKeyboardOpen && isMobile) {
      const chatContainer = document.querySelector('.chat-messages-container');
      if (chatContainer) {
        scrollToBottom(chatContainer as HTMLElement);
      }
    }
  }, [isKeyboardOpen, isMobile, scrollToBottom]);

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
      "flex flex-col space-y-2 p-2 sm:p-3 md:p-4 bg-card/90 backdrop-blur-sm border-t border-primary/20",
      // Adjust position when mobile keyboard is open
      isMobile && isKeyboardOpen && "fixed bottom-0 left-0 right-0 z-30"
    )}>
      {/* Mention suggestions */}
      {showMentions && (
        <MentionDropdown
          users={getFilteredUsers()}
          selectedIndex={selectedMentionIndex}
          onSelectUser={selectMention}
          position={mentionPosition}
        />
      )}

      <div className="flex space-x-1.5 sm:space-x-2 md:space-x-3 lg:space-x-4 items-end">
        {/* Emoji Picker Button */}
        <Button
          ref={emojiButtonRef}
          type="button"
          variant="ghost"
          size={isMobile ? "sm" : "default"}
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className={cn(
            "text-gray-500 hover:text-primary transition-colors duration-200 flex-shrink-0",
            "p-1.5 sm:p-2 md:p-2.5",
            "w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10",
            showEmojiPicker && "text-primary bg-primary/10"
          )}
          data-testid="button-emoji-picker"
        >
          <Smile className="w-4 h-4 sm:w-5 sm:h-5" />
        </Button>

        {/* Photo Upload Button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          data-testid="input-photo-file"
        />
        <Button
          type="button"
          variant="ghost"
          size={isMobile ? "sm" : "default"}
          onClick={handlePhotoButtonClick}
          disabled={uploadingPhoto || disabled}
          className={cn(
            "text-gray-500 hover:text-primary transition-colors duration-200 flex-shrink-0",
            "p-1.5 sm:p-2 md:p-2.5",
            "w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10",
            uploadingPhoto && "opacity-50 cursor-not-allowed"
          )}
          data-testid="button-photo-upload"
        >
          <Image className={cn("w-4 h-4 sm:w-5 sm:h-5", uploadingPhoto && "animate-pulse")} />
        </Button>

        <div className="flex-1 relative">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message... Use @ to mention users"
              disabled={disabled}
              className={cn(
                "resize-none border-0 bg-white/90 backdrop-blur-sm shadow-sm focus:ring-2 focus:ring-primary/50 placeholder:text-gray-500 overflow-y-auto transition-all duration-200 rounded-lg text-black",
                "text-sm sm:text-base md:text-lg",
                "py-2 sm:py-2.5 md:py-3",
                "pr-12 sm:pr-14 md:pr-16 lg:pr-20",
                "pl-2 sm:pl-3 md:pl-4",
                // Mobile keyboard optimizations
                isMobile ? "min-h-[36px] max-h-20" : "min-h-[40px] max-h-24 sm:min-h-[44px] sm:max-h-28 md:min-h-[48px] md:max-h-32",
                // Ensure text is large enough to prevent zoom on iOS
                isMobile && "text-base"
              )}
              style={{
                fontSize: isMobile ? '16px' : undefined, // Prevent iOS zoom
              }}
              data-testid="input-message"
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
          <Send className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 relative z-10" />
        </Button>
      </div>

      {/* Emoji Picker */}
      <div className="relative">
        <EmojiPicker
          onEmojiSelect={handleEmojiSelect}
          isOpen={showEmojiPicker}
          onToggle={() => setShowEmojiPicker(!showEmojiPicker)}
        />
      </div>

      {/* Show mentioned users */}
      {mentionedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <span className="text-xs text-gray-500">Mentioning:</span>
          {mentionedUsers.map((user) => (
            <span 
              key={user.id}
              className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
            >
              @{user.username}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}