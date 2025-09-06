import { useEffect, useCallback, useRef } from 'react';

export interface AccessibilityOptions {
  announceMessages?: boolean;
  announceNavigation?: boolean;
  reducedMotion?: boolean;
  highContrast?: boolean;
  announceTyping?: boolean;
}

export function useAccessibility(options: AccessibilityOptions = {}) {
  const {
    announceMessages = true,
    announceNavigation: shouldAnnounceNavigation = true,
    reducedMotion = false,
    announceTyping: shouldAnnounceTyping = true
  } = options;
  
  const liveRegionRef = useRef<HTMLDivElement | null>(null);

  // Create live region for screen reader announcements
  useEffect(() => {
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'sr-only';
    liveRegion.id = 'accessibility-live-region';
    // Ensure accessibility region is completely off-screen and can't interfere with layout
    liveRegion.style.position = 'fixed';
    liveRegion.style.top = '-9999px';
    liveRegion.style.left = '-9999px';
    liveRegion.style.zIndex = '-1';
    liveRegion.style.width = '1px';
    liveRegion.style.height = '1px';
    liveRegion.style.overflow = 'hidden';
    document.body.appendChild(liveRegion);
    liveRegionRef.current = liveRegion;

    return () => {
      if (liveRegion.parentNode) {
        liveRegion.parentNode.removeChild(liveRegion);
      }
    };
  }, []);

  // Announce text to screen readers
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (liveRegionRef.current) {
      liveRegionRef.current.setAttribute('aria-live', priority);
      liveRegionRef.current.textContent = message;
      
      // Clear after announcement
      setTimeout(() => {
        if (liveRegionRef.current) {
          liveRegionRef.current.textContent = '';
        }
      }, 1000);
    }
  }, []);

  // Announce new messages
  const announceMessage = useCallback((sender: string, content: string, isPrivate = false) => {
    if (announceMessages) {
      const prefix = isPrivate ? 'Private message from' : 'New message from';
      announce(`${prefix} ${sender}: ${content}`);
    }
  }, [announce, announceMessages]);

  // Announce navigation changes
  const announceNavigation = useCallback((location: string) => {
    if (shouldAnnounceNavigation) {
      announce(`Navigated to ${location}`);
    }
  }, [announce, shouldAnnounceNavigation]);

  // Announce room changes
  const announceRoomChange = useCallback((roomName: string, memberCount?: number) => {
    const memberText = memberCount ? ` with ${memberCount} member${memberCount === 1 ? '' : 's'}` : '';
    announce(`Joined room ${roomName}${memberText}`);
  }, [announce]);

  // Announce typing status
  const announceTyping = useCallback((userName: string, isTyping: boolean) => {
    if (shouldAnnounceTyping) {
      const message = isTyping ? `${userName} is typing` : `${userName} stopped typing`;
      announce(message);
    }
  }, [announce, shouldAnnounceTyping]);

  // Announce user status changes
  const announceUserStatus = useCallback((userName: string, status: 'online' | 'offline') => {
    announce(`${userName} is now ${status}`);
  }, [announce]);

  // Enhanced keyboard navigation handler
  const handleKeyboardNavigation = useCallback((
    event: KeyboardEvent,
    elements: HTMLElement[],
    currentIndex: number,
    onIndexChange: (index: number) => void
  ) => {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault();
        const nextIndex = (currentIndex + 1) % elements.length;
        onIndexChange(nextIndex);
        elements[nextIndex]?.focus();
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault();
        const prevIndex = currentIndex === 0 ? elements.length - 1 : currentIndex - 1;
        onIndexChange(prevIndex);
        elements[prevIndex]?.focus();
        break;
      case 'Home':
        event.preventDefault();
        onIndexChange(0);
        elements[0]?.focus();
        break;
      case 'End':
        event.preventDefault();
        const lastIndex = elements.length - 1;
        onIndexChange(lastIndex);
        elements[lastIndex]?.focus();
        break;
    }
  }, []);

  // Focus trap utility for modals
  const createFocusTrap = useCallback((container: HTMLElement) => {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement?.focus();
          }
        }
      }
      
      if (event.key === 'Escape') {
        // Allow parent to handle escape
        return;
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    firstElement?.focus();

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Check for reduced motion preference
  const prefersReducedMotion = useCallback(() => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches || reducedMotion;
  }, [reducedMotion]);

  // Generate accessible IDs
  const generateId = useCallback((prefix: string) => {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  return {
    announce,
    announceMessage,
    announceNavigation,
    announceRoomChange,
    announceTyping,
    announceUserStatus,
    handleKeyboardNavigation,
    createFocusTrap,
    prefersReducedMotion,
    generateId,
    liveRegionRef
  };
}