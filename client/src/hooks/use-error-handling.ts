import { useCallback, useState } from 'react'
import { showErrorToast, showRetryToast, showNetworkErrorToast } from '@/components/ui/enhanced-toast'

interface ErrorHandlingOptions {
  showToast?: boolean
  logError?: boolean
  onError?: (error: Error) => void
  retryable?: boolean
  maxRetries?: number
}

interface RetryableFunction<T = any> {
  (): Promise<T>
}

export function useErrorHandling() {
  const [isRetrying, setIsRetrying] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  const handleError = useCallback((
    error: Error | any,
    options: ErrorHandlingOptions = {}
  ) => {
    const {
      showToast = true,
      logError = true,
      onError,
      retryable = false,
      maxRetries = 3
    } = options

    if (logError) {
      console.error('Error occurred:', error)
    }

    const errorMessage = getErrorMessage(error)
    const isNetworkError = isNetworkRelated(error)

    if (showToast) {
      if (isNetworkError) {
        showNetworkErrorToast()
      } else if (retryable && retryCount < maxRetries) {
        // Will be handled by retry mechanism
      } else {
        showErrorToast('Something went wrong', errorMessage)
      }
    }

    onError?.(error)
  }, [retryCount])

  const withRetry = useCallback(async <T>(
    fn: RetryableFunction<T>,
    options: ErrorHandlingOptions = {}
  ): Promise<T> => {
    const { maxRetries = 3 } = options
    let lastError: Error

    setIsRetrying(true)

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        setRetryCount(attempt - 1)
        const result = await fn()
        setIsRetrying(false)
        setRetryCount(0)
        return result
      } catch (error) {
        lastError = error as Error
        
        if (attempt === maxRetries) {
          setIsRetrying(false)
          setRetryCount(0)
          handleError(error, { ...options, retryable: false })
          throw error
        }

        // Wait before retrying (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw lastError!
  }, [handleError])

  const withErrorHandling = useCallback(<T extends (...args: any[]) => any>(
    fn: T,
    options: ErrorHandlingOptions = {}
  ): T => {
    return ((...args: Parameters<T>) => {
      try {
        const result = fn(...args)
        
        // Handle async functions
        if (result instanceof Promise) {
          return result.catch(error => {
            handleError(error, options)
            throw error
          })
        }
        
        return result
      } catch (error) {
        handleError(error, options)
        throw error
      }
    }) as T
  }, [handleError])

  return {
    handleError,
    withRetry,
    withErrorHandling,
    isRetrying,
    retryCount
  }
}

function getErrorMessage(error: any): string {
  if (typeof error === 'string') return error
  
  if (error?.message) return error.message
  
  if (error?.response?.data?.message) return error.response.data.message
  
  if (error?.response?.statusText) return error.response.statusText
  
  return 'An unexpected error occurred'
}

function isNetworkRelated(error: any): boolean {
  if (!error) return false
  
  // Check for common network error indicators
  const networkErrors = [
    'NetworkError',
    'fetch',
    'NETWORK_ERROR',
    'ERR_INTERNET_DISCONNECTED',
    'ERR_NETWORK_CHANGED',
    'ERR_CONNECTION_REFUSED'
  ]
  
  const errorString = error.toString().toLowerCase()
  return networkErrors.some(ne => errorString.includes(ne.toLowerCase())) ||
         error.name === 'NetworkError' ||
         error.code === 'ERR_NETWORK' ||
         (error.response && !error.response.ok && error.response.status === 0)
}