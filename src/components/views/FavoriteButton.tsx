import { useState } from 'react'
import { favoritesService } from '../../services/favorites.service'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { toUserMessage } from '../../utils/errors'

interface FavoriteButtonProps {
  viewId: string
  /** Estado inicial leido del cache `lasdoscaras_favorites`. */
  initialActive: boolean
  /**
   * Aviso opcional al contenedor cuando el API confirma el cambio.
   *
   * Existe para la seccion "Mis Favoritos" del perfil, que necesita sacar la
   * tarjeta de la lista al quitar el favorito. Es opcional a proposito: el
   * tablero y el detalle no necesitan reaccionar, y obligarlos a pasar un
   * callback vacio solo agregaria ruido.
   */
  onToggle?: (isFavorite: boolean) => void
}

/**
 * Boton de favorito con actualizacion optimista.
 *
 * Se pinta de inmediato con el estado del cache y se revierte si el API
 * rechaza la operacion, de forma que la interaccion se siente instantanea sin
 * mentirle al usuario cuando algo falla.
 */
export function FavoriteButton({ viewId, initialActive, onToggle }: FavoriteButtonProps) {
  const { isAuthenticated } = useAuth()
  const toast = useToast()
  const isOnline = useOnlineStatus()
  const [isActive, setIsActive] = useState(initialActive)
  const [isSaving, setIsSaving] = useState(false)

  // El enunciado limita favoritos a usuarios autenticados: para los anonimos
  // el control no se muestra en lugar de aparecer deshabilitado sin explicacion.
  if (!isAuthenticated) return null

  const handleClick = async () => {
    if (isSaving) return

    if (!isOnline) {
      toast.error('No es posible realizar esta accion sin conexion al servidor.')
      return
    }

    const previous = isActive
    setIsActive(!previous)
    setIsSaving(true)

    try {
      const isFavorite = await favoritesService.toggle(viewId)
      toast.success(previous ? 'Eliminado de favoritos' : 'Guardado en favoritos')
      onToggle?.(isFavorite)
    } catch (error) {
      setIsActive(previous)
      toast.error(toUserMessage(error, 'No se pudo actualizar el favorito.'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <button
      type="button"
      className={`icon-btn icon-btn--favorite${isActive ? ' is-active' : ''}`}
      onClick={() => {
        void handleClick()
      }}
      disabled={isSaving}
      aria-pressed={isActive}
      aria-label={isActive ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      title={isActive ? 'Quitar de favoritos' : 'Guardar en favoritos'}
    >
      <span aria-hidden="true">{isActive ? '♥' : '♡'}</span>
    </button>
  )
}