import { http, buildQuery } from './http'
import { CACHE_KEYS, cacheService } from './cache.service'
import type { Category, Hashtag } from '../models'

/**
 * Catalogos (categorias y hashtags) con estrategia cache-first.
 *
 * Estos dos listados son los que alimentan los filtros del tablero, asi que el
 * enunciado pide que esten disponibles *antes* de que el API responda. El
 * patron aqui es siempre el mismo: `readCached` para pintar de inmediato y
 * `fetchX` para revalidar en segundo plano.
 */

/** Lectura sincrona del cache, valida el TTL (1 hora para categorias). */
function readCachedCategories(): Category[] {
  return cacheService.get<Category[]>(CACHE_KEYS.categories) ?? []
}

/** Lectura tolerante: devuelve incluso datos caducados. Para el modo offline. */
function readStaleCategories(): Category[] {
  return cacheService.getStale<Category[]>(CACHE_KEYS.categories)?.value ?? []
}

function readCachedHashtags(): Hashtag[] {
  return cacheService.get<Hashtag[]>(CACHE_KEYS.hashtags) ?? []
}

function readStaleHashtags(): Hashtag[] {
  return cacheService.getStale<Hashtag[]>(CACHE_KEYS.hashtags)?.value ?? []
}

export const catalogService = {
  readCachedCategories,
  readStaleCategories,
  readCachedHashtags,
  readStaleHashtags,

  /** GET /categories — refresca el cache al recibir respuesta. */
  async fetchCategories(signal?: AbortSignal): Promise<Category[]> {
    const categories = await http.get<Category[]>('/categories', {
      auth: false,
      signal,
    })
    cacheService.set(CACHE_KEYS.categories, categories)
    return categories
  },

  /** GET /categories/:id — metadatos de una categoria concreta. */
  fetchCategory: (id: string, signal?: AbortSignal): Promise<Category> =>
    http.get<Category>(`/categories/${id}`, { auth: false, signal }),

  /** GET /hashtags — refresca el cache al recibir respuesta. */
  async fetchHashtags(signal?: AbortSignal): Promise<Hashtag[]> {
    const hashtags = await http.get<Hashtag[]>('/hashtags', {
      auth: false,
      signal,
    })
    cacheService.set(CACHE_KEYS.hashtags, hashtags)
    return hashtags
  },

  /**
   * GET /hashtags?q= — sugerencias para el autocomplete del formulario.
   * No toca el cache: es una busqueda puntual, no el catalogo completo.
   */
  searchHashtags: (term: string, signal?: AbortSignal): Promise<Hashtag[]> =>
    http.get<Hashtag[]>(`/hashtags${buildQuery({ q: term })}`, {
      auth: false,
      signal,
    }),
}
