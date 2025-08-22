import { cn } from "@/lib/utils"

interface KbdProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode
  variant?: 'default' | 'outline' | 'subtle'
  size?: 'sm' | 'md' | 'lg'
}

const variantClasses = {
  default: 'bg-muted text-muted-foreground border-border',
  outline: 'bg-background text-foreground border-border border-2',
  subtle: 'bg-secondary text-secondary-foreground border-transparent'
}

const sizeClasses = {
  sm: 'px-1 py-0.5 text-xs',
  md: 'px-1.5 py-1 text-sm',
  lg: 'px-2 py-1 text-base'
}

export function Kbd({ 
  children, 
  className, 
  variant = 'default',
  size = 'sm',
  ...props 
}: KbdProps) {
  return (
    <kbd 
      className={cn(
        "inline-flex items-center justify-center rounded font-medium border",
        "font-mono tracking-wide",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
    </kbd>
  )
}