import { http } from './http'
import { CACHE_KEYS, cacheService } from './cache.service'
import type { View } from '../models'

/**
 * Favoritos con doble escritura: API + cache local.
 *
 * El enunciado pide que el icono de favorito se pinte con su estado correcto
 * desde el primer render, sin esperar respuesta del API. Para eso se mantiene
 * en `lasdoscaras_favorites` la lista de IDs favoritos del usuario, que se
 * sincroniza al iniciar sesion y se actualiza en cada alta o baja.
 */

function readIds(): string[] {
  return cacheService.get<string[]>(CACHE_KEYS.favorites) ?? []
}

function writeIds(ids: string[]): void {
  cacheService.set(CACHE_KEYS.favorites, ids)
}

export const favoritesService = {
  readIds,

  isFavorite: (viewId: string): boolean => readIds().includes(viewId),

  /**
   * GET /users/me/favorites — se llama justo despues del login y desde el
   * perfil. Persiste los IDs para que el tablero no tenga que consultarlos.
   */
  async sync(signal?: AbortSignal): Promise<View[]> {
    const favorites = await http.get<View[]>('/users/me/favorites', { signal })
    writeIds(favorites.map((view) => view.id))
    return favorites
  },

  /** POST /views/:id/favorite — alta en el API y en el cache. */
  async add(viewId: string): Promise<void> {
    await http.post<void>(`/views/${viewId}/favorite`)
    const ids = readIds()
    if (!ids.includes(viewId)) writeIds([...ids, viewId])
  },

  /** DELETE /views/:id/favorite — baja en el API y en el cache. */
  async remove(viewId: string): Promise<void> {
    await http.delete<void>(`/views/${viewId}/favorite`)
    writeIds(readIds().filter((id) => id !== viewId))
  },

  /** Alterna el estado y devuelve el valor resultante. */
  async toggle(viewId: string): Promise<boolean> {
    const wasFavorite = readIds().includes(viewId)
    if (wasFavorite) {
      await favoritesService.remove(viewId)
      return false
    }
    await favoritesService.add(viewId)
    return true
  },
}
