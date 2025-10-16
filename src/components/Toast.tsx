import { createContext, useContext, useState, useCallback, ReactNode, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

export type ToastType = 'success' | 'error' | 'info' | 'loading'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number // 0 = no auto-dismiss
  progress?: number // 0-100 for progress bar
  actions?: ToastAction[] // Action buttons
  onDismiss?: () => void // Called when toast is dismissed
}

interface ToastContextType {
  showToast: (type: ToastType, message: string, duration?: number) => string
  success: (message: string, duration?: number) => string
  error: (message: string, duration?: number) => string
  info: (message: string, duration?: number) => string
  loading: (message: string, progress?: number) => string
  updateToast: (id: string, updates: Partial<Omit<Toast, 'id'>>) => void
  dismissToast: (id: string) => void
  showAdvancedToast: (toast: Omit<Toast, 'id'>) => string
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

interface ToastProviderProps {
  children: ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timeoutsRef = useRef<Map<string, number>>(new Map())

  const removeToast = useCallback((id: string) => {
    const toast = toasts.find(t => t.id === id)
    if (toast?.onDismiss) {
      toast.onDismiss()
    }

    // Clear timeout if exists
    const timeout = timeoutsRef.current.get(id)
    if (timeout) {
      clearTimeout(timeout)
      timeoutsRef.current.delete(id)
    }

    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [toasts])

  const scheduleAutoDismiss = useCallback((id: string, duration: number) => {
    if (duration > 0) {
      const timeout = window.setTimeout(() => {
        removeToast(id)
      }, duration)
      timeoutsRef.current.set(id, timeout)
    }
  }, [removeToast])

  const showToast = useCallback((type: ToastType, message: string, duration: number = 4000): string => {
    const id = Math.random().toString(36).substring(2, 11)
    const newToast: Toast = { id, type, message, duration }

    setToasts((prev) => [...prev, newToast])
    scheduleAutoDismiss(id, duration)

    return id
  }, [scheduleAutoDismiss])

  const success = useCallback((message: string, duration?: number): string => {
    return showToast('success', message, duration)
  }, [showToast])

  const error = useCallback((message: string, duration?: number): string => {
    return showToast('error', message, duration)
  }, [showToast])

  const info = useCallback((message: string, duration?: number): string => {
    return showToast('info', message, duration)
  }, [showToast])

  const loading = useCallback((message: string, progress?: number): string => {
    const id = Math.random().toString(36).substring(2, 11)
    const newToast: Toast = { id, type: 'loading', message, duration: 0, progress }

    setToasts((prev) => [...prev, newToast])
    return id
  }, [])

  const updateToast = useCallback((id: string, updates: Partial<Omit<Toast, 'id'>>) => {
    setToasts((prev) => prev.map(toast => {
      if (toast.id === id) {
        const updated = { ...toast, ...updates }

        // If duration changed and is positive, reschedule auto-dismiss
        if (updates.duration !== undefined && updates.duration > 0) {
          // Clear old timeout
          const oldTimeout = timeoutsRef.current.get(id)
          if (oldTimeout) {
            clearTimeout(oldTimeout)
          }
          // Schedule new timeout
          const newTimeout = window.setTimeout(() => {
            removeToast(id)
          }, updates.duration)
          timeoutsRef.current.set(id, newTimeout)
        }

        return updated
      }
      return toast
    }))
  }, [removeToast])

  const dismissToast = useCallback((id: string) => {
    removeToast(id)
  }, [removeToast])

  const showAdvancedToast = useCallback((toast: Omit<Toast, 'id'>): string => {
    const id = Math.random().toString(36).substring(2, 11)
    const newToast: Toast = { id, ...toast }

    setToasts((prev) => [...prev, newToast])

    if (toast.duration && toast.duration > 0) {
      scheduleAutoDismiss(id, toast.duration)
    }

    return id
  }, [scheduleAutoDismiss])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(timeout => clearTimeout(timeout))
      timeoutsRef.current.clear()
    }
  }, [])

  return (
    <ToastContext.Provider value={{
      showToast,
      success,
      error,
      info,
      loading,
      updateToast,
      dismissToast,
      showAdvancedToast
    }}>
      {children}
      {createPortal(
        <ToastContainer toasts={toasts} onRemove={removeToast} />,
        document.body
      )}
    </ToastContext.Provider>
  )
}

interface ToastContainerProps {
  toasts: Toast[]
  onRemove: (id: string) => void
}

function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  )
}

interface ToastItemProps {
  toast: Toast
  onRemove: (id: string) => void
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const { id, type, message, progress, actions } = toast

  const typeStyles = {
    success: 'bg-green-600 border-green-500',
    error: 'bg-red-600 border-red-500',
    info: 'bg-blue-600 border-blue-500',
    loading: 'bg-blue-700 border-blue-600',
  }

  const typeIcons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    loading: '⟳',
  }

  return (
    <div
      className={`${typeStyles[type]} border-l-4 text-white rounded-lg shadow-lg p-4 max-w-md min-w-[320px] pointer-events-auto animate-slide-in-right`}
      role="alert"
      aria-atomic="true"
    >
      {/* Header with icon, message, and close button */}
      <div className="flex items-start gap-3 mb-2">
        <span
          className={`text-xl font-bold flex-shrink-0 ${type === 'loading' ? 'animate-spin' : ''}`}
          aria-hidden="true"
        >
          {typeIcons[type]}
        </span>
        <div className="flex-1 text-sm font-medium break-words whitespace-pre-wrap">
          {message}
        </div>
        <button
          onClick={() => onRemove(id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onRemove(id)
            }
          }}
          className="flex-shrink-0 text-white opacity-70 hover:opacity-100 transition-opacity text-2xl font-bold leading-none -mt-1"
          aria-label="Dismiss notification"
          tabIndex={0}
        >
          ×
        </button>
      </div>

      {/* Progress bar (if provided) */}
      {progress !== undefined && (
        <div className="w-full bg-white bg-opacity-20 rounded-full h-2 mb-2">
          <div
            className="bg-white h-2 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      )}

      {/* Action buttons (if provided) */}
      {actions && actions.length > 0 && (
        <div className="flex gap-2 mt-2">
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={() => {
                action.onClick()
                // Don't auto-dismiss on action click - let the action handler decide
              }}
              className="px-3 py-1 text-xs font-semibold bg-white bg-opacity-20 hover:bg-opacity-30 rounded transition text-white"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
