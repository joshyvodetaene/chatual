
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileMenuProps {
  children: React.ReactNode;
  side?: 'left' | 'right';
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
}

export function MobileMenu({ 
  children, 
  side = 'left', 
  className,
  triggerClassName,
  contentClassName 
}: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "md:hidden p-3 h-auto min-h-[44px] min-w-[44px] flex items-center justify-center",
            "touch-manipulation active:scale-95 transition-transform",
            triggerClassName
          )}
          data-testid="mobile-menu-trigger"
        >
          <Menu className="h-6 w-6" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent 
        side={side} 
        className={cn(
          "w-[85vw] max-w-sm p-0 border-none",
          "transition-transform duration-300 ease-out",
          contentClassName
        )}
        data-testid="mobile-menu-content"
      >
        <div className={cn("h-full overflow-y-auto", className)}>
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
