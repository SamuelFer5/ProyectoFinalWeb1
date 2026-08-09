import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type Toast, type ToastType } from './toast-context'

/**
 * Sistema centralizado de notificaciones (seccion 3.4 del enunciado).
 *
 * Es el unico mecanismo de la aplicacion para comunicar el resultado de una
 * accion: no se usa `alert()` en ninguna parte. Las notificaciones se
 * autocierran, no se acumulan sin limite y se anuncian a lectores de pantalla
 * mediante `role="alert"` / `role="status"` en el componente que las pinta.
 */

/** Los errores se leen mas despacio, por eso duran mas. */
const DURATION_MS: Record<ToastType, number> = {
  error: 5000,
  warning: 4500,
  success: 3000,
  info: 3000,
}

/** Tope de notificaciones simultaneas: se descartan las mas antiguas. */
const MAX_VISIBLE = 4

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id)
    if (timer !== undefined) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const notify = useCallback(
    (type: ToastType, message: string) => {
      const id = nextId.current++

      setToasts((current) => {
        const next = [...current, { id, type, message }]
        // Si se desbordan, se sueltan las mas viejas por el frente.
        return next.length > MAX_VISIBLE ? next.slice(next.length - MAX_VISIBLE) : next
      })

      timers.current.set(
        id,
        setTimeout(() => {
          dismiss(id)
        }, DURATION_MS[type]),
      )
    },
    [dismiss],
  )

  const value = useMemo(
    () => ({
      toasts,
      notify,
      dismiss,
      success: (message: string) => {
        notify('success', message)
      },
      error: (message: string) => {
        notify('error', message)
      },
      warning: (message: string) => {
        notify('warning', message)
      },
      info: (message: string) => {
        notify('info', message)
      },
    }),
    [toasts, notify, dismiss],
  )

  return <ToastContext value={value}>{children}</ToastContext>
}
