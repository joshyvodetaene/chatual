import { useEffect, useRef, useCallback, useState } from 'react';
import { MessageWithUser, User, RoomWithMembers } from '@shared/schema';
import { UserPlus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactionPicker from '@/components/reactions/reaction-picker';
import ReactionDisplay from '@/components/reactions/reaction-display';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { ReactionSummary } from '@shared/schema';
import PhotoMessage from './photo-message';
import { Button } from '@/components/ui/button';
import { useResponsive } from '@/hooks/use-responsive';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useMobileKeyboard } from '@/hooks/use-mobile-keyboard';

interface MessageListProps {
  messages: MessageWithUser[];
  currentUser: User;
  typingUsers: Set<string>;
  activeRoomData?: RoomWithMembers;
  isLoading?: boolean;
  isLoadingMore?: boolean;
  hasMoreMessages?: boolean;
  onLoadMore?: () => void;
  onStartPrivateChat?: (userId: string) => void;
  isMobile?: boolean;
}

interface MessageWithReactions extends MessageWithUser {
  reactions?: ReactionSummary[];
}

export default function MessageList({
  messages,
  currentUser,
  typingUsers,
  activeRoomData,
  isLoading = false,
  isLoadingMore = false,
  hasMoreMessages = false,
  onLoadMore,
  onStartPrivateChat,
  isMobile: propIsMobile,
}: MessageListProps) {
  const { isMobile: hookIsMobile, isTablet } = useResponsive();
  const isMobile = propIsMobile ?? hookIsMobile;
  const { isKeyboardOpen } = useMobileKeyboard();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Reaction mutations
  const addReactionMutation = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      return await apiRequest('POST', `/api/messages/${messageId}/reactions`, {
        userId: currentUser.id,
        emoji
      });
    },
    onSuccess: () => {
      // Invalidate message queries to refresh reactions
      queryClient.invalidateQueries({ queryKey: ['/api/rooms'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add reaction",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const removeReactionMutation = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      return await apiRequest('DELETE', `/api/messages/${messageId}/reactions`, {
        userId: currentUser.id,
        emoji
      });
    },
    onSuccess: () => {
      // Invalidate message queries to refresh reactions
      queryClient.invalidateQueries({ queryKey: ['/api/rooms'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove reaction",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAddReaction = (messageId: string, emoji: string) => {
    addReactionMutation.mutate({ messageId, emoji });
  };
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesStartRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);
  const previousScrollHeight = useRef<number>(0);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize chat layout properly every time user accesses a chatroom
  useEffect(() => {
    const initializeChatLayout = () => {
      const container = containerRef.current;
      if (!container) return;

      // Force layout reflow to ensure CSS is properly applied
      container.style.display = 'none';
      container.offsetHeight; // Trigger reflow
      container.style.display = '';

      // Ensure proper z-index stacking and containment
      container.style.position = 'relative';
      container.style.zIndex = '1';
      container.style.contain = 'layout style';
      container.style.isolation = 'isolate';

      // Reset and ensure proper scroll position
      setTimeout(() => {
        if (messagesEndRef.current && messages.length > 0) {
          messagesEndRef.current.scrollIntoView({ behavior: 'instant' });
        }
        setIsInitialized(true);
      }, 100);
    };

    if (activeRoomData?.id) {
      setIsInitialized(false);
      initializeChatLayout();
    }
  }, [activeRoomData?.id, messages.length]);

  // Auto-scroll to bottom for new messages, maintain position when loading older ones
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isInitialized) return;

    // Always scroll to bottom when new messages arrive, unless user is actively viewing older messages
    if (messages.length > 0) {
      // Check if user is near the bottom or if we should force scroll
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      const scrollTop = container.scrollTop;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      
      // Force scroll if shouldScrollToBottom is true or if user is close to bottom (within 150px)
      const isNearBottom = distanceFromBottom < 150;
      
      if (shouldScrollToBottom || isNearBottom) {
        // Small delay to ensure DOM has updated with new content
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 50);
      }
    }
    
    if (isLoadingMore && previousScrollHeight.current > 0) {
      // Maintain scroll position when loading older messages (reverse pagination)
      const newScrollHeight = container.scrollHeight;
      const heightDifference = newScrollHeight - previousScrollHeight.current;
      container.scrollTop = container.scrollTop + heightDifference;
    }

    // Update previous scroll height for next comparison
    previousScrollHeight.current = container.scrollHeight;
  }, [messages, shouldScrollToBottom, isLoadingMore, isInitialized]);

  // Handle infinite scroll for loading older messages (reverse pagination)
  const handleScroll = useCallback(() => {
    if (!containerRef.current || !onLoadMore || isLoadingMore || !hasMoreMessages) return;

    const container = containerRef.current;
    const scrollTop = container.scrollTop;
    const threshold = 50; // Reduced threshold for more responsive loading

    // Load older messages when scrolling near the top
    if (scrollTop <= threshold) {
      setShouldScrollToBottom(false); // Don't auto-scroll when loading older messages
      onLoadMore();
    }

    // Re-enable auto-scroll when user scrolls near the bottom (more aggressive threshold)
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    if (distanceFromBottom < 50) { // More aggressive threshold for better UX
      setShouldScrollToBottom(true);
    } else if (distanceFromBottom > 200) {
      // Only disable auto-scroll if user has scrolled significantly up
      setShouldScrollToBottom(false);
    }
  }, [onLoadMore, isLoadingMore, hasMoreMessages]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (name: string, gender?: string) => {
    // Use gender-based colors if gender is provided
    if (gender === 'female') {
      return 'bg-gradient-to-br from-red-400 to-red-600';
    }
    if (gender === 'male') {
      return 'bg-gradient-to-br from-blue-400 to-blue-600';
    }
    
    // Fallback to name-based colors for users without gender info
    const colors = [
      'bg-gradient-to-br from-green-400 to-green-600',
      'bg-gradient-to-br from-purple-400 to-purple-600',
      'bg-gradient-to-br from-orange-400 to-orange-600',
      'bg-gradient-to-br from-pink-400 to-pink-600',
      'bg-gradient-to-br from-indigo-400 to-indigo-600',
      'bg-gradient-to-br from-teal-400 to-teal-600',
    ];
    const hash = name.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (!activeRoomData) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500">Select a room to start chatting</p>
      </div>
    );
  }

  // Use a separate array for mapping to ensure unique keys
  const displayMessages = messages;

  return (
    <div 
      ref={containerRef}
      className={cn(
        "flex-1 overflow-y-auto hide-scrollbar p-2 sm:p-3 md:p-4 lg:p-6 space-y-0.5 chat-messages-container relative",
        // Add bottom padding when mobile keyboard is open to prevent content being hidden behind fixed input
        isMobile && isKeyboardOpen && "pb-20"
      )}
      style={{
        contain: 'layout style',
        isolation: 'isolate'
      }}
      data-testid="message-list"
    >
      {/* Loading indicator for initial load */}
      {isLoading && messages.length === 0 && (
        <div className="flex justify-center items-center h-32">
          <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 animate-spin text-gray-400" />
          <span className="ml-1 sm:ml-2 md:ml-3 text-xs sm:text-sm md:text-base text-gray-500">Loading messages...</span>
        </div>
      )}

      {/* Load more indicator */}
      {isLoadingMore && (
        <div className="flex justify-center items-center py-4" ref={messagesStartRef}>
          <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 animate-spin text-gray-400" />
          <span className="ml-1 sm:ml-2 md:ml-3 text-gray-500 text-xs sm:text-sm md:text-base">Loading more messages...</span>
        </div>
      )}

      {/* Load more button (shown when not auto-loading) */}
      {!isLoadingMore && hasMoreMessages && messages.length > 0 && onLoadMore && (
        <div className="flex justify-center py-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onLoadMore}
            className="text-gray-500 hover:text-gray-700"
            data-testid="button-load-more-messages"
          >
            Load older messages
          </Button>
        </div>
      )}

      {displayMessages.map((message) => {
        const isOwnMessage = message.userId === currentUser.id;

        // Handle photo messages
        if (message.messageType === 'photo') {
          console.log('Rendering photo message:', {
            id: message.id,
            messageType: message.messageType,
            photoUrl: message.photoUrl,
            photoFileName: message.photoFileName,
            content: message.content
          });
          return (
            <PhotoMessage
              key={message.id}
              message={message}
              isOwn={isOwnMessage}
            />
          );
        }

        // Handle text messages
        return (
          <div
            key={message.id}
            className={cn(
              "flex items-start space-x-2 relative w-full message-container",
              isOwnMessage && "flex-row-reverse space-x-reverse"
            )}
            data-testid={`message-${message.id}`}
          >
            {/* Always try to show profile picture first, fallback to avatar */}
            {message.user.primaryPhoto?.photoUrl ? (
              <img 
                src={message.user.primaryPhoto.photoUrl}
                alt={`${message.user.displayName} profile`}
                className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full object-cover flex-shrink-0 border-2 border-white shadow-sm"
                onError={(e) => {
                  // Fallback to initials if image fails to load
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            ) : null}
            {/* Fallback avatar - hidden by default, shown if image fails to load or no profile picture */}
            <div 
              className={cn(
                "w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-white text-xs sm:text-sm md:text-base font-medium flex-shrink-0",
                isOwnMessage ? "bg-primary" : getAvatarColor(message.user.displayName, message.user.gender),
                message.user.primaryPhoto?.photoUrl ? "hidden" : "flex"
              )}
              style={{ 
                display: message.user.primaryPhoto?.photoUrl ? 'none' : 'flex' 
              }}
            >
              {getInitials(message.user.displayName)}
            </div>
            <div className={cn("flex-1", isOwnMessage && "text-right")}>
              <div className={cn(
                "flex items-baseline space-x-2 mb-1",
                isOwnMessage && "justify-end"
              )}>
                {!isOwnMessage && (
                  <span className="text-xs sm:text-sm md:text-base font-semibold text-white">
                    {message.user.displayName}
                  </span>
                )}
                <span className="text-xs text-gray-500" data-testid={`message-time-${message.id}`}>
                  {formatTime(message.createdAt!)}
                </span>
                {isOwnMessage && (
                  <span className="text-sm font-semibold text-white">You</span>
                )}
              </div>
              <div className={cn(
                "group relative",
                isOwnMessage && "flex flex-col items-end"
              )}>
                <div className={cn(
                  "rounded-2xl relative break-words",
                  "p-2.5",
                  "max-w-[85%] sm:max-w-xs md:max-w-md lg:max-w-lg xl:max-w-xl",
                  "bg-black text-white border border-gray-700 shadow-sm",
                  isOwnMessage
                    ? "rounded-tr-md ml-auto"
                    : "rounded-tl-md"
                )}>
                  <p className={cn(
                    "leading-relaxed",
                    "text-sm",
                    "text-white"
                  )}>
                    {message.content}
                  </p>

                  {/* Reaction Picker */}
                  <div className={cn(
                    "absolute top-2 opacity-0 group-hover:opacity-100 transition-opacity",
                    isOwnMessage ? "-left-8" : "-right-8"
                  )}>
                    <ReactionPicker
                      onSelectEmoji={(emoji) => handleAddReaction(message.id, emoji)}
                      disabled={addReactionMutation.isPending}
                    />
                  </div>
                </div>

                {/* Reaction Display */}
                <ReactionDisplay
                  reactions={[]} // Will be populated when we have real reaction data
                  onToggleReaction={(emoji) => handleAddReaction(message.id, emoji)}
                  disabled={addReactionMutation.isPending || removeReactionMutation.isPending}
                  className={cn(isOwnMessage && "self-end")}
                />
              </div>
            </div>
          </div>
        );
      })}


      {/* Typing Indicator */}
      {Array.from(typingUsers).map((userId) => {
        const typingUser = activeRoomData.members.find(m => m.id === userId);
        if (!typingUser || userId === currentUser.id) return null;

        return (
          <div key={userId} className="flex items-start space-x-2 mt-1" data-testid="typing-indicator">
            {typingUser.primaryPhoto?.photoUrl ? (
              <img 
                src={typingUser.primaryPhoto.photoUrl}
                alt={`${typingUser.displayName} profile`}
                className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full object-cover flex-shrink-0 border-2 border-white shadow-sm"
                onError={(e) => {
                  // Fallback to initials if image fails to load
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            ) : null}
            {/* Fallback avatar - hidden by default, shown if image fails to load */}
            <div 
              className={cn(
                "w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-white text-xs sm:text-sm md:text-base font-medium flex-shrink-0",
                getAvatarColor(typingUser.displayName, typingUser.gender),
                typingUser.primaryPhoto?.photoUrl ? "hidden" : "flex"
              )}
              style={{ 
                display: typingUser.primaryPhoto?.photoUrl ? 'none' : 'flex' 
              }}
            >
              {getInitials(typingUser.displayName)}
            </div>
            <div className="flex-1">
              <div className="flex items-baseline space-x-2 mb-0.5">
                <span className="text-sm font-semibold text-white">
                  {typingUser.displayName}
                </span>
                <span className="text-xs text-gray-500">typing...</span>
              </div>
              <div className="bg-white p-2 rounded-2xl rounded-tl-md border border-gray-200 w-16 h-8 flex items-center justify-center">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <div ref={messagesEndRef} />
    </div>
  );
}