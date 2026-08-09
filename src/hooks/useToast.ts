import { useContext } from 'react'
import { ToastContext, type ToastContextValue } from '../context/toast-context'

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (context === null) {
    throw new Error('useToast debe usarse dentro de <ToastProvider>')
  }
  return context
}
