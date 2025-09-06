import { cn } from '@/lib/utils';

interface SkipLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export function SkipLink({ href, children, className }: SkipLinkProps) {
  return (
    <a
      href={href}
      className={cn(
        "sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999]",
        "bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium",
        "transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        "focus-visible:block",
        className
      )}
      onFocus={(e) => {
        // Ensure the skip link is visible when focused
        e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }}
    >
      {children}
    </a>
  );
}

export function SkipLinkContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed top-0 left-0 z-[9999] pointer-events-none">
      {children}
    </div>
  );
}