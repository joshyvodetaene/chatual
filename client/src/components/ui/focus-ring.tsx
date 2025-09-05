import { cn } from '@/lib/utils';

interface FocusRingProps {
  children: React.ReactNode;
  className?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
  offset?: boolean;
}

export function FocusRing({ 
  children, 
  className, 
  rounded = 'md',
  offset = false 
}: FocusRingProps) {
  const roundedClasses = {
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full'
  };

  const offsetClasses = offset ? 'focus-within:ring-offset-2' : '';

  return (
    <div
      className={cn(
        'focus-within:outline-none focus-within:ring-2 focus-within:ring-primary focus-within:ring-opacity-50',
        roundedClasses[rounded],
        offsetClasses,
        'transition-all duration-200',
        className
      )}
    >
      {children}
    </div>
  );
}

// Enhanced button component with better focus handling
interface AccessibleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  loading?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
}

export function AccessibleButton({
  children,
  className,
  disabled,
  loading,
  ariaLabel,
  ariaDescribedBy,
  ...props
}: AccessibleButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background',
        'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        'hover:bg-accent hover:text-accent-foreground',
        className
      )}
    >
      {loading && (
        <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" />
      )}
      {children}
    </button>
  );
}