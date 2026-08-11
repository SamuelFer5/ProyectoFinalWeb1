import { useOnlineStatus } from '../../hooks/useOnlineStatus'

interface ConnectionBannerProps {
  /**
   * `true` cuando la vista actual esta pintando datos servidos desde el cache
   * porque el API no respondio. Distinto de estar sin Internet: el navegador
   * puede tener red y aun asi no alcanzar el servidor.
   */
  showingCache?: boolean
}

/**
 * Banner de estado de red.
 *
 * Se monta en dos lugares con responsabilidades que NO se solapan, para que
 * nunca aparezcan dos avisos a la vez:
 *
 *   - En el Layout, sin props: cubre la perdida de conexion del navegador y es
 *     global a toda la aplicacion.
 *   - En una pantalla concreta, con `showingCache`: cubre el caso de "hay red
 *     pero el API no contesta". Si ademas no hay Internet, se calla y deja que
 *     hable el banner global, que ya explica la causa de fondo.
 */
export function ConnectionBanner({ showingCache = false }: ConnectionBannerProps) {
  const isOnline = useOnlineStatus()

  if (showingCache) {
    if (!isOnline) return null

    return (
      <div className="banner banner--offline" role="status">
        <span aria-hidden="true">⚠</span>
        <span>Mostrando informacion guardada — sin conexion al servidor.</span>
      </div>
    )
  }

  if (isOnline) return null

  return (
    <div className="banner banner--offline" role="status">
      <span aria-hidden="true">⚠</span>
      <span>
        Sin conexion a Internet. Esta viendo informacion guardada; las acciones de escritura
        no estaran disponibles.
      </span>
    </div>
  )
}
