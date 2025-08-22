import { useCallback, useRef, useEffect } from 'react'

// Hook for button hover and press effects
export function useButtonEffects() {
  const buttonRef = useRef<HTMLButtonElement>(null)

  const addRippleEffect = useCallback((event: React.MouseEvent) => {
    const button = event.currentTarget as HTMLButtonElement
    const rect = button.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height)
    const x = event.clientX - rect.left - size / 2
    const y = event.clientY - rect.top - size / 2
    
    const ripple = document.createElement('span')
    ripple.style.cssText = `
      position: absolute;
      border-radius: 50%;
      background: currentColor;
      opacity: 0.3;
      pointer-events: none;
      width: ${size}px;
      height: ${size}px;
      left: ${x}px;
      top: ${y}px;
      animation: ripple 0.4s ease-out;
      z-index: 1;
    `
    
    const style = document.createElement('style')
    if (!document.querySelector('#ripple-keyframes')) {
      style.id = 'ripple-keyframes'
      style.textContent = `
        @keyframes ripple {
          0% {
            transform: scale(0);
            opacity: 0.5;
          }
          100% {
            transform: scale(4);
            opacity: 0;
          }
        }
      `
      document.head.appendChild(style)
    }
    
    // Ensure button has relative positioning
    const computedStyle = window.getComputedStyle(button)
    if (computedStyle.position === 'static') {
      button.style.position = 'relative'
    }
    button.style.overflow = 'hidden'
    
    button.appendChild(ripple)
    
    setTimeout(() => {
      ripple.remove()
    }, 400)
  }, [])

  const addHoverEffects = useCallback((element: HTMLElement) => {
    element.style.transition = 'all 0.2s ease-in-out'
    
    const handleMouseEnter = () => {
      element.style.transform = 'translateY(-1px)'
      element.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
    }
    
    const handleMouseLeave = () => {
      element.style.transform = 'translateY(0)'
      element.style.boxShadow = ''
    }
    
    element.addEventListener('mouseenter', handleMouseEnter)
    element.addEventListener('mouseleave', handleMouseLeave)
    
    return () => {
      element.removeEventListener('mouseenter', handleMouseEnter)
      element.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  return {
    buttonRef,
    addRippleEffect,
    addHoverEffects
  }
}

// Hook for smooth transitions and animations
export function useTransitions() {
  const fadeInUp = useCallback((element: HTMLElement, delay = 0) => {
    element.style.opacity = '0'
    element.style.transform = 'translateY(20px)'
    element.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out'
    
    setTimeout(() => {
      element.style.opacity = '1'
      element.style.transform = 'translateY(0)'
    }, delay)
  }, [])

  const slideInFromRight = useCallback((element: HTMLElement, delay = 0) => {
    element.style.opacity = '0'
    element.style.transform = 'translateX(30px)'
    element.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out'
    
    setTimeout(() => {
      element.style.opacity = '1'
      element.style.transform = 'translateX(0)'
    }, delay)
  }, [])

  const scaleIn = useCallback((element: HTMLElement, delay = 0) => {
    element.style.opacity = '0'
    element.style.transform = 'scale(0.9)'
    element.style.transition = 'opacity 0.2s ease-out, transform 0.2s ease-out'
    
    setTimeout(() => {
      element.style.opacity = '1'
      element.style.transform = 'scale(1)'
    }, delay)
  }, [])

  const pulse = useCallback((element: HTMLElement) => {
    element.style.animation = 'pulse 0.5s ease-in-out'
    setTimeout(() => {
      element.style.animation = ''
    }, 500)
  }, [])

  return {
    fadeInUp,
    slideInFromRight,
    scaleIn,
    pulse
  }
}

// Hook for staggered animations
export function useStaggeredAnimation(
  selector: string, 
  animation: 'fadeInUp' | 'slideInFromRight' | 'scaleIn' = 'fadeInUp',
  staggerDelay = 100
) {
  const containerRef = useRef<HTMLElement>(null)
  const { fadeInUp, slideInFromRight, scaleIn } = useTransitions()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const elements = container.querySelectorAll(selector) as NodeListOf<HTMLElement>
    const animationFn = {
      fadeInUp,
      slideInFromRight,
      scaleIn
    }[animation]

    elements.forEach((element, index) => {
      animationFn(element, index * staggerDelay)
    })
  }, [selector, animation, staggerDelay, fadeInUp, slideInFromRight, scaleIn])

  return { containerRef }
}

// Hook for loading state transitions
export function useLoadingTransition() {
  const shimmer = useCallback((element: HTMLElement) => {
    element.style.background = 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)'
    element.style.backgroundSize = '200% 100%'
    element.style.animation = 'shimmer 1.5s infinite'
  }, [])

  const fadeInContent = useCallback((element: HTMLElement) => {
    element.style.opacity = '0'
    element.style.transition = 'opacity 0.3s ease-in-out'
    
    // Small delay to ensure smooth transition
    requestAnimationFrame(() => {
      element.style.opacity = '1'
    })
  }, [])

  return {
    shimmer,
    fadeInContent
  }
}

// Hook for notification animations
export function useNotificationAnimations() {
  const slideInFromTop = useCallback((element: HTMLElement) => {
    element.style.transform = 'translateY(-100%)'
    element.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
    
    requestAnimationFrame(() => {
      element.style.transform = 'translateY(0)'
    })
  }, [])

  const bounceIn = useCallback((element: HTMLElement) => {
    element.style.transform = 'scale(0.3) translateY(-100%)'
    element.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
    
    requestAnimationFrame(() => {
      element.style.transform = 'scale(1) translateY(0)'
    })
  }, [])

  const shakeError = useCallback((element: HTMLElement) => {
    element.style.animation = 'shake 0.5s ease-in-out'
    setTimeout(() => {
      element.style.animation = ''
    }, 500)
  }, [])

  return {
    slideInFromTop,
    bounceIn,
    shakeError
  }
}