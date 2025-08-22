import { useEffect, useRef, useCallback, useState } from 'react'

interface FocusOptions {
  preventScroll?: boolean
  delay?: number
}

export function useFocusManagement() {
  const focusedElementRef = useRef<HTMLElement | null>(null)
  const previousFocusedElementRef = useRef<HTMLElement | null>(null)

  // Store the currently focused element
  useEffect(() => {
    const handleFocus = () => {
      previousFocusedElementRef.current = focusedElementRef.current
      focusedElementRef.current = document.activeElement as HTMLElement
    }

    document.addEventListener('focusin', handleFocus)
    return () => document.removeEventListener('focusin', handleFocus)
  }, [])

  // Focus an element with options
  const focusElement = useCallback((
    element: HTMLElement | null | string,
    options: FocusOptions = {}
  ) => {
    if (!element) return

    const target = typeof element === 'string' 
      ? document.querySelector(element) as HTMLElement
      : element

    if (!target) return

    const { preventScroll = false, delay = 0 } = options

    if (delay > 0) {
      setTimeout(() => {
        target.focus({ preventScroll })
      }, delay)
    } else {
      target.focus({ preventScroll })
    }
  }, [])

  // Return focus to the previous element
  const returnFocus = useCallback(() => {
    if (previousFocusedElementRef.current) {
      focusElement(previousFocusedElementRef.current, { preventScroll: true })
    }
  }, [focusElement])

  // Trap focus within a container
  const trapFocus = useCallback((container: HTMLElement | null) => {
    if (!container) return () => {}

    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>

    const firstFocusable = focusableElements[0]
    const lastFocusable = focusableElements[focusableElements.length - 1]

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return

      if (event.shiftKey) {
        if (document.activeElement === firstFocusable) {
          event.preventDefault()
          lastFocusable.focus()
        }
      } else {
        if (document.activeElement === lastFocusable) {
          event.preventDefault()
          firstFocusable.focus()
        }
      }
    }

    container.addEventListener('keydown', handleKeyDown)
    
    // Focus the first element
    if (firstFocusable) {
      firstFocusable.focus()
    }

    return () => {
      container.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return {
    focusElement,
    returnFocus,
    trapFocus,
    currentFocus: focusedElementRef.current,
    previousFocus: previousFocusedElementRef.current
  }
}

// Hook for focus-visible support
export function useFocusVisible() {
  const [isFocusVisible, setIsFocusVisible] = useState(false)
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    let hadKeyboardEvent = false

    const onKeyDown = () => {
      hadKeyboardEvent = true
    }

    const onFocus = () => {
      if (hadKeyboardEvent) {
        setIsFocusVisible(true)
      }
    }

    const onBlur = () => {
      setIsFocusVisible(false)
      hadKeyboardEvent = false
    }

    const onMouseDown = () => {
      hadKeyboardEvent = false
    }

    element.addEventListener('keydown', onKeyDown)
    element.addEventListener('focus', onFocus)
    element.addEventListener('blur', onBlur)
    element.addEventListener('mousedown', onMouseDown)

    return () => {
      element.removeEventListener('keydown', onKeyDown)
      element.removeEventListener('focus', onFocus)
      element.removeEventListener('blur', onBlur)
      element.removeEventListener('mousedown', onMouseDown)
    }
  }, [])

  return { ref, isFocusVisible }
}