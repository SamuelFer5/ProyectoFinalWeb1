import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { CACHE_KEYS, cacheService } from '../services/cache.service'
import { ThemeContext, type Theme } from './theme-context'

/**
 * Tema claro / oscuro persistido en `lasdoscaras_theme`.
 *
 * El primer pintado NO ocurre aqui: el script en linea de `index.html` ya
 * escribio `data-theme` en <html> antes de que React montara, que es lo que
 * evita el destello de tema incorrecto (FOUC) que el enunciado penaliza. Este
 * provider solo lee ese valor ya aplicado y se encarga de los cambios
 * posteriores.
 */

function readInitialTheme(): Theme {
  const stored = cacheService.get<Theme>(CACHE_KEYS.theme)
  if (stored === 'light' || stored === 'dark') return stored

  // Sin preferencia guardada se respeta la del sistema operativo.
  const fromDom = document.documentElement.dataset.theme
  if (fromDom === 'light' || fromDom === 'dark') return fromDom

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark'
      cacheService.set(CACHE_KEYS.theme, next)
      return next
    })
  }, [])

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme])

  return <ThemeContext value={value}>{children}</ThemeContext>
}
