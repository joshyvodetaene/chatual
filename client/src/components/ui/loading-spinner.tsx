import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  text?: string
  variant?: 'default' | 'dots' | 'pulse'
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6', 
  lg: 'w-8 h-8',
  xl: 'w-12 h-12'
}

const textSizeClasses = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
  xl: 'text-lg'
}

export function LoadingSpinner({ 
  size = 'md', 
  className, 
  text, 
  variant = 'default' 
}: LoadingSpinnerProps) {
  if (variant === 'dots') {
    return (
      <div className={cn("flex items-center justify-center gap-1", className)}>
        <div className="flex space-x-1 animate-pulse">
          <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-2 h-2 bg-current rounded-full animate-bounce"></div>
        </div>
        {text && <span className={cn("ml-2 text-muted-foreground", textSizeClasses[size])}>{text}</span>}
      </div>
    )
  }

  if (variant === 'pulse') {
    return (
      <div className={cn("flex items-center justify-center", className)}>
        <div className={cn("rounded-full bg-primary/20 animate-pulse", sizeClasses[size])} />
        {text && <span className={cn("ml-2 text-muted-foreground", textSizeClasses[size])}>{text}</span>}
      </div>
    )
  }

  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      <Loader2 className={cn("animate-spin text-muted-foreground", sizeClasses[size])} />
      {text && <span className={cn("text-muted-foreground", textSizeClasses[size])}>{text}</span>}
    </div>
  )
}

export function LoadingOverlay({ 
  children, 
  isLoading, 
  text = "Loading...",
  variant = 'default'
}: {
  children: React.ReactNode
  isLoading: boolean
  text?: string
  variant?: 'default' | 'dots' | 'pulse'
}) {
  return (
    <div className="relative">
      {children}
      {isLoading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-md">
          <LoadingSpinner text={text} variant={variant} />
        </div>
      )}
    </div>
  )
}