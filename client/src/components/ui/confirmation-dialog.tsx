import React from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { AlertTriangle, Info, HelpCircle, Trash2 } from 'lucide-react'

interface ConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel?: () => void
  variant?: 'destructive' | 'warning' | 'info' | 'default'
  icon?: React.ReactNode
}

const variantIcons = {
  destructive: <Trash2 className="h-6 w-6 text-destructive" />,
  warning: <AlertTriangle className="h-6 w-6 text-orange-600" />,
  info: <Info className="h-6 w-6 text-blue-600" />,
  default: <HelpCircle className="h-6 w-6 text-muted-foreground" />
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Continue',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'default',
  icon
}: ConfirmationDialogProps) {
  const handleConfirm = () => {
    onConfirm()
    onOpenChange(false)
  }

  const handleCancel = () => {
    onCancel?.()
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            {icon || variantIcons[variant]}
            <div className="flex-1">
              <AlertDialogTitle className="text-left">{title}</AlertDialogTitle>
            </div>
          </div>
          <AlertDialogDescription className="text-left mt-2">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-2">
          <AlertDialogCancel onClick={handleCancel} className="flex-1">
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            className="flex-1"
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// Hook for easier usage
export function useConfirmationDialog() {
  const [dialog, setDialog] = React.useState<{
    open: boolean
    props: Omit<ConfirmationDialogProps, 'open' | 'onOpenChange'>
  }>({
    open: false,
    props: {
      title: '',
      description: '',
      onConfirm: () => {}
    }
  })

  const showConfirmation = (props: Omit<ConfirmationDialogProps, 'open' | 'onOpenChange'>) => {
    setDialog({ open: true, props })
  }

  const hideConfirmation = () => {
    setDialog(prev => ({ ...prev, open: false }))
  }

  const ConfirmationDialogComponent = () => (
    <ConfirmationDialog
      {...dialog.props}
      open={dialog.open}
      onOpenChange={hideConfirmation}
    />
  )

  return {
    showConfirmation,
    hideConfirmation,
    ConfirmationDialog: ConfirmationDialogComponent
  }
}