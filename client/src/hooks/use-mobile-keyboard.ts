import { useState, useEffect, useCallback } from 'react';
import { useResponsive } from './use-responsive';

interface MobileKeyboardState {
  isKeyboardOpen: boolean;
  viewportHeight: number;
  originalViewportHeight: number;
}

export function useMobileKeyboard() {
  const { isMobile } = useResponsive();
  const [keyboardState, setKeyboardState] = useState<MobileKeyboardState>({
    isKeyboardOpen: false,
    viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
    originalViewportHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  const handleResize = useCallback(() => {
    if (!isMobile) return;
    
    const currentHeight = window.innerHeight;
    const threshold = keyboardState.originalViewportHeight * 0.75; // 75% of original height
    
    setKeyboardState(prev => ({
      ...prev,
      viewportHeight: currentHeight,
      isKeyboardOpen: currentHeight < threshold,
    }));
  }, [isMobile, keyboardState.originalViewportHeight]);

  // Update original height when not mobile or on first load
  useEffect(() => {
    if (!isMobile) {
      setKeyboardState(prev => ({
        ...prev,
        originalViewportHeight: window.innerHeight,
        viewportHeight: window.innerHeight,
        isKeyboardOpen: false,
      }));
    }
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile) return;

    let timeoutId: NodeJS.Timeout;
    
    const debouncedResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleResize, 100);
    };

    // Set initial values
    setKeyboardState({
      isKeyboardOpen: false,
      viewportHeight: window.innerHeight,
      originalViewportHeight: window.innerHeight,
    });

    window.addEventListener('resize', debouncedResize);
    
    // Handle visual viewport API if available (better for mobile)
    if (window.visualViewport) {
      const handleVisualViewportChange = () => {
        const currentHeight = window.visualViewport!.height;
        const threshold = keyboardState.originalViewportHeight * 0.75;
        
        setKeyboardState(prev => ({
          ...prev,
          viewportHeight: currentHeight,
          isKeyboardOpen: currentHeight < threshold,
        }));
      };
      
      window.visualViewport.addEventListener('resize', handleVisualViewportChange);
      
      return () => {
        window.removeEventListener('resize', debouncedResize);
        window.visualViewport?.removeEventListener('resize', handleVisualViewportChange);
        clearTimeout(timeoutId);
      };
    }

    return () => {
      window.removeEventListener('resize', debouncedResize);
      clearTimeout(timeoutId);
    };
  }, [isMobile, handleResize, keyboardState.originalViewportHeight]);

  // Scroll to bottom when keyboard opens (for chat)
  const scrollToBottom = useCallback((element?: HTMLElement) => {
    if (keyboardState.isKeyboardOpen && element) {
      setTimeout(() => {
        element.scrollTo({
          top: element.scrollHeight,
          behavior: 'smooth'
        });
      }, 150);
    }
  }, [keyboardState.isKeyboardOpen]);

  return {
    ...keyboardState,
    scrollToBottom,
  };
}