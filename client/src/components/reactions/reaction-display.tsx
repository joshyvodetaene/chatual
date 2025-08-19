import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { ReactionSummary } from '@shared/schema';

interface ReactionDisplayProps {
  reactions: ReactionSummary[];
  onToggleReaction: (emoji: string) => void;
  className?: string;
  disabled?: boolean;
}

export default function ReactionDisplay({ 
  reactions, 
  onToggleReaction, 
  className,
  disabled = false
}: ReactionDisplayProps) {
  const [hoveredReaction, setHoveredReaction] = useState<string | null>(null);

  if (!reactions.length) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap gap-1 mt-2", className)}>
      {reactions.map((reaction) => (
        <Popover key={reaction.emoji}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => !disabled && onToggleReaction(reaction.emoji)}
              onMouseEnter={() => setHoveredReaction(reaction.emoji)}
              onMouseLeave={() => setHoveredReaction(null)}
              className={cn(
                "h-7 px-2 py-1 rounded-full border transition-all duration-200",
                "hover:scale-105 active:scale-95",
                reaction.userReacted
                  ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
                  : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700",
                disabled && "cursor-not-allowed opacity-50"
              )}
              disabled={disabled}
              data-testid={`reaction-${reaction.emoji}`}
            >
              <span className="text-sm mr-1" role="img" aria-label={reaction.emoji}>
                {reaction.emoji}
              </span>
              <span className={cn(
                "text-xs font-medium",
                reaction.userReacted 
                  ? "text-primary" 
                  : "text-gray-600 dark:text-gray-300"
              )}>
                {reaction.count}
              </span>
            </Button>
          </PopoverTrigger>
          
          <PopoverContent 
            className="w-auto p-2 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
            align="center"
            side="top"
            data-testid={`reaction-tooltip-${reaction.emoji}`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-sm">
                <span role="img" aria-label={reaction.emoji}>{reaction.emoji}</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {reaction.count} {reaction.count === 1 ? 'reaction' : 'reactions'}
                </span>
              </div>
              
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {reaction.users.length <= 3 ? (
                  reaction.users.map((user, index) => (
                    <span key={user.id}>
                      {user.displayName}
                      {index < reaction.users.length - 1 && 
                        (index === reaction.users.length - 2 ? ' and ' : ', ')
                      }
                    </span>
                  ))
                ) : (
                  <>
                    {reaction.users.slice(0, 2).map((user, index) => (
                      <span key={user.id}>
                        {user.displayName}
                        {index === 0 && ', '}
                      </span>
                    ))}
                    {' and '}{reaction.users.length - 2} others
                  </>
                )}
                {reaction.userReacted && (
                  <span className="text-primary font-medium"> (including you)</span>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      ))}
    </div>
  );
}