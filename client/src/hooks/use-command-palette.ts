import { useState, useCallback, useMemo } from 'react'
import { useLocation } from 'wouter'

export interface Command {
  id: string
  title: string
  description?: string
  keywords?: string[]
  icon?: React.ReactNode
  action: () => void
  category?: string
  shortcut?: string[]
}

export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [, setLocation] = useLocation()

  // Define available commands
  const commands: Command[] = useMemo(() => [
    {
      id: 'focus-input',
      title: 'Focus Message Input',
      description: 'Focus the message input field',
      keywords: ['message', 'input', 'focus', 'type'],
      action: () => {
        const input = document.querySelector('[data-testid="message-input"]') as HTMLElement
        input?.focus()
      },
      category: 'Navigation',
      shortcut: ['Ctrl', '1']
    },
    {
      id: 'create-room',
      title: 'Create New Room',
      description: 'Create a new chat room',
      keywords: ['room', 'create', 'new', 'add'],
      action: () => {
        const button = document.querySelector('[data-testid="button-create-room"]') as HTMLButtonElement
        button?.click()
      },
      category: 'Room Management',
      shortcut: ['Ctrl', 'N']
    },
    {
      id: 'upload-photo',
      title: 'Upload Photo',
      description: 'Upload a photo to the current room',
      keywords: ['photo', 'image', 'upload', 'picture'],
      action: () => {
        const button = document.querySelector('[data-testid="button-photo-upload"]') as HTMLButtonElement
        button?.click()
      },
      category: 'Messaging',
      shortcut: ['Ctrl', 'U']
    },
    {
      id: 'toggle-emoji',
      title: 'Toggle Emoji Picker',
      description: 'Open or close the emoji picker',
      keywords: ['emoji', 'emoticon', 'picker'],
      action: () => {
        const button = document.querySelector('[data-testid="button-emoji-picker"]') as HTMLButtonElement
        button?.click()
      },
      category: 'Messaging',
      shortcut: ['Ctrl', 'E']
    },
    {
      id: 'settings',
      title: 'Open Settings',
      description: 'Open the settings dialog',
      keywords: ['settings', 'preferences', 'config'],
      action: () => {
        // Navigate to settings or open settings modal
        console.log('Open settings')
      },
      category: 'General',
      shortcut: ['Ctrl', ',']
    },
    {
      id: 'refresh',
      title: 'Refresh Messages',
      description: 'Refresh the current room messages',
      keywords: ['refresh', 'reload', 'update'],
      action: () => {
        window.location.reload()
      },
      category: 'General',
      shortcut: ['Ctrl', 'R']
    }
  ], [])

  // Filter commands based on search term
  const filteredCommands = useMemo(() => {
    if (!searchTerm) return commands

    const term = searchTerm.toLowerCase()
    return commands.filter(command => 
      command.title.toLowerCase().includes(term) ||
      command.description?.toLowerCase().includes(term) ||
      command.keywords?.some(keyword => keyword.toLowerCase().includes(term)) ||
      command.category?.toLowerCase().includes(term)
    )
  }, [commands, searchTerm])

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {}
    filteredCommands.forEach(command => {
      const category = command.category || 'Other'
      if (!groups[category]) {
        groups[category] = []
      }
      groups[category].push(command)
    })
    return groups
  }, [filteredCommands])

  const openPalette = useCallback(() => {
    setIsOpen(true)
    setSearchTerm('')
  }, [])

  const closePalette = useCallback(() => {
    setIsOpen(false)
    setSearchTerm('')
  }, [])

  const executeCommand = useCallback((command: Command) => {
    command.action()
    closePalette()
  }, [closePalette])

  return {
    isOpen,
    searchTerm,
    setSearchTerm,
    commands: filteredCommands,
    groupedCommands,
    openPalette,
    closePalette,
    executeCommand
  }
}