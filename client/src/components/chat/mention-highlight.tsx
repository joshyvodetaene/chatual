import React from 'react';
import { cn } from '@/lib/utils';

interface MentionHighlightProps {
  content: string;
  currentUserId?: string;
  className?: string;
}

export default function MentionHighlight({ 
  content, 
  currentUserId, 
  className 
}: MentionHighlightProps) {
  // Parse content for @mentions
  const parseContentWithMentions = (text: string) => {
    // Pattern to match @username mentions
    const mentionPattern = /@(\w+)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionPattern.exec(text)) !== null) {
      // Add text before the mention
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: text.slice(lastIndex, match.index),
          key: `text-${lastIndex}`
        });
      }

      // Add the mention
      parts.push({
        type: 'mention',
        content: match[0], // Full match including @
        username: match[1], // Just the username
        key: `mention-${match.index}`
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex),
        key: `text-${lastIndex}`
      });
    }

    return parts;
  };

  const parts = parseContentWithMentions(content);

  return (
    <span className={className}>
      {parts.map((part) => (
        part.type === 'mention' ? (
          <span
            key={part.key}
            className={cn(
              "bg-blue-100 text-blue-800 px-1 py-0.5 rounded font-medium",
              "dark:bg-blue-900 dark:text-blue-200"
            )}
          >
            {part.content}
          </span>
        ) : (
          <span key={part.key}>{part.content}</span>
        )
      ))}
    </span>
  );
}