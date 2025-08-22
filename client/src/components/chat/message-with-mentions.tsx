import React from 'react';
import { MessageWithUser } from '@shared/schema';
import MessageBubble from './message-bubble';
import MentionHighlight from './mention-highlight';

interface MessageWithMentionsProps {
  message: MessageWithUser;
  currentUserId: string;
  onReaction?: (messageId: string, emoji: string) => void;
  onStartPrivateChat?: (userId: string) => void;
  isMobile?: boolean;
}

export default function MessageWithMentions({
  message,
  currentUserId,
  onReaction,
  onStartPrivateChat,
  isMobile,
}: MessageWithMentionsProps) {
  const isCurrentUser = message.userId === currentUserId;

  // Enhanced content rendering with mentions
  const renderMessageContent = () => {
    if (message.messageType === 'photo') {
      return (
        <div className="space-y-2">
          {message.content && (
            <MentionHighlight 
              content={message.content} 
              currentUserId={currentUserId}
            />
          )}
          {message.photoUrl && (
            <img 
              src={message.photoUrl} 
              alt={message.photoFileName || 'Shared photo'}
              className="max-w-xs max-h-64 rounded-lg object-cover cursor-pointer"
              onClick={() => {
                // Could add lightbox functionality here
                window.open(message.photoUrl, '_blank');
              }}
            />
          )}
        </div>
      );
    }

    return (
      <MentionHighlight 
        content={message.content} 
        currentUserId={currentUserId}
      />
    );
  };

  return (
    <MessageBubble
      message={message}
      isCurrentUser={isCurrentUser}
      onReaction={onReaction}
      onStartPrivateChat={onStartPrivateChat}
      isMobile={isMobile}
    >
      {renderMessageContent()}
    </MessageBubble>
  );
}