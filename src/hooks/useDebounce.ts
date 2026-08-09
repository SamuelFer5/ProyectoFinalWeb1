import { useEffect, useState } from 'react'

/**
 * Retrasa la propagacion de un valor hasta que deja de cambiar.
 *
 * El enunciado exige un debounce minimo de 300 ms en la busqueda global para
 * no disparar una llamada al API en cada pulsacion de tecla.
 */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value)
    }, delayMs)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delayMs])

  return debounced
}
