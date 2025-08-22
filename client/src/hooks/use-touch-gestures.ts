import { useCallback, useRef, useEffect } from 'react'

interface TouchGestureOptions {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeUp?: () => void
  onSwipeDown?: () => void
  onLongPress?: () => void
  onDoubleTab?: () => void
  threshold?: number
  longPressDelay?: number
}

export function useTouchGestures(options: TouchGestureOptions) {
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastTapRef = useRef<number>(0)
  
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onLongPress,
    onDoubleTab,
    threshold = 50,
    longPressDelay = 500
  } = options

  const handleTouchStart = useCallback((event: TouchEvent) => {
    const touch = event.touches[0]
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    }

    // Set up long press detection
    if (onLongPress) {
      longPressTimerRef.current = setTimeout(() => {
        onLongPress()
        touchStartRef.current = null
      }, longPressDelay)
    }
  }, [onLongPress, longPressDelay])

  const handleTouchMove = useCallback(() => {
    // Cancel long press if finger moves
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  const handleTouchEnd = useCallback((event: TouchEvent) => {
    if (!touchStartRef.current) return

    const touch = event.changedTouches[0]
    const deltaX = touch.clientX - touchStartRef.current.x
    const deltaY = touch.clientY - touchStartRef.current.y
    const deltaTime = Date.now() - touchStartRef.current.time

    // Clear long press timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }

    // Check for double tap
    if (onDoubleTab && deltaTime < 300) {
      const timeSinceLastTap = Date.now() - lastTapRef.current
      if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
        onDoubleTab()
        lastTapRef.current = 0
        touchStartRef.current = null
        return
      }
      lastTapRef.current = Date.now()
    }

    // Check for swipe gestures
    if (Math.abs(deltaX) > threshold || Math.abs(deltaY) > threshold) {
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal swipe
        if (deltaX > 0 && onSwipeRight) {
          onSwipeRight()
        } else if (deltaX < 0 && onSwipeLeft) {
          onSwipeLeft()
        }
      } else {
        // Vertical swipe
        if (deltaY > 0 && onSwipeDown) {
          onSwipeDown()
        } else if (deltaY < 0 && onSwipeUp) {
          onSwipeUp()
        }
      }
    }

    touchStartRef.current = null
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onDoubleTab, threshold])

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd
  }
}

// Hook for pull-to-refresh gesture
export function usePullToRefresh(onRefresh: () => void) {
  const containerRef = useRef<HTMLElement>(null)
  const touchStartY = useRef<number>(0)
  const isRefreshing = useRef<boolean>(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0].clientY
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (isRefreshing.current) return

      const deltaY = e.touches[0].clientY - touchStartY.current
      const isAtTop = container.scrollTop <= 0

      if (deltaY > 100 && isAtTop) {
        // Show pull-to-refresh indicator
        container.style.transform = `translateY(${Math.min(deltaY - 100, 50)}px)`
        container.style.opacity = '0.8'
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      const deltaY = e.changedTouches[0].clientY - touchStartY.current
      const isAtTop = container.scrollTop <= 0

      container.style.transform = ''
      container.style.opacity = ''

      if (deltaY > 150 && isAtTop && !isRefreshing.current) {
        isRefreshing.current = true
        onRefresh()
        setTimeout(() => {
          isRefreshing.current = false
        }, 1000)
      }
    }

    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [onRefresh])

  return { containerRef }
}

// Hook for better touch targets
export function useTouchTarget(minSize = 44) {
  const elementRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    // Ensure minimum touch target size
    const rect = element.getBoundingClientRect()
    if (rect.width < minSize || rect.height < minSize) {
      element.style.minWidth = `${minSize}px`
      element.style.minHeight = `${minSize}px`
      
      // Center content if smaller than touch target
      element.style.display = 'flex'
      element.style.alignItems = 'center'
      element.style.justifyContent = 'center'
    }
  }, [minSize])

  return { elementRef }
}

// Hook for haptic feedback on mobile
export function useHapticFeedback() {
  const triggerHaptic = useCallback((type: 'light' | 'medium' | 'heavy' = 'light') => {
    // Check if device supports haptics
    if ('vibrate' in navigator) {
      const patterns = {
        light: [10],
        medium: [20],
        heavy: [30]
      }
      navigator.vibrate(patterns[type])
    }
    
    // For iOS devices, try the Taptic Engine
    if (window && 'DeviceMotionEvent' in window) {
      try {
        const intensity = {
          light: 0.3,
          medium: 0.6,
          heavy: 1.0
        }
        // This is a fallback - real Taptic Engine requires native integration
        if (navigator.vibrate) {
          navigator.vibrate([30])
        }
      } catch (e) {
        // Fail silently if not supported
      }
    }
  }, [])

  return { triggerHaptic }
}