// hooks/use-toast.tsx
import { toast as sonnerToast } from 'sonner'
import { ReactNode } from 'react'

interface ToastProps {
  title?: string
  description?: string | ReactNode
  action?: ReactNode
  variant?: 'default' | 'destructive' | 'success' | 'warning' | 'info'
  duration?: number
}

export function useToast() {
  const toast = ({ 
    title, 
    description, 
    action, 
    variant = 'default',
    duration 
  }: ToastProps) => {
    const message = title || ''
    const desc = description || ''

    // Kombinasi title dan description untuk message yang lebih baik
    const fullMessage = title && description 
      ? `${title}: ${desc}` 
      : title || description || ''

    switch (variant) {
      case 'destructive':
        return sonnerToast.error(fullMessage, {
          description: title && description ? description : undefined,
          duration,
          action
        })
      
      case 'success':
        return sonnerToast.success(fullMessage, {
          description: title && description ? description : undefined,
          duration,
          action
        })
      
      case 'warning':
        return sonnerToast.warning(fullMessage, {
          description: title && description ? description : undefined,
          duration,
          action
        })
      
      case 'info':
        return sonnerToast.info(fullMessage, {
          description: title && description ? description : undefined,
          duration,
          action
        })
      
      default:
        return sonnerToast(fullMessage, {
          description: title && description ? description : undefined,
          duration,
          action
        })
    }
  }

  return {
    toast,
    dismiss: (toastId?: string | number) => sonnerToast.dismiss(toastId),
    success: (message: string, description?: string) => 
      sonnerToast.success(message, { description }),
    error: (message: string, description?: string) => 
      sonnerToast.error(message, { description }),
    info: (message: string, description?: string) => 
      sonnerToast.info(message, { description }),
    warning: (message: string, description?: string) => 
      sonnerToast.warning(message, { description }),
    promise: sonnerToast.promise,
    loading: (message: string) => sonnerToast.loading(message),
  }
}

// Export direct toast functions untuk kemudahan penggunaan
export const toast = {
  success: (message: string, description?: string) => 
    sonnerToast.success(message, { description }),
  error: (message: string, description?: string) => 
    sonnerToast.error(message, { description }),
  info: (message: string, description?: string) => 
    sonnerToast.info(message, { description }),
  warning: (message: string, description?: string) => 
    sonnerToast.warning(message, { description }),
  promise: sonnerToast.promise,
  loading: (message: string) => sonnerToast.loading(message),
  dismiss: (toastId?: string | number) => sonnerToast.dismiss(toastId),
}