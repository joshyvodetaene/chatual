import { useCallback, useEffect, useState, useMemo } from 'react'

interface KeyboardShortcut {
  key: string
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  metaKey?: boolean
  callback: (event: KeyboardEvent) => void
  description?: string
  preventDefault?: boolean
}

export function useKeyboardNavigation(shortcuts: KeyboardShortcut[] = []) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const matchingShortcut = shortcuts.find(shortcut => {
      return (
        event.key.toLowerCase() === shortcut.key.toLowerCase() &&
        !!event.ctrlKey === !!shortcut.ctrlKey &&
        !!event.shiftKey === !!shortcut.shiftKey &&
        !!event.altKey === !!shortcut.altKey &&
        !!event.metaKey === !!shortcut.metaKey
      )
    })

    if (matchingShortcut) {
      if (matchingShortcut.preventDefault !== false) {
        event.preventDefault()
      }
      matchingShortcut.callback(event)
    }
  }, [shortcuts])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return { shortcuts }
}

// Common keyboard navigation patterns
export function useArrowKeyNavigation(
  containerRef: React.RefObject<HTMLElement>,
  options: {
    orientation?: 'horizontal' | 'vertical' | 'both'
    loop?: boolean
    selector?: string
  } = {}
) {
  const {
    orientation = 'both',
    loop = false,
    selector = '[tabindex]:not([tabindex="-1"]), button, [href], input, select, textarea'
  } = options

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleKeyDown = (event: KeyboardEvent) => {
      const focusableElements = Array.from(
        container.querySelectorAll(selector)
      ) as HTMLElement[]

      const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement)
      if (currentIndex === -1) return

      let nextIndex = currentIndex
      const canNavigateHorizontally = orientation === 'horizontal' || orientation === 'both'
      const canNavigateVertically = orientation === 'vertical' || orientation === 'both'

      switch (event.key) {
        case 'ArrowRight':
          if (canNavigateHorizontally) {
            event.preventDefault()
            nextIndex = currentIndex + 1
          }
          break
        case 'ArrowLeft':
          if (canNavigateHorizontally) {
            event.preventDefault()
            nextIndex = currentIndex - 1
          }
          break
        case 'ArrowDown':
          if (canNavigateVertically) {
            event.preventDefault()
            nextIndex = currentIndex + 1
          }
          break
        case 'ArrowUp':
          if (canNavigateVertically) {
            event.preventDefault()
            nextIndex = currentIndex - 1
          }
          break
        case 'Home':
          event.preventDefault()
          nextIndex = 0
          break
        case 'End':
          event.preventDefault()
          nextIndex = focusableElements.length - 1
          break
        default:
          return
      }

      // Handle looping
      if (loop) {
        if (nextIndex >= focusableElements.length) {
          nextIndex = 0
        } else if (nextIndex < 0) {
          nextIndex = focusableElements.length - 1
        }
      } else {
        nextIndex = Math.max(0, Math.min(nextIndex, focusableElements.length - 1))
      }

      focusableElements[nextIndex]?.focus()
    }

    container.addEventListener('keydown', handleKeyDown)
    return () => container.removeEventListener('keydown', handleKeyDown)
  }, [containerRef, orientation, loop, selector])
}

// Enhanced search/filter with keyboard support
export function useKeyboardSearch<T>(
  items: T[],
  getSearchText: (item: T) => string,
  onSelect?: (item: T) => void
) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const filteredItems = useMemo(() => {
    if (!searchQuery) return items
    return items.filter(item =>
      getSearchText(item).toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [items, searchQuery, getSearchText])

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setSelectedIndex(prev => 
          Math.min(prev + 1, filteredItems.length - 1)
        )
        break
      case 'ArrowUp':
        event.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
        break
      case 'Enter':
        event.preventDefault()
        if (filteredItems[selectedIndex] && onSelect) {
          onSelect(filteredItems[selectedIndex])
        }
        break
      case 'Escape':
        event.preventDefault()
        setSearchQuery('')
        setSelectedIndex(0)
        break
      default:
        // Handle alphanumeric keys for search
        if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
          setSearchQuery(prev => prev + event.key)
          setSelectedIndex(0)
        }
        break
    }
  }, [filteredItems, selectedIndex, onSelect])

  const clearSearch = useCallback(() => {
    setSearchQuery('')
    setSelectedIndex(0)
  }, [])

  return {
    searchQuery,
    selectedIndex,
    filteredItems,
    handleKeyDown,
    clearSearch,
    setSearchQuery
  }
}