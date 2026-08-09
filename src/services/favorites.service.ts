import { http } from './http'
import { CACHE_KEYS, cacheService } from './cache.service'
import type { FavoriteResponseDto, MyFavoritesResponseDto } from '../models/dto'

/**
 * Favoritos con doble escritura: API + cache local.
 *
 * El enunciado pide que el icono de favorito se pinte con su estado correcto
 * desde el primer render, sin esperar respuesta del API. Para eso se mantiene
 * en `lasdoscaras_favorites` la lista de IDs favoritos del usuario, que se
 * sincroniza al iniciar sesion y se actualiza en cada alta o baja.
 *
 * Nota sobre el API: `GET /users/me/favorites` devuelve UNICAMENTE los IDs
 * (`{ favorites: string[] }`), no las publicaciones completas. La pantalla de
 * perfil que liste "Mis Favoritos" debera pedir cada publicacion por su ID.
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
  async sync(signal?: AbortSignal): Promise<string[]> {
    const dto = await http.get<MyFavoritesResponseDto>('/users/me/favorites', { signal })
    writeIds(dto.favorites)
    return dto.favorites
  },

  /** POST /views/:id/favorite — alta en el API y en el cache. */
  async add(viewId: string): Promise<boolean> {
    const dto = await http.post<FavoriteResponseDto>(`/views/${viewId}/favorite`)

    const ids = readIds()
    if (!ids.includes(viewId)) writeIds([...ids, viewId])
    return dto.isFavorite
  },

  /** DELETE /views/:id/favorite — baja en el API y en el cache. */
  async remove(viewId: string): Promise<boolean> {
    const dto = await http.delete<FavoriteResponseDto>(`/views/${viewId}/favorite`)

    writeIds(readIds().filter((id) => id !== viewId))
    return dto.isFavorite
  },

  /** Alterna el estado y devuelve el valor resultante segun el API. */
  async toggle(viewId: string): Promise<boolean> {
    return readIds().includes(viewId)
      ? favoritesService.remove(viewId)
      : favoritesService.add(viewId)
  },

  /** Se invoca al cerrar sesion: los favoritos son de la cuenta, no del equipo. */
  clear(): void {
    cacheService.remove(CACHE_KEYS.favorites)
  },
}
