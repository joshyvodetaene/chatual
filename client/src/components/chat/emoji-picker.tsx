import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const emojiCategories = {
  'Smileys & People': [
    '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
    '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '☺️', '😚',
    '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭',
    '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😶‍🌫️', '😏', '😒',
    '🙄', '😬', '😮‍💨', '🤥', '😔', '😪', '🤤', '😴', '😷', '🤒',
    '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '😵‍💫', '🤯',
    '🤠', '🥳', '🥸', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️',
    '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥',
    '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱',
    '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡',
    '👹', '👺', '👻', '👽', '👾', '🤖', '🎭', '💯'
  ],
  'Animals & Nature': [
    '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨',
    '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊',
    '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉',
    '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌',
    '🐞', '🐜', '🪰', '🪲', '🪳', '🦟', '🦗', '🕷️', '🕸️', '🦂',
    '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀',
    '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆',
    '🦓', '🦍', '🦧', '🐘', '🦣', '🦏', '🐪', '🐫', '🦒', '🦘',
    '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌',
    '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🪶', '🐓', '🦃', '🦚',
    '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦔', '🌱',
    '🌿', '🍀', '🎍', '🎋', '🍃', '🌾', '🌵', '🌲', '🌳', '🌴',
    '🌸', '🌺', '🌻', '🌹', '🥀', '🌷', '🌼', '🌻', '💐', '🍄'
  ],
  'Food & Drink': [
    '🍎', '🍏', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈',
    '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦',
    '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔',
    '🍠', '🥐', '🥖', '🍞', '🥨', '🥯', '🧀', '🥚', '🍳', '🧈',
    '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟',
    '🍕', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕',
    '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙',
    '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦',
    '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩',
    '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '☕', '🍵', '🧃', '🥤',
    '🧋', '🍶', '🍾', '🍷', '🍸', '🍹', '🍺', '🍻', '🥂', '🥃'
  ],
  'Activities & Sports': [
    '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱',
    '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳',
    '🪁', '🏹', '🎣', '🤿', '🥽', '🥼', '🛝', '🛷', '🛼', '🩰',
    '🎽', '🥋', '🥊', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🏋️‍♂️', '🏋️‍♀️',
    '🤼', '🤼‍♂️', '🤼‍♀️', '🤸', '🤸‍♂️', '🤸‍♀️', '⛹️', '⛹️‍♂️', '⛹️‍♀️',
    '🤺', '🤾', '🤾‍♂️', '🤾‍♀️', '🏌️', '🏌️‍♂️', '🏌️‍♀️', '🧘', '🧘‍♂️', '🧘‍♀️',
    '🎪', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎵', '🎶',
    '🎹', '🥁', '🎷', '🎺', '🎸', '🪕', '🎻', '🎲', '♟️', '🎯',
    '🎳', '🎮', '🎰', '🧩'
  ],
  'Travel & Places': [
    '🚗', '🚙', '🚐', '🛻', '🚚', '🚛', '🚜', '🏎️', '🏍️', '🛵',
    '🛺', '🚲', '🛴', '🛞', '🚁', '🛩️', '✈️', '🛫', '🛬', '🪂',
    '💺', '🚀', '🛸', '🚉', '🚊', '🚝', '🚞', '🚋', '🚃', '🚂',
    '🚄', '🚅', '🚈', '🚇', '🚆', '🚎', '🚌', '🚍', '🎡', '🎢',
    '🎠', '🏗️', '🌉', '🏰', '🏯', '🏟️', '🎪', '🎭', '🖼️', '🎨',
    '🎬', '🎤', '🎧', '🎼', '🎵', '🎶', '⛰️', '🏔️', '🗻', '🌋',
    '🏕️', '🏖️', '🏜️', '🏝️', '🏞️', '🏛️', '🏗️', '🧱', '🪨', '🪵',
    '🛖', '🏘️', '🏚️', '🏠', '🏡', '🏢', '🏣', '🏤', '🏥', '🏦',
    '🏧', '🏨', '🏩', '🏪', '🏫', '🏬', '🏭', '🏮', '🏯', '🏰'
  ],
  'Objects & Symbols': [
    '⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️',
    '🗜️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥',
    '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️',
    '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋',
    '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴',
    '💶', '💷', '💰', '💳', '💎', '⚖️', '🧰', '🔧', '🔨', '⚒️',
    '🛠️', '⛏️', '🔩', '⚙️', '🧱', '⛓️', '🧲', '🔫', '💣', '🧨',
    '🪓', '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️', '🪦', '⚱️', '🏺',
    '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🕳️', '🩹', '🩺',
    '💊', '💉', '🩸', '🧬', '🦠', '🧫', '🧪', '🌡️', '🧹', '🧺',
    '🧻', '🚽', '🚰', '🚿', '🛁', '🛀', '🛎️', '🔑', '🗝️', '🚪'
  ],
  'Flags & Hearts': [
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
    '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️',
    '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐',
    '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐',
    '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳',
    '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️',
    '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️',
    '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️',
    '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓',
    '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️'
  ]
};

export default function EmojiPicker({ onEmojiSelect, isOpen, onToggle }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState<string>('Smileys & People');

  if (!isOpen) return null;

  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji);
    // Keep picker open for multiple emoji selection
  };

  return (
    <div className={cn(
      "absolute bottom-12 z-50 bg-background border border-border rounded-lg shadow-lg backdrop-blur-sm",
      "w-[calc(100vw-1rem)] max-w-sm h-56",
      "sm:w-80 sm:h-64 sm:max-w-md",
      "md:w-96 md:h-72 md:max-w-lg",
      "lg:w-[28rem] lg:h-80 lg:max-w-xl",
      "right-2 sm:right-2 md:right-4"
    )} data-testid="emoji-picker">
      <div className="flex flex-col h-full">
        {/* Category tabs */}
        <div className="flex border-b border-border overflow-x-auto scrollbar-hide">
          {Object.keys(emojiCategories).map((category) => (
            <Button
              key={category}
              variant="ghost"
              size="sm"
              onClick={() => setActiveCategory(category)}
              className={cn(
                "flex-shrink-0 px-1 py-1 text-xs rounded-none border-b-2 border-transparent whitespace-nowrap text-muted-foreground hover:text-foreground",
                "sm:px-2 sm:text-sm",
                "md:px-3 md:text-base",
                "lg:px-4 lg:text-lg",
                activeCategory === category && "border-primary bg-muted text-foreground"
              )}
              data-testid={`emoji-category-${category.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
            >
              {category.split(' ')[0]}
            </Button>
          ))}
        </div>

        {/* Emoji grid */}
        <div className="flex-1 p-1.5 sm:p-2 md:p-3 overflow-y-auto scrollbar-hide">
          <div className={cn(
            "grid gap-0.5 sm:gap-1",
            "grid-cols-8 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-14 xl:grid-cols-16"
          )}>
            {emojiCategories[activeCategory as keyof typeof emojiCategories]?.map((emoji, index) => (
              <Button
                key={`${emoji}-${index}`}
                variant="ghost"
                size="sm"
                onClick={() => handleEmojiClick(emoji)}
                className={cn(
                  "p-0 hover:bg-muted rounded transition-colors",
                  "w-6 h-6 text-xs sm:w-7 sm:h-7 sm:text-sm md:w-8 md:h-8 md:text-base lg:w-9 lg:h-9 lg:text-lg"
                )}
                data-testid={`emoji-${emoji}`}
              >
                {emoji}
              </Button>
            ))}
          </div>
        </div>

        {/* Close button */}
        <div className="p-1.5 sm:p-2 md:p-3 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={onToggle}
            className="w-full text-xs sm:text-sm md:text-base bg-muted/20 border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            data-testid="button-close-emoji-picker"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}