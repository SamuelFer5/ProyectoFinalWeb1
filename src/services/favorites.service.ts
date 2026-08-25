import { http } from './http'
import { CACHE_KEYS, cacheService } from './cache.service'
import { viewsService } from './views.service'
import { isApiError } from '../models'
import type { FavoriteResponseDto, MyFavoritesResponseDto } from '../models/dto'
import type { View } from '../models'

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

  /**
   * Publicaciones favoritas COMPLETAS, para la seccion "Mis Favoritos".
   *
   * El API no tiene un endpoint que las devuelva: `GET /users/me/favorites`
   * entrega solo los IDs, asi que hay que pedir cada publicacion por separado.
   *
   * Se usa `allSettled` y no `all` a proposito: un favorito puede apuntar a una
   * publicacion que el superadmin despublico despues, y en ese caso
   * `GET /views/:id` responde 404 a quien no es su autor. Con `Promise.all` un
   * solo 404 tumbaria la lista entera; asi, las que ya no existen simplemente
   * se omiten y el usuario ve el resto de sus favoritos.
   *
   * IMPORTANTE: solo se omite el 404, que es el unico fallo esperado. Un 500,
   * un corte de red o un `abort` se propagan para que la pantalla pueda mostrar
   * su estado de error y ofrecer reintentar. Descartarlos aqui haria que el
   * perfil diera la lista por cargada y mostrara menos favoritos sin avisar.
   */
  async listViews(signal?: AbortSignal): Promise<View[]> {
    const ids = await favoritesService.sync(signal)
    if (ids.length === 0) return []

    const results = await Promise.allSettled(
      ids.map((id) => viewsService.detail(id, signal)),
    )

    const favoritas: View[] = []

    for (const result of results) {
      if (result.status === 'fulfilled') {
        favoritas.push(result.value)
        continue
      }

      // Publicacion despublicada o borrada: se omite en silencio, es esperado.
      if (isApiError(result.reason) && result.reason.status === 404) continue

      // Cualquier otro fallo si es un problema real y debe verlo el usuario.
      throw result.reason
    }

    return favoritas
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
