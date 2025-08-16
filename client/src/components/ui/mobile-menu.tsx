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
            "md:hidden p-2 h-auto",
            triggerClassName
          )}
          data-testid="mobile-menu-trigger"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent 
        side={side} 
        className={cn(
          "w-80 p-0 border-none",
          contentClassName
        )}
        data-testid="mobile-menu-content"
      >
        <div className={cn("h-full", className)}>
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}