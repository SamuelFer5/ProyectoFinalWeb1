import { useEffect, useState } from 'react'

/**
 * Estado de conectividad del navegador.
 *
 * Alimenta el banner de "sin conexion" y permite que la aplicacion recargue
 * datos frescos automaticamente cuando vuelve la red (seccion 3.5).
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
    }
    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}
