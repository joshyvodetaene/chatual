import { useState, useCallback, useEffect } from 'react'
import { Check, X, AlertTriangle, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type FeedbackType = 'success' | 'error' | 'warning' | 'info'

interface ActionFeedbackProps {
  type: FeedbackType
  title: string
  description?: string
  actions?: Array<{
    label: string
    onClick: () => void
    variant?: 'default' | 'destructive' | 'outline' | 'secondary'
  }>
  className?: string
  onDismiss?: () => void
  autoHide?: boolean
  duration?: number
}

const feedbackIcons = {
  success: Check,
  error: X,
  warning: AlertTriangle,
  info: Info
}

const feedbackColors = {
  success: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950',
  error: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950',
  warning: 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950',
  info: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950'
}

const iconColors = {
  success: 'text-green-600 dark:text-green-400',
  error: 'text-red-600 dark:text-red-400',
  warning: 'text-orange-600 dark:text-orange-400',
  info: 'text-blue-600 dark:text-blue-400'
}

export function ActionFeedback({ 
  type, 
  title, 
  description, 
  actions, 
  className,
  onDismiss,
  autoHide = false,
  duration = 5000
}: ActionFeedbackProps) {
  const [isVisible, setIsVisible] = useState(true)
  const Icon = feedbackIcons[type]

  useEffect(() => {
    if (autoHide && duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false)
        onDismiss?.()
      }, duration)
      return () => clearTimeout(timer)
    }
  })

  const handleDismiss = useCallback(() => {
    setIsVisible(false)
    onDismiss?.()
  }, [onDismiss])

  if (!isVisible) return null

  return (
    <Card className={cn(
      'border animate-fade-in-up',
      feedbackColors[type],
      className
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className={cn(
            'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5',
            iconColors[type]
          )}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base">{title}</CardTitle>
            {description && (
              <CardDescription className="mt-1">
                {description}
              </CardDescription>
            )}
          </div>
          {onDismiss && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDismiss}
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      
      {actions && actions.length > 0 && (
        <CardContent className="pt-0">
          <div className="flex gap-2">
            {actions.map((action, index) => (
              <Button
                key={index}
                variant={action.variant || 'default'}
                size="sm"
                onClick={action.onClick}
                className="text-xs"
              >
                {action.label}
              </Button>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

// Hook for managing action feedback
export function useActionFeedback() {
  const [feedback, setFeedback] = useState<ActionFeedbackProps | null>(null)

  const showFeedback = useCallback((props: Omit<ActionFeedbackProps, 'onDismiss'>) => {
    setFeedback({
      ...props,
      onDismiss: () => setFeedback(null)
    })
  }, [])

  const showSuccess = useCallback((title: string, description?: string, actions?: ActionFeedbackProps['actions']) => {
    showFeedback({ type: 'success', title, description, actions, autoHide: true })
  }, [showFeedback])

  const showError = useCallback((title: string, description?: string, actions?: ActionFeedbackProps['actions']) => {
    showFeedback({ type: 'error', title, description, actions })
  }, [showFeedback])

  const showWarning = useCallback((title: string, description?: string, actions?: ActionFeedbackProps['actions']) => {
    showFeedback({ type: 'warning', title, description, actions })
  }, [showFeedback])

  const showInfo = useCallback((title: string, description?: string, actions?: ActionFeedbackProps['actions']) => {
    showFeedback({ type: 'info', title, description, actions, autoHide: true })
  }, [showFeedback])

  const hideFeedback = useCallback(() => {
    setFeedback(null)
  }, [])

  const FeedbackComponent = feedback ? () => <ActionFeedback {...feedback} /> : null

  return {
    showFeedback,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    hideFeedback,
    feedback,
    FeedbackComponent
  }
}

export default ActionFeedback