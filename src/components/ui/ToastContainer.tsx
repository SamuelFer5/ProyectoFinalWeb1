import { useToast } from '../../hooks/useToast'
import type { ToastType } from '../../context/toast-context'

/** Icono y etiqueta accesible por tipo de notificacion. */
const DECOR: Record<ToastType, { icon: string; label: string }> = {
  success: { icon: '✓', label: 'Exito' },
  error: { icon: '✕', label: 'Error' },
  warning: { icon: '!', label: 'Advertencia' },
  info: { icon: 'i', label: 'Informacion' },
}

/**
 * Pila de notificaciones. Se monta una sola vez en el layout raiz.
 *
 * Accesibilidad: los errores y advertencias usan `role="alert"` (interrumpen al
 * lector de pantalla) y el resto `role="status"` (se anuncian sin interrumpir),
 * tal como pide el enunciado.
 */
export function ToastContainer() {
  const { toasts, dismiss } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => {
        const decor = DECOR[toast.type]
        const isUrgent = toast.type === 'error' || toast.type === 'warning'

        return (
          <div
            key={toast.id}
            className={`toast toast--${toast.type}`}
            role={isUrgent ? 'alert' : 'status'}
          >
            <span className="toast__icon" aria-hidden="true">
              {decor.icon}
            </span>
            <span className="toast__body">
              <span className="sr-only">{decor.label}: </span>
              {toast.message}
            </span>
            <button
              type="button"
              className="toast__close"
              onClick={() => {
                dismiss(toast.id)
              }}
              aria-label="Cerrar notificacion"
            >
              ✕
            </button>
          </div>
        )
      })}
    </div>
  )
}
