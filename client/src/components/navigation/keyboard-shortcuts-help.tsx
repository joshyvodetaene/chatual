import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Keyboard } from 'lucide-react'

interface KeyboardShortcut {
  keys: string[]
  description: string
  category: string
}

const shortcuts: KeyboardShortcut[] = [
  // Navigation
  { keys: ['Ctrl', 'K'], description: 'Open command palette', category: 'Navigation' },
  { keys: ['Ctrl', '1'], description: 'Focus message input', category: 'Navigation' },
  { keys: ['Ctrl', '2'], description: 'Focus room list', category: 'Navigation' },
  { keys: ['Ctrl', '3'], description: 'Focus user list', category: 'Navigation' },
  { keys: ['Escape'], description: 'Close modals/dialogs', category: 'Navigation' },
  
  // Messaging
  { keys: ['Enter'], description: 'Send message', category: 'Messaging' },
  { keys: ['Shift', 'Enter'], description: 'New line in message', category: 'Messaging' },
  { keys: ['Ctrl', 'U'], description: 'Upload photo', category: 'Messaging' },
  { keys: ['Ctrl', 'E'], description: 'Toggle emoji picker', category: 'Messaging' },
  
  // Room Management
  { keys: ['Ctrl', 'N'], description: 'Create new room', category: 'Room Management' },
  { keys: ['Ctrl', 'J'], description: 'Join room dialog', category: 'Room Management' },
  { keys: ['↑', '↓'], description: 'Navigate rooms', category: 'Room Management' },
  
  // General
  { keys: ['Ctrl', ','], description: 'Open settings', category: 'General' },
  { keys: ['Ctrl', '/'], description: 'Show keyboard shortcuts', category: 'General' },
  { keys: ['Ctrl', 'R'], description: 'Refresh messages', category: 'General' },
  { keys: ['F1'], description: 'Show help', category: 'General' }
]

function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground border border-border ${className}`}>
      {children}
    </kbd>
  )
}

export function KeyboardShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false)

  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = []
    }
    acc[shortcut.category].push(shortcut)
    return acc
  }, {} as Record<string, KeyboardShortcut[]>)

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        className="hover-lift"
        title="Keyboard shortcuts (Ctrl + /)"
        data-testid="button-keyboard-shortcuts"
      >
        <Keyboard className="h-4 w-4" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" />
              Keyboard Shortcuts
            </DialogTitle>
            <DialogDescription>
              Use these keyboard shortcuts to navigate and interact with the chat app more efficiently.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 mt-4">
            {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
              <div key={category}>
                <h3 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wide">
                  {category}
                </h3>
                <div className="space-y-2">
                  {categoryShortcuts.map((shortcut, index) => (
                    <div key={index} className="flex items-center justify-between py-1">
                      <span className="text-sm">{shortcut.description}</span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, keyIndex) => (
                          <span key={keyIndex} className="flex items-center">
                            <Kbd>{key}</Kbd>
                            {keyIndex < shortcut.keys.length - 1 && (
                              <span className="mx-1 text-muted-foreground">+</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>Tip:</strong> Most shortcuts work globally. Some shortcuts like room navigation only work when the room list is focused.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function useGlobalKeyboardShortcuts() {
  const [isHelpOpen, setIsHelpOpen] = useState(false)

  // This would be used in a global context to provide shortcuts
  const shortcuts = [
    {
      keys: ['Ctrl', '/'],
      description: 'Show keyboard shortcuts',
      action: () => setIsHelpOpen(true)
    }
  ]

  return {
    shortcuts,
    isHelpOpen,
    setIsHelpOpen
  }
}