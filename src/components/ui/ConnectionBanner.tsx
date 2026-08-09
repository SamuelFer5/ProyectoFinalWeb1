import { useOnlineStatus } from '../../hooks/useOnlineStatus'

/**
 * Banner de estado de red. Aparece cuando el navegador se declara sin conexion
 * o cuando la vista actual esta mostrando datos servidos desde el cache.
 */
export function ConnectionBanner({ showingCache = false }: { showingCache?: boolean }) {
  const isOnline = useOnlineStatus()

  if (isOnline && !showingCache) return null

  const message = !isOnline
    ? 'Sin conexion a Internet. Esta viendo informacion guardada; las acciones de escritura no estaran disponibles.'
    : 'Mostrando informacion guardada — sin conexion al servidor.'

  return (
    <div className="banner banner--offline" role="status">
      <span aria-hidden="true">⚠</span>
      <span>{message}</span>
    </div>
  )
}
