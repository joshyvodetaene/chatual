import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Smile, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReactionPickerProps {
  onSelectEmoji: (emoji: string) => void;
  className?: string;
  trigger?: React.ReactNode;
  disabled?: boolean;
}

const COMMON_EMOJIS = [
  '👍', '👎', '❤️', '😂', '😮', '😢', '😡', '🎉',
  '🔥', '💯', '👏', '🙌', '💪', '🤝', '🤔', '👀',
  '😊', '😍', '🥳', '😎', '🤗', '😴', '🙄', '😇'
];

export default function ReactionPicker({ 
  onSelectEmoji, 
  className, 
  trigger,
  disabled = false
}: ReactionPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelectEmoji = (emoji: string) => {
    onSelectEmoji(emoji);
    setIsOpen(false);
  };

  const defaultTrigger = (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full opacity-0 group-hover:opacity-100 transition-opacity",
        className
      )}
      disabled={disabled}
      data-testid="button-add-reaction"
    >
      <Plus className="w-3 h-3" />
    </Button>
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {trigger || defaultTrigger}
      </PopoverTrigger>
      <PopoverContent 
        className="w-64 p-3 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700" 
        align="start"
        data-testid="reaction-picker-popover"
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
            <Smile className="w-4 h-4" />
            Choose a reaction
          </div>
          
          <div className="grid grid-cols-8 gap-1">
            {COMMON_EMOJIS.map((emoji) => (
              <Button
                key={emoji}
                variant="ghost"
                size="sm"
                onClick={() => handleSelectEmoji(emoji)}
                className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                data-testid={`emoji-${emoji}`}
              >
                <span className="text-lg" role="img" aria-label={emoji}>
                  {emoji}
                </span>
              </Button>
            ))}
          </div>
          
          <div className="text-xs text-gray-500 text-center">
            Tip: Hover over messages to add reactions
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}