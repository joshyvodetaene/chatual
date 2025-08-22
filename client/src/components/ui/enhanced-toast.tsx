import { toast } from '@/hooks/use-toast'
import { CheckCircle2, AlertCircle, Info, XCircle, Wifi, WifiOff } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info' | 'network'

interface EnhancedToastOptions {
  title: string
  description?: string
  type?: ToastType
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
  persistent?: boolean
}

const getToastIcon = (type: ToastType) => {
  switch (type) {
    case 'success':
      return <CheckCircle2 className="h-4 w-4 text-green-600" />
    case 'error':
      return <XCircle className="h-4 w-4 text-red-600" />
    case 'warning':
      return <AlertCircle className="h-4 w-4 text-orange-600" />
    case 'network':
      return <WifiOff className="h-4 w-4 text-red-600" />
    default:
      return <Info className="h-4 w-4 text-blue-600" />
  }
}

const getToastVariant = (type: ToastType) => {
  return type === 'error' || type === 'network' ? 'destructive' : 'default'
}

export function showToast({ 
  title, 
  description, 
  type = 'info', 
  duration = 5000,
  action,
  persistent = false 
}: EnhancedToastOptions) {
  const toastOptions: any = {
    title: (
      <div className="flex items-center gap-2">
        {getToastIcon(type)}
        <span>{title}</span>
      </div>
    ),
    description,
    variant: getToastVariant(type),
    duration: persistent ? Infinity : duration,
  }

  if (action) {
    toastOptions.action = (
      <button 
        onClick={action.onClick}
        className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      >
        {action.label}
      </button>
    )
  }

  return toast(toastOptions)
}

// Convenience functions
export const showSuccessToast = (title: string, description?: string) => 
  showToast({ title, description, type: 'success' })

export const showErrorToast = (title: string, description?: string, action?: EnhancedToastOptions['action']) => 
  showToast({ title, description, type: 'error', persistent: true, action })

export const showWarningToast = (title: string, description?: string) => 
  showToast({ title, description, type: 'warning' })

export const showInfoToast = (title: string, description?: string) => 
  showToast({ title, description, type: 'info' })

export const showNetworkErrorToast = (action?: EnhancedToastOptions['action']) => 
  showToast({ 
    title: 'Connection Lost', 
    description: 'Please check your internet connection and try again.',
    type: 'network', 
    persistent: true,
    action
  })

// Auto-retry functionality
export const showRetryToast = (title: string, retryFn: () => void, maxRetries = 3) => {
  let retryCount = 0
  
  const retry = () => {
    retryCount++
    if (retryCount <= maxRetries) {
      retryFn()
    } else {
      showErrorToast(
        'Maximum retries reached',
        'Please refresh the page or contact support if the problem persists.'
      )
    }
  }

  return showErrorToast(title, `Attempt ${retryCount}/${maxRetries}`, {
    label: 'Retry',
    onClick: retry
  })
}