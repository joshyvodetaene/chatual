import { useState, useCallback } from 'react'
import { Check, Clock, AlertCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ProgressStatus = 'idle' | 'loading' | 'success' | 'error' | 'warning'

interface ProgressStep {
  id: string
  label: string
  status: ProgressStatus
  description?: string
  error?: string
}

interface ProgressTrackerProps {
  steps: ProgressStep[]
  className?: string
}

const statusIcons = {
  idle: Clock,
  loading: Clock,
  success: Check,
  error: X,
  warning: AlertCircle
}

const statusColors = {
  idle: 'text-muted-foreground',
  loading: 'text-blue-500 animate-pulse',
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-orange-500'
}

const statusBgColors = {
  idle: 'bg-muted',
  loading: 'bg-blue-100 dark:bg-blue-900',
  success: 'bg-green-100 dark:bg-green-900',
  error: 'bg-red-100 dark:bg-red-900',
  warning: 'bg-orange-100 dark:bg-orange-900'
}

export function ProgressTracker({ steps, className }: ProgressTrackerProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {steps.map((step, index) => {
        const Icon = statusIcons[step.status]
        const isCompleted = step.status === 'success'
        const isError = step.status === 'error'
        const isActive = step.status === 'loading'

        return (
          <div key={step.id} className="flex items-start gap-3">
            {/* Step indicator */}
            <div
              className={cn(
                'flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all',
                isCompleted && 'border-green-500 bg-green-500 text-white',
                isError && 'border-red-500 bg-red-500 text-white',
                isActive && 'border-blue-500 bg-blue-500 text-white',
                !isCompleted && !isError && !isActive && 'border-muted bg-background'
              )}
            >
              <Icon className="w-4 h-4" />
            </div>

            {/* Step content */}
            <div className="flex-1 min-w-0">
              <div className={cn(
                'font-medium transition-colors',
                statusColors[step.status]
              )}>
                {step.label}
              </div>
              
              {step.description && (
                <div className="text-sm text-muted-foreground mt-1">
                  {step.description}
                </div>
              )}
              
              {step.error && (
                <div className="text-sm text-red-600 mt-1 p-2 bg-red-50 dark:bg-red-900/20 rounded">
                  {step.error}
                </div>
              )}
            </div>

            {/* Step number */}
            <div className="text-xs text-muted-foreground font-mono">
              {index + 1}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Hook for managing progress steps
export function useProgressTracker(initialSteps: Omit<ProgressStep, 'status'>[]) {
  const [steps, setSteps] = useState<ProgressStep[]>(
    initialSteps.map(step => ({ ...step, status: 'idle' as ProgressStatus }))
  )

  const updateStep = useCallback((id: string, updates: Partial<ProgressStep>) => {
    setSteps(prev => prev.map(step => 
      step.id === id ? { ...step, ...updates } : step
    ))
  }, [])

  const setStepStatus = useCallback((id: string, status: ProgressStatus) => {
    updateStep(id, { status })
  }, [updateStep])

  const setStepError = useCallback((id: string, error: string) => {
    updateStep(id, { status: 'error', error })
  }, [updateStep])

  const resetSteps = useCallback(() => {
    setSteps(prev => prev.map(step => ({ ...step, status: 'idle', error: undefined })))
  }, [])

  return {
    steps,
    updateStep,
    setStepStatus,
    setStepError,
    resetSteps
  }
}