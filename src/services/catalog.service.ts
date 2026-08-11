import { http, buildQuery } from './http'
import { CACHE_KEYS, cacheService } from './cache.service'
import { toCategory, toHashtag } from './mappers'
import type {
  CategoriesResponseDto,
  CategoryResponseDto,
  HashtagsResponseDto,
} from '../models/dto'
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

  /** GET /categories — solo las activas. Refresca el cache al responder. */
  async fetchCategories(signal?: AbortSignal): Promise<Category[]> {
    const dto = await http.get<CategoriesResponseDto>('/categories', {
      auth: false,
      signal,
    })

    const categories = dto.categories.map(toCategory)
    cacheService.set(CACHE_KEYS.categories, categories)
    return categories
  },

  /** GET /categories/:id — metadatos de una categoria concreta. Puede dar 404. */
  async fetchCategory(id: string, signal?: AbortSignal): Promise<Category> {
    const dto = await http.get<CategoryResponseDto>(`/categories/${id}`, {
      auth: false,
      signal,
    })

    return toCategory(dto.category)
  },

  /**
   * GET /hashtags — el API devuelve como maximo 20 ordenados alfabeticamente.
   * Refresca el cache al responder.
   */
  async fetchHashtags(signal?: AbortSignal): Promise<Hashtag[]> {
    const dto = await http.get<HashtagsResponseDto>('/hashtags', {
      auth: false,
      signal,
    })

    const hashtags = dto.hashtags.map(toHashtag)
    cacheService.set(CACHE_KEYS.hashtags, hashtags)
    return hashtags
  },

  /**
   * GET /hashtags?q= — sugerencias para el autocomplete del formulario.
   * No toca el cache: es una busqueda puntual, no el catalogo completo.
   */
  async searchHashtags(term: string, signal?: AbortSignal): Promise<Hashtag[]> {
    const dto = await http.get<HashtagsResponseDto>(`/hashtags${buildQuery({ q: term })}`, {
      auth: false,
      signal,
    })

    return dto.hashtags.map(toHashtag)
  },
}
