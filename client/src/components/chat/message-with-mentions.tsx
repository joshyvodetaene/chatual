import React, { memo } from 'react';
import { MessageWithUser } from '@shared/schema';
import MentionHighlight from './mention-highlight';

interface MessageWithMentionsProps {
  message: MessageWithUser;
  currentUserId: string;
  onReaction?: (messageId: string, emoji: string) => void;
  onStartPrivateChat?: (userId: string) => void;
  isMobile?: boolean;
}

const MessageWithMentions = memo(function MessageWithMentions({
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
                if (message.photoUrl) {
                  window.open(message.photoUrl, '_blank');
                }
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
    <div className="message-container">
      {renderMessageContent()}
    </div>
  );
});

export default MessageWithMentions;