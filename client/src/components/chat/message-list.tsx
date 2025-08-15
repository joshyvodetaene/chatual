import { useEffect, useRef, useCallback, useState } from 'react';
import { MessageWithUser, User, RoomWithMembers } from '@shared/schema';
import { UserPlus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import PhotoMessage from './photo-message';
import { Button } from '@/components/ui/button';

interface MessageListProps {
  messages: MessageWithUser[];
  currentUser: User;
  typingUsers: Set<string>;
  activeRoomData?: RoomWithMembers;
  isLoading?: boolean;
  isLoadingMore?: boolean;
  hasMoreMessages?: boolean;
  onLoadMore?: () => void;
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
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesStartRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);

  // Auto-scroll to bottom only for new messages, not when loading older ones
  useEffect(() => {
    if (shouldScrollToBottom && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, shouldScrollToBottom]);

  // Handle infinite scroll for loading older messages
  const handleScroll = useCallback(() => {
    if (!containerRef.current || !onLoadMore || isLoadingMore || !hasMoreMessages) return;
    
    const container = containerRef.current;
    const scrollTop = container.scrollTop;
    const threshold = 100; // Load more when 100px from top
    
    if (scrollTop <= threshold) {
      setShouldScrollToBottom(false); // Don't auto-scroll when loading older messages
      onLoadMore();
    }
    
    // Re-enable auto-scroll when user scrolls near the bottom
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    
    if (distanceFromBottom < 200) {
      setShouldScrollToBottom(true);
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

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-gradient-to-br from-blue-400 to-blue-600',
      'bg-gradient-to-br from-green-400 to-green-600',
      'bg-gradient-to-br from-purple-400 to-purple-600',
      'bg-gradient-to-br from-orange-400 to-orange-600',
      'bg-gradient-to-br from-pink-400 to-pink-600',
      'bg-gradient-to-br from-indigo-400 to-indigo-600',
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

  return (
    <div 
      ref={containerRef}
      className="flex-1 overflow-y-auto p-4 space-y-4" 
      data-testid="message-list"
    >
      {/* Loading indicator for initial load */}
      {isLoading && messages.length === 0 && (
        <div className="flex justify-center items-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Loading messages...</span>
        </div>
      )}
      
      {/* Load more indicator */}
      {isLoadingMore && (
        <div className="flex justify-center items-center py-4" ref={messagesStartRef}>
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500 text-sm">Loading more messages...</span>
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
      
      {messages.map((message) => {
        const isOwnMessage = message.userId === currentUser.id;
        
        // Handle photo messages
        if (message.messageType === 'photo') {
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
              "flex items-start space-x-3",
              isOwnMessage && "flex-row-reverse space-x-reverse"
            )}
            data-testid={`message-${message.id}`}
          >
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0",
              isOwnMessage ? "bg-primary" : getAvatarColor(message.user.displayName)
            )}>
              {getInitials(message.user.displayName)}
            </div>
            <div className={cn("flex-1", isOwnMessage && "text-right")}>
              <div className={cn(
                "flex items-baseline space-x-2 mb-1",
                isOwnMessage && "justify-end"
              )}>
                {!isOwnMessage && (
                  <span className="text-sm font-semibold text-gray-900">
                    {message.user.displayName}
                  </span>
                )}
                <span className="text-xs text-gray-500" data-testid={`message-time-${message.id}`}>
                  {formatTime(message.timestamp!)}
                </span>
                {isOwnMessage && (
                  <span className="text-sm font-semibold text-gray-900">You</span>
                )}
              </div>
              <div className={cn(
                "p-3 rounded-2xl max-w-lg",
                isOwnMessage
                  ? "bg-primary text-white rounded-tr-md ml-auto"
                  : "bg-white rounded-tl-md border border-gray-200"
              )}>
                <p className={cn(
                  "text-sm",
                  isOwnMessage ? "text-white" : "text-gray-800"
                )}>
                  {message.content}
                </p>
              </div>
            </div>
          </div>
        );
      })}

      {/* System Messages */}
      {activeRoomData.members.length > 0 && (
        <div className="flex justify-center">
          <div className="bg-gray-100 px-4 py-2 rounded-full">
            <p className="text-xs text-gray-600">
              <UserPlus className="w-3 h-3 inline mr-1" />
              Welcome to #{activeRoomData.name}
            </p>
          </div>
        </div>
      )}

      {/* Typing Indicator */}
      {Array.from(typingUsers).map((userId) => {
        const typingUser = activeRoomData.members.find(m => m.id === userId);
        if (!typingUser || userId === currentUser.id) return null;

        return (
          <div key={userId} className="flex items-start space-x-3" data-testid="typing-indicator">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0",
              getAvatarColor(typingUser.displayName)
            )}>
              {getInitials(typingUser.displayName)}
            </div>
            <div className="flex-1">
              <div className="flex items-baseline space-x-2 mb-1">
                <span className="text-sm font-semibold text-gray-900">
                  {typingUser.displayName}
                </span>
                <span className="text-xs text-gray-500">typing...</span>
              </div>
              <div className="bg-white p-3 rounded-2xl rounded-tl-md border border-gray-200 w-16 h-8 flex items-center justify-center">
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
